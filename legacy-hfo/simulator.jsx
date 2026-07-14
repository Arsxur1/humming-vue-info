/* HFO Explainer — sections, language-driven. Reads strings from L = STRINGS[lang]. */

const { useState, useEffect, useRef, useMemo } = React;

/* Rich-text helper: renders an HTML string into a chosen element */
function RT({ html, as = "span", className, style, ...rest }) {
  return React.createElement(as, { className, style, dangerouslySetInnerHTML: { __html: html }, ...rest });
}

/* Shared */
function SectionLabel({ n, label }) {
  return (
    <div className="sec-label">
      <span className="sec-num">{n}</span>
      <span className="sec-eyebrow">{label}</span>
    </div>
  );
}
function Tag({ children, color = "teal" }) {
  return <span className={`tag tag-${color}`}>{children}</span>;
}
const LOGO = () => (typeof window !== "undefined" && window.__resources && window.__resources.logoWordmark) || "assets/logo-wordmark.svg";

/* ---------- 1. HERO ---------- */
function Hero({ L }) {
  const t = L.hero;
  return (
    <section className="hero" data-screen-label="01 Hero">
      <div className="hero-grid"></div>
      <div className="hero-inner">
        <div className="brand-row">
          <img src={LOGO()} alt="Swanston-Med" className="logo" />
          <span className="brand-sep">·</span>
          <span className="brand-product">HUMMING VUE · HFO</span>
        </div>

        <div className="eyebrow hero-eyebrow">{L.ui.forClinicians}</div>
        <RT as="h1" className="hero-title" html={t.title} />
        <p className="hero-sub">{t.sub}</p>

        <div className="hero-rule"></div>

        <div className="hero-meta">
          {t.meta.map((m, i) => (
            <div key={i} className="hero-meta-item">
              <div className="hero-meta-label">{m.label}</div>
              <div className="hero-meta-value num">{m.value}<span className="unit">{m.unit}</span>{m.value2 || ""}</div>
            </div>
          ))}
        </div>

        <div className="hero-scroll">
          <span>{L.ui.readOn}</span>
          <span className="arrow">↓</span>
        </div>
      </div>
    </section>
  );
}

