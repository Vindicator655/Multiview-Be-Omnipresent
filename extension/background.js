'use strict';

// The viewer runs as a content script on this third-party URL, so the video embeds are requested
// from a real third-party page and are accepted by YouTube. Embeds get refused both from
// chrome-extension:// pages (no Referer header at all -> error 153) and, as of a recent YouTube
// change, from youtube.com itself embedding youtube.com (error 152, "self-referential" origin) -
// example.com is a neutral, IANA-reserved domain that satisfies neither rejection. viewer.js only
// activates on this exact URL.
const VIEWER_URL = 'https://example.com/#multiview';
const TAB_PATTERNS = ['*://www.youtube.com/*', '*://youtube.com/*', '*://m.youtube.com/*', '*://youtu.be/*'];

const isViewer = u => { try { const x = new URL(u); return x.hostname === 'example.com' && x.pathname === '/'; } catch (e) { return false; } };

// ---- what is this tab playing? { live: true/false/null, author: channel name or null } ----
// Runs inside the YouTube tab's own page (MAIN world) so it can ask YouTube's player directly.
function probeFn() {
  let live = null, author = null;
  try {
    const p = document.getElementById('movie_player');
    const d = p && p.getVideoData && p.getVideoData();
    if (d) {
      if (typeof d.isLive === 'boolean') live = d.isLive;
      if (d.author) author = String(d.author);
    }
  } catch (e) {}
  if (live === null) {
    try {
      const v = document.querySelector('video');
      if (v && v.readyState > 0) {
        if (v.duration === Infinity) live = true;
        else if (isFinite(v.duration) && v.duration > 0) {
          const b = document.querySelector('.ytp-live-badge');
          live = !!(b && getComputedStyle(b).display !== 'none' && !b.hasAttribute('disabled'));
        }
      }
    } catch (e) {}
  }
  if (!author) {
    try {
      const a = document.querySelector('ytd-watch-metadata ytd-channel-name a, #owner ytd-channel-name a');
      if (a && a.textContent.trim()) author = a.textContent.trim();
    } catch (e) {}
  }
  return { live, author };
}
const NO_INFO = { live: null, author: null };
const liveCache = new Map(); // "tabId|url" -> { live, author, ts }
async function probeLive(tab) {
  let path = '';
  try { path = new URL(tab.url).pathname; } catch (e) {}
  if (tab.discarded || !/^\/(watch|live\/)/.test(path)) return NO_INFO;   // channel pages etc. are handled by the viewer
  const key = tab.id + '|' + tab.url;
  const c = liveCache.get(key);
  if (c && Date.now() - c.ts < (c.live === null ? 6000 : 15000)) return c;
  let info = NO_INFO;
  try {
    const r = await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN', func: probeFn });
    const v = r && r[0] ? r[0].result : null;
    if (v) info = { live: typeof v.live === 'boolean' ? v.live : null, author: v.author || null };
  } catch (e) {}
  liveCache.set(key, Object.assign({ ts: Date.now() }, info));
  return info;
}

// The viewer lives on example.com, so it can't fetch youtube.com pages itself (CORS). It asks us
// instead; only youtube.com URLs are ever fetched here.
async function ytText(url) {
  const u = new URL(url);
  if (u.protocol !== 'https:' || u.hostname !== 'www.youtube.com') throw new Error('not a youtube.com URL');
  const res = await fetch(u.href, { credentials: 'include' });
  return res.text();
}
const unjson = s => { try { return JSON.parse('"' + s + '"'); } catch (e) { return s; } };
const unhtml = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// Toolbar icon: focus the viewer if it's already open, otherwise open it.
chrome.action.onClicked.addListener(async () => {
  const tabs = await chrome.tabs.query({ url: 'https://example.com/*' });
  const existing = tabs.find(t => (t.url || '').includes('#multiview'));
  if (existing) {
    await chrome.tabs.update(existing.id, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: VIEWER_URL });
  }
});

