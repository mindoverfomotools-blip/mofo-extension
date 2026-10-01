/* MOFO: the on-page panel. Shadow DOM so fomo.family styles never leak in or out.
   1-bit design: only #0B091F (fomo's black) and #EAEDFF (fomo's white). Hierarchy comes from size, weight, case, inversion and hatch patterns. */
(function (root) {
  'use strict';
  const P = {};
  // the MOFO logo exactly as supplied (the head cut off at the bottom), inlined: no extension URL needed in the page world
  const LOGO = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjgwIDEyODAiPjxyZWN0IHdpZHRoPSIxMjgwIiBoZWlnaHQ9IjEyODAiIGZpbGw9IiMwQjA5MUYiLz48cGF0aCBmaWxsPSIjRUFFREZGIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xMjA4LjAsMTI3OS41IEwzLjAsMTI3OS40IEwyLjQsMTI3OS4wIEwwLjAsMTI3MS4wIEwwLjAsOTA3LjAgTDAuMCw5MDUuNyBMNy4wLDkwNS42IEw3LjcsOTA1LjAgTDEzLjAsODkxLjAgTDM5LjksODMzLjAgTDczLjAsNzc5LjAgTDgxLjgsNzY3LjAgTDgxLjIsNzY1LjAgTDc4LjMsNzYwLjAgTDE4LjMsNjYzLjAgTDE1LjcsNjU1LjAgTDE1LjQsNjQ4LjAgTDE2LjcsNjQwLjAgTDE5LjQsNjM0LjAgTDIyLjgsNjI5LjAgTDI2LjcsNjI1LjAgTDE1NS4yLDUyMC4wIEwxNzQuMCw1MDQuOCBMMTg0LjAsNDk5LjggTDE5Mi4wLDQ5OC43IEwxOTkuMCw0OTkuNCBMMjA3LjAsNTAyLjEgTDIxMS42LDUwNS4wIEwyOTYuMCw1ODQuMCBMMzAwLjAsNTg3LjYgTDMwMS4wLDU4Ny44IEwzMTIuMCw1ODIuNiBMMzc0LjAsNTU5LjkgTDQzNy4wLDU0NC43IEw0NTEuMCw1NDIuNiBMNDUyLjQsNTM5LjAgTDQ3OS41LDQyNC4wIEw0ODMuOSw0MTYuMCBMNDkwLjAsNDA5LjkgTDQ5NS4wLDQwNi43IEw0OTkuMCw0MDUuMCBMNTA0LjAsNDAzLjYgTDUwOC4wLDQwMy40IEw1MTkuMCw0MDMuOSBMNjk1LjAsNDIxLjYgTDcwMy4wLDQyMi42IEw3MDkuMCw0MjQuNyBMNzEzLjAsNDI2LjcgTDcxOS4wLDQzMS40IEw3MjMuMyw0MzcuMCBMNzI2LjMsNDQzLjAgTDcyOC4xLDQ1MS4wIEw3MzIuMCw1NzAuMyBMNzMzLjAsNTcxLjIgTDc0NS4wLDU3NS41IEw4MDUuMCw2MDMuNSBMODU2LjUsNjM1LjAgTDg3MS4wLDY0NS4yIEw5NjguMyw1ODUuMCBMOTc2LjAsNTgwLjcgTDk4NC4wLDU3OC43IEw5OTEuMCw1NzguNyBMOTk5LjAsNTgwLjUgTDEwMDMuMCw1ODIuNCBMMTAwNy4zLDU4NS4wIEwxMDE0LjAsNTkxLjggTDExMzEuNyw3MzYuMCBMMTEzNi40LDc0NC4wIEwxMTM4LjEsNzUwLjAgTDExMzguNSw3NTUuMCBMMTEzOC4yLDc2MS4wIEwxMTM2LjIsNzY4LjAgTDExMzIuMyw3NzUuMCBMMTA1MS44LDg2MS4wIEwxMDQ5LjYsODY0LjAgTDEwNTUuNCw4NzcuMCBMMTA3Ny4yLDkzNi4wIEwxMDkyLjYsMTAwMC4wIEwxMDk0LjgsMTAxNC4wIEwxMDk2LjAsMTAxNC45IEwxMTAyLjAsMTAxNi40IEwxMjEzLjAsMTA0Mi42IEwxMjIwLjAsMTA0Ni4yIEwxMjI1LjYsMTA1MS4wIEwxMjI5LjUsMTA1Ni4wIEwxMjMzLjEsMTA2NC4wIEwxMjM0LjMsMTA3Mi4wIEwxMjM0LjEsMTA3NS4wIEwxMjE1LjMsMTI2My4wIEwxMjEzLjMsMTI3MS4wIEwxMjEwLjEsMTI3Ny4wIEwxMjA4LjAsMTI3OS41IFogTTkwOS4wLDEwNjEuMCBMOTEzLjAsMTA1OS4yIEw5MTYuMSwxMDU1LjAgTDEwMDguMiw3OTQuMCBMMTAwOC42LDc4OS4wIEwxMDA3LjYsNzg2LjAgTDEwMDYuMCw3ODMuNyBMMTAwMi4wLDc4MS40IEw5OTkuMCw3ODAuOSBMODY5LjAsNzgxLjAgTDg2NC4wLDc4Mi4wIEw4NjEuNSw3ODQuMCBMODYwLjAsNzg2LjMgTDg1Ny44LDc5Mi4wIEw3NjcuNSwxMDQ4LjAgTDc2Ni45LDEwNTEuMCBMNzY3LjUsMTA1NS4wIEw3NjkuMywxMDU4LjAgTDc3Mi4wLDEwNjAuMSBMNzc2LjAsMTA2MS4zIEw5MDkuMCwxMDYxLjAgWiBNNjE3LjUsMTA2MS4wIEw2MjEuNCwxMDU5LjAgTDYyNC4zLDEwNTUuMCBMNzE2LjMsNzk0LjAgTDcxNi45LDc5MC4wIEw3MTYuMCw3ODYuNCBMNzE0LjAsNzgzLjYgTDcxMS4wLDc4MS42IEw3MDQuMCw3ODAuOSBMNTc2LjAsNzgwLjkgTDU3My4wLDc4MS44IEw1NzAuMCw3ODMuNyBMNTY3LjgsNzg3LjAgTDU1NC42LDgyNC4wIEw0NzUuNiwxMDQ4LjAgTDQ3NS4yLDEwNTEuMCBMNDc1LjYsMTA1NS4wIEw0NzcuMCwxMDU3LjUgTDQ4MC4wLDEwNjAuMyBMNDg0LjAsMTA2MS4zIEw2MTcuNSwxMDYxLjAgWiIvPjwvc3ZnPg==';
  const LS_POS = 'fcp:panel-pos';
  const LS_COLLAPSED = 'fcp:panel-collapsed';
  const WIDTH = 340;
  let host = null;
  let shadow = null;
  let body = null;
  let secN = 0;

  const CSS = `
  :host { all: initial; }
  *, *::before, *::after { box-sizing: border-box; }
  .wrap { --ui: 'MOFO Archivo', 'Archivo', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
    --mono: 'MOFO Martian', 'Martian Mono', ui-monospace, 'SF Mono', Menlo, monospace;
    --hatch: repeating-linear-gradient(135deg, #EAEDFF 0 1px, transparent 1px 4px);
    position: fixed; z-index: 2147483000; width: ${WIDTH}px; padding: 1px; background: #EAEDFF; color: #EAEDFF;
    clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px);
    font: 400 12px/1.4 var(--ui); font-stretch: 100%; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
  .in { background: #0B091F; clip-path: polygon(13.4px 0, 100% 0, 100% calc(100% - 13.4px), calc(100% - 13.4px) 100%, 0 100%, 0 13.4px); }
  button { font: inherit; color: inherit; }
  a { color: #EAEDFF; text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 2px; }
  a:hover { background: #EAEDFF; color: #0B091F; text-decoration: none; }
  svg.g { display: inline-block; width: 7px; height: 7px; vertical-align: 0; fill: currentColor; }

  /* header: logo tile + wordmark + controls, then a status strip */
  .lg { width: 30px; height: 30px; flex: 0 0 auto; box-shadow: 0 0 0 1px #EAEDFF; margin-right: 2px; }
  .hdr { display: flex; align-items: center; gap: 8px; padding: 10px 10px 8px 22px; cursor: move; user-select: none; }
  .wm { font: 900 25px/0.9 var(--ui); font-stretch: 125%; letter-spacing: -0.035em; color: #EAEDFF; }
  .tl { font: 400 7.5px/1 var(--mono); letter-spacing: .1em; text-transform: uppercase; align-self: flex-end; padding-bottom: 2px; white-space: nowrap; min-width: 0; overflow: hidden; }
  .sp { flex: 1; min-width: 0; }
  .ib { width: 24px; height: 24px; display: grid; place-items: center; background: #0B091F; border: 0; padding: 0; cursor: pointer; color: #EAEDFF; box-shadow: inset 0 0 0 1px #EAEDFF; }
  .ib:hover, .ib.on { background: #EAEDFF; color: #0B091F; }
  .ib svg { width: 12px; height: 12px; stroke: currentColor; fill: none; stroke-width: 1.5; shape-rendering: crispEdges; }
  .strip { display: flex; align-items: center; gap: 6px; min-height: 26px; padding: 0 14px 8px; cursor: move; user-select: none; border-bottom: 1px solid #EAEDFF; }
  #sym { font: 600 10px/1 var(--mono); letter-spacing: .04em; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #trend, #heatchip { display: flex; gap: 4px; flex-shrink: 0; }
  .chip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 5px 2px; font: 700 8.5px/1 var(--mono); letter-spacing: .08em; text-transform: uppercase; white-space: nowrap; box-shadow: inset 0 0 0 1px #EAEDFF; }
  .chip.up { background: #EAEDFF; color: #0B091F; }
  .chip.range { box-shadow: none; background-image: linear-gradient(#EAEDFF,#EAEDFF), linear-gradient(#EAEDFF,#EAEDFF); background-size: 100% 1px; background-position: 0 0, 0 100%; background-repeat: no-repeat; }
  .chip.calm { } .chip.warm { background: var(--hatch); } .chip.warm span { background: #0B091F; padding: 0 2px; } .chip.hot, .chip.extreme { background: #EAEDFF; color: #0B091F; }
  .chip.extreme { box-shadow: inset 0 0 0 1px #EAEDFF, 0 0 0 1px #0B091F, 0 0 0 2px #EAEDFF; }

  /* sections */
  #body { max-height: calc(62vh - 96px); overflow-y: auto; overflow-x: hidden; scrollbar-width: thin; scrollbar-color: #EAEDFF #0B091F; }
  .sec { padding: 12px 13px 13px; min-width: 0; }
  .sec + .sec { padding-top: 4px; }
  .sec h4 { display: flex; align-items: center; gap: 7px; margin: 0 0 9px; font: 500 9px/1 var(--mono); letter-spacing: .15em; text-transform: uppercase; color: #EAEDFF; }
  .sec h4 i { font-style: normal; font-weight: 700; background: #EAEDFF; color: #0B091F; padding: 3px 4px 2px 5px; letter-spacing: .06em; }
  .sec h4::after { content: ''; flex: 1; height: 1px; background: #EAEDFF; }
  .row { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin: 4px 0; min-width: 0; }
  .row > span:first-child { flex: 0 0 auto; max-width: 62%; font: 400 11.5px/1.35 var(--ui); }
  .num { flex: 0 1 auto; min-width: 0; text-align: right; font: 500 10.5px/1.35 var(--mono); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  .num.good::before { content: ''; display: inline-block; width: 0; height: 0; margin-right: 4px; vertical-align: 1px; border-left: 3.5px solid transparent; border-right: 3.5px solid transparent; border-bottom: 6px solid currentColor; }
  .good { }
  .bad { background: #EAEDFF; color: #0B091F; padding: 0 3px; }
  div.bad { padding: 4px 7px; margin: 5px 0 0; font-weight: 700; }
  .warn { text-decoration: underline dotted 1px; text-underline-offset: 3px; }
  .muted { font-weight: 300; }
  .num.muted { font-weight: 300; }
  .advice { margin-top: 8px; padding-left: 9px; font: 400 11.5px/1.45 var(--ui); background: linear-gradient(#EAEDFF,#EAEDFF) 0 3px / 2px calc(100% - 6px) no-repeat; }
  ul { list-style: none; margin: 5px 0 0; padding: 0; }
  ul > li { position: relative; padding-left: 13px; margin: 4px 0; overflow-wrap: anywhere; }
  ul > li::before { content: ''; position: absolute; left: 1px; top: .42em; width: 7px; height: 7px; box-shadow: inset 0 0 0 1px #EAEDFF; }
  ul > li.bad { background: none; color: #EAEDFF; padding: 0 0 0 13px; font-weight: 700; }
  ul > li.bad::before { background: #EAEDFF; }
  ul > li.warn { text-decoration: none; }
  ul > li.warn::before { background: linear-gradient(135deg, #EAEDFF 50%, transparent 50%); }
  .alert { position: relative; margin: 8px 0 0; padding: 7px 9px 7px 24px; font: 700 11.5px/1.35 var(--ui); }
  .alert::before { content: ''; position: absolute; left: 9px; top: 10px; width: 7px; height: 7px; }
  .alert.bad { background: #EAEDFF; color: #0B091F; }
  .alert.bad::before { background: #0B091F; animation: blink 1s steps(1) infinite; }
  .alert.good { box-shadow: inset 0 0 0 1px #EAEDFF; }
  .alert.good::before { width: 0; height: 0; top: 10px; border-left: 4px solid transparent; border-right: 4px solid transparent; border-bottom: 7px solid #EAEDFF; }
  .alert.warn { box-shadow: inset 0 0 0 1px #EAEDFF; background: linear-gradient(#0B091F,#0B091F) padding-box, var(--hatch); border: 3px solid transparent; padding: 5px 7px 5px 21px; }
  .alert.warn::before { left: 7px; top: 8px; box-shadow: inset 0 0 0 1px #EAEDFF; background: linear-gradient(135deg, #EAEDFF 50%, transparent 50%); }
  @keyframes blink { 50% { background: transparent; } }
  .foot { padding: 7px 14px 9px; border-top: 1px solid #EAEDFF; font: 300 8px/1.3 var(--mono); letter-spacing: .12em; text-transform: uppercase; }
  .collapsed .sec, .collapsed .foot, .collapsed .cfg, .collapsed .chat, .collapsed #body { display: none; }
  .collapsed .strip { border-bottom: 0; }

  .ftab { display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.1fr) minmax(0, 1fr) minmax(0, 1fr); margin-top: 2px; }
  .ftab > span { padding: 5px 0 4px; font: 500 10.5px/1.2 var(--mono); font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; border-bottom: 1px dotted #EAEDFF; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .ftab > span:nth-child(4n+1) { text-align: left; font: 400 11.5px/1.2 var(--ui); }
  .ftab > .fh { font: 500 7.5px/1 var(--mono) !important; letter-spacing: .14em; text-transform: uppercase; border-bottom: 1px solid #EAEDFF; padding: 0 0 5px; }
  .ftab > span:nth-last-child(-n+4) { border-bottom: 0; }
  .ftab .bad { padding: 0 3px; }

  /* the gaussian bell meter */
  .meter { margin: 0 0 10px; }
  .meter svg { display: block; width: 100%; height: auto; overflow: visible; }
  .heatrow { display: flex; align-items: stretch; gap: 10px; margin-bottom: 8px; min-width: 0; }
  .badge { position: relative; isolation: isolate; flex: 0 0 132px; display: grid; place-items: center; padding: 10px 8px 9px; font: 900 19px/1 var(--ui); font-stretch: 125%; letter-spacing: -.01em; color: #EAEDFF; }
  .badge::before { content: ''; position: absolute; inset: 0; z-index: -2; background: #EAEDFF; clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px); }
  .badge::after { content: ''; position: absolute; inset: 1px; z-index: -1; background: #0B091F; clip-path: polygon(7.4px 0, 100% 0, 100% calc(100% - 7.4px), calc(100% - 7.4px) 100%, 0 100%, 0 7.4px); }
  .badge span { position: relative; padding: 1px 3px 0; }
  .badge.warm::after { background: var(--hatch), #0B091F; }
  .badge.warm span { background: #0B091F; }
  .badge.hot { color: #0B091F; } .badge.hot::after { background: #EAEDFF; }
  .badge.extreme { color: #0B091F; } .badge.extreme::after { background: repeating-linear-gradient(-45deg, #EAEDFF 0 6px, #0B091F 6px 9px); background-size: 25.46px 25.46px; animation: march .7s linear infinite; }
  .badge.extreme span { background: #EAEDFF; padding: 2px 5px 1px; }
  @keyframes march { to { background-position: 25.46px 0; } }
  .hstats { flex: 1 1 auto; min-width: 0; display: grid; align-content: center; gap: 4px; }
  .hstats div { display: flex; justify-content: space-between; gap: 6px; font: 400 9px/1.2 var(--mono); letter-spacing: .06em; text-transform: uppercase; min-width: 0; }
  .hstats b { font-weight: 700; white-space: nowrap; }

  /* buttons: chamfered, outline by default, primary is solid white, hover inverts */
  .rrow { display: flex; flex-wrap: wrap; gap: 0 8px; min-width: 0; }
  .rbtn { position: relative; isolation: isolate; margin-top: 8px; padding: 8px 13px 7px; background: none; border: 0; color: #EAEDFF; cursor: pointer; font: 700 9.5px/1 var(--mono); letter-spacing: .1em; text-transform: uppercase; }
  .rbtn::before { content: ''; position: absolute; inset: 0; z-index: -2; background: #EAEDFF; clip-path: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px); }
  .rbtn::after { content: ''; position: absolute; inset: 1px; z-index: -1; background: #0B091F; clip-path: polygon(5.4px 0, 100% 0, 100% calc(100% - 5.4px), calc(100% - 5.4px) 100%, 0 100%, 0 5.4px); }
  .rbtn:hover, .rbtn.pri { color: #0B091F; } .rbtn:hover::after, .rbtn.pri::after { background: #EAEDFF; }
  .rbtn.pri:hover { color: #EAEDFF; } .rbtn.pri:hover::after { background: #0B091F; }
  .rbtn:focus-visible, .ib:focus-visible, .chip2:focus-visible { outline: 1px solid #EAEDFF; outline-offset: 2px; }
  .btn { background: #0B091F; border: 0; color: #EAEDFF; cursor: pointer; font: 700 12px/1 var(--mono); padding: 3px 5px; box-shadow: inset 0 0 0 1px #EAEDFF; }
  .btn:hover { background: #EAEDFF; color: #0B091F; }

  /* settings */
  .cfg { display: none; padding: 12px 13px 13px; border-bottom: 1px solid #EAEDFF; background: var(--hatch), #0B091F; }
  .cfg.open { display: block; }
  .cfg .cbox { background: #0B091F; padding: 10px 11px 8px; box-shadow: inset 0 0 0 1px #EAEDFF; }
  .cfg h4 { display: flex; align-items: center; gap: 7px; margin: 0 0 7px; font: 500 9px/1 var(--mono); letter-spacing: .15em; text-transform: uppercase; }
  .cfg h4 + label { margin-top: 0; }
  .cfg h4:not(:first-child) { margin-top: 12px; }
  .cfg h4::after { content: ''; flex: 1; height: 1px; background: #EAEDFF; }
  .cfg label { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin: 5px 0; font: 400 11.5px/1.3 var(--ui); }
  .cfg label > span { display: inline-flex; align-items: baseline; gap: 4px; font: 400 10px/1 var(--mono); }
  .cfg input[type=text] { width: 66px; background: #0B091F; color: #EAEDFF; border: 0; border-bottom: 1px solid #EAEDFF; border-radius: 0; padding: 3px 0 2px; font: 600 11px/1 var(--mono); text-align: right; }
  .cfg input[type=text]:focus { outline: 1px solid #EAEDFF; outline-offset: 2px; }
  .cfg input[type=checkbox] { appearance: none; -webkit-appearance: none; position: relative; flex: 0 0 auto; width: 28px; height: 14px; margin: 0; background: #0B091F; box-shadow: inset 0 0 0 1px #EAEDFF; cursor: pointer; }
  .cfg input[type=checkbox]::after { content: ''; position: absolute; top: 3px; left: 3px; width: 8px; height: 8px; background: #EAEDFF; transition: left .12s steps(2); }
  .cfg input[type=checkbox]:checked { background: #EAEDFF; }
  .cfg input[type=checkbox]:checked::after { left: 17px; background: #0B091F; }
  .cfg input[type=checkbox]:focus-visible { outline: 1px solid #EAEDFF; outline-offset: 2px; }
  .cfg .crow { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin: 7px 0 5px; font: 400 11.5px/1.3 var(--ui); min-width: 0; }
  .cfg .seg { display: flex; flex: 0 1 auto; min-width: 0; box-shadow: inset 0 0 0 1px #EAEDFF; }
  .cfg .seg label { margin: 0; flex: 0 1 auto; min-width: 0; cursor: pointer; }
  .cfg .seg label + label { box-shadow: -1px 0 0 #EAEDFF; }
  .cfg .seg input { position: absolute; opacity: 0; width: 0; height: 0; margin: 0; }
  .cfg .seg b { display: inline-flex; align-items: center; gap: 4px; padding: 4px 6px 3px; font: 600 8.5px/1 var(--mono); letter-spacing: .06em; text-transform: uppercase; white-space: nowrap; }
  .cfg .seg .cc { width: 11px; height: 11px; flex: 0 0 auto; shape-rendering: crispEdges; }
  .cfg .seg input:checked + b { background: #EAEDFF; color: #0B091F; }
  .cfg .seg input:checked + b .cc { background: #0B091F; outline: 1px solid #0B091F; }
  .cfg .seg input:focus-visible + b { outline: 1px solid #EAEDFF; outline-offset: 2px; }

  /* rundown and holders */
  .rk { margin-top: 9px; font: 600 8.5px/1 var(--mono); letter-spacing: .14em; text-transform: uppercase; }
  .rd { margin-top: 3px; font: 400 11.5px/1.45 var(--ui); overflow-wrap: anywhere; }
  .rfoot { margin-top: 9px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .rfoot > span { font: 300 8.5px/1.4 var(--mono); letter-spacing: .04em; min-width: 0; }
  .rfoot .rbtn { margin-top: 0; flex-shrink: 0; }
  .posts li { margin: 7px 0; }
  .ev { display: inline-block; margin-left: 5px; padding: 1px 3px 0; font: 400 7.5px/1.2 var(--mono); letter-spacing: .08em; text-transform: uppercase; vertical-align: 1px; box-shadow: inset 0 0 0 1px #EAEDFF; background: none; color: #EAEDFF; font-weight: 400; }
  li.bad .ev { font-weight: 400; }
  .tag { display: inline-block; margin: 0 3px 2px 0; padding: 2px 4px 1px; font: 600 7.5px/1.1 var(--mono); letter-spacing: .08em; text-transform: uppercase; box-shadow: inset 0 0 0 1px #EAEDFF; vertical-align: 1px; }
  .tag.bad { background: #EAEDFF; color: #0B091F; padding: 2px 4px 1px; }
  .tag.warn { box-shadow: none; outline: 1px dashed #EAEDFF; outline-offset: -1px; text-decoration: none; }
  .tag.good { box-shadow: inset 0 0 0 1px #EAEDFF, inset 0 0 0 2px #0B091F, inset 0 0 0 3px #EAEDFF; padding: 3px 5px 2px; }
  .hl li { padding-left: 24px; margin: 8px 0; font: 400 11px/1.4 var(--ui); }
  .hl li::before { display: none; }
  .hl .ix { position: absolute; left: 0; top: 1px; min-width: 17px; padding: 2px 2px 1px; text-align: center; font: 700 8px/1 var(--mono); background: #EAEDFF; color: #0B091F; }
  .hl .l2 { margin-top: 2px; font: 400 9.5px/1.4 var(--mono); }
  .hl .num { font-size: 10px; }

  /* chat */
  .chat { border-top: 1px solid #EAEDFF; padding: 11px 13px 12px; }
  .chat-hd { display: flex; align-items: center; gap: 7px; margin-bottom: 8px; }
  .chat-hd b { font: 900 13px/1 var(--ui); font-stretch: 125%; letter-spacing: -.01em; }
  .chat-hd b { white-space: nowrap; }
  .chat-log { max-height: 280px; overflow-y: auto; display: flex; flex-direction: column; gap: 7px; scrollbar-width: thin; scrollbar-color: #EAEDFF #0B091F; }
  .chat-log > .muted { font: 300 11px/1.45 var(--ui); }
  .msg { padding: 7px 9px; max-width: 94%; overflow-wrap: anywhere; font: 400 11.5px/1.45 var(--ui); }
  .msg.user { align-self: flex-end; background: #EAEDFF; color: #0B091F; font-weight: 500; clip-path: polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%); }
  .msg.assistant { align-self: flex-start; padding: 2px 0 2px 10px; background: linear-gradient(#EAEDFF,#EAEDFF) 0 0 / 2px 100% no-repeat; }
  .msg.err { background: none; outline: 1px dashed #EAEDFF; outline-offset: -1px; padding: 7px 9px; }
  .msg ul { margin: 3px 0; } .msg .gap { height: 6px; } .msg b { font-weight: 800; }
  .mcost { margin-top: 4px; font: 300 8.5px/1 var(--mono); letter-spacing: .06em; }
  .thinking { font-weight: 300; }
  .thinking::after { content: ''; display: inline-block; width: 6px; height: 6px; margin-left: 6px; background: #EAEDFF; animation: blink 1s steps(1) infinite; }
  .chips { display: flex; flex-wrap: wrap; gap: 4px; margin: 9px 0 8px; }
  .chip2 { background: #0B091F; color: #EAEDFF; border: 0; box-shadow: inset 0 0 0 1px #EAEDFF; padding: 5px 6px 4px; font: 600 8px/1 var(--mono); letter-spacing: .02em; text-transform: uppercase; cursor: pointer; }
  .chip2:hover { background: #EAEDFF; color: #0B091F; }
  .chat-in { display: flex; gap: 6px; align-items: stretch; }
  .chat-in textarea { flex: 1; min-width: 0; resize: none; background: #0B091F; color: #EAEDFF; border: 0; box-shadow: inset 0 0 0 1px #EAEDFF; border-radius: 0; padding: 7px 9px; font: 400 12px/1.35 var(--ui); }
  .chat-in textarea::placeholder { color: #EAEDFF; font-weight: 300; opacity: 1; }
  .chat-in textarea:focus { outline: 1px solid #EAEDFF; outline-offset: 2px; }
  .chat-in .rbtn { margin-top: 0; }
  @media (prefers-reduced-motion: reduce) { .badge.extreme::after, .alert.bad::before, .thinking::after { animation: none; } }
  `;

  const FIELDS = [
    ['protectAfter', 'Stop to entry once up', '%', 100],
    ['takeHalfAt', 'Sell half at', '%', 100],
    ['emergencyStop', 'Emergency stop (0 = off)', '%', 100],
    ['maxPositionUsd', 'Max buy size', '$', 1],
    ['maxDailyLossUsd', 'Daily loss limit', '$', 1],
    ['bigWinUsd', 'Cool-down after a day up', '$', 1],
  ];
  const TOGGLES = [
    ['drawLevels', 'Support / resistance'],
    ['drawSignals', 'Signal arrows'],
    ['drawGauss', 'Gaussian channel'],
    ['drawFomoLine', 'FOMO line'],
    ['drawPlan', 'Buy zone, stop, targets'],
    ['theCall', 'THE CALL on hot tokens'],
  ];
  // Candle colors: a pair of mini candles per choice, drawn in the colors it gives the chart.
  const candlePair = (up, upFill, down, downFill) =>
    `<svg class="cc" viewBox="0 0 14 14" aria-hidden="true"><path d="M3.5 1v12" stroke="${up}"/><rect x="1.5" y="3.5" width="4" height="6" fill="${upFill}" stroke="${up}"/><path d="M10.5 2v11" stroke="${down}"/><rect x="8.5" y="5.5" width="4" height="5" fill="${downFill}" stroke="${down}"/></svg>`;
  const CANDLE_MODES = [
    ['mono', 'B&amp;W', candlePair('#EAEDFF', '#EAEDFF', '#EAEDFF', '#0B091F')],
    ['greenred', 'Green / red', candlePair('#16C784', '#16C784', '#EA3943', '#EA3943')],
    ['fomo', "FOMO's", ''],
  ];
  const GAUSS_FIELDS = [
    ['gaussPeriod', 'Sampling period', 'bars', 1],
    ['gaussPoles', 'Poles (1 to 9)', '', 1],
    ['gaussMult', 'Band multiplier', '×', 1],
  ];

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  }

  // Small crisp glyphs that don't depend on which font has ▲▼◆.
  const GLYPH = {
    up: '<svg class="g" viewBox="0 0 8 8" aria-hidden="true"><path d="M4 0.5 8 7.5H0z"/></svg>',
    down: '<svg class="g" viewBox="0 0 8 8" aria-hidden="true"><path d="M0 0.5h8L4 7.5z"/></svg>',
    range: '<svg class="g" viewBox="0 0 8 8" aria-hidden="true"><path d="M4 0 8 4 4 8 0 4z"/></svg>',
  };

  P.money = function (x) {
    if (x === null || x === undefined || !Number.isFinite(x)) return '–';
    const s = x < 0 ? '-$' : '$';
    const a = Math.abs(x);
    if (a >= 1e9) return s + (a / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return s + (a / 1e6).toFixed(2) + 'M';
    if (a >= 1e4) return s + (a / 1e3).toFixed(1) + 'K';
    if (a >= 1000) return s + Math.round(a).toLocaleString('en-US');
    if (a >= 1) return s + a.toFixed(2);
    if (a === 0) return '$0';
    return s + a.toPrecision(3);
  };
  P.num = function (x) {
    if (x === null || x === undefined || !Number.isFinite(x)) return '–';
    const a = Math.abs(x);
    if (a >= 1e6) return (x / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return (x / 1e3).toFixed(1) + 'K';
    return String(Math.round(x));
  };
  P.pct = function (x, digits) {
    if (x === null || x === undefined || !Number.isFinite(x)) return '–';
    return (x >= 0 ? '+' : '') + (x * 100).toFixed(digits === undefined ? 1 : digits) + '%';
  };

  const ICON_CFG = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M0 3h12M0 9h12"/><rect x="3" y="1" width="3" height="4" fill="#0B091F"/><rect x="7" y="7" width="3" height="4" fill="#0B091F"/></svg>';
  const ICON_COL = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1 6h10"/></svg>';

  P.mount = function () {
    if (host) return;
    host = document.createElement('div');
    host.id = 'fomo-copilot-host';
    shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML =
      `<style>${CSS}</style><div class="wrap"><div class="in">` +
      `<div class="hdr"><img class="lg" src="${LOGO}" alt="" width="30" height="30"><b class="wm">MOFO</b><span class="tl">mind over fomo</span><span class="sp"></span><button class="ib" id="cfg" title="Your rules and chart layers">${ICON_CFG}</button><button class="ib" id="col" title="Collapse">${ICON_COL}</button></div>` +
      `<div class="strip"><span id="sym"></span><span class="sp"></span><span id="heatchip"></span><span id="trend"></span></div>` +
      `<div class="cfg" id="cfgbox"></div><div id="body"></div>` +
      `<div class="chat" id="chat"><div class="chat-hd"><b>Ask MOFO</b><span class="sp"></span><button class="btn" id="chatclear" title="Clear this chat">⟲</button></div><div class="chat-log" id="chatlog"></div><div class="chips" id="chips"><button class="chip2" data-q="Find me an entry on this token: zone, where I'm wrong, targets and size.">Find entry</button><button class="chip2" data-q="I hold this. Where do I take profit and where am I wrong?">Exit plan</button><button class="chip2" data-q="Rug check: what could go wrong with this token right now?">Rug check</button><button class="chip2" data-q="What's the latest on X and in the news about this token?">Latest news</button></div><div class="chat-in"><textarea id="chatin" rows="2" placeholder="Ask about this token…"></textarea><button class="rbtn pri" id="chatsend">Send</button></div></div>` +
      `<div class="foot">Analysis, not advice. MOFO never trades.</div></div></div>`;
    document.documentElement.appendChild(host);
    const wrap = shadow.querySelector('.wrap');
    body = shadow.getElementById('body');
    // The frame is a clip-path, which antialiases on a fractional edge: a panel 612.4px tall would get a grey bottom
    // line. Pad the inside up to a whole pixel so the frame always lands on the pixel grid.
    const inner = shadow.querySelector('.in');
    if (inner && typeof ResizeObserver !== 'undefined') {
      const snap = () => {
        const cur = parseFloat(inner.style.paddingBottom) || 0;
        const h = inner.getBoundingClientRect().height - cur;
        const pad = Math.ceil(h - 0.001) - h;
        if (Math.abs(pad - cur) > 0.01) inner.style.paddingBottom = pad > 0.01 ? pad.toFixed(3) + 'px' : '';
      };
      new ResizeObserver(snap).observe(inner);
    }
    body.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'rundown' && P.onRundown) P.onRundown(false);
      if (act === 'rundown-refresh' && P.onRundown) P.onRundown(true);
      if (act === 'settings' && P.onOpenSettings) P.onOpenSettings();
      if (act === 'journal' && P.onOpenJournal) P.onOpenJournal();
      if (act === 'calls' && P.onOpenCalls) P.onOpenCalls();
      if (act === 'board' && P.onBoard) P.onBoard();
      if (act === 'holders-refresh' && P.onHoldersRefresh) P.onHoldersRefresh();
    });
    // Default: top-left corner of the chart, over the oldest candles, clear of FOMO's buy column.
    let pos = null;
    try {
      pos = JSON.parse(localStorage.getItem(LS_POS));
    } catch (e) {}
    if (!pos) {
      const frame = [...document.querySelectorAll('iframe')].find((f) => f.getBoundingClientRect().width > 400);
      const r = frame ? frame.getBoundingClientRect() : { left: 440, top: 130 };
      pos = { right: Math.max(16, innerWidth - (r.left + 12) - WIDTH), top: r.top + 44 };
    }
    wrap.style.right = pos.right + 'px';
    wrap.style.top = pos.top + 'px';
    try {
      if (localStorage.getItem(LS_COLLAPSED) === '1') wrap.classList.add('collapsed');
    } catch (e) {}
    // A position saved in a wider window (or a later resize) can leave the panel off-screen: keep it inside the viewport.
    const clamp = () => {
      const w = wrap.offsetWidth || WIDTH;
      wrap.style.right = Math.max(0, Math.min(innerWidth - w, parseInt(wrap.style.right, 10) || 0)) + 'px';
      wrap.style.top = Math.max(0, Math.min(innerHeight - 40, parseInt(wrap.style.top, 10) || 0)) + 'px';
    };
    clamp();
    addEventListener('resize', clamp);
    shadow.getElementById('col').addEventListener('click', () => {
      wrap.classList.toggle('collapsed');
      try {
        localStorage.setItem(LS_COLLAPSED, wrap.classList.contains('collapsed') ? '1' : '0');
      } catch (e) {}
    });
    const cfgBox = shadow.getElementById('cfgbox');
    const cfgBtn = shadow.getElementById('cfg');
    cfgBtn.addEventListener('click', () => {
      if (!root.FCSettings) return;
      cfgBox.innerHTML = P.settingsHtml(root.FCSettings.get());
      cfgBox.classList.toggle('open');
      cfgBtn.classList.toggle('on', cfgBox.classList.contains('open'));
    });
    ['keydown', 'keyup', 'keypress'].forEach((type) => cfgBox.addEventListener(type, (ev) => ev.stopPropagation())); // FOMO's shortcuts stay out of the inputs
    cfgBox.addEventListener('change', (ev) => {
      const el = ev.target;
      const k = el.dataset && el.dataset.k;
      if (!k || !root.FCSettings) return;
      // Text inputs, not number inputs: a number input shows 1.414 as "1,414" in comma locales.
      if (el.type === 'radio') return root.FCSettings.set({ [k]: el.value });
      const v = el.type === 'checkbox' ? el.checked : Number(String(el.value).trim().replace(',', '.')) / Number(el.dataset.f);
      if (el.type !== 'checkbox' && !(v >= 0)) return;
      root.FCSettings.set({ [k]: v });
    });
    // Chat lives outside #body so the 4-second panel refresh never wipes what the trader is typing.
    const chatlog = shadow.getElementById('chatlog');
    const chatin = shadow.getElementById('chatin');
    const send = () => {
      const text = chatin.value.trim();
      if (!text || !P.onChat) return;
      chatin.value = '';
      P.onChat(text);
    };
    shadow.getElementById('chatsend').addEventListener('click', send);
    ['keydown', 'keyup', 'keypress'].forEach((type) =>
      chatin.addEventListener(type, (ev) => {
        ev.stopPropagation(); // keep FOMO's keyboard shortcuts out of the chat box
        if (type === 'keydown' && ev.key === 'Enter' && !ev.shiftKey) {
          ev.preventDefault();
          send();
        }
      })
    );
    shadow.getElementById('chips').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-q]');
      if (b && P.onChat) P.onChat(b.dataset.q);
    });
    shadow.getElementById('chatclear').addEventListener('click', () => P.onChatClear && P.onChatClear());
    chatlog.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-act="settings"]') && P.onOpenSettings) P.onOpenSettings();
    });
    P.chatRender(null);
    const drag = (ev) => {
      if (ev.target.closest('button')) return;
      const r = wrap.getBoundingClientRect();
      const offX = ev.clientX - r.left;
      const offY = ev.clientY - r.top;
      const move = (e) => {
        const left = Math.max(0, Math.min(innerWidth - r.width, e.clientX - offX));
        const top = Math.max(0, Math.min(innerHeight - 40, e.clientY - offY));
        wrap.style.right = innerWidth - left - r.width + 'px';
        wrap.style.top = top + 'px';
      };
      const up = () => {
        removeEventListener('mousemove', move);
        removeEventListener('mouseup', up);
        try {
          localStorage.setItem(LS_POS, JSON.stringify({ right: parseInt(wrap.style.right, 10), top: parseInt(wrap.style.top, 10) }));
        } catch (e) {}
      };
      addEventListener('mousemove', move);
      addEventListener('mouseup', up);
    };
    shadow.querySelector('.hdr').addEventListener('mousedown', drag);
    shadow.querySelector('.strip').addEventListener('mousedown', drag);
  };

  P.settingsHtml = function (s) {
    const num = ([k, label, unit, f]) => `<label>${esc(label)}<span><input type="text" inputmode="decimal" autocomplete="off" spellcheck="false" data-k="${k}" data-f="${f}" value="${+(Number(s[k]) * f).toFixed(3)}"> ${unit}</span></label>`;
    return (
      '<div class="cbox"><h4>Your rules</h4>' +
      FIELDS.map(num).join('') +
      '<h4>Chart layers</h4>' +
      TOGGLES.map(([k, label]) => `<label>${esc(label)}<input type="checkbox" data-k="${k}" ${s[k] ? 'checked' : ''}></label>`).join('') +
      `<div class="crow"><span>Candles</span><div class="seg" role="radiogroup" aria-label="Candle colors">${CANDLE_MODES.map(([v, label, icon]) => `<label><input type="radio" name="fcx-candles" data-k="candleColors" value="${v}" ${s.candleColors === v ? 'checked' : ''}><b>${icon}${label}</b></label>`).join('')}</div></div>` +
      '<h4>Gaussian channel</h4>' +
      GAUSS_FIELDS.map(num).join('') +
      '</div>'
    );
  };

  P.show = function (on) {
    if (host) host.style.display = on ? '' : 'none';
  };

  P.expand = function () {
    const wrap = shadow && shadow.querySelector('.wrap');
    if (!wrap) return;
    wrap.classList.remove('collapsed');
    try {
      localStorage.setItem(LS_COLLAPSED, '0');
    } catch (e) {}
  };

  function sec(title, html) {
    secN++;
    return `<div class="sec"><h4><i>${String(secN).padStart(2, '0')}</i>${esc(title)}</h4>${html}</div>`;
  }
  function row(label, value, cls) {
    return `<div class="row"><span>${esc(label)}</span><span class="num ${cls || ''}">${value}</span></div>`;
  }

  const HEAT_TEXT = { calm: 'CALM', warm: 'WARM', hot: 'HOT', extreme: 'EXTREME' };
  const TREND = { up: 'UP', down: 'DOWN', range: 'RANGE' };
  const trendChip = (t, prefix) => `<span class="chip ${t}">${GLYPH[t] || ''}${prefix ? prefix + ' ' : ''}${TREND[t] || esc(String(t).toUpperCase())}</span>`;

  // ---------------------------------------------------------------- the Gaussian bell meter
  // x axis in band units: u = z / mult, so the top band sits at u = 1. The bell is a normal curve with sigma 0.5
  // (the bands at two sigma). Area under the curve is filled up to where price sits; the tail past the top band is
  // hatched and labeled FOMO.
  P.gaussMeter = function (g) {
    const W = 312;
    const H = 96;
    const base = 70;
    const peak = 58;
    const U = 2.1;
    const SIG2 = 2 * 0.55 * 0.55;
    const x = (u) => 4 + ((u + U) / (2 * U)) * (W - 8);
    const y = (u) => base - peak * Math.exp(-(u * u) / SIG2);
    const pts = [];
    for (let px = 0; px <= W - 8; px += 2) {
      const u = (px / (W - 8)) * 2 * U - U;
      pts.push(`${(4 + px).toFixed(1)},${y(u).toFixed(2)}`);
    }
    const curve = 'M' + pts.join(' L');
    const area = `${curve} L${x(U).toFixed(1)},${base} L${x(-U).toFixed(1)},${base} Z`;
    const has = g && Number.isFinite(g.z) && g.mult > 0;
    const u = has ? g.z / g.mult : 0;
    const uc = Math.max(-U, Math.min(U, u));
    const mx = x(uc);
    const inFomo = has && u > 1;
    // past the edge of the drawn curve the exact number stops meaning much: show the edge value with a >
    const zEdge = (U * (g.mult || 1.414)).toFixed(1);
    const label = has ? (u > U ? `z >+${zEdge} ▸` : u < -U ? `z <−${zEdge} ◂` : `z ${u >= 0 ? '+' : '−'}${Math.abs(g.z).toFixed(1)}`) : 'z –';
    const lw = label.length * 6.2 + 10;
    const lx = Math.max(0, Math.min(W - lw, mx - lw / 2));
    const tick = (uu, text, anchor) => `<line x1="${x(uu).toFixed(1)}" y1="${base}" x2="${x(uu).toFixed(1)}" y2="${base + 5}" stroke="#EAEDFF" stroke-width="1"/><text x="${x(uu).toFixed(1)}" y="${base + 15}" text-anchor="${anchor || 'middle'}" class="t">${text}</text>`;
    return (
      `<div class="meter"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Price position in the Gaussian channel: ${esc(label)}">` +
      `<defs><pattern id="mh" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.3" height="4" fill="#EAEDFF"/></pattern><clipPath id="ma"><path d="${area}"/></clipPath>` +
      `<style>.t{font:500 7.5px 'MOFO Martian','Martian Mono',ui-monospace,Menlo,monospace;letter-spacing:.12em;fill:#EAEDFF}.tb{font:800 9px 'MOFO Archivo','Archivo',Arial,sans-serif;letter-spacing:.12em;fill:#EAEDFF}.zl{font:700 9px 'MOFO Martian','Martian Mono',ui-monospace,Menlo,monospace;fill:#0B091F}</style></defs>` +
      `<rect x="${x(1).toFixed(1)}" y="0" width="${(x(U) - x(1)).toFixed(1)}" height="${base}" fill="url(#mh)" clip-path="url(#ma)"/>` +
      (has ? `<rect x="${x(-U).toFixed(1)}" y="0" width="${Math.max(0, Math.min(mx - 3, x(1) - 1) - x(-U)).toFixed(1)}" height="${base}" fill="#EAEDFF" clip-path="url(#ma)"/>` : '') +
      `<path d="${curve}" fill="none" stroke="#EAEDFF" stroke-width="1.4" stroke-linejoin="round"/>` +
      `<line x1="0" y1="${base}" x2="${W}" y2="${base}" stroke="#EAEDFF" stroke-width="1"/>` +
      tick(-1, 'LOW') +
      tick(0, 'GAUSS') +
      tick(1, 'TOP') +
      (inFomo
        ? `<rect x="${(x(1.55) - 24).toFixed(1)}" y="${(y(1.55) - 22).toFixed(1)}" width="48" height="14" fill="#EAEDFF"/><text x="${x(1.55).toFixed(1)}" y="${(y(1.55) - 11.5).toFixed(1)}" text-anchor="middle" class="tb" fill="#0B091F" style="fill:#0B091F">FOMO</text>`
        : `<text x="${x(1.55).toFixed(1)}" y="${(y(1.55) - 11).toFixed(1)}" text-anchor="middle" class="tb">FOMO</text>`) +
      `<text x="${x(-1.55).toFixed(1)}" y="${(y(-1.55) - 11).toFixed(1)}" text-anchor="middle" class="t">FEAR</text>` +
      (has
        ? `<line x1="${mx.toFixed(1)}" y1="15" x2="${mx.toFixed(1)}" y2="${base}" stroke="#EAEDFF" stroke-width="1.6"/>` +
          `<rect x="${lx.toFixed(1)}" y="1" width="${lw.toFixed(1)}" height="14" fill="#EAEDFF"/><text x="${(lx + lw / 2).toFixed(1)}" y="11" text-anchor="middle" class="zl">${esc(label)}</text>`
        : `<text x="${W / 2}" y="10" text-anchor="middle" class="t">WAITING FOR CANDLES</text>`) +
      `</svg></div>`
    );
  };

  const GZONE = { above: 'above the top band', upper: 'upper half', lower: 'lower half', below: 'below the bottom band' };

  P.render = function (s) {
    if (!host) P.mount();
    secN = 0;
    shadow.getElementById('sym').textContent = s.symbol ? `${s.symbol} · ${s.resLabel || ''}` : '';
    const trendEl = shadow.getElementById('trend');
    const heatEl = shadow.getElementById('heatchip');
    if (s.analysis && s.analysis.ok) {
      const t = s.analysis.trend.state;
      trendEl.innerHTML = trendChip(t) + (s.analysis.htf ? trendChip(s.analysis.htf, '15m') : '');
      const h = s.analysis.chase.heat;
      heatEl.innerHTML = `<span class="chip ${h}" title="Entry heat"><span>${HEAT_TEXT[h]}</span></span>`;
    } else {
      trendEl.innerHTML = '';
      heatEl.innerHTML = '';
    }
    let html = '';
    if (s.error) html += sec('Status', `<div class="warn">${esc(s.error)}</div>`);
    const a = s.analysis;
    const m = s.fmt || P.money;

    if (a && a.ok) {
      const c = a.chase;
      const g = a.gauss || null;
      const advice = [];
      if (c.heat === 'extreme' || c.heat === 'hot') {
        advice.push(`Stretched: ${P.pct(c.ch15)} in 15m, ${c.ext.toFixed(1)} ATR above EMA21.`);
        advice.push(a.plan.buyZone ? `Wait for a pullback into ${m(a.plan.buyZone.lo)} – ${m(a.plan.buyZone.hi)}.` : 'Wait for a pullback and a higher low.');
      } else if (c.heat === 'warm') {
        advice.push('Getting stretched. If you buy, go small and set the stop first.');
      } else if (a.trend.state === 'down') {
        advice.push('Calm, but the trend is down. Catching a falling knife is how the big losses start.');
      } else {
        advice.push('Not chasing: price is near its average.');
      }
      if (g && g.zone === 'above') advice.push(`Price is above the top Gaussian band: statistically stretched${g.sinceTopCross !== null && g.sinceTopCross <= 3 ? ' (crossed it ' + (g.sinceTopCross === 0 ? 'this bar' : g.sinceTopCross + ' bar' + (g.sinceTopCross > 1 ? 's' : '') + ' ago') + ')' : ''}.`);
      else if (g && g.zone === 'below' && g.slope === 'falling') advice.push('Below the bottom Gaussian band with the channel still falling: no bottom yet.');
      if (c.toResPct !== null && c.toResPct < 0) advice.push('Price is sitting inside a resistance zone.');
      else if (c.toResPct !== null && c.toResPct < 0.03) advice.push(`Resistance only ${P.pct(c.toResPct)} above.`);
      const stat = (k, v) => `<div><b>${k}</b><span>${v}</span></div>`;
      html += sec(
        'Entry check',
        P.gaussMeter(g) +
          `<div class="heatrow"><div class="badge ${c.heat}"><span>${HEAT_TEXT[c.heat]}</span></div><div class="hstats">${stat('RSI', c.rsi.toFixed(0))}${stat('EMA21', (c.ext >= 0 ? '+' : '') + c.ext.toFixed(1) + ' ATR')}${g ? stat('Gauss', g.slope === 'rising' ? 'rising' : 'falling') : ''}</div></div>` +
          row('5m / 15m / 1h', `${P.pct(c.ch5)} / ${P.pct(c.ch15)} / ${P.pct(c.ch60)}`) +
          (g ? row('Gaussian channel', GZONE[g.zone], g.zone === 'above' ? 'bad' : g.zone === 'below' ? 'warn' : '') : '') +
          (a.fomoLine ? row('FOMO line (HOT above)', m(a.fomoLine.hot), c.heat === 'hot' || c.heat === 'extreme' ? 'bad' : '') : '') +
          `<div class="advice">${advice.map(esc).join('<br>')}</div>`
      );

      const p = a.plan;
      let planHtml = '';
      if (p.buyZone) {
        const bz = p.buyZone;
        planHtml +=
          row(bz.fromEma ? 'Buy zone (EMA21)' : 'Buy zone (support)', `${m(bz.lo)} – ${m(bz.hi)}`, bz.valid ? 'good' : 'muted') +
          row('Stop if wrong', m(bz.stop), 'bad') +
          row('Targets', `${m(bz.t1)} · ${m(bz.t2)}`, 'good') +
          row('Reward / risk', bz.rr.toFixed(1) + 'R', bz.valid ? 'good' : 'warn');
        if (!bz.valid) planHtml += `<div class="muted" style="margin-top:6px">Reward/risk under 1.5R: skip, or wait for a deeper pullback.</div>`;
        if (bz.inZone) planHtml += `<div class="alert good">Price is inside the buy zone.</div>`;
      } else if (p.reclaim) {
        planHtml += `<div class="warn">No long setup: downtrend.</div>` + row('Wait for a close above', m(p.reclaim.level));
      } else {
        planHtml += `<div class="muted">No clear setup on this timeframe.</div>`;
      }
      if (p.breakout) planHtml += row('Breakout trigger', `above ${m(p.breakout.trigger)} (stop ${m(p.breakout.stop)})`, 'warn');
      if (p.takeProfit.length) planHtml += row('Take-profit zones', p.takeProfit.map((z) => `${m(z.lo)}–${m(z.hi)}`).join(' · '));
      html += sec('Plan', planHtml);

      if (a.position) {
        const q = a.position;
        const stopText = q.stopKind === 'breakeven' ? `${m(q.stop)} (your entry)` : q.stopKind === 'emergency' ? (q.distStopPct >= 0 ? `${m(q.stop)} (price is below it)` : `${m(q.stop)} (${P.pct(q.distStopPct)})`) : 'none set';
        let ph =
          row('Avg entry', m(q.entry)) +
          row('P&L now', P.pct(q.pnl), q.pnl >= 0 ? 'good' : 'bad') +
          (q.peakKnown ? row('Best since buy', P.pct(q.peakPnl), 'good') : '') +
          row(q.stopKind === 'breakeven' ? 'Stop (moved to entry)' : 'Emergency stop', stopText, 'bad') +
          row('Sell half at', m(q.takeHalf), 'good');
        if (q.trail !== null) ph += row('Trailing stop', m(q.trail), 'warn');
        if (q.ageH) ph += row('Held for', q.ageH < 1 ? Math.round(q.ageH * 60) + 'm' : q.ageH.toFixed(1) + 'h', q.ageH > 24 && q.pnl < 0 ? 'bad' : '');
        if (q.status === 'protect') ph += `<div class="alert bad">Back to your entry after being up 25%+. Your rule: sell.${root.FCPersonal ? ' ' + root.FCPersonal.lines.protect : ''}</div>`;
        else if (q.status === 'emergency') ph += `<div class="alert bad">Emergency stop hit. Get out; don't average down.</div>`;
        else if (q.status === 'trail') ph += `<div class="alert warn">Trailing stop hit: sell the rest.</div>`;
        else if (q.status === 'takehalf') ph += `<div class="alert good">Up 50%+: sell half now.${root.FCPersonal ? ' ' + root.FCPersonal.lines.takeHalf : ' Most memecoin winners give back most of their move.'}</div>`;
        else if (q.status === 'armed') ph += `<div class="alert good">You were up 25%+: your stop is now your entry. Follow it and this trade can't turn into a loss.</div>`;
        html += sec('Your position', ph);
      }
    } else if (a && !a.ok) {
      html += sec('Chart', `<div class="muted">${esc(a.reason)}</div>`);
    }

    if (s.holders) {
      const h = s.holders;
      const share = h.fomoHolders ? h.inProfit / h.fomoHolders : 0;
      const lines = h.top
        .slice(0, 5)
        .map((x) => `<li class="muted">${esc(x.user || 'trader')}${x.dev ? ' <span class="bad">DEV</span>' : ''}: ${P.money(x.valueUsd)} · P&amp;L <span class="${(x.pnlUsd || 0) >= 0 ? 'good' : 'bad'}">${P.money(x.pnlUsd)}</span>${x.holdH ? ' · avg hold ' + x.holdH + 'h' : ''}</li>`)
        .join('');
      html += sec(
        'FOMO traders holding',
        row('On FOMO', `${h.fomoHolders}${h.totalHolders ? ' of ' + P.num(h.totalHolders) + ' holders' : ''}`) +
          row('In profit', `${h.inProfit} of ${h.fomoHolders}`, share >= 0.5 ? 'good' : 'warn') +
          (h.devHolding ? '<div class="bad">The dev is among them.</div>' : '') +
          (lines ? `<ul>${lines}</ul>` : '')
      );
    }

    html += holdersIntelSection(s.holderData);
    html += callSection(s.call);
    html += rundownSection(s.rundown);

    if (s.risk) {
      const r = s.risk;
      const cls = r.level === 'high' ? 'bad' : r.level === 'medium' ? 'warn' : 'good';
      const EV = { data: 'data', tool: 'tool rule', prac: 'trader rule', own: 'our rule' };
      html += sec('Token risk', row('Risk', r.level.toUpperCase(), cls) + (r.reasons.length ? `<ul>${r.reasons.map((x) => `<li class="${x.bad ? 'bad' : 'muted'}">${esc(x.text)}${x.ev && EV[x.ev] ? `<span class="ev">${EV[x.ev]}</span>` : ''}</li>`).join('')}</ul>` : ''));
    }

    if (s.flow && (s.flow.m5 || s.flow.h1 || s.flow.h24)) {
      const f = s.flow;
      const line = (label, w) =>
        w
          ? `<span>${label}</span><span><span class="${(w.netUsd || 0) >= 0 ? 'good' : 'bad'}">${w.netUsd === null ? '–' : (w.netUsd >= 0 ? '+' : '') + P.money(w.netUsd)}</span></span><span>${P.num(w.uniqueBuyers)}</span><span>${P.num(w.uniqueSellers)}</span>`
          : '';
      html += sec('Flow', `<div class="ftab"><span class="fh">Window</span><span class="fh">Net</span><span class="fh">Buyers</span><span class="fh">Sellers</span>${line('5 min', f.m5)}${line('1 hour', f.h1)}${line('24 hours', f.h24)}</div>`);
    }

    if (s.discipline) {
      const d = s.discipline;
      html += sec('Discipline', d.items.map((it) => `<div class="alert ${it.level}">${esc(it.text)}</div>`).join('') || '<div class="muted">No rule warnings.</div>');
    }
    const scroll = body.scrollTop;
    body.innerHTML = html + `<div class="sec"><button class="rbtn pri" data-act="journal">Open trade journal</button></div>`;
    body.scrollTop = scroll;
  };

  // ---------------------------------------------------------------- who holds it (holder profiles)
  const EXPLORER = { sol: 'https://solscan.io/account/', bsc: 'https://bscscan.com/address/', base: 'https://basescan.org/address/', eth: 'https://etherscan.io/address/' };
  const HOLDER_ROLE_TAG = { insider: ['insider', 'bad'], dev: ['dev', 'bad'], bundler: ['bundler', 'bad'], sniper: ['sniper', 'warn'], fresh: ['fresh', 'warn'], smart: ['smart', 'good'], kol: ['KOL', 'warn'], fomo: ['fomo', ''] };
  const HOLDER_STYLE_CLS = { 'Losing trader': 'bad', 'Moon catcher': 'good', 'Profit taker': 'good', Sharp: 'good' };
  const EV_LABEL = { data: 'data', tool: 'tool rule', prac: 'trader rule', own: 'our rule' };
  const shortAddr = (a) => (a.length > 12 ? a.slice(0, 4) + '…' + a.slice(-4) : a);
  const pctH = (x) => (!Number.isFinite(x) ? '–' : (x >= 10 ? x.toFixed(0) : x.toFixed(1)) + '%');
  const holdFmt = (s) => (s < 3600 ? Math.round(s / 60) + 'm' : s < 86400 ? (s / 3600).toFixed(1) + 'h' : (s / 86400).toFixed(1) + 'd');

  // THE CALL: today's points and rank, the week, calls still open. The card on the page asks; this is the scoreboard.
  function callSection(c) {
    if (!c) return '';
    const title = 'The call';
    const btns = '<div class="rrow"><button class="rbtn" data-act="calls">My calls</button><button class="rbtn" data-act="board">Caller board</button></div>';
    if (!c.today) {
      if (c.offline) return sec(title, '<div class="muted">THE CALL is offline right now.</div>');
      return sec(title, '<div class="muted">When a token turns HOT or EXTREME, make the call: buy or wait. Nothing gets traded. It settles 15 minutes later with the real price, and your calls build a track record on the caller board.</div>' + btns);
    }
    const t = c.today;
    const w = c.week || {};
    const pts = (x) => (x > 0 ? '+' + x : String(x || 0));
    const now = Date.now() / 1000;
    const mmss = (s) => (s <= 0 ? 'settling' : Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'));
    let html =
      row(t.n >= 1 ? `Day ${t.n}` : 'Practice (before launch)', `${pts(t.points)} pts${t.rank ? ' · #' + t.rank : ''}`, t.points > 0 ? 'good' : t.points < 0 ? 'bad' : '') +
      row('Calls today', `${t.settled} settled · ${t.right} right · ${t.left} left`) +
      (w.n >= 1 ? row(`Week ${w.n}`, `${pts(w.points)} pts${w.rank ? ' · #' + w.rank : ''}`) : '');
    if (c.open && c.open.length) {
      html += '<ul>' + c.open.slice(0, 4).map((o) => `<li>${esc(String(o.side).toUpperCase())} on $${esc(o.symbol || '?')} · ${mmss(o.settleAt - now)}</li>`).join('') + '</ul>';
    }
    if (t.settled < 3) html += `<div class="muted" style="margin-top:6px">${3 - t.settled} more settled call${3 - t.settled > 1 ? 's' : ''} today to show on the caller board.</div>`;
    if (!c.handle) html += '<div class="muted" style="margin-top:6px">You show up as anon. Pick a name in settings.</div>';
    return sec(title, html + btns);
  }

  function holdersIntelSection(h) {
    if (!h) return '';
    const title = 'Who holds it';
    const res = h.res;
    if (!res) return sec(title, '<div class="muted">Loading top holders…</div>');
    if (!res.ok) return sec(title, `<div class="muted">${esc(res.error || 'Holder data failed.')}</div>` + (res.needsSetup || res.soon ? '<button class="rbtn" data-act="settings">Open settings</button>' : ''));
    const S = res.summary;
    const c = S.components;
    const sp = S.supply;
    const n = S.counts;
    const v = res.vote;
    const voteRow = v
      ? row('Vote', `${v.score} / 100`, { high: 'good', mid: 'warn', low: 'bad' }[v.band]) +
        (v.rate !== null && v.base !== null ? `<div class="muted" style="margin:-2px 0 4px">Tokens voting ${v.band === 'high' ? '70+' : v.band === 'mid' ? '40 to 69' : 'under 40'} on ${esc(v.chainName)} reached +50% before -50% in ${Math.round(v.rate * 100)}% of tests (all: ${Math.round(v.base * 100)}%)</div>` : '')
      : row('Vote', '–');
    let html =
      voteRow +
      row('Bundlers / snipers / insiders', `${pctH(sp.bundler)} / ${pctH(sp.sniper)} / ${pctH(sp.insider)}`, sp.bundler + sp.insider > 15 ? 'bad' : '') +
      row('Fresh wallets', pctH(sp.fresh)) +
      row('Smart money / KOLs', `${n.smart} / ${n.kol}`) +
      (n.fomo ? row('FOMO users', `${n.fomo} (${pctH(sp.fomo)})`) : '') +
      (S.clusters.length ? row('Shared funder', `${S.clusters[0].wallets} wallets, ${pctH(S.clusters[0].pct)}`, S.clusters[0].pct > 15 ? 'bad' : 'warn') : '');
    if (c.profiled) {
      html += row('Profiled, last 30 days', `${c.profiled} · median win ${c.medianWinrate === null ? '–' : Math.round(c.medianWinrate * 100) + '%'}`);
      const count = (k, one, many) => (k ? `${k} ${k > 1 ? many : one}` : '');
      const mix = [count(c.moonN, 'moon catcher', 'moon catchers'), count(c.takerN, 'profit taker', 'profit takers'), count(c.sharpN, 'sharp', 'sharp'), count(c.losingN, 'losing', 'losing'), count(c.scalperN, 'scalper', 'scalpers'), count(c.botN, 'bot-like', 'bot-like')].filter(Boolean).join(' · ');
      if (mix) html += `<div class="muted" style="margin-top:4px">${mix}</div>`;
    }
    if (S.warnings.length) html += `<ul>${S.warnings.map((w) => `<li class="${w.level === 'bad' ? 'bad' : w.level === 'warn' ? 'warn' : 'muted'}">${esc(w.text)}${w.ev && EV_LABEL[w.ev] ? `<span class="ev">${EV_LABEL[w.ev]}</span>` : ''}</li>`).join('')}</ul>`;
    const items = S.rows.slice(0, 8).map((r, i) => {
      const addr = String(r.address || '');
      const link = /^[A-Za-z0-9]{32,64}$/.test(addr) && EXPLORER[res.chain] ? `<a href="${EXPLORER[res.chain]}${addr}" target="_blank" rel="noopener noreferrer">${esc(shortAddr(addr))}</a>` : esc(shortAddr(addr));
      const tags = r.roles.map((k) => (HOLDER_ROLE_TAG[k] ? `<span class="tag ${HOLDER_ROLE_TAG[k][1]}">${HOLDER_ROLE_TAG[k][0]}</span>` : '')).join('') + (r.platform && r.platform !== 'fomo' ? `<span class="tag">${esc(r.platform)}</span>` : '');
      const pnl = r.tokenPnlUsd === null ? '' : ` · on it <span class="${r.tokenPnlUsd >= 0 ? 'good' : 'bad'}">${P.money(r.tokenPnlUsd)}</span>`;
      let l2 = '';
      const st = r.stats;
      if (st) {
        const sty = r.style;
        l2 = `30d win ${st.winrate === null ? '–' : Math.round(st.winrate * 100) + '%'} · <span class="${(st.realizedUsd || 0) >= 0 ? 'good' : 'bad'}">${P.money(st.realizedUsd)}</span> · ${P.money(st.evPerTokenUsd)}/token${st.avgHoldSec === null ? '' : ' · hold ' + holdFmt(st.avgHoldSec)}${sty ? ` · <span class="${HOLDER_STYLE_CLS[sty.label] || ''}">${esc(sty.label)}</span>` : ''}`;
      } else if (res.pending || res.profiling) l2 = '<span class="muted">profiling…</span>';
      return `<li><span class="ix">${String(i + 1).padStart(2, '0')}</span>${link} ${pctH(r.pct)} · ${P.money(r.usd)}${pnl} ${tags}${l2 ? `<div class="l2">${l2}</div>` : ''}</li>`;
    });
    html += items.length ? `<ul class="hl">${items.join('')}</ul>` : '<div class="muted">No holder list for this token yet.</div>';
    const status = res.bannedFor ? `Holder data rate limit, resuming in ${res.bannedFor}s` : res.pending ? `Profiling ${res.pending} more wallet${res.pending > 1 ? 's' : ''}…` : res.error || '';
    html += `<div class="rfoot"><span>${status ? esc(status) + ' · ' : ''}labels are our rules${res.logCount ? ` · ${res.logCount} tokens in your holder log` : ''}</span><button class="btn" data-act="holders-refresh" title="Refresh holders">⟳</button></div>`;
    return sec(title, html);
  }

  function rundownSection(r) {
    const btn = (act, label, pri) => `<button class="rbtn${pri ? ' pri' : ''}" data-act="${act}">${label}</button>`;
    const title = 'Narrative';
    if (!r) return sec(title, `<div class="rd">What this token is, what the name means, where it came from and whether it does anything. Reads X and the web. Free with MOFO.</div>${btn('rundown', 'What is this token?', true)}`);
    if (r.loading) return sec(title, `<div class="rd thinking">Reading X and the web for the story… ${Math.round((Date.now() - r.startedAt) / 1000)}s</div>`);
    const res = r.result || {};
    if (!res.ok) return sec(title, `<div class="warn">${esc(res.error || 'The rundown failed.')}</div>${res.needsSetup || res.soon ? btn('settings', 'Open settings', true) : res.limit ? '' : btn('rundown-refresh', 'Try again')}`);
    const d = res.rundown;
    if (!d) return sec(title, `<div class="rd">Couldn't put the story together this time. Asking again usually works.</div>${btn('rundown-refresh', 'Try again', true)}`);
    const known = (v) => v && !/^unknown\.?$/i.test(String(v).trim());
    const line = (label, v) => (known(v) ? `<div class="rk">${label}</div><div class="rd">${esc(v)}</div>` : '');
    // Posts the model picked, but only ids that really were in the data it saw; otherwise the top-ranked posts.
    const seen = new Map((Array.isArray(res.posts) ? res.posts : []).map((p) => [String(p.id), p]));
    const valid = (p) => p && /^\d+$/.test(String(p.id)) && /^[A-Za-z0-9_]{1,15}$/.test(String(p.user || ''));
    let picks = (Array.isArray(d.keyPosts) ? d.keyPosts : []).map((k) => (k && seen.has(String(k.id)) ? Object.assign({}, seen.get(String(k.id)), { why: k.why }) : null)).filter(valid);
    if (!picks.length) picks = (Array.isArray(res.topPosts) ? res.topPosts : []).filter(valid);
    const posts = picks
      .slice(0, 3)
      .map((p) => `<li><a href="https://x.com/${p.user}/status/${p.id}" target="_blank" rel="noopener noreferrer">@${esc(p.user)}</a>${p.followers ? ` <span class="muted">${P.num(p.followers)} followers</span>` : ''}${p.why ? ` <span class="muted">· ${esc(String(p.why).slice(0, 80))}</span>` : ''}<div class="rd">${esc(String(p.text || '').slice(0, 160))}</div></li>`)
      .join('');
    const sources = (Array.isArray(d.sources) ? d.sources : [])
      .filter((x) => x && /^https?:\/\//.test(String(x.url || '')))
      .slice(0, 3)
      .map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.title || x.url)}</a>`)
      .join(' · ');
    const mins = Math.round((Date.now() - (res.at || Date.now())) / 60000);
    const notes = [res.cached ? `saved ${mins}m ago` : 'fresh', res.free ? 'free' : `~$${(res.costUsd || 0).toFixed(3)}`, `${Math.round((res.ms || 0) / 1000)}s`];
    if (res.x && res.x.skipped) notes.push('no X key: web only');
    if (res.x && res.x.errors && res.x.errors.length) notes.push(`X errors: ${res.x.errors.length}`);
    return sec(
      title,
      `<div class="rd">${known(d.type) ? `<span class="tag">${esc(d.type)}</span> ` : ''}${esc(known(d.narrative) ? d.narrative : 'No clear story found in the posts or on the web.')}</div>` +
        line('Name', d.name) +
        line('Origin', d.origin) +
        line('Utility', d.utility) +
        (posts ? `<div class="rk">Key posts</div><ul class="posts">${posts}</ul>` : '') +
        (sources ? `<div class="rk">Sources</div><div class="rd src">${sources}</div>` : '') +
        `<div class="rfoot"><span>${esc(notes.join(' · '))}</span>${btn('rundown-refresh', 'Refresh')}</div>`
    );
  }

  // Assistant text: escaped first, then light formatting (bullets, **bold**, paragraphs).
  function fmtMsg(t) {
    const lines = esc(t).split('\n');
    let html = '';
    let inList = false;
    for (const line of lines) {
      const m = line.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)$/);
      if (m) {
        if (!inList) {
          html += '<ul>';
          inList = true;
        }
        html += '<li>' + m[1] + '</li>';
        continue;
      }
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      html += line.trim() ? '<div>' + line + '</div>' : '<div class="gap"></div>';
    }
    if (inList) html += '</ul>';
    return html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  }

  P.chatRender = function (th) {
    if (!shadow) return;
    const log = shadow.getElementById('chatlog');
    if (!log) return;
    const msgs = (th && th.messages) || [];
    let html = msgs.length ? '' : '<div class="muted">Ask anything about this token: an entry, where you are wrong, the holders, the latest news. MOFO sees the chart analysis, the flow, the holders and your rules.</div>';
    for (const m of msgs) {
      if (m.role === 'user') html += `<div class="msg user">${esc(m.text)}</div>`;
      else if (m.error) html += `<div class="msg assistant err">${esc(m.text)}${m.needsSetup ? '<div><button class="rbtn pri" data-act="settings">Open settings</button></div>' : ''}</div>`;
      else html += `<div class="msg assistant">${fmtMsg(m.text)}${m.free ? `<div class="mcost">free${Number.isFinite(m.left) ? ` · ${m.left} left today` : ''} · ${Math.round((m.ms || 0) / 1000)}s</div>` : Number.isFinite(m.costUsd) ? `<div class="mcost">~$${m.costUsd.toFixed(3)} · ${Math.round((m.ms || 0) / 1000)}s</div>` : ''}</div>`;
    }
    if (th && th.busy) html += '<div class="msg assistant thinking">MOFO is reading the chart, the flow and X…</div>';
    log.innerHTML = html;
    log.scrollTop = log.scrollHeight;
  };

  root.FCPanel = P;
})(window);