/* ---------- 2. CONVENTIONAL vs HFO ---------- */
function WaveformCompare({ L }) {
  const t = L.wave;
  const [running, setRunning] = useState(true);
  const cvRef = useRef(null);
  const hfRef = useRef(null);
  const capRef = useRef(t.mapCaption);
  capRef.current = t.mapCaption;

  useEffect(() => {
    let raf;
    let t0 = performance.now();
    const cv = cvRef.current, hf = hfRef.current;
    if (!cv || !hf) return;
    const ctxCv = cv.getContext("2d"), ctxHf = hf.getContext("2d");
    function draw() {
      const tt = (performance.now() - t0) / 1000;
      [[cv, ctxCv], [hf, ctxHf]].forEach(([canvas, ctx], idx) => {
        const W = canvas.width, H = canvas.height;
        ctx.clearRect(0, 0, W, H);
        ctx.strokeStyle = "#E2E8F0";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(0, H/2); ctx.lineTo(W, H/2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = idx === 0 ? "#1E3A5F" : "#0D9488";
        ctx.beginPath();
        for (let x = 0; x <= W; x++) {
          const phase = (x / W) * Math.PI * 2;
          let y;
          if (idx === 0) {
            const v = Math.sin(phase * 0.6 - tt * 1.6);
            const breath = Math.sign(v) * Math.pow(Math.abs(v), 0.7);
            y = H/2 - breath * (H * 0.36);
          } else {
            const v = Math.sin(phase * 18 - tt * 14);
            y = H/2 - v * (H * 0.12);
          }
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        if (idx === 1) {
          ctx.strokeStyle = "#F59E0B";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([6, 4]);
          ctx.beginPath(); ctx.moveTo(0, H/2); ctx.lineTo(W, H/2); ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = "#92400E";
          ctx.font = "600 11px 'Inter Tight', sans-serif";
          ctx.fillText(capRef.current, 10, H/2 - 8);
        }
      });
      if (running) raf = requestAnimationFrame(draw);
    }
    if (running) raf = requestAnimationFrame(draw); else draw();
    return () => cancelAnimationFrame(raf);
  }, [running]);

  return (
    <section className="block" id="sec-concept" data-screen-label="02 Conventional vs HFO">
      <SectionLabel n="01" label={t.secLabel} />
      <RT as="h2" className="block-title" html={t.title} />

      <div className="wave-grid">
        <div className="wave-card">
          <div className="wave-head">
            <Tag color="navy">{t.cmvTag}</Tag>
            <div className="wave-stat"><span className="num">{t.cmvRate}</span><span className="wave-stat-unit">{t.cmvUnit}</span></div>
          </div>
          <canvas ref={cvRef} width="600" height="200" className="wave-canvas"></canvas>
          <ul className="wave-list">
            {t.cmvList.map((li, i) => <RT key={i} as="li" className={i === t.cmvList.length - 1 ? "risk" : ""} html={li} />)}
          </ul>
        </div>

        <div className="wave-card wave-card-hfo">
          <div className="wave-head">
            <Tag color="teal">{t.hfoTag}</Tag>
            <div className="wave-stat"><span className="num">{t.hfoRate}</span><span className="wave-stat-unit">{t.hfoUnit}</span></div>
          </div>
          <canvas ref={hfRef} width="600" height="200" className="wave-canvas"></canvas>
          <ul className="wave-list">
            {t.hfoList.map((li, i) => <RT key={i} as="li" className={i === t.hfoList.length - 1 ? "safe" : ""} html={li} />)}
          </ul>
        </div>
      </div>

      <div className="wave-controls">
        <button className="btn btn-ghost" onClick={() => setRunning(r => !r)}>{running ? L.ui.pause : L.ui.play}</button>
        <span className="wave-controls-hint">{L.ui.realtimeAnim}</span>
      </div>
    </section>
  );
}

/* ---------- 3. METAPHOR ---------- */
function Hummingbird({ label, sub }) {
  return (
    <svg viewBox="0 0 480 480" className="hb-svg">
      <circle cx="240" cy="240" r="200" fill="none" stroke="#0D9488" strokeWidth="1.5" strokeDasharray="2 6" opacity="0.35"/>
      <circle cx="240" cy="240" r="160" fill="none" stroke="#0D9488" strokeWidth="1" strokeDasharray="1 5" opacity="0.25"/>
      <g className="hb-wing-blur">
        <ellipse cx="190" cy="220" rx="110" ry="22" fill="#0D9488" opacity="0.10"/>
        <ellipse cx="190" cy="220" rx="100" ry="14" fill="#0D9488" opacity="0.18"/>
      </g>
      <g className="hb-wing">
        <path d="M 230 220 Q 130 180 90 230 Q 130 235 230 230 Z" fill="#0D9488" opacity="0.55"/>
      </g>
      <ellipse cx="270" cy="240" rx="55" ry="28" fill="#1E3A5F"/>
      <circle cx="320" cy="225" r="22" fill="#0A1628"/>
      <circle cx="328" cy="220" r="3" fill="#fff"/>
      <path d="M 340 225 L 395 225" stroke="#0A1628" strokeWidth="3.5" strokeLinecap="round"/>
      <path d="M 215 240 L 175 250 L 215 252 L 180 264 L 218 256 Z" fill="#0A1628"/>
      <ellipse cx="305" cy="245" rx="12" ry="7" fill="#F59E0B"/>
      <g className="hb-pulse">
        <circle cx="410" cy="215" r="3" fill="#0D9488"/>
        <circle cx="425" cy="225" r="2" fill="#0D9488" opacity="0.6"/>
        <circle cx="438" cy="220" r="1.5" fill="#0D9488" opacity="0.3"/>
      </g>
      <text x="60" y="380" fontFamily="Inter Tight" fontWeight="700" fontSize="14" fill="#0A1628" letterSpacing="2">{label}</text>
      <text x="60" y="400" fontFamily="JetBrains Mono" fontSize="12" fill="#64748B">{sub}</text>
    </svg>
  );
}

function Metaphor({ L }) {
  const t = L.metaphor;
  return (
    <section className="block block-tinted" id="sec-metaphor" data-screen-label="03 Metaphor">
      <SectionLabel n="02" label={t.secLabel} />
      <RT as="h2" className="block-title" html={t.title} />

      <div className="metaphor-grid">
        <div className="metaphor-vis">
          <Hummingbird label={t.hbLabel} sub={t.hbSub} />
        </div>
        <div className="metaphor-copy">
          <RT as="p" className="lead" html={t.lead} />

          <div className="metaphor-points">
            {t.points.map((p, i) => (
              <div key={i} className="mp">
                <div className="mp-icon">{p.icon}</div>
                <div>
                  <div className="mp-title">{p.title}</div>
                  <RT as="div" className="mp-body" html={p.body} />
                </div>
              </div>
            ))}
          </div>

          <div className="quote">
            <div className="quote-mark">“</div>
            <div>
              <RT as="div" className="quote-text" html={t.quote} />
              <div className="quote-attr">{t.quoteAttr}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- 4. INDICATIONS ---------- */
function Indications({ L }) {
  const t = L.indications;
  return (
    <section className="block" id="sec-indications" data-screen-label="04 Indications">
      <SectionLabel n="04" label={t.secLabel} />
      <RT as="h2" className="block-title" html={t.title} />
      <RT as="p" className="block-sub" html={t.sub} />

      <div className="ind-grid">
        {t.items.map(i => (
          <div key={i.code} className={`ind-card ind-${i.color}`}>
            <div className="ind-head">
              <div className="ind-icon">{i.icon}</div>
              <div>
                <div className="ind-code">{i.code}</div>
                <div className="ind-ru">{i.name}</div>
              </div>
              <div className="ind-tag">{i.tag}</div>
            </div>
            <p className="ind-desc">{i.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- 6. HOW TO START ---------- */
function StepVisual({ kind, label, unit }) {
  if (kind === "lungs-open") return (
    <svg viewBox="0 0 200 200" className="sv-svg">
      <ellipse cx="75" cy="100" rx="35" ry="55" fill="#0D9488" opacity="0.18"/>
      <ellipse cx="125" cy="100" rx="35" ry="55" fill="#0D9488" opacity="0.18"/>
      <path d="M 75 50 Q 85 100 75 150" stroke="#0D9488" strokeWidth="2" fill="none"/>
      <path d="M 125 50 Q 115 100 125 150" stroke="#0D9488" strokeWidth="2" fill="none"/>
      <line x1="100" y1="20" x2="100" y2="50" stroke="#0A1628" strokeWidth="3"/>
      <line x1="100" y1="50" x2="75" y2="60" stroke="#0A1628" strokeWidth="2"/>
      <line x1="100" y1="50" x2="125" y2="60" stroke="#0A1628" strokeWidth="2"/>
      <text x="100" y="190" textAnchor="middle" fontFamily="Inter Tight" fontWeight="700" fontSize="11" fill="#0A1628">{label}</text>
    </svg>
  );
  if (kind === "freq") return (
    <svg viewBox="0 0 200 200" className="sv-svg">
      <text x="100" y="60" textAnchor="middle" fontFamily="Inter Tight" fontWeight="800" fontSize="42" fill="#1E3A5F">10</text>
      <text x="100" y="90" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="14" fill="#64748B">{unit}</text>
      <g stroke="#0D9488" strokeWidth="2" fill="none">
        <path d="M 30 130 Q 40 115 50 130 T 70 130 T 90 130 T 110 130 T 130 130 T 150 130 T 170 130"/>
      </g>
      <text x="100" y="180" textAnchor="middle" fontFamily="Inter Tight" fontWeight="700" fontSize="11" fill="#0A1628">{label}</text>
    </svg>
  );
  if (kind === "shake") return (
    <svg viewBox="0 0 200 200" className="sv-svg">
      <rect x="50" y="40" width="100" height="120" rx="20" fill="#F59E0B" opacity="0.15" stroke="#F59E0B" strokeWidth="2"/>
      <line x1="50" y1="80" x2="150" y2="80" stroke="#F59E0B" strokeWidth="1" strokeDasharray="3 3"/>
      <line x1="50" y1="120" x2="150" y2="120" stroke="#F59E0B" strokeWidth="1" strokeDasharray="3 3"/>
      <circle cx="100" cy="100" r="4" fill="#F59E0B"/>
      <text x="100" y="180" textAnchor="middle" fontFamily="Inter Tight" fontWeight="700" fontSize="11" fill="#0A1628">{label}</text>
    </svg>
  );
  return (
    <svg viewBox="0 0 200 200" className="sv-svg">
      <rect x="40" y="30" width="120" height="140" rx="6" fill="#1E3A5F" opacity="0.12" stroke="#1E3A5F" strokeWidth="1.5"/>
      <g stroke="#1E3A5F" strokeWidth="1" opacity="0.5">
        {[55,70,85,100,115,130,145].map(y => (
          <React.Fragment key={y}>
            <line x1="55" y1={y} x2="95" y2={y}/>
            <line x1="105" y1={y} x2="145" y2={y}/>
          </React.Fragment>
        ))}
      </g>
      <text x="100" y="190" textAnchor="middle" fontFamily="Inter Tight" fontWeight="700" fontSize="11" fill="#0A1628">{label}</text>
    </svg>
  );
}

function HowToStart({ L }) {
  const t = L.howToStart;
  const [active, setActive] = useState(0);
  const step = t.steps[active];
  return (
    <section className="block block-tinted" id="sec-start" data-screen-label="06 Start">
      <SectionLabel n="10" label={t.secLabel} />
      <RT as="h2" className="block-title" html={t.title} />
      <p className="block-sub">{t.sub}</p>

      <div className="steps-tabs">
        {t.steps.map((s, i) => (
          <button key={i} className={`step-tab ${active === i ? "active" : ""}`} onClick={() => setActive(i)}>
            <div className="step-tab-num">{String(i + 1).padStart(2, "0")}</div>
            <div className="step-tab-body">
              <div className="step-tab-title">{s.title}</div>
              <div className="step-tab-short">{s.short}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="step-detail">
        <div className="step-detail-num">{String(active + 1).padStart(2, "0")}</div>
        <div className="step-detail-body">
          <h3 className="step-detail-title">{step.title}</h3>
          <p className="step-detail-text">{step.body}</p>
          <div className="step-pitfall">
            <span className="step-pitfall-label">{t.pitfallLabel}</span>
            <span>{step.pitfall}</span>
          </div>
        </div>
        <div className="step-detail-vis">
          <StepVisual kind={step.visual} label={step.svgLabel} unit={step.svgUnit} />
        </div>
      </div>
    </section>
  );
}

/* ---------- 7. ADJUSTMENT MATRIX ---------- */
function AdjustmentMatrix({ L }) {
  const t = L.adjust;
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? t.items : t.items.filter(a => a.which === filter);
  const filterKeys = ["all", "oxy", "vent", "alarm"];
  return (
    <section className="block" id="sec-adjust" data-screen-label="07 Adjust">
      <SectionLabel n="11" label={t.secLabel} />
      <RT as="h2" className="block-title" html={t.title} />
      <p className="block-sub">{t.sub}</p>
      <div className="filter-row">
        {filterKeys.map(k => (
          <button key={k} className={`filter-btn ${filter === k ? "active" : ""}`} onClick={() => setFilter(k)}>{t.filters[k]}</button>
        ))}
      </div>
      <table className="adj-table">
        <thead>
          <tr><th>{t.cols.problem}</th><th>{t.cols.cause}</th><th>{t.cols.fix}</th><th></th></tr>
        </thead>
        <tbody>
          {filtered.map((a, i) => (
            <tr key={i} className={`adj-row adj-${a.which}`}>
              <td className="adj-problem">{a.problem}</td>
              <td className="adj-cause">{a.cause}</td>
              <td className="adj-fix">{a.fix}</td>
              <td><span className={`adj-tag adj-tag-${a.which}`}>{t.tagLabels[a.which]}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* ---------- 8. MISTAKES ---------- */
function Mistakes({ L }) {
  const t = L.mistakes;
  return (
    <section className="block block-tinted" id="sec-mistakes" data-screen-label="13 Mistakes">
      <SectionLabel n="13" label={t.secLabel} />
      <RT as="h2" className="block-title" html={t.title} />
      <div className="mistakes-grid">
        {t.items.map((m, i) => (
          <div key={i} className="mistake-card">
            <div className="mistake-num num">{String(i + 1).padStart(2, "0")}</div>
            <div className="mistake-pair">
              <div className="mistake-do">
                <div className="mistake-label mistake-label-do">{t.doLabel}</div>
                <div className="mistake-text">{m.do}</div>
              </div>
              <div className="mistake-dont">
                <div className="mistake-label mistake-label-dont">{t.dontLabel}</div>
                <div className="mistake-text">{m.dont}</div>
              </div>
            </div>
            <div className="mistake-why">
              <span className="mistake-why-label">{t.whyLabel}</span>
              {m.why}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- 9. DEVICE ANATOMY ---------- */
function DeviceSvg({ parts, hover, setHover }) {
  return (
    <svg viewBox="0 0 600 500" className="device-svg" role="img">
      <rect x="120" y="60" width="360" height="380" rx="14" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="2"/>
      <rect x="120" y="60" width="360" height="40" rx="14" fill="#1E3A5F"/>
      <text x="140" y="86" fontFamily="Inter Tight" fontWeight="800" fontSize="14" fill="#fff" letterSpacing="2">HUMMING VUE</text>
      <circle cx="460" cy="80" r="5" fill="#F59E0B"/>
      <rect x="150" y="120" width="300" height="150" rx="6" fill="#0A1628" stroke="#0D9488" strokeWidth="1.5"/>
      <text x="165" y="140" fontFamily="JetBrains Mono" fontSize="9" fill="#0D9488">HFO · ACTIVE</text>
      <text x="165" y="170" fontFamily="JetBrains Mono" fontSize="22" fontWeight="600" fill="#14B8A6">12.0</text>
      <text x="165" y="184" fontFamily="JetBrains Mono" fontSize="8" fill="#64748B">MAP cmH₂O</text>
      <text x="245" y="170" fontFamily="JetBrains Mono" fontSize="22" fontWeight="600" fill="#F59E0B">6.0</text>
      <text x="245" y="184" fontFamily="JetBrains Mono" fontSize="8" fill="#64748B">SV mL</text>
      <text x="320" y="170" fontFamily="JetBrains Mono" fontSize="22" fontWeight="600" fill="#fff">10.0</text>
      <text x="320" y="184" fontFamily="JetBrains Mono" fontSize="8" fill="#64748B">f Hz</text>
      <text x="395" y="170" fontFamily="JetBrains Mono" fontSize="22" fontWeight="600" fill="#3B82F6">40</text>
      <text x="395" y="184" fontFamily="JetBrains Mono" fontSize="8" fill="#64748B">FiO₂ %</text>
      <text x="165" y="248" fontFamily="JetBrains Mono" fontSize="10" fill="#94A3B8">DCO₂ 360 · ΔA 22 · V_hfo 5.9 mL</text>
      <path d="M 165 230 Q 175 220 185 230 T 205 230 T 225 230 T 245 230 T 265 230 T 285 230 T 305 230 T 325 230 T 345 230 T 365 230 T 385 230 T 405 230 T 425 230" stroke="#14B8A6" strokeWidth="1.5" fill="none"/>
      <g>
        <circle cx="180" cy="320" r="22" fill="#0A1628" stroke="#0D9488" strokeWidth="2"/>
        <line x1="180" y1="320" x2="180" y2="306" stroke="#0D9488" strokeWidth="2"/>
        <text x="180" y="358" textAnchor="middle" fontFamily="Inter Tight" fontSize="9" fontWeight="700" fill="#0A1628">MAP</text>
        <circle cx="250" cy="320" r="22" fill="#0A1628" stroke="#F59E0B" strokeWidth="2"/>
        <line x1="250" y1="320" x2="262" y2="312" stroke="#F59E0B" strokeWidth="2"/>
        <text x="250" y="358" textAnchor="middle" fontFamily="Inter Tight" fontSize="9" fontWeight="700" fill="#0A1628">SV</text>
        <circle cx="320" cy="320" r="22" fill="#0A1628" stroke="#fff" strokeWidth="2"/>
        <line x1="320" y1="320" x2="320" y2="334" stroke="#fff" strokeWidth="2"/>
        <text x="320" y="358" textAnchor="middle" fontFamily="Inter Tight" fontSize="9" fontWeight="700" fill="#0A1628">f</text>
        <circle cx="390" cy="320" r="22" fill="#0A1628" stroke="#3B82F6" strokeWidth="2"/>
        <line x1="390" y1="320" x2="378" y2="312" stroke="#3B82F6" strokeWidth="2"/>
        <text x="390" y="358" textAnchor="middle" fontFamily="Inter Tight" fontSize="9" fontWeight="700" fill="#0A1628">FiO₂</text>
      </g>
      <path d="M 480 240 Q 540 240 540 320 Q 540 400 480 400" stroke="#0D9488" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <circle cx="480" cy="240" r="6" fill="#0D9488"/>
      <circle cx="480" cy="400" r="6" fill="#0D9488"/>
      {parts.map((p, i) => {
        const cx = (p.x / 100) * 600;
        const cy = (p.y / 100) * 500;
        const isActive = hover === p.id;
        return (
          <g key={p.id} onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)} style={{ cursor: "pointer" }}>
            <circle cx={cx} cy={cy} r="22" fill="#0D9488" opacity={isActive ? 0.25 : 0}/>
            <circle cx={cx} cy={cy} r="14" fill="#0D9488" opacity={isActive ? 0.5 : 0}/>
            <circle cx={cx} cy={cy} r="9" fill="#F59E0B" stroke="#fff" strokeWidth="2"/>
            <text x={cx} y={cy + 4} textAnchor="middle" fontFamily="Inter Tight" fontSize="11" fontWeight="800" fill="#fff">{i + 1}</text>
          </g>
        );
      })}
    </svg>
  );
}

function DeviceAnatomy({ L }) {
  const t = L.device;
  const [hover, setHover] = useState(null);
  const coords = { screen: [50, 18], piston: [25, 50], circuit: [75, 60], controls: [50, 75], alarm: [85, 18] };
  const parts = t.parts.map(p => ({ ...p, x: coords[p.id][0], y: coords[p.id][1] }));
  const active = hover ? parts.find(p => p.id === hover) : null;

  return (
    <section className="block block-dark" id="sec-device" data-screen-label="14 Device">
      <SectionLabel n="14" label={t.secLabel} />
      <RT as="h2" className="block-title block-title-dark" html={t.title} />
      <p className="block-sub block-sub-dark">{t.sub}</p>

      <div className="device-stage">
        <div className="device-illustration">
          <DeviceSvg parts={parts} hover={hover} setHover={setHover} />
        </div>

        <div className="device-info">
          {active ? (
            <div className="device-info-active">
              <div className="device-info-label eyebrow">{active.id.toUpperCase()}</div>
              <div className="device-info-title">{active.label}</div>
              <div className="device-info-desc">{active.desc}</div>
            </div>
          ) : (
            <div className="device-info-default">
              <div className="device-info-label eyebrow">{t.specTitle}</div>
              <ul className="spec-list">
                {t.spec.map((s, i) => (
                  <li key={i}><span className="spec-k">{s.k}</span><span className="spec-v num">{s.v}</span></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------- 10. CHEAT SHEET ---------- */
function CheatSheet({ L }) {
  const t = L.cheat;
  return (
    <section className="block block-final" id="sec-cheat" data-screen-label="15 Summary">
      <SectionLabel n="15" label={t.secLabel} />
      <RT as="h2" className="block-title" html={t.title} />

      <div className="cheat-grid">
        {t.cards.map((c, i) => (
          <div key={i} className="cheat-card">
            <div className="cheat-icon">{c.icon}</div>
            <RT as="div" className="cheat-text" html={c.text} />
          </div>
        ))}
      </div>

      <div className="footer-bar">
        <div className="footer-brand">
          <img src={LOGO()} alt="Swanston-Med"/>
        </div>
        <div className="footer-meta">
          {t.footerMeta.map((m, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="dot">·</span>}
              <span>{m}</span>
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}

Object.assign(window, {
  RT, SectionLabel, Tag,
  Hero, WaveformCompare, Metaphor, Indications,
  HowToStart, AdjustmentMatrix, Mistakes, DeviceAnatomy, CheatSheet,
});
