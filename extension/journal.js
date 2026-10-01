'use strict';
const G = window.FCGrade;
const { pct, usd } = G.fmt;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const cls = (x) => (x > 0 ? 'good' : x < 0 ? 'bad' : '');

async function load() {
  const s = await chrome.storage.local.get(['journal:trades', 'journal:grades']);
  return { trades: s['journal:trades'] || {}, grades: s['journal:grades'] || {} };
}

function render({ trades, grades }) {
  const graded = Object.values(grades).sort((a, b) => b.tClose - a.tClose);
  const pending = Object.keys(trades).filter((id) => !grades[id]).length;
  $('status').textContent = `${Object.keys(trades).length} trades stored · ${graded.length} graded · ${pending} waiting`;

  const n = graded.length;
  const pnl = graded.reduce((s, g) => s + g.pnl, 0);
  const wins = graded.filter((g) => g.pnl > 0).length;
  const checks = graded.flatMap((g) => g.checks);
  const kept = checks.length ? checks.filter((c) => c.ok).length / checks.length : null;
  const priced = graded.filter((g) => Number.isFinite(g.rulesDelta));
  const delta = priced.reduce((s, g) => s + g.rulesDelta, 0);
  const avg = n ? graded.reduce((s, g) => s + g.score, 0) / n : null;
  const tiles = [
    ['Graded trades', n],
    ['Realized P&L', `<span class="${cls(pnl)}">${usd(pnl)}</span>`],
    ['Win rate', n ? Math.round((wins / n) * 100) + '%' : '–'],
    ['Rules kept', kept === null ? '–' : Math.round(kept * 100) + '%'],
    ['Average score', avg === null ? '–' : Math.round(avg)],
    ['If you had followed the rules', priced.length ? `<span class="${cls(delta)}">${delta >= 0 ? '+' : ''}${usd(delta)}</span>` : '–'],
  ];
  $('tiles').innerHTML = tiles.map(([k, v]) => `<div class="tile"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('');

  const weeks = G.weekly(graded);
  $('weeks').innerHTML =
    '<tr><th>Week of</th><th>Trades</th><th>P&amp;L</th><th>Win rate</th><th>Avg score</th><th>Rules kept</th><th>Rules would add</th></tr>' +
    weeks.map((w) => `<tr><td>${w.week}</td><td>${w.trades}</td><td class="${cls(w.pnl)}">${usd(w.pnl)}</td><td>${Math.round(w.winRate * 100)}%</td><td>${Math.round(w.avgScore)}</td><td>${w.rulesKept === null ? '–' : Math.round(w.rulesKept * 100) + '%'}</td><td class="${cls(w.rulesDelta)}">${w.priced ? (w.rulesDelta >= 0 ? '+' : '') + usd(w.rulesDelta) : '–'}</td></tr>`).join('');

  $('trades').innerHTML =
    '<tr><th>Closed</th><th>Token</th><th>Grade</th><th>Size</th><th>P&amp;L</th><th>Hold</th><th>Best while held</th><th>Rules would add</th><th>What went wrong</th></tr>' +
    graded
      .map((g) => {
        const bad = g.checks.filter((c) => !c.ok).map((c) => c.text);
        const when = new Date(g.tClose * 1000).toISOString().slice(0, 16).replace('T', ' ');
        const hold = g.holdH < 1 ? Math.round(g.holdH * 60) + 'm' : g.holdH.toFixed(1) + 'h';
        return `<tr class="trade" data-id="${esc(g.id)}"><td>${when}</td><td>${esc(g.symbol)}</td><td><span class="g g${g.grade}">${g.grade}</span></td><td>${usd(g.cost)}</td><td class="${cls(g.pnl)}">${usd(g.pnl)} <span class="muted">${pct(g.pnlPct)}</span></td><td>${hold}</td><td>${g.priced ? pct(g.mfe) : '<span class="muted">no price data</span>'}</td><td class="${cls(g.rulesDelta)}">${Number.isFinite(g.rulesDelta) ? (g.rulesDelta >= 0 ? '+' : '') + usd(g.rulesDelta) : '–'}</td><td class="issues">${bad.length ? bad.map(esc).join(' · ') : '<span class="good">Clean</span>'}</td></tr>` +
          `<tr class="detail" data-for="${esc(g.id)}" hidden><td colspan="9">${g.checks.map((c) => `<div class="chk ${c.ok ? 'good' : 'bad'}">${c.ok ? '✓' : '✗'} ${esc(c.text)}${Number.isFinite(c.impactUsd) ? ` <span class="muted">(rules: ${c.impactUsd >= 0 ? '+' : ''}${usd(c.impactUsd)})</span>` : ''}</div>`).join('')}<div class="muted">Entry run-up 15m ${pct(g.runup15)} / 1h ${pct(g.runup60)} · worst while held ${pct(g.mae)} · kept ${g.exitCapture === undefined ? '–' : Math.round(g.exitCapture * 100) + '%'} of the best move · 24h after exit ${pct(g.afterMax)} / ${pct(g.afterMin)} · fees ${usd(g.fees)}</div></td></tr>`;
      })
      .join('');
}

$('trades').addEventListener('click', (ev) => {
  const tr = ev.target.closest('tr.trade');
  if (!tr) return;
  const d = document.querySelector(`tr.detail[data-for="${CSS.escape(tr.dataset.id)}"]`);
  if (d) d.hidden = !d.hidden;
});

async function grade(all) {
  let first = true;
  let done = 0;
  for (;;) {
    $('status').textContent = `Grading… ${done} done (about 5 seconds per trade: free price data is rate-limited)`;
    const res = await chrome.runtime.sendMessage({ type: 'journal:grade', payload: { all: all && first, limit: 12 } });
    first = false;
    if (!res || !res.ok) {
      $('status').textContent = (res && res.error) || 'Grading failed.';
      return;
    }
    done += res.graded || 0;
    if (!res.remaining || !res.graded) break;
  }
  render(await load());
}

$('grade').addEventListener('click', () => grade(false));
$('regrade').addEventListener('click', () => grade(true));

// ---------------------------------------------------------------- holder log (data for the future 0-100 holder score)
// The index holds one small row per entry (t, outcome state o, best move u, worst move d); v1 entries still in the
// old array are counted too until the background migrates them.
async function loadLog() {
  const t = await chrome.storage.local.get('tr:index');
  window.__trendCount = Object.keys(t['tr:index'] || {}).length;
  const s = await chrome.storage.local.get(['hl2:index', 'holders:log']);
  const rows = Object.values(s['hl2:index'] || {}).map((e) => ({ t: e.t, o: e.o || 0, u: e.u, d: e.d }));
  for (const e of s['holders:log'] || []) {
    const o = e.outcome;
    rows.push({ t: e.t, o: o ? (o.error ? -1 : 1) : 0, u: o && o.maxUp24h, d: o && o.maxDown24h });
  }
  return rows;
}

function renderLog(log) {
  const matured = log.filter((e) => Date.now() - e.t >= 864e5);
  const scored = log.filter((e) => e.o === 1);
  const share = (n) => (scored.length ? Math.round((n / scored.length) * 100) + '%' : '–');
  const tiles = [
    ['Tokens logged', log.length],
    ['Trending snapshots', window.__trendCount === undefined ? '–' : window.__trendCount],
    ['Older than 24h', matured.length],
    ['With outcome', scored.length],
    ['Doubled within 24h', share(scored.filter((e) => e.u >= 1).length)],
    ['Fell 50%+ within 24h', share(scored.filter((e) => e.d <= -0.5).length)],
  ];
  $('logtiles').innerHTML = tiles.map(([k, v]) => `<div class="tile"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('');
  const waiting = matured.filter((e) => !e.o).length;
  $('logstatus').textContent = waiting ? `${waiting} ready for outcomes` : '';
}

async function fillOutcomes() {
  let done = 0;
  for (;;) {
    $('logstatus').textContent = `Filling outcomes… ${done} done (about 5 seconds per token: free price data is rate-limited)`;
    const res = await chrome.runtime.sendMessage({ type: 'holderlog:outcomes', payload: { limit: 8 } });
    if (!res || !res.ok) {
      $('logstatus').textContent = (res && res.error) || 'Filling outcomes failed.';
      return;
    }
    done += res.scored || 0;
    if (!res.remaining || !res.scored) break;
  }
  renderLog(await loadLog());
}

$('logfill').addEventListener('click', fillOutcomes);
$('logexport').addEventListener('click', async () => {
  const all = await chrome.storage.local.get(null);
  const entries = Object.keys(all)
    .filter((k) => k.startsWith('hl2:e:'))
    .map((k) => all[k])
    .concat(all['holders:log'] || [])
    .sort((a, b) => a.t - b.t);
  const url = URL.createObjectURL(new Blob([JSON.stringify(entries)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mofo-holder-log.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
});

$('trendexport').addEventListener('click', async () => {
  const all = await chrome.storage.local.get(null);
  const snaps = Object.keys(all)
    .filter((k) => k.startsWith('tr:s:'))
    .map((k) => all[k])
    .sort((a, b) => a.at - b.at);
  const url = URL.createObjectURL(new Blob([JSON.stringify(snaps)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mofo-trending-snapshots.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes['journal:grades'] || changes['journal:trades']) load().then(render);
  if (changes['holders:log'] || changes['hl2:index'] || changes['tr:index']) loadLog().then(renderLog);
});
load().then(render);
loadLog().then(renderLog);
