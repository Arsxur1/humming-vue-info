/* HFO Explainer — Other ventilation modes + advanced ABG (КЩС) advisor.
   VentModes  : tabbed reference for A/C · VG · SIMV · CPAP · NIV (general rules).
   ABGAdvisor : weight + ABG → starting settings, acid-base interpretation,
                and mode-specific adjustment recommendations. */

const { useState: useStateAdv, useMemo: useMemoAdv } = React;

/* ---------- language-neutral clinical constants ---------- */
const ADV_PROFILES = {
  preterm: { w: 1.0,  phLo: 7.25, phHi: 7.35, co2Lo: 45, co2Hi: 55, o2Lo: 45, o2Hi: 65, spo2Lo: 90, spo2Hi: 94, vtPerKg: 5,   rate: [50, 60], peep: 5, ti: 0.30, hfoHz: 15, hfoMap: 9,  cpap: 6, pipOver: 14, nivOver: 10 },
  term:    { w: 3.3,  phLo: 7.30, phHi: 7.40, co2Lo: 40, co2Hi: 50, o2Lo: 50, o2Hi: 80, spo2Lo: 92, spo2Hi: 96, vtPerKg: 5,   rate: [40, 50], peep: 5, ti: 0.35, hfoHz: 10, hfoMap: 13, cpap: 6, pipOver: 15, nivOver: 10 },
  infant:  { w: 6.0,  phLo: 7.35, phHi: 7.45, co2Lo: 35, co2Hi: 48, o2Lo: 60, o2Hi: 90, spo2Lo: 94, spo2Hi: 98, vtPerKg: 6,   rate: [25, 35], peep: 5, ti: 0.50, hfoHz: 9,  hfoMap: 15, cpap: 6, pipOver: 16, nivOver: 12 },
  ped:     { w: 20.0, phLo: 7.35, phHi: 7.45, co2Lo: 35, co2Hi: 45, o2Lo: 70, o2Hi: 100, spo2Lo: 94, spo2Hi: 98, vtPerKg: 6,  rate: [16, 24], peep: 5, ti: 0.80, hfoHz: 6,  hfoMap: 18, cpap: 7, pipOver: 16, nivOver: 12 },
};
const ADV_MODES = ["hfo", "ac", "vg", "simv", "cpap", "niv"];

function advRound(v, step) { return Math.round(v / step) * step; }
function advMid(arr) { return Math.round((arr[0] + arr[1]) / 2); }
function advNum(v, d = 1) { return Number.isFinite(v) ? (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)) : "—"; }

/* derive bicarbonate from pH + pCO2 (Henderson–Hasselbalch) */
function deriveHCO3(ph, pco2) { return 0.03 * pco2 * Math.pow(10, ph - 6.1); }

