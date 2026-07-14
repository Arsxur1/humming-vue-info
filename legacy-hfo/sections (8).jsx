:root {
  /* --------- Brand primary --------- */
  --navy-900: #0A1628;   /* primary dark, headlines */
  --navy-800: #1E3A5F;
  --navy-700: #1E40AF;
  --teal-700: #0B7A6F;
  --teal-600: #0D9488;   /* PRIMARY accent */
  --teal-500: #14B8A6;
  --amber-500: #F59E0B;  /* warning / urgency */
  --amber-600: #D97706;

  /* --------- Neutrals (slate) --------- */
  --slate-50:  #F8FAFC;
  --slate-100: #F1F5F9;
  --slate-200: #E2E8F0;
  --slate-300: #CBD5E1;
  --slate-400: #94A3B8;
  --slate-500: #64748B;
  --slate-700: #334155;
  --slate-900: #0F172A;

  --white: #FFFFFF;
  --black: #000000;

  /* --------- Status (chart / chip) --------- */
  --status-red-bg:   #FEF2F2;  --status-red:   #EF4444;  --status-red-dk:   #DC2626;
  --status-amber-bg: #FEF3C7;  --status-amber: #F59E0B;  --status-amber-dk: #92400E;
  --status-green-bg: #DCFCE7;  --status-green: #16A34A;  --status-green-dk: #166534;
  --status-blue-bg:  #DBEAFE;  --status-blue:  #3B82F6;  --status-blue-dk:  #1E40AF;
  --status-cyan:     #0891B2;
  --status-purple:   #7C3AED;

  /* Social */
  --social-pink:     #E1306C; /* Instagram */
  --social-blue:     #0A66C2; /* LinkedIn */
  --social-telegram: #26A5E4;
  --social-youtube:  #FF0000;

  /* --------- Semantic --------- */
  --bg:        var(--slate-50);
  --bg-alt:    var(--white);
  --bg-inverse: var(--navy-900);
  --fg1:       var(--navy-900);   /* primary text */
  --fg2:       var(--slate-700);  /* body */
  --fg3:       var(--slate-500);  /* secondary */
  --fg-inverse: var(--white);
  --accent:    var(--teal-600);
  --accent-hover: var(--teal-700);
  --warn:      var(--amber-500);
  --danger:    var(--status-red);
  --success:   var(--status-green);
  --border:    var(--slate-200);
  --border-strong: var(--slate-300);
  --rule:      var(--slate-100);

  /* --------- Type families --------- */
  --font-sans: 'Inter Tight', 'Calibri', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-display: 'Inter Tight', 'Calibri', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Consolas, monospace;

  /* --------- Type scale (web / UI) --------- */
  --fs-overline: 13px;
  --fs-xs:  12px;
  --fs-sm:  14px;
  --fs-base:16px;
  --fs-md:  18px;
  --fs-lg:  22px;
  --fs-xl:  28px;
  --fs-2xl: 36px;
  --fs-3xl: 48px;
  --fs-4xl: 64px;
  --fs-5xl: 88px;

  --lh-tight: 1.1;
  --lh-snug:  1.25;
  --lh-body:  1.5;

  --ls-tight:  -0.02em;
  --ls-snug:   -0.01em;
  --ls-normal: 0;
  --ls-wide:   0.06em;
  --ls-eyebrow:0.12em;

  /* --------- Spacing (4px base) --------- */
  --s-1:  4px;
  --s-2:  8px;
  --s-3: 12px;
  --s-4: 16px;
  --s-5: 24px;
  --s-6: 32px;
  --s-7: 48px;
  --s-8: 64px;
  --s-9: 96px;

  /* --------- Radii --------- */
  --r-1:   4px;
  --r-2:   8px;
  --r-3:  12px;
  --r-4:  16px;
  --r-pill: 9999px;

  /* --------- Shadows --------- */
  --shadow-1: 0 1px 2px rgba(10,22,40,0.06);
  --shadow-2: 0 4px 12px rgba(10,22,40,0.08);
  --shadow-3: 0 12px 32px rgba(10,22,40,0.12);

  /* --------- Motion --------- */
  --ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  --dur-1: 180ms;
  --dur-2: 220ms;
}

/* ==========================================================================
   Semantic element defaults
   ========================================================================== */

html, body {
  font-family: var(--font-sans);
  font-size: var(--fs-base);
  line-height: var(--lh-body);
  color: var(--fg1);
  background: var(--bg);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

h1, .h1 {
  font-family: var(--font-display);
  font-size: var(--fs-4xl);
  font-weight: 800;
  line-height: var(--lh-tight);
  letter-spacing: var(--ls-tight);
  color: var(--fg1);
  margin: 0;
}

h2, .h2 {
  font-family: var(--font-display);
  font-size: var(--fs-3xl);
  font-weight: 700;
  line-height: var(--lh-tight);
  letter-spacing: var(--ls-snug);
  color: var(--fg1);
  margin: 0;
}

h3, .h3 {
  font-family: var(--font-display);
  font-size: var(--fs-xl);
  font-weight: 700;
  line-height: var(--lh-snug);
  letter-spacing: var(--ls-snug);
  margin: 0;
}

h4, .h4 {
  font-family: var(--font-sans);
  font-size: var(--fs-lg);
  font-weight: 600;
  line-height: var(--lh-snug);
  margin: 0;
}

p, .p {
  font-family: var(--font-sans);
  font-size: var(--fs-base);
  font-weight: 400;
  line-height: var(--lh-body);
  color: var(--fg2);
  margin: 0;
}

.eyebrow {
  font-family: var(--font-sans);
  font-size: var(--fs-overline);
  font-weight: 600;
  letter-spacing: var(--ls-eyebrow);
  text-transform: uppercase;
  color: var(--fg3);
}

.display-xl {  /* title-slide scale */
  font-family: var(--font-display);
  font-size: var(--fs-5xl);
  font-weight: 800;
  line-height: 1;
  letter-spacing: var(--ls-tight);
  text-transform: uppercase;
}

.caps-title {
  text-transform: uppercase;
  letter-spacing: var(--ls-snug);
}

.num, .tabular {
  font-family: var(--font-mono);
  font-feature-settings: "tnum" 1, "cv11" 1;
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}

code, pre, kbd {
  font-family: var(--font-mono);
  font-size: 0.92em;
}

hr {
  border: 0;
  border-top: 1px solid var(--border);
  margin: var(--s-5) 0;
}

::selection { background: var(--teal-600); color: var(--white); }


/* ============================================================
   HFO Explainer — Humming Vue · App-specific styles
   ============================================================ */
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--slate-50);
  color: var(--navy-900);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}
img { display: block; max-width: 100%; }
.app { min-height: 100vh; }

/* ---------- Section labels ---------- */
.sec-label { display: flex; align-items: baseline; gap: 14px; margin-bottom: 18px; }
.sec-num { font-family: var(--font-mono); font-size: 13px; color: var(--teal-600); font-weight: 600; letter-spacing: 0.08em; }
.sec-eyebrow { font-size: 13px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--slate-500); }

