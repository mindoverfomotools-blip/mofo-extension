'use strict';
// THE CALL in settings: your name on the caller board, your fomo.family username (the board links to your profile so
// people can follow good callers) and your private caller code.
(function () {
  const box = document.getElementById('callBox');
  const send = (type, payload) => new Promise((res) => chrome.runtime.sendMessage({ type, payload: payload || {} }, (r) => res(r || { ok: false, error: chrome.runtime.lastError ? chrome.runtime.lastError.message : 'no answer' })));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  let me = null;
  let msg = '';
  let tries = 0;

  async function load() {
    const m = await send('call:join');
    if (!m || !m.ok) {
      box.innerHTML = `<p class="hint">${esc((m && m.error) || 'THE CALL is offline right now.')}</p>`;
      if (m && m.offline && tries++ < 5) setTimeout(load, 3000); // a hiccup on the way: try again shortly
      return;
    }
    tries = 0;
    me = m;
    render();
  }

  function render() {
    let html = `<div class="call-card"><div class="k">Your caller profile</div>
      <label for="callHandle">Name on the caller board</label>
      <input id="callHandle" maxlength="16" spellcheck="false" autocomplete="off" placeholder="3 to 16 letters, numbers or _" value="${esc(me.handle || '')}">
      <label for="callFomo">Your fomo.family username (optional)</label>
      <input id="callFomo" maxlength="32" spellcheck="false" autocomplete="off" placeholder="so people can find you on fomo" value="${esc(me.fomo || '')}">
      <div class="hint">Without a name you show up as anon. Your name and username are public on the caller board.</div>
      <div class="call-btns"><button id="callProfileSave">Save profile</button></div></div>`;
    html += `<div class="call-card"><div class="k">Your caller code</div>
      <div class="call-row"><code>${esc(me.code || '')}</code><button data-copy="${esc(me.code || '')}">Copy</button></div>
      <p class="hint">Keep it private. It proves these calls are yours if you link your profile on mindoverfomo.tools.</p></div>`;
    if (me.today) {
      const t = me.today;
      const label = t.n >= 1 ? `Day ${esc(t.n)} · Week ${esc(me.week.n)}` : 'Practice';
      html += `<div class="call-card"><div class="k">${label}</div><div class="big">${t.points > 0 ? '+' : ''}${esc(t.points)} pts today${t.rank ? ' · #' + esc(t.rank) : ''}</div>
        <div class="v" style="margin-top:6px">${esc(t.settled)} settled · ${esc(t.right)} right · ${esc(t.left)} calls left today</div>
        <div class="call-btns"><button id="callMine">My calls</button><button id="callBoard">Caller board</button></div></div>`;
    }
    if (msg) html += `<p class="hint"><span class="tag">${esc(msg)}</span></p>`;
    box.innerHTML = html;
  }

  box.addEventListener('click', async (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.copy) {
      await navigator.clipboard.writeText(b.dataset.copy);
      b.textContent = 'Copied';
      setTimeout(() => (b.textContent = 'Copy'), 1500);
      return;
    }
    msg = '';
    if (b.id === 'callProfileSave') {
      const r = await send('call:profile', { handle: document.getElementById('callHandle').value, fomo: document.getElementById('callFomo').value });
      msg = r.ok ? 'Profile saved' : r.error;
      return load();
    }
    if (b.id === 'callMine') return send('open:calls');
    if (b.id === 'callBoard') return send('open:calls', { tab: 'board' });
  });
  load();
})();
