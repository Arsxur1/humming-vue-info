/* HFO Explainer — Conventional ventilation TRAINER screen.
   A device display in the Humming Vue shell where you can practise on
   A/C · VG · SIMV · CPAP · NIV: turn the knobs, watch Paw / Flow / Volume
   waveforms scroll, and see Vt, MAP, MVe, SpO₂ and pCO₂ respond live. */

const { useState: useStateC, useEffect: useEffectC, useRef: useRefC, useMemo: useMemoC } = React;

/* ---------- weight categories (compliance & resistance model) ---------- */
const CONV_CATS = {
  elbw:      { label: "500–1000 г", weight: 0.8, cKg: 0.45, R: 110, optMap: 8,  vtKg: 5, spontRate: 55,
               rate: 50, pip: 18, peep: 5, ti: 0.30, fio2: 40, ipap: 16, epap: 5, ps: 8, cpap: 6 },
  infant:    { label: "1–10 кг",   weight: 3,   cKg: 0.42, R: 80,  optMap: 10, vtKg: 5, spontRate: 45,
               rate: 40, pip: 18, peep: 5, ti: 0.35, fio2: 40, ipap: 18, epap: 5, ps: 9, cpap: 6 },
  pediatric: { label: "10 кг +",   weight: 15,  cKg: 0.40, R: 30,  optMap: 12, vtKg: 6, spontRate: 24,
               rate: 22, pip: 20, peep: 5, ti: 0.70, fio2: 40, ipap: 20, epap: 5, ps: 10, cpap: 7 },
};
const CONV_MODES = ["ac", "vg", "simv", "cpap", "niv"];
const CONV_SCEN_TONE = { optimal: "", lowCompliance: "warn", highResistance: "warn", leak: "danger" };

