/* HFO Explainer — Simulator (v2 · Humming Vue display)
   - Realistic weight-based physics:
       SV → Vhfo via ETT/compliance-dependent efficiency (~22% ELBW, ~33% infant, ~42% peds).
       Vhfo is NOT linear with SV across categories.
   - Oscilloscope display mimicking the real Humming Vue:
       Pressure trace (oscillates around MAP with peak-to-peak = ΔA)
       Flow trace (derivative-like, amplitude ∝ SV·Hz)
       Hz controls wave count, MAP controls midline, ΔA controls swing height.
*/

const { useState, useEffect, useRef, useMemo } = React;

/* ============================================================
   Weight categories — realistic SV ranges, ETT-driven efficiency
   ============================================================ */
const WEIGHT_CATS = {
  elbw: {
    label: "500–1000 г",
    sub: "ELBW · экстремально недоношенные",
    weight: 0.8,
    ettSize: 2.5,                              // мм — узкая трубка
    baseEfficiency: 0.22,                      // SV → Vhfo ≈ 22%
    svMin: 1, svMax: 16, svStep: 0.5, svDefault: 7,
    mapMin: 5,  mapMax: 22, mapDefault: 10, mapOptimal: 10,
    hzMin: 12,  hzMax: 17, hzDefault: 15,
    fioDefault: 60,
    targetVhfoPerKg: 2.0,                      // мл/кг
  },
  infant: {
    label: "1–10 кг",
    sub: "Новорождённые · младенцы",
    weight: 3,
    ettSize: 3.5,
    baseEfficiency: 0.33,
    svMin: 5, svMax: 45, svStep: 1, svDefault: 18,
    mapMin: 6, mapMax: 26, mapDefault: 13, mapOptimal: 13,
    hzMin: 8, hzMax: 15, hzDefault: 10,
    fioDefault: 50,
    targetVhfoPerKg: 2.0,
  },
  pediatric: {
    label: "10 кг +",
    sub: "Дети · подростки",
    weight: 15,
    ettSize: 4.5,
    baseEfficiency: 0.42,
    svMin: 15, svMax: 160, svStep: 1, svDefault: 50,
    mapMin: 8, mapMax: 35, mapDefault: 17, mapOptimal: 17,
    hzMin: 5, hzMax: 10, hzDefault: 7,
    fioDefault: 45,
    targetVhfoPerKg: 2.0,
  },
};

const SCENARIOS = {
  optimal:        { label: "Оптимально",       tone: ""       },
  spontaneous:    { label: "Спонт. дыхание",   tone: "warn"   },
  lowCompliance:  { label: "Плохой комплайнс", tone: "warn"   },
  ettBlock:       { label: "Закупорка ЭТТ",    tone: "danger" },
};

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/* ============================================================
   Core physics model
   ============================================================ */
function computeState({ cat, scenario, sv, map, hz, fio2 }) {
  const W = WEIGHT_CATS[cat];
  const weight = W.weight;

  // ---- Delivery efficiency (SV → Vhfo) ----
  let efficiency = W.baseEfficiency;

  // Higher Hz = shorter time per cycle = slightly less delivered volume
  const hzPenalty = 1 - clamp((hz - W.hzDefault) * 0.025, -0.15, 0.15);
  efficiency *= hzPenalty;

  // Scenario modifiers
  const compl = scenario === "lowCompliance" ? 0.55 : 1.0;
  const ett   = scenario === "ettBlock"      ? 0.20 : 1.0;
  const spont = scenario === "spontaneous"   ? 0.92 : 1.0;
  efficiency *= compl * ett * spont;

  // MAP recruitment (parabolic around optimum)
  const mapOpt = W.mapOptimal + (scenario === "lowCompliance" ? 2 : 0);
  const dMap = map - mapOpt;
  let recruit;
  if (dMap <= 0) recruit = clamp(0.4 + (dMap + 8) / 8 * 0.6, 0.15, 1.0);
  else            recruit = clamp(1.0 - dMap * 0.055, 0.35, 1.0);

  // Collapsed alveoli can't accept volume — recruit modulates delivery too
  efficiency *= 0.65 + 0.35 * recruit;

  // ---- Output volume ----
  const vhfo = sv * efficiency;
  const dco2 = vhfo * vhfo * hz;
  const dco2PerKg = dco2 / weight;
  const targetVhfo = weight * (scenario === "spontaneous" ? 1.5 : W.targetVhfoPerKg);

  // ---- Amplitude (ΔA) — pressure swing required to push SV ----
  // Calibrated so SV=35, Hz=15 (per ref photo) ≈ 70 cmH₂O on healthy lungs.
  // Scales linearly with SV and with (Hz/refHz). Compliance & ETT inflate it.
  const refHz = W.hzDefault;
  let amplitude = sv * (1.0 + (hz / refHz) * 1.0) * 0.95;
  amplitude *= (1 / Math.max(0.45, compl));        // bad compliance → bigger ΔA
  amplitude *= (1 / Math.pow(Math.max(0.25, ett), 0.7));  // ETT block → much bigger ΔA
  amplitude = clamp(amplitude, 4, 95);

  // ---- MAP measured (drift up if over-distended / blocked) ----
  const overshoot = dMap > 4 ? (dMap - 4) * 0.3 : 0;
  const blockOffset = scenario === "ettBlock" ? 1.8 : 0;
  const mapMeasured = map + overshoot + blockOffset;

  // ---- SpO₂ / pCO₂ — simplified gas model ----
  let spo2 = 70 + 24 * recruit + (fio2 - 30) * 0.16;
  if (scenario === "ettBlock") spo2 *= 0.72;
  if (scenario === "spontaneous") spo2 += 2;
  spo2 = clamp(spo2, 35, 100);

  const targetDcoPerKg = 80;
  const ratio = Math.max(0.05, dco2PerKg / targetDcoPerKg);
  let pco2 = 40 / Math.sqrt(ratio);
  pco2 = clamp(pco2, 18, 115);

  // ---- Status flags ----
  const targetMet      = Math.abs(vhfo - targetVhfo) / targetVhfo < 0.18;
  const ettAlert       = ett < 1 && vhfo < targetVhfo * 0.4;
  const complAlert     = compl < 1 && dco2PerKg < 25;
  const overDistAlert  = dMap > 6;

  return {
    weight, recruit, compl, ett, dMap, efficiency,
    vhfo, dco2, dco2PerKg, targetVhfo,
    amplitude, mapMeasured,
    spo2, pco2,
    targetMet, ettAlert, complAlert, overDistAlert,
  };
}

