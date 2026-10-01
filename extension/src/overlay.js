/* MOFO: small overlays placed directly in fomo.family's own layout, outside the panel: badges in the token
   page header, vote badges in token lists, a heat bar above the Buy button and a trader card on profiles.
   Elements are added next to FOMO's own nodes, never inside them, and re-attached when FOMO re-renders.
   Same 1-bit language as the panel: #0B091F (fomo's black) and #EAEDFF (fomo's white) only; outline, dashed, inverted and hatched carry the meaning. */
(function (root) {
  'use strict';
  const O = {};
  const STYLE_ID = 'fomo-copilot-overlay-style';
  const UI = "'MOFO Archivo',Archivo,-apple-system,BlinkMacSystemFont,Inter,sans-serif";
  const MONO = "'MOFO Martian','Martian Mono',ui-monospace,Menlo,monospace";
  const HATCH = 'repeating-linear-gradient(135deg,#EAEDFF 0 1px,transparent 1px 4px)';
  const CSS = `
  .fcx-badges{display:flex;align-items:center;gap:4px;margin:0 10px;flex-shrink:1;min-width:0;overflow:hidden;font:700 9.5px/1 ${MONO};letter-spacing:.06em;text-transform:uppercase;cursor:pointer}
  .fcx-b{flex-shrink:0;padding:5px 6px 4px;background:#0B091F;color:#EAEDFF;box-shadow:inset 0 0 0 1px #EAEDFF;white-space:nowrap}
  .fcx-b.good::before{content:'';display:inline-block;width:0;height:0;margin-right:4px;vertical-align:0;border-left:3.5px solid transparent;border-right:3.5px solid transparent;border-bottom:6px solid currentColor}
  .fcx-b.warn{box-shadow:none;outline:1px dashed #EAEDFF;outline-offset:-1px}
  .fcx-b.bad{background:#EAEDFF;color:#0B091F}
  .fcx-b.muted{font-weight:300}
  .fcx-b:hover{background:#EAEDFF;color:#0B091F}
  .fcx-compact .fcx-b.opt{display:none}
  .fcx-vote{margin:0 6px 0 0;flex-shrink:0;min-width:22px;text-align:center;padding:3px 5px 2px;font:700 9.5px/1.2 ${MONO};background:#0B091F;color:#EAEDFF;box-shadow:inset 0 0 0 1px #EAEDFF}
  .fcx-vote.v-hi{background:#EAEDFF;color:#0B091F}.fcx-vote.v-mid{box-shadow:none;outline:1px dashed #EAEDFF;outline-offset:-1px}.fcx-vote.v-lo{box-shadow:inset 0 0 0 1px #EAEDFF,inset 0 0 0 2px #0B091F,inset 0 0 0 3px #EAEDFF}
  .fcx-heat{position:relative;margin:0 0 6px;padding:7px 9px 7px 24px;font:800 11px/1.3 ${UI};letter-spacing:.01em;color:#EAEDFF;background:#0B091F;box-shadow:inset 0 0 0 1px #EAEDFF;clip-path:polygon(0 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%)}
  .fcx-heat::before{content:'';position:absolute;left:9px;top:50%;width:7px;height:7px;margin-top:-4px;box-shadow:inset 0 0 0 1px currentColor}
  .fcx-heat.warm{border:4px solid transparent;padding:3px 5px 3px 20px;box-shadow:none;background:linear-gradient(#0B091F,#0B091F) padding-box,${HATCH} border-box}
  .fcx-heat.warm::before{left:5px}
  .fcx-heat.hot{background:#EAEDFF;color:#0B091F}.fcx-heat.hot::before{background:#0B091F}
  .fcx-heat.extreme{border:5px solid transparent;padding:2px 4px 2px 19px;box-shadow:none;color:#0B091F;background:linear-gradient(#EAEDFF,#EAEDFF) padding-box,repeating-linear-gradient(-45deg,#EAEDFF 0 6px,#0B091F 6px 9px) border-box;background-size:auto,25.46px 25.46px;animation:fcx-march .7s linear infinite}
  .fcx-heat.extreme::before{left:4px;background:#0B091F}
  @keyframes fcx-march{to{background-position:0 0,25.46px 0}}
  .fcx-card{margin:10px 16px 0 0;padding:10px 12px;background:#0B091F;color:#EAEDFF;box-shadow:inset 0 0 0 1px #EAEDFF;font:400 12px/1.5 ${UI};clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)}
  .fcx-card b{color:#EAEDFF}.fcx-card .fcx-wm{font:900 15px/1 ${UI};font-stretch:125%;letter-spacing:-.02em;margin-right:6px}
  .fcx-card .fcx-row{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 12px;margin-top:6px;font:500 10.5px/1.5 ${MONO}}
  .fcx-card .fcx-bar{height:3px;margin-top:8px;background:rgba(234,237,255,.18)}.fcx-card .fcx-bar i{display:block;height:100%;background:#EAEDFF;transition:width .4s ease}
  .fcx-card .fcx-k{min-width:52px;font:700 9px/1.5 ${MONO};letter-spacing:.1em;text-transform:uppercase}
  .fcx-card .good::before{content:'';display:inline-block;width:0;height:0;margin-right:4px;border-left:3.5px solid transparent;border-right:3.5px solid transparent;border-bottom:6px solid currentColor}
  .fcx-card .bad{background:#EAEDFF;color:#0B091F;padding:0 3px}.fcx-card .warn{text-decoration:underline dotted 1px;text-underline-offset:3px}.fcx-card .muted{font-weight:300}
  @media (prefers-reduced-motion: reduce){.fcx-heat.extreme{animation:none}}
  `;

  const HEAT_TEXT = {
    calm: 'Entry CALM: not stretched.',
    warm: 'Entry WARM: getting stretched. Small size, stop first.',
    hot: 'Entry HOT: stretched above its average. Wait for a pullback or go small.',
    extreme: 'Entry EXTREME: this is chasing a spike. Wait for a pullback.',
  };
  // Ring on FOMO's Buy button, drawn with outline so it never shifts the layout. Thicker as the heat rises.
  const HEAT_RING = { calm: ['1px', 'solid', '2px'], warm: ['2px', 'dashed', '2px'], hot: ['2px', 'solid', '2px'], extreme: ['4px', 'double', '2px'] };
  // The rule warning above FOMO's Buy button (main.js buyGuard): an inverted block with a square marker.
  O.GUARD_CSS = `margin:6px 0;padding:7px 9px 7px 22px;border:0;border-radius:0;font:700 11px/1.35 ${UI};color:#0B091F;background:#EAEDFF linear-gradient(#0B091F,#0B091F) 9px 11px / 7px 7px no-repeat;clip-path:polygon(0 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%)`;
  const STATS_MIN_PX = 380; // room FOMO's own stats strip keeps before the optional badges hide

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  }
  O.esc = esc;

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  function findLeaf(re) {
    for (const e of document.querySelectorAll('div,span,p')) if (!e.children.length && re.test((e.textContent || '').trim())) return e;
    return null;
  }

  // The header region to put the badges in front of: the nearest ancestor of FOMO's stats strip (Market cap, Price,
  // 24H change...) that sits in a horizontal flex row after another element, i.e. right after the token name block.
  function headerRegion() {
    const mc = findLeaf(/^Market cap$/i);
    const statsRow = mc && mc.closest('div.ml-auto');
    let region = statsRow ? statsRow.closest('div.no-scrollbar') || statsRow.parentElement : null;
    for (let i = 0; region && region.parentElement && i < 5; i++) {
      const cs = getComputedStyle(region.parentElement);
      let prev = region.previousElementSibling;
      if (prev && prev.id === 'fomo-copilot-header') prev = prev.previousElementSibling;
      if (/flex/.test(cs.display) && !/column/.test(cs.flexDirection) && prev) return region;
      region = region.parentElement;
    }
    return null;
  }

  // Token page: badges between the token name and FOMO's stats strip. Items marked opt hide on narrow headers.
  O.header = function (items, onClick) {
    let el = document.getElementById('fomo-copilot-header');
    const region = items && items.length ? headerRegion() : null;
    if (!region) {
      if (el) el.remove();
      return false;
    }
    ensureStyle();
    if (!el) {
      el = document.createElement('div');
      el.id = 'fomo-copilot-header';
      el.className = 'fcx-badges';
      el.addEventListener('click', () => el.__onClick && el.__onClick());
    }
    el.__onClick = onClick;
    if (el.parentElement !== region.parentElement || el.nextElementSibling !== region) region.parentElement.insertBefore(el, region);
    const html = items.map((it) => `<span class="fcx-b ${it.cls || ''}${it.opt ? ' opt' : ''}" title="${esc(it.title || '')}">${esc(it.text)}</span>`).join('');
    if (el.__html !== html) {
      el.innerHTML = html;
      el.__html = html;
      el.__full = 0;
    }
    // Width of all badges, measured only while nothing is hidden; compare with the room left for FOMO's stats.
    if (!el.classList.contains('fcx-compact') || !el.__full) {
      el.classList.remove('fcx-compact');
      el.__full = el.scrollWidth;
    }
    const room = region.getBoundingClientRect().right - el.getBoundingClientRect().left;
    el.classList.toggle('fcx-compact', room - el.__full < STATS_MIN_PX);
    return true;
  };

  // Token list rows (Trending, Most held, search...): a vote badge between the name block and the market cap.
  // A row is FOMO's <a href="/tokens/{chain}/{address}"> with [logo][name + price][market cap + change].
  O.listVotes = function (voteFor) {
    let n = 0;
    for (const a of document.querySelectorAll('a[href^="/tokens/"]')) {
      const right = a.lastElementChild;
      if (a.children.length < 3 || !right || !/\bitems-end\b/.test(right.className) || !/MC/.test(right.textContent || '')) continue;
      const m = (a.getAttribute('href') || '').match(/^\/tokens\/([^/]+)\/([^/?#]+)/);
      if (!m) continue;
      const v = voteFor(m[1], decodeURIComponent(m[2]), a);
      let b = right.previousElementSibling;
      if (!b || !b.classList.contains('fcx-vote')) {
        if (!v) continue;
        ensureStyle();
        b = document.createElement('span');
        b.className = 'fcx-vote';
        a.insertBefore(b, right);
      }
      if (!v) {
        b.remove();
        continue;
      }
      const cls = 'fcx-vote ' + (v.cls || '');
      if (b.className !== cls) b.className = cls;
      if (b.textContent !== v.text) b.textContent = v.text;
      if (b.title !== (v.title || '')) b.title = v.title || '';
      n++;
    }
    return n;
  };

  // Above FOMO's Buy button: the entry heat, and a colored ring on the button itself.
  O.buyHeat = function (heat) {
    const btn = [...document.querySelectorAll('button')].find((b) => /^Buy\s+\S+/.test((b.textContent || '').trim()));
    let el = document.getElementById('fomo-copilot-heat');
    if (!btn || !HEAT_TEXT[heat]) {
      if (el) el.remove();
      if (btn && btn.__fcRing) {
        btn.style.outline = '';
        btn.style.outlineOffset = '';
        btn.__fcRing = false;
      }
      return false;
    }
    ensureStyle();
    if (!el) {
      el = document.createElement('div');
      el.id = 'fomo-copilot-heat';
    }
    const guard = document.getElementById('fomo-copilot-guard');
    const anchor = guard && guard.nextElementSibling === btn ? guard : btn;
    if (el.nextElementSibling !== anchor) anchor.parentElement.insertBefore(el, anchor);
    const cls = 'fcx-heat ' + heat;
    if (el.className !== cls) el.className = cls;
    if (el.textContent !== HEAT_TEXT[heat]) {
      el.textContent = '';
      const span = document.createElement('span');
      span.textContent = HEAT_TEXT[heat];
      el.appendChild(span);
    }
    const [w, style, off] = HEAT_RING[heat];
    const ring = `${w} ${style} #EAEDFF`;
    if (btn.style.outline !== ring) {
      btn.style.outline = ring;
      btn.style.outlineOffset = off;
    }
    btn.__fcRing = true;
    return true;
  };

  // Profile page: a card under FOMO's "avg. hold · trades · joined" line. html is built (and escaped) by the caller.
  O.traderCard = function (html) {
    let el = document.getElementById('fomo-copilot-trader');
    const leaf = html ? findLeaf(/avg\. hold/i) : null;
    const row = leaf ? leaf.closest('div.flex.gap-4') || (leaf.parentElement && leaf.parentElement.parentElement) : null;
    if (!row || !row.parentElement) {
      if (el) el.remove();
      return false;
    }
    ensureStyle();
    if (!el) {
      el = document.createElement('div');
      el.id = 'fomo-copilot-trader';
      el.className = 'fcx-card';
    }
    if (row.nextElementSibling !== el) row.after(el);
    if (el.__html !== html) {
      el.innerHTML = html;
      el.__html = html;
    }
    return true;
  };

  // THE CALL: a card at the bottom of the screen when the open token turns HOT or EXTREME. Three states:
  // ask (buy or wait), open (counting down to the settle) and result (right / wrong / flat). null removes it.
  const CALL_CSS = `
  #fcx-call{position:fixed;z-index:2147483100;left:50%;bottom:58px;width:min(392px,calc(100vw - 32px));transform:translateX(-50%);padding:1px;background:#EAEDFF;clip-path:polygon(0 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%);font:400 12px/1.35 ${UI};color:#EAEDFF;animation:fcx-call-in .45s cubic-bezier(.2,.9,.2,1.2)}
  #fcx-call .in{position:relative;display:grid;grid-template-columns:64px minmax(0,1fr);gap:12px;align-items:center;padding:12px 14px 13px 12px;background:#0B091F;clip-path:polygon(0 0,100% 0,100% calc(100% - 11.5px),calc(100% - 11.5px) 100%,0 100%)}
  #fcx-call .orb{width:64px;height:64px;object-fit:contain;filter:drop-shadow(0 0 10px rgba(234,237,255,.25))}
  #fcx-call.ask .orb,#fcx-call.wrong .orb{animation:fcx-shake .16s steps(2) infinite}
  #fcx-call.right .orb,#fcx-call.open .orb{animation:fcx-float 2.6s ease-in-out infinite}
  #fcx-call .lb{display:flex;justify-content:space-between;gap:8px;font:500 8.5px/1 ${MONO};letter-spacing:.16em;text-transform:uppercase;margin-bottom:6px;min-width:0}
  #fcx-call .lb b{font-weight:700;background:#EAEDFF;color:#0B091F;padding:2px 4px 1px}
  #fcx-call .q{font:800 15px/1.2 ${UI};font-stretch:112%;letter-spacing:-.005em;min-width:0;overflow-wrap:anywhere}
  #fcx-call .q i{font-style:normal;background:#EAEDFF;color:#0B091F;padding:0 4px}
  #fcx-call .s{margin-top:3px;font:400 11px/1.35 ${UI};opacity:.85}
  #fcx-call .bt{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr auto;gap:8px;margin-top:2px}
  #fcx-call button{all:unset;box-sizing:border-box;cursor:pointer;text-align:center;font:700 12px/1 ${MONO};letter-spacing:.14em;text-transform:uppercase;padding:11px 10px 10px}
  #fcx-call .buy{background:#EAEDFF;color:#0B091F}
  #fcx-call .wait{box-shadow:inset 0 0 0 1px #EAEDFF,inset 0 0 0 3px #0B091F,inset 0 0 0 4px #EAEDFF;color:#EAEDFF;background:#0B091F}
  #fcx-call .buy:hover,#fcx-call .wait:hover{outline:1px solid #EAEDFF;outline-offset:2px}
  #fcx-call .skip{padding:11px 4px 10px;font-weight:400;letter-spacing:.08em;opacity:.7}
  #fcx-call .skip:hover{opacity:1}
  #fcx-call .bar{grid-column:1/-1;height:3px;background:rgba(234,237,255,.18);overflow:hidden}
  #fcx-call .bar i{display:block;height:100%;background:#EAEDFF;transform-origin:0 50%}
  #fcx-call .big{font:900 26px/1 ${UI};font-stretch:125%;letter-spacing:-.01em}
  #fcx-call .err{grid-column:1/-1;font:500 10.5px/1.35 ${MONO};padding:6px 8px;box-shadow:inset 0 0 0 1px #EAEDFF;outline:1px dashed #EAEDFF;outline-offset:-4px}
  @keyframes fcx-call-in{from{opacity:0;transform:translate(-50%,18px) scale(.96)}to{opacity:1;transform:translate(-50%,0) scale(1)}}
  @keyframes fcx-shake{0%{transform:translate(1px,-1px) rotate(-2deg)}100%{transform:translate(-1px,1px) rotate(2deg)}}
  @keyframes fcx-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}`;
  const mmss = (s) => (s <= 0 ? '0:00' : Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'));
  O.callCard = function (state, on) {
    let el = document.getElementById('fcx-call');
    if (!state) {
      if (el) el.remove();
      return;
    }
    if (!document.getElementById('fcx-call-style')) {
      const st = document.createElement('style');
      st.id = 'fcx-call-style';
      st.textContent = CALL_CSS;
      (document.head || document.documentElement).appendChild(st);
    }
    if (!el) {
      el = document.createElement('div');
      el.id = 'fcx-call';
      document.body.appendChild(el);
      el.addEventListener('click', (ev) => {
        const b = ev.target.closest('button[data-act]');
        if (b && el.__on && el.__on[b.dataset.act]) el.__on[b.dataset.act]();
      });
    }
    el.__on = on || {};
    const orb = document.documentElement.dataset.mofoOrb || '';
    const sym = esc(state.symbol || 'this token');
    let html = '';
    if (state.mode === 'ask' || state.mode === 'busy') {
      html =
        `<img class="orb" src="${esc(orb)}" alt=""><div><div class="lb"><b>the call</b><span>${state.left !== undefined ? esc(state.left) + ' calls left today' : 'your first call'}</span></div>` +
        `<div class="q">$${sym} is <i>${esc(String(state.heat || '').toUpperCase())}</i>. higher in 15 min?</div><div class="s">buy if it keeps going, wait if it cools off. nothing gets traded.</div></div>` +
        (state.msg ? `<div class="err">${esc(state.msg)}</div>` : '') +
        `<div class="bt"><button class="buy" data-act="buy"${state.mode === 'busy' ? ' disabled' : ''}>buy ▲</button><button class="wait" data-act="wait"${state.mode === 'busy' ? ' disabled' : ''}>wait ▼</button><button class="skip" data-act="skip">skip</button></div>`;
    } else if (state.mode === 'open') {
      const left = Math.max(0, state.settleAt - state.now);
      const k = 1 - left / (state.total || 900);
      html =
        `<img class="orb" src="${esc(orb)}" alt=""><div><div class="lb"><b>the call</b><span>settles in ${mmss(left)}</span></div>` +
        `<div class="q">you called <i>${esc(String(state.side).toUpperCase())}</i> on $${sym}</div><div class="s">at $${esc(state.priceText || '')}. mofo checks the real price when the timer ends.</div></div>` +
        `<div class="bar"><i style="transform:scaleX(${Math.max(0, Math.min(1, k)).toFixed(4)})"></i></div>`;
    } else if (state.mode === 'result') {
      const pts = state.points > 0 ? '+' + state.points : String(state.points);
      const word = { right: 'right', wrong: 'wrong', flat: 'flat', void: 'no price' }[state.result] || state.result;
      html =
        `<img class="orb" src="${esc(orb)}" alt=""><div><div class="lb"><b>the call</b><span>settled</span></div>` +
        `<div class="big">${esc(word)} ${esc(pts)}</div><div class="s">$${sym} moved ${esc(state.moveText || '')} in 15 min. you called ${esc(String(state.side).toUpperCase())}.</div></div>` +
        `<div class="bt"><button class="buy" data-act="calls">my calls</button><button class="wait" data-act="board">caller board</button><button class="skip" data-act="close">close</button></div>`;
    }
    const cls = state.mode === 'result' ? state.result : state.mode;
    if (el.className !== cls) el.className = cls;
    if (el.__html !== html) {
      el.innerHTML = `<div class="in">${html}</div>`;
      el.__html = html;
    }
  };

  root.FCOverlay = O;
})(window);
