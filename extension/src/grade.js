/* MOFO: trade journal grading. Pure functions (no DOM, no network) so they can be tested with node.
   Input: FOMO's closed trade record ({trade, swaps}) plus USD candles covering the trade.
   The rule replay is the same one the default rules were backtested with (2026-09-12). */
(function (root) {
  'use strict';
  const G = {};

  G.defaults = { maxPositionUsd: 500, protectAfter: 0.25, takeHalfAt: 0.5, emergencyStop: 0.6, friction: 0.03 };

  const pct = (x) => (x === null || x === undefined || !Number.isFinite(x) ? '–' : (x >= 0 ? '+' : '') + Math.round(x * 100) + '%');
  const usd = (x) => (x === null || x === undefined || !Number.isFinite(x) ? '–' : (x < 0 ? '-$' : '$') + Math.round(Math.abs(x)).toLocaleString('en-US'));
  G.fmt = { pct, usd };

  // FOMO swap -> buy/sell fill for this trade's token.
  G.fills = function (trade, swaps) {
    const tok = String(trade.tokenAddress || '').toLowerCase();
    const out = [];
    for (const s of swaps || []) {
      const t = Date.parse(s.createdAt) / 1000;
      if (!Number.isFinite(t)) continue;
      const fee = Number(s.platformFeeHumanAmount) || 0;
      if (String(s.outTokenAddress || '').toLowerCase() === tok) out.push({ t, side: 'B', usd: Number(s.humanUsdAmountIn) || 0, qty: Number(s.outHumanAmount) || 0, fee });
      else if (String(s.inTokenAddress || '').toLowerCase() === tok) out.push({ t, side: 'S', usd: Number(s.humanUsdAmountOut) || 0, qty: Number(s.inHumanAmount) || 0, fee });
    }
    return out.sort((a, b) => a.t - b.t);
  };

  // Replays the position rules on the candles the trade was open for. A rule can only exit earlier than the real exit.
  G.replay = function (held, entry, cost, actualPnl, rules) {
    const realMult = cost ? (cost + actualPnl) / cost : 1;
    let left = 1;
    let got = 0;
    let armed = false;
    const ev = { armed: false, backToEntry: false, halfHit: false, emergencyHit: false };
    for (const c of held) {
      if (!armed && rules.emergencyStop > 0 && c.l <= entry * (1 - rules.emergencyStop)) {
        ev.emergencyHit = true;
        got += left * (1 - rules.emergencyStop) * (1 - rules.friction);
        left = 0;
        break;
      }
      if (armed && c.l <= entry) {
        ev.backToEntry = true;
        got += left * (1 - rules.friction);
        left = 0;
        break;
      }
      if (left === 1 && c.h >= entry * (1 + rules.takeHalfAt)) {
        ev.halfHit = true;
        got += 0.5 * (1 + rules.takeHalfAt) * (1 - rules.friction);
        left = 0.5;
      }
      if (c.h >= entry * (1 + rules.protectAfter)) {
        armed = true;
        ev.armed = true;
      }
    }
    got += left * realMult;
    return { pnl: cost * (got - 1), events: ev };
  };

  G.grade = function (rec, bars, rulesIn) {
    const rules = Object.assign({}, G.defaults, rulesIn || {});
    const trade = rec.trade;
    const fills = G.fills(trade, rec.swaps);
    const buys = fills.filter((f) => f.side === 'B');
    const sells = fills.filter((f) => f.side === 'S');
    const cost = Number(trade.totalCostBasis) || buys.reduce((s, f) => s + f.usd, 0);
    const pnl = Number(trade.realizedPnlUsd) || 0;
    const entry = Number(trade.avgEntryPrice) || null;
    const exit = Number(trade.avgExitPrice) || null;
    const tOpen = buys.length ? buys[0].t : Date.parse(trade.createdAt) / 1000;
    const tClose = Date.parse(trade.closedAt) / 1000;
    const r = {
      id: trade.id,
      symbol: (trade.tokenMetadata && trade.tokenMetadata.symbol) || '?',
      networkId: trade.networkId,
      token: trade.tokenAddress,
      tOpen,
      tClose,
      holdH: (tClose - tOpen) / 3600,
      cost,
      pnl,
      pnlPct: cost ? pnl / cost : null,
      buys: buys.length,
      sells: sells.length,
      fees: fills.reduce((s, f) => s + f.fee, 0),
      checks: [],
      score: 100,
      priced: false,
    };
    const check = (id, ok, text, penalty, impactUsd) => {
      r.checks.push({ id, ok, text, impactUsd: impactUsd === undefined ? null : impactUsd });
      if (!ok) r.score -= penalty;
    };

    check('size', cost <= rules.maxPositionUsd, cost <= rules.maxPositionUsd ? `Size ${usd(cost)} within your max` : `Size ${usd(cost)} is above your max ${usd(rules.maxPositionUsd)}`, 15);

    let q = 0;
    let c = 0;
    let down = 0;
    for (const b of buys) {
      const px = b.qty ? b.usd / b.qty : null;
      if (q && px && px < (c / q) * 0.97) down++;
      q += b.qty;
      c += b.usd;
    }
    if (buys.length) check('avgdown', down === 0, down === 0 ? 'No averaging down' : `Averaged down ${down}× (bought more below your average)`, 20);

    if (Array.isArray(bars) && bars.length >= 20 && entry) {
      r.priced = true;
      const lastAtOrBefore = (t) => {
        let best = null;
        for (const b of bars) {
          if (b.t <= t) best = b;
          else break;
        }
        return best;
      };
      const p0 = lastAtOrBefore(tOpen);
      const p15 = lastAtOrBefore(tOpen - 900);
      const p60 = lastAtOrBefore(tOpen - 3600);
      r.runup15 = p0 && p15 ? p0.c / p15.c - 1 : null;
      r.runup60 = p0 && p60 ? p0.c / p60.c - 1 : null;
      const chased = (r.runup60 !== null && r.runup60 >= 1) || (r.runup15 !== null && r.runup15 >= 0.3);
      if (r.runup15 !== null || r.runup60 !== null) {
        check('chase', !chased, chased ? `Bought after a ${pct(r.runup60 !== null && r.runup60 >= 1 ? r.runup60 : r.runup15)} run-up (chasing)` : 'Entry was not a chase', 20);
      }

      const held = bars.filter((b) => b.t >= tOpen && b.t <= tClose);
      if (held.length) {
        let peak = -Infinity;
        let low = Infinity;
        for (const b of held) {
          peak = Math.max(peak, b.h);
          low = Math.min(low, b.l);
        }
        r.mfe = peak / entry - 1;
        r.mae = low / entry - 1;
        if (exit && peak > entry) r.exitCapture = (exit - entry) / (peak - entry);
        const sim = G.replay(held, entry, cost, pnl, rules);
        r.rulesPnl = sim.pnl;
        r.rulesDelta = sim.pnl - pnl;
        const ev = sim.events;
        if (ev.armed) {
          const kept = exit !== null && exit >= entry * (1 - rules.friction);
          check('protect', kept, kept ? `Was up ${pct(r.mfe)} and did not let it turn into a loss` : `Was up ${pct(r.mfe)} and closed at ${pct(r.pnlPct)}: breakeven rule broken`, 25, kept ? null : sim.pnl - pnl);
        }
        // Needs the individual sells, which FOMO only sends when the trade is opened on the profile.
        if (ev.halfHit && rec.swaps && rec.swaps.length) {
          const tookHalf = sells.some((s) => s.qty > 0 && s.usd / s.qty >= entry * (1 + rules.takeHalfAt) * 0.95);
          check('half', tookHalf, tookHalf ? `Took profit above ${pct(rules.takeHalfAt)}` : `Reached ${pct(rules.takeHalfAt)} but never sold into it`, 15);
        }
        if (ev.emergencyHit) {
          const cut = r.pnlPct !== null && r.pnlPct >= -(rules.emergencyStop + 0.1);
          check('emergency', cut, cut ? 'Got out around the emergency stop' : `Held through the ${pct(-rules.emergencyStop)} emergency stop to ${pct(r.pnlPct)}`, 20, cut ? null : sim.pnl - pnl);
        }
      }
      const after = bars.filter((b) => b.t > tClose && b.t <= tClose + 86400);
      if (after.length && exit) {
        r.afterMax = Math.max(...after.map((b) => b.h)) / exit - 1;
        r.afterMin = Math.min(...after.map((b) => b.l)) / exit - 1;
      }
    }
    if (r.holdH > 24 && r.pnl < 0) check('bag', false, `Held ${Math.round(r.holdH)}h and closed red`, 10);
    r.score = Math.max(0, r.score);
    r.grade = r.score >= 85 ? 'A' : r.score >= 70 ? 'B' : r.score >= 55 ? 'C' : r.score >= 40 ? 'D' : 'F';
    return r;
  };

  // Monday-based weeks, newest first.
  G.weekly = function (graded) {
    const weeks = new Map();
    for (const g of graded) {
      const d = new Date(g.tClose * 1000);
      const day = (d.getUTCDay() + 6) % 7;
      const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
      const key = monday.toISOString().slice(0, 10);
      const w = weeks.get(key) || { week: key, trades: 0, wins: 0, pnl: 0, cost: 0, score: 0, broken: 0, checks: 0, rulesDelta: 0, priced: 0 };
      w.trades++;
      w.wins += g.pnl > 0 ? 1 : 0;
      w.pnl += g.pnl;
      w.cost += g.cost;
      w.score += g.score;
      for (const ch of g.checks) {
        w.checks++;
        if (!ch.ok) w.broken++;
      }
      if (Number.isFinite(g.rulesDelta)) {
        w.rulesDelta += g.rulesDelta;
        w.priced++;
      }
      weeks.set(key, w);
    }
    return [...weeks.values()]
      .map((w) => Object.assign(w, { winRate: w.trades ? w.wins / w.trades : null, avgScore: w.trades ? w.score / w.trades : null, rulesKept: w.checks ? 1 - w.broken / w.checks : null }))
      .sort((a, b) => (a.week < b.week ? 1 : -1));
  };

  root.FCGrade = G;
  if (typeof module !== 'undefined' && module.exports) module.exports = G;
})(typeof window !== 'undefined' ? window : globalThis);
