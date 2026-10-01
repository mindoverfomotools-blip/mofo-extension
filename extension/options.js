'use strict';
const FIELDS = ['anthropicKey', 'twitterKey', 'model', 'maxSearches', 'holderKey', 'notes'];

// The holder data key field exists only in copies that ship direct holder access (src/holder-direct.js).
if (document.getElementById('holderKeyRow')) fetch(chrome.runtime.getURL('src/holder-direct.js'))
  .then((r) => { if (r.ok) document.getElementById('holderKeyRow').hidden = false; })
  .catch(() => {});

chrome.storage.local.get(FIELDS.concat(['extConfig']), (s) => {
  for (const f of FIELDS) if (s[f] !== undefined && document.getElementById(f)) document.getElementById(f).value = s[f];
  showFree(s);
});

// Whether the free service is on: the address comes from mindoverfomo.tools (read by the background worker).
async function showFree(s) {
  const el = document.getElementById('freeState');
  let on = s.extConfig && s.extConfig.proxy;
  if (!on) {
    try {
      const r = await fetch('https://mindoverfomo.tools/ext-config.json', { cache: 'no-store' });
      const j = await r.json();
      on = typeof j.proxy === 'string' && /^https:\/\//.test(j.proxy);
    } catch (e) {}
  }
  const own = s.anthropicKey || s.holderKey;
  el.innerHTML = on ? '<b>on</b> Free AI and holder data are running.' : '<b>soon</b> The free service switches on soon. Until then the chart tools work, and the AI needs your own keys below.';
  if (own) el.innerHTML += ' Your own keys are set, so MOFO uses those.';
}

document.getElementById('save').addEventListener('click', () => {
  const v = {};
  for (const f of FIELDS) if (document.getElementById(f)) v[f] = document.getElementById(f).value.trim(); // the store build has no key fields
  if (v.maxSearches !== undefined) v.maxSearches = Math.max(1, Math.min(10, Number(v.maxSearches) || 2));
  if (v.notes !== undefined) v.notes = v.notes.slice(0, 1500);
  chrome.storage.local.set(v, () => {
    const el = document.getElementById('saved');
    el.textContent = 'Saved';
    setTimeout(() => (el.textContent = ''), 2000);
  });
});