/* ---------- starting-settings generator ---------- */
function computeStart(mode, prof, weight, fio2, A) {
  const P = ADV_PROFILES[prof];
  const w = weight > 0 ? weight : P.w;
  const r = A.startRows;
  const u = A.units;
  const vt = advRound(w * P.vtPerKg, 0.5);
  const rate = advMid(P.rate);
  const pip = P.peep + P.pipOver;
  const rows = [];
  const F = `${Math.round(fio2)} ${u.pct}`;

  if (mode === "hfo") {
    rows.push({ k: r.map, v: `${P.hfoMap} ${u.cmh2o}` });
    rows.push({ k: r.hz, v: `${P.hfoHz} ${u.hz}` });
    rows.push({ k: r.sv, v: `${A.svNote(advNum(w * 1.7, 1))}` });
    rows.push({ k: r.fio2, v: F });
  } else if (mode === "ac") {
    rows.push({ k: r.rate, v: `${P.rate[0]}–${P.rate[1]} ${u.bpm}` });
    rows.push({ k: r.pip, v: `~${pip} ${u.cmh2o} · ${A.toVt(advNum(vt, 1))}` });
    rows.push({ k: r.peep, v: `${P.peep} ${u.cmh2o}` });
    rows.push({ k: r.ti, v: `${P.ti.toFixed(2)} ${u.s}` });
    rows.push({ k: r.fio2, v: F });
  } else if (mode === "vg") {
    rows.push({ k: r.vt, v: `${advNum(vt, 1)} ${u.ml} · ${P.vtPerKg} ${u.mlkg}` });
    rows.push({ k: r.pmax, v: `~${pip + 5} ${u.cmh2o}` });
    rows.push({ k: r.peep, v: `${P.peep} ${u.cmh2o}` });
    rows.push({ k: r.rate, v: `${P.rate[0]}–${P.rate[1]} ${u.bpm}` });
    rows.push({ k: r.fio2, v: F });
  } else if (mode === "simv") {
    rows.push({ k: r.rate, v: `${Math.round(rate * 0.6)} ${u.bpm}` });
    rows.push({ k: r.pip, v: `~${pip} ${u.cmh2o} · ${A.toVt(advNum(vt, 1))}` });
    rows.push({ k: r.ps, v: `8–10 ${u.cmh2o}` });
    rows.push({ k: r.peep, v: `${P.peep} ${u.cmh2o}` });
    rows.push({ k: r.fio2, v: F });
  } else if (mode === "cpap") {
    rows.push({ k: r.cpap, v: `${P.cpap} ${u.cmh2o}` });
    rows.push({ k: r.fio2, v: F });
    rows.push({ k: r.iface, v: A.ifaceVal });
  } else if (mode === "niv") {
    rows.push({ k: r.ipap, v: `${P.peep + P.nivOver} ${u.cmh2o}` });
    rows.push({ k: r.epap, v: `${P.cpap} ${u.cmh2o}` });
    rows.push({ k: r.rate, v: `${Math.round(rate * 0.7)} ${u.bpm}` });
    rows.push({ k: r.fio2, v: F });
  }
  return rows;
}

/* ---------- acid-base interpretation ---------- */
function interpretABG(prof, ph, pco2, po2, hco3In, fio2, A) {
  const P = ADV_PROFILES[prof];
  const hco3 = Number.isFinite(hco3In) && hco3In > 0 ? hco3In : deriveHCO3(ph, pco2);
  const be = hco3 - 24.4;
  const ax = A.ax;

  // universal pH boundaries for acidemia/alkalemia naming
  const acidemia = ph < 7.35, alkalemia = ph > 7.45;
  const respAcid = pco2 > 45, respAlk = pco2 < 35;
  const metAcid = hco3 < 22, metAlk = hco3 > 26;

  let primary = ax.normalAB, comp = "", sev = "ok", mixed = false;

  if (acidemia) {
    if (respAcid && metAcid) { primary = ax.mixedAcidosis; mixed = true; sev = "crit"; }
    else if (respAcid) { primary = ax.respAcidosis; comp = metAlk ? ax.partial : ax.uncompensated; sev = "warn"; }
    else if (metAcid) { primary = ax.metAcidosis; comp = respAlk ? ax.partial : ax.uncompensated; sev = "warn"; }
    else { primary = ax.acidemiaOther; sev = "warn"; }
    if (ph < 7.20) sev = "crit";
  } else if (alkalemia) {
    if (respAlk && metAlk) { primary = ax.mixedAlkalosis; mixed = true; sev = "crit"; }
    else if (respAlk) { primary = ax.respAlkalosis; comp = metAcid ? ax.partial : ax.uncompensated; sev = "warn"; }
    else if (metAlk) { primary = ax.metAlkalosis; comp = respAcid ? ax.partial : ax.uncompensated; sev = "warn"; }
    else { primary = ax.alkalemiaOther; sev = "warn"; }
    if (ph > 7.55) sev = "crit";
  } else {
    // normal pH
    if (respAcid && metAlk) { primary = ax.compRespAcidosis; comp = ax.compensated; }
    else if (respAlk && metAcid) { primary = ax.compRespAlkalosis; comp = ax.compensated; }
    else if (metAcid && respAcid) { primary = ax.mixedAcidosis; mixed = true; sev = "warn"; }
    else primary = ax.normalAB;
  }

  // CO2 vs profile target
  let co2Status = "ok";
  if (pco2 > P.co2Hi) co2Status = "high";
  else if (pco2 < P.co2Lo) co2Status = "low";
  const co2Big = pco2 > P.co2Hi + 12 || pco2 < P.co2Lo - 10;

  // O2 vs profile target
  let o2Status = "ok";
  if (po2 < P.o2Lo) o2Status = "low";
  else if (po2 > P.o2Hi) o2Status = "high";
  const pf = fio2 > 0 ? Math.round(po2 / (fio2 / 100)) : null;

  return { hco3, be, primary, comp, sev, mixed, co2Status, co2Big, o2Status, pf, metAcid, metAlk, respAcid, respAlk, acidemia, alkalemia, ph, pco2, po2, P };
}