/* ---------- Tags ---------- */
.tag { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
.tag-teal { background: #CCFBF1; color: var(--teal-700); }
.tag-navy { background: #DBEAFE; color: var(--navy-800); }
.tag-amber { background: #FEF3C7; color: var(--amber-600); }
.tag-red { background: var(--status-red-bg); color: var(--status-red-dk); }
.muted { color: var(--slate-500); font-weight: 500; }
.accent { color: var(--teal-600); }

/* ============================================================
   1. HERO
   ============================================================ */
.hero { position: relative; min-height: 100vh; background: var(--navy-900); color: #fff; overflow: hidden; display: flex; align-items: center; }
.hero-grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
  background-size: 60px 60px; pointer-events: none;
}
.hero-inner { position: relative; max-width: 1280px; margin: 0 auto; padding: 88px 80px; width: 100%; }
.brand-row { display: flex; align-items: center; gap: 14px; margin-bottom: 64px; font-size: 13px; letter-spacing: 0.1em; font-weight: 600; }
.brand-row .logo { height: 22px; filter: invert(1) brightness(2); opacity: 0.9; }
.brand-sep { color: var(--slate-500); }
.brand-product { color: var(--teal-500); font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.18em; }
.hero-eyebrow { color: var(--teal-500); margin-bottom: 28px; }
.hero-title { font-size: clamp(48px, 7vw, 104px); font-weight: 800; line-height: 0.98; letter-spacing: -0.025em; text-transform: uppercase; margin: 0; }
.hero-title-accent { color: var(--teal-500); }
.hero-sub { margin-top: 36px; font-size: 20px; line-height: 1.55; color: #CBD5E1; max-width: 780px; font-weight: 400; }
.hero-rule { width: 140px; height: 4px; background: var(--amber-500); margin: 48px 0 36px; }
.hero-meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 32px; max-width: 880px; }
.hero-meta-label { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--slate-500); font-weight: 600; margin-bottom: 8px; }
.hero-meta-value { font-size: 26px; font-weight: 600; color: #fff; font-family: var(--font-mono); }
.hero-meta-value .unit { font-size: 13px; color: var(--slate-400); margin-left: 4px; font-weight: 500; }
.hero-scroll { position: absolute; bottom: 48px; right: 80px; display: flex; align-items: center; gap: 10px; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--slate-500); font-weight: 600; }
.hero-scroll .arrow { font-size: 18px; color: var(--teal-500); animation: bounce 1.6s ease-in-out infinite; }
@keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(6px); } }

/* ============================================================
   GENERIC BLOCK
   ============================================================ */
.block { position: relative; padding: 96px 80px; max-width: 1440px; margin: 0 auto; }
.block-tinted { background: var(--slate-100); max-width: none; padding-left: max(80px, calc((100vw - 1280px)/2)); padding-right: max(80px, calc((100vw - 1280px)/2)); }
.block-dark { background: var(--navy-900); color: #fff; max-width: none; padding-left: max(80px, calc((100vw - 1280px)/2)); padding-right: max(80px, calc((100vw - 1280px)/2)); }
.block-dark .sec-eyebrow, .block-dark .sec-num { color: var(--teal-500); }
.block-dark .sec-eyebrow { color: var(--slate-400); }

.block-title { font-size: clamp(36px, 4.6vw, 64px); font-weight: 800; line-height: 1.05; letter-spacing: -0.02em; margin: 0 0 24px; max-width: 1100px; }
.block-title-dark { color: #fff; }
.block-sub { font-size: 18px; line-height: 1.55; color: var(--slate-700); max-width: 760px; margin: 0 0 56px; }
.block-sub-dark { color: var(--slate-300); }

/* ============================================================
   2. WAVEFORM COMPARE
   ============================================================ */
.wave-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
.wave-card { background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 28px; box-shadow: var(--shadow-1); }
.wave-card-hfo { border-color: var(--teal-600); border-width: 2px; }
.wave-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.wave-stat { text-align: right; }
.wave-stat .num { font-size: 32px; font-weight: 700; color: var(--navy-900); }
.wave-card-hfo .wave-stat .num { color: var(--teal-600); }
.wave-stat-unit { display: block; font-size: 11px; letter-spacing: 0.12em; color: var(--slate-500); font-weight: 600; text-transform: uppercase; }
.wave-canvas { width: 100%; height: 200px; background: var(--slate-50); border-radius: 8px; }
.wave-list { margin: 20px 0 0; padding: 0; list-style: none; }
.wave-list li { font-size: 14px; line-height: 1.5; color: var(--slate-700); padding: 10px 0; border-top: 1px solid var(--rule); }
.wave-list li:first-child { border-top: 0; }
.wave-list .num { font-family: var(--font-mono); font-weight: 600; color: var(--navy-900); }
.wave-list .risk { color: var(--status-red-dk); font-weight: 500; }
.wave-list .safe { color: var(--teal-700); font-weight: 600; }
.wave-controls { margin-top: 24px; display: flex; align-items: center; gap: 16px; }
.btn { padding: 10px 20px; border-radius: 8px; font-family: var(--font-sans); font-size: 13px; font-weight: 600; letter-spacing: 0.06em; cursor: pointer; border: 1px solid var(--border); background: #fff; color: var(--navy-900); transition: all 180ms var(--ease); }
.btn:hover { box-shadow: var(--shadow-2); }
.btn-ghost { background: var(--slate-100); }
.wave-controls-hint { font-size: 12px; color: var(--slate-500); letter-spacing: 0.06em; }

/* ============================================================
   3. METAPHOR
   ============================================================ */
.metaphor-grid { display: grid; grid-template-columns: 480px 1fr; gap: 64px; align-items: start; }
.metaphor-vis { position: sticky; top: 40px; background: #fff; border-radius: 16px; padding: 24px; box-shadow: var(--shadow-2); }
.hb-svg { width: 100%; height: auto; }
.hb-wing { transform-origin: 230px 220px; animation: wingflap 0.06s linear infinite; }
@keyframes wingflap { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(-0.7); } }
.hb-wing-blur { animation: blurpulse 0.12s linear infinite; }
@keyframes blurpulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
.hb-pulse { animation: hbfloat 1.4s ease-in-out infinite; }
@keyframes hbfloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
.lead { font-size: 22px; line-height: 1.5; color: var(--navy-900); margin: 0 0 36px; }
.metaphor-points { display: grid; gap: 24px; margin-bottom: 40px; }
.mp { display: grid; grid-template-columns: 56px 1fr; gap: 20px; align-items: start; padding: 20px; background: #fff; border-radius: 12px; box-shadow: var(--shadow-1); }
.mp-icon { font-size: 32px; line-height: 1; width: 56px; height: 56px; display: flex; align-items: center; justify-content: center; background: var(--slate-100); border-radius: 12px; }
.mp-title { font-size: 17px; font-weight: 700; color: var(--navy-900); margin-bottom: 6px; }
.mp-body { font-size: 14px; line-height: 1.55; color: var(--slate-700); }
.mp-body .num { font-family: var(--font-mono); font-weight: 600; color: var(--teal-700); }
.quote { display: grid; grid-template-columns: 56px 1fr; gap: 16px; background: var(--navy-900); color: #fff; padding: 28px 32px; border-radius: 12px; }
.quote-mark { font-family: 'Inter Tight'; font-weight: 800; font-size: 72px; line-height: 0.6; color: var(--teal-500); }
.quote-text { font-size: 18px; line-height: 1.5; }
.quote-attr { margin-top: 12px; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--slate-400); font-weight: 600; }

/* ============================================================
   4. INDICATIONS
   ============================================================ */
.ind-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.ind-card { background: #fff; border: 1px solid var(--border); border-top: 4px solid var(--teal-600); border-radius: 12px; padding: 24px; box-shadow: var(--shadow-1); transition: all 220ms var(--ease); }
.ind-card:hover { box-shadow: var(--shadow-2); transform: translateY(-2px); }
.ind-blue { border-top-color: #3B82F6; }
.ind-amber { border-top-color: #F59E0B; }
.ind-purple { border-top-color: #7C3AED; }
.ind-red { border-top-color: #EF4444; }
.ind-cyan { border-top-color: #0891B2; }
.ind-teal { border-top-color: #0D9488; }
.ind-head { display: grid; grid-template-columns: 48px 1fr auto; gap: 14px; align-items: start; margin-bottom: 14px; }
.ind-icon { font-size: 28px; line-height: 1; width: 48px; height: 48px; background: var(--slate-100); border-radius: 10px; display: flex; align-items: center; justify-content: center; }
.ind-code { font-family: var(--font-mono); font-size: 18px; font-weight: 700; color: var(--navy-900); }
.ind-ru { font-size: 12px; color: var(--slate-500); font-weight: 500; margin-top: 2px; }
.ind-tag { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 700; color: var(--slate-700); background: var(--slate-100); padding: 4px 8px; border-radius: 4px; white-space: nowrap; }
.ind-desc { font-size: 13px; line-height: 1.55; color: var(--slate-700); margin: 0; }

/* ============================================================
   6. STEPS
   ============================================================ */
.steps-tabs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 32px; }
.step-tab { display: grid; grid-template-columns: 56px 1fr; gap: 14px; align-items: center; text-align: left; background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 18px 20px; cursor: pointer; font-family: var(--font-sans); transition: all 180ms var(--ease); }
.step-tab:hover { border-color: var(--teal-600); box-shadow: var(--shadow-1); }
.step-tab.active { background: var(--navy-900); border-color: var(--navy-900); color: #fff; }
.step-tab.active .step-tab-num { color: var(--teal-500); background: rgba(20,184,166,0.15); }
.step-tab.active .step-tab-short { color: var(--slate-300); }
.step-tab-num { font-family: var(--font-mono); font-size: 18px; font-weight: 700; color: var(--teal-700); background: var(--slate-100); width: 56px; height: 56px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
.step-tab-title { font-size: 15px; font-weight: 700; margin-bottom: 2px; }
.step-tab-short { font-size: 12px; color: var(--slate-500); letter-spacing: 0.04em; }
.step-detail { background: #fff; border-radius: 16px; padding: 40px; display: grid; grid-template-columns: 80px 1fr 240px; gap: 32px; align-items: start; box-shadow: var(--shadow-2); }
.step-detail-num { font-family: var(--font-mono); font-size: 64px; font-weight: 800; color: var(--teal-600); line-height: 1; }
.step-detail-title { font-size: 28px; font-weight: 700; margin: 0 0 12px; }
.step-detail-text { font-size: 16px; line-height: 1.6; color: var(--slate-700); margin: 0 0 20px; }
.step-pitfall { background: var(--status-amber-bg); border-left: 3px solid var(--amber-500); padding: 12px 16px; border-radius: 6px; font-size: 14px; color: var(--status-amber-dk); display: flex; gap: 12px; }
.step-pitfall-label { font-weight: 700; white-space: nowrap; }
.step-detail-vis { background: var(--slate-50); border-radius: 12px; padding: 20px; display: flex; align-items: center; justify-content: center; }
.sv-svg { width: 100%; max-width: 200px; }

/* ============================================================
   7. ADJUSTMENT TABLE
   ============================================================ */
.filter-row { display: flex; gap: 8px; margin-bottom: 24px; flex-wrap: wrap; }
.filter-btn { padding: 8px 18px; border-radius: 9999px; border: 1px solid var(--border); background: #fff; font-family: var(--font-sans); font-size: 13px; font-weight: 600; color: var(--slate-700); cursor: pointer; transition: all 180ms var(--ease); }
.filter-btn:hover { border-color: var(--teal-600); }
.filter-btn.active { background: var(--navy-900); border-color: var(--navy-900); color: #fff; }
.adj-table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: var(--shadow-1); }
.adj-table thead th { background: var(--navy-900); color: #fff; text-align: left; padding: 14px 18px; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 700; }
.adj-row td { padding: 16px 18px; border-bottom: 1px solid var(--rule); font-size: 14px; vertical-align: top; }
.adj-row:nth-child(even) { background: var(--slate-50); }
.adj-row:last-child td { border-bottom: 0; }
.adj-problem { font-weight: 700; color: var(--navy-900); width: 26%; }
.adj-cause { color: var(--slate-700); width: 28%; }
.adj-fix { color: var(--navy-900); font-weight: 500; width: 32%; }
.adj-tag { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 700; padding: 4px 10px; border-radius: 4px; white-space: nowrap; }
.adj-tag-оксигенация { background: #DBEAFE; color: var(--status-blue-dk); }
.adj-tag-вентиляция { background: var(--status-amber-bg); color: var(--status-amber-dk); }
.adj-tag-тревога { background: var(--status-red-bg); color: var(--status-red-dk); }

/* ============================================================
   8. MISTAKES
   ============================================================ */
.mistakes-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
.mistake-card { background: #fff; border-radius: 14px; padding: 28px; display: grid; grid-template-columns: 60px 1fr; gap: 20px; box-shadow: var(--shadow-1); }
.mistake-num { font-family: var(--font-mono); font-size: 28px; font-weight: 700; color: var(--slate-300); line-height: 1; }
.mistake-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
.mistake-do, .mistake-dont { padding: 14px; border-radius: 8px; }
.mistake-do { background: var(--status-green-bg); }
.mistake-dont { background: var(--status-red-bg); }
.mistake-label { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 700; margin-bottom: 8px; }
.mistake-label-do { color: var(--status-green-dk); }
.mistake-label-dont { color: var(--status-red-dk); }
.mistake-text { font-size: 14px; line-height: 1.5; color: var(--navy-900); font-weight: 500; }
.mistake-why { grid-column: 1 / -1; font-size: 13px; line-height: 1.5; color: var(--slate-700); padding-top: 14px; border-top: 1px dashed var(--border); }
.mistake-why-label { display: inline-block; margin-right: 10px; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 700; color: var(--slate-500); }

/* ============================================================
   9. DEVICE
   ============================================================ */
.device-stage { display: grid; grid-template-columns: 1fr 380px; gap: 48px; align-items: start; }
.device-illustration { background: #fff; border-radius: 16px; padding: 24px; }
.device-svg { width: 100%; height: auto; }
.device-info { background: #1E3A5F; border-radius: 14px; padding: 32px; min-height: 400px; }
.device-info-label { color: var(--teal-500); margin-bottom: 16px; }
.device-info-title { font-size: 20px; font-weight: 700; color: #fff; margin-bottom: 12px; line-height: 1.3; }
.device-info-desc { font-size: 14px; line-height: 1.6; color: var(--slate-300); }
.spec-list { list-style: none; padding: 0; margin: 0; }
.spec-list li { display: flex; justify-content: space-between; gap: 16px; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 13px; }
.spec-list li:last-child { border-bottom: 0; }
.spec-k { color: var(--slate-400); letter-spacing: 0.04em; }
.spec-v { color: #fff; font-weight: 600; text-align: right; font-size: 12px; }

/* ============================================================
   10. CHEAT SHEET
   ============================================================ */
.block-final { background: var(--slate-50); padding-bottom: 0; max-width: none; padding-left: max(80px, calc((100vw - 1280px)/2)); padding-right: max(80px, calc((100vw - 1280px)/2)); }
.cheat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 80px; }
.cheat-card { background: #fff; border-radius: 12px; padding: 20px 24px; display: grid; grid-template-columns: 44px 1fr; gap: 16px; align-items: center; box-shadow: var(--shadow-1); }
.cheat-icon { font-size: 24px; line-height: 1; width: 44px; height: 44px; background: var(--slate-100); border-radius: 10px; display: flex; align-items: center; justify-content: center; }
.cheat-text { font-size: 15px; line-height: 1.5; color: var(--slate-700); }
.cheat-text b { color: var(--navy-900); }
.footer-bar { background: var(--navy-900); margin: 0 calc(-1 * max(80px, calc((100vw - 1280px)/2))); padding: 32px max(80px, calc((100vw - 1280px)/2)); display: flex; justify-content: space-between; align-items: center; color: #fff; }
.footer-brand img { height: 22px; filter: invert(1) brightness(2); }
.footer-meta { font-size: 12px; letter-spacing: 0.1em; font-weight: 600; color: var(--slate-400); text-transform: uppercase; display: flex; gap: 14px; align-items: center; }
.footer-meta .dot { color: var(--slate-700); }

/* ============================================================
   NEW: SIMULATOR DASHBOARD
   ============================================================ */
.sim {
  background: var(--navy-900);
  color: #fff;
  max-width: none;
  padding-left: max(48px, calc((100vw - 1480px)/2));
  padding-right: max(48px, calc((100vw - 1480px)/2));
}
.sim .sec-num, .sim .sec-eyebrow { color: var(--teal-500); }
.sim .sec-eyebrow { color: var(--slate-400); }

.sim-controls-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 28px;
  background: #0F1E36;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px;
  padding: 18px 22px;
}
.sim-control-group { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.sim-control-label {
  font-size: 11px; font-weight: 700;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--slate-400);
  white-space: nowrap;
}
.seg-btn-row { display: flex; gap: 4px; background: rgba(0,0,0,0.3); border-radius: 8px; padding: 4px; }
.seg-btn {
  background: transparent; border: 0; color: var(--slate-300);
  font-family: var(--font-sans); font-size: 12px; font-weight: 600;
  padding: 8px 12px; border-radius: 6px; cursor: pointer;
  letter-spacing: 0.02em;
  transition: all 160ms var(--ease);
}
.seg-btn:hover { color: #fff; }
.seg-btn.active { background: var(--teal-600); color: #fff; }
.seg-btn.danger.active { background: var(--status-red); }
.seg-btn.warn.active { background: var(--amber-500); color: var(--navy-900); }

/* Dashboard grid */
.sim-dash {
  display: grid;
  grid-template-columns: 320px 1fr 320px;
  gap: 20px;
  margin-bottom: 24px;
}

/* Column titles */
.sim-col-title {
  font-size: 10px; font-weight: 700;
  letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--slate-400);
  margin-bottom: 14px;
  display: flex; align-items: center; gap: 8px;
}
.sim-col-title .dot { width: 8px; height: 8px; border-radius: 50%; }
.sim-col-title .dot-auto { background: var(--amber-500); }
.sim-col-title .dot-set { background: var(--teal-500); }

/* Readout (left col) cards */
.readout {
  background: #1E3A5F;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 16px 18px;
  margin-bottom: 12px;
  position: relative;
  overflow: hidden;
}
.readout::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  background: var(--amber-500);
}
.readout.alert::before { background: var(--status-red); animation: alertpulse 1.2s ease-in-out infinite; }
@keyframes alertpulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
.readout-head {
  display: flex; align-items: baseline; justify-content: space-between;
  margin-bottom: 6px;
}
.readout-label {
  font-size: 11px; font-weight: 700;
  letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--slate-400);
}
.readout-trend {
  font-size: 11px; font-family: var(--font-mono); font-weight: 600;
  color: var(--slate-400);
}
.readout-trend.up { color: var(--status-red); }
.readout-trend.up-good { color: var(--teal-500); }
.readout-trend.down { color: var(--status-red); }
.readout-trend.down-good { color: var(--teal-500); }
.readout-name { font-size: 13px; color: #fff; font-weight: 500; margin-bottom: 10px; line-height: 1.3; }
.readout-value-row { display: flex; align-items: baseline; gap: 8px; }
.readout-value { font-family: var(--font-mono); font-size: 38px; font-weight: 700; line-height: 1; color: #fff; }
.readout-value.critical { color: var(--status-red); }
.readout-value.warn { color: var(--amber-500); }
.readout-value.good { color: var(--teal-500); }
.readout-unit { font-size: 11px; color: var(--slate-400); font-weight: 500; }
.readout-bar { height: 4px; background: rgba(0,0,0,0.3); border-radius: 2px; margin-top: 10px; overflow: hidden; }
.readout-bar-fill { height: 100%; transition: width 280ms var(--ease); background: var(--amber-500); }
.readout-formula {
  margin-top: 8px;
  font-size: 10px; font-family: var(--font-mono);
  color: var(--slate-400); letter-spacing: 0.04em;
}

/* Center stage */
.sim-center {
  background: #0F1E36;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px;
  padding: 18px;
  display: flex; flex-direction: column;
  min-height: 540px;
}
.sim-mech { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 340px; position: relative; }
.sim-mech svg { width: 100%; height: 100%; max-height: 360px; }
.sim-status-bar {
  margin-top: 14px;
  padding: 14px 18px;
  background: rgba(0,0,0,0.3);
  border-radius: 10px;
  display: flex; justify-content: space-between; gap: 20px;
  align-items: center;
}
.sim-vitals { display: flex; gap: 24px; }
.sim-vital { display: flex; align-items: baseline; gap: 8px; }
.sim-vital-label { font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--slate-400); }
.sim-vital-value { font-family: var(--font-mono); font-size: 22px; font-weight: 700; line-height: 1; }
.sim-vital-unit { font-size: 10px; color: var(--slate-400); }
.sim-vital-value.spo2-ok { color: var(--teal-500); }
.sim-vital-value.spo2-warn { color: var(--amber-500); }
.sim-vital-value.spo2-bad { color: var(--status-red); }
.sim-vital-value.pco2-ok { color: var(--teal-500); }
.sim-vital-value.pco2-warn { color: var(--amber-500); }
.sim-vital-value.pco2-bad { color: var(--status-red); }

/* Right col knobs */
.knob {
  background: #1E3A5F;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 16px 18px;
  margin-bottom: 12px;
  position: relative;
}
.knob::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  background: var(--teal-500);
}
.knob-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
.knob-abbr { font-family: var(--font-mono); font-size: 18px; font-weight: 700; color: #fff; }
.knob-role { font-size: 9px; letter-spacing: 0.14em; font-weight: 700; text-transform: uppercase; color: var(--slate-400); }
.knob-name { font-size: 12px; color: var(--slate-300); margin-bottom: 12px; }
.knob-value-row { display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px; }
.knob-value { font-family: var(--font-mono); font-size: 34px; font-weight: 700; line-height: 1; color: var(--teal-500); }
.knob-unit { font-size: 11px; color: var(--slate-400); }
.knob-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 6px; border-radius: 3px; outline: none; cursor: pointer; }
.knob-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #fff; border: 3px solid var(--teal-600); cursor: grab; box-shadow: var(--shadow-2); }
.knob-slider::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: #fff; border: 3px solid var(--teal-600); cursor: grab; box-shadow: var(--shadow-2); }
.knob-range { display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 10px; color: var(--slate-400); margin-top: 4px; }
.knob-target {
  margin-top: 8px;
  padding: 6px 10px;
  background: rgba(20,184,166,0.1);
  border-radius: 6px;
  font-size: 10px; color: var(--teal-500);
  font-family: var(--font-mono);
  letter-spacing: 0.04em;
}
.knob-target.warn { background: rgba(245,158,11,0.1); color: var(--amber-500); }

/* P-V Loop */
.sim-loop {
  background: #0F1E36;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px;
  padding: 22px 28px;
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 28px;
  align-items: center;
}
.sim-loop-canvas { width: 100%; height: 220px; }
.sim-loop-info .eyebrow { color: var(--slate-400); margin-bottom: 8px; display: block; }
.sim-loop-title { font-size: 22px; font-weight: 700; margin-bottom: 10px; color: #fff; }
.sim-loop-desc { font-size: 13px; line-height: 1.55; color: var(--slate-300); }
.sim-loop-state {
  display: inline-block; margin-bottom: 12px;
  padding: 6px 12px; border-radius: 6px;
  font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
}
.sim-loop-state.good { background: rgba(20,184,166,0.15); color: var(--teal-500); }
.sim-loop-state.warn { background: rgba(245,158,11,0.15); color: var(--amber-500); }
.sim-loop-state.bad { background: rgba(239,68,68,0.15); color: var(--status-red); }

/* Diagnostic patterns block */
.diag-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 32px; }
.diag-card {
  background: #1E3A5F;
  border-radius: 12px;
  padding: 22px 24px;
  border-left: 4px solid var(--status-red);
}
.diag-card.compl { border-left-color: var(--amber-500); }
.diag-card-title { font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 12px; }
.diag-pattern { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 12px; }
.diag-chip { font-family: var(--font-mono); font-size: 12px; font-weight: 600; padding: 6px 10px; border-radius: 6px; background: rgba(0,0,0,0.3); color: #fff; }
.diag-chip .arrow-up { color: var(--status-red); font-weight: 700; }
.diag-chip .arrow-down { color: var(--amber-500); font-weight: 700; }
.diag-chip .arrow-crit { color: var(--status-red); font-weight: 700; animation: alertpulse 1s ease-in-out infinite; }
.diag-action {
  background: rgba(0,0,0,0.3);
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 13px;
  color: #fff; line-height: 1.5;
}
.diag-action b { color: var(--teal-500); }
.diag-card.compl .diag-action b { color: var(--amber-500); }

/* Delta-P explainer */
.dp-explain {
  background: var(--slate-50);
  border-radius: 16px;
  padding: 36px 40px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 36px;
  align-items: center;
  margin-top: 40px;
}
.dp-side { padding: 20px; border-radius: 12px; }
.dp-side.other { background: #fff; border: 1px solid var(--border); }
.dp-side.vue { background: var(--navy-900); color: #fff; }
.dp-side-head { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.dp-side-tag {
  font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
  padding: 4px 10px; border-radius: 6px;
}
.dp-side.other .dp-side-tag { background: var(--status-amber-bg); color: var(--status-amber-dk); }
.dp-side.vue .dp-side-tag { background: rgba(20,184,166,0.2); color: var(--teal-500); }
.dp-side-title { font-size: 18px; font-weight: 700; }
.dp-side.vue .dp-side-title { color: #fff; }
.dp-side-formula {
  font-family: var(--font-mono); font-size: 22px; font-weight: 700;
  margin: 14px 0;
}
.dp-side.other .dp-side-formula { color: var(--status-amber-dk); }
.dp-side.vue .dp-side-formula { color: var(--teal-500); }
.dp-side-body { font-size: 13px; line-height: 1.6; }
.dp-side.other .dp-side-body { color: var(--slate-700); }
.dp-side.vue .dp-side-body { color: var(--slate-300); }
.dp-side-flow-svg { width: 100%; height: 100px; margin: 14px 0; }

/* ============================================================
   HUMMING VUE DEVICE FRAME (new oscilloscope-style sim)
   ============================================================ */
.hv-frame {
  background: #E5E7EB;
  border-radius: 18px;
  padding: 14px 14px 10px;
  box-shadow:
    inset 0 0 0 1px rgba(0,0,0,0.08),
    0 24px 60px rgba(0,0,0,0.45);
  margin-bottom: 32px;
  border: 6px solid #F5F5F4;
}
.hv-frame-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0 6px 12px;
}
.hv-brand {
  font-family: 'Inter Tight', sans-serif;
  font-weight: 600;
  font-size: 18px;
  color: #1E3A5F;
  letter-spacing: -0.01em;
}
.hv-mode { display: flex; align-items: center; gap: 12px; }
.hv-mode-pill {
  background: #1E3A5F; color: #fff;
  padding: 4px 14px; border-radius: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px; font-weight: 700; letter-spacing: 0.06em;
}
.hv-mode-time {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px; color: #64748B; font-weight: 600;
}

.hv-frame-body {
  display: grid;
  grid-template-columns: 130px 1fr 220px;
  gap: 8px;
}

/* LEFT column — blue device tiles */
.hv-col-left { display: flex; flex-direction: column; gap: 8px; }
.hv-tile {
  background: #B8C9E0;
  border-radius: 10px;
  padding: 10px 12px;
  position: relative;
  min-height: 78px;
  border: 1px solid rgba(0,0,0,0.06);
}
.hv-tile.s-warn { background: #FCD9A8; }
.hv-tile.s-critical { background: #F5B6B6; }
.hv-tile.s-good { background: #B8C9E0; }
.hv-tile.alert { animation: hv-blink 1.4s ease-in-out infinite; }
@keyframes hv-blink {
  0%, 100% { background: #F5B6B6; }
  50% { background: #FEE2E2; }
}
.hv-tile-label {
  font-size: 11px; font-weight: 600;
  color: #334155;
  letter-spacing: 0.02em;
  margin-bottom: 2px;
}
.hv-tile-value {
  font-family: 'Inter Tight', sans-serif;
  font-weight: 700;
  font-size: 26px;
  color: #1E3A5F;
  line-height: 1.05;
  letter-spacing: -0.02em;
}
.hv-tile-unit {
  font-size: 10px; color: #475569;
  font-weight: 600;
  margin-top: -2px;
}
.hv-tile-sub {
  font-size: 9px; color: #475569;
  margin-top: 4px;
  line-height: 1.3;
  letter-spacing: 0.01em;
}

/* CENTER — oscilloscope */
.hv-col-center { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.hv-display-wrap {
  position: relative;
  background: #000;
  border-radius: 8px;
  height: 360px;
  overflow: hidden;
  border: 1px solid rgba(0,0,0,0.2);
}
.hv-display { width: 100%; height: 100%; }

.hv-vitals {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  background: #F1F5F9;
  border-radius: 8px;
  padding: 10px 12px;
  border: 1px solid rgba(0,0,0,0.06);
}
.hv-vital { display: flex; flex-direction: column; gap: 2px; }
.hv-vital-label {
  font-size: 9px; font-weight: 700;
  letter-spacing: 0.12em; text-transform: uppercase;
  color: #64748B;
}
.hv-vital-value {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  font-size: 24px;
  line-height: 1;
}
.hv-vital-unit { font-size: 9px; color: #64748B; }
.hv-vital-value.spo2-ok { color: #16A34A; }
.hv-vital-value.spo2-warn { color: #F59E0B; }
.hv-vital-value.spo2-bad { color: #DC2626; }
.hv-vital-value.pco2-ok { color: #16A34A; }
.hv-vital-value.pco2-warn { color: #F59E0B; }
.hv-vital-value.pco2-bad { color: #DC2626; }

/* RIGHT column — settable knob tiles */
.hv-col-right { display: flex; flex-direction: column; gap: 8px; }
.hv-knob {
  background: #1F2937;
  border-radius: 10px;
  padding: 10px 12px;
  position: relative;
  border: 1px solid rgba(168,240,60,0.25);
  display: flex; flex-direction: column;
}
.hv-knob-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.hv-knob-pair .hv-knob { padding: 8px 10px; }
.hv-knob-pair .hv-knob-value { font-size: 22px; }
.hv-knob-label {
  font-size: 11px; font-weight: 600;
  color: #94A3B8;
  letter-spacing: 0.02em;
  margin-bottom: 4px;
}
.hv-knob-value {
  font-family: 'Inter Tight', sans-serif;
  font-weight: 700;
  font-size: 28px;
  line-height: 1.05;
  color: #A8F03C;
  letter-spacing: -0.02em;
}
.hv-knob-unit {
  font-size: 10px; color: #94A3B8;
  font-weight: 600;
  margin-bottom: 8px;
}
.hv-slider {
  -webkit-appearance: none; appearance: none;
  width: 100%; height: 5px; border-radius: 3px;
  outline: none; cursor: pointer;
  margin: 4px 0 2px;
}
.hv-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px; height: 14px; border-radius: 50%;
  background: #fff; border: 2px solid #A8F03C;
  cursor: grab;
  box-shadow: 0 2px 6px rgba(0,0,0,0.4);
}
.hv-slider::-moz-range-thumb {
  width: 14px; height: 14px; border-radius: 50%;
  background: #fff; border: 2px solid #A8F03C;
  cursor: grab;
}
.hv-range {
  display: flex; justify-content: space-between;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px; color: #64748B;
  margin-top: 2px;
}
.hv-knob-sub {
  font-size: 10px; color: #94A3B8;
  margin-top: 6px;
  line-height: 1.3;
}
.hv-knob-target {
  margin-top: 6px;
  padding: 4px 8px;
  border-radius: 5px;
  font-size: 9px;
  font-family: 'JetBrains Mono', monospace;
  line-height: 1.35;
  letter-spacing: 0.01em;
  background: rgba(168,240,60,0.1);
  color: #A8F03C;
}
.hv-knob-target.warn { background: rgba(245,158,11,0.15); color: #F59E0B; }
.hv-knob-target.good { background: rgba(168,240,60,0.1); color: #A8F03C; }

/* Footer bar (Power · Flush O2 etc) */
.hv-frame-footer {
  margin-top: 10px;
  padding: 8px 14px;
  background: linear-gradient(180deg, #F9A8D4 0%, #F5D0FE 100%);
  border-radius: 8px;
  display: flex;
  gap: 32px;
  font-family: 'Inter Tight', sans-serif;
  font-size: 11px; font-weight: 600;
  color: #831843;
  letter-spacing: 0.04em;
  border: 1px solid rgba(0,0,0,0.06);
}
.hv-foot-item { position: relative; padding-left: 14px; }
.hv-foot-item::before {
  content: ''; position: absolute; left: 0; top: 50%;
  width: 7px; height: 7px; border-radius: 50%;
  background: #fff;
  transform: translateY(-50%);
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.15);
}

/* ============================================================
   PROTOCOL · Step-by-step
   ============================================================ */
.protocol { max-width: 1440px; }
.proto-tabs {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
  margin-bottom: 28px;
}
.proto-tab {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px 14px;
  cursor: pointer;
  font-family: var(--font-sans);
  text-align: left;
  display: flex; flex-direction: column; gap: 6px;
  transition: all 180ms var(--ease);
  position: relative;
  min-height: 110px;
}
.proto-tab:hover { transform: translateY(-2px); box-shadow: var(--shadow-2); }
.proto-tab-num {
  font-family: var(--font-mono);
  font-size: 11px; font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--slate-500);
}
.proto-tab-icon {
  font-size: 22px; line-height: 1;
  font-family: var(--font-sans);
  font-weight: 700;
}
.proto-tab-title {
  font-size: 13px; font-weight: 700;
  line-height: 1.25;
  color: var(--navy-900);
}
.proto-tab.active {
  background: var(--navy-900);
  border-color: var(--navy-900);
  color: #fff;
  transform: translateY(-2px);
  box-shadow: var(--shadow-2);
}
.proto-tab.active .proto-tab-num,
.proto-tab.active .proto-tab-title { color: #fff; }
.proto-tab.active .proto-tab-num { color: var(--teal-500); }
/* tone accent bar */
.proto-tab::before {
  content: ''; position: absolute; left: 14px; right: 14px; top: 0; height: 3px;
  border-radius: 0 0 3px 3px;
  background: var(--slate-300);
  transition: background 180ms var(--ease);
}
.proto-tab.proto-tone-navy::before { background: var(--navy-800); }
.proto-tab.proto-tone-teal::before { background: var(--teal-600); }
.proto-tab.proto-tone-amber::before { background: var(--amber-500); }
.proto-tab.proto-tone-purple::before { background: #7C3AED; }
.proto-tab.proto-tone-blue::before { background: #3B82F6; }
.proto-tab.proto-tone-red::before { background: var(--status-red); }
.proto-tab.proto-tone-green::before { background: #16A34A; }

/* Detail card */
.proto-detail {
  background: #fff;
  border-radius: 16px;
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 32px;
  padding: 36px 40px;
  box-shadow: var(--shadow-2);
  position: relative;
  overflow: hidden;
}
.proto-detail::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 6px;
  background: var(--slate-300);
}
.proto-detail.proto-tone-navy::before { background: var(--navy-800); }
.proto-detail.proto-tone-teal::before { background: var(--teal-600); }
.proto-detail.proto-tone-amber::before { background: var(--amber-500); }
.proto-detail.proto-tone-purple::before { background: #7C3AED; }
.proto-detail.proto-tone-blue::before { background: #3B82F6; }
.proto-detail.proto-tone-red::before { background: var(--status-red); }
.proto-detail.proto-tone-green::before { background: #16A34A; }

.proto-detail-side {
  padding-right: 24px;
  border-right: 1px dashed var(--border);
}
.proto-detail-num {
  font-family: var(--font-mono);
  font-size: 56px; font-weight: 800;
  color: var(--slate-300);
  line-height: 1;
}
.proto-detail-icon {
  font-size: 36px;
  margin: 14px 0 18px;
  font-weight: 700;
}
.proto-detail-title {
  font-size: 24px; font-weight: 700;
  margin-bottom: 12px;
  color: var(--navy-900);
  line-height: 1.2;
}
.proto-detail-summary {
  font-size: 15px;
  line-height: 1.55;
  color: var(--slate-700);
}
.proto-points {
  list-style: none; padding: 0; margin: 0 0 24px;
}
.proto-points li {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 24px;
  padding: 14px 0;
  border-top: 1px solid var(--rule);
  font-size: 14px;
  line-height: 1.55;
}
.proto-points li:first-child { border-top: 0; padding-top: 0; }
.proto-k {
  font-weight: 700;
  color: var(--navy-900);
  font-size: 13px;
  letter-spacing: 0.02em;
}
.proto-v { color: var(--slate-700); }
.proto-pitfall {
  background: var(--status-amber-bg);
  border-left: 3px solid var(--amber-500);
  padding: 14px 18px;
  border-radius: 8px;
  display: grid;
  grid-template-columns: 130px 1fr;
  gap: 14px;
  font-size: 14px;
  color: var(--status-amber-dk);
  line-height: 1.5;
}
.proto-pitfall-label {
  font-weight: 700;
  white-space: nowrap;
  letter-spacing: 0.02em;
}

/* ============================================================
   HEMODYNAMICS
   ============================================================ */
.hemo-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18px;
}
.hemo-card {
  background: #fff;
  border-radius: 14px;
  padding: 26px 28px;
  box-shadow: var(--shadow-1);
  border-top: 4px solid var(--slate-300);
  position: relative;
}
.hemo-tone-amber { border-top-color: var(--amber-500); }
.hemo-tone-red { border-top-color: var(--status-red); }
.hemo-tone-purple { border-top-color: #7C3AED; }
.hemo-tone-blue { border-top-color: #3B82F6; }
.hemo-tone-teal { border-top-color: var(--teal-600); }
.hemo-head {
  font-size: 18px;
  font-weight: 700;
  color: var(--navy-900);
  line-height: 1.3;
  margin-bottom: 12px;
}
.hemo-body {
  font-size: 14px;
  line-height: 1.6;
  color: var(--slate-700);
  margin-bottom: 18px;
}
.hemo-sign, .hemo-rec {
  display: grid;
  grid-template-columns: 100px 1fr;
  gap: 12px;
  padding: 10px 0;
  border-top: 1px solid var(--rule);
  font-size: 13px;
  line-height: 1.5;
}
.hemo-sign-label, .hemo-rec-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--slate-500);
  padding-top: 2px;
}
.hemo-sign span:last-child { color: var(--navy-900); font-weight: 500; font-family: var(--font-mono); font-size: 12px; }
.hemo-rec span:last-child { color: var(--slate-700); }
.hemo-tone-amber .hemo-rec-label { color: var(--amber-600); }
.hemo-tone-red .hemo-rec-label { color: var(--status-red-dk); }
.hemo-tone-purple .hemo-rec-label { color: #7C3AED; }
.hemo-tone-blue .hemo-rec-label { color: var(--status-blue-dk); }
.hemo-tone-teal .hemo-rec-label { color: var(--teal-700); }

/* ============================================================
   KSHCHS · Blood gas reminder
   ============================================================ */
.kshchs-block { background: var(--navy-900); color: #fff; max-width: none; padding-left: max(80px, calc((100vw - 1280px)/2)); padding-right: max(80px, calc((100vw - 1280px)/2)); }
.kshchs-block .sec-num, .kshchs-block .sec-eyebrow { color: var(--teal-500); }
.kshchs-block .sec-eyebrow { color: var(--slate-400); }
.kshchs-block .block-title { color: #fff; }
.kshchs-block .block-sub { color: var(--slate-300); }
.kshchs-grid {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 56px;
  align-items: start;
}
.kshchs-stack {
  display: flex; flex-direction: column; gap: 12px;
}
.kshchs-rule {
  background: #1E3A5F;
  border-left: 3px solid var(--teal-500);
  border-radius: 10px;
  padding: 16px 20px;
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 18px;
  align-items: start;
}
.kshchs-rule-when {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--teal-500);
}
.kshchs-rule-what {
  font-size: 14px;
  line-height: 1.55;
  color: #fff;
}

/* ============================================================
   P-V loop disabled state (peds > 10 kg)
   ============================================================ */
.sim-loop-disabled {
  background: #0F1E36;
  border: 1px dashed rgba(255,255,255,0.15);
  border-radius: 14px;
  padding: 32px 36px;
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 28px;
  align-items: center;
  opacity: 0.85;
}
.sim-loop-disabled-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.55;
}

/* ============================================================
   PISTON vs JET — comparison table + takeaway banner
   ============================================================ */
.vs-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 24px;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-1);
  border: 1px solid var(--border);
}
.vs-table th {
  text-align: left;
  padding: 15px 20px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.vs-th-jet { color: var(--status-amber-dk); background: var(--status-amber-bg); }
.vs-th-vue { color: var(--teal-700); background: #CCFBF1; }
.vs-table td {
  padding: 13px 20px;
  font-size: 14px;
  border-top: 1px solid var(--rule);
  vertical-align: top;
}
.vs-k { font-weight: 700; color: var(--navy-900); width: 26%; }
.vs-jet { color: var(--slate-700); width: 37%; }
.vs-vue { color: var(--navy-900); font-weight: 600; width: 37%; background: rgba(20,184,166,0.06); }

.vs-takeaway {
  margin-top: 28px;
  background: var(--navy-900);
  color: #fff;
  border-radius: 16px;
  padding: 32px 36px;
  display: grid;
  grid-template-columns: 56px 1fr;
  gap: 24px;
  align-items: start;
}
.vs-takeaway-mark {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 52px;
  line-height: 0.8;
  color: var(--teal-500);
}
.vs-takeaway-title {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.3;
  margin-bottom: 12px;
  color: #fff;
}
.vs-takeaway-text {
  font-size: 15px;
  line-height: 1.6;
  color: var(--slate-300);
  max-width: 900px;
}
.vs-takeaway-text b { color: var(--teal-500); }

/* ============================================================
   FLOW SENSOR section
   ============================================================ */
.fs-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}
.fs-card {
  background: #fff;
  border-radius: 14px;
  padding: 28px 30px;
  box-shadow: var(--shadow-1);
  border: 1px solid var(--border);
}
.fs-card.fs-with { border-top: 4px solid var(--teal-600); }
.fs-card.fs-without { border-top: 4px solid var(--amber-500); }
.fs-card-head { margin-bottom: 14px; }
.fs-card-tag {
  display: inline-block;
  font-size: 11px; font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase;
  padding: 5px 12px; border-radius: 6px;
}
.fs-tag-ok { background: #CCFBF1; color: var(--teal-700); }
.fs-tag-warn { background: var(--status-amber-bg); color: var(--status-amber-dk); }
.fs-card-title {
  font-size: 20px; font-weight: 700;
  color: var(--navy-900);
  margin-bottom: 16px;
  line-height: 1.3;
}
.fs-list { list-style: none; padding: 0; margin: 0; }
.fs-list li {
  font-size: 14px; line-height: 1.55;
  color: var(--slate-700);
  padding: 11px 0 11px 26px;
  border-top: 1px solid var(--rule);
  position: relative;
}
.fs-list li:first-child { border-top: 0; }
.fs-list li::before {
  content: '✓'; position: absolute; left: 0; top: 11px;
  color: var(--teal-600); font-weight: 700;
}
.fs-list b { color: var(--navy-900); }
.fs-without-lead {
  font-size: 14px; line-height: 1.55;
  color: var(--slate-700);
  margin-bottom: 18px;
}
.fs-fallbacks { display: flex; flex-direction: column; gap: 12px; }
.fs-fallback {
  display: grid;
  grid-template-columns: 40px 1fr;
  gap: 14px;
  align-items: start;
  background: var(--slate-50);
  border-radius: 10px;
  padding: 14px 16px;
}
.fs-fallback-icon {
  font-size: 22px; line-height: 1;
  width: 40px; height: 40px;
  display: flex; align-items: center; justify-content: center;
  background: #fff; border-radius: 10px;
  border: 1px solid var(--border);
}
.fs-fallback-title { font-size: 14px; font-weight: 700; color: var(--navy-900); margin-bottom: 3px; }
.fs-fallback-body { font-size: 13px; line-height: 1.5; color: var(--slate-700); }

/* No-flow-sensor fallback chips inside the simulator's disabled loop */
.sim-fallbacks { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; }
.sim-fallback {
  font-size: 12px; line-height: 1.4;
  color: var(--slate-300);
  padding: 8px 12px;
  background: rgba(255,255,255,0.05);
  border-left: 2px solid var(--teal-500);
  border-radius: 0 6px 6px 0;
}
.sim-fallback b { color: var(--teal-500); }

/* ============================================================
   RESPONSIVE
   ============================================================ */
@media (max-width: 1180px) {
  .sim-dash { grid-template-columns: 1fr; }
  .sim-loop { grid-template-columns: 1fr; }
  .sim-controls-row { grid-template-columns: 1fr; }
  .diag-grid { grid-template-columns: 1fr; }
  .dp-explain { grid-template-columns: 1fr; }
  .hv-frame-body { grid-template-columns: 1fr; }
  .hv-col-left { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .hv-col-right { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .hv-display-wrap { height: 320px; }
  .proto-tabs { grid-template-columns: repeat(4, 1fr); }
  .proto-detail { grid-template-columns: 1fr; padding: 28px; gap: 20px; }
  .proto-detail-side { border-right: 0; padding-right: 0; padding-bottom: 20px; border-bottom: 1px dashed var(--border); }
  .hemo-grid { grid-template-columns: 1fr; }
  .kshchs-grid { grid-template-columns: 1fr; gap: 32px; }
  .proto-points li { grid-template-columns: 1fr; gap: 4px; }
  .vs-takeaway { grid-template-columns: 1fr; gap: 14px; }
  .fs-grid { grid-template-columns: 1fr; }
}
@media (max-width: 720px) {
  .hv-col-left { grid-template-columns: repeat(2, 1fr); }
  .hv-col-right { grid-template-columns: 1fr; }
  .hv-frame-footer { gap: 14px; flex-wrap: wrap; }
  .hv-vitals { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 980px) {
  .hero-inner { padding: 64px 32px; }
  .block { padding: 64px 32px; }
  .block-tinted, .block-dark, .block-final, .sim { padding-left: 32px; padding-right: 32px; }
  .footer-bar { margin: 0 -32px; padding-left: 32px; padding-right: 32px; }
  .hero-meta { grid-template-columns: repeat(2, 1fr); }
  .wave-grid, .metaphor-grid, .ind-grid, .steps-tabs, .mistakes-grid, .cheat-grid, .device-stage { grid-template-columns: 1fr; }
  .vs-table { font-size: 13px; }
  .vs-table th, .vs-table td { padding: 11px 12px; }
  .step-detail { grid-template-columns: 60px 1fr; }
  .step-detail-vis { display: none; }
  .metaphor-vis { position: static; }
}
