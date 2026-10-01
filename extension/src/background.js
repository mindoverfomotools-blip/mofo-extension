/* MOFO: background service worker. Runs the rapid rundown, the chat assistant, holder profiles and the trade journal.
   Two ways to pay for the AI and holder data:
   - the free MOFO service (default): requests go to the MOFO proxy, which holds the project's keys and runs the
     prompts itself, with daily limits per install. The proxy's address comes from mindoverfomo.tools, so it can be
     switched on or moved without a new version of the extension;
   - the user's own keys (optional, in settings): requests go straight to Claude, twitterapi.io and the holder-data API. */
'use strict';
importScripts('ai-core.js', 'grade.js', 'prices.js', 'holders.js', 'score-model.js');
// Direct holder-data access with your own key: only in the owner's copy (the public build leaves the file out).
try {
  importScripts('holder-direct.js');
} catch (e) {}
const DIRECT = globalThis.FCHolderDirect || null;
// Own API keys (Claude, twitterapi.io, holder data) are a power-user option. The Chrome Web Store build turns it off:
// everything then goes through the free MOFO service and the extension asks for fewer permissions.
const OWN_KEYS = false;

const RUNDOWN_TTL_MS = 30 * 60 * 1000;
const CONFIG_URL = 'https://mindoverfomo.tools/ext-config.json';
const CONFIG_TTL_MS = 30 * 60 * 1000;

async function settings() {
  const s = await chrome.storage.local.get(['anthropicKey', 'twitterKey', 'model', 'maxSearches', 'holderKey', 'notes']);
  if (!OWN_KEYS) return { anthropicKey: '', twitterKey: '', model: FCAI.DEFAULT_MODEL, maxSearches: 2, holderKey: '', notes: s.notes || '' };
  return { anthropicKey: s.anthropicKey || '', twitterKey: s.twitterKey || '', model: s.model || FCAI.DEFAULT_MODEL, maxSearches: Number(s.maxSearches) || 2, holderKey: DIRECT ? s.holderKey || '' : '', notes: s.notes || '' };
}

// Keys saved by older versions under the old name move to holderKey once.
if (DIRECT && DIRECT.legacyKey) {
  chrome.storage.local.get([DIRECT.legacyKey, 'holderKey']).then((o) => {
    if (o[DIRECT.legacyKey] && !o.holderKey) chrome.storage.local.set({ holderKey: o[DIRECT.legacyKey] });
    if (o[DIRECT.legacyKey] !== undefined) chrome.storage.local.remove(DIRECT.legacyKey);
  });
}

// A random id for this install, sent to the proxy so its daily limits are per install. Nothing else identifies the user.
async function installId() {
  const got = (await chrome.storage.local.get('installId')).installId;
  if (got) return got;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ installId: id });
  return id;
}

// Where the free service lives. null means it isn't switched on yet.
let configMem = null;
async function proxyBase() {
  if (configMem && Date.now() - configMem.at < CONFIG_TTL_MS) return configMem.proxy;
  const stored = (await chrome.storage.local.get('extConfig')).extConfig;
  if (stored && Date.now() - stored.at < CONFIG_TTL_MS) {
    configMem = stored;
    return stored.proxy;
  }
  try {
    const r = await fetch(CONFIG_URL, { cache: 'no-store' });
    const j = r.ok ? await r.json() : {};
    const proxy = typeof j.proxy === 'string' && /^https:\/\//.test(j.proxy) ? j.proxy.replace(/\/+$/, '') : null;
    const game = typeof j.game === 'string' && /^https:\/\//.test(j.game) ? j.game.replace(/\/+$/, '') : null;
    configMem = { at: Date.now(), proxy, game };
    await chrome.storage.local.set({ extConfig: configMem });
    return proxy;
  } catch (e) {
    return stored ? stored.proxy : null;
  }
}

const SOON = 'The free MOFO AI switches on soon. Until then you can add your own keys in MOFO settings.';