/* ---------- recommendation engine ---------- */
function genRecs(mode, it, fio2, A) {
  const act = A.actions[mode];
  const recs = [];

  // ventilation (CO2)
  if (it.co2Status === "high") recs.push({ t: "vent", x: act.co2Up });
  else if (it.co2Status === "low") recs.push({ t: "vent", x: act.co2Down });

  // oxygenation (O2)
  if (it.o2Status === "low") recs.push({ t: "oxy", x: act.o2Up });
  else if (it.o2Status === "high") {
    recs.push({ t: "oxy", x: fio2 > 30 ? act.o2DownF : act.o2Down });
  }

  // metabolic flags
  if (it.metAcid && !it.respAcid) recs.push({ t: "met", x: A.notes.metAcid });
  if (it.metAlk && !it.respAlk) recs.push({ t: "met", x: A.notes.metAlk });

  // safety / escalation
  if (mode === "cpap" && it.co2Status === "high" && it.acidemia) recs.push({ t: "crit", x: A.notes.cpapFail });
  if (it.sev === "crit") recs.push({ t: "crit", x: it.acidemia ? A.notes.severeAcid : A.notes.severeAlk });
  if (it.co2Status === "low" && it.P.spo2Hi <= 94) recs.push({ t: "vent", x: A.notes.hypocapnia });

  if (recs.length === 0) recs.push({ t: "ok", x: A.notes.onTarget });
  return recs;
}

/* =========================================================
   VENT MODES — tabbed reference (A/C · VG · SIMV · CPAP · NIV)
   ========================================================= */
