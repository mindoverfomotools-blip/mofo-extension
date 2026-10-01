/* MOFO: a fomo trader's last 30 days, worked out from fomo's own swap history.
   Measured 2026-10-01: fomo traders' trades never show up on-chain in the wallets their profile lists (no transactions
   at all), so no wallet-data provider can see them. fomo keeps every swap, and every swap goes through USDC on Solana:
   USDC in is a buy, USDC out is a sell, both with exact dollar amounts. Pure functions; main.js does the fetching. */
(function (root) {
  'use strict';
  const T = {};
  const CASH = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC on Solana
  T.CASH = CASH;
  T.DAYS = 30;
  const NET_LABEL = { 1399811149: 'Solana', 8453: 'Base', 56: 'BNB', 1: 'Ethereum', 4663: 'Robinhood', 143: 'Monad' };
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const median = (a) => {
    const v = a.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
    if (!v.length) return null;
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  };

  // swaps: fomo's /v2/users/{id}/swaps rows, any order. Returns null when nothing was traded in the window.
  T.stats = function (swaps, nowMs, days) {
    const span = (days || T.DAYS) * 86400e3;
    const from = nowMs - span;
    const pos = new Map();
    let buys = 0;
    let sells = 0;
    let volumeUsd = 0;
    const buySizes = [];
    const byNet = {};
    for (const s of swaps || []) {
      const t = Date.parse(s.createdAt);
      if (!(t >= from)) continue;
      const isBuy = s.inTokenAddress === CASH && s.outTokenAddress !== CASH;
      const isSell = s.outTokenAddress === CASH && s.inTokenAddress !== CASH;
      if (!isBuy && !isSell) continue;
      const net = String(isBuy ? s.outNetworkId : s.inNetworkId);
      const key = net + ':' + String(isBuy ? s.outTokenAddress : s.inTokenAddress).toLowerCase();
      const p = pos.get(key) || { net, cost: 0, qtyIn: 0, proceeds: 0, qtyOut: 0, firstBuy: null, lastSell: null };
      const usd = num(isBuy ? s.inHumanAmount : s.outHumanAmount) || 0;
      const qty = num(isBuy ? s.outHumanAmount : s.inHumanAmount) || 0;
      if (isBuy) {
        buys++;
        p.cost += usd;
        p.qtyIn += qty;
        p.firstBuy = p.firstBuy === null ? t : Math.min(p.firstBuy, t);
        buySizes.push(usd);
      } else {
        sells++;
        p.proceeds += usd;
        p.qtyOut += qty;
        p.lastSell = p.lastSell === null ? t : Math.max(p.lastSell, t);
      }
      volumeUsd += usd;
      byNet[net] = (byNet[net] || 0) + usd;
      pos.set(key, p);
    }
    if (!buys && !sells) return null;
    // Profit only on tokens bought inside the window (a sell of something bought earlier has no known cost here),
    // on the part that was sold, at the average cost.
    let realizedUsd = 0;
    let closed = 0;
    let wins = 0;
    let x2to5 = 0;
    let over5x = 0;
    const holds = [];
    for (const p of pos.values()) {
      if (!(p.qtyIn > 0) || !(p.qtyOut > 0) || !(p.cost > 0)) continue;
      const sold = Math.min(p.qtyOut, p.qtyIn);
      const pnl = p.proceeds * (sold / p.qtyOut) - p.cost * (sold / p.qtyIn);
      realizedUsd += pnl;
      if (p.qtyOut >= 0.9 * p.qtyIn) {
        closed++;
        if (pnl > 0) wins++;
        const mult = (p.proceeds * (sold / p.qtyOut)) / (p.cost * (sold / p.qtyIn));
        if (mult >= 5) over5x++;
        else if (mult >= 2) x2to5++;
        if (p.firstBuy !== null && p.lastSell !== null && p.lastSell >= p.firstBuy) holds.push((p.lastSell - p.firstBuy) / 1000);
      }
    }
    const chains = Object.entries(byNet)
      .sort((a, b) => b[1] - a[1])
      .map(([net, usd]) => ({ net, label: NET_LABEL[net] || 'Other', share: volumeUsd > 0 ? usd / volumeUsd : 0 }));
    return {
      swaps: buys + sells,
      buys,
      sells,
      tokens: [...pos.values()].filter((p) => p.qtyIn > 0).length,
      closed,
      winrate: closed ? wins / closed : null,
      realizedUsd,
      evPerTokenUsd: closed ? realizedUsd / closed : null,
      avgHoldSec: median(holds),
      medianBuyUsd: median(buySizes),
      volumeUsd,
      perDay: (buys + sells) / (span / 86400e3),
      buckets: { x2to5, over5x },
      chains,
    };
  };

  // The same style rules as holder wallets (research/PLAYBOOK.md), on fomo's own numbers.
  T.style = function (st) {
    if (!st || st.closed < 5) return { label: 'Few closed trades', hold: null };
    const moons = st.buckets.x2to5 + st.buckets.over5x;
    let label = 'Mixed';
    if (st.realizedUsd < 0) label = 'Losing trader';
    else if (st.winrate !== null && st.winrate < 0.4) label = 'Moon catcher';
    else if (st.winrate !== null && st.winrate >= 0.55) label = moons > 0 ? 'Sharp' : 'Profit taker';
    const hold = st.avgHoldSec === null ? null : st.avgHoldSec < 3600 ? 'Scalper' : st.avgHoldSec > 86400 ? 'Holder' : 'Intraday';
    return { label, hold };
  };

  // How far back the pages read so far reach, 0 to 1, and the seconds left at the pace so far.
  T.progress = function (oldestMs, startedMs, nowMs, days) {
    const span = (days || T.DAYS) * 86400e3;
    const f = oldestMs ? Math.max(0, Math.min(1, (nowMs - oldestMs) / span)) : 0;
    const elapsed = (nowMs - startedMs) / 1000;
    const left = f > 0.03 && f < 1 ? Math.max(1, Math.ceil((elapsed * (1 - f)) / f)) : null;
    return { f, left };
  };

  root.FCTrades = T;
})(typeof window !== 'undefined' ? window : globalThis);
