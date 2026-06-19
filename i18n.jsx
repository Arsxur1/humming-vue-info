/* HFO Explainer — Clinical guidance, language-driven. */

function ProtocolSteps({ L }) {
  const t = L.protocol;
  const [active, setActive] = React.useState(0);
  const s = t.steps[active];
  return (
    <section className="block protocol" id="sec-protocol" data-screen-label="07 Protocol">
      <window.SectionLabel n="07" label={t.secLabel} />
      <window.RT as="h2" className="block-title" html={t.title} />
      <p className="block-sub">{t.sub}</p>

      <div className="proto-tabs">
        {t.steps.map((st, i) => (
          <button key={i} className={`proto-tab proto-tone-${st.tone}${i === active ? " active" : ""}`} onClick={() => setActive(i)}>
            <span className="proto-tab-num">{st.n}</span>
            <span className="proto-tab-icon">{st.icon}</span>
            <span className="proto-tab-title">{st.title}</span>
          </button>
        ))}
      </div>

      <div className={`proto-detail proto-tone-${s.tone}`}>
        <div className="proto-detail-side">
          <div className="proto-detail-num">{s.n}</div>
          <div className="proto-detail-icon">{s.icon}</div>
          <div className="proto-detail-title">{s.title}</div>
          <div className="proto-detail-summary">{s.summary}</div>
        </div>
        <div className="proto-detail-main">
          <ul className="proto-points">
            {s.points.map((p, i) => (
              <li key={i}><span className="proto-k">{p.k}</span><span className="proto-v">{p.v}</span></li>
            ))}
          </ul>
          <div className="proto-pitfall">
            <span className="proto-pitfall-label">{t.pitfallLabel}</span>
            <span>{s.pitfall}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Hemodynamics({ L }) {
  const t = L.hemo;
  return (
    <section className="block block-tinted hemo" id="sec-hemo" data-screen-label="08 Hemodynamics">
      <window.SectionLabel n="08" label={t.secLabel} />
      <window.RT as="h2" className="block-title" html={t.title} />
      <p className="block-sub">{t.sub}</p>

      <div className="hemo-grid">
        {t.items.map((it, i) => (
          <div key={i} className={`hemo-card hemo-tone-${it.tone}`}>
            <div className="hemo-head">{it.head}</div>
            <div className="hemo-body">{it.body}</div>
            <div className="hemo-sign"><span className="hemo-sign-label">{t.signLabel}</span><span>{it.sign}</span></div>
            <div className="hemo-rec"><span className="hemo-rec-label">{t.recLabel}</span><span>{it.rec}</span></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function BloodGasReminder({ L }) {
  const t = L.bloodGas;
  return (
    <section className="block kshchs-block" id="sec-bloodgas" data-screen-label="09 BloodGas">
      <window.SectionLabel n="09" label={t.secLabel} />
      <div className="kshchs-grid">
        <div className="kshchs-main">
          <window.RT as="h2" className="block-title" style={{ margin: "0 0 24px" }} html={t.title} />
          <p className="block-sub" style={{ maxWidth: "none" }}>{t.sub}</p>
        </div>
        <div className="kshchs-stack">
          {t.rules.map((r, i) => (
            <div key={i} className="kshchs-rule">
              <div className="kshchs-rule-when">{r.when}</div>
              <div className="kshchs-rule-what">{r.what}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { ProtocolSteps, Hemodynamics, BloodGasReminder });