function VentModes({ L }) {
  const t = L.ventModes;
  const [active, setActive] = useStateAdv(0);
  const m = t.modes[active];
  return (
    <section className="block modes-sec" id="sec-modes" data-screen-label="12 Modes">
      <window.SectionLabel n="12" label={t.secLabel} />
      <window.RT as="h2" className="block-title" html={t.title} />
      <window.RT as="p" className="block-sub" html={t.sub} />

      <div className="modes-tabs">
        {t.modes.map((md, i) => (
          <button key={md.key} className={`modes-tab modes-tone-${md.tone}${i === active ? " active" : ""}`} onClick={() => setActive(i)}>
            <span className="modes-tab-abbr">{md.abbr}</span>
            <span className="modes-tab-name">{md.name}</span>
            <span className="modes-tab-type">{md.type}</span>
          </button>
        ))}
      </div>

      <div className={`modes-detail modes-tone-${m.tone}`}>
        <div className="modes-detail-head">
          <div className="modes-detail-abbr">{m.abbr}</div>
          <div>
            <div className="modes-detail-name">{m.name}</div>
            <window.RT as="div" className="modes-detail-tagline" html={m.tagline} />
          </div>
          <div className="modes-detail-when">
            <span className="modes-mini-label">{t.cols.when}</span>
            <window.RT as="span" html={m.when} />
          </div>
        </div>

        <div className="modes-detail-grid">
          <div className="modes-params">
            <span className="modes-mini-label">{t.cols.params}</span>
            <ul className="modes-param-list">
              {m.params.map((p, i) => (
                <li key={i}><span className="modes-param-k">{p.k}</span><window.RT as="span" className="modes-param-v" html={p.v} /></li>
              ))}
            </ul>
          </div>
          <div className="modes-actions">
            <div className="modes-act modes-act-vent">
              <span className="modes-act-label">{t.cols.vent}</span>
              <window.RT as="div" html={m.vent} />
            </div>
            <div className="modes-act modes-act-oxy">
              <span className="modes-act-label">{t.cols.oxy}</span>
              <window.RT as="div" html={m.oxy} />
            </div>
            <div className="modes-act modes-act-wean">
              <span className="modes-act-label">{t.cols.wean}</span>
              <window.RT as="div" html={m.wean} />
            </div>
          </div>
        </div>

        <div className="modes-pitfall">
          <span className="modes-pitfall-label">{t.pitfallLabel}</span>
          <window.RT as="span" html={m.pitfall} />
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   ABG ADVISOR — weight + КЩС → settings + interpretation + recs
   ========================================================= */
function AdvField({ label, value, onChange, step = 1, min, max, unit }) {
  return (
    <label className="adv-field">
      <span className="adv-field-label">{label}</span>
      <span className="adv-field-input">
        <input type="number" value={value} step={step} min={min} max={max}
          onChange={e => onChange(e.target.value === "" ? "" : parseFloat(e.target.value))} />
        {unit && <span className="adv-field-unit">{unit}</span>}
      </span>
    </label>
  );
}

function ABGAdvisor({ L }) {
  const A = L.advisor;
  const [prof, setProf] = useStateAdv("term");
  const [mode, setMode] = useStateAdv("hfo");
  const [weight, setWeight] = useStateAdv(ADV_PROFILES.term.w);
  const [fio2, setFio2] = useStateAdv(60);
  const [ph, setPh] = useStateAdv(7.22);
  const [pco2, setPco2] = useStateAdv(62);
  const [po2, setPo2] = useStateAdv(48);
  const [hco3, setHco3] = useStateAdv("");

  const setProfile = (p) => { setProf(p); setWeight(ADV_PROFILES[p].w); };

  const applyPreset = (pr) => {
    setPh(pr.values.ph); setPco2(pr.values.pco2); setPo2(pr.values.po2);
    setHco3(pr.values.hco3 != null ? pr.values.hco3 : "");
  };

  const nPh = parseFloat(ph), nPco2 = parseFloat(pco2), nPo2 = parseFloat(po2);
  const nHco3 = hco3 === "" ? NaN : parseFloat(hco3);
  const valid = Number.isFinite(nPh) && Number.isFinite(nPco2) && Number.isFinite(nPo2);

  const it = useMemoAdv(() => valid ? interpretABG(prof, nPh, nPco2, nPo2, nHco3, fio2, A) : null,
    [prof, nPh, nPco2, nPo2, nHco3, fio2, valid, A]);
  const startRows = useMemoAdv(() => computeStart(mode, prof, parseFloat(weight) || 0, fio2, A),
    [mode, prof, weight, fio2, A]);
  const recs = useMemoAdv(() => it ? genRecs(mode, it, fio2, A) : [], [mode, it, fio2, A]);
  const P = ADV_PROFILES[prof];

  return (
    <section className="block adv-sec" id="sec-advisor" data-screen-label="05.2 ABG Advisor">
      <window.SectionLabel n="05.2" label={A.secLabel} />
      <window.RT as="h2" className="block-title block-title-dark" html={A.title} />
      <window.RT as="p" className="block-sub block-sub-dark" html={A.sub} />

      <div className="adv-grid">
        {/* ---- INPUT column ---- */}
        <div className="adv-input">
          <div className="adv-panel">
            <div className="adv-panel-title">{A.patientTitle}</div>

            <div className="adv-seg-block">
              <span className="adv-seg-label">{A.profileLabel}</span>
              <div className="adv-seg-row">
                {Object.keys(ADV_PROFILES).map(k => (
                  <button key={k} className={`adv-seg ${prof === k ? "active" : ""}`} onClick={() => setProfile(k)}>{A.profiles[k].label}</button>
                ))}
              </div>
              <div className="adv-seg-sub">{A.profiles[prof].sub}</div>
            </div>

            <div className="adv-field-row">
              <AdvField label={A.weightLabel} value={weight} onChange={setWeight} step={0.1} min={0.3} max={120} unit={A.units.kg} />
              <AdvField label={A.fio2Label} value={fio2} onChange={setFio2} step={1} min={21} max={100} unit={A.units.pct} />
            </div>

            <div className="adv-seg-block">
              <span className="adv-seg-label">{A.modeLabel}</span>
              <div className="adv-seg-row adv-seg-modes">
                {ADV_MODES.map(k => (
                  <button key={k} className={`adv-seg ${mode === k ? "active" : ""}`} onClick={() => setMode(k)}>{A.modeOpts[k]}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="adv-panel">
            <div className="adv-panel-title">{A.abgTitle}</div>
            <div className="adv-field-row adv-field-row-4">
              <AdvField label={A.abgFields.ph} value={ph} onChange={setPh} step={0.01} min={6.8} max={7.8} />
              <AdvField label={A.abgFields.pco2} value={pco2} onChange={setPco2} step={1} min={10} max={140} unit={A.units.mmhg} />
              <AdvField label={A.abgFields.po2} value={po2} onChange={setPo2} step={1} min={20} max={400} unit={A.units.mmhg} />
              <AdvField label={A.abgFields.hco3} value={hco3} onChange={setHco3} step={0.5} min={5} max={45} unit={A.units.mmol} />
            </div>
            <div className="adv-hco3-note">{A.hco3Note(advNum(it ? it.hco3 : NaN, 1), advNum(it ? it.be : NaN, 1))}</div>

            <span className="adv-seg-label" style={{ marginTop: 6 }}>{A.presetLabel}</span>
            <div className="adv-preset-row">
              {A.presets.map((pr, i) => (
                <button key={i} className="adv-preset" onClick={() => applyPreset(pr)}>{pr.label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* ---- OUTPUT column ---- */}
        <div className="adv-output">
          {/* interpretation */}
          <div className={`adv-interp adv-sev-${it ? it.sev : "ok"}`}>
            <span className="adv-interp-eyebrow">{A.interpTitle}</span>
            {it ? (
              <>
                <div className="adv-interp-primary">{it.primary}{it.comp ? <span className="adv-interp-comp"> · {it.comp}</span> : null}</div>
                <div className="adv-interp-chips">
                  <span className={`adv-chip chip-${it.acidemia ? "bad" : it.alkalemia ? "warn" : "ok"}`}>{A.ax.phLabel} {advNum(it.ph, 2)}</span>
                  <span className={`adv-chip chip-${it.co2Status === "ok" ? "ok" : "warn"}`}>{A.ax.co2Label} {advNum(it.pco2, 0)} · {A.ax[it.co2Status === "high" ? "co2High" : it.co2Status === "low" ? "co2Low" : "co2Ok"]}</span>
                  <span className={`adv-chip chip-${it.o2Status === "low" ? "bad" : it.o2Status === "high" ? "warn" : "ok"}`}>{A.ax.o2Label} {advNum(it.po2, 0)} · {A.ax[it.o2Status === "low" ? "o2Low" : it.o2Status === "high" ? "o2High" : "o2Ok"]}</span>
                  {it.pf ? <span className={`adv-chip chip-${it.pf < 200 ? "bad" : it.pf < 300 ? "warn" : "ok"}`}>P/F {it.pf}</span> : null}
                </div>
              </>
            ) : <div className="adv-interp-primary">{A.invalid}</div>}
          </div>

          {/* recommendations */}
          <div className="adv-recs">
            <span className="adv-block-eyebrow">{A.recTitle}</span>
            <div className="adv-recs-list">
              {recs.map((r, i) => (
                <div key={i} className={`adv-rec adv-rec-${r.t}`}>
                  <span className="adv-rec-tag">{A.recTags[r.t]}</span>
                  <window.RT as="span" className="adv-rec-text" html={r.x} />
                </div>
              ))}
            </div>
          </div>

          {/* starting settings + targets */}
          <div className="adv-foot">
            <div className="adv-start">
              <span className="adv-block-eyebrow">{A.startTitle(A.modeOpts[mode])}</span>
              <ul className="adv-start-list">
                {startRows.map((row, i) => (
                  <li key={i}><span className="adv-start-k">{row.k}</span><span className="adv-start-v">{row.v}</span></li>
                ))}
              </ul>
            </div>
            <div className="adv-targets">
              <span className="adv-block-eyebrow">{A.targetsTitle} · {A.profiles[prof].label}</span>
              <ul className="adv-target-list">
                <li><span>{A.tl.ph}</span><span className="num">{P.phLo}–{P.phHi}</span></li>
                <li><span>{A.tl.pco2}</span><span className="num">{P.co2Lo}–{P.co2Hi}</span></li>
                <li><span>{A.tl.po2}</span><span className="num">{P.o2Lo}–{P.o2Hi}</span></li>
                <li><span>{A.tl.spo2}</span><span className="num">{P.spo2Lo}–{P.spo2Hi}%</span></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      <div className="adv-disclaimer">{A.disclaimer}</div>
    </section>
  );
}

Object.assign(window, { VentModes, ABGAdvisor });
