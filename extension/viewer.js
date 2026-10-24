'use strict';
/* Content script: runs only on https://example.com/#multiview (see background.js).
   It replaces that placeholder page with the viewer, so the video embeds come from a real
   third-party page (youtube.com now refuses embeds from chrome-extension:// pages AND from
   youtube.com embedding itself - example.com is neutral ground). Tab data comes from the
   background worker via chrome.runtime messages. */
(() => {
  if (location.hostname !== 'example.com' || location.pathname !== '/' || location.hash !== '#multiview') return;

  const BODY_HTML = `
  <div id="hot" aria-hidden="true"></div>
  <header id="bar">
    <div class="seg" id="layoutSeg" role="group" aria-label="Layout">
      <button type="button" data-n="4" title="2×2 (L)">4</button>
      <button type="button" data-n="9" title="3×3 (L)">9</button>
      <button type="button" data-n="16" title="4×4 (L)">16</button>
    </div>
    <div class="seg" id="modeSeg" role="group" aria-label="What qualifies">
      <button type="button" data-m="live" title="Only live streams qualify. Ordinary videos are refused.">Live only</button>
      <button type="button" data-m="all" title="Any video or live stream qualifies">All videos</button>
    </div>
    <select id="catFilter" title="Focus one source category: other tiles are dimmed and the tab drawer is filtered"></select>
    <form id="addForm" autocomplete="off">
      <input id="urlInput" type="text" placeholder="Paste a YouTube or any embeddable live URL…" spellcheck="false">
      <button type="submit" class="pri">Add</button>
    </form>
    <button type="button" id="tabsBtn" title="Pick from open YouTube tabs (T)">YouTube tabs <span id="tabCount" class="badge">0</span></button>
    <span class="sep"></span>
    <button type="button" id="playAll" title="Play all">▶ All</button>
    <button type="button" id="pauseAll" title="Pause all (P)">❚❚ All</button>
    <button type="button" id="muteAll" title="Mute all (M)">🔇 All</button>
    <span class="grow"></span>
    <span id="clock" title="Current time, UTC"></span>
    <button type="button" id="logBtn" title="Observation log (O)">📋 Log <span id="logCount" class="badge">0</span></button>
    <button type="button" id="fsBtn" title="Fullscreen the page (F)">⛶ Fullscreen</button>
    <button type="button" id="streamBtn" title="Hide all UI for capture/streaming (H)">Streaming view</button>
    <button type="button" id="settingsBtn" title="Settings (S)">⚙ Settings</button>
    <button type="button" id="helpBtn" title="Shortcuts and help (?)">?</button>
  </header>
  <div id="settings" hidden>
    <div class="card">
      <div class="dhead"><strong>Settings</strong><button type="button" id="settingsClose" class="ib" title="Close (Esc)">✕</button></div>
      <div class="srow">
        <label class="chk" title="Unmuting one tile mutes the others"><input type="checkbox" id="solo" checked> Solo audio</label>
      </div>
      <div class="srow">
        <label class="chk" title="While this is on, any newly opened tab that is confirmed live is added to the next free tile automatically"><input type="checkbox" id="auto"> Auto-add live tabs</label>
      </div>
      <div class="srow">
        <label class="chk" title="Unpinned: the bar floats over the video and appears when you move the pointer to the top edge, so tiles get the full screen (4K = exactly 4 × 1080p). Always floating in fullscreen."><input type="checkbox" id="pin" checked> Pin bar</label>
      </div>
      <div class="srow">
        <label class="chk" title="4 px gaps between tiles (costs a few pixels per tile)"><input type="checkbox" id="gaps"> Gaps</label>
      </div>
      <div class="srow">
        <button type="button" id="reloadAll" title="Reload every tile">⟳ Reload all</button>
      </div>
      <div class="srow">
        <button type="button" id="clearLive" class="dng" title="Remove tiles confirmed NOT to be live (tiles whose status couldn't be checked are kept)">Clear non-live</button>
        <button type="button" id="clearBtn" class="dng" title="Remove every video from the screen (Shift-click skips the confirmation)">Clear screen</button>
      </div>
      <div class="srow">
        <label class="chk" title="Always-visible badge on each tile with the source's category and channel name"><input type="checkbox" id="badges" checked> Show source badges</label>
      </div>
      <div class="srow">
        <label class="chk" title="Highest quality each YouTube tile may use. Lower = less RAM, CPU and bandwidth with many tiles; Auto lets YouTube pick (needed for true 1080p tiles on a 4K screen).">Max quality per tile
          <select id="maxQ">
            <option value="medium">360p</option>
            <option value="large">480p</option>
            <option value="hd720">720p (default)</option>
            <option value="hd1080">1080p</option>
            <option value="auto">Auto (no cap)</option>
          </select>
        </label>
      </div>
      <div class="srow col">
        <strong>Source categories</strong>
        <span class="hint">One per line. You assign these to sources from the selector on each tile (or in the tab drawer); nothing is labelled for you.</span>
        <textarea id="catEdit" rows="7" spellcheck="false"></textarea>
        <div class="btns"><button type="button" id="catSave" class="pri">Save categories</button><button type="button" id="catReset">Reset to defaults</button></div>
      </div>
      <div class="srow col">
        <strong>Source labels</strong>
        <span class="hint" id="labelInfo"></span>
        <div class="btns">
          <button type="button" id="labelsExport">Export labels (JSON)</button>
          <button type="button" id="labelsImportBtn">Import labels…</button>
          <input type="file" id="labelsImport" accept=".json,application/json" hidden>
          <button type="button" id="labelsClear" class="dng">Clear all labels</button>
        </div>
        <span class="hint">Import takes a JSON file exported from here, or a simple map like <code>{"Channel name": "Category", "example-news.com": "Category"}</code>, so you can bring in ratings from a source you trust.</span>
      </div>
      <div class="srow">
        <span id="sizeInfo" title="Approximate on-screen size of each tile in device pixels"></span>
      </div>
    </div>
  </div>
  <div id="logp" hidden>
    <div class="card wide">
      <div class="dhead"><strong>Observation log</strong><span>
        <button type="button" id="logCsv">Export CSV</button>
        <button type="button" id="logJson">Export JSON</button>
        <button type="button" id="logClear" class="dng">Clear</button>
        <button type="button" id="logClose" class="ib" title="Close (Esc)">✕</button>
      </span></div>
      <div class="hint">Every tile added or removed, stream start/end, title change, error and label change, timestamped in UTC. Kept in this browser only (latest 2,000 entries).</div>
      <div class="logwrap"><table id="logTable"><thead><tr><th>Time (UTC)</th><th>Tile</th><th>Event</th><th>Source</th><th>Category</th><th>Title / detail</th></tr></thead><tbody></tbody></table></div>
    </div>
  </div>
  <aside id="drawer" hidden>
    <div class="dhead">
      <strong>Open YouTube tabs</strong>
      <span>
        <button type="button" id="refreshTabs" class="ib" title="Refresh the tab list now">⟳</button>
        <button type="button" id="drawerClose" class="ib" title="Close (T)">✕</button>
      </span>
    </div>
    <div class="dopts">
      <span>After adding, the source tab:</span>
      <label><input type="radio" name="source" value="pause"> pauses</label>
      <label><input type="radio" name="source" value="leave"> keeps playing</label>
      <label><input type="radio" name="source" value="close" checked> closes</label>
    </div>
    <div id="tabList" class="tablist"></div>
    <div class="dfoot">
      <button type="button" id="addSelected" class="pri">Add selected</button>
      <button type="button" id="addAllTabs">Add all (up to free tiles)</button>
      <button type="button" id="clearTicks">Clear ticks</button>
    </div>
  </aside>
  <main id="grid" class="n4"></main>
  <div id="help" hidden>
    <div class="card">
      <div class="dhead"><strong>Multiview help</strong><button type="button" id="helpClose" class="ib" title="Close (Esc)">✕</button></div>
      <p><b>Live only</b>: only live streams qualify. Ordinary videos are refused when you paste them and greyed out in the tab list. <b>All videos</b>: anything qualifies. Channel links (<code>/channel/UC…</code>, <code>@handle</code>) always embed that channel's current live stream.</p>
      <p><b>Non-YouTube links</b>: pasting any other http(s) URL adds it as a plain embed (news feeds, public webcams, other platforms' embed pages, etc.) tagged <b>EMBED</b> - no play/pause/volume control from here, just whatever the source page itself provides, plus reload/open-in-tab/fullscreen/remove.</p>
      <p><b>Source categories</b>: hover a tile's top edge and pick a category from its selector (or set it per tab in the drawer). Labels follow the channel, so every stream from that channel gets the same badge. The category list is yours to edit in Settings, and labels can be imported/exported as JSON. The <b>All sources</b> menu in the bar focuses one category: other tiles are dimmed and the drawer is filtered.</p>
      <p><b>📋 Log</b> (<kbd>O</kbd>) records what happens on the wall - tiles added/removed, streams starting and ending, title changes, errors, label changes - with UTC timestamps, exportable as CSV or JSON.</p>
      <p><b>⚙ Settings</b> (<kbd>S</kbd>) holds Solo audio, Auto-add, Pin bar, Gaps, source badges, categories, label import/export, Reload all, Clear screen / Clear non-live, and the tile-size readout. <b>Clear screen</b> removes everything (Shift-click skips the confirmation). <b>Clear non-live</b> removes only tiles confirmed not to be live. The ✕ on a tile removes that tile.</p>
      <table>
        <tr><td><kbd>1</kbd>–<kbd>9</kbd></td><td>Audio on that tile (solo)</td></tr>
        <tr><td><kbd>M</kbd></td><td>Mute all</td></tr>
        <tr><td><kbd>P</kbd></td><td>Play / pause all</td></tr>
        <tr><td><kbd>L</kbd></td><td>Cycle 4 → 9 → 16 layout</td></tr>
        <tr><td><kbd>T</kbd></td><td>Open-tabs drawer</td></tr>
        <tr><td><kbd>S</kbd></td><td>Settings</td></tr>
        <tr><td><kbd>O</kbd></td><td>Observation log</td></tr>
        <tr><td><kbd>H</kbd></td><td>Streaming view (no UI); <kbd>Esc</kbd> leaves it</td></tr>
        <tr><td><kbd>F</kbd></td><td>Fullscreen</td></tr>
        <tr><td><kbd>?</kbd></td><td>This help</td></tr>
      </table>
      <p>Tile controls appear when you hover the top or bottom edge of a tile. Drag the ⠿ handle onto another tile to swap them.</p>
    </div>
  </div>
  <div id="toast" role="status"></div>`;

  // Replace the text page with the viewer UI (DOMParser avoids innerHTML on the live page).
  const parsed = new DOMParser().parseFromString('<!doctype html><body>' + BODY_HTML + '</body>', 'text/html');
  document.title = 'Multiview';
  document.body.replaceChildren(...parsed.body.childNodes);
  // The host page's own <head> styles survive the body swap and can fight ours (e.g. example.com
  // ships a `body { max-width: 26em; margin: auto; padding: 25vh 2em 2em }` rule that otherwise
  // shrinks the whole app into a small centered box). Strip any stylesheet the host page brought.
  document.head.querySelectorAll('style, link[rel="stylesheet"]').forEach(n => n.remove());
  try { chrome.runtime.sendMessage({ t: 'css' }, () => void chrome.runtime.lastError); } catch (e) {}

  // If the extension gets reloaded/updated while this page is still open, every call here starts
  // silently failing ("Extension context invalidated"). Surface that once instead of just going quiet.
  let staleWarned = false;
  function warnStale() {
    if (staleWarned) return;
    staleWarned = true;
    toast('Lost connection to the extension (it was reloaded or updated). Reload this page to reconnect.');
  }
  const bg = msg => new Promise(res => {
    try {
      if (!chrome.runtime || !chrome.runtime.id) throw new Error('context invalidated');
      chrome.runtime.sendMessage(msg, r => {
        if (chrome.runtime.lastError) { warnStale(); return res(null); }
        res(r);
      });
    } catch (e) { warnStale(); res(null); }
  });

  const MAX = 16;
  const HAS_EXT = typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.sendMessage;
  const ERR_TEXT = {
    2: 'Invalid video ID', 5: 'Player error', 100: 'Video unavailable or private',
    101: 'The owner disabled embedding for this video', 150: 'The owner disabled embedding for this video',
    153: 'YouTube refused the embed (no referrer)'
  };

  const $ = (s, r = document) => r.querySelector(s);
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function btn(label, title, onClick, cls) {
    const b = el('button', cls || 'ib', label);
    b.type = 'button';
    b.title = title;
    b.addEventListener('click', e => { e.stopPropagation(); onClick(e); });
    return b;
  }
  const pad = n => String(n).padStart(2, '0');
  function fmt(s) {
    if (!isFinite(s) || s < 0) s = 0;
    s = Math.floor(s);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return h ? `${h}:${pad(m)}:${pad(x)}` : `${m}:${pad(x)}`;
  }

  /* ------------------------------------------------------------------ state */
  // A starting list only - the user decides which source gets which category (nothing is pre-labelled).
  const DEFAULT_CATS = ['Left', 'Lean Left', 'Center', 'Lean Right', 'Right', 'Liberal', 'Conservative', 'State media', 'Wire / Agency', 'Independent', 'Other'];
  const state = {
    layout: 4, solo: true, source: 'close', pinned: true, gaps: false, mode: 'live', auto: false, slots: Array(MAX).fill(null),
    labels: {}, categories: DEFAULT_CATS.slice(), badges: true, catFilter: '', maxQuality: 'hd720'
  };
  const rt = Array(MAX).fill(null);   // runtime objects (DOM + player) per slot index
  let streaming = false;

  const store = {
    async load() {
      try { if (chrome.storage && chrome.storage.local) { const o = await chrome.storage.local.get('mv'); return o.mv || null; } } catch (e) {}
      try { return JSON.parse(localStorage.getItem('mv') || 'null'); } catch (e) { return null; }
    },
    save() {
      const data = {
        layout: state.layout, solo: state.solo, source: state.source, pinned: state.pinned, gaps: state.gaps, mode: state.mode, auto: state.auto, slots: state.slots,
        labels: state.labels, categories: state.categories, badges: state.badges, catFilter: state.catFilter, maxQuality: state.maxQuality
      };
      try { if (chrome.storage && chrome.storage.local) { chrome.storage.local.set({ mv: data }); return; } } catch (e) {}
      try { localStorage.setItem('mv', JSON.stringify(data)); } catch (e) {}
    }
  };

  /* -------------------------------------------------------------- url parse */
  function parseTime(t) {
    if (!t) return 0;
    if (/^\d+$/.test(t)) return +t;
    const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0;
  }
  function parseYT(raw) {
    let u;
    try { u = new URL(String(raw).trim()); } catch (e) { return null; }
    const h = u.hostname.replace(/^www\./, '').replace(/^m\./, '');
    const start = parseTime(u.searchParams.get('t') || u.searchParams.get('start'));
    const ID = /^[\w-]{11}$/;
    if (h === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      return ID.test(id) ? { kind: 'video', id, start } : null;
    }
    if (h !== 'youtube.com' && h !== 'youtube-nocookie.com') return null;
    const p = u.pathname.split('/').filter(Boolean);
    if (p[0] === 'watch') {
      const id = u.searchParams.get('v') || '';
      return ID.test(id) ? { kind: 'video', id, start } : null;
    }
    if ((p[0] === 'live' || p[0] === 'shorts' || p[0] === 'embed') && ID.test(p[1] || '')) return { kind: 'video', id: p[1], start };
    if (p[0] === 'channel' && /^UC[\w-]{22}$/.test(p[1] || '')) return { kind: 'channel', id: p[1] };
    if (p[0] && p[0].startsWith('@')) return { kind: 'handle', url: `https://www.youtube.com/${p[0]}` };
    if ((p[0] === 'c' || p[0] === 'user') && p[1]) return { kind: 'handle', url: `https://www.youtube.com/${p[0]}/${p[1]}` };
    return null;
  }
  // Fallback for anything that isn't a recognized YouTube link: treat it as a raw embeddable URL
  // (news/webcam/other-platform live embeds, etc.). We can't verify liveness or control playback
  // for these - the source page's own player, if any, is what runs inside the tile.
  function parseEmbedUrl(raw) {
    let u;
    try { u = new URL(String(raw).trim()); } catch (e) { return null; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return { kind: 'embed', url: u.href };
  }
  // This page is example.com, so youtube.com pages can't be fetched from here (CORS); the
  // background worker fetches them for us.
  // @handle / c/ / user/ URL -> { id: UC… channel ID, name } or null.
  async function resolveHandle(url) {
    if (!HAS_EXT) return null;
    const r = await bg({ t: 'resolveHandle', url });
    return r && r.id ? r : null;
  }
  // { live: true/false/null, channel: name or null } for a video ID.
  async function videoInfo(id) {
    if (!HAS_EXT) return { live: null, channel: null };
    return (await bg({ t: 'videoInfo', id })) || { live: null, channel: null };
  }
  // Live status of an open tab entry: live | notlive | channel | unknown
  function liveState({ tab, p }) {
    if (p.kind === 'channel' || p.kind === 'handle') return 'channel';
    return tab.live === true ? 'live' : tab.live === false ? 'notlive' : 'unknown';
  }
  const qualifies = en => state.mode === 'all' || liveState(en) !== 'notlive';
  const cleanTitle = t => String(t || '').replace(/^\(\d+\)\s*/, '').replace(/\s*-\s*YouTube$/, '').trim();
  const watchUrl = s => s.kind === 'channel'
    ? `https://www.youtube.com/channel/${s.id}/live`
    : `https://www.youtube.com/watch?v=${s.id}${s.start > 5 ? `&t=${Math.floor(s.start)}s` : ''}`;
  const slotUrl = s => s.kind === 'embed' ? s.url : watchUrl(s);

  /* ------------------------------------------------- sources & categories
     A "source" is a YouTube channel (keyed by its name, which the player reports for every tile)
     or, for plain embeds, the site's hostname. Categories are assigned by the user per source. */
  const nameKey = name => name ? 'yt:' + String(name).trim().toLowerCase() : null;
  function slotKey(s) {
    if (!s) return null;
    if (s.kind === 'embed') { try { return 'web:' + new URL(s.url).hostname.replace(/^www\./, ''); } catch (e) { return null; } }
    return nameKey(s.channel);
  }
  const keyName = k => k ? k.slice(k.indexOf(':') + 1) : '';
  const labelOf = k => (k && state.labels[k]) || '';
  // Colour family from the category's wording; "Lean …" variants get the outlined style.
  function catClass(cat) {
    if (!cat) return '';
    const c = cat.toLowerCase();
    const hue = /left|liberal|progressive/.test(c) ? 'cat-left'
      : /right|conservative/.test(c) ? 'cat-right'
      : /cent(er|re)|neutral|wire|agency/.test(c) ? 'cat-center'
      : /state/.test(c) ? 'cat-state' : 'cat-other';
    return hue + (/lean/.test(c) ? ' lean' : '');
  }
  function fillCatSelect(sel, cur) {
    const opts = ['', ...state.categories];
    if (cur && !opts.includes(cur)) opts.push(cur);
    const sig = opts.join('\u0001');
    if (sel.dataset.sig !== sig) {
      sel.textContent = '';
      opts.forEach(c => { const o = el('option', null, c || '— category —'); o.value = c; sel.append(o); });
      sel.dataset.sig = sig;
    }
    if (document.activeElement !== sel) sel.value = cur || '';
  }
  function catSelect(getKey, i) {
    const sel = el('select', 'catsel');
    sel.addEventListener('click', e => e.stopPropagation());
    sel.addEventListener('change', () => setLabel(getKey(), sel.value, typeof i === 'function' ? i() : i));
    return sel;
  }
  function setLabel(key, cat, i) {
    if (!key) return;
    const old = state.labels[key] || '';
    if (cat) state.labels[key] = cat; else delete state.labels[key];
    if (old !== (cat || '')) logEvent('label', i, `${old || '(none)'} → ${cat || '(none)'}`, key);
    store.save();
    refreshLabels();
  }
  // Re-applies badges, selectors, the focus filter and drawer chips after any label change.
  function refreshLabels() {
    for (let i = 0; i < state.layout; i++) syncSource(i);
    applyCatFilter();
    if (!drawer.hidden) renderTabList();
    $('#labelInfo').textContent = `${Object.keys(state.labels).length} source(s) labelled.`;
  }
  function syncSource(i) {
    const r = rt[i], s = state.slots[i];
    if (!r || !s || !r.ui.badge) return;
    const key = slotKey(s), cat = labelOf(key), name = keyName(key) && (s.kind === 'embed' ? keyName(key) : s.channel);
    if (r.ui.cat) {
      fillCatSelect(r.ui.cat, cat);
      r.ui.cat.disabled = !key;
      r.ui.cat.title = key ? `Category for ${name}` : 'Waiting for the player to report the channel name…';
    }
    const b = r.ui.badge;
    b.textContent = '';
    if (cat) b.append(el('span', 'c ' + catClass(cat), cat));
    if (name) b.append(el('span', 'n', name));
    b.hidden = !state.badges || (!cat && !name);
  }
  // The embed player doesn't reliably report the channel name, so look it up once per video /
  // channel through the background worker (watch page or channel page).
  const chLookup = new Set();
  async function ensureChannel(i) {
    const s = state.slots[i];
    if (!s || s.channel || s.kind === 'embed' || !s.id) return;
    const k = s.kind + ':' + s.id;
    if (chLookup.has(k)) return;
    chLookup.add(k);
    let name = null;
    if (s.kind === 'video') name = (await videoInfo(s.id)).channel;
    else if (s.kind === 'channel') { const h = await resolveHandle(`https://www.youtube.com/channel/${s.id}`); name = h && h.name; }
    if (!name) { setTimeout(() => chLookup.delete(k), 60000); return; }   // allow a retry later
    state.slots.forEach((o, j) => { if (o && o.kind === s.kind && o.id === s.id && !o.channel) { o.channel = name; syncSource(j); } });
    store.save();
    applyCatFilter();
  }
  function applyCatFilter() {
    const f = state.catFilter;
    for (let i = 0; i < state.layout; i++) {
      const r = rt[i], s = state.slots[i];
      if (!r) continue;
      const cat = s ? labelOf(slotKey(s)) : '';
      const match = !f || (f === '__none' ? !cat : cat === f);
      r.el.classList.toggle('dimmed', !!s && !match);
    }
  }
  const matchesFilter = key => { const f = state.catFilter, cat = labelOf(key); return !f || (f === '__none' ? !cat : cat === f); };
  function fillCatFilter() {
    const sel = $('#catFilter'), cur = state.catFilter;
    const opts = [['', 'All sources'], ['__none', 'Unlabelled'], ...state.categories.map(c => [c, c])];
    if (cur && !opts.some(o => o[0] === cur)) opts.push([cur, cur]);
    sel.textContent = '';
    opts.forEach(([v, t]) => { const o = el('option', null, t); o.value = v; sel.append(o); });
    sel.value = cur;
  }
  // Accepts our own export, {"Channel name" | "domain.tld": "Category"}, or [{channel, category}].
  function normKey(k) {
    k = String(k || '').trim();
    if (!k) return null;
    if (/^(yt|web):/i.test(k)) return k.slice(0, k.indexOf(':')).toLowerCase() + ':' + k.slice(k.indexOf(':') + 1).trim().toLowerCase();
    if (!/\s/.test(k) && /^[\w-]+(\.[\w-]+)+$/.test(k)) return 'web:' + k.toLowerCase().replace(/^www\./, '');
    return nameKey(k);
  }
  function importLabels(data) {
    const map = data && !Array.isArray(data) && data.labels ? data.labels : data;
    let n = 0;
    const addCat = c => { if (!state.categories.includes(c)) state.categories.push(c); };
    const add = (k, c) => {
      const key = normKey(k);
      if (!key || typeof c !== 'string' || !c.trim()) return;
      state.labels[key] = c.trim(); addCat(c.trim()); n++;
    };
    if (Array.isArray(map)) map.forEach(x => x && add(x.channel || x.source || x.name, x.category || x.label));
    else if (map && typeof map === 'object') Object.entries(map).forEach(([k, c]) => add(k, c));
    if (data && Array.isArray(data.categories)) data.categories.forEach(c => { if (typeof c === 'string' && c.trim()) addCat(c.trim()); });
    if (n) logEvent('labels imported', null, `${n} label(s)`);
    store.save(); fillCatFilter(); refreshLabels();
    return n;
  }

  /* ------------------------------------------------------- observation log */
  const LOG_MAX = 2000;
  let log = [];
  let logSaveTimer = null;
  const utc = t => new Date(t).toISOString().replace('T', ' ').slice(0, 19);
  function logEvent(type, i, detail, key) {
    const s = i != null ? state.slots[i] : null;
    const k = key || slotKey(s);
    const e = {
      t: Date.now(), type, tile: i != null ? i + 1 : '',
      source: s ? (s.kind === 'embed' ? keyName(k) : (s.channel || '')) : keyName(k),
      title: s ? (s.title || s.id || s.url || '') : '',
      category: labelOf(k), detail: detail || '', url: s ? slotUrl(s) : ''
    };
    log.push(e);
    if (log.length > LOG_MAX) log.splice(0, log.length - LOG_MAX);
    clearTimeout(logSaveTimer);
    logSaveTimer = setTimeout(() => { try { chrome.storage.local.set({ mvLog: log }); } catch (err) {} }, 800);
    $('#logCount').textContent = String(log.length);
    if (!$('#logp').hidden) $('#logTable tbody').prepend(logRow(e));
  }
  function logRow(e) {
    const tr = el('tr', 'ev-' + e.type.replace(/\W+/g, '-'));
    [utc(e.t), e.tile, e.type, e.source, e.category, [e.title, e.detail].filter(Boolean).join(' — ')]
      .forEach(v => tr.append(el('td', null, String(v == null ? '' : v))));
    if (e.url) tr.title = e.url;
    return tr;
  }
  function renderLog() {
    const tb = $('#logTable tbody');
    tb.textContent = '';
    for (let k = log.length - 1; k >= 0; k--) tb.append(logRow(log[k]));
  }
  function download(name, text, type) {
    const a = el('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  const fileStamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  // Stream titles are attacker-controllable; neutralise spreadsheet formula injection on export.
  const csvCell = v => {
    let s = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  function exportLogCsv() {
    const head = ['time_utc', 'tile', 'event', 'source', 'category', 'title', 'detail', 'url'];
    const rows = log.map(e => [new Date(e.t).toISOString(), e.tile, e.type, e.source, e.category, e.title, e.detail, e.url].map(csvCell).join(','));
    download(`multiview-log-${fileStamp()}.csv`, [head.join(','), ...rows].join('\r\n'), 'text/csv');
  }

  /* ----------------------------------------------- YouTube player (postMessage)
     The official IFrame API script can't be loaded in an MV3 extension page (remote
     scripts are blocked), so we speak the same widget protocol it uses directly. */
  let pidSeq = 0;
  class Player {
    constructor(iframe, id, idx) {
      this.iframe = iframe; this.id = id; this.i = idx;
      this.info = {}; this.ready = false; this.err = null; this.timer = null;
      this.applied = {};
      this.onFirst = null;
    }
    post(obj) { try { this.iframe.contentWindow && this.iframe.contentWindow.postMessage(JSON.stringify(obj), '*'); } catch (e) {} }
    cmd(func, args) { this.post({ event: 'command', func, args: args || [], id: this.id, channel: 'widget' }); }
    listen() {
      let n = 0;
      clearInterval(this.timer);
      this.timer = setInterval(() => {
        if (this.ready || ++n > 65) return clearInterval(this.timer);
        this.post({ event: 'listening', id: this.id, channel: 'widget' });
      }, 300);
    }
    destroy() { clearInterval(this.timer); }
    get playing() { return this.info.playerState === 1; }
  }

  // Cap playback quality (Settings, default 720p) so N tiles don't each decode 1080p+ - real
  // RAM/CPU savings at 9 and 16 tiles. YouTube can still silently bump quality back up when
  // bandwidth allows, so re-assert the cap whenever it reports a change above the ceiling.
  const QUALITY_RANK = ['tiny', 'small', 'medium', 'large', 'hd720', 'hd1080', 'hd1440', 'hd2160', 'highres'];
  const capped = () => QUALITY_RANK.includes(state.maxQuality);
  function capQuality(p, reported) {
    if (!capped()) return;
    if (QUALITY_RANK.indexOf(reported) > QUALITY_RANK.indexOf(state.maxQuality)) p.cmd('setPlaybackQuality', [state.maxQuality]);
  }

  window.addEventListener('message', e => {
    if (!/^https:\/\/www\.youtube(-nocookie)?\.com$/.test(e.origin)) return;
    let d = e.data;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (err) { return; } }
    if (!d || !d.event) return;
    const r = rt.find(x => x && x.player && x.player.iframe.contentWindow === e.source);
    if (!r) return;
    const p = r.player;
    const first = !p.ready;
    p.ready = true;
    if (d.event === 'onStateChange') p.info.playerState = d.info;
    else if (d.event === 'onError') p.err = d.info;
    else if (d.event === 'onPlaybackQualityChange') { p.info.quality = d.info; capQuality(p, d.info); }
    else if (d.info && typeof d.info === 'object') Object.assign(p.info, d.info);
    if (first && p.onFirst) p.onFirst();
    updateTile(r.i);
  });

  function embedSrc(slot, wid) {
    const controls = slot.native ? 1 : 0;
    const q = new URLSearchParams({
      autoplay: 1, mute: 1, playsinline: 1, rel: 0, modestbranding: 1, controls,
      iv_load_policy: 3, enablejsapi: 1, disablekb: 1, fs: controls, widgetid: wid,
      // The real IFrame API always sends this - it's how the player authorizes the postMessage
      // control channel for this specific embedding page. Without it the widget protocol commands
      // (play/pause/seek/volume/etc.) silently get no response and every tile falls back to
      // YouTube's own native controls.
      origin: location.origin
    });
    if (slot.kind === 'channel') {
      q.set('channel', slot.id);
      return `https://www.youtube.com/embed/live_stream?${q}`;
    }
    if (slot.start > 0) q.set('start', Math.floor(slot.start));
    return `https://www.youtube.com/embed/${slot.id}?${q}`;
  }

  /* ------------------------------------------------------------ audio model */
  function applyAudio() {
    for (let i = 0; i < MAX; i++) {
      const r = rt[i], s = state.slots[i];
      if (!r || !r.player || !s) continue;
      const p = r.player;
      if (!p.ready) continue;
      const muted = s.muted !== false;
      const vol = s.vol == null ? 100 : s.vol;
      if (p.applied.muted !== muted) { p.cmd(muted ? 'mute' : 'unMute'); p.applied.muted = muted; }
      if (p.applied.vol !== vol) { p.cmd('setVolume', [vol]); p.applied.vol = vol; }
      r.el.classList.toggle('audible', !muted);
      if (r.ui) { r.ui.mute.textContent = muted ? '🔇' : '🔊'; r.ui.vol.value = vol; }
    }
  }
  function setMuted(i, muted) {
    const s = state.slots[i];
    if (!s) return;
    if (!muted && state.solo) state.slots.forEach(o => { if (o && o !== s) o.muted = true; });
    s.muted = muted;
    applyAudio();
  }
  const isAudible = i => state.slots[i] && state.slots[i].muted === false;

  /* ------------------------------------------------------------- tile build */
  function buildTile(i, key) {
    const slot = state.slots[i];
    const r = { i, key, el: el('section', 'tile'), player: null, ui: {}, seeking: false, retried: false };
    r.el.style.order = i;
    r.el.dataset.i = i;

    const frame = el('div', 'frame');
    const ifr = document.createElement('iframe');
    ifr.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    ifr.setAttribute('allowfullscreen', '');
    const wid = ++pidSeq;
    r.player = new Player(ifr, wid, i);
    r.player.onFirst = () => { applyAudio(); if (capped()) r.player.cmd('setPlaybackQuality', [state.maxQuality]); };
    ifr.addEventListener('load', () => r.player.listen());
    ifr.src = embedSrc(slot, wid);
    frame.append(ifr);

    /* top bar */
    const top = el('div', 'top');
    const handle = el('span', 'handle', '⠿');
    handle.title = 'Drag onto another tile to swap';
    handle.draggable = true;
    handle.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', String(r.i));
      e.dataTransfer.effectAllowed = 'move';
      grid.classList.add('dragging');
    });
    handle.addEventListener('dragend', () => grid.classList.remove('dragging'));
    const num = el('span', 'num', String(i + 1));
    r.ui.num = num;
    const chip = el('span', 'livechip'); chip.hidden = true;
    r.ui.chip = chip;
    const title = el('span', 'title', slot.title || (slot.kind === 'channel' ? 'Channel live' : slot.id));
    r.ui.title = title;
    r.ui.cat = catSelect(() => slotKey(state.slots[r.i]), () => r.i);
    r.ui.badge = el('div', 'catbadge');
    top.append(handle, num, chip, title, r.ui.cat,
      btn('↗', 'Open in a YouTube tab', () => openInTab(r.i)),
      btn('⟳', 'Reload this tile', () => reloadTile(r.i)),
      btn('⛶', 'Fullscreen this tile', () => toggleTileFullscreen(r.el)),
      btn('✕', 'Remove', () => removeSlot(r.i), 'ib rm'));

    /* bottom bar (custom controls) */
    const bottom = el('div', 'bottom');
    const play = btn('❚❚', 'Play / pause', () => { const p = r.player; p.playing ? p.cmd('pauseVideo') : p.cmd('playVideo'); });
    const back = btn('−10', 'Back 10 s', () => seekBy(r.i, -10));
    const fwd = btn('+10', 'Forward 10 s', () => seekBy(r.i, 10));
    const seek = el('input', 'seek'); seek.type = 'range'; seek.min = 0; seek.max = 0; seek.step = 1; seek.value = 0;
    seek.addEventListener('input', () => { r.seeking = true; r.ui.time.textContent = `${fmt(+seek.value)} / ${fmt(+seek.max)}`; });
    seek.addEventListener('change', () => { r.player.cmd('seekTo', [+seek.value, true]); r.seeking = false; });
    const time = el('span', 'time', '0:00 / 0:00');
    const mute = btn('🔇', 'Mute / unmute (number key toggles solo audio)', () => setMuted(r.i, !isAudible(r.i)));
    const vol = el('input', 'vol'); vol.type = 'range'; vol.min = 0; vol.max = 100; vol.value = slot.vol == null ? 100 : slot.vol; vol.title = 'Volume';
    vol.addEventListener('input', () => { slot.vol = +vol.value; if (slot.vol > 0 && slot.muted !== false) setMuted(r.i, false); else applyAudio(); });
    vol.addEventListener('change', () => store.save());
    const speed = el('select'); speed.title = 'Playback speed';
    [0.5, 0.75, 1, 1.25, 1.5, 2].forEach(v => { const o = el('option', null, v + '×'); o.value = v; if (v === 1) o.selected = true; speed.append(o); });
    speed.addEventListener('change', () => r.player.cmd('setPlaybackRate', [+speed.value]));
    const edge = btn('⏭ Live', 'Jump to the live edge', () => {
      const d = +r.player.info.duration || 0;
      r.player.cmd('seekTo', [d > 0 ? d : 1e9, true]);
    });
    edge.hidden = true;
    Object.assign(r.ui, { play, seek, time, mute, vol, speed, back, fwd, edge });
    bottom.append(play, back, fwd, seek, time, edge, mute, vol, speed);
    if (slot.native) bottom.hidden = true;

    /* error / fallback notice */
    const notice = el('div', 'notice');
    const noticeText = el('span');
    notice.append(noticeText, btn('Open in tab', 'Open in a YouTube tab', () => openInTab(r.i), 'ib'));
    r.ui.notice = notice; r.ui.noticeText = noticeText;

    r.el.append(frame, r.ui.badge, top, bottom, notice);

    /* drop target for swapping */
    r.el.addEventListener('dragover', e => { e.preventDefault(); r.el.classList.add('dragover'); });
    r.el.addEventListener('dragleave', () => r.el.classList.remove('dragover'));
    r.el.addEventListener('drop', e => {
      e.preventDefault(); r.el.classList.remove('dragover'); grid.classList.remove('dragging');
      const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
      if (!isNaN(from)) swapSlots(from, r.i);
    });

    /* if the player never answers, fall back to YouTube's own controls once. YouTube's embed
       startup now includes a bot-attestation round trip that can push "ready" past the old 7s
       budget, so this is generous enough to cover that before giving up on our own controls. */
    setTimeout(() => {
      if (rt[r.i] !== r || r.player.ready || slot.native) return;
      slot.native = 1;
      logEvent('controls fallback', r.i, 'player did not answer; using YouTube\'s own controls');
      toast('Player controls did not respond; showing YouTube\'s own controls for tile ' + (r.i + 1));
      render();
    }, 15000);

    return r;
  }

  // A non-YouTube embed: just an iframe in our tile chrome. No widget postMessage protocol to
  // speak (that's YouTube-specific), so no Player, no custom play/seek/volume bar, no live chip -
  // whatever the source page itself renders is what shows up.
  function buildEmbedTile(i, key) {
    const slot = state.slots[i];
    const r = { i, key, el: el('section', 'tile'), player: null, ui: {} };
    r.el.style.order = i;
    r.el.dataset.i = i;

    const frame = el('div', 'frame');
    const ifr = document.createElement('iframe');
    ifr.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    ifr.setAttribute('allowfullscreen', '');
    ifr.src = slot.nonce ? slot.url + (slot.url.includes('?') ? '&' : '?') + '_mv=' + slot.nonce : slot.url;
    frame.append(ifr);

    const top = el('div', 'top');
    const handle = el('span', 'handle', '⠿');
    handle.title = 'Drag onto another tile to swap';
    handle.draggable = true;
    handle.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', String(r.i));
      e.dataTransfer.effectAllowed = 'move';
      grid.classList.add('dragging');
    });
    handle.addEventListener('dragend', () => grid.classList.remove('dragging'));
    const num = el('span', 'num', String(i + 1));
    r.ui.num = num;
    const chip = el('span', 'livechip', 'EMBED');
    chip.title = 'Custom embed, not a YouTube video - controls are whatever the source page provides';
    const title = el('span', 'title', slot.title || slot.url);
    r.ui.title = title;
    r.ui.cat = catSelect(() => slotKey(state.slots[r.i]), () => r.i);
    r.ui.badge = el('div', 'catbadge');
    top.append(handle, num, chip, title, r.ui.cat,
      btn('↗', 'Open in a new tab', () => bg({ t: 'open', url: slot.url })),
      btn('⟳', 'Reload this tile', () => { slot.nonce = (slot.nonce || 0) + 1; render(); }),
      btn('⛶', 'Fullscreen this tile', () => toggleTileFullscreen(r.el)),
      btn('✕', 'Remove', () => removeSlot(r.i), 'ib rm'));
    r.el.append(frame, r.ui.badge, top);

    r.el.addEventListener('dragover', e => { e.preventDefault(); r.el.classList.add('dragover'); });
    r.el.addEventListener('dragleave', () => r.el.classList.remove('dragover'));
    r.el.addEventListener('drop', e => {
      e.preventDefault(); r.el.classList.remove('dragover'); grid.classList.remove('dragging');
      const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
      if (!isNaN(from)) swapSlots(from, r.i);
    });

    return r;
  }

  function buildEmpty(i, key) {
    const r = { i, key, el: el('section', 'tile empty'), player: null, ui: {} };
    r.el.style.order = i;
    const frame = el('div', 'frame');
    const ph = el('div', 'ph');
    const n = el('div', 'n', String(i + 1));
    const form = el('form');
    const input = el('input'); input.type = 'text'; input.placeholder = 'Paste a YouTube or live URL'; input.spellcheck = false;
    const add = el('button', 'pri', 'Add'); add.type = 'submit';
    form.append(input, add);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const ok = await addFromText(input.value, r.i);
      if (ok) input.value = '';
    });
    const pick = el('button', null, HAS_EXT ? 'Pick from open YouTube tabs' : 'Open tab list');
    pick.type = 'button';
    pick.addEventListener('click', () => toggleDrawer(true));
    ph.append(n, form, pick);
    frame.append(ph);
    r.el.append(frame);
    r.el.addEventListener('dragover', e => { e.preventDefault(); r.el.classList.add('dragover'); });
    r.el.addEventListener('dragleave', () => r.el.classList.remove('dragover'));
    r.el.addEventListener('drop', e => {
      e.preventDefault(); r.el.classList.remove('dragover'); grid.classList.remove('dragging');
      const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
      if (!isNaN(from)) swapSlots(from, r.i);
    });
    return r;
  }

  /* --------------------------------------------------------- tile updates */
  function updateTile(i) {
    const r = rt[i], slot = state.slots[i];
    if (!r || !r.player || !slot) return;
    const p = r.player, f = p.info;
    const ui = r.ui;
    ui.play.textContent = p.playing ? '❚❚' : '▶';
    const dur = +f.duration || 0;
    const vd = f.videoData || {};
    // live = known from the tab/page check, or reported by the player, or (if nothing else is known) no duration
    const live = slot.live === true || vd.isLive === true || (slot.live == null && dur <= 0 && p.ready);
    ui.chip.hidden = !(live || slot.live === false);
    ui.chip.textContent = live ? '● LIVE' : 'VOD';
    ui.chip.classList.toggle('vod', !live);
    ui.edge.hidden = !live;
    ui.back.hidden = dur <= 0; ui.fwd.hidden = dur <= 0;   // rewinding a live stream needs a DVR window
    ui.seek.hidden = live || dur <= 0;
    if (!r.seeking) {
      if (!live && dur > 0) { ui.seek.max = dur; ui.seek.value = f.currentTime || 0; }
      ui.time.textContent = live ? 'LIVE' : `${fmt(f.currentTime || 0)} / ${fmt(dur)}`;
    }
    if (f.playbackRate && +ui.speed.value !== f.playbackRate && document.activeElement !== ui.speed) {
      const has = [...ui.speed.options].some(o => +o.value === f.playbackRate);
      if (has) ui.speed.value = f.playbackRate;
    }
    // channel name (the label key) - the player reports it for every YouTube tile
    if (vd.author && slot.channel !== vd.author) { slot.channel = vd.author; store.save(); syncSource(i); applyCatFilter(); }
    const vt = vd.title;
    if (vt) {
      // a live stream's title changing mid-stream is worth noting; the first report just settles it
      if (r.seenTitle && r.seenTitle !== vt) logEvent('title changed', i, `was: ${r.seenTitle}`);
      r.seenTitle = vt;
      if (slot.title !== vt) { slot.title = vt; ui.title.textContent = vt; store.save(); }
    }
    const st = f.playerState;
    if (st !== r.lastState) {
      if (st === 1 && !r.startLogged) { r.startLogged = true; logEvent('playing', i, live ? 'live' : 'VOD'); }
      else if (st === 0 && r.lastState != null) logEvent('ended', i, live ? 'live stream ended' : 'video ended');
      r.lastState = st;
    }
    if (p.err != null) {
      if (!r.errLogged) { r.errLogged = true; logEvent('error', i, `${ERR_TEXT[p.err] || 'Player error'} (code ${p.err})`); }
      ui.noticeText.textContent = `${ERR_TEXT[p.err] || 'Player error'} (code ${p.err})`;
      ui.notice.classList.add('show');
    }
  }

  function seekBy(i, d) {
    const r = rt[i]; if (!r) return;
    r.player.cmd('seekTo', [Math.max(0, (r.player.info.currentTime || 0) + d), true]);
  }
  // A tile can resume at a timestamp only if it's an ordinary video that has been playing a while.
  const canResume = (s, r) => !!(s && s.kind === 'video' && s.live !== true && r && r.player &&
    !(r.player.info.videoData && r.player.info.videoData.isLive) && r.player.info.currentTime > 5);
  function openInTab(i) {
    const s = state.slots[i], r = rt[i]; if (!s) return;
    if (canResume(s, r)) s.start = Math.floor(r.player.info.currentTime);
    bg({ t: 'open', url: watchUrl(s) });
  }
  function bumpReload(i) {
    const s = state.slots[i], r = rt[i]; if (!s) return;
    if (canResume(s, r)) s.start = Math.floor(r.player.info.currentTime);
    s.nonce = (s.nonce || 0) + 1;
    s.native = 0;
  }
  function reloadTile(i) { bumpReload(i); render(); }
  function reloadAll() {
    let n = 0;
    for (let i = 0; i < state.layout; i++) if (state.slots[i]) { bumpReload(i); n++; }
    if (n) { render(); toast(`Reloading ${n} tile${n > 1 ? 's' : ''}`); } else toast('Nothing to reload');
  }
  function toggleTileFullscreen(node) {
    if (document.fullscreenElement === node) document.exitFullscreen();
    else node.requestFullscreen && node.requestFullscreen();
  }

  /* -------------------------------------------------------- slot management */
  const grid = $('#grid');

  function destroyRt(i) {
    const r = rt[i]; if (!r) return;
    const s = state.slots[i];
    if (r.player) {
      if (canResume(s, r)) s.start = Math.floor(r.player.info.currentTime);
      r.player.destroy();
    }
    r.el.remove();
    rt[i] = null;
  }

  function render() {
    grid.className = 'n' + state.layout;
    for (let i = 0; i < MAX; i++) {
      const visible = i < state.layout, slot = state.slots[i], r = rt[i];
      if (!visible) { if (r) destroyRt(i); continue; }
      const key = slot ? `${slot.kind}:${slot.id || slot.url}:${slot.start || 0}:${slot.nonce || 0}:${slot.native || 0}` : 'empty';
      if (r && r.key === key) { r.el.style.order = i; r.i = i; if (r.player) r.player.i = i; continue; }
      if (r) destroyRt(i);
      rt[i] = !slot ? buildEmpty(i, key) : slot.kind === 'embed' ? buildEmbedTile(i, key) : buildTile(i, key);
      grid.append(rt[i].el);
    }
    store.save();
    applyAudio();
    for (let i = 0; i < state.layout; i++) {
      if (rt[i] && rt[i].ui && rt[i].ui.num) rt[i].ui.num.textContent = String(i + 1);
      syncSource(i);
      ensureChannel(i);
    }
    applyCatFilter();
    syncToolbar();
    if (!$('#drawer').hidden) renderTabList();
    updateSize();
  }

  function swapSlots(a, b) {
    if (a === b || a < 0 || b < 0 || a >= state.layout || b >= state.layout) return;
    [state.slots[a], state.slots[b]] = [state.slots[b], state.slots[a]];
    [rt[a], rt[b]] = [rt[b], rt[a]];
    [a, b].forEach(i => { if (rt[i]) { rt[i].i = i; rt[i].el.dataset.i = i; rt[i].el.style.order = i; if (rt[i].player) rt[i].player.i = i; } });
    render();
  }

  function removeSlot(i) {
    if (state.slots[i]) logEvent('removed', i);
    destroyRt(i);
    state.slots[i] = null;
    render();
  }

  function firstEmpty() {
    for (let i = 0; i < state.layout; i++) if (!state.slots[i]) return i;
    return -1;
  }
  function addSlot(data, idx) {
    const i = idx != null && idx >= 0 && idx < state.layout ? idx : firstEmpty();
    if (i < 0) { toast('Grid is full. Switch to a bigger layout or remove a tile.'); return false; }
    if (rt[i]) destroyRt(i);
    if (state.slots[i]) logEvent('replaced', i);
    state.slots[i] = Object.assign({ muted: true, vol: 100 }, data);
    render();
    logEvent('added', i, data.kind === 'embed' ? 'embed' : data.kind === 'channel' ? 'channel live' : data.live === true ? 'live' : data.live === false ? 'VOD' : '');
    return true;
  }

  async function addFromText(text, idx) {
    const tokens = String(text || '').split(/\s+/).filter(Boolean);
    if (!tokens.length) return false;
    let added = 0, unverified = 0;
    for (let k = 0; k < tokens.length; k++) {
      const p = parseYT(tokens[k]);
      let data;
      if (!p) {
        const embed = parseEmbedUrl(tokens[k]);
        if (!embed) { toast('Not a YouTube link or a valid URL: ' + tokens[k].slice(0, 60)); continue; }
        data = embed;
        if (addSlot(data, k === 0 ? idx : undefined)) added++; else break;
        continue;
      }
      if (p.kind === 'handle') {
        const h = await resolveHandle(p.url);
        if (!h) { toast('Could not resolve that channel to a live stream: ' + p.url); continue; }
        data = { kind: 'channel', id: h.id, channel: h.name || undefined };
      } else if (p.kind === 'video') {
        const info = await videoInfo(p.id);
        if (state.mode === 'live' && info.live === false) {
          toast('Not a live stream, skipped: ' + tokens[k].slice(0, 60) + '. Switch to "All videos" to add ordinary videos.');
          continue;
        }
        if (state.mode === 'live' && info.live === null) unverified++;
        data = Object.assign({}, p, { live: info.live, channel: info.channel || undefined, title: info.title || undefined });
      } else data = p;
      if (addSlot(data, k === 0 ? idx : undefined)) added++; else break;
    }
    if (unverified && added) toast('Added, but I could not confirm it is live (YouTube page could not be read).');
    return added > 0;
  }

  // Used by the "+ Multiview" button injected on YouTube watch pages (see inject.js/background.js).
  async function addVideoById(id, title, channel) {
    if (!/^[\w-]{11}$/.test(id || '')) return false;
    const info = await videoInfo(id);
    if (state.mode === 'live' && info.live === false) {
      toast('Not a live stream, skipped: ' + (title || id) + '. Switch to "All videos" to add it.');
      return false;
    }
    return addSlot({ kind: 'video', id, title: title || info.title || undefined, live: info.live, channel: channel || info.channel || undefined });
  }

  /* ----------------------------------------------------------- tabs drawer */
  const drawer = $('#drawer'), tabList = $('#tabList'), tabCount = $('#tabCount');
  let tabEntries = [];
  const selected = new Set();

  async function refreshTabs() {
    if (!HAS_EXT) { tabEntries = []; tabCount.textContent = '–'; if (!drawer.hidden) renderTabList(); return; }
    // Live status only matters when the drawer is showing it or auto-add needs it; otherwise skip
    // the per-tab probing work in the background script entirely.
    const needLive = !drawer.hidden || state.auto;
    const tabs = (await bg({ t: 'tabs', needLive })) || [];
    tabEntries = tabs.map(tab => ({ tab, p: parseYT(tab.url || '') })).filter(x => x.p);
    [...selected].forEach(id => { if (!tabEntries.some(x => x.tab.id === id)) selected.delete(id); });
    const nLive = tabEntries.filter(en => liveState(en) === 'live').length;
    tabCount.textContent = String(tabEntries.length);
    tabCount.title = `${nLive} live of ${tabEntries.length} YouTube tabs`;
    if (!drawer.hidden) renderTabList();
    autoAdd();
  }
  const inGrid = p => state.slots.some(s => s && p.kind !== 'handle' && s.kind === p.kind && s.id === p.id);

  function renderTabList() {
    tabList.textContent = '';
    if (!HAS_EXT) { tabList.append(el('div', 'none', 'Open this page through the extension icon to list your YouTube tabs. You can still paste URLs.')); return; }
    if (!tabEntries.length) { tabList.append(el('div', 'none', 'No YouTube video, live or channel tabs are open right now.')); return; }
    const nLive = tabEntries.filter(en => liveState(en) === 'live').length;
    const nNot = tabEntries.filter(en => liveState(en) === 'notlive').length;
    const shown = tabEntries.filter(en => matchesFilter(nameKey(en.tab.channel)));
    tabList.append(el('div', 'sum', (state.mode === 'live'
      ? `Live only: ${nLive} live tab${nLive === 1 ? '' : 's'} qualify${nNot ? `, ${nNot} ordinary video${nNot === 1 ? '' : 's'} greyed out` : ''}.`
      : `All videos: every tab qualifies (${nLive} live, ${nNot} ordinary).`)
      + (state.catFilter ? ` Showing ${shown.length} matching "${state.catFilter === '__none' ? 'Unlabelled' : state.catFilter}".` : '')));
    shown.forEach(en => {
      const { tab, p } = en;
      const used = inGrid(p), ls = liveState(en), ok = qualifies(en);
      const row = el('div', 'row' + (ok ? '' : ' dim'));
      const cb = el('input'); cb.type = 'checkbox'; cb.checked = selected.has(tab.id); cb.disabled = used || !ok;
      cb.addEventListener('change', () => { cb.checked ? selected.add(tab.id) : selected.delete(tab.id); });
      let thumb;
      if (p.kind === 'video') {
        thumb = el('img'); thumb.src = `https://i.ytimg.com/vi/${p.id}/mqdefault.jpg`; thumb.alt = '';
        thumb.loading = 'lazy'; thumb.decoding = 'async';
      }
      else thumb = el('div', 'noimg', 'channel');
      const meta = el('div', 'meta');
      meta.append(el('div', 't', cleanTitle(tab.title) || tab.url));
      const chips = el('div', 'chips');
      if (ls === 'live') chips.append(el('span', 'chip live', '● live'));
      else if (ls === 'notlive') chips.append(el('span', 'chip', 'not live'));
      else if (ls === 'channel') chips.append(el('span', 'chip live', 'channel'));
      else chips.append(el('span', 'chip', 'status unknown'));
      if (tab.audible) chips.append(el('span', 'chip', 'playing audio'));
      if (used) chips.append(el('span', 'chip', 'in grid'));
      else if (ok) chips.append(btn('Add', 'Add to the next free tile', async () => { await addFromTab(en); refreshTabs(); }, ''));
      meta.append(chips);
      if (tab.channel) {
        const key = nameKey(tab.channel), cat = labelOf(key);
        const src = el('div', 'chips');
        if (cat) src.append(el('span', 'c ' + catClass(cat), cat));
        src.append(el('span', 'chip', tab.channel));
        const sel = catSelect(() => key, null);
        fillCatSelect(sel, cat);
        sel.title = `Category for ${tab.channel}`;
        src.append(sel);
        meta.append(src);
      }
      row.append(cb, thumb, meta);
      tabList.append(row);
    });
  }

  async function addFromTab(en) {
    const { tab, p } = en;
    const ls = liveState(en);
    if (state.mode === 'live' && ls === 'notlive') {
      toast('Not live, skipped: ' + (cleanTitle(tab.title) || tab.url) + '. Switch to "All videos" to add it.');
      return false;
    }
    let data;
    if (p.kind === 'handle') {
      const h = await resolveHandle(p.url);
      if (!h) { toast('Could not resolve that channel: ' + cleanTitle(tab.title)); return false; }
      data = { kind: 'channel', id: h.id, title: cleanTitle(tab.title), channel: h.name || tab.channel || undefined };
    } else {
      data = Object.assign({}, p, { title: cleanTitle(tab.title), channel: tab.channel || undefined });
      if (p.kind === 'video') {
        data.live = tab.live === true ? true : tab.live === false ? false : null;
        // grab the current position so the tile resumes where the tab was, and pause the tab
        const out = await bg({ t: 'grab', tabId: tab.id, pause: state.source !== 'leave' });
        if (out && out.live === true && data.live == null) data.live = true;
        if (out && !out.live && data.live !== true && out.t > 3) data.start = Math.floor(out.t);
      }
    }
    const ok = addSlot(data);
    if (ok && state.source === 'close') await bg({ t: 'close', tabId: tab.id });
    return ok;
  }

  // Auto-add: newly seen tabs that are confirmed live go to the next free tile. Each tab is tried once.
  const autoSeen = new Set();
  let autoBusy = false;
  async function autoAdd() {
    if (!state.auto || autoBusy) return;
    autoBusy = true;
    try {
      for (const en of tabEntries) {
        const key = en.tab.id + '|' + en.p.kind + (en.p.id || '');
        if (autoSeen.has(key) || liveState(en) !== 'live') continue;
        if (inGrid(en.p)) { autoSeen.add(key); continue; }
        if (firstEmpty() < 0) break;
        autoSeen.add(key);
        await addFromTab(en);
      }
    } finally { autoBusy = false; }
  }

  async function addMany(entries) {
    let n = 0, skipped = 0;
    for (const en of entries) {
      if (firstEmpty() < 0) { skipped++; continue; }
      if (await addFromTab(en)) n++;
    }
    selected.clear();
    refreshTabs();
    if (skipped) toast(`Added ${n}. Grid is full, ${skipped} tab${skipped > 1 ? 's' : ''} left out (switch to a bigger layout or remove a tile).`);
    else if (n) toast(`Added ${n} tab${n > 1 ? 's' : ''}`);
  }

  function toggleDrawer(force) {
    const open = typeof force === 'boolean' ? force : drawer.hidden;
    drawer.hidden = !open;
    if (open) { renderTabList(); refreshTabs(); }
  }

  /* ----------------------------------------------------------------- toolbar */
  function setLayout(n) {
    state.layout = n;
    render();
  }
  function applyBarMode() {
    document.body.classList.toggle('floatbar', !state.pinned || !!document.fullscreenElement);
    document.body.classList.toggle('gaps', state.gaps);
    requestAnimationFrame(updateSize);
  }
  function syncToolbar() {
    document.querySelectorAll('#layoutSeg button').forEach(b => b.classList.toggle('on', +b.dataset.n === state.layout));
    document.querySelectorAll('#modeSeg button').forEach(b => b.classList.toggle('on', b.dataset.m === state.mode));
    $('#auto').checked = state.auto;
    $('#solo').checked = state.solo;
    $('#pin').checked = state.pinned;
    $('#gaps').checked = state.gaps;
    $('#badges').checked = state.badges;
    $('#maxQ').value = state.maxQuality;
    applyBarMode();
    document.querySelectorAll('input[name=source]').forEach(r => { r.checked = r.value === state.source; });
  }
  function eachPlayer(fn) { rt.forEach((r, i) => { if (r && r.player && i < state.layout) fn(r.player, i); }); }
  function togglePlayAll() {
    const anyPlaying = rt.some((r, i) => r && r.player && i < state.layout && r.player.playing);
    eachPlayer(p => p.cmd(anyPlaying ? 'pauseVideo' : 'playVideo'));
  }
  function muteAll() { state.slots.forEach(s => { if (s) s.muted = true; }); applyAudio(); }

  function setMode(m) {
    state.mode = m === 'all' ? 'all' : 'live';
    render();
    toast(state.mode === 'live'
      ? 'Live only: ordinary videos are refused. Existing tiles stay; use "Clear non-live" to remove ordinary videos.'
      : 'All videos: any video or live stream can be added.');
  }
  function clearScreen(skipConfirm) {
    if (!state.slots.some(Boolean)) return toast('The screen is already empty.');
    if (!skipConfirm && !confirm('Clear the screen? This removes every video from the grid.')) return;
    for (let i = 0; i < MAX; i++) { if (state.slots[i]) logEvent('removed', i, 'clear screen'); destroyRt(i); state.slots[i] = null; }
    render();
    toast('Screen cleared');
  }
  function clearNonLive() {
    let n = 0;
    for (let i = 0; i < MAX; i++) {
      const s = state.slots[i];
      if (s && s.kind === 'video' && s.live === false) { logEvent('removed', i, 'clear non-live'); destroyRt(i); state.slots[i] = null; n++; }
    }
    if (n) { render(); toast(`Removed ${n} non-live tile${n > 1 ? 's' : ''}`); }
    else toast('No tiles are confirmed non-live. Tiles whose status could not be checked are kept.');
  }
  function toggleHelp(force) {
    const h = $('#help');
    h.hidden = typeof force === 'boolean' ? !force : !h.hidden;
  }
  function toggleSettings(force) {
    const s = $('#settings');
    s.hidden = typeof force === 'boolean' ? !force : !s.hidden;
    if (!s.hidden) {
      updateSize();
      $('#catEdit').value = state.categories.join('\n');
      $('#labelInfo').textContent = `${Object.keys(state.labels).length} source(s) labelled.`;
    }
  }
  function toggleLog(force) {
    const l = $('#logp');
    l.hidden = typeof force === 'boolean' ? !force : !l.hidden;
    if (!l.hidden) renderLog();
  }

  function toggleStreaming() {
    streaming = !streaming;
    document.body.classList.toggle('streaming', streaming);
    if (streaming) { drawer.hidden = true; toast('Streaming view on. Press H or Esc to bring the controls back.'); }
    requestAnimationFrame(updateSize);
  }
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
  }
  function updateSize() {
    const f = grid.querySelector('.frame');
    const info = $('#sizeInfo');
    if (!f) { info.textContent = ''; return; }
    const b = f.getBoundingClientRect(), d = window.devicePixelRatio || 1;
    const w = Math.round(b.width * d), h = Math.round(b.height * d);
    const near = w >= 1700 && w < 1915 && h >= 950; // a 4K screen but not quite 1080p per tile
    info.textContent = `Tile ≈ ${w}×${h} px` + (near ? ' · unpin bar / go fullscreen for exact 1080p' : '');
  }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3800);
  }

  /* ------------------------------------------------------------------- init */
  function wire() {
    document.querySelectorAll('#layoutSeg button').forEach(b => b.addEventListener('click', () => setLayout(+b.dataset.n)));
    $('#addForm').addEventListener('submit', async e => {
      e.preventDefault();
      const inp = $('#urlInput');
      if (await addFromText(inp.value)) inp.value = '';
    });
    $('#tabsBtn').addEventListener('click', () => toggleDrawer());
    $('#drawerClose').addEventListener('click', () => toggleDrawer(false));
    $('#playAll').addEventListener('click', () => eachPlayer(p => p.cmd('playVideo')));
    $('#pauseAll').addEventListener('click', () => eachPlayer(p => p.cmd('pauseVideo')));
    $('#muteAll').addEventListener('click', muteAll);
    $('#solo').addEventListener('change', e => {
      state.solo = e.target.checked;
      if (state.solo) { let seen = false; state.slots.forEach(s => { if (s && s.muted === false) { if (seen) s.muted = true; seen = true; } }); applyAudio(); }
      store.save();
    });
    $('#pin').addEventListener('change', e => { state.pinned = e.target.checked; store.save(); applyBarMode(); });
    $('#gaps').addEventListener('change', e => { state.gaps = e.target.checked; store.save(); applyBarMode(); });
    document.addEventListener('fullscreenchange', applyBarMode);
    $('#fsBtn').addEventListener('click', toggleFullscreen);
    $('#streamBtn').addEventListener('click', toggleStreaming);
    $('#clearBtn').addEventListener('click', e => clearScreen(e.shiftKey));
    $('#clearLive').addEventListener('click', clearNonLive);
    $('#reloadAll').addEventListener('click', reloadAll);
    $('#helpBtn').addEventListener('click', () => toggleHelp());
    $('#helpClose').addEventListener('click', () => toggleHelp(false));
    $('#help').addEventListener('click', e => { if (e.target.id === 'help') toggleHelp(false); });
    $('#settingsBtn').addEventListener('click', () => toggleSettings());
    $('#settingsClose').addEventListener('click', () => toggleSettings(false));
    $('#settings').addEventListener('click', e => { if (e.target.id === 'settings') toggleSettings(false); });

    /* sources & categories */
    $('#catFilter').addEventListener('change', e => {
      state.catFilter = e.target.value;
      store.save(); applyCatFilter();
      if (!drawer.hidden) renderTabList();
    });
    $('#badges').addEventListener('change', e => { state.badges = e.target.checked; store.save(); refreshLabels(); });
    $('#maxQ').addEventListener('change', e => {
      state.maxQuality = e.target.value;
      store.save();
      if (capped()) { eachPlayer(p => p.cmd('setPlaybackQuality', [state.maxQuality])); toast('Quality cap applied to every tile.'); }
      else toast('Cap removed. Use ⟳ Reload all so YouTube re-picks quality for each tile.');
    });
    $('#catSave').addEventListener('click', () => {
      const cats = [...new Set($('#catEdit').value.split('\n').map(s => s.trim()).filter(Boolean))];
      state.categories = cats.length ? cats : DEFAULT_CATS.slice();
      if (state.catFilter && state.catFilter !== '__none' && !state.categories.includes(state.catFilter)) state.catFilter = '';
      store.save(); fillCatFilter(); refreshLabels();
      toast('Categories saved');
    });
    $('#catReset').addEventListener('click', () => { $('#catEdit').value = DEFAULT_CATS.join('\n'); });
    $('#labelsExport').addEventListener('click', () => {
      download(`multiview-labels-${fileStamp()}.json`,
        JSON.stringify({ format: 'multiview-labels/1', categories: state.categories, labels: state.labels }, null, 2), 'application/json');
    });
    $('#labelsImportBtn').addEventListener('click', () => $('#labelsImport').click());
    $('#labelsImport').addEventListener('change', async e => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!f) return;
      try {
        const n = importLabels(JSON.parse(await f.text()));
        $('#catEdit').value = state.categories.join('\n');
        toast(n ? `Imported ${n} label(s)` : 'No labels found in that file.');
      } catch (err) { toast('Could not read that file as JSON.'); }
    });
    $('#labelsClear').addEventListener('click', () => {
      const n = Object.keys(state.labels).length;
      if (!n) return toast('There are no labels to clear.');
      if (!confirm(`Remove all ${n} source label(s)?`)) return;
      state.labels = {};
      logEvent('labels cleared', null, `${n} label(s)`);
      store.save(); refreshLabels();
    });

    /* observation log */
    $('#logBtn').addEventListener('click', () => toggleLog());
    $('#logClose').addEventListener('click', () => toggleLog(false));
    $('#logp').addEventListener('click', e => { if (e.target.id === 'logp') toggleLog(false); });
    $('#logCsv').addEventListener('click', exportLogCsv);
    $('#logJson').addEventListener('click', () => download(`multiview-log-${fileStamp()}.json`, JSON.stringify(log, null, 2), 'application/json'));
    $('#logClear').addEventListener('click', () => {
      if (!log.length || !confirm(`Clear all ${log.length} log entries?`)) return;
      log = [];
      try { chrome.storage.local.set({ mvLog: [] }); } catch (err) {}
      $('#logCount').textContent = '0';
      renderLog();
    });
    const tick = () => { if (!document.hidden) $('#clock').textContent = new Date().toISOString().slice(11, 19) + ' UTC'; };
    tick();
    setInterval(tick, 1000);
    $('#refreshTabs').addEventListener('click', () => { refreshTabs(); toast('Tab list refreshed'); });
    $('#clearTicks').addEventListener('click', () => { selected.clear(); renderTabList(); });
    document.querySelectorAll('#modeSeg button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.m)));
    $('#auto').addEventListener('change', e => {
      state.auto = e.target.checked; store.save();
      if (state.auto) { toast('Auto-add on: tabs that are confirmed live will be added as they appear.'); autoAdd(); }
    });
    document.querySelectorAll('input[name=source]').forEach(r => r.addEventListener('change', () => { if (r.checked) { state.source = r.value; store.save(); } }));
    $('#addSelected').addEventListener('click', () => {
      const en = tabEntries.filter(x => selected.has(x.tab.id) && !inGrid(x.p) && qualifies(x));
      if (!en.length) return toast('Tick one or more qualifying tabs first.');
      addMany(en);
    });
    $('#addAllTabs').addEventListener('click', () => {
      const en = tabEntries.filter(x => !inGrid(x.p) && qualifies(x));
      if (!en.length) return toast(state.mode === 'live' ? 'No live tabs to add. Switch to "All videos" to add ordinary videos.' : 'Nothing new to add.');
      addMany(en);
    });

    document.addEventListener('keydown', e => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'escape') {
        if (!$('#help').hidden) toggleHelp(false);
        else if (!$('#settings').hidden) toggleSettings(false);
        else if (!$('#logp').hidden) toggleLog(false);
        else if (!drawer.hidden) toggleDrawer(false);
        else if (streaming) toggleStreaming();
      }
      else if (k >= '1' && k <= '9') { const i = +k - 1; if (i < state.layout && state.slots[i]) setMuted(i, isAudible(i)); }
      else if (k === 'm') muteAll();
      else if (k === 'p') togglePlayAll();
      else if (k === 'l') setLayout(state.layout === 4 ? 9 : state.layout === 9 ? 16 : 4);
      else if (k === 'h') toggleStreaming();
      else if (k === 't') toggleDrawer();
      else if (k === 'f') toggleFullscreen();
      else if (k === 's') toggleSettings();
      else if (k === 'o') toggleLog();
      else if (k === '?') toggleHelp();
    });

    new ResizeObserver(updateSize).observe(grid);
    window.addEventListener('resize', updateSize);

    // content scripts can't subscribe to tab events, so poll the tab list — but not while this
    // tab itself isn't visible, since nothing here needs to update while nobody can see it.
    if (HAS_EXT) {
      let pollTimer = null;
      const startPoll = () => { if (!pollTimer) pollTimer = setInterval(refreshTabs, 3000); };
      const stopPoll = () => { clearInterval(pollTimer); pollTimer = null; };
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) stopPoll();
        else { refreshTabs(); startPoll(); }
      });
      if (!document.hidden) startPoll();
    }

    // The "+ Multiview" button on a YouTube watch page (inject.js) messages the background
    // script, which forwards it here when this viewer tab is already open.
    if (HAS_EXT) {
      chrome.runtime.onMessage.addListener(msg => {
        if (msg && msg.t === 'addVideo') addVideoById(msg.id, msg.title, msg.channel);
      });
    }
  }

  (async function init() {
    wire();
    const saved = await store.load();
    if (saved) {
      state.layout = [4, 9, 16].includes(saved.layout) ? saved.layout : 4;
      state.solo = saved.solo !== false;
      state.source = ['pause', 'leave', 'close'].includes(saved.source) ? saved.source : 'close';
      state.pinned = saved.pinned !== false;
      state.gaps = !!saved.gaps;
      state.mode = saved.mode === 'all' ? 'all' : 'live';
      state.auto = !!saved.auto;
      state.badges = saved.badges !== false;
      if (saved.maxQuality === 'auto' || QUALITY_RANK.includes(saved.maxQuality)) state.maxQuality = saved.maxQuality;
      if (saved.labels && typeof saved.labels === 'object') state.labels = Object.assign({}, saved.labels);
      if (Array.isArray(saved.categories) && saved.categories.length) state.categories = saved.categories.filter(c => typeof c === 'string');
      if (typeof saved.catFilter === 'string') state.catFilter = saved.catFilter;
      if (Array.isArray(saved.slots)) saved.slots.slice(0, MAX).forEach((s, i) => {
        if (s && s.id && (s.kind === 'video' || s.kind === 'channel')) state.slots[i] = Object.assign({}, s, { muted: true, native: 0 });
        else if (s && s.kind === 'embed' && s.url) state.slots[i] = Object.assign({}, s);
      });
    }
    if (HAS_EXT) {
      try {
        const { mvLog } = await chrome.storage.local.get('mvLog');
        if (Array.isArray(mvLog)) log = mvLog.slice(-LOG_MAX);
      } catch (e) {}
    }
    $('#logCount').textContent = String(log.length);
    fillCatFilter();
    render();
    logEvent('viewer opened', null, `${state.slots.filter(Boolean).length} tile(s) restored`);
    refreshTabs();
    if (HAS_EXT) {
      // Picked up when the "+ Multiview" button opened this tab fresh (no existing viewer to message).
      try {
        const { mvPending } = await chrome.storage.local.get('mvPending');
        if (mvPending && mvPending.id) {
          await chrome.storage.local.remove('mvPending');
          await addVideoById(mvPending.id, mvPending.title, mvPending.channel);
        }
      } catch (e) {}
    }
    if (HAS_EXT && !state.slots.some(Boolean)) setTimeout(() => { if (tabEntries.length) toggleDrawer(true); }, 300);
  })();
})();
