/* MOFO: chart analysis engine. Rules only; no network, no DOM.
   Input bars: [{t, o, h, l, c, v}] oldest to newest, t in seconds.
   Scale-free (ATR multiples and percentages), so it works on the Price or the MCap chart. */
(function (root) {
  'use strict';
  const E = {};
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

  E.defaults = {
    chase: { extremeAtr: 4, hotAtr: 2.5, extreme15m: 0.6, hot15m: 0.3, hot60m: 1.0 },
    // Backtested on real closed trades (2026-09-12): fixed -25..-50% stops made results worse (winners dip ~33% first);
    // breakeven after +25%, half off at +50% and a -60% emergency stop made them better.
    position: { protectAfter: 0.25, protectLock: 0, takeHalfAt: 0.5, emergencyStop: 0.6, trailAfter: 1.0, trailAtr: 3 },
  };

  E.ema = function (xs, n) {
    const out = new Array(xs.length);
    const k = 2 / (n + 1);
    let prev = xs[0];
    for (let i = 0; i < xs.length; i++) {
      prev = i === 0 ? xs[0] : xs[i] * k + prev * (1 - k);
      out[i] = prev;
    }
    return out;
  };

  // Wilder ATR
  E.atr = function (bars, n = 14) {
    const out = new Array(bars.length);
    let a = 0;
    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];
      const tr = i === 0 ? b.h - b.l : Math.max(b.h - b.l, Math.abs(b.h - bars[i - 1].c), Math.abs(b.l - bars[i - 1].c));
      a = i < n ? (a * i + tr) / (i + 1) : (a * (n - 1) + tr) / n;
      out[i] = a;
    }
    return out;
  };

  // Wilder RSI
  E.rsi = function (closes, n = 14) {
    const out = new Array(closes.length).fill(50);
    let g = 0;
    let l = 0;
    for (let i = 1; i < closes.length; i++) {
      const d = closes[i] - closes[i - 1];
      const up = Math.max(d, 0);
      const dn = Math.max(-d, 0);
      if (i <= n) {
        g += up / n;
        l += dn / n;
      } else {
        g = (g * (n - 1) + up) / n;
        l = (l * (n - 1) + dn) / n;
      }
      out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
    }
    return out;
  };

  E.aggregate = function (bars, bucketSec) {
    const out = [];
    for (const b of bars) {
      const t = Math.floor(b.t / bucketSec) * bucketSec;
      const o = out[out.length - 1];
      if (o && o.t === t) {
        o.h = Math.max(o.h, b.h);
        o.l = Math.min(o.l, b.l);
        o.c = b.c;
        o.v += b.v || 0;
      } else {
        out.push({ t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v || 0 });
      }
    }
    return out;
  };

  // Fractal swing points: a bar whose high (low) is the extreme of the k bars either side.
  E.pivots = function (bars, k) {
    const out = [];
    for (let i = k; i < bars.length - k; i++) {
      let isH = true;
      let isL = true;
      for (let j = i - k; j <= i + k && (isH || isL); j++) {
        if (j === i) continue;
        if (bars[j].h > bars[i].h || (j < i && bars[j].h === bars[i].h)) isH = false;
        if (bars[j].l < bars[i].l || (j < i && bars[j].l === bars[i].l)) isL = false;
      }
      if (isH) out.push({ i, t: bars[i].t, price: bars[i].h, kind: 'H' });
      if (isL) out.push({ i, t: bars[i].t, price: bars[i].l, kind: 'L' });
    }
    return out;
  };

  // Support/resistance zones: swing points clustered within max(0.6 ATR, 0.6%), weighted by recency and volume.
  E.levels = function (bars, atrNow, opts) {
    opts = opts || {};
    const n = bars.length;
    const close = bars[n - 1].c;
    const k = opts.pivotK || clamp(Math.round(n / 160), 3, 8);
    const piv = E.pivots(bars, k);
    const vols = bars.map((b) => b.v || 0).filter((v) => v > 0).sort((a, b) => a - b);
    const medVol = vols.length ? vols[Math.floor(vols.length / 2)] : 0;
    const tol = Math.max(0.6 * atrNow, 0.006 * close);
    const clusters = [];
    for (const p of piv.slice().sort((a, b) => a.price - b.price)) {
      const c = clusters[clusters.length - 1];
      if (c && Math.abs(p.price - c.mean) <= tol) {
        c.pts.push(p);
        c.mean = c.pts.reduce((s, x) => s + x.price, 0) / c.pts.length;
      } else {
        clusters.push({ pts: [p], mean: p.price });
      }
    }
    const zones = clusters
      .filter((c) => c.pts.length >= 2)
      .map((c) => {
        const prices = c.pts.map((p) => p.price);
        let score = 0;
        for (const p of c.pts) {
          const recency = 0.4 + 0.6 * (p.i / (n - 1));
          const vol = medVol ? clamp((bars[p.i].v || 0) / medVol, 0.5, 3) : 1;
          score += recency * (0.7 + 0.3 * vol);
        }
        return {
          lo: Math.min(...prices) - 0.15 * atrNow,
          hi: Math.max(...prices) + 0.15 * atrNow,
          mid: c.mean,
          touches: c.pts.length,
          score,
          firstT: Math.min(...c.pts.map((p) => p.t)),
        };
      });
    const pick = (arr) => {
      if (!arr.length) return [];
      const scores = arr.map((z) => z.score).sort((a, b) => a - b);
      const med = scores[Math.floor(scores.length / 2)];
      return arr.filter((z) => z.score >= med * 0.8).slice(0, opts.maxPerSide || 2);
    };
    const supports = pick(zones.filter((z) => z.mid < close).sort((a, b) => b.mid - a.mid));
    const resistances = pick(zones.filter((z) => z.mid > close).sort((a, b) => a.mid - b.mid));
    let rangeHigh = -Infinity;
    let rangeLow = Infinity;
    for (const b of bars) {
      if (b.h > rangeHigh) rangeHigh = b.h;
      if (b.l < rangeLow) rangeLow = b.l;
    }
    return { supports, resistances, rangeHigh, rangeLow, tol, pivotK: k, pivots: piv };
  };

  E.trend = function (bars, piv) {
    const closes = bars.map((b) => b.c);
    const n = bars.length;
    const e9 = E.ema(closes, 9);
    const e21 = E.ema(closes, 21);
    const e50 = E.ema(closes, 50);
    const atrNow = E.atr(bars, 14)[n - 1] || 1e-12;
    const back = Math.min(10, n - 1);
    const slope = (e21[n - 1] - e21[n - 1 - back]) / atrNow;
    const H = piv.filter((p) => p.kind === 'H').slice(-2);
    const L = piv.filter((p) => p.kind === 'L').slice(-2);
    let structure = 'mixed';
    if (H.length === 2 && L.length === 2) {
      if (H[1].price > H[0].price && L[1].price > L[0].price) structure = 'up';
      else if (H[1].price < H[0].price && L[1].price < L[0].price) structure = 'down';
    }
    const c = closes[n - 1];
    const ext = (c - e21[n - 1]) / atrNow;
    let state = 'range';
    // A strong slope outranks a stale swing structure: a token down 6 ATR below its EMA21 is falling, whatever the last two pivots said.
    if (c > e21[n - 1] && e9[n - 1] > e21[n - 1] && (slope > 1 || (slope > 0.15 && structure !== 'down'))) state = 'up';
    else if (c < e21[n - 1] && e9[n - 1] < e21[n - 1] && (slope < -1 || ext < -3 || (slope < -0.15 && structure !== 'up'))) state = 'down';
    return { state, structure, slope, e9: e9[n - 1], e21: e21[n - 1], e50: e50[n - 1], atr: atrNow };
  };

  // How stretched is price right now? The anti-FOMO check before a buy.
  E.chase = function (bars, resSec, tr, lv, cfg) {
    const n = bars.length;
    const c = bars[n - 1].c;
    const change = (minutes) => {
      const k = Math.max(1, Math.round((minutes * 60) / resSec));
      return n - 1 - k >= 0 ? c / bars[n - 1 - k].c - 1 : null;
    };
    const rsi = E.rsi(bars.map((b) => b.c), 14)[n - 1];
    const ext = (c - tr.e21) / tr.atr;
    const ch5 = change(5);
    const ch15 = change(15);
    const ch60 = change(60);
    let heat = 'calm';
    if (ext >= cfg.extremeAtr || rsi >= 85 || (ch15 !== null && ch15 >= cfg.extreme15m)) heat = 'extreme';
    else if (ext >= cfg.hotAtr || rsi >= 75 || (ch15 !== null && ch15 >= cfg.hot15m) || (ch60 !== null && ch60 >= cfg.hot60m)) heat = 'hot';
    else if (ext >= 1.2 || rsi >= 65) heat = 'warm';
    const r = lv.resistances[0];
    const s = lv.supports[0];
    return { heat, ch5, ch15, ch60, rsi, ext, toResPct: r ? r.lo / c - 1 : null, toSupPct: s ? s.hi / c - 1 : null };
  };

  // Where a buy makes sense, where it is wrong (stop), and where to take profit.
  E.plan = function (bars, tr, lv) {
    const c = bars[bars.length - 1].c;
    const A = tr.atr;
    const R1 = lv.resistances[0];
    const R2 = lv.resistances[1];
    const out = { bias: tr.state, buyZone: null, breakout: null, reclaim: null, takeProfit: lv.resistances.map((z) => ({ lo: z.lo, hi: z.hi })) };
    if (tr.state !== 'down') {
      let zone = lv.supports.find((z) => c - z.hi <= 4 * A);
      if (!zone && tr.e21 < c) zone = { lo: tr.e21 - 0.3 * A, hi: tr.e21 + 0.3 * A, mid: tr.e21, touches: 0, ema: true };
      if (zone) {
        const stop = zone.lo - 0.5 * A;
        const entry = Math.min(zone.hi, c);
        const t1 = R1 ? R1.lo : entry + 2.5 * A;
        const t2 = R2 ? R2.lo : t1 + 2.5 * A;
        const risk = entry - stop;
        const rr = risk > 0 ? (t1 - entry) / risk : 0;
        out.buyZone = { lo: zone.lo, hi: zone.hi, stop, t1, t2, rr, fromEma: !!zone.ema, valid: rr >= 1.5, inZone: c >= zone.lo && c <= zone.hi };
      }
      if (R1 && tr.state === 'up' && R1.lo - c <= A) out.breakout = { trigger: R1.hi, stop: R1.lo - 0.5 * A };
    } else if (R1) {
      out.reclaim = { level: R1.hi };
    }
    return out;
  };

  // Plan for a position already held, from the user's average entry (in chart units).
  // openedAtSec lets the engine see the best price since the buy; without it only the current price counts.
  E.position = function (bars, tr, lv, entry, rules, openedAtSec) {
    const n = bars.length;
    const c = bars[n - 1].c;
    const A = tr.atr;
    let hh = null;
    if (openedAtSec) {
      for (const b of bars) if (b.t >= openedAtSec - 60) hh = hh === null ? b.h : Math.max(hh, b.h);
    }
    const peak = hh === null ? c : Math.max(hh, c);
    const armed = peak >= entry * (1 + rules.protectAfter);
    const protectStop = armed ? entry * (1 + rules.protectLock) : null;
    const emergency = rules.emergencyStop > 0 ? entry * (1 - rules.emergencyStop) : null;
    const stop = armed ? protectStop : emergency;
    const takeHalf = entry * (1 + rules.takeHalfAt);
    const trail = peak >= entry * (1 + rules.trailAfter) ? Math.max(protectStop || 0, peak - rules.trailAtr * A) : null;
    let status = 'ok';
    if (armed && c <= protectStop) status = 'protect';
    else if (!armed && emergency !== null && c <= emergency) status = 'emergency';
    else if (trail !== null && c <= trail) status = 'trail';
    else if (c >= takeHalf) status = 'takehalf';
    else if (armed) status = 'armed';
    return {
      entry,
      stop,
      stopKind: armed ? 'breakeven' : emergency !== null ? 'emergency' : 'none',
      armed,
      peak,
      peakKnown: hh !== null,
      peakPnl: peak / entry - 1,
      takeHalf,
      trail,
      pnl: c / entry - 1,
      status,
      distStopPct: stop ? stop / c - 1 : null,
    };
  };

  // Recent chart events, for markers. Levels come from the whole window, so treat these as annotations, not a backtest.
  E.signals = function (bars, tr, lv, maxN) {
    maxN = maxN || 6;
    const n = bars.length;
    const rsi = E.rsi(bars.map((b) => b.c), 14);
    const out = [];
    const zones = lv.resistances.concat(lv.supports);
    const atr = E.atr(bars, 14);
    for (let i = Math.max(21, n - 150); i < n; i++) {
      const b = bars[i];
      const p = bars[i - 1];
      const rng = b.h - b.l || 1e-12;
      let vs = 0;
      for (let j = i - 20; j < i; j++) vs += bars[j].v || 0;
      const vr = vs ? (b.v || 0) / (vs / 20) : 1;
      const buf = 0.25 * atr[i];
      for (const z of zones) {
        // Only clean crosses: close clears the zone by a quarter ATR on real volume, having been inside or beyond it one bar earlier.
        if (p.c <= z.hi && b.c > z.hi + buf && vr >= 2) out.push({ i, t: b.t, price: b.l, kind: 'Breakout', up: true });
        if (p.c >= z.lo && b.c < z.lo - buf && vr >= 1.5) out.push({ i, t: b.t, price: b.h, kind: 'Breakdown', up: false });
      }
      const upWick = b.h - Math.max(b.o, b.c);
      const dnWick = Math.min(b.o, b.c) - b.l;
      if (rsi[i] >= 80 && upWick / rng >= 0.5 && vr >= 2) out.push({ i, t: b.t, price: b.h, kind: 'Exhaustion', up: false });
      if (rsi[i] <= 25 && dnWick / rng >= 0.5 && vr >= 2) out.push({ i, t: b.t, price: b.l, kind: 'Capitulation', up: true });
    }
    const seen = new Set();
    const keep = [];
    for (let j = out.length - 1; j >= 0 && keep.length < maxN; j--) {
      const key = out[j].i + out[j].kind;
      if (!seen.has(key)) {
        seen.add(key);
        keep.push(out[j]);
      }
    }
    return keep.reverse();
  };

  // ---------------------------------------------------------------- Gaussian channel
  // Port of DonovanWall's "Gaussian Channel [DW]": an Ehlers Gaussian filter with N poles on hlc3, and the same
  // filter on true range for the band width. f[n] = a^N s[n] + sum_k (-1)^(k+1) C(N,k) (1-a)^k f[n-k].
  E.gaussDefaults = { poles: 4, period: 144, mult: 1.414, lagReduce: false, fast: false };

  E.binom = function (n, k) {
    let r = 1;
    for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
    return Math.round(r);
  };

  E.gaussAlpha = function (period, poles) {
    const beta = (1 - Math.cos((2 * Math.PI) / period)) / (Math.pow(1.414, 2 / poles) - 1);
    return -beta + Math.sqrt(beta * beta + 2 * beta);
  };

  // History before the first bar is seeded with the first value (seed: 0 reproduces Pine's nz()).
  E.gaussFilter = function (src, alpha, poles, seed) {
    const n = src.length;
    const out = new Array(n);
    if (!n) return out;
    const x = 1 - alpha;
    const aN = Math.pow(alpha, poles);
    const coef = [0];
    for (let k = 1; k <= poles; k++) coef.push((k % 2 ? 1 : -1) * E.binom(poles, k) * Math.pow(x, k));
    const s0 = seed === undefined ? src[0] : seed;
    for (let i = 0; i < n; i++) {
      let f = aN * src[i];
      for (let k = 1; k <= poles; k++) f += coef[k] * (i - k >= 0 ? out[i - k] : s0);
      out[i] = f;
    }
    return out;
  };

  E.gaussian = function (bars, opts) {
    const o = Object.assign({}, E.gaussDefaults, opts);
    const poles = clamp(Math.round(o.poles), 1, 9);
    const period = Math.max(2, o.period);
    const n = bars.length;
    if (n < 3) return null;
    const alpha = E.gaussAlpha(period, poles);
    const src = bars.map((b) => (b.h + b.l + b.c) / 3);
    const tr = bars.map((b, i) => (i === 0 ? b.h - b.l : Math.max(b.h - b.l, Math.abs(b.h - bars[i - 1].c), Math.abs(b.l - bars[i - 1].c))));
    const lag = Math.floor((period - 1) / (2 * poles));
    const reduce = (xs) => (o.lagReduce ? xs.map((v, i) => v + (v - xs[Math.max(0, i - lag)])) : xs);
    const s = reduce(src);
    const t = reduce(tr);
    const pick = (xs) => {
      const fN = E.gaussFilter(xs, alpha, poles);
      if (!o.fast) return fN;
      const f1 = E.gaussFilter(xs, alpha, 1);
      return fN.map((v, i) => (v + f1[i]) / 2);
    };
    const filt = pick(s);
    const filttr = pick(t);
    const hband = filt.map((v, i) => v + filttr[i] * o.mult);
    const lband = filt.map((v, i) => v - filttr[i] * o.mult);
    const c = bars[n - 1].c;
    const f = filt[n - 1];
    const h = hband[n - 1];
    const l = lband[n - 1];
    const w = filttr[n - 1];
    let since = null;
    for (let i = n - 1; i >= 1; i--) {
      if (bars[i].c > hband[i] && bars[i - 1].c <= hband[i - 1]) {
        since = n - 1 - i;
        break;
      }
    }
    return {
      poles,
      period,
      mult: o.mult,
      t: bars.map((b) => b.t),
      filt,
      hband,
      lband,
      filttr,
      last: { filt: f, h, l, tr: w },
      slope: filt[n - 1] >= filt[n - 2] ? 'rising' : 'falling',
      z: w > 0 ? (c - f) / w : 0,
      zone: c > h ? 'above' : c >= f ? 'upper' : c >= l ? 'lower' : 'below',
      sinceTopCross: since,
    };
  };

  E.analyze = function (barsIn, resSec, opts) {
    opts = opts || {};
    const bars = barsIn.filter((b) => Number.isFinite(b.c) && b.h >= b.l && b.c > 0).slice(-(opts.maxBars || 2000));
    if (bars.length < 60) return { ok: false, reason: 'Not enough candles yet (' + bars.length + ')' };
    const atrNow = E.atr(bars, 14)[bars.length - 1];
    const lv = E.levels(bars, atrNow, opts.levels);
    const tr = E.trend(bars, lv.pivots);
    let htf = null;
    if (resSec < 900 && bars.length >= 300) {
      const hb = E.aggregate(bars, 900);
      if (hb.length >= 40) htf = E.trend(hb, E.pivots(hb, 3)).state;
    }
    const chase = E.chase(bars, resSec, tr, lv, Object.assign({}, E.defaults.chase, opts.chase));
    const plan = E.plan(bars, tr, lv);
    const signals = E.signals(bars, tr, lv);
    const position = opts.entry ? E.position(bars, tr, lv, opts.entry, Object.assign({}, E.defaults.position, opts.position), opts.openedAt) : null;
    const gauss = E.gaussian(bars, opts.gauss);
    // Where entry heat turns HOT / EXTREME at the current EMA21 and ATR: the price above which a buy is chasing.
    const cc = Object.assign({}, E.defaults.chase, opts.chase);
    const fomoLine = { hot: tr.e21 + cc.hotAtr * tr.atr, extreme: tr.e21 + cc.extremeAtr * tr.atr };
    return { ok: true, n: bars.length, last: bars[bars.length - 1], resSec, atr: atrNow, levels: lv, trend: tr, htf, chase, plan, signals, position, gauss, fomoLine };
  };

  root.FCEngine = E;
  if (typeof module !== 'undefined' && module.exports) module.exports = E;
})(typeof window !== 'undefined' ? window : globalThis);