// Requests from the viewer content script (content scripts can't use chrome.tabs / chrome.scripting).
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg && msg.t) {
      case 'css':
        await chrome.scripting.insertCSS({ target: { tabId: sender.tab.id }, files: ['viewer.css'] });
        return true;
      case 'tabs': {
        const tabs = (await chrome.tabs.query({ url: TAB_PATTERNS }))
          .filter(t => t.id !== sender.tab.id && !isViewer(t.url));
        // Probing liveness injects a script into every matching tab; skip that work (and the cache
        // churn) when the viewer doesn't actually need live status (drawer closed, auto-add off).
        const info = msg.needLive ? await Promise.all(tabs.map(probeLive)) : tabs.map(() => NO_INFO);
        if (msg.needLive) {
          const keys = new Set(tabs.map(t => t.id + '|' + t.url));
          for (const k of liveCache.keys()) if (!keys.has(k)) liveCache.delete(k);
        }
        return tabs.map((t, i) => ({ id: t.id, url: t.url, title: t.title, audible: !!t.audible, live: info[i].live, channel: info[i].author }));
      }
      case 'videoInfo': {
        // live status + channel name for a video ID, read from its watch page
        if (!/^[\w-]{11}$/.test(msg.id || '')) return null;
        try {
          const html = await ytText('https://www.youtube.com/watch?v=' + msg.id);
          const live = /"isLiveNow":\s*true|"isLive":\s*true/.test(html) ? true : html.includes('"videoDetails"') ? false : null;
          const nm = html.match(/"ownerChannelName":"((?:[^"\\]|\\.)*)"/) || html.match(/"author":"((?:[^"\\]|\\.)*)"/);
          const tm = html.match(/"videoDetails":\{"videoId":"[\w-]{11}","title":"((?:[^"\\]|\\.)*)"/);
          return { live, channel: nm ? unjson(nm[1]) : null, title: tm ? unjson(tm[1]) : null };
        } catch (e) { return null; }
      }
      case 'resolveHandle': {
        // @handle / c/ / user/ / channel/UC… URL -> { id: UC… channel ID, name }
        try {
          const u = new URL(msg.url);
          if (!/^\/(@[^/]+|c\/[^/]+|user\/[^/]+|channel\/UC[\w-]{22})\/?$/.test(u.pathname)) return null;
          const html = await ytText(u.href);
          const m = html.match(/"channelId":"(UC[\w-]{22})"/) || html.match(/channel\/(UC[\w-]{22})/);
          const n = html.match(/<meta property="og:title" content="([^"]*)"/);
          return m ? { id: m[1], name: n ? unhtml(n[1]) : null } : null;
        } catch (e) { return null; }
      }
      case 'grab': {
        // read the playback position of the tab's video and (optionally) pause it
        try {
          const res = await chrome.scripting.executeScript({
            target: { tabId: msg.tabId },
            args: [!!msg.pause],
            func: pause => {
              const v = document.querySelector('video');
              if (!v) return null;
              const t = v.currentTime, live = !isFinite(v.duration) || v.duration === 0;
              if (pause) v.pause();
              return { t, live };
            }
          });
          return (res && res[0] && res[0].result) || null;
        } catch (e) { return null; }
      }
      case 'close':
        try { await chrome.tabs.remove(msg.tabId); } catch (e) {}
        return true;
      case 'open':
        await chrome.tabs.create({ url: msg.url });
        return true;
      case 'addToMultiview':
        // Sent by inject.js (the "+ Multiview" button next to Subscribe on a YouTube watch page).
        await sendToViewer({ id: msg.id, title: msg.title, channel: msg.channel });
        return true;
    }
    return null;
  })().then(sendResponse, () => sendResponse(null));
  return true; // async response
});

// Hands a video to the viewer: messages an open viewer tab, or opens one and lets it pick the
// video up from storage on start-up.
async function sendToViewer(video) {
  if (!/^[\w-]{11}$/.test(video.id || '')) return;
  const tabs = await chrome.tabs.query({ url: 'https://example.com/*' });
  const existing = tabs.find(t => (t.url || '').includes('#multiview'));
  if (existing) {
    try { await chrome.tabs.sendMessage(existing.id, Object.assign({ t: 'addVideo' }, video)); } catch (e) {}
    await chrome.tabs.update(existing.id, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
  } else {
    await chrome.storage.local.set({ mvPending: video });
    await chrome.tabs.create({ url: VIEWER_URL });
  }
}

// YouTube video ID from any watch / live / shorts / embed / youtu.be URL.
function videoIdFrom(url) {
  try {
    const u = new URL(url);
    const h = u.hostname.replace(/^(www|m)\./, '');
    let id = null;
    if (h === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (h === 'youtube.com' || h === 'youtube-nocookie.com') {
      if (u.pathname === '/watch') id = u.searchParams.get('v');
      else { const m = u.pathname.match(/^\/(live|shorts|embed)\/([\w-]{11})/); if (m) id = m[2]; }
    }
    return /^[\w-]{11}$/.test(id || '') ? id : null;
  } catch (e) { return null; }
}

// Right-click "Add to Multiview" on any YouTube video link, or on a YouTube watch page itself.
const YT_URLS = ['*://www.youtube.com/*', '*://youtube.com/*', '*://m.youtube.com/*', '*://youtu.be/*'];
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'mv-link', title: 'Add to Multiview', contexts: ['link'], targetUrlPatterns: YT_URLS });
    chrome.contextMenus.create({ id: 'mv-page', title: 'Add this video to Multiview', contexts: ['page', 'video'], documentUrlPatterns: YT_URLS });
  });
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  const url = info.menuItemId === 'mv-link' ? info.linkUrl : (tab && tab.url) || info.pageUrl;
  const id = videoIdFrom(url);
  if (id) sendToViewer({ id, title: info.menuItemId === 'mv-page' && tab ? tab.title.replace(/^\(\d+\)\s*/, '').replace(/\s*-\s*YouTube$/, '') : undefined });
});