async function proxyCall(path, { method = 'GET', body = null, params = null } = {}) {
  const base = await proxyBase();
  if (!base) return { ok: false, soon: true, error: SOON };
  const url = base + path + (params ? '?' + new URLSearchParams(params).toString() : '');
  const r = await fetch(url, {
    method,
    headers: Object.assign({ 'X-MOFO-Install': await installId(), 'X-MOFO-Version': chrome.runtime.getManifest().version }, body ? { 'content-type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null;
  try {
    j = await r.json();
  } catch (e) {}
  if (!j) return { ok: false, error: `MOFO service HTTP ${r.status}` };
  return j;
}

// ---------------------------------------------------------------- rapid rundown
// The rundown is the token's story only: what it is, what the name means, where it came from, any utility.
// Risk is covered by the panel's own sections.
async function rundown(token, force) {
  const s = await settings();
  const cacheKey = 'rundown2:' + token.chain + ':' + String(token.address).toLowerCase();
  // An answer that came back cut off or wrapped (older versions, or the service's cache) is read again leniently.
  const reread = (r) => {
    if (r && !r.rundown && r.raw) {
      const p = FCAI.parseRundown(r.raw);
      if (p) Object.assign(r, { rundown: p, raw: null });
    }
    return r;
  };
  if (!force) {
    const c = reread((await chrome.storage.local.get(cacheKey))[cacheKey]);
    if (c && c.rundown && Date.now() - c.at < RUNDOWN_TTL_MS) return Object.assign({ ok: true, cached: true }, c);
  }
  let result;
  // The narrative runs on the MOFO service whenever it is up (it can open the token's website, which a browser
  // extension can't without asking for every site); own keys are the fallback.
  if (s.anthropicKey && !(await proxyBase())) {
    result = await FCAI.rundown(token, { anthropicKey: s.anthropicKey, twitterKey: s.twitterKey, model: s.model, maxSearches: s.maxSearches });
  } else {
    const res = await proxyCall('/v1/rundown', { method: 'POST', body: { token: FCAI.cleanToken(token), force: !!force } });
    if (!res.ok) return Object.assign({ ok: false }, res);
    result = res.result;
    result.free = true;
  }
  reread(result);
  if (result.rundown) await chrome.storage.local.set({ [cacheKey]: result }); // a failed answer is never kept
  return Object.assign({ ok: true, cached: false }, result);
}

// ---------------------------------------------------------------- chat assistant
async function chat(payload) {
  const s = await settings();
  // The trader's own notes about their habits, from settings, go to the assistant with the snapshot.
  if (s.notes && payload.snapshot && typeof payload.snapshot === 'object') payload.snapshot.traderProfile = String(s.notes).slice(0, 1500);
  if (s.anthropicKey) {
    const c = await FCAI.chat(payload, { anthropicKey: s.anthropicKey, twitterKey: s.twitterKey, model: s.model });
    if (!c.reply) return { ok: false, error: 'The assistant came back empty, try again.' };
    return Object.assign({ ok: true }, c);
  }
  const res = await proxyCall('/v1/chat', { method: 'POST', body: { snapshot: payload.snapshot || {}, history: (payload.history || []).slice(-12), question: String(payload.question || '').slice(0, 2000) } });
  if (!res.ok) return Object.assign({ ok: false }, res);
  return { ok: true, free: true, reply: res.reply, ms: res.ms, left: res.left };
}

// ---------------------------------------------------------------- holder profiles (the user's key, or the free service)
// Measured 2026-09-12: wallet_stats answers one wallet_address per call (a comma list is rejected, repeated params
// return only the first); back-to-back calls from one IP got HTTP 429 while calls 3 s apart did not. So calls are
// queued 2 s apart, holders are cached 60 s and wallet stats 30 min: a chart open costs one call plus new wallets.
// The provider documents 1 request per second. Calls go 1.1 s apart; after a rate-limit hit, twice that for 10 minutes.
let API_SPACING_MS = 1100;
const SLOW_AFTER_BAN_MS = 10 * 60 * 1000;
const HOLDERS_TTL_MS = 60 * 1000;
const WALLET_TTL_MS = 30 * 60 * 1000;
const WALLET_RETRY_MS = 5 * 60 * 1000;
const PROFILE_WALLETS = 8;
const HOLDER_LOG = 'holders:log'; // v1 log (one array), migrated to v2 entries on first use
const HOLDER_LOG_EVERY_MS = 30 * 60 * 1000;
const NETWORK_ID = { sol: 1399811149, bsc: 56, base: 8453, eth: 1, robinhood: 4663 };
const hapi = { queue: Promise.resolve(), last: 0, bannedUntil: 0, slowUntil: 0 };
const profileJobs = new Map();
const profileErrors = new Map();
const hcache = () => chrome.storage.session || chrome.storage.local;

function holderApi(path, params, key) {
  const run = async () => {
    if (!key) {
      // the free service: the proxy spaces and caches holder calls for everyone, so no client-side spacing needed
      const res = await proxyCall('/v1/holders' + path, { params });
      if (res.ok) return res.data;
      if (res.banned) hapi.bannedUntil = Date.now() + (Number(res.retryIn) || 30) * 1000;
      throw Object.assign(new Error(res.error || 'MOFO service error'), { banned: !!res.banned, soon: !!res.soon, limit: !!res.limit });
    }
    const banned = hapi.bannedUntil - Date.now();
    if (banned > 0) throw Object.assign(new Error(`Holder data rate limit, retry in ${Math.ceil(banned / 1000)}s`), { banned: true });
    const wait = API_SPACING_MS * (hapi.slowUntil > Date.now() ? 2 : 1) - (Date.now() - hapi.last);
    if (wait > 0) await sleep(wait);
    hapi.last = Date.now();
    const q = new URLSearchParams(params);
    q.set('timestamp', String(Math.floor(Date.now() / 1000)));
    q.set('client_id', crypto.randomUUID());
    const r = await fetch(`${DIRECT.host}${path}?${q}`, { headers: { 'X-APIKEY': key } });
    let j = null;
    try {
      j = await r.json();
    } catch (e) {}
    const msg = String((j && (j.message || j.msg || j.error)) || '');
    if (r.status === 429 || (j && Number(j.code) === 429)) {
      const m = msg.match(/(\d+)\s*s(?:ec(?:onds)?)? remaining/);
      hapi.bannedUntil = Date.now() + ((m ? Number(m[1]) : 30) + 5) * 1000;
      hapi.slowUntil = hapi.bannedUntil + SLOW_AFTER_BAN_MS;
      throw Object.assign(new Error(`Holder data rate limit, retry in ${Math.ceil((hapi.bannedUntil - Date.now()) / 1000)}s`), { banned: true });
    }
    if (r.status === 401 || r.status === 403) throw new Error(`The holder-data API refused the request (HTTP ${r.status}). Check the key in settings; it only accepts IPv4 connections.`);
    if (!r.ok) throw new Error(`Holder data HTTP ${r.status}`);
    if (!j || Number(j.code) !== 0) throw new Error('Holder data: ' + (msg || 'unexpected response').slice(0, 160));
    return j.data;
  };
  const p = hapi.queue.then(run);
  hapi.queue = p.catch(() => {});
  return p;
}

function profileWallets(chain, tokenKey, wallets, key) {
  if (profileJobs.has(tokenKey)) return;
  const job = (async () => {
    let error = null;
    const store = hcache();
    for (const w of wallets) {
      const ck = `gw:${chain}:${w}`;
      const c = (await store.get(ck))[ck];
      if (c && Date.now() - c.at < WALLET_TTL_MS) continue;
      try {
        const data = await holderApi('/v1/user/wallet_stats', { chain, wallet_address: w, period: '30d' }, key);
        const row = Array.isArray(data) ? data[0] : data && Array.isArray(data.list) ? data.list[0] : data;
        await store.set({ [ck]: { at: Date.now(), row: row || null } });
      } catch (e) {
        error = e.message;
        if (e.banned || e.soon || e.limit) break;
        await store.set({ [ck]: { at: Date.now() - WALLET_TTL_MS + WALLET_RETRY_MS, row: null, error: e.message } });
      }
    }
    profileErrors.set(tokenKey, error);
  })();
  profileJobs.set(tokenKey, job);
  job.catch(() => {}).then(() => profileJobs.delete(tokenKey));
}

async function holders(payload) {
  const token = (payload && payload.token) || {};
  const s = await settings();
  const chain = FCHolders.CHAIN[String(token.chain || '').toLowerCase()];
  if (!chain) return { ok: false, unsupported: true, error: `No holder profiles for ${token.chain || 'this chain'} yet.` };
  const address = String(token.address || '');
  if (!/^(0x[0-9a-fA-F]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/.test(address)) return { ok: false, error: 'Unrecognized token address.' };
  const tokenKey = `${chain}:${address}`;
  const store = hcache();
  const hk = `gh:${tokenKey}`;
  let cached = (await store.get(hk))[hk] || null;
  let error = null;
  // While wallets are being profiled, keep the cached holder list instead of queueing behind the profile calls.
  if (!profileJobs.has(tokenKey) && (!cached || payload.force || Date.now() - cached.at > HOLDERS_TTL_MS)) {
    try {
      const data = await holderApi('/v1/market/token_top_holders', { chain, address, limit: '40', order_by: 'amount_percentage', direction: 'desc' }, s.holderKey);
      cached = { at: Date.now(), list: Array.isArray(data) ? data : (data && data.list) || [] };
      await store.set({ [hk]: cached });
    } catch (e) {
      error = e.message;
      if (!cached) return { ok: false, error, banned: !!e.banned, soon: !!e.soon, needsSetup: !!e.soon };
    }
  }
  const wallets = FCHolders.walletsToProfile(cached.list, PROFILE_WALLETS);
  const keys = wallets.map((w) => `gw:${chain}:${w}`);
  const got = keys.length ? await store.get(keys) : {};
  const statsRows = [];
  let pending = 0;
  for (const k of keys) {
    const c = got[k];
    if (c && Date.now() - c.at < WALLET_TTL_MS) {
      if (c.row) statsRows.push(c.row);
    } else pending++;
  }
  const bannedFor = Math.max(0, Math.ceil((hapi.bannedUntil - Date.now()) / 1000));
  if (pending && !bannedFor) profileWallets(chain, tokenKey, wallets, s.holderKey);
  const summary = FCHolders.summarize(cached.list, statsRows, Math.floor(Date.now() / 1000));
  // the vote: the same token-info data and model as the list rows, so a token shows one number everywhere
  const vote = await tokenVote(chain, address, s.holderKey);
  const logCount = pending || !summary.rows.length ? holderLogSize : await holderLogAdd(chain, address, token, cached.list, statsRows, summary.components);
  return { ok: true, chain, at: cached.at, pending, profiling: profileJobs.has(tokenKey), bannedFor, error: error || profileErrors.get(tokenKey) || null, summary, logCount, vote };
}

// Votes for token list rows. Each token needs one token-info call, so they run in a low-priority lane: only while no
// token page is being profiled, one at a time through the same spaced queue, newest visible rows first. Cached 10 min.
const INFO_TTL_MS = 10 * 60 * 1000; // refresh after this
const INFO_KEEP_MS = 2 * 3600 * 1000; // show the last vote this long while it refreshes
const INFO_INDEX = 'gi:index';
// Kept in local storage so votes survive a browser restart; an index keeps it to the newest 1,500 tokens.
async function infoGet(keys) {
  return chrome.storage.local.get(keys);
}
async function infoSet(ck, c) {
  const index = (await chrome.storage.local.get(INFO_INDEX))[INFO_INDEX] || {};
  index[ck] = c.at;
  const drop = Object.keys(index)
    .filter((k) => Date.now() - index[k] > INFO_KEEP_MS)
    .concat(Object.keys(index).sort((a, b) => index[b] - index[a]).slice(1500));
  for (const k of drop) delete index[k];
  await chrome.storage.local.set({ [ck]: c, [INFO_INDEX]: index });
  if (drop.length) await chrome.storage.local.remove([...new Set(drop)].filter((k) => k !== ck));
}
const infoKey = (chain, address) => `gi:${chain}:${String(address).toLowerCase()}`;
const voteFromCache = (c, chain) => (c && c.info ? FCScoreModel.listVote(FCHolders.listFeatures(c.info, Math.floor(c.at / 1000), chain), chain) : null);
const trimInfo = (info) => (info && typeof info === 'object' ? { holder_count: info.holder_count, price: info.price && typeof info.price === 'object' ? { price: info.price.price } : info.price, liquidity: info.liquidity, circulating_supply: info.circulating_supply, total_supply: info.total_supply, creation_timestamp: info.creation_timestamp, open_timestamp: info.open_timestamp, stat: info.stat, wallet_tags_stat: info.wallet_tags_stat, link: info.link } : null);

// The open token's vote: from the shared token-info cache, fetched right away (not in the list lane) when missing.
async function tokenVote(chain, address, key) {
  if (!FCScoreModel.chainKey(chain) || !FCScoreModel.fit || !FCScoreModel.fit.list.pct[chain]) return null;
  const ck = infoKey(chain, address);
  let c = (await infoGet(ck))[ck];
  if (!c || Date.now() - c.at >= INFO_TTL_MS) {
    try {
      c = { at: Date.now(), info: trimInfo(await holderApi('/v1/token/info', { chain, address }, key)) };
      await infoSet(ck, c);
    } catch (e) {
      if (!c || Date.now() - c.at >= INFO_KEEP_MS) return null;
    }
  }
  return voteFromCache(c, chain);
}
const listLane = { wanted: [], running: false };
async function listVotes(payload) {
  const items = (Array.isArray(payload && payload.items) ? payload.items : []).slice(0, 60);
  const s = await settings();
  const votes = {};
  const missing = [];
  let unseen = 0;
  const now = Date.now();
  const keyed = items
    .map((it) => ({ chain: FCScoreModel.chainKey(it.chain), address: String(it.address || ''), id: String(it.chain) + ':' + String(it.address || '') }))
    .filter((it) => it.chain && /^(0x[0-9a-fA-F]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/.test(it.address));
  const got = keyed.length ? await infoGet(keyed.map((it) => infoKey(it.chain, it.address))) : {};
  for (const it of keyed) {
    const c = got[infoKey(it.chain, it.address)];
    // a vote up to 2 h old shows at once; after 10 min it is refreshed in the lane
    if (c && now - c.at < INFO_KEEP_MS) votes[it.id] = voteFromCache(c, it.chain);
    else unseen++;
    if (!c || now - c.at >= INFO_TTL_MS) missing.push(it);
  }
  // chains the vote has no data for: answered at once, so the row says so instead of loading forever
  const noVote = items.filter((it) => !FCScoreModel.chainKey(it.chain)).map((it) => String(it.chain) + ':' + String(it.address || ''));
  for (const id of noVote) votes[id] = null;
  listLane.wanted = missing.slice();
  pumpListLane(s.holderKey);
  return { ok: true, votes, noVote, pending: unseen, bannedFor: Math.max(0, Math.ceil((hapi.bannedUntil - Date.now()) / 1000)) };
}

async function pumpListLane(key) {
  if (listLane.running) return;
  listLane.running = true;
  try {
    while (listLane.wanted.length && !profileJobs.size && hapi.bannedUntil <= Date.now()) {
      const it = listLane.wanted.shift();
      const ck = infoKey(it.chain, it.address);
      const c = (await infoGet(ck))[ck];
      if (c && Date.now() - c.at < INFO_TTL_MS) continue;
      try {
        const info = await holderApi('/v1/token/info', { chain: it.chain, address: it.address }, key);
        await infoSet(ck, { at: Date.now(), info: trimInfo(info) });
      } catch (e) {
        if (e.banned || e.soon || e.limit) break;
        // keep a stale vote on a failed refresh; a token never seen gets a short retry marker
        if (!c) await infoSet(ck, { at: Date.now() - INFO_TTL_MS + WALLET_RETRY_MS, info: null });
      }
    }
  } finally {
    listLane.running = false;
  }
}

// ---------------------------------------------------------------- THE CALL (the game server, see game/API.md)
// An account is made on the first call and kept in this browser: an id and a secret, nothing else. The extension
// never touches a wallet.
const GAME_DEFAULT = 'https://api.mindoverfomo.tools/game';
async function gameBase() {
  const dev = (await chrome.storage.local.get('gameBase')).gameBase;
  if (dev) return String(dev).replace(/\/+$/, '');
  await proxyBase();
  return (configMem && configMem.game) || GAME_DEFAULT;
}

async function gameAccount(create) {
  const got = (await chrome.storage.local.get('gameAccount')).gameAccount;
  if (got && got.id && got.secret) return got;
  if (!create) return null;
  const res = await gameFetch('/v1/account', { method: 'POST', body: {} }, null);
  if (!res.ok) throw new Error(res.error || 'Could not join THE CALL.');
  const acc = { id: res.id, secret: res.secret };
  await chrome.storage.local.set({ gameAccount: acc });
  return acc;
}

async function gameFetch(path, { method = 'GET', body = null } = {}, acc) {
  let r;
  try {
    r = await fetch((await gameBase()) + path, {
      method,
      // content-type only with a body: a GET without it needs no CORS preflight
      headers: Object.assign(body ? { 'content-type': 'application/json' } : {}, acc ? { 'X-MOFO-Account': acc.id + ':' + acc.secret } : {}),
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    return { ok: false, offline: true, error: 'THE CALL is offline right now. Try again in a minute.', detail: String((e && e.message) || e) };
  }
  let j = null;
  try {
    j = await r.json();
  } catch (e) {}
  if (!j) return { ok: false, error: `THE CALL server HTTP ${r.status}` };
  if (r.status === 401 && acc) await chrome.storage.local.remove('gameAccount'); // the server forgot us: start fresh next time
  return j;
}

async function gameCall(type, p) {
  p = p || {};
  if (type === 'call:board') return gameFetch('/v1/board');
  if (type === 'call:callers') return gameFetch('/v1/callers?range=' + (['day', 'week', 'all'].includes(p.range) ? p.range : 'day'));
  if (type === 'call:me') {
    const acc = await gameAccount(false);
    return acc ? gameFetch('/v1/me', {}, acc) : { ok: true, joined: false };
  }
  const acc = await gameAccount(true);
  if (type === 'call:join') return gameFetch('/v1/me', {}, acc);
  if (type === 'call:make') return gameFetch('/v1/calls', { method: 'POST', body: { chain: p.chain, address: p.address, side: p.side, heat: p.heat, symbol: p.symbol } }, acc);
  if (type === 'call:list') return gameFetch('/v1/calls?limit=' + (Number(p.limit) || 50), {}, acc);
  if (type === 'call:handle') return gameFetch('/v1/handle', { method: 'POST', body: { handle: p.handle } }, acc);
  if (type === 'call:profile') return gameFetch('/v1/profile', { method: 'POST', body: { handle: p.handle, fomo: p.fomo } }, acc);
  return { ok: false, error: 'unknown' };
}

// Snapshots of FOMO's own Trending list, recorded passively whenever the app fetches it (never polled: the endpoint
// needs the logged-in session). Rank over time is what lets us work out what actually makes a token trend.
const TR_INDEX = 'tr:index';
const TR_SNAP = 'tr:s:';
const TR_MAX = 3000;
const TR_MIN_GAP_MS = 60 * 1000;

async function trendingSnap(payload) {
  const rows = Array.isArray(payload && payload.rows) ? payload.rows.slice(0, 60) : null;
  if (!rows || !rows.length) return { ok: false, error: 'empty snapshot' };
  const at = Number(payload.at) || Date.now();
  const index = (await chrome.storage.local.get(TR_INDEX))[TR_INDEX] || {};
  const head = rows
    .slice(0, 10)
    .map((r) => r.s)
    .join(',');
  const times = Object.keys(index).map(Number).sort((a, b) => a - b);
  const lastT = times.length ? times[times.length - 1] : 0;
  if (lastT && index[String(lastT)] && index[String(lastT)].head === head && at - lastT < TR_MIN_GAP_MS) {
    return { ok: true, stored: false, snapshots: times.length };
  }
  index[String(at)] = { head, n: rows.length };
  const drop = Object.keys(index)
    .sort((a, b) => Number(a) - Number(b))
    .slice(0, Math.max(0, Object.keys(index).length - TR_MAX));
  for (const d of drop) delete index[d];
  await chrome.storage.local.set({ [TR_SNAP + at]: { at, rows }, [TR_INDEX]: index });
  if (drop.length) await chrome.storage.local.remove(drop.map((d) => TR_SNAP + d));
  return { ok: true, stored: true, snapshots: Object.keys(index).length };
}

// The log the 0-100 holder score will be fitted on. Format v2 (the same format as the MOFO collector):
// one storage key per entry plus a small index. An entry keeps the holder rows and wallet stats exactly as the API returned
// them at that moment (stats fetched later would include later trades), the page facts, and after 24h the price path.
const HL_INDEX = 'hl2:index';
const HL_ENTRY = 'hl2:e:';
const HL_MAX = 3000;
const HOLDER_FIELDS = ['address', 'addr_type', 'exchange', 'amount_percentage', 'usd_value', 'profit', 'realized_profit', 'unrealized_profit', 'total_cost', 'avg_cost', 'sell_amount_percentage', 'start_holding_at', 'transfer_in', 'is_new', 'tags', 'maker_token_tags', 'created_at'];
const STATS_COMMON_FIELDS = ['created_at', 'fund_from_address', 'fund_from', 'tags', 'created_token_count', 'followers_count'];

function trimHolderRows(list) {
  return (list || []).slice(0, 25).map((r) => {
    const t = {};
    for (const f of HOLDER_FIELDS) if (r[f] !== undefined) t[f] = r[f];
    if (r.native_transfer && r.native_transfer.address) t.native_transfer = { address: r.native_transfer.address };
    return t;
  });
}
function trimStatsRows(rows) {
  return (rows || []).map((s) => {
    const common = {};
    for (const f of STATS_COMMON_FIELDS) if (s.common && s.common[f] !== undefined) common[f] = s.common[f];
    return { wallet_address: s.wallet_address ?? null, realized_profit: s.realized_profit ?? null, total_cost: s.total_cost ?? null, buy: s.buy ?? null, sell: s.sell ?? null, pnl_stat: s.pnl_stat ?? null, common };
  });
}
const compactBars = (bars) => bars.map((b) => [b.t, b.o, b.h, b.l, b.c].map((x, i) => (i ? Number(Number(x).toPrecision(6)) : x)));

// Reads the index, moving any v1 entries (one array under HOLDER_LOG) into v2 keys first.
async function holderLogIndex() {
  const got = await chrome.storage.local.get([HL_INDEX, HOLDER_LOG]);
  const index = got[HL_INDEX] || {};
  const legacy = got[HOLDER_LOG];
  if (Array.isArray(legacy)) {
    const writes = {};
    for (const e of legacy) {
      const id = `${e.t}-${e.key}`;
      writes[HL_ENTRY + id] = { v: 1, id, source: 'chart', t: e.t, chain: e.chain, networkId: e.networkId, address: e.address, symbol: e.symbol, facts: { priceUsd: e.priceUsd, marketCapUsd: e.marketCapUsd, liquidityUsd: e.liquidityUsd, ageMin: e.ageMin, risk: e.risk, flowNet1hUsd: e.flowNet1hUsd }, holders: null, stats: null, c: e.c, outcome: e.outcome || null };
      index[id] = { k: e.key, t: e.t, o: e.outcome ? (e.outcome.error ? -1 : 1) : 0 };
      if (e.outcome && !e.outcome.error) Object.assign(index[id], { u: e.outcome.maxUp24h, d: e.outcome.maxDown24h });
    }
    writes[HL_INDEX] = index;
    await chrome.storage.local.set(writes);
    await chrome.storage.local.remove(HOLDER_LOG);
  }
  return index;
}

let holderLogSize = null;
const holderLogLast = new Map();
async function holderLogAdd(chain, address, token, holderList, statsRows, components) {
  const addr = /^0x/i.test(address) ? address.toLowerCase() : address;
  const key = `${chain}:${addr}`;
  if (Date.now() - (holderLogLast.get(key) || 0) < HOLDER_LOG_EVERY_MS) return holderLogSize;
  const index = await holderLogIndex();
  holderLogSize = Object.keys(index).length;
  const lastT = Object.values(index).reduce((m, e) => (e.k === key && e.t > m ? e.t : m), 0);
  if (Date.now() - lastT < HOLDER_LOG_EVERY_MS) {
    holderLogLast.set(key, lastT);
    return holderLogSize;
  }
  const f = token.facts || {};
  const n = (v) => (Number.isFinite(v) ? v : null);
  const t = Date.now();
  const id = `${t}-${key}`;
  const entry = {
    v: 2,
    id,
    source: 'chart',
    t,
    chain,
    networkId: NETWORK_ID[chain],
    address: addr,
    symbol: token.symbol ? String(token.symbol).slice(0, 24) : null,
    facts: { priceUsd: n(f.priceUsd), marketCapUsd: n(f.marketCapUsd), liquidityUsd: n(f.liquidityUsd), ageMin: n(f.ageMin), risk: typeof f.risk === 'string' ? f.risk : null, flowNet1hUsd: n(f.flowNet1hUsd) },
    holders: trimHolderRows(holderList),
    stats: trimStatsRows(statsRows),
    c: components,
    outcome: null,
  };
  index[id] = { k: key, t, o: 0 };
  const drop = Object.keys(index)
    .sort((a, b) => index[a].t - index[b].t)
    .slice(0, Math.max(0, Object.keys(index).length - HL_MAX));
  for (const d of drop) delete index[d];
  await chrome.storage.local.set({ [HL_ENTRY + id]: entry, [HL_INDEX]: index });
  if (drop.length) await chrome.storage.local.remove(drop.map((d) => HL_ENTRY + d));
  holderLogLast.set(key, t);
  holderLogSize = Object.keys(index).length;
  return holderLogSize;
}

let scoringHolderLog = false;
async function holderLogOutcomes(limit) {
  if (scoringHolderLog) return { ok: false, error: 'Already filling outcomes, wait a moment.' };
  scoringHolderLog = true;
  try {
    const index = await holderLogIndex();
    const nowSec = Math.floor(Date.now() / 1000);
    const todo = Object.keys(index)
      .filter((id) => !index[id].o && nowSec - index[id].t / 1000 >= 86400)
      .sort((a, b) => index[a].t - index[b].t);
    let scored = 0;
    for (const id of todo.slice(0, limit || 8)) {
      const ek = HL_ENTRY + id;
      const e = (await chrome.storage.local.get(ek))[ek];
      if (!e) continue;
      const t0 = Math.floor(e.t / 1000);
      let outcome;
      try {
        const c = await FCPrices.candles(gtJson, e.networkId, e.address, t0, t0, nowSec);
        outcome = c.error ? { error: c.error } : Object.assign(FCHolders.outcome(c.bars, t0), { pool: c.pool, aggSec: c.aggSec, path: compactBars(c.bars) });
      } catch (err) {
        if (/rate limit|HTTP 5\d\d/.test(err.message)) break;
        outcome = { error: err.message };
      }
      e.outcome = outcome;
      // Re-read the index before writing so entries logged meanwhile are kept.
      const cur = (await chrome.storage.local.get(HL_INDEX))[HL_INDEX] || {};
      if (cur[id]) {
        cur[id].o = outcome.error ? -1 : 1;
        if (!outcome.error) Object.assign(cur[id], { u: outcome.maxUp24h, d: outcome.maxDown24h });
      }
      await chrome.storage.local.set({ [ek]: e, [HL_INDEX]: cur });
      scored++;
    }
    return { ok: true, scored, remaining: todo.length - scored };
  } finally {
    scoringHolderLog = false;
  }
}

// ---------------------------------------------------------------- trade journal
const JT = 'journal:trades';
const JG = 'journal:grades';
const JR = 'journal:rules';
let gtLast = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// GeckoTerminal's free API allows ~30 calls/minute: one call every 2.2s, back off on 429.
async function gtJson(url) {
  for (let i = 0; i < 5; i++) {
    const wait = 2200 - (Date.now() - gtLast);
    if (wait > 0) await sleep(wait);
    gtLast = Date.now();
    const r = await fetch(url, { headers: { accept: 'application/json' } });
    if (r.status === 429) {
      await sleep(15000 * (i + 1));
      continue;
    }
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('GeckoTerminal HTTP ' + r.status);
    return r.json();
  }
  throw new Error('GeckoTerminal rate limit');
}

async function journalAdd(trades, rules) {
  const s = await chrome.storage.local.get([JT]);
  const store = s[JT] || {};
  let added = 0;
  for (const t of trades || []) {
    if (!t || !t.trade || !t.trade.id || !t.trade.closedAt) continue;
    const prev = store[t.trade.id];
    const swaps = Array.isArray(t.swaps) ? t.swaps : [];
    if (!prev || swaps.length > (prev.swaps || []).length) {
      store[t.trade.id] = { trade: t.trade, swaps, at: Date.now() };
      added++;
    }
  }
  const update = { [JT]: store };
  if (rules) update[JR] = rules;
  await chrome.storage.local.set(update);
  return { ok: true, added, total: Object.keys(store).length };
}

let grading = false;
// Grades up to `limit` trades per call so the service worker never runs a multi-minute job in one event.
async function journalGrade(all, limit) {
  if (grading) return { ok: false, error: 'Already grading, wait a moment.' };
  grading = true;
  try {
    const s = await chrome.storage.local.get([JT, JG, JR]);
    const trades = s[JT] || {};
    const grades = all ? {} : s[JG] || {};
    if (all) await chrome.storage.local.set({ [JG]: {} });
    const rules = s[JR] || {};
    const todo = Object.keys(trades)
      .filter((id) => !grades[id])
      .sort((a, b) => Date.parse(trades[b].trade.closedAt) - Date.parse(trades[a].trade.closedAt));
    const batch = todo.slice(0, limit || 12);
    const now = Date.now() / 1000;
    for (const id of batch) {
      const rec = trades[id];
      const fills = FCGrade.fills(rec.trade, rec.swaps);
      const tOpen = fills.length ? fills[0].t : Date.parse(rec.trade.createdAt) / 1000;
      const tClose = Date.parse(rec.trade.closedAt) / 1000;
      let bars = [];
      let priceNote = null;
      try {
        const c = await FCPrices.candles(gtJson, rec.trade.networkId, rec.trade.tokenAddress, tOpen, tClose, now);
        if (c.error) priceNote = c.error;
        else bars = c.bars;
      } catch (e) {
        priceNote = e.message;
      }
      const g = FCGrade.grade(rec, bars, rules);
      g.priceNote = priceNote;
      g.hasSwaps = (rec.swaps || []).length > 0;
      grades[id] = g;
      await chrome.storage.local.set({ [JG]: grades });
    }
    return { ok: true, graded: batch.length, remaining: todo.length - batch.length };
  } finally {
    grading = false;
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const fromFomo = !!sender.tab && /^https:\/\/fomo\.family\//.test(sender.url || '');
  const fromExtensionPage = sender.id === chrome.runtime.id && String(sender.url || '').startsWith('chrome-extension://' + chrome.runtime.id + '/');
  const reply = (p) => p.then(sendResponse, (e) => sendResponse({ ok: false, error: e.message }));
  if (fromFomo && msg.type === 'rundown') {
    reply(rundown(msg.payload.token, !!msg.payload.force));
    return true;
  }
  if (fromFomo && msg.type === 'chat') {
    reply(chat(msg.payload || {}));
    return true;
  }
  if (fromFomo && msg.type === 'holders') {
    reply(holders(msg.payload || {}));
    return true;
  }
  if (fromFomo && msg.type === 'listvotes') {
    reply(listVotes(msg.payload || {}));
    return true;
  }
  if (fromFomo && msg.type === 'trending:snap') {
    reply(trendingSnap(msg.payload || {}));
    return true;
  }
  if (fromExtensionPage && msg.type === 'holderlog:outcomes') {
    reply(holderLogOutcomes(msg.payload && msg.payload.limit));
    return true;
  }
  if (fromFomo && msg.type === 'journal:add') {
    reply(journalAdd(msg.payload.trades, msg.payload.rules));
    return true;
  }
  if ((fromFomo || fromExtensionPage) && msg.type === 'open:options') {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return false;
  }
  if ((fromFomo && ['call:make', 'call:me', 'call:list', 'call:board'].includes(msg.type)) || (fromExtensionPage && /^call:/.test(msg.type))) {
    reply(gameCall(msg.type, msg.payload || {}));
    return true;
  }
  if ((fromFomo || fromExtensionPage) && msg.type === 'open:calls') {
    chrome.tabs.create({ url: chrome.runtime.getURL('calls.html') + (msg.payload && msg.payload.tab === 'board' ? '#board' : '') });
    sendResponse({ ok: true });
    return false;
  }
  if (fromFomo && msg.type === 'open:journal') {
    chrome.tabs.create({ url: chrome.runtime.getURL('journal.html') });
    sendResponse({ ok: true });
    return false;
  }
  if (fromExtensionPage && msg.type === 'journal:grade') {
    reply(journalGrade(!!msg.payload.all, msg.payload.limit));
    return true;
  }
  return false;
});

// Toolbar icon: open the settings page.
if (chrome.action && chrome.action.onClicked) chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
