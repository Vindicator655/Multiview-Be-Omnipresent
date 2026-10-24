'use strict';
/* Content script: runs on every youtube.com watch/live page. Adds a button beside the Subscribe
   button that sends the current video to the Multiview viewer (background.js wires it up; the
   viewer listens for it in viewer.js). YouTube is a single-page app, so this re-runs on every
   in-app navigation rather than relying on a fresh page load. */
(() => {
  const BTN_ID = 'mv-add-btn';

  function parseIdFromUrl() {
    try {
      const u = new URL(location.href);
      if (u.pathname === '/watch') return u.searchParams.get('v');
      const live = u.pathname.match(/^\/live\/([\w-]{11})/);
      if (live) return live[1];
    } catch (e) {}
    return null;
  }

  function makeButton() {
    const b = document.createElement('button');
    b.id = BTN_ID;
    b.type = 'button';
    b.textContent = '+ Multiview';
    b.title = 'Add this video to Multiview';
    b.style.cssText = 'margin-left:8px;padding:0 16px;height:36px;border-radius:18px;'
      + 'border:1px solid #3ea6ff;background:transparent;color:#3ea6ff;font:14px/1 Roboto,Arial,sans-serif;'
      + 'font-weight:500;cursor:pointer;white-space:nowrap;vertical-align:middle;';
    b.addEventListener('mouseenter', () => { b.style.background = 'rgba(62,166,255,.1)'; });
    b.addEventListener('mouseleave', () => { b.style.background = 'transparent'; });
    b.addEventListener('click', () => {
      const id = parseIdFromUrl();
      if (!id) return;
      const title = document.title.replace(/^\(\d+\)\s*/, '').replace(/\s*-\s*YouTube$/, '');
      const ch = document.querySelector('ytd-watch-metadata ytd-channel-name a, #owner ytd-channel-name a');
      const channel = ch && ch.textContent.trim() || null;
      b.disabled = true;
      b.textContent = 'Adding…';
      try {
        chrome.runtime.sendMessage({ t: 'addToMultiview', id, title, channel }, () => {
          void chrome.runtime.lastError;
          b.textContent = '✓ Added';
          setTimeout(() => { b.disabled = false; b.textContent = '+ Multiview'; }, 2000);
        });
      } catch (e) { b.disabled = false; b.textContent = '+ Multiview'; }
    });
    return b;
  }

  function place() {
    if (document.getElementById(BTN_ID)) return;
    if (!/^\/(watch|live\/)/.test(location.pathname)) return;
    const sub = document.querySelector('ytd-subscribe-button-renderer, #subscribe-button, #subscribe-button-shape');
    if (!sub) return;
    const anchor = sub.closest('ytd-subscribe-button-renderer') || sub;
    anchor.insertAdjacentElement('afterend', makeButton());
  }

  place();
  // Covers both YouTube's SPA navigation and any DOM it re-renders around the subscribe button.
  new MutationObserver(place).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('yt-navigate-finish', () => {
    const old = document.getElementById(BTN_ID);
    if (old) old.remove();
    place();
  });
})();
