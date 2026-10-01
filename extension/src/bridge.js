/* MOFO: bridge between the page-world scripts and the extension background.
   Runs in the isolated world, so the page never sees chrome.* or the API keys.
   Also registers MOFO's two typefaces with the page: @font-face has to live in the document for the panel's
   shadow DOM to use it, and only this world can resolve chrome-extension:// URLs. */
(function () {
  'use strict';
  const ALLOWED = new Set(['rundown', 'chat', 'holders', 'listvotes', 'trending:snap', 'journal:add', 'open:options', 'open:journal', 'open:calls', 'call:make', 'call:me', 'call:list', 'call:board']);
  window.addEventListener('message', (ev) => {
    if (ev.source !== window || !ev.data || ev.data.__fc !== 'req' || !ALLOWED.has(ev.data.type)) return;
    const { id, type, payload } = ev.data;
    chrome.runtime.sendMessage({ type, payload }, (res) => {
      const err = chrome.runtime.lastError ? chrome.runtime.lastError.message : null;
      window.postMessage({ __fc: 'res', id, res: err ? { ok: false, error: err } : res }, '*');
    });
  });

  const LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
  const LATIN_EXT = 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF';
  const face = (family, file, weight, stretch, range) =>
    `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-stretch:${stretch};font-display:swap;src:url(${chrome.runtime.getURL('fonts/' + file)}) format('woff2');unicode-range:${range}}`;
  function injectFonts() {
    if (document.getElementById('mofo-fonts')) return;
    const s = document.createElement('style');
    s.id = 'mofo-fonts';
    s.textContent = [
      face('MOFO Archivo', 'archivo-latin-ext.woff2', '100 900', '62% 125%', LATIN_EXT),
      face('MOFO Archivo', 'archivo-latin.woff2', '100 900', '62% 125%', LATIN),
      face('MOFO Martian', 'martian-latin-ext.woff2', '100 800', '75% 112.5%', LATIN_EXT),
      face('MOFO Martian', 'martian-latin.woff2', '100 800', '75% 112.5%', LATIN),
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  }
  // The page-world scripts can't resolve extension URLs: hand them the orb for THE CALL card.
  try {
    document.documentElement.dataset.mofoOrb = chrome.runtime.getURL('icons/orb.png');
  } catch (e) {}
  try {
    injectFonts();
  } catch (e) {
    /* fonts are optional: the panel falls back to system fonts */
  }
})();
