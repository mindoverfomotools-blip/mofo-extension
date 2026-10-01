/* MOFO: passive capture of the JSON that fomo.family already fetches.
   Runs at document_start in the page world so it wraps fetch/XHR before the app loads.
   Nothing is sent anywhere: responses stay in this tab's memory, latest one per endpoint. The one request MOFO makes
   itself goes to fomo's own API, for more of a trader's swap history (NET.api). */
(function (root) {
  'use strict';
  if (root.FCNet) return;
  const NET = (root.FCNet = { last: {}, listeners: [] });

  function key(url) {
    const u = new URL(url, location.href);
    return u.pathname;
  }

  function store(url, json) {
    let u;
    try {
      u = new URL(url, location.href);
    } catch (e) {
      return;
    }
    if (!/fomo\.family$/.test(u.hostname)) return;
    const rec = { path: u.pathname, host: u.hostname, params: Object.fromEntries(u.searchParams.entries()), json, at: Date.now() };
    NET.last[key(url)] = rec;
    for (const fn of NET.listeners) {
      try {
        fn(rec);
      } catch (e) {
        /* listener errors must never break the page */
      }
    }
  }

  // fomo's API wants the app's login headers. The latest ones the app sent are kept here, in this tab's memory only,
  // so MOFO can ask fomo for more of what the page shows (a trader's older swaps). They only ever go back to fomo's API.
  const API_HOST = 'prod-api.fomo.family';
  let apiHeaders = null;
  function noteHeaders(args) {
    try {
      const req = args[0];
      const url = typeof req === 'string' ? req : req && req.url;
      if (!url || new URL(url, location.href).hostname !== API_HOST) return;
      const raw = (args[1] && args[1].headers) || (req && typeof req === 'object' && req.headers) || null;
      if (!raw) return;
      const h = new Headers(raw);
      if (h.has('authorization')) apiHeaders = Object.fromEntries(h.entries());
    } catch (e) {
      /* ignore */
    }
  }

  const origFetch = root.fetch;
  root.fetch = async function (...args) {
    noteHeaders(args);
    const res = await origFetch.apply(this, args);
    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0] && args[0].url;
      if (url && /fomo\.family/.test(new URL(url, location.href).hostname)) {
        res.clone().json().then((j) => store(url, j)).catch(() => {});
      }
    } catch (e) {
      /* ignore */
    }
    return res;
  };

  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__fcUrl = url;
    return origOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener('load', () => {
      try {
        if (this.__fcUrl && (this.responseType === '' || this.responseType === 'text')) store(this.__fcUrl, JSON.parse(this.responseText));
      } catch (e) {
        /* not JSON */
      }
    });
    return origSend.apply(this, args);
  };

  // Latest response whose path contains `part`, optionally filtered by a predicate on the record.
  NET.get = function (part, pred) {
    let best = null;
    for (const rec of Object.values(NET.last)) {
      if (rec.path.includes(part) && (!pred || pred(rec)) && (!best || rec.at > best.at)) best = rec;
    }
    return best;
  };
  NET.on = function (fn) {
    NET.listeners.push(fn);
  };
  // GET from fomo's API with the app's own login. { ok, json } or { ok: false, login: true } before the app has
  // made a logged-in call.
  NET.api = async function (path, params) {
    if (!apiHeaders) return { ok: false, login: true };
    const u = new URL(path, 'https://' + API_HOST);
    for (const [k, v] of Object.entries(params || {})) u.searchParams.set(k, v);
    try {
      const r = await origFetch.call(root, u.toString(), { headers: apiHeaders, credentials: 'include' });
      if (r.status === 401 || r.status === 403) return { ok: false, login: true, status: r.status };
      if (!r.ok) return { ok: false, status: r.status };
      return { ok: true, json: await r.json() };
    } catch (e) {
      return { ok: false, error: String((e && e.message) || e) };
    }
  };
  NET.hasLogin = () => !!apiHeaders;
})(window);