/* ============================================================
   HVDisplay — oscilloscope mimicking the real Humming Vue
   ============================================================ */
function HVDisplay({ state, sv, map, hz, scenario }) {
  const cvRef = useRef(null);
  const stRef = useRef({ state, sv, map, hz, scenario });
  useEffect(() => { stRef.current = { state, sv, map, hz, scenario }; },
           [state, sv, map, hz, scenario]);

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");

    // High-DPI
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    function resize() {
      const rect = cv.getBoundingClientRect();
      cv.width  = rect.width * dpr;
      cv.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv);

    let raf;
    const t0 = performance.now();

    function draw() {
      const rect = cv.getBoundingClientRect();
      const W = rect.width, H = rect.height;
      const t = (performance.now() - t0) / 1000;
      const { state, sv, map, hz, scenario } = stRef.current;

      // Layout
      const padL = 56, padR = 18, padT = 28;
      const labelGap = 18;
      const plotW = W - padL - padR;
      const halfH = (H - padT - 30) / 2;
      const pTop = padT, pBot = pTop + halfH - 8;       // pressure plot
      const fTop = pBot + 28, fBot = fTop + halfH - 8;  // flow plot

      // Background
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);

      // ---------- Pressure plot ----------
      drawAxis(ctx, padL, pTop, plotW, pBot - pTop, {
        title: "Pressure",
        unitLabel: "(cmH₂O)",
        ticks: [40, 20, 0, -20],
        tickRange: [-20, 40],
      });

      // MAP dashed midline
      const pMin = -20, pMax = 40;
      const yForP = v => pTop + (pMax - v) / (pMax - pMin) * (pBot - pTop);
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      const mapY = yForP(map);
      ctx.moveTo(padL, mapY);
      ctx.lineTo(padL + plotW, mapY);
      ctx.stroke();
      ctx.setLineDash([]);

      // MAP label on the line
      ctx.fillStyle = "#F59E0B";
      ctx.font = "600 10px JetBrains Mono, monospace";
      ctx.fillText(`MAP ${map.toFixed(1)}`, padL + plotW - 64, mapY - 4);

      // Pressure wave: oscillation around MAP, peak-to-peak = ΔA
      // Number of visible cycles over 3 sec window = hz × 3
      const windowSec = 3;
      const halfAmp = state.amplitude / 2;
      const blocked = scenario === "ettBlock";

      ctx.strokeStyle = "#A8F03C";    // device green
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      const steps = Math.max(420, Math.floor(plotW * 1.5));
      for (let i = 0; i <= steps; i++) {
        const f = i / steps;
        const secs = f * windowSec;
        const phase = (secs + t) * hz * Math.PI * 2;
        // base sinusoid
        let p = map + Math.sin(phase) * halfAmp;
        // slight asymmetry — sharper down-stroke (active expiration look)
        p += Math.sin(phase * 2) * halfAmp * 0.08;
        // ETT block → flattens / noisy
        if (blocked) p = map + Math.sin(phase) * halfAmp * 0.15 + (Math.random() - 0.5) * 1.5;
        // visual noise
        p += (Math.random() - 0.5) * 0.4;
        const x = padL + f * plotW;
        const y = yForP(clamp(p, pMin + 0.5, pMax - 0.5));
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // ---------- Flow plot ----------
      drawAxis(ctx, padL, fTop, plotW, fBot - fTop, {
        title: "Flow",
        unitLabel: "(LPM)",
        ticks: [5, 2, 0, -2, -5],
        tickRange: [-5, 5],
      });

      // Flow amplitude ∝ SV × Hz, scaled to LPM display range
      // SV[ml] × Hz × 60 / 1000 = LPM equivalent — but we want display-pleasing
      const flowAmp = clamp((sv * hz) / 70 * (blocked ? 0.18 : 1.0), 0.3, 5.0);
      const fMin = -5, fMax = 5;
      const yForF = v => fTop + (fMax - v) / (fMax - fMin) * (fBot - fTop);

      // Zero baseline (dashed)
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.beginPath();
      const flowZeroY = yForF(0);
      ctx.moveTo(padL, flowZeroY);
      ctx.lineTo(padL + plotW, flowZeroY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = "#A8F03C";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const f = i / steps;
        const secs = f * windowSec;
        const phase = (secs + t) * hz * Math.PI * 2;
        // flow = derivative of pressure → cosine
        let fv = Math.cos(phase) * flowAmp;
        fv += (Math.random() - 0.5) * 0.15;
        const x = padL + f * plotW;
        const y = yForF(clamp(fv, fMin + 0.2, fMax - 0.2));
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // ---------- Time axis ----------
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "500 10px JetBrains Mono, monospace";
      ctx.fillText("0(sec)", padL - 4, fBot + 16);
      for (let s = 1; s <= 3; s++) {
        const x = padL + (s / 3) * plotW;
        ctx.fillText(s.toFixed(1), x - 6, fBot + 16);
      }

      // ---------- Scenario overlays ----------
      if (scenario === "ettBlock") {
        ctx.fillStyle = "rgba(239,68,68,0.85)";
        ctx.font = "700 11px Inter Tight, sans-serif";
        ctx.fillText("⚠  ETT BLOCK · LOW VOLUME ALERT", padL + 8, padT + 14);
      } else if (scenario === "lowCompliance") {
        ctx.fillStyle = "rgba(245,158,11,0.9)";
        ctx.font = "700 11px Inter Tight, sans-serif";
        ctx.fillText("⚠  LOW COMPLIANCE · ΔA RISING", padL + 8, padT + 14);
      }

      raf = requestAnimationFrame(draw);
    }
    draw();

    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return (
    <canvas ref={cvRef} className="hv-display"
      style={{ width: "100%", height: "100%", display: "block", background: "#000", borderRadius: 8 }} />
  );
}

// Helper: draws plot frame, axis ticks, title, unit label
function drawAxis(ctx, x, y, w, h, opts) {
  const { title, unitLabel, ticks, tickRange } = opts;
  // Grid (faint)
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    const gx = x + (w / 6) * i;
    ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); ctx.stroke();
  }
  for (let i = 1; i < 4; i++) {
    const gy = y + (h / 4) * i;
    ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke();
  }
  // Outer rect
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.strokeRect(x, y, w, h);

  // Title
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "600 12px Inter Tight, sans-serif";
  ctx.fillText(title, x + 6, y - 8);

  // Unit label
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "500 9px JetBrains Mono, monospace";
  ctx.fillText(unitLabel, x - 48, y - 8);

  // Y ticks
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "500 9px JetBrains Mono, monospace";
  const [tMin, tMax] = tickRange;
  ticks.forEach(v => {
    const ty = y + (tMax - v) / (tMax - tMin) * h;
    ctx.fillText(v.toFixed(1), x - 38, ty + 3);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.beginPath(); ctx.moveTo(x - 4, ty); ctx.lineTo(x, ty); ctx.stroke();
  });
}

