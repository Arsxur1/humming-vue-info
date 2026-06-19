/* HFO Explainer — App composer with language switcher (EN/RU/UZ). */

const LANGS = ["en", "ru", "uz"];

class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (this.state.err) {
      return <div style={{ padding: 40, fontFamily: "Inter Tight, sans-serif", color: "#1E3A5F" }}>
        <h2>⚠ Something went wrong rendering this section.</h2>
        <pre style={{ whiteSpace: "pre-wrap", color: "#92400E" }}>{String(this.state.err)}</pre>
      </div>;
    }
    return this.props.children;
  }
}

function LangSwitcher({ lang, setLang, L }) {
  return (
    <div className="lang-switcher" role="group" aria-label={L.ui.langLabel}>
      {LANGS.map(code => {
        const name = window.STRINGS[code].langName;
        return (
          <button key={code}
            className={`lang-btn ${lang === code ? "active" : ""}`}
            onClick={() => setLang(code)}
            aria-pressed={lang === code}>
            <span className="lang-code">{code.toUpperCase()}</span>
            <span className="lang-name">{name}</span>
          </button>
        );
      })}
    </div>
  );
}

function TopNav({ L, onJump }) {
  return (
    <nav className="top-nav" aria-label="sections">
      <div className="top-nav-inner">
        <div className="top-nav-brand">HUMMING VUE · HFO</div>
        <div className="top-nav-links">
          {L.nav.map(item => (
            <button key={item.id} className="top-nav-link" onClick={() => onJump(item.id)}>{item.label}</button>
          ))}
        </div>
      </div>
    </nav>
  );
}

function getInitialLang() {
  try {
    const saved = localStorage.getItem("hfo_lang");
    if (saved && LANGS.includes(saved)) return saved;
  } catch (e) {}
  return "ru";
}

function App() {
  const [lang, setLangState] = React.useState(getInitialLang);
  const L = window.STRINGS[lang];

  const setLang = (code) => {
    setLangState(code);
    try { localStorage.setItem("hfo_lang", code); } catch (e) {}
  };

  React.useEffect(() => {
    document.documentElement.lang = L.htmlLang;
    document.title = lang === "ru" ? "HFO · Humming Vue · Руководство"
      : lang === "uz" ? "HFO · Humming Vue · Qoʻllanma"
      : "HFO · Humming Vue · Working Guide";
  }, [lang]);

  const jump = (id) => {
    const el = document.getElementById(id);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset - 64, behavior: "smooth" });
  };

  return (
    <ErrorBoundary>
      <TopNav L={L} onJump={jump} />
      <LangSwitcher lang={lang} setLang={setLang} L={L} />
      <window.Hero L={L} />
      <window.WaveformCompare L={L} />
      <window.Metaphor L={L} />
      <window.PistonVsJet L={L} />
      <window.Indications L={L} />
      <window.Simulator L={L} />
      <window.ConvSimulator L={L} />
      <window.FlowSensor L={L} />
      <window.ProtocolSteps L={L} />
      <window.Hemodynamics L={L} />
      <window.BloodGasReminder L={L} />
      <window.HowToStart L={L} />
      <window.AdjustmentMatrix L={L} />
      <window.VentModes L={L} />
      <window.Mistakes L={L} />
      <window.DeviceAnatomy L={L} />
      <window.CheatSheet L={L} />
    </ErrorBoundary>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
