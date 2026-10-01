/* MOFO: USD candles around a trade from GeckoTerminal (free, all FOMO chains).
   fetchJson is injected so the same code runs in the extension and in node tests. */
(function (root) {
  'use strict';
  const P = {};

  // FOMO networkId (Codex ids) -> GeckoTerminal network slug. Seen on FOMO: 1399811149, 56, 8453, 4663.
  P.GT_NET = { 1399811149: 'solana', 56: 'bsc', 8453: 'base', 1: 'eth', 143: 'monad', 4663: 'robinhood' };

  P.pickAggregate = function (fromSec, toSec) {
    const span = toSec - fromSec;
    if (span <= 300 * 990) return { tf: 'minute', agg: 5, sec: 300 };
    if (span <= 900 * 990) return { tf: 'minute', agg: 15, sec: 900 };
    if (span <= 3600 * 990) return { tf: 'hour', agg: 1, sec: 3600 };
    return { tf: 'hour', agg: 4, sec: 14400 };
  };

  // The deepest pool that already existed when the trade opened; otherwise the deepest pool overall.
  P.pickPool = function (pools, tOpen) {
    const list = pools.filter((p) => p.addr).map((p) => Object.assign({}, p, { createdSec: p.created ? Date.parse(p.created) / 1000 : null }));
    const existed = list.filter((p) => p.createdSec === null || p.createdSec <= tOpen + 60);
    return (existed.length ? existed : list).sort((a, b) => b.reserve - a.reserve)[0] || null;
  };

  P.candles = async function (fetchJson, networkId, token, tOpen, tClose, nowSec) {
    const net = P.GT_NET[networkId];
    if (!net) return { error: 'price data not supported for network ' + networkId };
    const pj = await fetchJson(`https://api.geckoterminal.com/api/v2/networks/${net}/tokens/${encodeURIComponent(token)}/pools?page=1`);
    const pools = ((pj && pj.data) || []).map((d) => {
      const a = d.attributes || {};
      return { addr: a.address, created: a.pool_created_at, reserve: Number(a.reserve_in_usd) || 0 };
    });
    const pool = P.pickPool(pools, tOpen);
    if (!pool) return { error: 'no trading pool found' };
    const from = tOpen - 7200;
    const to = Math.floor(Math.min(tClose + 86400, nowSec));
    const a = P.pickAggregate(from, to);
    const url = `https://api.geckoterminal.com/api/v2/networks/${net}/pools/${pool.addr}/ohlcv/${a.tf}?aggregate=${a.agg}&before_timestamp=${to}&limit=1000&currency=usd&token=${encodeURIComponent(token)}`;
    const cj = await fetchJson(url);
    const rows = (((cj && cj.data) || {}).attributes || {}).ohlcv_list || [];
    const bars = rows
      .map((r) => ({ t: Number(r[0]), o: Number(r[1]), h: Number(r[2]), l: Number(r[3]), c: Number(r[4]), v: Number(r[5]) }))
      .filter((b) => b.t >= from && Number.isFinite(b.c))
      .sort((x, y) => x.t - y.t);
    return { bars, pool: pool.addr, aggSec: a.sec };
  };

  root.FCPrices = P;
  if (typeof module !== 'undefined' && module.exports) module.exports = P;
})(typeof window !== 'undefined' ? window : globalThis);
