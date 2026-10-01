/* MOFO: bridge to the TradingView chart embedded in fomo.family.
   Everything drawn is locked, unselectable and excluded from the saved chart layout (disableSave).
   Drawings are pure white; meaning is carried by line style, width and label, never by color. */
(function (root) {
  'use strict';
  const TV = {};
  const drawn = new Set();
  const WHITE = '#EAEDFF';
  TV.STYLE = { solid: 0, dotted: 1, dashed: 2, longDash: 3 };

  function frameWin() {
    for (const f of document.querySelectorAll('iframe')) {
      try {
        if (f.contentWindow && f.contentWindow.tradingViewApi) return f.contentWindow;
      } catch (e) {
        /* cross-origin frame */
      }
    }
    return null;
  }
  TV.frameWin = frameWin;

  TV.api = function () {
    const w = frameWin();
    return w ? w.tradingViewApi : null;
  };

  TV.chart = function (api) {
    try {
      return api ? api.activeChart() : null;
    } catch (e) {
      return null;
    }
  };

  TV.resolutionSec = function (chart) {
    const r = String(chart.resolution());
    const m = r.match(/^(\d*)([SDWM]?)$/i);
    if (!m) return 60;
    const n = m[1] ? parseInt(m[1], 10) : 1;
    const unit = (m[2] || '').toUpperCase();
    if (unit === 'S') return n;
    if (unit === 'D') return n * 86400;
    if (unit === 'W') return n * 604800;
    if (unit === 'M') return n * 2592000;
    return n * 60;
  };

  TV.bars = async function (chart) {
    const d = await chart.exportData({ includeTime: true, includeSeries: true, includedStudies: 'all' });
    const schema = d.schema || [];
    const col = (name) => schema.findIndex((s) => s.type === 'value' && s.plotTitle === name);
    const io = col('open');
    const ih = col('high');
    const il = col('low');
    const ic = col('close');
    const iv = col('Volume');
    return (d.data || []).map((r) => ({ t: r[0], o: r[io], h: r[ih], l: r[il], c: r[ic], v: iv >= 0 ? r[iv] || 0 : 0 }));
  };

  const base = (extra) => Object.assign({ lock: true, disableSelection: true, disableSave: true, disableUndo: true, zOrder: 'top' }, extra);

  async function keep(p) {
    try {
      const id = await Promise.resolve(p);
      if (id) drawn.add(id);
      return id;
    } catch (e) {
      return null;
    }
  }

  TV.clear = function (chart) {
    for (const id of drawn) {
      try {
        chart.removeEntity(id);
      } catch (e) {
        /* already gone */
      }
    }
    drawn.clear();
  };

  TV.hline = function (chart, t, price, text, style, width) {
    return keep(
      chart.createShape(
        { time: t, price },
        base({ shape: 'horizontal_line', text: text || '', overrides: { linecolor: WHITE, linewidth: width || 1, linestyle: style || 0, showLabel: !!text, textcolor: WHITE, horzLabelsAlign: 'right', vertLabelsAlign: 'bottom', fontsize: 11, bold: true } })
      )
    );
  };

  // A price zone from t1, extended right. Outline only: a translucent fill would read as grey.
  TV.zone = function (chart, t1, t2, lo, hi, text, style, width) {
    return keep(
      chart.createMultipointShape(
        [
          { time: t1, price: lo },
          { time: t2, price: hi },
        ],
        base({ shape: 'rectangle', text: text || '', overrides: { color: WHITE, linewidth: width || 1, linestyle: style || 0, fillBackground: false, backgroundColor: 'rgba(0,0,0,0)', transparency: 100, extendRight: true, showLabel: !!text, textColor: WHITE, fontSize: 11, bold: true, horzLabelsAlign: 'left', vertLabelsAlign: 'top' } })
      )
    );
  };

  TV.marker = function (chart, t, price, up, text) {
    return keep(chart.createShape({ time: t, price }, base({ shape: up ? 'arrow_up' : 'arrow_down', text: text || '', overrides: { arrowColor: WHITE, color: WHITE, fontsize: 11, bold: true } })));
  };

  TV.text = function (chart, t, price, text) {
    return keep(chart.createShape({ time: t, price }, base({ shape: 'text', text, overrides: { color: WHITE, fontsize: 10, bold: true } })));
  };

  // Open polyline through [{time, price}]. Falls back to the 'path' tool (no arrow heads) if polyline is refused.
  let polyShape = 'polyline';
  TV.polyline = async function (chart, points, style, width) {
    if (!points || points.length < 2) return null;
    const ov = { linecolor: WHITE, linewidth: width || 1, linestyle: style || 0, fillBackground: false, transparency: 100, lineColor: WHITE, lineWidth: width || 1, lineStyle: style || 0, leftEnd: 0, rightEnd: 0 };
    const make = (shape) => Promise.resolve(chart.createMultipointShape(points, base({ shape, overrides: ov })));
    let id = null;
    try {
      id = await make(polyShape);
    } catch (e) {
      id = null;
    }
    if (!id && polyShape === 'polyline') {
      polyShape = 'path';
      try {
        id = await make('path');
      } catch (e) {
        id = null;
      }
    }
    if (id) drawn.add(id);
    return id;
  };

  // Last `maxBars` bars, thinned to at most `maxPts` points; the newest bar is always kept.
  TV.thin = function (times, values, maxBars, maxPts) {
    const n = times.length;
    const from = Math.max(0, n - (maxBars || 400));
    const step = Math.max(1, Math.ceil((n - from) / (maxPts || 200)));
    const out = [];
    for (let i = from; i < n; i += step) if (Number.isFinite(values[i])) out.push({ time: times[i], price: values[i] });
    if (Number.isFinite(values[n - 1]) && (!out.length || out[out.length - 1].time !== times[n - 1])) out.push({ time: times[n - 1], price: values[n - 1] });
    return out;
  };

  // ---------------------------------------------------------------- candle colors: FOMO's candles and pane recolored
  // Two looks on MOFO's navy pane: black and white (up white, down navy with a white border) or green and red.
  // Applied through whatever the embedded charting library exposes, each call guarded. FOMO's own values are read
  // first where the library allows it, so choosing FOMO's colors again puts them back.
  const MONO_CANDLES = { upColor: '#EAEDFF', downColor: '#0B091F', borderUpColor: '#EAEDFF', borderDownColor: '#EAEDFF', wickUpColor: '#EAEDFF', wickDownColor: '#EAEDFF', drawBorder: true, drawWick: true, barColorsOnPrevClose: false };
  const UP = '#16C784';
  const DOWN = '#EA3943';
  const GREENRED_CANDLES = { upColor: UP, downColor: DOWN, borderUpColor: UP, borderDownColor: DOWN, wickUpColor: UP, wickDownColor: DOWN, drawBorder: true, drawWick: true, barColorsOnPrevClose: false };
  const PALETTE = { mono: MONO_CANDLES, greenred: GREENRED_CANDLES };
  // Volume columns, [down, up]. The charting library only takes #RRGGBB or rgba() here: an 8-digit hex (#RRGGBBAA)
  // throws on every repaint and blanks the whole chart.
  const VOLUME = { mono: ['#EAEDFF', '#EAEDFF'], greenred: ['rgba(234, 57, 67, 0.5)', 'rgba(22, 199, 132, 0.5)'] };
  const rgba = (hex, a) => {
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i.exec(String(hex || '').trim());
    if (!m) return null;
    const alpha = a != null ? a : m[4] ? Math.round((parseInt(m[4], 16) / 255) * 100) / 100 : 1;
    return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
  };
  const MONO_PANE = {
    'paneProperties.background': '#0B091F',
    'paneProperties.backgroundType': 'solid',
    'paneProperties.vertGridProperties.color': '#0B091F',
    'paneProperties.horzGridProperties.color': '#0B091F',
    'scalesProperties.textColor': '#EAEDFF',
    'scalesProperties.lineColor': '#EAEDFF',
  };
  // FOMO's own look: its pane (read from a clean FOMO chart) and the charting library's default candles, which FOMO
  // doesn't override.
  const DARK_DEFAULTS = {
    'paneProperties.background': '#060510',
    'paneProperties.backgroundType': 'solid',
    'paneProperties.vertGridProperties.color': 'rgba(242, 242, 242, 0.06)',
    'paneProperties.horzGridProperties.color': 'rgba(242, 242, 242, 0.06)',
    'scalesProperties.textColor': '#B8B8B8',
    'scalesProperties.lineColor': 'rgba(242, 242, 242, 0)',
    'mainSeriesProperties.candleStyle.upColor': '#089981',
    'mainSeriesProperties.candleStyle.downColor': '#F23645',
    'mainSeriesProperties.candleStyle.borderUpColor': '#089981',
    'mainSeriesProperties.candleStyle.borderDownColor': '#F23645',
    'mainSeriesProperties.candleStyle.wickUpColor': '#089981',
    'mainSeriesProperties.candleStyle.wickDownColor': '#F23645',
  };
  const mono = { on: false, mode: 'fomo', chart: null, report: null };

  function getPath(obj, path) {
    return path.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);
  }

  function applyOverrides(w, api, ov) {
    const tries = [
      ['window.applyOverrides', () => w.applyOverrides(ov)],
      ['api.applyOverrides', () => api.applyOverrides(ov)],
    ];
    for (const [name, fn] of tries) {
      try {
        const target = name.startsWith('window') ? w.applyOverrides : api && api.applyOverrides;
        if (typeof target !== 'function') continue;
        fn();
        return name;
      } catch (e) {
        /* next */
      }
    }
    return null;
  }

  const LS_RESTORE = 'fcp:mono-restore';
  const CANDLE_KEYS = Object.keys(MONO_CANDLES);
  // FOMO saves the chart, colors included, and reloads it on every chart, so what reads as FOMO's colors can really be
  // MOFO's. Anything that matches MOFO's pane or palettes goes back to FOMO's defaults, part by part.
  const MOFO_COLORS = new Set(['#0B091F', '#EAEDFF', UP, DOWN]);
  function cleanSnapshot(snap) {
    const out = Object.assign({}, DARK_DEFAULTS, snap);
    const up = String(out['mainSeriesProperties.candleStyle.upColor'] || '').toUpperCase();
    const down = String(out['mainSeriesProperties.candleStyle.downColor'] || '').toUpperCase();
    if (MOFO_COLORS.has(up) || MOFO_COLORS.has(down)) for (const k of Object.keys(DARK_DEFAULTS)) if (k.startsWith('mainSeriesProperties.')) out[k] = DARK_DEFAULTS[k];
    if (String(out['paneProperties.background'] || '').toUpperCase() === '#0B091F') for (const k of Object.keys(MONO_PANE)) out[k] = DARK_DEFAULTS[k];
    return out;
  }

  function setVolume(chart, [vd, vu]) {
    try {
      for (const s of chart.getAllStudies ? chart.getAllStudies() : []) {
        if (!/volume/i.test(s.name || '')) continue;
        const st = chart.getStudyById(s.id);
        if (st && st.applyOverrides) st.applyOverrides({ 'volume.color.0': vd, 'volume.color.1': vu, 'palettes.volumePalette.colors.0.color': vd, 'palettes.volumePalette.colors.1.color': vu });
      }
    } catch (e) {
      /* no study api */
    }
  }

  // MOFO 0.9.0 and older set 8-digit hex volume colors, and FOMO saved them with the chart. Rewrite any the library
  // can't read, once per chart, whatever the mode.
  function repairVolume(chart) {
    try {
      for (const s of chart.getAllStudies ? chart.getAllStudies() : []) {
        if (!/volume/i.test(s.name || '')) continue;
        const st = chart.getStudyById(s.id);
        const pal = st && st.getStyleValues ? getPath(st.getStyleValues(), 'palettes.volumePalette.colors') : null;
        if (!pal) continue;
        const fix = {};
        for (const i of ['0', '1']) {
          const c = pal[i] && pal[i].color;
          if (/^#[0-9a-f]{8}$/i.test(String(c || ''))) fix[`palettes.volumePalette.colors.${i}.color`] = fix[`volume.color.${i}`] = rgba(c);
        }
        if (Object.keys(fix).length && st.applyOverrides) st.applyOverrides(fix);
      }
    } catch (e) {
      /* no study api */
    }
  }

  // FOMO's own colors, read from the frame's saved chart properties (and the series, when it can say), on top of the
  // TradingView dark defaults for anything missing.
  function readPane(w, series) {
    const out = {};
    try {
      const raw = w.localStorage.getItem('tradingview.chartproperties');
      const props = raw ? JSON.parse(raw) : null;
      if (props) {
        for (const k of Object.keys(MONO_PANE)) {
          const v = getPath(props, k);
          if (v !== undefined) out[k] = v;
        }
        const cs = getPath(props, 'mainSeriesProperties.candleStyle');
        if (cs) for (const k of CANDLE_KEYS) if (cs[k] !== undefined) out['mainSeriesProperties.candleStyle.' + k] = cs[k];
      }
    } catch (e) {
      /* storage blocked */
    }
    try {
      if (series && typeof series.chartStyleProperties === 'function') {
        const cs = series.chartStyleProperties(1) || {};
        for (const k of CANDLE_KEYS) if (cs[k] !== undefined) out['mainSeriesProperties.candleStyle.' + k] = cs[k];
      }
    } catch (e) {}
    return Object.assign({}, DARK_DEFAULTS, out);
  }

  const candlesFrom = (snap) => {
    const o = {};
    for (const k of CANDLE_KEYS) if (snap['mainSeriesProperties.candleStyle.' + k] !== undefined) o[k] = snap['mainSeriesProperties.candleStyle.' + k];
    return o;
  };

  // mode 'mono' (or true) and 'greenred' recolor; 'fomo' (or false) puts FOMO's colors back, only if MOFO changed them.
  // FOMO's colors are saved once, before the first recolor, so a reload with a recolor on never mistakes MOFO's colors
  // for FOMO's. Returns what the library allowed.
  TV.mono = function (chart, modeIn) {
    const mode = modeIn === true ? 'mono' : PALETTE[modeIn] ? modeIn : 'fomo';
    const on = mode !== 'fomo';
    const w = frameWin();
    const api = w && w.tradingViewApi;
    if (!w || !chart) return null;
    if (mono.repaired !== chart) {
      mono.repaired = chart;
      repairVolume(chart);
    }
    if (mode === mono.mode && mono.chart === chart && mono.report) return mono.report;
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(LS_RESTORE) || 'null');
    } catch (e) {}
    if (!on && !mono.on && !saved) return null;
    let series = null;
    try {
      series = chart.getSeries ? chart.getSeries() : null;
    } catch (e) {
      series = null;
    }
    const setCandles = (props) => {
      try {
        if (series && typeof series.setChartStyleProperties === 'function') {
          series.setChartStyleProperties(1, props);
          return 'series.setChartStyleProperties';
        }
      } catch (e) {}
      return null;
    };
    const report = { on, mode, pane: null, candles: null };
    if (on) {
      if (!saved) {
        saved = cleanSnapshot(readPane(w, series));
        try {
          localStorage.setItem(LS_RESTORE, JSON.stringify(saved));
        } catch (e) {}
      }
      const candles = PALETTE[mode];
      report.candles = setCandles(candles);
      const ov = Object.assign({}, MONO_PANE);
      if (!report.candles) for (const [k, v] of Object.entries(candles)) ov['mainSeriesProperties.candleStyle.' + k] = v;
      report.pane = applyOverrides(w, api, ov);
      if (!report.candles && report.pane) report.candles = report.pane;
      // Volume columns: white both ways in black and white (the candle already says which way it went), half-strength
      // red and green with the green and red candles.
      setVolume(chart, VOLUME[mode]);
    } else {
      const snap = cleanSnapshot(saved || {});
      report.candles = setCandles(candlesFrom(snap));
      report.pane = applyOverrides(w, api, snap);
      const vol = [rgba(snap['mainSeriesProperties.candleStyle.downColor'], 0.5), rgba(snap['mainSeriesProperties.candleStyle.upColor'], 0.5)];
      if (vol[0] && vol[1]) setVolume(chart, vol);
      try {
        localStorage.removeItem(LS_RESTORE);
      } catch (e) {}
    }
    mono.on = on;
    mono.mode = mode;
    mono.chart = chart;
    mono.report = report;
    return report;
  };
  TV.monoReport = () => mono.report;

  TV.onChange = function (chart, cb) {
    const subs = [];
    try {
      chart.onSymbolChanged().subscribe(null, cb);
      subs.push(() => chart.onSymbolChanged().unsubscribe(null, cb));
    } catch (e) {}
    try {
      chart.onIntervalChanged().subscribe(null, cb);
      subs.push(() => chart.onIntervalChanged().unsubscribe(null, cb));
    } catch (e) {}
    try {
      chart.onDataLoaded().subscribe(null, cb);
      subs.push(() => chart.onDataLoaded().unsubscribe(null, cb));
    } catch (e) {}
    return () => subs.forEach((f) => {
      try {
        f();
      } catch (e) {}
    });
  };

  root.FCTV = TV;
})(window);
