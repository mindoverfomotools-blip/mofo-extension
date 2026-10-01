'use strict';
// MOFO demo: the real panel, badges and chart layers on sample data, for anyone without a fomo.family login.
(async function () {
  const E = window.FCEngine, P = window.FCPanel, O = window.FCOverlay, H = window.FCHolders, TV = window.FCTV;
  const q = new URLSearchParams(location.search);
  const HEAT = q.get('heat') || 'hot';
  const GR = q.get('colors') === 'greenred';
  const cur = location.search || '?heat=hot';
  document.querySelectorAll('.demo a').forEach((l) => l.classList.toggle('on', l.getAttribute('href') === cur));
  const POS = q.get('pos') === '1';

  // ---------------- synthetic candles: sideways, then a tail that fits the heat asked for
  let seed = { calm: 3, warm: 5, hot: 7, extreme: 9 }[HEAT] || 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const bars = [];
  let p = 0.0009;
  const t0 = 1758700000;
  const push = (drift, vol, v) => {
    const o = p;
    p = Math.max(1e-6, p * (1 + drift + (rnd() - 0.5) * vol));
    bars.push({ t: t0 + bars.length * 60, o, h: Math.max(o, p) * (1 + rnd() * vol * 0.4), l: Math.min(o, p) * (1 - rnd() * vol * 0.4), c: p, v: v * (0.5 + rnd()) });
  };
  for (let i = 0; i < 560; i++) push(Math.sin(i / 38) * 0.004 + 0.0004, 0.018, 900);
  const tail = { calm: [40, 0.0005, 0.012], warm: [40, 0.0035, 0.014], hot: [18, 0.013, 0.02], extreme: [14, 0.045, 0.03] }[HEAT];
  for (let i = 0; i < 100 - tail[0]; i++) push(-0.0006, 0.014, 800);
  for (let i = 0; i < tail[0]; i++) push(tail[1], tail[2], 1400 + i * 120);
  const entry = POS ? bars[bars.length - 30].c * 0.97 : null;
  const a = E.analyze(bars, 60, { entry, openedAt: POS ? bars[bars.length - 30].t : null });
  if (a.chase.heat !== HEAT) { a.chase.heat = HEAT; a.__forced = true; }
  if (a.position) a.position.ageH = 0.5;

  // ---------------- the chart, drawn the way tv.js draws on FOMO's TradingView (mono chart on)
  const cv = document.getElementById('cv');
  const dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth, Hh = cv.clientHeight;
  cv.width = W * dpr; cv.height = Hh * dpr;
  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);
  const axisW = 74, botH = 26;
  const N = 170, from = bars.length - N, vis = bars.slice(from);
  const g = a.gauss;
  let lo = Infinity, hi = -Infinity;
  // Like TradingView's autoscale: the candles set the price range, drawings outside it are clipped.
  for (let i = from; i < bars.length; i++) { lo = Math.min(lo, bars[i].l); hi = Math.max(hi, bars[i].h); }
  const pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
  const bw = (W - axisW - 20) / N;
  const X = (i) => 10 + (i - from + 0.5) * bw;
  const Y = (v) => 12 + (1 - (v - lo) / (hi - lo)) * (Hh - botH - 24);
  const XT = (t) => X(from + (t - bars[from].t) / 60);
  ctx.fillStyle = '#0B091F'; ctx.fillRect(0, 0, W, Hh);
  ctx.strokeStyle = '#EAEDFF'; ctx.fillStyle = '#EAEDFF'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(W - axisW + 0.5, 0); ctx.lineTo(W - axisW + 0.5, Hh - botH); ctx.lineTo(0, Hh - botH + 0.5); ctx.stroke();
  ctx.font = "500 10px 'MOFO Martian', monospace";
  for (let k = 0; k <= 6; k++) { const v = lo + (hi - lo) * k / 6; ctx.fillText('$' + v.toPrecision(3), W - axisW + 8, Y(v) + 3); }
  for (let k = 0; k < 5; k++) { const i = from + Math.round(k * N / 5); const d = new Date(bars[i].t * 1000); ctx.fillText(d.toISOString().slice(11, 16), X(i) - 14, Hh - 9); }
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W - axisW, Hh - botH); ctx.clip();
  const dash = (s) => ctx.setLineDash(s === 2 ? [6, 4] : s === 1 ? [1.5, 3] : s === 3 ? [12, 6] : []);
  const label = (txt, x, y, align) => { ctx.font = "700 10px 'MOFO Archivo', Arial"; ctx.textAlign = align || 'right'; ctx.fillText(txt, x, y); ctx.textAlign = 'left'; };
  const hline = (v, txt, style, w) => { dash(style); ctx.lineWidth = w || 1; ctx.beginPath(); ctx.moveTo(0, Math.round(Y(v)) + 0.5); ctx.lineTo(W - axisW, Math.round(Y(v)) + 0.5); ctx.stroke(); dash(0); label(txt, W - axisW - 8, Y(v) - 5); };
  const rect = (t1, v1, v2, txt, style, w) => { dash(style); ctx.lineWidth = w || 1; const x1 = Math.max(0, XT(t1)); ctx.strokeRect(Math.round(x1) + 0.5, Math.round(Y(v2)) + 0.5, W - axisW - x1 - 1, Math.round(Y(v1) - Y(v2))); dash(0); label(txt, x1 + 6, Y(v2) + 13, 'left'); };
  const poly = (arr, style, w) => { dash(style); ctx.lineWidth = w; ctx.beginPath(); const pts = TV.thin(g.t, arr, 400, 200); pts.forEach((pt, k) => (k ? ctx.lineTo(XT(pt.time), Y(pt.price)) : ctx.moveTo(XT(pt.time), Y(pt.price)))); ctx.stroke(); dash(0); };
  // levels
  for (const z of a.levels.supports) rect(z.firstT, z.lo, z.hi, 'S ×' + z.touches, 2, 1);
  for (const z of a.levels.resistances) rect(z.firstT, z.lo, z.hi, 'R ×' + z.touches, 0, 1);
  // candles
  for (let i = from; i < bars.length; i++) {
    const b = bars[i], x = X(i), up = b.c >= b.o;
    ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, Y(b.h)); ctx.lineTo(Math.round(x) + 0.5, Y(b.l)); ctx.stroke();
    const y1 = Y(Math.max(b.o, b.c)), y2 = Y(Math.min(b.o, b.c)), w = Math.max(1, bw * 0.62);
    const colUp = GR ? '#16C784' : '#EAEDFF', colDn = GR ? '#EA3943' : '#0B091F';
    ctx.strokeStyle = GR ? (up ? colUp : colDn) : '#EAEDFF';
    ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, Y(b.h)); ctx.lineTo(Math.round(x) + 0.5, Y(b.l)); ctx.stroke();
    ctx.fillStyle = up ? colUp : colDn; ctx.fillRect(Math.round(x - w / 2), Math.round(y1), Math.round(w), Math.max(1, Math.round(y2 - y1)));
    ctx.strokeRect(Math.round(x - w / 2) + 0.5, Math.round(y1) + 0.5, Math.round(w) - 1, Math.max(1, Math.round(y2 - y1)) - 1);
    ctx.fillStyle = '#EAEDFF'; ctx.strokeStyle = '#EAEDFF';
  }
  // gaussian
  poly(g.filt, 0, 2); poly(g.hband, 2, 1); poly(g.lband, 2, 1);
  label('GAUSS ' + g.poles + '·' + g.period, W - axisW - 8, Y(g.last.h) - 6);
  // fomo line
  hline(a.fomoLine.hot, 'FOMO LINE · HOT above', 2, 1);
  hline(a.fomoLine.extreme, 'EXTREME above', 1, 1);
  if (a.position) {
    const qq = a.position;
    hline(qq.entry, qq.armed ? 'AVG ENTRY = STOP (breakeven)' : 'AVG ENTRY', 0, 2);
    if (qq.stopKind === 'emergency') hline(qq.stop, 'EMERGENCY STOP -60%', 2, 2);
    hline(qq.takeHalf, 'SELL HALF +50%', 1, 1);
  } else if (a.plan.buyZone) {
    const bz = a.plan.buyZone;
    rect(bars[bars.length - 40].t, bz.lo, bz.hi, 'BUY ZONE ' + bz.rr.toFixed(1) + 'R' + (bz.valid ? '' : ' · under 1.5R, skip'), 0, 2);
    hline(bz.stop, 'STOP · wrong below', 2, 2); hline(bz.t1, 'T1', 1, 1); hline(bz.t2, 'T2', 1, 1);
  }
  for (const s of a.signals) {
    const x = XT(s.t), y = Y(s.price) + (s.up ? 14 : -14);
    ctx.beginPath(); if (s.up) { ctx.moveTo(x, y - 6); ctx.lineTo(x - 5, y + 3); ctx.lineTo(x + 5, y + 3); } else { ctx.moveTo(x, y + 6); ctx.lineTo(x - 5, y - 3); ctx.lineTo(x + 5, y - 3); } ctx.fill();
    label(s.kind.toUpperCase(), x, s.up ? y + 15 : y - 9, 'center');
  }
  ctx.restore();

  // ---------------- MOFO overlays in FOMO's layout
  const risk = { level: HEAT === 'extreme' ? 'high' : HEAT === 'hot' ? 'medium' : 'low', reasons: [
    { text: 'Liquidity is 7% of market cap: thin for its valuation', bad: false, ev: 'prac' },
    { text: 'Top 10 wallets hold 34%', bad: false, ev: 'prac' },
  ].concat(HEAT === 'extreme' ? [{ text: 'Last 5 min: 96 buys from only 21 wallets, bot or wash-like flow', bad: true, ev: 'own' }] : []) };
  const raw = await (await fetch('demo/holders_sample.json')).json().catch(() => null);
  const stats = await (await fetch('demo/stats_sample.json')).json().catch(() => null);
  let holderData = null;
  try {
    const list = raw && (raw.list || raw.data || raw);
    const st = stats ? [stats] : [];
    const summary = H.summarize(list, st, Math.floor(Date.now() / 1000));
    const vote = FCScoreModel.deepVote(H.deepFeatures(summary.components, { marketCapUsd: 2.4e6, liquidityUsd: 180000, ageMin: 900 }, 'sol'), 'sol');
    holderData = { res: { ok: true, chain: 'sol', at: Date.now(), pending: 0, profiling: false, bannedFor: 0, error: null, summary, logCount: 312, vote } };
  } catch (e) { holderData = { res: null }; }
  const items = [
    holderData.res && holderData.res.vote ? { text: 'Vote ' + holderData.res.vote.score, cls: { high: 'good', mid: 'warn', low: 'bad' }[holderData.res.vote.band], title: FCScoreModel.describe(holderData.res.vote) } : { text: 'Vote –', cls: 'muted' },
    { text: 'Risk ' + (risk.level === 'medium' ? 'med' : risk.level), cls: risk.level === 'high' ? 'bad' : risk.level === 'medium' ? 'warn' : 'good' },
    { text: HEAT.toUpperCase(), cls: { calm: 'good', warm: 'warn', hot: 'bad', extreme: 'bad' }[HEAT] },
    { text: 'Bund+ins 18%', cls: 'warn' },
    { text: 'SM 2 · KOL 1', cls: '', opt: true },
    { text: 'Fresh 6.2%', cls: '', opt: true },
  ];
  O.header(items, () => {});
  O.buyHeat(HEAT);
  const guard = document.createElement('div');
  guard.id = 'fomo-copilot-guard';
  guard.style.cssText = O.GUARD_CSS;
  guard.textContent = '$750 is above your max size ($500). Your biggest losses were your biggest positions.' + (HEAT === 'hot' || HEAT === 'extreme' ? '  •  Entry check is ' + HEAT.toUpperCase() + ': buying now is chasing.' : '');
  const btn = document.getElementById('buy');
  btn.parentElement.insertBefore(guard, btn);
  O.buyHeat(HEAT);

  // ---------------- the panel
  if (q.get('left')) localStorage.setItem('fcp:panel-pos', JSON.stringify({ right: innerWidth - Number(q.get('left')) - 340, top: Number(q.get('top') || 130) }));
  else localStorage.setItem('fcp:panel-pos', JSON.stringify({ right: innerWidth - 24 - 340, top: 130 }));
  localStorage.setItem('fcp:panel-collapsed', q.get('collapsed') === '1' ? '1' : '0');
  const settings = { protectAfter: 0.25, takeHalfAt: 0.5, emergencyStop: 0.6, maxPositionUsd: 500, maxDailyLossUsd: 1000, bigWinUsd: 1000, drawLevels: true, drawSignals: true, drawGauss: true, drawFomoLine: true, drawPlan: true, candleColors: 'mono', gaussPeriod: 144, gaussPoles: 4, gaussMult: 1.414 };
  window.FCSettings = { get: () => Object.assign({}, settings), set: (x) => Object.assign(settings, x) };
  P.mount();
  const disc = { items: [] };
  if (HEAT === 'hot' || HEAT === 'extreme') disc.items.push({ level: 'bad', text: 'Entry check is ' + HEAT.toUpperCase() + ': buying now is chasing.' });
  if (a.position && a.position.pnl < 0) disc.items.push({ level: 'bad', text: 'You are ' + P.pct(a.position.pnl) + ' on this token. Buying more is averaging down: set the stop first, or leave it.' });
  if (HEAT === 'warm') disc.items.push({ level: 'warn', text: 'Up $1,240 in 24h. After a big day: half size, A+ setups only, no revenge re-entries.' });
  const now = Date.now();
  const rundown = q.get('rundown') === '0' ? null : { loading: false, result: { ok: true, cached: true, at: now - 4 * 60000, ms: 11000, costUsd: 0.024, x: { calls: 4, errors: [] }, posts: [{ id: '1837', user: 'pepetwo_sol', followers: 12400, text: 'the sequel nobody asked for. same frog, new chain energy' }], topPosts: [], rundown: { type: 'meme', narrative: 'A sequel coin riding the original Pepe name. Launched on pump.fun two days ago, pushed by two mid-size accounts.', name: 'Pepe Two, the second Pepe.', origin: 'pump.fun launch, first posted by @pepetwo_sol', utility: 'none (pure meme)', keyPosts: [{ id: '1837', why: 'first post from the deployer account' }], sources: [{ title: 'X post', url: 'https://x.com/pepetwo_sol/status/1837' }] } } };
  window.__lastPreview = { symbol: 'PEPE2', resLabel: '1m', analysis: a, risk, flow: { m5: { netUsd: 4210, uniqueBuyers: 64, uniqueSellers: 31 }, h1: { netUsd: 18800, uniqueBuyers: 402, uniqueSellers: 288 }, h24: { netUsd: -9100, uniqueBuyers: 2210, uniqueSellers: 2402 } }, discipline: disc, rundown, holders: { fomoHolders: 12, totalHolders: 2904, inProfit: 4, devHolding: false, top: [{ user: 'degen_mike', valueUsd: 1200, pnlUsd: -340, holdH: 2.5 }, { user: 'solqueen', valueUsd: 860, pnlUsd: 410, holdH: 0.4 }] }, holderData };
  P.render(window.__lastPreview);
  if (q.get('chat') === '1') P.chatRender({ busy: q.get('busy') === '1', messages: [{ role: 'user', text: 'find me an entry' }, { role: 'assistant', text: '**No trade here.** Price is ' + (a.gauss.zone === 'above' ? 'above the top Gaussian band' : 'mid-channel') + '.\n- wait for a pullback into the buy zone\n- stop under the zone low\n- size $250, half your max', costUsd: 0.031, ms: 12000 }] });
  if (q.get('cfg') === '1') shadow().getElementById('cfg').click();
  // THE CALL: ?call=ask|open|result shows the card; the panel section always gets sample standings
  document.documentElement.dataset.mofoOrb = 'icons/orb.png';
  const nowS = Math.floor(Date.now() / 1000);
  const callMe = { today: { n: 3, points: 14, calls: 7, settled: 6, right: 4, rank: 2, left: 13, minCalls: 5 }, week: { n: 1, points: 38, rank: 4 }, open: [{ id: 9, symbol: 'PEPE2', side: 'wait', at: nowS - 240, settleAt: nowS + 660 }], handle: 'demo_trader' };
  const cm = q.get('call');
  if (cm === 'ask') {
    const DEMO_S = 15;
    let side = null, t0 = 0;
    const tick = () => {
      if (!side) return;
      const left = DEMO_S - (Date.now() - t0) / 1000;
      if (left > 0) {
        O.callCard({ mode: 'open', symbol: 'PEPE2', side, settleAt: DEMO_S, now: DEMO_S - left, total: DEMO_S, priceText: '0.00247 (demo: settles in 15 s)' }, on);
        setTimeout(tick, 250);
      } else {
        const right = side === 'wait';
        O.callCard({ mode: 'result', symbol: 'PEPE2', side, result: right ? 'right' : 'wrong', points: right ? 4 : -4, moveText: '-8.4%' }, on);
      }
    };
    const start = (s) => { side = s; t0 = Date.now(); tick(); };
    const on = { buy: () => start('buy'), wait: () => start('wait'), skip: () => O.callCard(null), close: () => O.callCard(null), calls: () => {}, board: () => {} };
    O.callCard({ mode: 'ask', symbol: 'PEPE2', heat: HEAT === 'calm' ? 'extreme' : HEAT, left: 13 }, on);
  }
  if (cm === 'open') O.callCard({ mode: 'open', symbol: 'PEPE2', side: 'wait', settleAt: nowS + 660, now: nowS, total: 900, priceText: '0.00247' }, {});
  if (cm === 'result') O.callCard({ mode: 'result', symbol: 'PEPE2', side: 'wait', result: 'right', points: 4, moveText: '-8.4%' }, {});
  if (cm) P.render(Object.assign({}, window.__lastPreview || {}, { call: callMe }));
  function shadow() { return document.getElementById('fomo-copilot-host').shadowRoot; }
  document.body.dataset.ready = '1';
  document.body.dataset.heat = a.chase.heat + (a.__forced ? ' (forced)' : '');
})();