/* ============================================================
   P-V Loop visualization
   ============================================================ */
function PVLoop({ state, mapSet }) {
  const cvRef = useRef(null);
  const stRef = useRef({ state, mapSet });
  useEffect(() => { stRef.current = { state, mapSet }; }, [state, mapSet]);

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    let raf;
    const t0 = performance.now();
    function draw() {
      const W = cv.width, H = cv.height;
      const t = (performance.now() - t0) / 1000;
      ctx.clearRect(0, 0, W, H);

      const padL = 60, padR = 30, padT = 24, padB = 40;
      const plotW = W - padL - padR;
      const plotH = H - padT - padB;
      const cx = padL + plotW / 2;
      const cy = padT + plotH / 2;

      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      for (let i = 1; i < 6; i++) {
        const xg = padL + (plotW / 6) * i;
        ctx.beginPath(); ctx.moveTo(xg, padT); ctx.lineTo(xg, H - padB); ctx.stroke();
        const yg = padT + (plotH / 6) * i;
        ctx.beginPath(); ctx.moveTo(padL, yg); ctx.lineTo(W - padR, yg); ctx.stroke();
      }
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(padL, H - padB); ctx.lineTo(W - padR, H - padB);
      ctx.moveTo(padL, padT); ctx.lineTo(padL, H - padB);
      ctx.stroke();
      ctx.fillStyle = "#94A3B8";
      ctx.font = "600 10px Inter Tight, sans-serif";
      ctx.fillText("ДАВЛЕНИЕ →", W - padR - 90, H - padB + 28);
      ctx.save(); ctx.translate(18, padT + plotH/2); ctx.rotate(-Math.PI/2);
      ctx.fillText("ОБЪЁМ →", -28, 0); ctx.restore();
      ctx.fillStyle = "#F59E0B";
      ctx.font = "700 10px JetBrains Mono, monospace";
      ctx.fillText("MAP", cx - 14, H - padB + 16);

      const s = stRef.current.state;
      const ampScale = plotW * 0.7 / 95;
      const volScale = plotH * 0.85 / Math.max(1, s.targetVhfo * 2.4);
      let rx = Math.max(3, (s.amplitude / 2) * ampScale);
      let ry = Math.max(0.6, (s.vhfo / 2) * volScale);
      const slope = Math.atan2(ry * 1.4, rx * 0.6);

      ctx.strokeStyle = "#14B8A6";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const N = 180;
      const pulse = 0.97 + Math.sin(t * 4) * 0.03;
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2;
        const lx = Math.cos(a) * rx * pulse;
        const ly = Math.sin(a) * ry * pulse;
        const x = cx + lx * Math.cos(slope) - ly * Math.sin(slope);
        const y = cy - (lx * Math.sin(slope) + ly * Math.cos(slope));
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.fillStyle = "#F59E0B";
      ctx.beginPath(); ctx.arc(cx + rx * Math.cos(slope), cy - rx * Math.sin(slope), 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx - rx * Math.cos(slope), cy + rx * Math.sin(slope), 4, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = "#94A3B8";
      ctx.font = "600 10px JetBrains Mono, monospace";
      ctx.fillText(`ΔA ≈ ${s.amplitude.toFixed(0)} см H₂O`, padL + 8, padT + 16);
      ctx.fillStyle = "#14B8A6";
      ctx.fillText(`V_hfo ≈ ${s.vhfo.toFixed(1)} мл`, padL + 8, padT + 32);

      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  const s = state;
  let stateLabel = "good", title = "Эллипс · хороший комплайнс", desc;
  if (s.ettAlert) {
    stateLabel = "bad";
    title = "Плоская линия · нет объёма";
    desc = "ΔA огромная, V_hfo стремится к нулю. Большой ход поршня — никакого объёма в лёгкие. Закупорка ЭТТ или отсоединение. Санация немедленно.";
  } else if (s.complAlert) {
    stateLabel = "warn";
    title = "Узкая петля · плохой комплайнс";
    desc = "ΔA выросла, V_hfo снизился, DCO₂ упал критично. Лёгкие плохо растягиваются. Рекруит-маневр: подними MAP до точки раскрытия.";
  } else if (s.overDistAlert) {
    stateLabel = "warn";
    title = "Перерастяжение · риск";
    desc = "MAP высокий, MAP измеренный растёт сам по себе. Альвеолы перенасыщены, перфузия капилляров нарушается. Снижай MAP по 1 см до оптимума.";
  } else if (s.targetMet) {
    desc = "Открытая петля с хорошей площадью: ΔA умеренная, V_hfo на цели. Газы перемешиваются эффективно. Так должно быть.";
  } else {
    stateLabel = "warn";
    title = "Не попал в цель";
    desc = `V_hfo = ${s.vhfo.toFixed(1)} мл, цель ≈ ${s.targetVhfo.toFixed(1)} мл. Подкрути SV в нужную сторону.`;
  }

  return (
    <div className="sim-loop">
      <canvas ref={cvRef} width="600" height="220" className="sim-loop-canvas"></canvas>
      <div className="sim-loop-info">
        <span className="eyebrow">P–V петля · комплайнс</span>
        <div className={`sim-loop-state ${stateLabel}`}>
          {stateLabel === "good" ? "✓ Норма" : stateLabel === "warn" ? "⚠ Внимание" : "⚠ Тревога"}
        </div>
        <div className="sim-loop-title">{title}</div>
        <div className="sim-loop-desc">{desc}</div>
      </div>
    </div>
  );
}

/* ============================================================
   Device-style readout card (left of display) — looks like the
   blue tiles on the real Humming Vue screen
   ============================================================ */
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

/* Right-side settable knob (Stroke Vol style) */
function DeviceKnob({ label, value, unit, sub, min, max, step, onChange, accent, target, targetTone }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="hv-knob">
      <div className="hv-knob-label">{label}</div>
      <div className="hv-knob-value" style={{ color: accent }}>
        {step >= 1 ? Math.round(value) : value.toFixed(1)}
      </div>
      {unit && <div className="hv-knob-unit">{unit}</div>}
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="hv-slider"
        style={{ background: `linear-gradient(90deg, ${accent} 0%, ${accent} ${pct}%, rgba(255,255,255,0.18) ${pct}%, rgba(255,255,255,0.18) 100%)` }} />
      <div className="hv-range"><span>{min}</span><span>{max}</span></div>
      {sub && <div className="hv-knob-sub">{sub}</div>}
      {target && <div className={`hv-knob-target${targetTone ? " " + targetTone : ""}`}>{target}</div>}
    </div>
  );
}

/* ============================================================
   Simulator main
   ============================================================ */
function Simulator() {
  const [cat, setCat] = useState("infant");
  const [scenario, setScenario] = useState("optimal");
  const W = WEIGHT_CATS[cat];

  const [sv, setSv]     = useState(W.svDefault);
  const [map, setMap]   = useState(W.mapDefault);
  const [hz, setHz]     = useState(W.hzDefault);
  const [fio2, setFio2] = useState(W.fioDefault);

  // Reset to category defaults when category changes
  const lastCat = useRef(cat);
  useEffect(() => {
    if (lastCat.current !== cat) {
      setSv(W.svDefault);
      setMap(W.mapDefault);
      setHz(W.hzDefault);
      setFio2(W.fioDefault);
      lastCat.current = cat;
    }
  }, [cat, W]);

  const state = useMemo(() => computeState({ cat, scenario, sv, map, hz, fio2 }),
    [cat, scenario, sv, map, hz, fio2]);

  // SV target hint
  const tgtPerKg = scenario === "spontaneous" ? 1.5 : W.targetVhfoPerKg;
  const targetVhfo = W.weight * tgtPerKg;
  const targetSV = targetVhfo / W.baseEfficiency;  // SV needed to deliver target Vhfo
  const svDelta = sv - targetSV;
  const svHint =
    `Цель V_hfo ≈ ${targetVhfo.toFixed(1)} мл (${tgtPerKg} мл/кг) → SV ≈ ${targetSV.toFixed(0)} мл`;
  const svHintTone = Math.abs(svDelta) > targetSV * 0.3 ? "warn" : "good";

  // MAP target hint
  const mapDelta = map - W.mapOptimal;
  const mapHint = state.overDistAlert
    ? `MAP > оптимум на ${mapDelta.toFixed(0)} см → перерастяжение`
    : mapDelta < -3
    ? `MAP ниже оптимума → плохой рекруит`
    : `Оптимум ≈ ${W.mapOptimal} см H₂O`;
  const mapHintTone = (state.overDistAlert || mapDelta < -3) ? "warn" : "good";

  const hzHint = `Старт ${W.hzDefault} Гц. Меняй редко — это «грубая» ручка.`;

  // Vitals classes
  const spo2Cls = state.spo2 >= 90 ? "spo2-ok" : state.spo2 >= 85 ? "spo2-warn" : "spo2-bad";
  const pco2Cls = (state.pco2 >= 35 && state.pco2 <= 50) ? "pco2-ok"
                : (state.pco2 > 60 || state.pco2 < 30) ? "pco2-bad" : "pco2-warn";

  // Amplitude / Vhfo / DCO2 status
  const ampStatus = state.amplitude > 75 ? "critical" : state.amplitude > 55 ? "warn" : state.amplitude < 8 ? "warn" : "good";
  const vhfoStatus = state.targetMet ? "good" : state.vhfo < state.targetVhfo * 0.5 ? "critical" : "warn";
  const dco2Status = state.dco2PerKg >= 50 && state.dco2PerKg <= 130 ? "good"
                   : state.dco2PerKg < 25 ? "critical" : "warn";
  const mapMeasuredHigh = state.mapMeasured > map + 1.2;

  return (
    <section className="block sim" data-screen-label="05 Simulator">
      <SectionLabel n="05" label="Симулятор · Дисплей Humming Vue" />
      <h2 className="block-title block-title-dark">
        Крути <span className="accent">справа</span> — смотри волны<br/>
        и <span style={{color:"#F59E0B"}}>авто-показатели слева</span>.
      </h2>
      <p className="block-sub block-sub-dark">
        Это упрощённая копия дисплея Humming Vue. <b>SV</b> поднимает амплитуду волны давления
        и поток. <b>MAP</b> — это горизонтальная пунктирная линия посередине: она задаёт,
        вокруг чего колеблется давление. <b>Hz</b> — частота волн на экране. Если лёгкие
        плохо растягиваются или ЭТТ зажат — <b>амплитуда (ΔA)</b> вырастет сама, а
        <b> V<sub>hfo</sub></b> упадёт. Реально доставленный объём всегда меньше SV —
        у недоношенных в 4–5 раз, у взрослых в ~2,5 раза.
      </p>

      {/* Top controls: weight + scenario */}
      <div className="sim-controls-row">
        <div className="sim-control-group">
          <span className="sim-control-label">Категория</span>
          <div className="seg-btn-row">
            {Object.entries(WEIGHT_CATS).map(([k, v]) => (
              <button key={k}
                className={`seg-btn ${cat === k ? "active" : ""}`}
                onClick={() => setCat(k)}>
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <div className="sim-control-group">
          <span className="sim-control-label">Сценарий</span>
          <div className="seg-btn-row">
            {Object.entries(SCENARIOS).map(([k, v]) => (
              <button key={k}
                className={`seg-btn ${v.tone} ${scenario === k ? "active" : ""}`}
                onClick={() => setScenario(k)}>
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Device-style frame */}
      <div className="hv-frame">
        <div className="hv-frame-header">
          <div className="hv-brand">Humming Vue</div>
          <div className="hv-mode">
            <span className="hv-mode-pill">HFO</span>
            <span className="hv-mode-time">
              {new Date().toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'})}
            </span>
          </div>
        </div>

        <div className="hv-frame-body">
          {/* LEFT: blue readout tiles (like the real device) */}
          <div className="hv-col-left">
            <DeviceReadout
              label="Amplitude" value={state.amplitude.toFixed(1)}
              unit="cmH₂O" status={ampStatus}
              sub="ΔA · энергия преодоления" />
            <DeviceReadout
              label="MAP" value={state.mapMeasured.toFixed(1)}
              unit="cmH₂O" status={mapMeasuredHigh ? "warn" : "good"}
              alert={state.overDistAlert}
              sub={mapMeasuredHigh ? "↑ растёт сам · перераст." : "измеренный"} />
            <DeviceReadout
              label="Vhfo" value={state.vhfo.toFixed(2)}
              unit="mL" status={vhfoStatus}
              alert={state.ettAlert}
              sub={`цель ${state.targetVhfo.toFixed(1)} · ${(state.vhfo / state.weight).toFixed(2)} мл/кг`} />
            <DeviceReadout
              label="DCO₂" value={state.dco2.toFixed(0)}
              unit="мл²·Гц" status={dco2Status}
              sub={`V_hfo² × f · ${state.dco2PerKg.toFixed(0)}/кг`} />
          </div>

          {/* CENTER: oscilloscope display */}
          <div className="hv-col-center">
            <div className="hv-display-wrap">
              <HVDisplay state={state} sv={sv} map={map} hz={hz} scenario={scenario} />
            </div>
            <div className="hv-vitals">
              <div className="hv-vital">
                <span className="hv-vital-label">SpO₂</span>
                <span className={`hv-vital-value ${spo2Cls}`}>{state.spo2.toFixed(0)}</span>
                <span className="hv-vital-unit">%</span>
              </div>
              <div className="hv-vital">
                <span className="hv-vital-label">pCO₂</span>
                <span className={`hv-vital-value ${pco2Cls}`}>{state.pco2.toFixed(0)}</span>
                <span className="hv-vital-unit">мм рт.ст.</span>
              </div>
              <div className="hv-vital">
                <span className="hv-vital-label">Рекруит</span>
                <span className="hv-vital-value" style={{ color: "#94A3B8" }}>{(state.recruit * 100).toFixed(0)}</span>
                <span className="hv-vital-unit">%</span>
              </div>
              <div className="hv-vital">
                <span className="hv-vital-label">Эффект.</span>
                <span className="hv-vital-value" style={{ color: "#94A3B8" }}>{(state.efficiency * 100).toFixed(0)}</span>
                <span className="hv-vital-unit">% SV→Vhfo</span>
              </div>
            </div>
          </div>

          {/* RIGHT: settable knobs (green like real Stroke Vol/Freq tiles) */}
          <div className="hv-col-right">
            <DeviceKnob
              label="Stroke Vol" value={sv} unit="mL"
              min={W.svMin} max={W.svMax} step={W.svStep}
              onChange={setSv}
              accent="#A8F03C"
              target={svHint} targetTone={svHintTone} />
            <div className="hv-knob-pair">
              <DeviceKnob
                label="MAP set" value={map} unit="cmH₂O"
                min={W.mapMin} max={W.mapMax} step={0.5}
                onChange={setMap}
                accent="#A8F03C"
                target={mapHint} targetTone={mapHintTone} />
              <DeviceKnob
                label="Frequency" value={hz} unit="Hz"
                min={W.hzMin} max={W.hzMax} step={1}
                onChange={setHz}
                accent="#A8F03C"
                target={hzHint} />
            </div>
            <DeviceKnob
              label="FiO₂" value={fio2} unit="%"
              min={21} max={100} step={1}
              onChange={setFio2}
              accent="#A8F03C"
              target={fio2 > 60 ? "FiO₂ > 60% > 6 ч — токсично" : "Старт 90–100%, снижай по 5%"}
              targetTone={fio2 > 60 ? "warn" : "good"} />
          </div>
        </div>

        <div className="hv-frame-footer">
          <span className="hv-foot-item">Power</span>
          <span className="hv-foot-item">Flush O₂</span>
          <span className="hv-foot-item">HFO SI</span>
          <span className="hv-foot-item">Panel Lock</span>
          <span className="hv-foot-item">Alarm Suspend</span>
        </div>
      </div>

      {/* P-V loop — only shown for ≤10 kg (flow sensor only available below pediatric) */}
      {cat !== "pediatric" ? (
        <PVLoop state={state} mapSet={map} />
      ) : (
        <div className="sim-loop sim-loop-disabled">
          <div className="sim-loop-disabled-icon">
            <svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="#94A3B8" strokeWidth="2">
              <circle cx="32" cy="32" r="26" />
              <path d="M16 16 L48 48" strokeLinecap="round" />
            </svg>
          </div>
          <div className="sim-loop-info">
            <span className="eyebrow">P–V петля недоступна</span>
            <div className="sim-loop-title" style={{marginTop:8}}>Нет flow-сенсора &gt; 10 кг</div>
            <div className="sim-loop-desc">
              На взрослом контуре нет проксимального датчика потока — <b>V<sub>hfo</sub></b> и
              <b> DCO₂</b> аппарат не измеряет напрямую, петля давление–объём не строится.
              Без датчика опирайся на три вещи:
              <span className="sim-fallbacks">
                <span className="sim-fallback"><b>КЩС</b> — артериальная кровь, главный ориентир</span>
                <span className="sim-fallback"><b>Глаз</b> — до какого ребра видна вибрация грудной клетки</span>
                <span className="sim-fallback"><b>ΔA</b> — резкий рост амплитуды = выше сопротивление</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Diagnostic patterns */}
      <div style={{ marginTop: 56 }}>
        <SectionLabel n="05.1" label="Диагностика по ΔA · что говорит амплитуда" />
        <h2 className="block-title block-title-dark" style={{ fontSize: "clamp(28px,3vw,42px)" }}>
          ΔA растёт. <span className="accent">Что случилось?</span>
        </h2>
        <p className="block-sub block-sub-dark" style={{ marginBottom: 32 }}>
          Амплитуда — это <b>энергия, которая нужна аппарату</b>, чтобы протолкнуть SV
          через ЭТТ и расправить лёгкое. Если она растёт сама — есть препятствие.
          Смотри на <b>V<sub>hfo</sub></b> и <b>DCO₂</b> рядом — они скажут, где именно проблема.
        </p>

        <div className="diag-grid">
          <div className="diag-card">
            <div className="diag-card-title">A · Закупорка ЭТТ</div>
            <div className="diag-pattern">
              <span className="diag-chip">ΔA <span className="arrow-up">↑↑</span></span>
              <span className="diag-chip">V<sub>hfo</sub> <span className="arrow-crit">→ 0</span></span>
              <span className="diag-chip">DCO₂ <span className="arrow-crit">→ 0</span></span>
            </div>
            <div className="diag-action">
              Большой ход поршня, никакого объёма. Грудная клетка не вибрирует.
              <br/><b>→ САНАЦИЯ. Срочно.</b> Возможна обструкция ЭТТ.
            </div>
          </div>

          <div className="diag-card compl">
            <div className="diag-card-title">B · Плохой комплайнс</div>
            <div className="diag-pattern">
              <span className="diag-chip">ΔA <span className="arrow-up">↑</span></span>
              <span className="diag-chip">V<sub>hfo</sub> <span className="arrow-down">↓</span></span>
              <span className="diag-chip">DCO₂ <span className="arrow-crit">↓↓</span></span>
            </div>
            <div className="diag-action">
              Vhfo упал слегка, но DCO₂ — критично (квадрат от V<sub>hfo</sub>).
              <br/><b>→ Рекруит-маневр.</b> ↑ MAP до точки раскрытия, потом ↓ до оптимума.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   PistonVsJet — the crucial concept: two kinds of HFO.
   Piston (Humming Vue) = volume-controlled, laminar, assured volume.
   JET = pressure-controlled, turbulent, volume "floats".
   ============================================================ */
function PistonVsJet() {
  const rows = [
    { k: "Принцип работы",      jet: "По давлению (ΔP)",                  vue: "По объёму (Stroke Volume)" },
    { k: "Привод",             jet: "Струя газа под давлением",          vue: "Прецизионный поршень · 13 мкм" },
    { k: "Давление в контуре",  jet: "+ и − попеременно по всему контуру", vue: "Колебания вокруг стабильного MAP" },
    { k: "Характер потока",     jet: "Турбулентный → потери мощности",    vue: "Ламинарный → эффективный" },
    { k: "Что ты задаёшь",      jet: "Амплитуду давления (ΔP)",           vue: "Реальную порцию объёма (SV)" },
    { k: "Цена доставки Vt",    jet: "Растёт давление в дых. путях",      vue: "Растёт лишь индикатор ΔA" },
    { k: "Гарантия объёма",     jet: "Нет — объём «плывёт»",              vue: "Да — объём доставлен порцией" },
    { k: "За чем следишь",      jet: "За триггером давления",             vue: "За реальным V_hfo (flow-сенсор)" },
  ];

  return (
    <section className="block" data-screen-label="03 Piston vs JET">
      <SectionLabel n="03" label="Технология · Поршень против JET" />
      <h2 className="block-title">
        Есть два способа делать HFO. <span className="accent">Они не равны.</span>
      </h2>
      <p className="block-sub">
        Humming Vue — <b>поршневой</b> аппарат. Поршень создаёт реальную <b>порцию объёма</b>,
        которая доставляется пациенту. Объём не зависит от давления — поэтому ты управляешь
        вентиляцией напрямую. JET-вентиляторы работают иначе: они качают давление, а объём
        получается «как выйдет».
      </p>

      <div className="dp-explain">
        <div className="dp-side other">
          <div className="dp-side-head">
            <span className="dp-side-tag">JET-вентиляция</span>
            <span className="dp-side-title">По давлению · турбулентный поток</span>
          </div>
          <svg viewBox="0 0 300 80" className="dp-side-flow-svg">
            <g stroke="#92400E" strokeWidth="2" fill="none">
              <path d="M 30 40 Q 60 16 90 40 Q 120 64 150 40 Q 180 16 210 40 Q 240 64 270 40"/>
              <path d="M 30 40 Q 55 58 80 40 Q 110 22 140 40 Q 170 58 200 40 Q 230 22 260 40" opacity="0.45"/>
            </g>
            <text x="60" y="74" fontFamily="JetBrains Mono" fontSize="9" fill="#92400E">+ и − давление · турбулентность</text>
          </svg>
          <div className="dp-side-formula">ΔP → Vt (зависит от R и C)</div>
          <div className="dp-side-body">
            Аппарат создаёт <b>+ и − давление</b> по всему контуру → поток становится
            <b> турбулентным</b> → теряется мощность, дыхательные пути «растягиваются».
            Чтобы доставить тот же Vt, нужно <b>больше давления = больше амплитуды</b>.
            Но большая часть давления уходит на то, чтобы держать пути открытыми —
            и <b>нет уверенности</b>, что нужный объём реально дошёл. Риск гиповентиляции.
          </div>
        </div>

        <div className="dp-side vue">
          <div className="dp-side-head">
            <span className="dp-side-tag">Humming Vue</span>
            <span className="dp-side-title">По объёму · ламинарный поток</span>
          </div>
          <svg viewBox="0 0 300 80" className="dp-side-flow-svg">
            <g stroke="#14B8A6" strokeWidth="2" fill="none">
              <path d="M 30 40 L 270 40"/>
              <path d="M 30 30 L 270 30" opacity="0.4"/>
              <path d="M 30 50 L 270 50" opacity="0.4"/>
            </g>
            <g fill="#14B8A6">
              {[60, 100, 140, 180, 220, 260].map(x => (
                <circle key={x} cx={x} cy="40" r="2.5"/>
              ))}
            </g>
            <text x="80" y="74" fontFamily="JetBrains Mono" fontSize="9" fill="#14B8A6">ламинарный поток · точная порция</text>
          </svg>
          <div className="dp-side-formula">SV → V_hfo (точно, 13 мкм)</div>
          <div className="dp-side-body">
            Поршень формирует <b>точную порцию объёма (SV)</b> вне зависимости от условий →
            поток <b>ламинарный</b>, эффективнее, без избыточного давления в лёгких.
            Ты не задаёшь давление. <b>ΔA — это лишь индикатор энергии</b>, которая
            понадобилась, чтобы преодолеть сопротивление (ЭТТ, комплайнс). A может быть выше
            или ниже — но <b>объём гарантированно доставлен</b>.
          </div>
        </div>
      </div>

      {/* Attribute-by-attribute comparison */}
      <table className="vs-table">
        <thead>
          <tr>
            <th></th>
            <th className="vs-th-jet">JET · по давлению</th>
            <th className="vs-th-vue">Humming Vue · по объёму</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="vs-k">{r.k}</td>
              <td className="vs-jet">{r.jet}</td>
              <td className="vs-vue">{r.vue}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Key takeaway banner */}
      <div className="vs-takeaway">
        <div className="vs-takeaway-mark">=</div>
        <div className="vs-takeaway-body">
          <div className="vs-takeaway-title">Итог: гарантированный объём против давления, за которым нужно следить.</div>
          <p className="vs-takeaway-text">
            Обе технологии могут вентилировать хорошо. Но с <b>Humming Vue</b> ты достигаешь цели
            с <b>гарантированным объёмом</b> — это вентиляция, управляемая по объёму, и ты не
            перегружаешь дыхательные пути давлением. С <b>JET</b> приходится постоянно держать
            глаз на триггере давления: его колебание → колебание объёма → вентиляция то лучше,
            то хуже.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   FlowSensor — why you can trust the delivered volume.
   With FS → real V_hfo & DCO₂. Without FS (many JET units,
   peds circuit) → rely on BGA, visual excursion, amplitude.
   ============================================================ */
function FlowSensor() {
  const fallbacks = [
    { icon: "🩸", title: "КЩС — артериальная кровь",
      body: "Главный ориентир без датчика. pH, pCO₂, pO₂, BE. Венозная — только для тренда в крайнем случае." },
    { icon: "👁", title: "Грудная экскурсия — глазом",
      body: "Смотри, до какого ребра видна высокочастотная вибрация. Норма — мелкая «звенящая» вибрация до уровня пупка." },
    { icon: "📈", title: "Амплитуда (ΔA)",
      body: "Если ΔA резко выросла — это сигнал более высокого сопротивления (ЭТТ, комплайнс). Объём при этом мог упасть." },
  ];

  return (
    <section className="block block-tinted fs-sec" data-screen-label="06 FlowSensor">
      <SectionLabel n="06" label="Датчик потока · Уверенность в объёме" />
      <h2 className="block-title">
        С датчиком потока ты <span className="accent">видишь</span> реальный объём.
      </h2>
      <p className="block-sub">
        Flow-сенсор (FS) — это то, что превращает «надеюсь, объём дошёл» в «знаю, что дошёл».
        Он измеряет реальный <b>V<sub>hfo</sub></b> и считает <b>DCO₂</b>. Многие JET-вентиляторы
        датчика потока не имеют — там ты не уверен в реальной доставке объёма.
      </p>

      <div className="fs-grid">
        <div className="fs-card fs-with">
          <div className="fs-card-head">
            <span className="fs-card-tag fs-tag-ok">С датчиком потока · Humming Vue</span>
          </div>
          <div className="fs-card-title">Видишь реальный V<sub>hfo</sub> и DCO₂</div>
          <ul className="fs-list">
            <li>Реально доставленный объём <b>V<sub>hfo</sub></b> — на экране, в реальном времени</li>
            <li><b>DCO₂ = V<sub>hfo</sub>² × f</b> — точный показатель вентиляции</li>
            <li>Сразу видно: объём упал — значит препятствие, а не «померещилось»</li>
            <li>Мониторинг процесса HFO напрямую, а не по косвенным признакам</li>
          </ul>
        </div>

        <div className="fs-card fs-without">
          <div className="fs-card-head">
            <span className="fs-card-tag fs-tag-warn">Без датчика · многие JET / контур &gt; 10 кг</span>
          </div>
          <div className="fs-card-title">Объёма не видно — оценивай косвенно</div>
          <p className="fs-without-lead">
            Нет V<sub>hfo</sub> и DCO₂ на экране. Уверенности в реальной доставке объёма нет —
            опирайся на три ориентира:
          </p>
          <div className="fs-fallbacks">
            {fallbacks.map((f, i) => (
              <div key={i} className="fs-fallback">
                <div className="fs-fallback-icon">{f.icon}</div>
                <div>
                  <div className="fs-fallback-title">{f.title}</div>
                  <div className="fs-fallback-body">{f.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { Simulator, PistonVsJet, FlowSensor });
