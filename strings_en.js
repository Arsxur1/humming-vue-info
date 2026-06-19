/* HFO Explainer — Simulator (v4 · language-driven, physics-corrected).
   Fixes vs v3: consistent pCO₂ model, per-category amplitude scaling,
   clinically-coherent pediatric defaults, targetSV uses real efficiency,
   corrected recruit slopes, precomputed RAF noise, live clock, HiDPI canvases. */

const { useState, useEffect, useRef, useMemo } = React;

/* Weight categories */
const WEIGHT_CATS = {
  elbw: {
    label: "500–1000 g", weight: 0.8, ettSize: 2.5, baseEfficiency: 0.22, ampK: 1.0,
    svMin: 1, svMax: 16, svStep: 0.5, svDefault: 7,
    mapMin: 5, mapMax: 22, mapDefault: 10, mapOptimal: 10,
    hzMin: 12, hzMax: 17, hzDefault: 15, fioDefault: 60, targetVhfoPerKg: 2.0,
  },
  infant: {
    label: "1–10 kg", weight: 3, ettSize: 3.5, baseEfficiency: 0.33, ampK: 1.0,
    svMin: 5, svMax: 45, svStep: 1, svDefault: 18,
    mapMin: 6, mapMax: 26, mapDefault: 13, mapOptimal: 13,
    hzMin: 8, hzMax: 15, hzDefault: 10, fioDefault: 50, targetVhfoPerKg: 2.0,
  },
  pediatric: {
    label: "10 kg +", weight: 15, ettSize: 4.5, baseEfficiency: 0.42, ampK: 0.38,
    svMin: 15, svMax: 160, svStep: 1, svDefault: 71,
    mapMin: 8, mapMax: 35, mapDefault: 17, mapOptimal: 17,
    hzMin: 5, hzMax: 10, hzDefault: 7, fioDefault: 45, targetVhfoPerKg: 2.0,
  },
};
const SCENARIO_TONE = { optimal: "", spontaneous: "warn", lowCompliance: "warn", ettBlock: "danger" };

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/* Precomputed noise (avoids per-frame Math.random flicker) */
const NOISE = new Float32Array(2048);
for (let i = 0; i < NOISE.length; i++) NOISE[i] = Math.random() - 0.5;
function noiseAt(idx) { return NOISE[((idx % NOISE.length) + NOISE.length) % NOISE.length]; }

/* Core physics */
function computeState({ cat, scenario, sv, map, hz, fio2 }) {
  const W = WEIGHT_CATS[cat];
  const weight = W.weight;

  let efficiency = W.baseEfficiency;
  const hzPenalty = 1 - clamp((hz - W.hzDefault) * 0.025, -0.15, 0.15);
  efficiency *= hzPenalty;

  const compl = scenario === "lowCompliance" ? 0.55 : 1.0;
  const ett   = scenario === "ettBlock"      ? 0.20 : 1.0;
  const spont = scenario === "spontaneous"   ? 0.92 : 1.0;
  efficiency *= compl * ett * spont;

  const mapOpt = W.mapOptimal + (scenario === "lowCompliance" ? 2 : 0);
  const dMap = map - mapOpt;
  let recruit;
  // Underfill (left): gentle loss. Overdistension (right): faster loss.
  if (dMap <= 0) recruit = clamp(0.45 + (dMap + 8) / 8 * 0.55, 0.15, 1.0);
  else            recruit = clamp(1.0 - dMap * 0.075, 0.30, 1.0);
  efficiency *= 0.65 + 0.35 * recruit;

  const vhfo = sv * efficiency;
  const dco2 = vhfo * vhfo * hz;
  const dco2PerKg = dco2 / weight;
  const targetVhfo = weight * (scenario === "spontaneous" ? 1.5 : W.targetVhfoPerKg);

  // Amplitude — per-category scaled
  const refHz = W.hzDefault;
  let amplitude = sv * (1.0 + (hz / refHz) * 1.0) * 0.95 * W.ampK;
  amplitude *= (1 / Math.max(0.45, compl));
  amplitude *= (1 / Math.pow(Math.max(0.25, ett), 0.7));
  amplitude = clamp(amplitude, 4, 95);

  const overshoot = dMap > 4 ? (dMap - 4) * 0.3 : 0;
  const blockOffset = scenario === "ettBlock" ? 1.8 : 0;
  const mapMeasured = map + overshoot + blockOffset;

  let spo2 = 70 + 24 * recruit + (fio2 - 30) * 0.16;
  if (scenario === "ettBlock") spo2 *= 0.72;
  if (scenario === "spontaneous") spo2 += 2;
  spo2 = clamp(spo2, 35, 100);

  // Consistent pCO₂ model: anchored to the excursion target so all
  // categories read ~45 mmHg (mid permissive) when V_hfo is on target.
  const targetDco = (targetVhfo * targetVhfo) * hz;
  let pco2 = 45 * Math.sqrt(targetDco / Math.max(0.01, dco2));
  pco2 = clamp(pco2, 18, 115);

  const targetMet     = Math.abs(vhfo - targetVhfo) / targetVhfo < 0.18;
  const ettAlert      = ett < 1 && vhfo < targetVhfo * 0.4;
  const complAlert    = compl < 1 && dco2PerKg < 25;
  const overDistAlert = dMap > 6;

  return {
    weight, recruit, compl, ett, dMap, efficiency,
    vhfo, dco2, dco2PerKg, targetVhfo,
    amplitude, mapMeasured, spo2, pco2,
    targetMet, ettAlert, complAlert, overDistAlert,
  };
}