function clampC(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/* knob visibility + ranges per mode */
function knobsForMode(mode, W) {
  const r = (key, min, max, step) => ({ key, min, max, step });
  switch (mode) {
    case "ac":   return [r("rate", 10, 80, 1), r("pip", W.peep + 4, 40, 1), r("peep", 3, 12, 1), r("ti", 0.25, 1.0, 0.05), r("fio2", 21, 100, 1)];
    case "vg":   return [r("vt", Math.round(W.weight * 3), Math.round(W.weight * 8), 0.5), r("rate", 10, 80, 1), r("peep", 3, 12, 1), r("ti", 0.25, 1.0, 0.05), r("fio2", 21, 100, 1)];
    case "simv": return [r("rate", 6, 50, 1), r("pip", W.peep + 4, 40, 1), r("ps", 4, 20, 1), r("peep", 3, 12, 1), r("fio2", 21, 100, 1)];
    case "cpap": return [r("cpap", 4, 10, 0.5), r("fio2", 21, 100, 1)];
    case "niv":  return [r("ipap", 8, 28, 1), r("epap", 3, 10, 1), r("rate", 10, 60, 1), r("fio2", 21, 100, 1)];
    default:     return [];
  }
}

/* ---------- physics ---------- */
function computeConv({ cat, mode, scenario, p }) {
  const W = CONV_CATS[cat];
  const weight = W.weight;
  const complFactor = scenario === "lowCompliance" ? 0.5 : 1.0;
  const resFactor   = scenario === "highResistance" ? 3.0 : 1.0;
  const leakFactor  = scenario === "leak" ? 0.6 : 1.0;       // delivered fraction
  const C = W.cKg * weight * complFactor;                    // mL/cmH₂O
  const R = W.R * resFactor;
  const tau = clampC((R * C) / 1000, 0.03, 0.45);            // s

  const optMap = W.optMap + (scenario === "lowCompliance" ? 2 : 0);

  let peep, pipSet, rate, ti, vtTarget, pipAuto = null, atLimit = false, spont = false;
  const Pmax = W.peep + 30;

  if (mode === "niv") { peep = p.epap; pipSet = p.ipap; rate = p.rate; ti = 0.4; }
  else if (mode === "cpap") { peep = p.cpap; pipSet = p.cpap; rate = W.spontRate; ti = 0; spont = true; }
  else { peep = p.peep; pipSet = p.pip; rate = p.rate; ti = p.ti; }

  const T = rate > 0 ? 60 / rate : 0;
  const fillFrac = ti > 0 ? (1 - Math.exp(-ti / tau)) : (1 - Math.exp(-0.4 / tau));

  let vt;
  if (mode === "vg") {
    vtTarget = p.vt;
    const reqPip = peep + vtTarget / Math.max(0.05, C * fillFrac);
    pipAuto = Math.min(Pmax, reqPip);
    atLimit = reqPip > Pmax + 0.1;
    pipSet = pipAuto;
    vt = C * (pipAuto - peep) * fillFrac;
  } else if (mode === "cpap") {
    // patient-driven spontaneous tidal volume; CPAP supports FRC, not ventilation
    const effort = scenario === "leak" ? 0.7 : 1.0;
    vt = W.vtKg * weight * 0.85 * effort;
  } else {
    vt = C * (pipSet - peep) * fillFrac;
  }
  vt = Math.max(0, vt * (mode === "niv" || mode === "cpap" ? leakFactor : 1));

  const drive = pipSet - peep;
  const Pmean = mode === "cpap" ? peep
    : peep + drive * (T > 0 ? clampC(ti / T, 0, 0.6) : 0.33) * 0.9;

  // minute & alveolar ventilation → pCO₂
  const vd = 2 * weight;                          // deadspace mL
  let effRate = rate;
  if (mode === "simv") effRate = rate + Math.max(0, W.spontRate * 0.4);  // + supported spont
  const mvAlv = Math.max(1, (vt - vd) * effRate) * (scenario === "highResistance" ? 0.82 : 1);
  const mve = (vt * effRate) / 1000;              // L/min
  const refMvAlv = Math.max(1, (W.vtKg * weight - vd) * W.rate);
  let pco2 = 45 * (refMvAlv / mvAlv);
  pco2 = clampC(pco2, 18, 120);

  // oxygenation from mean airway pressure recruitment + FiO₂
  const dMap = Pmean - optMap;
  let recruit;
  if (dMap <= 0) recruit = clampC(0.5 + (dMap + 6) / 6 * 0.5, 0.18, 1.0);
  else           recruit = clampC(1.0 - dMap * 0.06, 0.30, 1.0);
  let spo2 = 80 + 18 * recruit + (p.fio2 - 30) * 0.18;
  if (scenario === "leak") spo2 -= 3;
  spo2 = clampC(spo2, 40, 100);

  const vtKg = vt / weight;
  const cDyn = C; // dynamic compliance shown
  const apnea = false;

  // alerts
  const vtHigh = vtKg > 7;
  const vtLow = vtKg < 3.2 && mode !== "cpap";
  const pipHigh = pipSet > 32;

  return {
    weight, C, R, tau, T, ti, peep, pipSet, pipAuto, atLimit, rate, effRate,
    vt, vtTarget, vtKg, drive, Pmean, mve, mvAlv, pco2, spo2, recruit, cDyn,
    vtHigh, vtLow, pipHigh, spont, apnea, mode, scenario, Pmax,
  };
}

/* one waveform sample at absolute time (s) */
function sampleConv(s, t) {
  const { mode, T, ti, peep, pipSet, vt, tau, weight } = s;
  if (mode === "cpap" || (mode === "ac" && false)) { /* handled below */ }

  if (mode === "cpap") {
    const Tsp = 60 / Math.max(1, s.rate);
    const ph = (t % Tsp) / Tsp;                   // 0..1
    // spontaneous: small negative dip on inspiration, return on expiration
    const insp = ph < 0.45;
    const paw = peep + (insp ? -1.4 * Math.sin((ph / 0.45) * Math.PI) : 0.3 * Math.sin(((ph - 0.45) / 0.55) * Math.PI));
    const flow = insp ? 1.0 * Math.sin((ph / 0.45) * Math.PI) : -0.8 * Math.sin(((ph - 0.45) / 0.55) * Math.PI);
    const vol = insp ? (vt) * Math.sin((ph / 0.45) * (Math.PI / 2)) : vt * Math.cos(((ph - 0.45) / 0.55) * (Math.PI / 2));
    return { paw, flow: flow, vol: Math.max(0, vol) };
  }

  if (mode === "simv") {
    const cp = t % T;
    if (cp < ti) {
      // mandatory pressure breath
      const rise = clampC(cp / 0.06, 0, 1);
      const paw = peep + (pipSet - peep) * rise;
      const vol = vt * (1 - Math.exp(-cp / tau));
      const flow = Math.exp(-cp / tau);
      return { paw, flow, vol };
    }
    // expiratory window: place supported spontaneous PS breaths
    const te = cp - ti;
    const Tsp = 60 / Math.max(1, CONV_CATS_spontRate(s));
    const sp = (te % Tsp) / Tsp;
    const exhale = vt * Math.exp(-te / (tau * 1.4));
    const psAmp = (s.psAmp || 0);
    const inSpont = sp < 0.4 && te > tau * 2;
    const paw = peep + (inSpont ? psAmp * Math.sin((sp / 0.4) * Math.PI) : 0);
    const spVt = inSpont ? (psAmp * s.C * 0.6) * Math.sin((sp / 0.4) * (Math.PI / 2)) : 0;
    const flow = -Math.exp(-te / (tau * 1.4)) + (inSpont ? 0.8 * Math.sin((sp / 0.4) * Math.PI) : 0);
    return { paw, flow, vol: Math.max(exhale, spVt) };
  }

  // ac / vg / niv — mandatory pressure-targeted breath
  if (T <= 0) return { paw: peep, flow: 0, vol: 0 };
  const cp = t % T;
  const leakWob = mode === "niv" && s.scenario === "leak" ? (Math.sin(t * 37) * 0.4) : 0;
  if (cp < ti) {
    const rise = clampC(cp / 0.06, 0, 1);
    const paw = peep + (pipSet - peep) * rise + leakWob;
    const vol = vt * (1 - Math.exp(-cp / tau));
    const flow = Math.exp(-cp / tau);
    return { paw, flow, vol };
  }
  const te = cp - ti;
  const paw = peep + leakWob;
  const vol = vt * Math.exp(-te / tau);
  const flow = -Math.exp(-te / tau);
  return { paw, flow, vol };
}
function CONV_CATS_spontRate(s) { return s.spontRate || 50; }

/* ---------- 3-lane oscilloscope ---------- */
function ConvDisplay({ s, L }) {
  const cvRef = useRefC(null);
  const stRef = useRefC({ s, L });
  useEffectC(() => { stRef.current = { s, L }; }, [s, L]);

  useEffectC(() => {
    const cv = cvRef.current; if (!cv) return;
    const ctx = cv.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    function resize() { const r = cv.getBoundingClientRect(); cv.width = r.width * dpr; cv.height = r.height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    resize();
    const ro = new ResizeObserver(resize); ro.observe(cv);
    let raf; const t0 = performance.now();

    function lane(x, y, w, h, title, unit) {
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      for (let i = 1; i < 6; i++) { const gx = x + (w / 6) * i; ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); ctx.stroke(); }
      ctx.strokeStyle = "rgba(255,255,255,0.13)"; ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = "rgba(255,255,255,0.8)"; ctx.font = "600 11px Inter Tight, sans-serif"; ctx.fillText(title, x + 6, y - 6);
      ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.font = "500 9px JetBrains Mono, monospace"; ctx.fillText(unit, x + w - 52, y - 6);
    }

    function draw() {
      const r = cv.getBoundingClientRect(); const W = r.width, H = r.height;
      const t = (performance.now() - t0) / 1000;
      const { s, L } = stRef.current; const lab = L.convSim.lanes;
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
      const padL = 50, padR = 14, padT = 22;
      const plotW = W - padL - padR;
      const laneH = (H - padT - 26) / 3 - 16;
      const win = Math.max(4, (s.T > 0 ? s.T : 1.5) * 3.2);   // show ~3 breaths
      const steps = Math.max(360, Math.floor(plotW));

      // dynamic scales
      const pMax = Math.max(28, s.pipSet + 6), pMin = 0;
      const flowMax = 1.25;
      const volMax = Math.max(10, s.vt * 1.3);

      const lanes = [
        { y: padT, title: lab.paw, unit: lab.pawUnit, color: "#A8F03C", min: pMin, max: pMax, key: "paw", baseline: s.peep, baseLabel: (s.mode === "cpap" ? "CPAP" : s.mode === "niv" ? "EPAP" : "PEEP") + " " + s.peep.toFixed(0) },
        { y: padT + laneH + 16, title: lab.flow, unit: lab.flowUnit, color: "#67E8F9", min: -flowMax, max: flowMax, key: "flow", baseline: 0 },
        { y: padT + (laneH + 16) * 2, title: lab.vol, unit: lab.volUnit, color: "#FCD34D", min: 0, max: volMax, key: "vol", baseline: 0 },
      ];

      lanes.forEach(L2 => {
        lane(padL, L2.y, plotW, laneH, L2.title, L2.unit);
        const yFor = v => L2.y + (L2.max - v) / (L2.max - L2.min) * laneH;
        // baseline (dashed)
        ctx.setLineDash([5, 4]); ctx.strokeStyle = "rgba(245,158,11,0.4)"; ctx.lineWidth = 1;
        ctx.beginPath(); const by = yFor(L2.baseline); ctx.moveTo(padL, by); ctx.lineTo(padL + plotW, by); ctx.stroke(); ctx.setLineDash([]);
        if (L2.baseLabel) { ctx.fillStyle = "#F59E0B"; ctx.font = "600 9px JetBrains Mono, monospace"; ctx.fillText(L2.baseLabel, padL + plotW - 64, by - 3); }
        // tick labels
        ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.font = "500 9px JetBrains Mono, monospace";
        ctx.fillText(L2.max.toFixed(0), 6, L2.y + 9);
        ctx.fillText(L2.min.toFixed(0), 6, L2.y + laneH - 2);
        // trace
        ctx.strokeStyle = L2.color; ctx.lineWidth = 1.5; ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
          const f = i / steps;
          const tt = t + f * win;
          const samp = sampleConv(s, tt);
          let v = L2.key === "flow" ? samp.flow * flowMax : samp[L2.key];
          v = clampC(v, L2.min + 0.01, L2.max - 0.01);
          const x = padL + f * plotW, y = yFor(v);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });

      // alarm overlay
      let overlay = null, oc = null;
      if (s.scenario === "leak" && (s.mode === "niv" || s.mode === "cpap")) { overlay = L.convSim.overlayLeak; oc = "rgba(245,158,11,0.9)"; }
      else if (s.vtHigh) { overlay = L.convSim.overlayVtHigh; oc = "rgba(245,158,11,0.9)"; }
      else if (s.vtLow) { overlay = L.convSim.overlayVtLow; oc = "rgba(239,68,68,0.9)"; }
      else if (s.atLimit) { overlay = L.convSim.overlayLimit; oc = "rgba(239,68,68,0.9)"; }
      if (overlay) { ctx.fillStyle = oc; ctx.font = "700 11px Inter Tight, sans-serif"; ctx.fillText(overlay, padL + 8, padT + laneH - 6); }

      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={cvRef} className="hv-display" style={{ width: "100%", height: "100%", display: "block", background: "#000", borderRadius: 8 }} />;
}

/* readout + knob reuse the HFO device tiles */
function ConvReadout({ label, value, unit, sub, status, alert }) {
  return (
    <div className={`hv-tile hv-tile-left${status ? " s-" + status : ""}${alert ? " alert" : ""}`}>
      <div className="hv-tile-label">{label}</div>
      <div className="hv-tile-value">{value}</div>
      {unit && <div className="hv-tile-unit">{unit}</div>}
      {sub && <div className="hv-tile-sub">{sub}</div>}
    </div>
  );
}
function ConvKnob({ label, value, unit, min, max, step, onChange, target, targetTone, locked, lockedVal }) {
  const pct = ((value - min) / (max - min)) * 100;
  if (locked) {
    return (
      <div className="hv-knob hv-knob-locked">
        <div className="hv-knob-label">{label}</div>
        <div className="hv-knob-value" style={{ color: "#67E8F9" }}>{lockedVal}</div>
        {unit && <div className="hv-knob-unit">{unit}</div>}
        {target && <div className={`hv-knob-target${targetTone ? " " + targetTone : ""}`}>{target}</div>}
      </div>
    );
  }
  return (
    <div className="hv-knob">
      <div className="hv-knob-label">{label}</div>
      <div className="hv-knob-value" style={{ color: "#A8F03C" }}>{step >= 1 ? Math.round(value) : value.toFixed(step < 0.1 ? 2 : 1)}</div>
      {unit && <div className="hv-knob-unit">{unit}</div>}
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))}
        className="hv-slider" aria-label={`${label} ${value} ${unit || ""}`}
        style={{ background: `linear-gradient(90deg, #A8F03C 0%, #A8F03C ${pct}%, rgba(255,255,255,0.18) ${pct}%, rgba(255,255,255,0.18) 100%)` }} />
      <div className="hv-range"><span>{min}</span><span>{max}</span></div>
      {target && <div className={`hv-knob-target${targetTone ? " " + targetTone : ""}`}>{target}</div>}
    </div>
  );
}

function useClockC() {
  const [time, setTime] = useStateC(() => new Date());
  useEffectC(() => { const id = setInterval(() => setTime(new Date()), 10000); return () => clearInterval(id); }, []);
  return time;
}

function ConvSimulator({ L }) {
  const t = L.convSim;
  const [cat, setCat] = useStateC("infant");
  const [mode, setMode] = useStateC("ac");
  const [scenario, setScenario] = useStateC("optimal");
  const W = CONV_CATS[cat];

  const [p, setP] = useStateC(() => ({ rate: W.rate, pip: W.pip, peep: W.peep, ti: W.ti, fio2: W.fio2, vt: Math.round(W.vtKg * W.weight * 2) / 2, ps: W.ps, cpap: W.cpap, ipap: W.ipap, epap: W.epap }));
  useEffectC(() => {
    const w = CONV_CATS[cat];
    setP({ rate: w.rate, pip: w.pip, peep: w.peep, ti: w.ti, fio2: w.fio2, vt: Math.round(w.vtKg * w.weight * 2) / 2, ps: w.ps, cpap: w.cpap, ipap: w.ipap, epap: w.epap });
  }, [cat]);
  const set = (k) => (v) => setP(prev => ({ ...prev, [k]: v }));

  const base = useMemoC(() => computeConv({ cat, mode, scenario, p }), [cat, mode, scenario, p]);
  const s = useMemoC(() => ({ ...base, spontRate: CONV_CATS[cat].spontRate, psAmp: p.ps }), [base, cat, p.ps]);
  const clock = useClockC();
  const knobs = knobsForMode(mode, W);

  const spo2Cls = s.spo2 >= 90 ? "spo2-ok" : s.spo2 >= 85 ? "spo2-warn" : "spo2-bad";
  const pco2Cls = (s.pco2 >= 35 && s.pco2 <= 50) ? "pco2-ok" : (s.pco2 > 60 || s.pco2 < 30) ? "pco2-bad" : "pco2-warn";
  const vtStatus = s.vtHigh ? "warn" : s.vtLow ? "critical" : "good";
  const pipStatus = s.pipHigh ? "warn" : (s.atLimit ? "critical" : "good");

  // knob hint helpers
  const vtKgNow = s.vtKg.toFixed(1);
  const knobMeta = {
    rate: { label: t.knobs.rate, unit: "/мин".replace("/мин", t.units.bpm), target: t.knobs.rateHint(s.mve.toFixed(2)), tone: "good" },
    pip:  { label: t.knobs.pip, unit: t.units.cmh2o, target: t.knobs.pipHint(vtKgNow), tone: s.vtHigh || s.vtLow ? "warn" : "good" },
    peep: { label: t.knobs.peep, unit: t.units.cmh2o, target: t.knobs.peepHint(s.Pmean.toFixed(1)), tone: "good" },
    ti:   { label: t.knobs.ti, unit: t.units.s, target: t.knobs.tiHint, tone: "good" },
    fio2: { label: t.knobs.fio2, unit: "%", target: p.fio2 > 60 ? t.knobs.fio2HintHigh : t.knobs.fio2HintOk, tone: p.fio2 > 60 ? "warn" : "good" },
    vt:   { label: t.knobs.vt, unit: t.units.ml, target: t.knobs.vtHint(vtKgNow, s.pipAuto ? s.pipAuto.toFixed(0) : "—"), tone: s.atLimit ? "warn" : "good" },
    ps:   { label: t.knobs.ps, unit: t.units.cmh2o, target: t.knobs.psHint, tone: "good" },
    cpap: { label: t.knobs.cpap, unit: t.units.cmh2o, target: t.knobs.cpapHint(s.spo2.toFixed(0)), tone: "good" },
    ipap: { label: t.knobs.ipap, unit: t.units.cmh2o, target: t.knobs.ipapHint(vtKgNow), tone: "good" },
    epap: { label: t.knobs.epap, unit: t.units.cmh2o, target: t.knobs.epapHint, tone: "good" },
  };

  // left tiles depend on mode
  const tilePipLabel = mode === "vg" ? t.tiles.pipAuto : mode === "niv" ? t.tiles.ipap : mode === "cpap" ? t.tiles.cpap : t.tiles.pip;
  const tilePipVal = mode === "cpap" ? s.peep.toFixed(0) : s.pipSet.toFixed(0);
  const tilePipSub = mode === "vg" ? (s.atLimit ? t.tiles.pipAutoLimit : t.tiles.pipAutoSub) : t.tiles.pipSub;

  return (
    <section className="block sim conv-sim" id="sec-convsim" data-screen-label="05.2 Conv Trainer">
      <window.SectionLabel n="05.2" label={t.secLabel} />
      <window.RT as="h2" className="block-title block-title-dark" html={t.title} />
      <window.RT as="p" className="block-sub block-sub-dark" html={t.sub} />

      <div className="sim-controls-row conv-controls">
        <div className="sim-control-group">
          <span className="sim-control-label">{t.modeLabel}</span>
          <div className="seg-btn-row">
            {CONV_MODES.map(k => (
              <button key={k} className={`seg-btn ${mode === k ? "active" : ""}`} onClick={() => setMode(k)}>{t.modes[k]}</button>
            ))}
          </div>
        </div>
        <div className="sim-control-group">
          <span className="sim-control-label">{t.catLabel}</span>
          <div className="seg-btn-row">
            {Object.keys(CONV_CATS).map(k => (
              <button key={k} className={`seg-btn ${cat === k ? "active" : ""}`} onClick={() => setCat(k)}>{CONV_CATS[k].label}</button>
            ))}
          </div>
        </div>
        <div className="sim-control-group">
          <span className="sim-control-label">{t.scenarioLabel}</span>
          <div className="seg-btn-row">
            {Object.keys(CONV_SCEN_TONE).map(k => (
              <button key={k} className={`seg-btn ${CONV_SCEN_TONE[k]} ${scenario === k ? "active" : ""}`} onClick={() => setScenario(k)}>{t.scenarios[k]}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="hv-frame">
        <div className="hv-frame-header">
          <div className="hv-brand">Humming Vue</div>
          <div className="hv-mode">
            <span className="hv-mode-pill">{t.modes[mode]}</span>
            <span className="hv-mode-time">{clock.toLocaleTimeString(L.locale, { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        </div>

        <div className="hv-frame-body">
          <div className="hv-col-left">
            <ConvReadout label={tilePipLabel} value={tilePipVal} unit="cmH₂O" status={pipStatus} alert={s.atLimit} sub={tilePipSub} />
            <ConvReadout label={t.tiles.pmean} value={s.Pmean.toFixed(1)} unit="cmH₂O" status="good" sub={t.tiles.pmeanSub} />
            <ConvReadout label={t.tiles.vt} value={s.vt.toFixed(s.weight < 1 ? 1 : 0)} unit="mL" status={vtStatus} alert={s.vtLow} sub={t.tiles.vtSub(vtKgNow)} />
            <ConvReadout label={t.tiles.mve} value={s.mve.toFixed(2)} unit="L/min" status="good" sub={t.tiles.mveSub(Math.round(s.effRate))} />
          </div>

          <div className="hv-col-center">
            <div className="hv-display-wrap conv-display-wrap">
              <ConvDisplay s={s} L={L} />
            </div>
            <div className="hv-vitals">
              <div className="hv-vital"><span className="hv-vital-label">{t.vitals.spo2}</span><span className={`hv-vital-value ${spo2Cls}`}>{s.spo2.toFixed(0)}</span><span className="hv-vital-unit">%</span></div>
              <div className="hv-vital"><span className="hv-vital-label">{t.vitals.pco2}</span><span className={`hv-vital-value ${pco2Cls}`}>{s.pco2.toFixed(0)}</span><span className="hv-vital-unit">mmHg</span></div>
              <div className="hv-vital"><span className="hv-vital-label">{t.vitals.vtkg}</span><span className="hv-vital-value" style={{ color: s.vtHigh || s.vtLow ? "#F59E0B" : "#94A3B8" }}>{vtKgNow}</span><span className="hv-vital-unit">{t.units.mlkg}</span></div>
              <div className="hv-vital"><span className="hv-vital-label">{t.vitals.cdyn}</span><span className="hv-vital-value" style={{ color: "#94A3B8" }}>{s.cDyn.toFixed(1)}</span><span className="hv-vital-unit">{t.vitals.cdynUnit}</span></div>
            </div>
          </div>

          <div className="hv-col-right conv-knobs">
            {knobs.map(kb => {
              const meta = knobMeta[kb.key];
              return <ConvKnob key={kb.key} label={meta.label} value={p[kb.key]} unit={meta.unit}
                min={kb.min} max={kb.max} step={kb.step} onChange={set(kb.key)} target={meta.target} targetTone={meta.tone} />;
            })}
            {mode === "vg" && (
              <ConvKnob label={t.tiles.pipAuto} locked lockedVal={s.pipAuto ? s.pipAuto.toFixed(0) : "—"} unit="cmH₂O"
                target={s.atLimit ? t.knobs.pipAutoLimit : t.knobs.pipAutoOk} targetTone={s.atLimit ? "warn" : "good"} />
            )}
          </div>
        </div>

        <div className="hv-frame-footer">
          {t.footer.map((f, i) => <span key={i} className="hv-foot-item">{f}</span>)}
        </div>
      </div>

      <div className="conv-coach">
        <div className="conv-coach-icon">🎯</div>
        <div>
          <div className="conv-coach-title">{t.coach[mode].title}</div>
          <window.RT as="div" className="conv-coach-body" html={t.coach[mode].body} />
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { ConvSimulator });
