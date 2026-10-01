/* MOFO: holder intelligence. Turns the holder-data API's top holders (/v1/market/token_top_holders) and wallet stats
   (/v1/user/wallet_stats, 30d) into per-holder profiles, style labels and token-level warnings.
   Pure functions, no network; loaded by the background worker and by node tests. */
(function (root) {
  'use strict';
  const H = {};

  const num = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const lower = (a) => (Array.isArray(a) ? a.map((x) => String(x).toLowerCase()) : []);

  H.CHAIN = { solana: 'sol', sol: 'sol', base: 'base', bnb: 'bsc', bsc: 'bsc', ethereum: 'eth', eth: 'eth', robinhood: 'robinhood' };
  H.PLATFORMS = ['fomo', 'axiom', 'photon', 'bullx', 'trojan', 'padre', 'pepeboost', 'bonkbot', 'maestro', 'banana', 'nova', 'bloom'];

  // Thresholds from research/02-pro-playbooks.md and 03-safety-signals.md (prac/tool), the rest are ours (own).
  H.LIMITS = { bundledSerious: 15, bundledInsiders: 30, clusterSerious: 15, clusterInsiders: 30, oneWallet: 15, sniperCount: 3, insiderHigh: 10, insiderSome: 3, freshDays: 7, minTokensForStyle: 5, botTokens: 300 };

  // One row of token_top_holders.
  H.holderRow = function (r, nowSec) {
    const tags = lower(r.tags);
    const tokenTags = lower(r.maker_token_tags);
    const created = num(r.created_at);
    const ageDays = created && created > 0 ? (nowSec - created) / 86400 : null;
    const roles = [];
    if (tokenTags.includes('rat_trader')) roles.push('insider');
    if (tokenTags.includes('dev') || tokenTags.includes('creator') || tags.includes('dev')) roles.push('dev');
    if (tokenTags.includes('bundler')) roles.push('bundler');
    if (tokenTags.includes('sniper')) roles.push('sniper');
    if (tags.includes('fresh_wallet') || r.is_new === true || (ageDays !== null && ageDays < H.LIMITS.freshDays)) roles.push('fresh');
    if (tags.includes('smart_degen')) roles.push('smart');
    if (tags.includes('renowned') || tags.includes('kol')) roles.push('kol');
    if (tags.includes('fomo')) roles.push('fomo');
    const start = num(r.start_holding_at);
    return {
      address: String(r.address || ''),
      pct: (num(r.amount_percentage) || 0) * 100,
      usd: num(r.usd_value),
      isPool: Number(r.addr_type) === 2,
      exchange: r.exchange || null,
      tokenPnlUsd: num(r.profit),
      realizedUsd: num(r.realized_profit),
      unrealizedUsd: num(r.unrealized_profit),
      costUsd: num(r.total_cost),
      avgCostUsd: num(r.avg_cost),
      soldPct: num(r.sell_amount_percentage) !== null ? num(r.sell_amount_percentage) * 100 : null,
      sinceMin: start ? Math.max(0, (nowSec - start) / 60) : null,
      startAt: start || null,
      transferIn: !!r.transfer_in,
      platform: H.PLATFORMS.find((p) => tags.includes(p)) || null,
      roles,
      funder: r.native_transfer && r.native_transfer.address ? String(r.native_transfer.address) : null,
      walletAgeDays: ageDays,
      twitter: r.twitter_username || null,
      name: r.name || null,
    };
  };

  // One row of wallet_stats (period 30d). Numbers arrive as strings in places.
  H.statsRow = function (s) {
    const ps = s.pnl_stat || {};
    const c = s.common || {};
    const realized = num(s.realized_profit);
    const tokens = num(ps.token_num);
    return {
      address: String(s.wallet_address || c.wallet_address || ''),
      winrate: num(ps.winrate) !== null ? num(ps.winrate) : num(s.winrate),
      tokens,
      realizedUsd: realized,
      evPerTokenUsd: realized !== null && tokens ? realized / tokens : null,
      avgHoldSec: num(ps.avg_holding_period),
      buckets: { below50: num(ps.pnl_lt_nd5_num), loss: num(ps.pnl_nd5_0x_num), upTo2x: num(ps.pnl_0x_2x_num), x2to5: num(ps.pnl_2x_5x_num), over5x: num(ps.pnl_gt_5x_num) },
      funder: c.fund_from_address || null,
      funderLabel: c.fund_from || null,
      walletCreated: num(c.created_at),
      twitter: c.twitter_username || null,
      followers: num(c.followers_count) || num(c.twitter_fans_num),
      createdTokens: num(c.created_token_count),
      tags: lower(c.tags),
    };
  };

  // Style labels are our own rules (research/PLAYBOOK.md, Tier 2), shown as such in the panel.
  H.style = function (st) {
    if (!st || st.tokens === null || st.tokens < H.LIMITS.minTokensForStyle) return { label: 'Few trades', hold: null, bot: false };
    const moons = (st.buckets.x2to5 || 0) + (st.buckets.over5x || 0);
    let label = 'Mixed';
    if (st.realizedUsd !== null && st.realizedUsd < 0) label = 'Losing trader';
    else if (st.winrate !== null && st.winrate < 0.4 && (st.realizedUsd || 0) > 0) label = 'Moon catcher';
    else if (st.winrate !== null && st.winrate >= 0.55 && (st.realizedUsd || 0) > 0) label = moons > 0 ? 'Sharp' : 'Profit taker';
    const hold = st.avgHoldSec === null ? null : st.avgHoldSec < 3600 ? 'Scalper' : st.avgHoldSec > 86400 ? 'Holder' : 'Intraday';
    return { label, hold, bot: st.tokens >= H.LIMITS.botTokens };
  };

  const median = (a) => {
    const v = a.filter((x) => x !== null && Number.isFinite(x)).sort((x, y) => x - y);
    if (!v.length) return null;
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  };

  // holders: raw token_top_holders list; statsList: raw wallet_stats rows for some of those wallets.
  H.summarize = function (holders, statsList, nowSec) {
    const all = (holders || []).map((r) => H.holderRow(r, nowSec));
    const pools = all.filter((x) => x.isPool);
    const rows = all.filter((x) => !x.isPool).sort((a, b) => b.pct - a.pct).slice(0, 20);
    const byAddr = new Map((statsList || []).map((s) => H.statsRow(s)).filter((s) => s.address).map((s) => [s.address.toLowerCase(), s]));
    for (const r of rows) {
      const st = byAddr.get(r.address.toLowerCase()) || null;
      r.stats = st;
      r.style = st ? H.style(st) : null;
      if (!r.funder && st && st.funder) r.funder = st.funder;
      if (r.walletAgeDays === null && st && st.walletCreated) r.walletAgeDays = (nowSec - st.walletCreated) / 86400;
      if (st && st.tags.includes('smart_degen') && !r.roles.includes('smart')) r.roles.push('smart');
    }

    const ROLE_KEYS = ['insider', 'dev', 'bundler', 'sniper', 'fresh', 'smart', 'kol', 'fomo'];
    const supply = {};
    const counts = {};
    for (const k of ROLE_KEYS) {
      const hit = rows.filter((r) => r.roles.includes(k));
      supply[k] = hit.reduce((s, r) => s + r.pct, 0);
      counts[k] = hit.length;
    }

    const groups = new Map();
    for (const r of rows) if (r.funder) groups.set(r.funder, (groups.get(r.funder) || []).concat(r));
    const clusters = [...groups.entries()]
      .filter(([, g]) => g.length >= 2)
      .map(([funder, g]) => ({ funder, wallets: g.length, pct: g.reduce((s, r) => s + r.pct, 0) }))
      .sort((a, b) => b.pct - a.pct);

    const withStats = rows.filter((r) => r.stats && r.stats.tokens !== null);
    const styled = withStats.filter((r) => r.style && r.style.label !== 'Few trades');
    const countLabel = (l) => styled.filter((r) => r.style.label === l).length;
    const topWalletPct = rows.length ? rows[0].pct : 0;
    const top10Pct = rows.slice(0, 10).reduce((s, r) => s + r.pct, 0);

    const L = H.LIMITS;
    const warnings = [];
    const warn = (text, level, ev) => warnings.push({ text, level, ev });
    const pct = (x) => (x >= 10 ? x.toFixed(0) : x.toFixed(1)) + '%';
    if (supply.bundler > L.bundledInsiders) warn(`Bundled wallets hold ${pct(supply.bundler)} of supply: over 30% means insiders control it`, 'bad', 'prac');
    else if (supply.bundler > L.bundledSerious) warn(`Bundled wallets hold ${pct(supply.bundler)} of supply (over 15% is serious)`, 'warn', 'prac');
    if (clusters.length && clusters[0].pct > L.clusterInsiders) warn(`${clusters[0].wallets} top holders share one funder and hold ${pct(clusters[0].pct)}`, 'bad', 'prac');
    else if (clusters.length && clusters[0].pct > L.clusterSerious) warn(`${clusters[0].wallets} top holders share one funder and hold ${pct(clusters[0].pct)}`, 'warn', 'prac');
    if (supply.insider >= L.insiderHigh) warn(`Insider-tagged wallets hold ${pct(supply.insider)}`, 'bad', 'own');
    else if (supply.insider >= L.insiderSome) warn(`Insider-tagged wallets hold ${pct(supply.insider)}`, 'warn', 'own');
    if (topWalletPct >= L.oneWallet) warn(`One wallet holds ${pct(topWalletPct)} of supply`, 'warn', 'prac');
    if (counts.sniper >= L.sniperCount) warn(`${counts.sniper} snipers among the top holders (${pct(supply.sniper)})`, 'warn', 'tool');
    if (counts.dev) warn(`The dev wallet still holds ${pct(supply.dev)}`, 'warn', 'tool');
    if (counts.kol) warn(`${counts.kol} KOL wallet${counts.kol > 1 ? 's' : ''} in: 80% of KOL-promoted coins lost 70%+ within a week`, 'warn', 'data');
    if (counts.smart) warn(`${counts.smart} smart-money wallet${counts.smart > 1 ? 's hold' : ' holds'} ${pct(supply.smart)}. They show up in most tokens, so on its own this is not a buy signal`, 'info', 'data');
    if (styled.length >= 4 && countLabel('Losing trader') > styled.length / 2) warn(`${countLabel('Losing trader')} of ${styled.length} profiled holders lost money over 30 days`, 'info', 'own');

    const components = {
      holdersRows: rows.length,
      poolPct: pools.reduce((s, r) => s + r.pct, 0),
      top10Pct,
      topWalletPct,
      insiderPct: supply.insider,
      devPct: supply.dev,
      bundlerPct: supply.bundler,
      sniperPct: supply.sniper,
      freshPct: supply.fresh,
      smartPct: supply.smart,
      kolPct: supply.kol,
      fomoPct: supply.fomo,
      sniperN: counts.sniper,
      smartN: counts.smart,
      kolN: counts.kol,
      fomoN: counts.fomo,
      clusterMaxPct: clusters.length ? clusters[0].pct : 0,
      clusterN: clusters.length,
      profiled: styled.length,
      medianWinrate: median(styled.map((r) => r.stats.winrate)),
      medianEvPerToken: median(styled.map((r) => r.stats.evPerTokenUsd)),
      profitableN: styled.filter((r) => (r.stats.realizedUsd || 0) > 0).length,
      losingN: countLabel('Losing trader'),
      moonN: countLabel('Moon catcher'),
      takerN: countLabel('Profit taker'),
      sharpN: countLabel('Sharp'),
      scalperN: styled.filter((r) => r.style.hold === 'Scalper').length,
      botN: styled.filter((r) => r.style.bot).length,
      inProfitOnTokenN: rows.filter((r) => (r.tokenPnlUsd || 0) > 0).length,
    };

    return { rows, pools: pools.length, supply, counts, clusters: clusters.slice(0, 3), warnings, components };
  };

  // Price path after a snapshot taken at t0 (unix seconds), from candles covering t0-2h .. t0+24h.
  H.outcome = function (bars, t0) {
    const list = bars || [];
    const before = list.filter((b) => b.t <= t0);
    const after = list.filter((b) => b.t > t0 && b.t <= t0 + 86400);
    const ref = before.length ? before[before.length - 1].c : after.length ? after[0].o : null;
    if (!ref || !after.length) return { error: 'no trades after the snapshot (dead token or missing price data)' };
    const closeBy = (sec) => {
      const w = after.filter((b) => b.t <= t0 + sec);
      return w.length ? w[w.length - 1].c / ref - 1 : null;
    };
    let hi = -Infinity;
    let lo = Infinity;
    for (const b of after) {
      if (b.h > hi) hi = b.h;
      if (b.l < lo) lo = b.l;
    }
    return { ref, ret1h: closeBy(3600), ret4h: closeBy(14400), ret24h: closeBy(86400), maxUp24h: hi / ref - 1, maxDown24h: lo / ref - 1, bars: after.length, lastBarT: after[after.length - 1].t };
  };

  // Vote features. One place for the names, so the offline fit (fit/features.js) and the extension compute the same
  // numbers. Missing values stay null; the model fills them with its training median.
  const chainDummies = (chain) => ({ chain_sol: chain === 'sol' ? 1 : 0, chain_bsc: chain === 'bsc' ? 1 : 0 });

  // Token page: the holder-profile components plus the page's market cap, liquidity and age.
  H.deepFeatures = function (components, facts, chain) {
    const f = facts || {};
    return Object.assign({}, components || {}, chainDummies(chain), { f_mcap: num(f.marketCapUsd), f_liq: num(f.liquidityUsd), f_age: num(f.ageMin) });
  };

  // Token lists: the holder mix from the token info endpoint (stat + wallet_tags_stat), one call per token.
  H.listFeatures = function (info, nowSec, chain) {
    if (!info || typeof info !== 'object') return null;
    const st = info.stat || {};
    const wt = info.wallet_tags_stat || {};
    const lk = info.link || info.links || {};
    const price = num(info.price && typeof info.price === 'object' ? info.price.price : info.price);
    const supply = num(info.circulating_supply) || num(info.total_supply);
    const born = num(info.creation_timestamp) || num(info.open_timestamp);
    return Object.assign(chainDummies(chain), {
      i_holders: num(info.holder_count) !== null ? num(info.holder_count) : num(st.holder_count),
      i_top10: num(st.top_10_holder_rate),
      i_bundler: num(st.top_bundler_trader_percentage),
      i_rat: num(st.top_rat_trader_percentage),
      i_entrap: num(st.top_entrapment_trader_percentage),
      i_botRate: num(st.bot_degen_rate),
      i_fresh: num(st.fresh_wallet_rate),
      i_devTeam: num(st.dev_team_hold_rate),
      i_creatorHold: num(st.creator_hold_rate),
      i_sniperHold: num(st.top70_sniper_hold_rate),
      i_creatorCreated: num(st.creator_created_count),
      i_smartN: num(wt.smart_wallets),
      i_freshN: num(wt.fresh_wallets),
      i_kolN: num(wt.renowned_wallets),
      i_sniperN: num(wt.sniper_wallets),
      i_ratN: num(wt.rat_trader_wallets),
      i_bundlerN: num(wt.bundler_wallets),
      i_links: ['website', 'twitter_username', 'telegram', 'discord'].filter((k) => !!lk[k]).length,
      f_mcap: price !== null && supply !== null ? price * supply : null,
      f_liq: num(info.liquidity),
      f_age: born && nowSec ? Math.round((nowSec - born) / 60) : null,
    });
  };

  // Which wallets to profile: the biggest non-pool holders.
  H.walletsToProfile = function (holders, limit) {
    return (holders || [])
      .filter((r) => Number(r.addr_type) !== 2 && r.address)
      .sort((a, b) => (num(b.amount_percentage) || 0) - (num(a.amount_percentage) || 0))
      .slice(0, limit)
      .map((r) => String(r.address));
  };

  root.FCHolders = H;
  if (typeof module !== 'undefined' && module.exports) module.exports = H;
})(typeof self !== 'undefined' ? self : this);