/* Oscilloscope display */
function HVDisplay({ state, sv, map, hz, scenario, L }) {
  const cvRef = useRef(null);
  const stRef = useRef({ state, sv, map, hz, scenario, L });
  useEffect(() => { stRef.current = { state, sv, map, hz, scenario, L }; }, [state, sv, map, hz, scenario, L]);

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    function resize() {
      const rect = cv.getBoundingClientRect();
      cv.width = rect.width * dpr; cv.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    const ro = new ResizeObserver(resize); ro.observe(cv);
    let raf; const t0 = performance.now();

    function draw() {
      const rect = cv.getBoundingClientRect();
      const W = rect.width, H = rect.height;
      const t = (performance.now() - t0) / 1000;
      const { state, sv, map, hz, scenario, L } = stRef.current;

      const padL = 56, padR = 18, padT = 28;
      const plotW = W - padL - padR;
      const halfH = (H - padT - 30) / 2;
      const pTop = padT, pBot = pTop + halfH - 8;
      const fTop = pBot + 28, fBot = fTop + halfH - 8;

      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);

      drawAxis(ctx, padL, pTop, plotW, pBot - pTop, { title: "Pressure", unitLabel: "(cmH₂O)", ticks: [40, 20, 0, -20], tickRange: [-20, 40] });

      const pMin = -20, pMax = 40;
      const yForP = v => pTop + (pMax - v) / (pMax - pMin) * (pBot - pTop);
      ctx.setLineDash([6, 4]); ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1;
      ctx.beginPath(); const mapY = yForP(map); ctx.moveTo(padL, mapY); ctx.lineTo(padL + plotW, mapY); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#F59E0B"; ctx.font = "600 10px JetBrains Mono, monospace";
      ctx.fillText(`MAP ${map.toFixed(1)}`, padL + plotW - 64, mapY - 4);

      const windowSec = 3;
      const halfAmp = state.amplitude / 2;
      const blocked = scenario === "ettBlock";
      const noiseBase = Math.floor(t * 60);

      ctx.strokeStyle = "#A8F03C"; ctx.lineWidth = 1.4; ctx.beginPath();
      const steps = Math.max(360, Math.floor(plotW));
      for (let i = 0; i <= steps; i++) {
        const f = i / steps;
        const secs = f * windowSec;
        const phase = (secs + t) * hz * Math.PI * 2;
        let p = map + Math.sin(phase) * halfAmp;
        p += Math.sin(phase * 2) * halfAmp * 0.08;
        if (blocked) p = map + Math.sin(phase) * halfAmp * 0.15 + noiseAt(noiseBase + i) * 1.5;
        p += noiseAt(noiseBase + i * 3) * 0.4;
        const x = padL + f * plotW;
        const y = yForP(clamp(p, pMin + 0.5, pMax - 0.5));
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      drawAxis(ctx, padL, fTop, plotW, fBot - fTop, { title: "Flow", unitLabel: "(LPM)", ticks: [5, 2, 0, -2, -5], tickRange: [-5, 5] });
      const flowAmp = clamp((sv * hz) / 70 * (blocked ? 0.18 : 1.0), 0.3, 5.0);
      const fMin = -5, fMax = 5;
      const yForF = v => fTop + (fMax - v) / (fMax - fMin) * (fBot - fTop);
      ctx.setLineDash([6, 4]); ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.beginPath(); const flowZeroY = yForF(0); ctx.moveTo(padL, flowZeroY); ctx.lineTo(padL + plotW, flowZeroY); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = "#A8F03C"; ctx.lineWidth = 1.4; ctx.beginPath();
      const spontaneous = scenario === "spontaneous";
      for (let i = 0; i <= steps; i++) {
        const f = i / steps;
        const secs = f * windowSec;
        const phase = (secs + t) * hz * Math.PI * 2;
        let fv = Math.cos(phase) * flowAmp;
        // Spontaneous: slow superimposed breaths modulate the flow envelope
        if (spontaneous) fv += Math.sin((secs + t) * Math.PI * 2 * 0.7) * flowAmp * 0.5;
        fv += noiseAt(noiseBase + i * 5) * 0.15;
        const x = padL + f * plotW;
        const y = yForF(clamp(fv, fMin + 0.2, fMax - 0.2));
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.font = "500 10px JetBrains Mono, monospace";
      ctx.fillText("0(sec)", padL - 4, fBot + 16);
      for (let s = 1; s <= 3; s++) { const x = padL + (s / 3) * plotW; ctx.fillText(s.toFixed(1), x - 6, fBot + 16); }

      if (scenario === "ettBlock") {
        ctx.fillStyle = "rgba(239,68,68,0.85)"; ctx.font = "700 11px Inter Tight, sans-serif";
        ctx.fillText(L.simulator.overlayBlock, padL + 8, padT + 14);
      } else if (scenario === "lowCompliance") {
        ctx.fillStyle = "rgba(245,158,11,0.9)"; ctx.font = "700 11px Inter Tight, sans-serif";
        ctx.fillText(L.simulator.overlayCompl, padL + 8, padT + 14);
      }
      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={cvRef} className="hv-display" style={{ width: "100%", height: "100%", display: "block", background: "#000", borderRadius: 8 }} />;
}

function drawAxis(ctx, x, y, w, h, opts) {
  const { title, unitLabel, ticks, tickRange } = opts;
  ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) { const gx = x + (w / 6) * i; ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); ctx.stroke(); }
  for (let i = 1; i < 4; i++) { const gy = y + (h / 4) * i; ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke(); }
  ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.font = "600 12px Inter Tight, sans-serif"; ctx.fillText(title, x + 6, y - 8);
  ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.font = "500 9px JetBrains Mono, monospace"; ctx.fillText(unitLabel, x - 48, y - 8);
  ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.font = "500 9px JetBrains Mono, monospace";
  const [tMin, tMax] = tickRange;
  ticks.forEach(v => {
    const ty = y + (tMax - v) / (tMax - tMin) * h;
    ctx.fillText(v.toFixed(1), x - 38, ty + 3);
    ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.beginPath(); ctx.moveTo(x - 4, ty); ctx.lineTo(x, ty); ctx.stroke();
  });
}

/* P-V Loop (HiDPI) */
function PVLoop({ state, mapSet, L }) {
  const t = L.simulator.pvLoop;
  const cvRef = useRef(null);
  const stRef = useRef({ state });
  useEffect(() => { stRef.current = { state }; }, [state]);

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    function resize() {
      const rect = cv.getBoundingClientRect();
      cv.width = rect.width * dpr; cv.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    const ro = new ResizeObserver(resize); ro.observe(cv);
    let raf; const t0 = performance.now();
    function draw() {
      const rect = cv.getBoundingClientRect();
      const W = rect.width, H = rect.height;
      const tt = (performance.now() - t0) / 1000;
      ctx.clearRect(0, 0, W, H);
      const padL = 60, padR = 30, padT = 24, padB = 40;
      const plotW = W - padL - padR, plotH = H - padT - padB;
      const cx = padL + plotW / 2, cy = padT + plotH / 2;
      ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = 1;
      for (let i = 1; i < 6; i++) {
        const xg = padL + (plotW / 6) * i; ctx.beginPath(); ctx.moveTo(xg, padT); ctx.lineTo(xg, H - padB); ctx.stroke();
        const yg = padT + (plotH / 6) * i; ctx.beginPath(); ctx.moveTo(padL, yg); ctx.lineTo(W - padR, yg); ctx.stroke();
      }
      ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(padL, H - padB); ctx.lineTo(W - padR, H - padB); ctx.moveTo(padL, padT); ctx.lineTo(padL, H - padB); ctx.stroke();
      ctx.fillStyle = "#94A3B8"; ctx.font = "600 10px Inter Tight, sans-serif"; ctx.fillText("PRESSURE →", W - padR - 90, H - padB + 28);
      ctx.save(); ctx.translate(18, padT + plotH / 2); ctx.rotate(-Math.PI / 2); ctx.fillText("VOLUME →", -28, 0); ctx.restore();
      ctx.fillStyle = "#F59E0B"; ctx.font = "700 10px JetBrains Mono, monospace"; ctx.fillText("MAP", cx - 14, H - padB + 16);

      const s = stRef.current.state;
      const ampScale = plotW * 0.7 / 95;
      const volScale = plotH * 0.85 / Math.max(1, s.targetVhfo * 2.4);
      let rx = Math.max(3, (s.amplitude / 2) * ampScale);
      let ry = Math.max(0.6, (s.vhfo / 2) * volScale);
      const slope = Math.atan2(ry * 1.4, rx * 0.6);
      ctx.strokeStyle = "#14B8A6"; ctx.lineWidth = 2.5; ctx.beginPath();
      const N = 180; const pulse = 0.97 + Math.sin(tt * 4) * 0.03;
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2;
        const lx = Math.cos(a) * rx * pulse, ly = Math.sin(a) * ry * pulse;
        const x = cx + lx * Math.cos(slope) - ly * Math.sin(slope);
        const y = cy - (lx * Math.sin(slope) + ly * Math.cos(slope));
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = "#F59E0B";
      ctx.beginPath(); ctx.arc(cx + rx * Math.cos(slope), cy - rx * Math.sin(slope), 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx - rx * Math.cos(slope), cy + rx * Math.sin(slope), 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#94A3B8"; ctx.font = "600 10px JetBrains Mono, monospace"; ctx.fillText(t.ampCaption(s.amplitude.toFixed(0)), padL + 8, padT + 16);
      ctx.fillStyle = "#14B8A6"; ctx.fillText(t.vhfoCaption(s.vhfo.toFixed(1)), padL + 8, padT + 32);
      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  const s = state;
  let stateLabel = "good", title = t.goodTitle, desc;
  if (s.ettAlert) { stateLabel = "bad"; title = t.ettTitle; desc = t.ettDesc; }
  else if (s.complAlert) { stateLabel = "warn"; title = t.complTitle; desc = t.complDesc; }
  else if (s.overDistAlert) { stateLabel = "warn"; title = t.overTitle; desc = t.overDesc; }
  else if (s.targetMet) { desc = t.goodDesc; }
  else { stateLabel = "warn"; title = t.offTitle; desc = t.offDesc(s.vhfo.toFixed(1), s.targetVhfo.toFixed(1)); }

  return (
    <div className="sim-loop">
      <canvas ref={cvRef} width="600" height="220" className="sim-loop-canvas"></canvas>
      <div className="sim-loop-info">
        <span className="eyebrow">{t.label}</span>
        <div className={`sim-loop-state ${stateLabel}`}>{stateLabel === "good" ? t.normal : stateLabel === "warn" ? t.caution : t.alarm}</div>
        <div className="sim-loop-title">{title}</div>
        <div className="sim-loop-desc">{desc}</div>
      </div>
    </div>
  );
}

function DeviceReadout({ label, value, unit, sub, status, alert }) {
  return (
    <div className={`hv-tile hv-tile-left${status ? " s-" + status : ""}${alert ? " alert" : ""}`}>
      <div className="hv-tile-label">{label}</div>
      <div className="hv-tile-value">{value}</div>
      {unit && <div className="hv-tile-unit">{unit}</div>}
      {sub && <div className="hv-tile-sub">{sub}</div>}
    </div>
  );
}

function DeviceKnob({ label, value, unit, sub, min, max, step, onChange, accent, target, targetTone }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="hv-knob">
      <div className="hv-knob-label">{label}</div>
      <div className="hv-knob-value" style={{ color: accent }}>{step >= 1 ? Math.round(value) : value.toFixed(1)}</div>
      {unit && <div className="hv-knob-unit">{unit}</div>}
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="hv-slider"
        aria-label={`${label} ${value} ${unit || ""}`} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}
        style={{ background: `linear-gradient(90deg, ${accent} 0%, ${accent} ${pct}%, rgba(255,255,255,0.18) ${pct}%, rgba(255,255,255,0.18) 100%)` }} />
      <div className="hv-range"><span>{min}</span><span>{max}</span></div>
      {sub && <div className="hv-knob-sub">{sub}</div>}
      {target && <div className={`hv-knob-target${targetTone ? " " + targetTone : ""}`}>{target}</div>}
    </div>
  );
}

function useClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setTime(new Date()), 10000); return () => clearInterval(id); }, []);
  return time;
}

