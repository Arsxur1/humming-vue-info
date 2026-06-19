/* HFO Explainer — i18n core (v3.1)
   - Language context (ru / en / uz), persisted to localStorage
   - useLang() hook returns the active language code
   - LangSwitcher: fixed top-right pill
   - ErrorBoundary: prevents a single canvas/render error from white-screening
   Components read their localized strings via DICT[useLang()].
*/

const { createContext, useContext, useState, useEffect } = React;

const LANGS = [
  { code: "ru", label: "РУ" },
  { code: "en", label: "EN" },
  { code: "uz", label: "UZ" },
];
const LANG_FALLBACK = "ru";
const LANG_KEY = "hfo_lang";

const LangContext = createContext(LANG_FALLBACK);
function useLang() {
  return useContext(LangContext) || LANG_FALLBACK;
}

/* Generic helper: pick the active language from a {ru,en,uz} dictionary,
   falling back to RU then EN if a translation is missing. */
function pick(dict, lang) {
  if (!dict) return undefined;
  return dict[lang] != null ? dict[lang]
       : dict[LANG_FALLBACK] != null ? dict[LANG_FALLBACK]
       : dict.en;
}

/* document language attribute, kept in sync */
function applyHtmlLang(lang) {
  try { document.documentElement.setAttribute("lang", lang); } catch (e) {}
}

function readStoredLang() {
  try {
    const v = localStorage.getItem(LANG_KEY);
    if (v && LANGS.some(l => l.code === v)) return v;
  } catch (e) {}
  return LANG_FALLBACK;
}

function LangSwitcher({ lang, setLang }) {
  return (
    <div className="lang-switch" role="group" aria-label="Language / Язык / Til">
      {LANGS.map(l => (
        <button
          key={l.code}
          className={`lang-switch-btn${lang === l.code ? " active" : ""}`}
          aria-pressed={lang === l.code}
          onClick={() => setLang(l.code)}>
          {l.label}
        </button>
      ))}
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("HFO render error:", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="err-fallback">
          <h2>Не удалось отобразить раздел</h2>
          <p>
            Произошла ошибка отрисовки. Попробуйте обновить страницу или переключить язык.<br/>
            <code>{String(this.state.error && this.state.error.message || this.state.error)}</code>
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

Object.assign(window, {
  LANGS, LANG_FALLBACK, LANG_KEY,
  LangContext, useLang, pick, applyHtmlLang, readStoredLang,
  LangSwitcher, ErrorBoundary,
});
