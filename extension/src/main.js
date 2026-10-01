/* MOFO: controller. Watches the token page, runs the engine on the chart's own candles,
   draws levels, the Gaussian channel and the plan, fills the panel, and puts warnings next to FOMO's Buy button.
   Never clicks anything. */
(function (root) {
  'use strict';
  const E = root.FCEngine;
  const TV = root.FCTV;
  const P = root.FCPanel;
  const NET = root.FCNet || { get: () => null, on: () => {} };
  const OV = root.FCOverlay || null;
  const SM = root.FCScoreModel || null;
  if (!E || !TV || !P) return;

  const SETTINGS_KEY = 'fcp:settings';
  const DEFAULTS = {
    protectAfter: 0.25, // once up this much, the stop moves to your entry
    takeHalfAt: 0.5, // sell half here
    emergencyStop: 0.6, // for trades that never got to +25%; 0 turns it off
    maxPositionUsd: 500, // biggest single buy the guard allows without a warning
    bigWinUsd: 1000, // a day up this much triggers the cool-down
    maxDailyLossUsd: 1000, // a day down this much: stop
    drawLevels: true,
    drawSignals: true,
    drawGauss: true, // Gaussian channel (DonovanWall port) on the chart
    drawFomoLine: true, // where entry heat turns HOT / EXTREME
    drawPlan: true, // buy zone, stop and targets when there is no position
    theCall: true, // THE CALL card when the open token turns HOT or EXTREME
    candleColors: 'mono', // FOMO's candles on a navy pane: 'mono' black and white, 'greenred' green and red, 'fomo' FOMO's own
    gaussPeriod: 144,
    gaussPoles: 4,
    gaussMult: 1.414,
  };
  let settings = Object.assign({}, DEFAULTS);
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    // before candle colors there was one black and white switch
    if (saved.candleColors === undefined && saved.monoChart === false) saved.candleColors = 'fomo';
    delete saved.monoChart;
    settings = Object.assign(settings, saved);
  } catch (e) {}
  root.FCSettings = {
    get: () => Object.assign({}, settings),
    set: (patch) => {
      settings = Object.assign(settings, patch);
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      schedule(0);
    },
  };

  // Personal history if this copy has it (the owner's), generic wording otherwise.
  const ME = root.FCPersonal || null;

  const st = { api: null, chart: null, unsub: null, drawKey: '', running: false, again: false, timer: null, tokenKey: '', last: null };

  // ---------------------------------------------------------------- page facts
  function pageToken() {
    const m = location.pathname.match(/^\/tokens\/([^/]+)\/([^/?#]+)/);
    return m ? { chain: m[1], address: decodeURIComponent(m[2]) } : null;
  }

  function parseCompact(txt) {
    if (!txt) return null;
    const m = String(txt).replace(/,/g, '').match(/(-?)\$?\s*([\d.]+)\s*([KMB]?)/i);
    if (!m) return null;
    const mult = { '': 1, K: 1e3, M: 1e6, B: 1e9 }[m[3].toUpperCase()];
    return (m[1] ? -1 : 1) * parseFloat(m[2]) * mult;
  }

  function domStat(label) {
    const el = [...document.querySelectorAll('div, span, p')].find((e) => e.children.length === 0 && (e.textContent || '').trim() === label);
    if (!el || !el.parentElement) return null;
    return (el.parentElement.textContent || '').replace(label, '').trim();
  }

  function symbolFromTitle() {
    const m = document.title.match(/\|\s*([^|]+?)\s*\|\s*fomo/i);
    return m ? m[1] : '';
  }

  const contains = (obj, addr) => {
    try {
      return JSON.stringify(obj).toLowerCase().includes(addr.toLowerCase());
    } catch (e) {
      return false;
    }
  };

  function responseList(rec) {
    if (!rec || !rec.json) return [];
    const r = rec.json.responseObject !== undefined ? rec.json.responseObject : rec.json;
    if (Array.isArray(r)) return r;
    if (r && typeof r === 'object') {
      for (const v of Object.values(r)) if (Array.isArray(v)) return v;
    }
    return [];
  }

  function tokenStats(tok) {
    const rec = NET.get('/proxy/filterTokens', (x) => contains(x.json, tok.address));
    const item = responseList(rec).find((it) => contains(it.token || it.pair || it, tok.address));
    const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
    return {
      priceUSD: item ? num(item.priceUSD) : parseCompact(domStat('Price')),
      marketCap: item ? num(item.marketCap) : parseCompact(domStat('Market cap')),
      liquidity: item ? num(item.liquidity) : parseCompact(domStat('Liquidity')),
      holders: item ? num(item.holders) : parseCompact(domStat('Holders')),
      top10: parseFloat((domStat('Top 10 holding') || '').replace('%', '')) || null,
      createdAt: item && item.createdAt ? num(item.createdAt) : null,
      uniqueBuys1: item ? num(item.uniqueBuys1) : null,
      uniqueSells1: item ? num(item.uniqueSells1) : null,
    };
  }

  function selfUserId() {
    for (const rec of Object.values((root.FCNet && root.FCNet.last) || {})) {
      const m = rec.path.match(/\/v2\/users\/([0-9a-f-]{36})\//);
      if (m) return m[1];
    }
    return null;
  }

  const ENTRY_FIELDS = ['avgEntryPrice', 'averageEntryPrice', 'averageBuyPrice', 'entryPrice'];

  // Average entry (USD per token) of the user's open position on this token, from what the page loaded.
  // /trades -> responseObject.activeTrades[i].trade.{avgEntryPrice, totalCostBasis, unrealizedPnlUsd, ...}
  function positionEntry(tok) {
    const addr = tok.address.toLowerCase();
    const trades = NET.get('/trades', (x) => {
      const ro = x.json && x.json.responseObject;
      return !!(ro && Array.isArray(ro.activeTrades) && ro.activeTrades.some((t) => contains(t.trade || t, addr)));
    });
    const ro = trades && trades.json && trades.json.responseObject;
    for (const t of (ro && ro.activeTrades) || []) {
      const tr = t.trade || t;
      if (!contains(tr, addr)) continue;
      for (const f of ENTRY_FIELDS) if (Number(tr[f]) > 0) return { price: Number(tr[f]), openedAt: tr.createdAt ? Date.parse(tr.createdAt) : null };
    }
    const uid = selfUserId();
    if (uid) {
      const top = NET.get('/hodlers/top', (x) => contains(x.params, tok.address) || contains(x.json, tok.address));
      for (const group of responseList(top)) {
        for (const h of (group && group.topHolders) || []) {
          if (contains(h.user, uid) && Number(h.averageEntryPrice) > 0) return { price: Number(h.averageEntryPrice), openedAt: null };
        }
      }
    }
    return null;
  }

  // ---------------------------------------------------------------- rules
  // Buy/sell flow per FOMO window (5m, 1h, 4h, 24h) from /proxy/tokenDetails. That response carries no token
  // address, so it is only trusted if it arrived after the current token page opened.
  function flowStats() {
    const det = NET.get('/proxy/tokenDetails');
    if (!det || det.at < (st.tokenSince || 0) - 5000) return null;
    const d = det.json && det.json.responseObject;
    if (!d || typeof d !== 'object') return null;
    const n = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
    const win = (w) => {
      const buys = n(d['buyCount' + w]);
      const sells = n(d['sellCount' + w]);
      if (buys === null && sells === null) return null;
      const ub = n(d['uniqueBuys' + w]);
      const us = n(d['uniqueSells' + w]);
      const bv = n(d['buyVolume' + w]);
      const sv = n(d['sellVolume' + w]);
      // A missing field stays null so a check never fires on data FOMO didn't send.
      return { buys, sells, uniqueBuyers: ub, uniqueSellers: us, buyUsd: bv, sellUsd: sv, netUsd: bv !== null && sv !== null ? bv - sv : null, organic: buys && ub !== null ? ub / buys : null, usdPerBuyer: ub && bv !== null ? bv / ub : null };
    };
    return { m5: win('5m'), h1: win('1'), h4: win('4'), h24: win('24'), top10Pct: n(d.top10HoldersPercent) };
  }

  // Each reason carries its evidence type (research/03-safety-signals.md, 05-academic-data.md): data = studies or the
  // trader data, tool = a scanner's published rule, prac = trader rule of thumb, own = our threshold, not sourced.
  function tokenRisk(stats, tok, flow, links) {
    const reasons = [];
    let high = 0;
    let med = 0;
    const add = (text, level, ev) => {
      reasons.push({ text, bad: level === 'high', ev: ev || null });
      if (level === 'high') high++;
      else med++;
    };
    if (stats.liquidity !== null) {
      if (stats.liquidity < 15000) add(`Liquidity only ${P.money(stats.liquidity)}: big slippage, easy to dump`, 'high', 'own');
      else if (stats.liquidity < 50000) add(`Thin liquidity (${P.money(stats.liquidity)})`, 'medium', 'own');
      if (stats.marketCap) {
        const ratio = stats.liquidity / stats.marketCap;
        if (ratio < 0.015) add(`Liquidity is ${(ratio * 100).toFixed(1)}% of market cap, below the 1.5% floor trading tools use`, 'high', 'tool');
        else if (ratio < 0.1) add(`Liquidity is ${Math.round(ratio * 100)}% of market cap: thin for its valuation`, 'medium', 'prac');
      }
    }
    const top10 = flow && flow.top10Pct !== null ? flow.top10Pct : stats.top10;
    if (top10 !== null) {
      if (top10 > 50) add(`Top 10 wallets hold ${top10.toFixed(0)}%`, 'high', 'tool');
      else if (top10 > 30) add(`Top 10 wallets hold ${top10.toFixed(0)}%`, 'medium', 'prac');
    }
    if (stats.holders !== null && stats.holders < 300) add(`Only ${Math.round(stats.holders)} holders`, 'medium', 'own');
    if (stats.createdAt) {
      const ms = stats.createdAt > 1e12 ? stats.createdAt : stats.createdAt * 1000;
      const ageMin = (Date.now() - ms) / 60000;
      if (ageMin < 1) add('Launch minute: creator-funded snipers sell 55% within 1 min and 85% within 5', 'high', 'data');
      else if (ageMin < 5) add(`${Math.max(1, Math.round(ageMin))} min old: still inside the sniper exit window`, 'high', 'data');
      else if (ageMin < 30) add(`Brand new: ${Math.round(ageMin)} min old (rugged new tokens die in a median 14 min)`, 'medium', 'data');
      else if (ageMin < 180) add(`Young token: ${(ageMin / 60).toFixed(1)}h old`, 'medium', 'own');
    }
    const h1 = flow && flow.h1;
    const m5 = flow && flow.m5;
    const w = h1 && h1.buys >= 20 ? h1 : m5 && m5.buys >= 20 ? m5 : null;
    if (w) {
      const label = w === h1 ? 'Last hour' : 'Last 5 min';
      const imbalance = w.sells !== null ? Math.abs(w.buys - w.sells) / (w.buys + w.sells) : null;
      if (w.sells === 0 && w.buys >= 30) add(`${label}: ${w.buys} buys and no sells, make sure selling works`, 'high', 'tool');
      else if (imbalance !== null && imbalance > 0.35) add(`${label}: ${w.buys} buys vs ${w.sells} sells, one-sided beyond the 0.35 wash-trading filter`, 'medium', 'tool');
      if (w.organic !== null && w.organic < 0.35) add(`${label}: ${w.buys} buys from only ${w.uniqueBuyers} wallets, bot or wash-like flow`, 'high', 'own');
      if (w.usdPerBuyer !== null && w.uniqueBuyers >= 30 && w.usdPerBuyer < 15) add(`${label}: ${w.uniqueBuyers} buyers averaging ${P.money(w.usdPerBuyer)}, buyer count looks inflated`, 'medium', 'own');
    }
    if (h1 && h1.uniqueSellers >= 10 && h1.uniqueBuyers !== null && h1.uniqueSellers > h1.uniqueBuyers * 1.3) {
      add(`Last hour: ${h1.uniqueSellers} sellers vs ${h1.uniqueBuyers} buyers`, 'medium', 'own');
    }
    if (links && !links.website && !links.twitter && !links.telegram) add('No website, X or Telegram: tokens without socials graduate ~17× less often', 'medium', 'data');
    const devs = NET.get('/hodlers/devs', (x) => (x.params.tokenAddress || '').toLowerCase() === tok.address.toLowerCase());
    const devList = devs && devs.json && devs.json.responseObject && devs.json.responseObject.devHoldings;
    if (Array.isArray(devList) && devList.length) add(`Dev wallet still holds (${devList.length} position${devList.length > 1 ? 's' : ''})`, 'medium', 'tool');
    const warn = NET.get('/proxy/tokenWarnings', (x) => x.at >= (st.tokenSince || 0) - 5000);
    const wo = warn && warn.json && warn.json.responseObject;
    if (wo && wo.disableSelling) add('FOMO has disabled selling for this token', 'high', 'tool');
    else if (wo && Array.isArray(wo.warnings) && wo.warnings.length) add(`FOMO shows ${wo.warnings.length} warning${wo.warnings.length > 1 ? 's' : ''} for this token`, 'high', 'tool');
    const level = high ? 'high' : med >= 2 ? 'medium' : 'low';
    return { level, reasons };
  }

  function dayPnl() {
    // The header shows the portfolio's 24h change next to "24h".
    const el = [...document.querySelectorAll('div, span, p')].find((e) => e.children.length === 0 && (e.textContent || '').trim() === '24h');
    if (!el || !el.parentElement) return null;
    const txt = (el.parentElement.textContent || '').replace('24h', '');
    return parseCompact(txt.replace(/\s/g, ''));
  }

  function discipline(analysis, risk) {
    const items = [];
    const pnl = dayPnl();
    if (pnl !== null && pnl >= settings.bigWinUsd) {
      items.push({ level: 'warn', text: `Up ${P.money(pnl)} in 24h. ${ME ? ME.lines.bigWin : 'Big days are when traders give it back'}: half size, A+ setups only, no revenge re-entries.` });
    }
    if (pnl !== null && pnl <= -settings.maxDailyLossUsd) {
      items.push({ level: 'bad', text: `Down ${P.money(-pnl)} in 24h: daily loss limit hit. Stop trading today.` });
    }
    if (analysis && analysis.ok && (analysis.chase.heat === 'hot' || analysis.chase.heat === 'extreme')) {
      items.push({ level: 'bad', text: 'Entry check is ' + analysis.chase.heat.toUpperCase() + ': buying now is chasing.' });
    }
    if (risk && risk.level === 'high') items.push({ level: 'bad', text: 'High-risk token: if you buy anyway, use your smallest size.' });
    const q = analysis && analysis.ok ? analysis.position : null;
    if (q && q.pnl < 0) {
      items.push({ level: 'bad', text: `You are ${P.pct(q.pnl)} on this token. Buying more is averaging down` + (ME ? `: your ${ME.history.avgDownTrades} averaged-down trades lost ${P.money(ME.history.avgDownLossUsd)}.` : ', the most common way a small loss becomes a big one.') });
    }
    if (q && q.ageH > 24 && q.pnl < 0) {
      items.push({ level: 'warn', text: `Held ${Math.round(q.ageH)}h and still red` + (ME ? `. Your 24h+ holds won ${ME.history.bagWins} of ${ME.history.bagTrades}: decide now, don't hope.` : ': decide now, don\'t hope.') });
    }
    return { items, pnl };
  }

  // ---------------------------------------------------------------- buy-box guard
  let guardEl = null;
  function buyGuard(warnings) {
    const buyBtn = [...document.querySelectorAll('button')].find((b) => /^Buy\s+\S+/.test((b.textContent || '').trim()));
    if (!buyBtn) return;
    let panel = buyBtn.parentElement;
    for (let i = 0; i < 6 && panel && !panel.querySelector('input'); i++) panel = panel.parentElement;
    const input = panel && panel.querySelector('input');
    const amount = input ? parseCompact(input.value) : null;
    const lines = warnings.slice();
    if (amount !== null && amount > settings.maxPositionUsd) {
      lines.unshift(`${P.money(amount)} is above your max size (${P.money(settings.maxPositionUsd)}).` + (ME ? ' ' + ME.lines.oversize : ''));
    }
    if (!guardEl || !guardEl.isConnected) {
      guardEl = document.createElement('div');
      guardEl.id = 'fomo-copilot-guard';
      guardEl.style.cssText = (OV && OV.GUARD_CSS) || 'margin:6px 0;padding:6px 8px;font:700 11px/1.35 sans-serif;background:#EAEDFF;color:#0B091F';
      buyBtn.parentElement.insertBefore(guardEl, buyBtn);
      if (input && !input.__fcGuard) {
        input.__fcGuard = true;
        input.addEventListener('input', () => buyGuard(st.lastWarnings || []));
      }
    }
    guardEl.style.display = lines.length ? '' : 'none';
    guardEl.textContent = lines.join('  •  ');
  }

  // ---------------------------------------------------------------- drawing
  // Smart-money and KOL wallets among the top holders that bought inside the chart's range: first buy time, average cost.
  function smartEntries(gm, bars) {
    const res = gm && gm.res && gm.res.ok ? gm.res : null;
    if (!res || !bars || !bars.length) return [];
    const first = bars[0].t;
    return res.summary.rows.filter((r) => (r.roles.includes('smart') || r.roles.includes('kol')) && r.startAt >= first && r.avgCostUsd > 0).slice(0, 8);
  }

  async function draw(chart, a, tok, extra) {
    const x = extra || {};
    const S = TV.STYLE;
    const smart = settings.drawSignals ? smartEntries(x.gm, x.bars) : [];
    const g = settings.drawGauss ? a.gauss : null;
    const bz = !a.position && settings.drawPlan ? a.plan.buyZone : null;
    const p3 = (v) => (Number.isFinite(v) ? v.toPrecision(3) : '-');
    const key = [tok.address, a.resSec, settings.drawLevels, settings.drawSignals, settings.drawGauss, settings.drawFomoLine, settings.drawPlan, settings.gaussPeriod, settings.gaussPoles, settings.gaussMult, Math.round(Math.log10(x.scale || 1))]
      .concat(a.levels.supports.concat(a.levels.resistances).map((z) => z.mid.toPrecision(3)))
      .concat(a.position ? [a.position.entry.toPrecision(4), a.position.stop ? a.position.stop.toPrecision(3) : '-', a.position.trail ? a.position.trail.toPrecision(2) : '-'] : [])
      .concat(a.signals.map((s) => s.t + s.kind))
      .concat(smart.map((r) => r.address + r.startAt))
      // The channel is redrawn once per new bar so it always reaches the last candle.
      .concat(g ? [a.last.t] : [])
      .concat(settings.drawFomoLine && a.fomoLine ? [p3(a.fomoLine.hot), p3(a.fomoLine.extreme)] : [])
      .concat(bz ? [p3(bz.lo), p3(bz.hi), p3(bz.stop), p3(bz.t1), p3(bz.t2)] : [])
      .join('|');
    if (key === st.drawKey) return;
    st.drawKey = key;
    TV.clear(chart);
    const tEnd = a.last.t;
    if (g) {
      await TV.polyline(chart, TV.thin(g.t, g.filt, 400, 200), S.solid, 2);
      await TV.polyline(chart, TV.thin(g.t, g.hband, 400, 200), S.dashed, 1);
      await TV.polyline(chart, TV.thin(g.t, g.lband, 400, 200), S.dashed, 1);
      await TV.text(chart, tEnd, g.last.h, `GAUSS ${g.poles}·${g.period}`);
    }
    if (settings.drawLevels) {
      for (const z of a.levels.supports) await TV.zone(chart, z.firstT, tEnd, z.lo, z.hi, `S ×${z.touches}`, S.dashed, 1);
      for (const z of a.levels.resistances) await TV.zone(chart, z.firstT, tEnd, z.lo, z.hi, `R ×${z.touches}`, S.solid, 1);
    }
    if (settings.drawFomoLine && a.fomoLine) {
      await TV.hline(chart, tEnd, a.fomoLine.hot, 'FOMO LINE · HOT above', S.dashed, 1);
      await TV.hline(chart, tEnd, a.fomoLine.extreme, 'EXTREME above', S.dotted, 1);
    }
    if (a.position) {
      const q = a.position;
      await TV.hline(chart, tEnd, q.entry, q.armed ? 'AVG ENTRY = STOP (breakeven)' : 'AVG ENTRY', S.solid, 2);
      if (q.stopKind === 'emergency') await TV.hline(chart, tEnd, q.stop, `EMERGENCY STOP -${Math.round(settings.emergencyStop * 100)}%`, S.dashed, 2);
      await TV.hline(chart, tEnd, q.takeHalf, `SELL HALF +${Math.round(settings.takeHalfAt * 100)}%`, S.dotted, 1);
      if (!q.armed) await TV.hline(chart, tEnd, q.entry * (1 + settings.protectAfter), `+${Math.round(settings.protectAfter * 100)}%: STOP MOVES TO ENTRY`, S.dotted, 1);
      if (q.trail !== null) await TV.hline(chart, tEnd, q.trail, 'TRAILING STOP', S.longDash, 1);
    } else if (bz) {
      const t0 = Math.max(a.levels.pivots.length ? a.levels.pivots[0].t : tEnd, tEnd - 40 * a.resSec);
      await TV.zone(chart, t0, tEnd, bz.lo, bz.hi, `BUY ZONE ${bz.rr.toFixed(1)}R${bz.valid ? '' : ' · under 1.5R, skip'}`, S.solid, 2);
      await TV.hline(chart, tEnd, bz.stop, 'STOP · wrong below', S.dashed, 2);
      await TV.hline(chart, tEnd, bz.t1, 'T1', S.dotted, 1);
      await TV.hline(chart, tEnd, bz.t2, 'T2', S.dotted, 1);
    }
    if (!a.position && settings.drawPlan && a.plan.breakout) await TV.hline(chart, tEnd, a.plan.breakout.trigger, 'BREAKOUT above', S.longDash, 1);
    if (settings.drawSignals) {
      for (const s of a.signals) await TV.marker(chart, s.t, s.price, s.up, s.kind.toUpperCase());
      for (const r of smart) await TV.marker(chart, r.startAt, r.avgCostUsd * (x.scale || 1), true, r.roles.includes('kol') ? 'KOL ENTRY' : 'SM ENTRY');
    }
  }

  // ---------------------------------------------------------------- extension bridge (keys and API calls live in the background worker)
  const pending = new Map();
  let reqSeq = 0;
  window.addEventListener('message', (ev) => {
    if (ev.source !== window || !ev.data || ev.data.__fc !== 'res') return;
    const cb = pending.get(ev.data.id);
    if (cb) {
      pending.delete(ev.data.id);
      cb(ev.data.res);
    }
  });
  function ext(type, payload, timeoutMs) {
    return new Promise((resolve) => {
      const id = 'fc' + ++reqSeq + '_' + Date.now();
      const timer = setTimeout(() => {
        pending.delete(id);
        resolve({ ok: false, error: 'That took too long. Try again.' });
      }, timeoutMs || 120000);
      pending.set(id, (res) => {
        clearTimeout(timer);
        resolve(res || { ok: false, error: 'Empty answer from the extension.' });
      });
      window.postMessage({ __fc: 'req', id, type, payload }, '*');
    });
  }

  // ---------------------------------------------------------------- project rundown
  const rkey = (tok) => tok.chain + ':' + tok.address.toLowerCase();
  const rundownState = {};

  function pageLinks() {
    const pick = (label) => {
      const a = [...document.querySelectorAll('a[href]')].find((x) => (x.textContent || '').trim().startsWith(label));
      return a ? a.href : null;
    };
    return { website: pick('Website'), twitter: pick('Twitter'), telegram: pick('Telegram') };
  }

  function tokenFacts(tok) {
    const stats = tokenStats(tok);
    const det = NET.get('/proxy/tokenDetails');
    const d = (det && det.json && det.json.responseObject) || {};
    const warn = NET.get('/proxy/tokenWarnings');
    const w = warn && warn.json && warn.json.responseObject;
    let name = null;
    try {
      const ext = st.chart && st.chart.symbolExt ? st.chart.symbolExt() : null;
      name = ext && (ext.description || ext.name) ? String(ext.description || ext.name) : null;
    } catch (e) {}
    const createdMs = stats.createdAt ? (stats.createdAt > 1e12 ? stats.createdAt : stats.createdAt * 1000) : null;
    return {
      chain: tok.chain,
      address: tok.address,
      symbol: symbolFromTitle(),
      name,
      links: pageLinks(),
      facts: {
        marketCapUsd: stats.marketCap,
        liquidityUsd: stats.liquidity,
        holders: stats.holders,
        top10HoldersPct: d.top10HoldersPercent !== undefined ? d.top10HoldersPercent : stats.top10,
        ageHours: createdMs ? Math.round((Date.now() - createdMs) / 36e5) : null,
        buys24h: d.buyCount24,
        sells24h: d.sellCount24,
        uniqueBuyers24h: d.uniqueBuys24,
        uniqueSellers24h: d.uniqueSells24,
        fomoWarnings: w && Array.isArray(w.warnings) ? w.warnings.length : null,
        sellingDisabledOnFomo: w ? !!w.disableSelling : null,
      },
    };
  }

  async function requestRundown(force) {
    const tok = pageToken();
    if (!tok) return;
    const key = rkey(tok);
    if (rundownState[key] && rundownState[key].loading) return;
    rundownState[key] = { loading: true, startedAt: Date.now() };
    schedule(0);
    const res = await ext('rundown', { token: tokenFacts(tok), force: !!force }, 90000);
    rundownState[key] = { loading: false, result: res };
    schedule(0);
  }

  // ---------------------------------------------------------------- FOMO traders holding this token (from /hodlers/top the page loads)
  function holdersSummary(tok) {
    const rec = NET.get('/hodlers/top', (x) => contains(x.json, tok.address) || contains(x.params, tok.address));
    const groups = responseList(rec);
    const g = groups.find((x) => x && contains(x.tokenAddress, tok.address)) || (groups.length === 1 ? groups[0] : null);
    const list = g && Array.isArray(g.topHolders) ? g.topHolders : [];
    if (!list.length) return null;
    const num = (v) => (v !== null && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : null);
    const who = (u) => (u && (u.userHandle || u.handle || u.username || u.displayName || u.name)) || null;
    const top = list
      .slice()
      .sort((a, b) => (num(b.value) || 0) - (num(a.value) || 0))
      .slice(0, 10)
      .map((h) => ({
        user: who(h.user),
        valueUsd: num(h.value),
        pnlUsd: num(h.pnl),
        realizedUsd: num(h.realizedPnl),
        unrealizedUsd: num(h.unrealizedPnl),
        avgEntryUsd: num(h.averageEntryPrice),
        holdH: h.averageHoldTimeSeconds ? Math.round(h.averageHoldTimeSeconds / 360) / 10 : null,
        dev: !!h.isDev,
      }));
    return { fomoHolders: list.length, totalHolders: num(g.totalHolders), inProfit: list.filter((h) => Number(h.pnl) > 0).length, devHolding: list.some((h) => h.isDev), top };
  }

  // ---------------------------------------------------------------- on-chain holder profiles (fetched by the background worker)
  const holderState = {};
  function holderFacts(stats, risk, flow) {
    if (!stats) return {};
    const createdMs = stats.createdAt ? (stats.createdAt > 1e12 ? stats.createdAt : stats.createdAt * 1000) : null;
    return { priceUsd: stats.priceUSD, marketCapUsd: stats.marketCap, liquidityUsd: stats.liquidity, ageMin: createdMs ? Math.round((Date.now() - createdMs) / 60000) : null, risk: risk ? risk.level : null, flowNet1hUsd: flow && flow.h1 ? flow.h1.netUsd : null };
  }
  // Polls every 4 s while wallets are being profiled, every 30 s after that (the background serves it from cache).
  async function requestHolders(tok, facts, force) {
    const key = rkey(tok);
    const s = (holderState[key] = holderState[key] || { res: null, loading: false, lastReq: 0 });
    if (s.loading) return;
    const r0 = s.res;
    const wait = !r0 ? 0 : r0.needsSetup || r0.soon || r0.unsupported ? 60000 : r0.ok && (r0.pending || r0.profiling || r0.bannedFor) ? 4000 : 30000;
    if (!force && Date.now() - s.lastReq < wait) return;
    s.loading = true;
    s.lastReq = Date.now();
    const res = await ext('holders', { token: { chain: tok.chain, address: tok.address, symbol: symbolFromTitle(), facts }, force: !!force }, 60000);
    s.loading = false;
    s.res = res;
    if (res && res.ok && res.vote) listState.votes.set(tok.chain + ':' + tok.address, { at: Date.now(), vote: res.vote });
    const now = pageToken();
    if (now && rkey(now) === key) schedule(0);
  }
  function compactHolders(res) {
    const S = res.summary;
    const d1 = (x) => (x === null || x === undefined || !Number.isFinite(x) ? null : Math.round(x * 10) / 10);
    return {
      source: "top holders + each wallet's last 30 days; style labels are MOFO rules",
      asOf: new Date(res.at).toISOString(),
      supplyPctByRole: roundDeep(S.supply),
      countsByRole: S.counts,
      fundingClusters: S.clusters.map((c) => ({ wallets: c.wallets, pct: d1(c.pct) })),
      warnings: S.warnings.map((w) => w.text),
      summary: roundDeep(S.components),
      top: S.rows.slice(0, 10).map((r) => ({
        pct: d1(r.pct),
        usd: sig(r.usd),
        pnlOnTokenUsd: sig(r.tokenPnlUsd),
        heldMin: r.sinceMin === null ? null : Math.round(r.sinceMin),
        soldPct: d1(r.soldPct),
        roles: r.roles,
        platform: r.platform,
        win30d: r.stats ? sig(r.stats.winrate) : null,
        realized30dUsd: r.stats ? sig(r.stats.realizedUsd) : null,
        evPerTokenUsd: r.stats ? sig(r.stats.evPerTokenUsd) : null,
        tokens30d: r.stats ? r.stats.tokens : null,
        avgHoldH: r.stats && r.stats.avgHoldSec !== null ? d1(r.stats.avgHoldSec / 3600) : null,
        style: r.style ? r.style.label : null,
      })),
    };
  }

  // ---------------------------------------------------------------- overlays on FOMO's own layout (src/overlay.js)
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const pctShort = (x) => (Number.isFinite(x) ? (x >= 10 ? Math.round(x) : x.toFixed(1)) + '%' : '–');
  const holdShort = (s) => (!Number.isFinite(s) ? '–' : s < 3600 ? Math.round(s / 60) + 'm' : s < 86400 ? (s / 3600).toFixed(1) + 'h' : (s / 86400).toFixed(1) + 'd');

  const VOTE_CLS = { high: 'good', mid: 'warn', low: 'bad' };
  function voteBadge(gm) {
    const res = gm && gm.res;
    if (res && res.vote) return { text: `Vote ${res.vote.score}`, cls: VOTE_CLS[res.vote.band], title: SM ? SM.describe(res.vote) : '' };
    const why = !res || !res.ok ? 'Vote: waiting for the holder data.' : 'Vote: no votes for this chain yet. The MOFO log covers Solana, BNB and Base.';
    return { text: 'Vote –', cls: 'muted', title: why };
  }

  // Token page header badges, most important first: vote, risk, entry heat, bundler + insider supply, then smart money /
  // KOLs and fresh wallets, which hide when the header is too narrow for FOMO's own stats. Click opens the panel.
  function headerItems(risk, analysis, gm) {
    const res = gm && gm.res && gm.res.ok ? gm.res : null;
    const items = [voteBadge(gm)];
    if (risk) items.push({ text: `Risk ${risk.level === 'medium' ? 'med' : risk.level}`, cls: risk.level === 'high' ? 'bad' : risk.level === 'medium' ? 'warn' : 'good', title: risk.reasons.map((r) => r.text).join('\n') || 'No risk flags' });
    if (analysis && analysis.ok) {
      const h = analysis.chase.heat;
      items.push({ text: h.toUpperCase(), cls: { calm: 'good', warm: 'warn', hot: 'bad', extreme: 'bad' }[h] || '', title: 'Entry heat on this chart' });
    }
    if (res) {
      const sp = res.summary.supply;
      const n = res.summary.counts;
      const bi = sp.bundler + sp.insider;
      items.push({ text: `Bund+ins ${pctShort(bi)}`, cls: bi > 30 ? 'bad' : bi > 15 ? 'warn' : '', title: `Supply held by bundler and insider wallets among the top holders. Bundlers ${pctShort(sp.bundler)}, insiders ${pctShort(sp.insider)}.` });
      items.push({ text: `SM ${n.smart} · KOL ${n.kol}`, cls: '', opt: true, title: 'Smart-money and KOL wallets among the top holders. They show up in most tokens, so on their own they are not a buy signal.' });
      items.push({ text: `Fresh ${pctShort(sp.fresh)}`, cls: sp.fresh > 20 ? 'warn' : '', opt: true, title: 'Supply held by wallets younger than 7 days among the top holders' });
    }
    return items;
  }

  // List badges: the background fetches each row's holder mix (one call per token, low priority, cached 10 min) and
  // scores it; rows show a dash until theirs arrives. Asks again every 3 s with the rows on screen.
  const listState = { votes: new Map(), want: new Map(), lastAsk: 0, asking: false };
  const onScreen = (el) => {
    const r = el && el.getBoundingClientRect();
    return !!r && r.bottom > 0 && r.top < innerHeight && r.width > 0;
  };
  function listVote(chain, address, el) {
    const id = chain + ':' + address;
    const r = listState.votes.get(id);
    // every row is asked about (the background refreshes stale ones); rows on screen go first
    listState.want.set(id, { chain, address, vis: onScreen(el) });
    if (r && r.vote) return { text: String(r.vote.score), cls: { high: 'v-hi', mid: 'v-mid', low: 'v-lo' }[r.vote.band], title: SM ? SM.describe(r.vote) : '' };
    const name = { robinhood: 'Robinhood', ethereum: 'Ethereum', eth: 'Ethereum' }[String(chain).toLowerCase()] || chain;
    return { text: '–', cls: '', title: r && r.noVote ? `Vote: no votes for ${name} tokens yet. The MOFO log covers Solana, BNB and Base.` : r ? 'Vote: no score for this token.' : 'Vote: loading the holder mix.' };
  }
  async function askListVotes() {
    if (listState.asking || !listState.want.size || Date.now() - listState.lastAsk < 2000) return;
    listState.asking = true;
    listState.lastAsk = Date.now();
    const items = [...listState.want.values()].sort((a, b) => b.vis - a.vis).slice(0, 60).map(({ chain, address }) => ({ chain, address }));
    listState.want.clear();
    const res = await ext('listvotes', { items }, 20000);
    listState.asking = false;
    if (!res || !res.ok) return;
    const no = new Set(res.noVote || []);
    for (const [id, vote] of Object.entries(res.votes || {})) listState.votes.set(id, { at: Date.now(), vote, noVote: no.has(id) });
    // a cached vote goes stale with the background's cache
    for (const [id, v] of listState.votes) if (Date.now() - v.at > 10 * 60 * 1000) listState.votes.delete(id);
  }

  // ---------------------------------------------------------------- THE CALL: ask on HOT / EXTREME, count down, show the result
  const CALL_SKIP_MS = 15 * 60 * 1000;
  const callState = { me: null, meAt: 0, loading: false, skip: {}, openIds: new Set(), result: null, resultUntil: 0, busy: false, msg: null, msgUntil: 0, tok: null, heat: null, symbol: null };
  const fmtPrice = (x) => (!Number.isFinite(x) ? '?' : x >= 1 ? x.toFixed(2) : x >= 0.001 ? x.toFixed(5).replace(/0+$/, '') : x.toPrecision(3));
  async function refreshCall(force) {
    const cs = callState;
    const every = cs.me && cs.me.open && cs.me.open.length ? 12000 : 60000;
    if (cs.loading || (!force && Date.now() - cs.meAt < every)) return;
    cs.loading = true;
    const res = await ext('call:me', {}, 15000);
    cs.loading = false;
    cs.meAt = Date.now();
    if (!res || !res.ok) {
      cs.me = res && res.offline ? { offline: true } : cs.me;
      return;
    }
    const now = new Set((res.open || []).map((c) => c.id));
    const gone = [...cs.openIds].filter((id) => !now.has(id));
    cs.me = res;
    cs.openIds = now;
    if (gone.length) {
      const list = await ext('call:list', { limit: 10 }, 15000);
      const done = list && list.ok ? list.calls.find((c) => gone.includes(c.id) && c.result !== 'open') : null;
      if (done) {
        cs.result = done;
        cs.resultUntil = Date.now() + 14000;
      }
    }
    paintCall();
  }
  async function makeCall(side) {
    const cs = callState;
    if (!cs.tok || cs.busy) return;
    cs.busy = true;
    paintCall();
    const res = await ext('call:make', { chain: cs.tok.chain, address: cs.tok.address, side, heat: cs.heat, symbol: cs.symbol }, 20000);
    cs.busy = false;
    if (res && res.ok) {
      cs.openIds.add(res.call.id);
      cs.me = Object.assign({}, cs.me || {}, { open: ((cs.me && cs.me.open) || []).concat([res.call]) });
      refreshCall(true);
    } else {
      cs.msg = (res && res.error) || 'Could not make the call.';
      cs.msgUntil = Date.now() + 7000;
    }
    paintCall();
  }
  function paintCall() {
    if (!OV || !OV.callCard) return;
    const cs = callState;
    const nowMs = Date.now();
    if (!settings.theCall) return OV.callCard(null);
    const on = {
      buy: () => makeCall('buy'),
      wait: () => makeCall('wait'),
      skip: () => {
        if (cs.tok) cs.skip[rkey(cs.tok)] = nowMs + CALL_SKIP_MS;
        paintCall();
      },
      close: () => {
        cs.resultUntil = 0;
        paintCall();
      },
      calls: () => ext('open:calls', {}, 10000),
      board: () => ext('open:calls', { tab: 'board' }, 10000),
    };
    if (cs.result && nowMs < cs.resultUntil) {
      const r = cs.result;
      const mv = Number.isFinite(r.movePct) ? (r.movePct > 0 ? '+' : '') + r.movePct.toFixed(1) + '%' : 'no price';
      return OV.callCard({ mode: 'result', symbol: r.symbol, side: r.side, result: r.result, points: r.points, moveText: mv }, on);
    }
    if (!cs.tok) return OV.callCard(null);
    const addr = String(cs.tok.address);
    const open = cs.me && cs.me.open ? cs.me.open.find((c) => String(c.address).toLowerCase() === addr.toLowerCase()) : null;
    if (open) return OV.callCard({ mode: 'open', symbol: open.symbol || cs.symbol, side: open.side, settleAt: open.settleAt, now: nowMs / 1000, total: open.settleAt - open.at, priceText: fmtPrice(open.price) }, on);
    const hot = cs.heat === 'hot' || cs.heat === 'extreme';
    if (!hot || (cs.skip[rkey(cs.tok)] || 0) > nowMs || (cs.me && cs.me.offline)) return OV.callCard(null);
    const t = cs.me && cs.me.today;
    OV.callCard({ mode: cs.busy ? 'busy' : 'ask', symbol: cs.symbol, heat: cs.heat, left: t ? t.left : undefined, msg: nowMs < cs.msgUntil ? cs.msg : null }, on);
  }
  setInterval(() => {
    paintCall();
    refreshCall(false);
  }, 1000);

  // Trader card on /profile/{handle}: the last 30 days from fomo's own swap history (FCTrades explains why not
  // on-chain). Pages of 25 swaps come in about 0.1 s each; the card shows how far back it has read and the seconds left.
  const TR = root.FCTrades || null;
  const traderState = {};
  const TRADER_TTL_MS = 10 * 60000;
  const TRADER_MAX_PAGES = 200; // 5,000 swaps; the busiest trader seen made about 2,000 in 30 days
  function profileUser() {
    const m = location.pathname.match(/^\/profile\/([^/?#]+)/);
    if (!m) return null;
    const handle = decodeURIComponent(m[1]).toLowerCase();
    const rec = Object.values(NET.last || {}).find((r) => /\/v2\/users\/userHandle\//.test(r.path) && r.path.toLowerCase().endsWith('/' + handle));
    const u = rec && rec.json && rec.json.responseObject;
    return u && u.id ? u : null;
  }
  async function requestTrader(user) {
    const s = (traderState[user.id] = traderState[user.id] || { stats: null, loading: false, at: 0 });
    if (s.loading || (s.at && Date.now() - s.at < (s.stats || s.empty ? TRADER_TTL_MS : 60000))) return;
    if (!TR || !NET.api) return;
    Object.assign(s, { loading: true, at: Date.now(), started: Date.now(), oldest: 0, count: 0, error: null, login: false, partial: false });
    const cutoff = Date.now() - TR.DAYS * 86400e3;
    const swaps = [];
    let last = null;
    let pages = 0;
    const tick = setInterval(traderCard, 1000); // the countdown keeps moving between pages
    try {
      while (pages < TRADER_MAX_PAGES) {
        const r = await NET.api(`/v2/users/${encodeURIComponent(user.id)}/swaps`, last ? { lastSwapIdV2: last } : {});
        if (!r.ok) {
          s.login = !!r.login;
          s.error = r.login ? null : 'fomo did not answer, try again in a minute.';
          break;
        }
        const ro = (r.json && r.json.responseObject) || {};
        const page = Array.isArray(ro.swaps) ? ro.swaps : [];
        swaps.push(...page);
        pages++;
        const oldest = page.length ? Date.parse(page[page.length - 1].createdAt) : cutoff;
        s.oldest = oldest;
        s.count = swaps.length;
        traderCard();
        if (!ro.hasNextPage || !page.length || oldest < cutoff) break;
        last = page[page.length - 1].id;
      }
      s.partial = pages >= TRADER_MAX_PAGES;
      s.stats = s.login || s.error ? null : TR.stats(swaps, Date.now());
      s.empty = !s.login && !s.error && !s.stats;
    } finally {
      clearInterval(tick);
      s.loading = false;
      s.at = Date.now();
      schedule(0);
    }
  }
  function traderCardHtml(s) {
    const head = '<b class="fcx-wm">MOFO</b> <span class="muted">last 30 days on fomo · styles are our rules</span>';
    if (!TR) return head + '<div class="muted">Trader stats are not available in this version.</div>';
    if (!s || (s.loading && !s.count)) return head + '<div class="muted">Reading this trader\'s swaps from fomo…</div><div class="fcx-bar"><i style="width:2%"></i></div>';
    if (s.loading) {
      const p = TR.progress(s.oldest, s.started, Date.now());
      const left = p.left === null ? 'working out the time' : `about ${p.left}s left`;
      return head + `<div class="fcx-row"><span>Reading 30 days of trades</span><span>${s.count.toLocaleString('en-US')} swaps so far</span><b>${left}</b></div><div class="fcx-bar"><i style="width:${Math.max(2, Math.round(p.f * 100))}%"></i></div>`;
    }
    if (s.login) return head + '<div class="muted">Log in to fomo to see this trader\'s stats.</div>';
    if (s.error) return head + `<div class="muted">${esc(s.error)}</div>`;
    if (!s.stats) return head + '<div class="muted">No trades on fomo in the last 30 days.</div>';
    const st = s.stats;
    const sty = TR.style(st);
    const pct = (x) => (x === null ? '–' : Math.round(x * 100) + '%');
    const chains = st.chains
      .filter((c) => c.share >= 0.05)
      .slice(0, 4)
      .map((c) => `${esc(c.label)} ${pct(c.share)}`)
      .join(' · ');
    return (
      head +
      `<div class="fcx-row"><span>win ${pct(st.winrate)}</span><span class="${st.realizedUsd >= 0 ? 'good' : 'bad'}">${P.money(st.realizedUsd)} realized</span><span>${st.tokens} tokens</span><span>typical hold ${holdShort(st.avgHoldSec)}</span><span>typical buy $${Math.round(st.medianBuyUsd || 0).toLocaleString('en-US')}</span><span>${st.perDay >= 10 ? Math.round(st.perDay) : st.perDay.toFixed(1)} trades a day</span>${sty.label ? `<b>${esc(sty.label)}</b>` : ''}${sty.hold ? `<span class="muted">${esc(sty.hold)}</span>` : ''}</div>` +
      (chains ? `<div class="fcx-row"><span class="fcx-k">Chains</span><span>${chains}</span></div>` : '') +
      (s.partial ? `<div class="muted">Based on the latest ${st.swaps.toLocaleString('en-US')} swaps.</div>` : '')
    );
  }
  function traderCard() {
    if (!OV) return;
    const user = profileUser();
    if (!user) return OV.traderCard(null);
    requestTrader(user);
    OV.traderCard(traderCardHtml(traderState[user.id]));
  }


  // ---------------------------------------------------------------- chat assistant
  // The owner's own history, when personal.js is loaded (not in the public build). Everyone else writes their own
  // notes in settings; the background adds them to the snapshot.
  const TRADER_PROFILE = ME ? ME.profile : null;

  const sig = (x) => (Number.isFinite(x) ? Number(x.toPrecision(5)) : null);
  const roundDeep = (v) => {
    if (typeof v === 'number') return sig(v);
    if (Array.isArray(v)) return v.map(roundDeep);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, roundDeep(x)]));
    return v;
  };

  // Everything the assistant needs about the token on screen, compact enough to send with every question.
  function snapshot() {
    const L = st.last;
    if (!L || !L.tok) return { note: 'No token data loaded yet.' };
    const a = L.analysis;
    const out = {
      time: new Date().toISOString(),
      token: tokenFacts(L.tok),
      chartUnits: L.scale > 1 ? 'market cap in USD' : 'price in USD',
      resolution: st.chart ? resLabel(st.chart) : null,
      risk: L.risk,
      flow: L.flow ? roundDeep(L.flow) : null,
      warnings: ((L.disc && L.disc.items) || []).map((i) => i.text),
      rules: { maxBuyUsd: settings.maxPositionUsd, stopToEntryOnceUp: settings.protectAfter, sellHalfAt: settings.takeHalfAt, emergencyStop: settings.emergencyStop, dailyLossLimitUsd: settings.maxDailyLossUsd, portfolio24hPnlUsd: L.disc ? L.disc.pnl : null },
      traderProfile: TRADER_PROFILE,
      fomoTradersHolding: holdersSummary(L.tok),
    };
    const hs = holderState[rkey(L.tok)];
    if (hs && hs.res && hs.res.ok) out.holdersOnChain = compactHolders(hs.res);
    const rd = rundownState[rkey(L.tok)];
    if (rd && rd.result && rd.result.ok && rd.result.rundown) out.rundown = rd.result.rundown;
    if (a && a.ok) {
      const lv = a.levels;
      out.analysis = roundDeep({
        last: a.last.c,
        atr: a.atr,
        trend: a.trend.state,
        structure: a.trend.structure,
        trend15m: a.htf,
        ema9: a.trend.e9,
        ema21: a.trend.e21,
        ema50: a.trend.e50,
        entryHeat: a.chase,
        supports: lv.supports.map((z) => ({ lo: z.lo, hi: z.hi, touches: z.touches })),
        resistances: lv.resistances.map((z) => ({ lo: z.lo, hi: z.hi, touches: z.touches })),
        rangeHigh: lv.rangeHigh,
        rangeLow: lv.rangeLow,
        plan: a.plan,
        position: a.position,
        fomoLine: a.fomoLine,
        gaussianChannel: a.gauss
          ? { poles: a.gauss.poles, period: a.gauss.period, mult: a.gauss.mult, mid: a.gauss.last.filt, top: a.gauss.last.h, bottom: a.gauss.last.l, slope: a.gauss.slope, zInFilteredTrueRanges: a.gauss.z, zone: a.gauss.zone, barsSinceTopBandCross: a.gauss.sinceTopCross }
          : null,
      });
      out.analysis.recentSignals = a.signals.map((x) => ({ kind: x.kind, utc: new Date(x.t * 1000).toISOString().slice(11, 16), level: sig(x.price) }));
      const bars = L.bars || [];
      const pack = (b) => [b.t, sig(b.o), sig(b.h), sig(b.l), sig(b.c), Math.round(b.v || 0)];
      out.candles = { columns: ['unix', 'open', 'high', 'low', 'close', 'volume'], resolution: out.resolution, last80: bars.slice(-80).map(pack) };
      if (L.resSec < 900 && bars.length > 100) out.candles.last48at15m = E.aggregate(bars, 900).slice(-48).map(pack);
    }
    return out;
  }

  const chatState = {};
  async function sendChat(text) {
    const tok = pageToken();
    if (!tok || !text) return;
    const key = rkey(tok);
    const th = (chatState[key] = chatState[key] || { messages: [], busy: false });
    if (th.busy) return;
    th.messages.push({ role: 'user', text });
    th.busy = true;
    P.chatRender(th);
    const history = th.messages.slice(0, -1).filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text }));
    const res = await ext('chat', { snapshot: snapshot(), history, question: text }, 180000);
    th.busy = false;
    if (res && res.ok) th.messages.push({ role: 'assistant', text: res.reply || '(empty answer)', costUsd: res.costUsd, ms: res.ms, free: !!res.free, left: res.left });
    else th.messages.push({ role: 'assistant', error: true, needsSetup: !!(res && (res.needsSetup || res.soon)), text: (res && res.error) || 'The assistant failed.' });
    const now = pageToken();
    if (now && rkey(now) === key) P.chatRender(th);
  }

  // ---------------------------------------------------------------- trending capture: FOMO's own Trending list, as the app fetches it
  // Only what the page already loaded (the endpoint refuses requests without the session). Rank over time is what
  // shows which tokens get pushed into the list and what they had in common.
  let lastTrendAt = 0;
  NET.on((rec) => {
    if (!/\/proxy\/trendingTokens$/.test(rec.path) || Date.now() - lastTrendAt < 20000) return;
    const ro = rec.json && (rec.json.responseObject !== undefined ? rec.json.responseObject : rec.json);
    const list = Array.isArray(ro) ? ro : ro && typeof ro === 'object' ? Object.values(ro).find(Array.isArray) : null;
    if (!Array.isArray(list) || !list.length) return;
    lastTrendAt = Date.now();
    const n = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
    const rows = list.slice(0, 60).map((r, i) => {
      const t = r.token || {};
      return { r: i + 1, c: n(t.networkId !== undefined ? t.networkId : r.networkId), a: t.address || r.tokenAddress || null, s: t.symbol || r.symbol || null, mc: n(r.marketCap), liq: n(r.liquidity), v24: n(r.volume24), ch24: n(r.change24), h: n(r.holders), born: n(r.createdAt), lp: t.launchpad || null };
    });
    ext('trending:snap', { at: lastTrendAt, rows }, 20000);
  });

  // ---------------------------------------------------------------- journal capture: closed trades the page loads go to extension storage
  const sentTrades = new Set();
  NET.on((rec) => {
    if (!/\/trades(\/[0-9a-f-]{36})?$/.test(rec.path)) return;
    const ro = rec.json && rec.json.responseObject;
    if (!ro) return;
    const items = [];
    if (Array.isArray(ro.closedTrades)) items.push(...ro.closedTrades);
    if (ro.trade) items.push(ro);
    const fresh = items
      .filter((t) => t && t.trade && t.trade.closedAt && t.trade.id)
      .map((t) => ({ trade: t.trade, swaps: Array.isArray(t.swaps) ? t.swaps : [] }))
      .filter((t) => !sentTrades.has(t.trade.id + ':' + t.swaps.length));
    if (!fresh.length) return;
    fresh.forEach((t) => sentTrades.add(t.trade.id + ':' + t.swaps.length));
    const rules = { maxPositionUsd: settings.maxPositionUsd, protectAfter: settings.protectAfter, takeHalfAt: settings.takeHalfAt, emergencyStop: settings.emergencyStop };
    ext('journal:add', { trades: fresh, rules }, 30000);
  });

  // Gaussian settings from the panel, kept inside sane bounds (poles 1-9, period 2+, multiplier above 0).
  function gaussOpts() {
    const n = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
    return { period: Math.max(2, n(settings.gaussPeriod, 144)), poles: Math.min(9, Math.max(1, Math.round(n(settings.gaussPoles, 4)))), mult: n(settings.gaussMult, 1.414) };
  }

  // ---------------------------------------------------------------- main loop
  const resLabel = (chart) => {
    const r = String(chart.resolution());
    if (/^\d+$/.test(r)) return +r >= 60 && +r % 60 === 0 ? +r / 60 + 'h' : r + 'm';
    return r;
  };

  async function run() {
    if (st.running) {
      st.again = true;
      return;
    }
    st.running = true;
    try {
      const tok = pageToken();
      traderCard();
      if (!tok) {
        P.show(false);
        if (st.chart) TV.clear(st.chart);
        st.drawKey = '';
        if (OV) {
          OV.header([]);
          OV.buyHeat(null);
          callState.tok = null;
          paintCall();
        }
        return;
      }
      P.mount();
      P.show(true);
      const api = TV.api();
      if (api !== st.api) {
        if (st.unsub) st.unsub();
        st.api = api;
        st.chart = TV.chart(api);
        st.drawKey = '';
        st.unsub = st.chart ? TV.onChange(st.chart, () => schedule(400)) : null;
      }
      const tokenKey = tok.chain + ':' + tok.address;
      if (tokenKey !== st.tokenKey) {
        st.tokenKey = tokenKey;
        st.drawKey = '';
        if (st.chart) TV.clear(st.chart);
        P.chatRender(chatState[rkey(tok)] || null);
        st.tokenSince = Date.now();
      }
      const stats = tokenStats(tok);
      const flow = flowStats();
      const risk = tokenRisk(stats, tok, flow, pageLinks());
      requestHolders(tok, holderFacts(stats, risk, flow));
      const openPanel = () => {
        P.show(true);
        P.expand();
      };
      if (!st.chart) {
        P.render({ symbol: symbolFromTitle(), error: 'Waiting for the chart…', risk, discipline: discipline(null, risk), rundown: rundownState[rkey(tok)] || null, holderData: holderState[rkey(tok)] || null });
        if (OV) OV.header(headerItems(risk, null, holderState[rkey(tok)]), openPanel);
        return;
      }
      st.monoReport = TV.mono(st.chart, settings.candleColors);
      const bars = await TV.bars(st.chart);
      const resSec = TV.resolutionSec(st.chart);
      // Chart may be in Price or MCap units; convert the USD entry into chart units.
      let scale = 1;
      const lastClose = bars.length ? bars[bars.length - 1].c : null;
      if (lastClose && stats.priceUSD && stats.priceUSD > 0) {
        const ratio = lastClose / stats.priceUSD;
        if (ratio > 2 || ratio < 0.5) scale = stats.marketCap && stats.priceUSD ? stats.marketCap / stats.priceUSD : ratio;
      }
      const held = positionEntry(tok);
      const entryUsd = held ? held.price : null;
      const analysis = E.analyze(bars, resSec, {
        entry: entryUsd ? entryUsd * scale : null,
        openedAt: held && held.openedAt ? held.openedAt / 1000 : null,
        position: { protectAfter: settings.protectAfter, protectLock: 0, takeHalfAt: settings.takeHalfAt, emergencyStop: settings.emergencyStop },
        gauss: gaussOpts(),
      });
      if (analysis.ok && analysis.position && held && held.openedAt) analysis.position.ageH = (Date.now() - held.openedAt) / 3600000;
      const disc = discipline(analysis, risk);
      st.lastWarnings = disc.items.filter((i) => i.level === 'bad').map((i) => i.text);
      Object.assign(callState, { tok, heat: analysis.ok ? analysis.chase.heat : null, symbol: symbolFromTitle() });
      paintCall();
      P.render({ symbol: symbolFromTitle(), resLabel: resLabel(st.chart), analysis, risk, flow, discipline: disc, rundown: rundownState[rkey(tok)] || null, holders: holdersSummary(tok), holderData: holderState[rkey(tok)] || null, call: callState.me });
      buyGuard(st.lastWarnings);
      if (OV) {
        OV.buyHeat(analysis.ok ? analysis.chase.heat : null);
        OV.header(headerItems(risk, analysis, holderState[rkey(tok)]), openPanel);
      }
      if (analysis.ok) await draw(st.chart, analysis, tok, { scale, bars, gm: holderState[rkey(tok)] });
      st.last = { tok, stats, risk, flow, analysis, entryUsd, scale, bars, resSec, disc };
    } catch (e) {
      P.render({ error: 'MOFO error: ' + (e && e.message ? e.message : e) });
    } finally {
      st.running = false;
      if (st.again) {
        st.again = false;
        schedule(300);
      }
    }
  }

  function schedule(ms) {
    clearTimeout(st.timer);
    st.timer = setTimeout(run, ms);
  }

  NET.on((rec) => {
    if (/\/trades|\/hodlers|\/proxy\/filterTokens|tokenWarnings/.test(rec.path)) schedule(500);
  });
  setInterval(run, 4000);
  // List rows re-render as FOMO updates prices, so the vote badges are re-attached on a short timer.
  if (OV) setInterval(() => {
    OV.listVotes(listVote);
    askListVotes();
  }, 1500);
  let lastPath = location.pathname;
  setInterval(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      schedule(800);
    }
  }, 700);
  root.FCCopilot = { run, state: st, draw };
  P.onRundown = requestRundown;
  P.onOpenSettings = () => ext('open:options', {}, 10000);
  P.onOpenJournal = () => ext('open:journal', {}, 10000);
  P.onOpenCalls = () => ext('open:calls', {}, 10000);
  P.onBoard = () => ext('open:calls', { tab: 'board' }, 10000);
  P.onChat = sendChat;
  P.onHoldersRefresh = () => {
    const tok = pageToken();
    if (!tok) return;
    const L = st.last && st.last.tok && rkey(st.last.tok) === rkey(tok) ? st.last : null;
    requestHolders(tok, L ? holderFacts(L.stats, L.risk, L.flow) : {}, true);
  };
  P.onChatClear = () => {
    const tok = pageToken();
    if (!tok) return;
    delete chatState[rkey(tok)];
    P.chatRender(null);
  };
  schedule(1500);
})(window);