function Simulator({ L }) {
  const t = L.simulator;
  const [cat, setCat] = useState("infant");
  const [scenario, setScenario] = useState("optimal");
  const W = WEIGHT_CATS[cat];

  const [sv, setSv] = useState(W.svDefault);
  const [map, setMap] = useState(W.mapDefault);
  const [hz, setHz] = useState(W.hzDefault);
  const [fio2, setFio2] = useState(W.fioDefault);

  useEffect(() => {
    setSv(W.svDefault); setMap(W.mapDefault); setHz(W.hzDefault); setFio2(W.fioDefault);
  }, [cat]);

  const state = useMemo(() => computeState({ cat, scenario, sv, map, hz, fio2 }), [cat, scenario, sv, map, hz, fio2]);
  const clock = useClock();

  const tgtPerKg = scenario === "spontaneous" ? 1.5 : W.targetVhfoPerKg;
  const targetVhfo = W.weight * tgtPerKg;
  const targetSV = targetVhfo / Math.max(0.02, state.efficiency);   // real efficiency
  const svDelta = sv - targetSV;
  const svHint = t.knobs.svHint(targetVhfo.toFixed(1), tgtPerKg, targetSV.toFixed(0));
  const svHintTone = Math.abs(svDelta) > targetSV * 0.3 ? "warn" : "good";

  const mapDelta = map - W.mapOptimal;
  const mapHint = state.overDistAlert ? t.knobs.mapHintOver(mapDelta.toFixed(0))
    : mapDelta < -3 ? t.knobs.mapHintLow : t.knobs.mapHintOk(W.mapOptimal);
  const mapHintTone = (state.overDistAlert || mapDelta < -3) ? "warn" : "good";
  const hzHint = t.knobs.hzHint(W.hzDefault);

  const spo2Cls = state.spo2 >= 90 ? "spo2-ok" : state.spo2 >= 85 ? "spo2-warn" : "spo2-bad";
  const pco2Cls = (state.pco2 >= 35 && state.pco2 <= 50) ? "pco2-ok" : (state.pco2 > 60 || state.pco2 < 30) ? "pco2-bad" : "pco2-warn";
  const ampStatus = state.amplitude > 75 ? "critical" : state.amplitude > 55 ? "warn" : state.amplitude < 8 ? "warn" : "good";
  const vhfoStatus = state.targetMet ? "good" : state.vhfo < state.targetVhfo * 0.5 ? "critical" : "warn";
  const dco2Status = state.dco2PerKg >= 50 && state.dco2PerKg <= 130 ? "good" : state.dco2PerKg < 25 ? "critical" : "warn";
  const mapMeasuredHigh = state.mapMeasured > map + 1.2;

  return (
    <section className="block sim" id="sec-simulator" data-screen-label="05 Simulator">
      <SectionLabel n="05" label={t.secLabel} />
      <window.RT as="h2" className="block-title block-title-dark" html={t.title} />
      <window.RT as="p" className="block-sub block-sub-dark" html={t.sub} />

      <div className="sim-controls-row">
        <div className="sim-control-group">
          <span className="sim-control-label">{t.catLabel}</span>
          <div className="seg-btn-row">
            {Object.keys(WEIGHT_CATS).map(k => (
              <button key={k} className={`seg-btn ${cat === k ? "active" : ""}`} onClick={() => setCat(k)}>{t.cats[k].label}</button>
            ))}
          </div>
        </div>
        <div className="sim-control-group">
          <span className="sim-control-label">{t.scenarioLabel}</span>
          <div className="seg-btn-row">
            {Object.keys(SCENARIO_TONE).map(k => (
              <button key={k} className={`seg-btn ${SCENARIO_TONE[k]} ${scenario === k ? "active" : ""}`} onClick={() => setScenario(k)}>{t.scenarios[k]}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="hv-frame">
        <div className="hv-frame-header">
          <div className="hv-brand">Humming Vue</div>
          <div className="hv-mode">
            <span className="hv-mode-pill">{t.modePill}</span>
            <span className="hv-mode-time">{clock.toLocaleTimeString(L.locale, { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        </div>

        <div className="hv-frame-body">
          <div className="hv-col-left">
            <DeviceReadout label={t.tiles.ampLabel} value={state.amplitude.toFixed(1)} unit="cmH₂O" status={ampStatus} sub={t.tiles.ampSub} />
            <DeviceReadout label={t.tiles.mapLabel} value={state.mapMeasured.toFixed(1)} unit="cmH₂O" status={mapMeasuredHigh ? "warn" : "good"} alert={state.overDistAlert} sub={mapMeasuredHigh ? t.tiles.mapSubHigh : t.tiles.mapSubOk} />
            <DeviceReadout label={t.tiles.vhfoLabel} value={state.vhfo.toFixed(2)} unit="mL" status={vhfoStatus} alert={state.ettAlert} sub={t.tiles.vhfoSub(state.targetVhfo.toFixed(1), (state.vhfo / state.weight).toFixed(2))} />
            <DeviceReadout label={t.tiles.dco2Label} value={state.dco2.toFixed(0)} unit="mL²·Hz" status={dco2Status} sub={t.tiles.dco2Sub(state.dco2PerKg.toFixed(0))} />
          </div>

          <div className="hv-col-center">
            <div className="hv-display-wrap">
              <HVDisplay state={state} sv={sv} map={map} hz={hz} scenario={scenario} L={L} />
            </div>
            <div className="hv-vitals">
              <div className="hv-vital"><span className="hv-vital-label">{t.vitals.spo2}</span><span className={`hv-vital-value ${spo2Cls}`}>{state.spo2.toFixed(0)}</span><span className="hv-vital-unit">%</span></div>
              <div className="hv-vital"><span className="hv-vital-label">{t.vitals.pco2}</span><span className={`hv-vital-value ${pco2Cls}`}>{state.pco2.toFixed(0)}</span><span className="hv-vital-unit">mmHg</span></div>
              <div className="hv-vital"><span className="hv-vital-label">{t.vitals.recruit}</span><span className="hv-vital-value" style={{ color: "#94A3B8" }}>{(state.recruit * 100).toFixed(0)}</span><span className="hv-vital-unit">%</span></div>
              <div className="hv-vital"><span className="hv-vital-label">{t.vitals.effic}</span><span className="hv-vital-value" style={{ color: "#94A3B8" }}>{(state.efficiency * 100).toFixed(0)}</span><span className="hv-vital-unit">{t.vitals.efficUnit}</span></div>
            </div>
          </div>

          <div className="hv-col-right">
            <DeviceKnob label={t.knobs.sv} value={sv} unit="mL" min={W.svMin} max={W.svMax} step={W.svStep} onChange={setSv} accent="#A8F03C" target={svHint} targetTone={svHintTone} />
            <div className="hv-knob-pair">
              <DeviceKnob label={t.knobs.map} value={map} unit="cmH₂O" min={W.mapMin} max={W.mapMax} step={0.5} onChange={setMap} accent="#A8F03C" target={mapHint} targetTone={mapHintTone} />
              <DeviceKnob label={t.knobs.freq} value={hz} unit="Hz" min={W.hzMin} max={W.hzMax} step={1} onChange={setHz} accent="#A8F03C" target={hzHint} />
            </div>
            <DeviceKnob label={t.knobs.fio2} value={fio2} unit="%" min={21} max={100} step={1} onChange={setFio2} accent="#A8F03C" target={fio2 > 60 ? t.knobs.fio2HintHigh : t.knobs.fio2HintOk} targetTone={fio2 > 60 ? "warn" : "good"} />
          </div>
        </div>

        <div className="hv-frame-footer">
          {t.footer.map((f, i) => <span key={i} className="hv-foot-item">{f}</span>)}
        </div>
      </div>

      {cat !== "pediatric" ? (
        <PVLoop state={state} mapSet={map} L={L} />
      ) : (
        <div className="sim-loop sim-loop-disabled">
          <div className="sim-loop-disabled-icon">
            <svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="#94A3B8" strokeWidth="2"><circle cx="32" cy="32" r="26" /><path d="M16 16 L48 48" strokeLinecap="round" /></svg>
          </div>
          <div className="sim-loop-info">
            <span className="eyebrow">{t.noSensor.eyebrow}</span>
            <div className="sim-loop-title" style={{ marginTop: 8 }}>{t.noSensor.title}</div>
            <window.RT as="div" className="sim-loop-desc" html={t.noSensor.desc + '<span class="sim-fallbacks">' + t.noSensor.fallbacks.map(f => `<span class="sim-fallback">${f}</span>`).join("") + "</span>"} />
          </div>
        </div>
      )}

      <div style={{ marginTop: 56 }}>
        <SectionLabel n="05.1" label={t.diag.secLabel} />
        <window.RT as="h2" className="block-title block-title-dark" style={{ fontSize: "clamp(28px,3vw,42px)" }} html={t.diag.title} />
        <window.RT as="p" className="block-sub block-sub-dark" style={{ marginBottom: 32 }} html={t.diag.sub} />

        <div className="diag-grid">
          <div className="diag-card">
            <div className="diag-card-title">{t.diag.cardA}</div>
            <div className="diag-pattern">
              <span className="diag-chip">ΔA <span className="arrow-up">↑↑</span></span>
              <span className="diag-chip">V<sub>hfo</sub> <span className="arrow-crit">→ 0</span></span>
              <span className="diag-chip">DCO₂ <span className="arrow-crit">→ 0</span></span>
            </div>
            <window.RT as="div" className="diag-action" html={t.diag.cardAAction} />
          </div>
          <div className="diag-card compl">
            <div className="diag-card-title">{t.diag.cardB}</div>
            <div className="diag-pattern">
              <span className="diag-chip">ΔA <span className="arrow-up">↑</span></span>
              <span className="diag-chip">V<sub>hfo</sub> <span className="arrow-down">↓</span></span>
              <span className="diag-chip">DCO₂ <span className="arrow-crit">↓↓</span></span>
            </div>
            <window.RT as="div" className="diag-action" html={t.diag.cardBAction} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* PISTON vs JET */
function PistonVsJet({ L }) {
  const t = L.pistonJet;
  return (
    <section className="block" id="sec-pistonjet" data-screen-label="03 Piston vs JET">
      <SectionLabel n="03" label={t.secLabel} />
      <window.RT as="h2" className="block-title" html={t.title} />
      <window.RT as="p" className="block-sub" html={t.sub} />

      <div className="dp-explain">
        <div className="dp-side other">
          <div className="dp-side-head"><span className="dp-side-tag">{t.jetTag}</span><span className="dp-side-title">{t.jetTitle}</span></div>
          <svg viewBox="0 0 300 80" className="dp-side-flow-svg">
            <g stroke="#92400E" strokeWidth="2" fill="none">
              <path d="M 30 40 Q 60 16 90 40 Q 120 64 150 40 Q 180 16 210 40 Q 240 64 270 40"/>
              <path d="M 30 40 Q 55 58 80 40 Q 110 22 140 40 Q 170 58 200 40 Q 230 22 260 40" opacity="0.45"/>
            </g>
            <text x="48" y="74" fontFamily="JetBrains Mono" fontSize="9" fill="#92400E">{t.jetFlowLabel}</text>
          </svg>
          <div className="dp-side-formula">{t.jetFormula}</div>
          <window.RT as="div" className="dp-side-body" html={t.jetBody} />
        </div>

        <div className="dp-side vue">
          <div className="dp-side-head"><span className="dp-side-tag">{t.vueTag}</span><span className="dp-side-title">{t.vueTitle}</span></div>
          <svg viewBox="0 0 300 80" className="dp-side-flow-svg">
            <g stroke="#14B8A6" strokeWidth="2" fill="none">
              <path d="M 30 40 L 270 40"/><path d="M 30 30 L 270 30" opacity="0.4"/><path d="M 30 50 L 270 50" opacity="0.4"/>
            </g>
            <g fill="#14B8A6">{[60, 100, 140, 180, 220, 260].map(x => <circle key={x} cx={x} cy="40" r="2.5"/>)}</g>
            <text x="70" y="74" fontFamily="JetBrains Mono" fontSize="9" fill="#14B8A6">{t.vueFlowLabel}</text>
          </svg>
          <div className="dp-side-formula">{t.vueFormula}</div>
          <window.RT as="div" className="dp-side-body" html={t.vueBody} />
        </div>
      </div>

      <table className="vs-table">
        <thead><tr><th></th><th className="vs-th-jet">{t.thJet}</th><th className="vs-th-vue">{t.thVue}</th></tr></thead>
        <tbody>
          {t.rows.map((r, i) => (
            <tr key={i}><td className="vs-k">{r.k}</td><td className="vs-jet">{r.jet}</td><td className="vs-vue">{r.vue}</td></tr>
          ))}
        </tbody>
      </table>

      <div className="vs-takeaway">
        <div className="vs-takeaway-mark">=</div>
        <div className="vs-takeaway-body">
          <div className="vs-takeaway-title">{t.takeawayTitle}</div>
          <window.RT as="p" className="vs-takeaway-text" html={t.takeawayText} />
        </div>
      </div>
    </section>
  );
}

/* FLOW SENSOR */
function FlowSensor({ L }) {
  const t = L.flowSensor;
  return (
    <section className="block block-tinted fs-sec" id="sec-flowsensor" data-screen-label="06 FlowSensor">
      <SectionLabel n="06" label={t.secLabel} />
      <window.RT as="h2" className="block-title" html={t.title} />
      <window.RT as="p" className="block-sub" html={t.sub} />

      <div className="fs-grid">
        <div className="fs-card fs-with">
          <div className="fs-card-head"><span className="fs-card-tag fs-tag-ok">{t.withTag}</span></div>
          <window.RT as="div" className="fs-card-title" html={t.withTitle} />
          <ul className="fs-list">{t.withList.map((li, i) => <window.RT key={i} as="li" html={li} />)}</ul>
        </div>
        <div className="fs-card fs-without">
          <div className="fs-card-head"><span className="fs-card-tag fs-tag-warn">{t.withoutTag}</span></div>
          <div className="fs-card-title">{t.withoutTitle}</div>
          <window.RT as="p" className="fs-without-lead" html={t.withoutLead} />
          <div className="fs-fallbacks">
            {t.fallbacks.map((f, i) => (
              <div key={i} className="fs-fallback">
                <div className="fs-fallback-icon">{f.icon}</div>
                <div><div className="fs-fallback-title">{f.title}</div><div className="fs-fallback-body">{f.body}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { Simulator, PistonVsJet, FlowSensor });
