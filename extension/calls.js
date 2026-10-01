'use strict';
// My calls: today's score, every call with its result, and share cards (PNG) made on a canvas:
// the scorecard ("mofo 7 · my fomo 2") and a tombstone for every dump you called WAIT on.
(function () {
  const send = (type, payload) => new Promise((res) => chrome.runtime.sendMessage({ type, payload: payload || {} }, (r) => res(r || { ok: false })));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const NAVY = '#0B091F';
  const LAV = '#EAEDFF';
  const orb = new Image();
  orb.src = 'icons/orb.png';
  let me = null;
  let calls = [];

  const price = (x) => (!Number.isFinite(x) ? '?' : x >= 1 ? x.toFixed(2) : x >= 0.001 ? x.toFixed(5).replace(/0+$/, '') : x.toPrecision(3));
  const move = (m) => (Number.isFinite(m) ? (m > 0 ? '+' : '') + m.toFixed(1) + '%' : '');
  const when = (t) => new Date(t * 1000).toISOString().slice(5, 16).replace('T', ' ');

  async function load() {
    const [m, l] = await Promise.all([send('call:join'), send('call:list', { limit: 100 })]);
    if (!m.ok) {
      document.getElementById('score').innerHTML = `<div class="muted">${esc(m.error || 'THE CALL is offline right now.')}</div>`;
      return;
    }
    me = m;
    calls = l.ok ? l.calls : [];
    render();
  }

  function render() {
    const t = me.today;
    const today = calls.filter((c) => c.day === t.n && ['right', 'wrong'].includes(c.result));
    const right = today.filter((c) => c.result === 'right').length;
    const wrong = today.length - right;
    document.getElementById('score').innerHTML = `<div><div class="big">mofo <i>${right}</i> · my fomo <i>${wrong}</i></div>
      <div class="sub">${t.n >= 1 ? 'day ' + esc(t.n) : 'practice'} · ${t.points > 0 ? '+' : ''}${esc(t.points)} pts${t.rank ? ' · #' + esc(t.rank) + ' today' : ''}${me.week.n >= 1 ? ' · week ' + esc(me.week.n) + ' ' + (me.week.points > 0 ? '+' : '') + esc(me.week.points) + ' pts' : ''}</div></div>
      <div><button data-card="score">Share card</button></div>`;
    const list = document.getElementById('list');
    if (!calls.length) {
      list.innerHTML = '<div class="muted">No calls yet. Open a token on fomo.family: when it turns HOT or EXTREME, MOFO asks you to make the call.</div>';
      return;
    }
    list.innerHTML = calls
      .map((c) => {
        const pts = c.result === 'open' ? '' : (c.points > 0 ? '+' : '') + c.points;
        const rip = c.side === 'wait' && c.result === 'right' && c.movePct <= -5;
        return `<div class="c"><span class="when">${esc(when(c.at))}</span><span class="sym">$${esc(c.symbol || '?')}</span><span class="side">${esc(c.side.toUpperCase())}</span>
          <span class="move">${esc(c.result === 'open' ? 'settles ' + when(c.settleAt).slice(6) : move(c.movePct))}</span><span class="res ${esc(c.result)}">${esc(c.result)}</span>
          <span class="pts">${esc(pts)} ${rip ? `<button class="ghost" data-card="rip" data-id="${c.id}">RIP card</button>` : ''}</span></div>`;
      })
      .join('');
  }

  // ---------------------------------------------------------------- share cards
  function frame(ctx, W, H) {
    ctx.fillStyle = NAVY;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = LAV;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(40, 40);
    ctx.lineTo(W - 40, 40);
    ctx.lineTo(W - 40, H - 80);
    ctx.lineTo(W - 80, H - 40);
    ctx.lineTo(40, H - 40);
    ctx.closePath();
    ctx.stroke();
    ctx.font = "500 22px 'MOFO Martian'";
    ctx.fillStyle = LAV;
    ctx.fillText('THE CALL · MIND OVER FOMO', 84, 104);
    ctx.textAlign = 'right';
    ctx.fillText('MINDOVERFOMO.TOOLS', W - 84, 104);
    ctx.textAlign = 'left';
  }
  function fit(ctx, text, max, size, weight) {
    let s = size;
    do {
      ctx.font = `${weight} ${s}px 'MOFO Archivo'`;
      s -= 4;
    } while (ctx.measureText(text).width > max && s > 20);
  }
  async function card(kind, id) {
    await document.fonts.load("900 100px 'MOFO Archivo'");
    await document.fonts.load("500 20px 'MOFO Martian'");
    const cv = document.getElementById('cv');
    const ctx = cv.getContext('2d');
    const W = cv.width;
    const H = cv.height;
    frame(ctx, W, H);
    ctx.fillStyle = LAV;
    if (kind === 'score') {
      const t = me.today;
      const today = calls.filter((c) => c.day === t.n && ['right', 'wrong'].includes(c.result));
      const right = today.filter((c) => c.result === 'right').length;
      ctx.font = "500 26px 'MOFO Martian'";
      ctx.fillText(t.n >= 1 ? `DAY ${t.n} · WEEK ${me.week.n}` : 'PRACTICE', 84, 220);
      fit(ctx, `mofo ${right}`, 900, 170, 900);
      ctx.fillText(`mofo ${right}`, 84, 420);
      fit(ctx, `my fomo ${today.length - right}`, 900, 170, 900);
      ctx.fillText(`my fomo ${today.length - right}`, 84, 590);
      ctx.font = "500 30px 'MOFO Martian'";
      ctx.fillText(`${t.points > 0 ? '+' : ''}${t.points} PTS${t.rank ? ' · #' + t.rank + ' TODAY' : ''}${me.handle ? ' · @' + me.handle.toUpperCase() : ''}`, 84, 700);
    } else {
      const c = calls.find((x) => String(x.id) === String(id));
      if (!c) return;
      ctx.font = "500 26px 'MOFO Martian'";
      ctx.fillText('A DUMP I DIDN\'T BUY', 84, 220);
      fit(ctx, `RIP $${c.symbol || '?'}`, 1000, 190, 900);
      ctx.fillText(`RIP $${c.symbol || '?'}`, 84, 440);
      ctx.font = "500 34px 'MOFO Martian'";
      ctx.fillText(`almost bought at $${price(c.price)}`, 84, 540);
      ctx.fillText(`${move(c.movePct)} in 15 min. I called WAIT.`, 84, 596);
      ctx.fillText(`+${c.points} PTS${me.handle ? ' · @' + me.handle.toUpperCase() : ''}`, 84, 700);
    }
    if (orb.complete) ctx.drawImage(orb, W - 520, 250, 400, 400 * (orb.height / orb.width));
    const a = document.createElement('a');
    a.download = kind === 'score' ? `mofo-day-${me.today.n}.png` : `mofo-rip-${id}.png`;
    a.href = cv.toDataURL('image/png');
    a.click();
  }

  // ---------------------------------------------------------------- the caller board: who calls well, who to fade
  let range = 'day';
  const pct = (a) => (a == null ? '–' : Math.round(a * 100) + '%');
  const fomoLink = (u) => (u ? `<a href="https://fomo.family/profile/${encodeURIComponent(u)}" target="_blank" rel="noopener">fomo ↗</a>` : '<span></span>');
  const rows = (list, empty) =>
    list.length
      ? list.map((r, i) => `<div class="br${i === 0 ? ' first' : ''}"><span class="rk">${String(i + 1).padStart(2, '0')}</span><span class="nm">${esc(r.handle)}</span><span class="acc">${pct(r.accuracy)}</span><span class="pt">${r.points > 0 ? '+' : ''}${esc(r.points)}</span>${fomoLink(r.fomo)}</div>`).join('')
      : `<div class="muted">${empty}</div>`;
  async function loadBoard() {
    const b = await send('call:callers', { range });
    if (!b || !b.ok) {
      document.getElementById('best').innerHTML = `<div class="muted">${esc((b && b.error) || 'The caller board is offline right now.')}</div>`;
      return;
    }
    document.getElementById('best').innerHTML = rows(b.best, `Nobody has ${b.minCalls} settled calls ${range === 'all' ? 'yet' : 'in this range yet'}. Make yours.`);
    document.getElementById('worst').innerHTML = rows(b.worst, 'Nobody named is in the red. Good day.');
  }
  document.getElementById('tabs').addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-range]');
    if (!b) return;
    range = b.dataset.range;
    document.querySelectorAll('#tabs button').forEach((x) => (x.className = x === b ? 'on' : 'ghost'));
    loadBoard();
  });

  document.body.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-card]');
    if (b) card(b.dataset.card, b.dataset.id);
  });
  load();
  loadBoard();
  setInterval(loadBoard, 60000);
  if (location.hash === '#board') setTimeout(() => document.getElementById('board').scrollIntoView(), 300);
  setInterval(load, 30000);
})();
