/* HFO Explainer — preserved sections (Hero, WaveformCompare, Metaphor,
   Indications, HowToStart, AdjustmentMatrix, Mistakes, DeviceAnatomy, CheatSheet) */

const { useState, useEffect, useRef, useMemo } = React;

/* ---------- Shared ---------- */
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

/* ---------- 1. HERO ---------- */
function Hero() {
  return (
    <section className="hero" data-screen-label="01 Hero">
      <div className="hero-grid"></div>
      <div className="hero-inner">
        <div className="brand-row">
          <img src={(typeof window !== 'undefined' && window.__resources && window.__resources.logoWordmark) || "assets/logo-wordmark.svg"} alt="Swanston-Med" className="logo" />
          <span className="brand-sep">·</span>
          <span className="brand-product">HUMMING VUE · HFO</span>
        </div>

        <div className="eyebrow hero-eyebrow">Руководство к работе · for clinicians</div>
        <h1 className="hero-title">
          Колибри машет крыльями<br />
          <span className="hero-title-accent">80 раз в секунду.</span><br />
          Так и дышит <span className="hero-title-accent">HFO.</span>
        </h1>

        <p className="hero-sub">
          Высокочастотная осцилляторная вентиляция — это не «обычная ИВЛ, только быстрее».
          Это совершенно другой способ заставить лёгкие работать. Маленькие очень частые
          колебания вместо больших вдохов. Здесь — основы за 15 минут плюс
          симулятор, на котором можно покрутить параметры и увидеть, что меняется.
        </p>

        <div className="hero-rule"></div>

        <div className="hero-meta">
          <div className="hero-meta-item">
            <div className="hero-meta-label">Частота</div>
            <div className="hero-meta-value num">5–15 <span className="unit">Гц</span></div>
          </div>
          <div className="hero-meta-item">
            <div className="hero-meta-label">Stroke Volume</div>
            <div className="hero-meta-value num">0.2 <span className="unit">мл шаг</span></div>
          </div>
          <div className="hero-meta-item">
            <div className="hero-meta-label">Поршень</div>
            <div className="hero-meta-value num">13 <span className="unit">мкм точность</span></div>
          </div>
          <div className="hero-meta-item">
            <div className="hero-meta-label">DCO₂</div>
            <div className="hero-meta-value num">V<span className="unit">hfo</span>² × f</div>
          </div>
        </div>

        <div className="hero-scroll">
          <span>читать дальше</span>
          <span className="arrow">↓</span>
        </div>
      </div>
    </section>
  );
}

/* ---------- 2. CONVENTIONAL vs HFO ---------- */
function WaveformCompare() {
  const [running, setRunning] = useState(true);
  const cvRef = useRef(null);
  const hfRef = useRef(null);

  useEffect(() => {
    let raf;
    let t0 = performance.now();
    function draw() {
      const cv = cvRef.current;
      const hf = hfRef.current;
      if (!cv || !hf) return;
      const t = (performance.now() - t0) / 1000;
      [cv, hf].forEach((canvas, idx) => {
        const ctx = canvas.getContext("2d");
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
            const v = Math.sin(phase * 0.6 - t * 1.6);
            const breath = Math.sign(v) * Math.pow(Math.abs(v), 0.7);
            y = H/2 - breath * (H * 0.36);
          } else {
            const v = Math.sin(phase * 18 - t * 14);
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
          ctx.fillText("MAP — постоянное среднее давление", 10, H/2 - 8);
        }
      });
      if (running) raf = requestAnimationFrame(draw);
    }
    if (running) raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  return (
    <section className="block" data-screen-label="02 Conventional vs HFO">
      <SectionLabel n="01" label="Концепция · Conventional vs HFO" />
      <h2 className="block-title">
        Обычная ИВЛ — это <span className="muted">«вдох-выдох»</span>.<br />
        HFO — это <span className="accent">«дрожание воздуха»</span>.
      </h2>

      <div className="wave-grid">
        <div className="wave-card">
          <div className="wave-head">
            <Tag color="navy">Conventional · CMV</Tag>
            <div className="wave-stat">
              <span className="num">25</span>
              <span className="wave-stat-unit">вдохов/мин</span>
            </div>
          </div>
          <canvas ref={cvRef} width="600" height="200" className="wave-canvas"></canvas>
          <ul className="wave-list">
            <li>Большие вдохи, как обычно — туда и обратно</li>
            <li>Альвеолы <b>растягиваются и спадают</b> на каждом цикле</li>
            <li>Объём вдоха <span className="num">6–8 мл/кг</span></li>
            <li className="risk">Риск баротравмы / волютравмы у хрупких лёгких</li>
          </ul>
        </div>

        <div className="wave-card wave-card-hfo">
          <div className="wave-head">
            <Tag color="teal">HFO · Humming Vue</Tag>
            <div className="wave-stat">
              <span className="num">600+</span>
              <span className="wave-stat-unit">в минуту</span>
            </div>
          </div>
          <canvas ref={hfRef} width="600" height="200" className="wave-canvas"></canvas>
          <ul className="wave-list">
            <li>Лёгкие <b>всегда открыты</b> на постоянном MAP</li>
            <li>Поршень толкает крошечный <b>Stroke Volume (SV)</b>, который формирует <b>V<sub>hfo</sub></b> — реально доставленный объём</li>
            <li>V<sub>hfo</sub> <span className="num">1.2–2 мл/кг</span> — меньше, чем мёртвое пространство</li>
            <li className="safe">Лёгкое не «ходит» — оно «звучит»</li>
          </ul>
        </div>
      </div>

      <div className="wave-controls">
        <button className="btn btn-ghost" onClick={() => setRunning(r => !r)}>
          {running ? "⏸ Пауза" : "▶ Воспроизвести"}
        </button>
        <span className="wave-controls-hint">Анимация в реальном времени</span>
      </div>
    </section>
  );
}

/* ---------- 3. METAPHOR ---------- */
function Hummingbird() {
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
      <text x="60" y="380" fontFamily="Inter Tight" fontWeight="700" fontSize="14" fill="#0A1628" letterSpacing="2">
        50–80 ВЗМАХОВ В СЕКУНДУ
      </text>
      <text x="60" y="400" fontFamily="JetBrains Mono" fontSize="12" fill="#64748B">
        ≈ частоте колебаний HFO
      </text>
    </svg>
  );
}

function Metaphor() {
  return (
    <section className="block block-tinted" data-screen-label="03 Metaphor">
      <SectionLabel n="02" label="Метафора · Объясняем как ребёнку" />
      <h2 className="block-title">
        Представь <span className="accent">колибри</span>.
      </h2>

      <div className="metaphor-grid">
        <div className="metaphor-vis">
          <Hummingbird />
        </div>
        <div className="metaphor-copy">
          <p className="lead">
            Когда колибри зависает в воздухе, она машет крыльями <b>50–80 раз в секунду</b>.
            Крылья почти не двигаются вверх-вниз — они просто <b>дрожат</b>.
            Но этого достаточно, чтобы держаться в воздухе.
          </p>

          <div className="metaphor-points">
            <div className="mp">
              <div className="mp-icon">🪽</div>
              <div>
                <div className="mp-title">Маленькие движения, очень частые</div>
                <div className="mp-body">Так и HFO: вместо больших вдохов — крошечные колебания, до <span className="num">15 раз в секунду</span>.</div>
              </div>
            </div>
            <div className="mp">
              <div className="mp-icon">🎈</div>
              <div>
                <div className="mp-title">Шарик, который всегда надут</div>
                <div className="mp-body">Альвеолы — это микро-шарики. На обычной ИВЛ мы их каждый раз надуваем и сдуваем. На HFO — <b>держим надутыми постоянно</b> и слегка трясём.</div>
              </div>
            </div>
            <div className="mp">
              <div className="mp-icon">🎵</div>
              <div>
                <div className="mp-title">Звук в трубе органа</div>
                <div className="mp-body">Воздух в трубке вибрирует, как звук. Газы (O₂, CO₂) <b>перемешиваются за счёт вибрации</b>, а не за счёт «приехал-уехал».</div>
              </div>
            </div>
            <div className="mp">
              <div className="mp-icon">👶</div>
              <div>
                <div className="mp-title">Почему это важно для малышей</div>
                <div className="mp-body">Лёгкие новорождённого — как тонкая плёнка. Каждое большое растяжение — это травма. HFO <b>не растягивает</b> — оно покачивает.</div>
              </div>
            </div>
          </div>

          <div className="quote">
            <div className="quote-mark">«</div>
            <div>
              <div className="quote-text">
                Лёгкое на HFO не <b>дышит</b> — оно <b>гудит</b>. Отсюда и название аппарата — <b>Humming</b>.
              </div>
              <div className="quote-attr">— простое правило для запоминания</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- 4. INDICATIONS ---------- */
const INDICATIONS = [
  { code: "RDS", ru: "Респираторный дистресс-синдром", desc: "Недоношенные. Незрелые лёгкие, мало сурфактанта. HFO даёт «отдых» альвеолам.", tag: "Недоношенные", color: "blue", icon: "👶" },
  { code: "MAS", ru: "Синдром аспирации мекония", desc: "Доношенные. Меконий блокирует мелкие бронхи неравномерно. Колебания HFO «прокачивают» газы мимо пробок.", tag: "Доношенные", color: "amber", icon: "🫁" },
  { code: "PPHN", ru: "Персистирующая лёгочная гипертензия", desc: "Сочетается с iNO. HFO раскрывает капиллярное русло за счёт стабильного MAP.", tag: "+ iNO", color: "purple", icon: "💧" },
  { code: "Air leak", ru: "Пневмоторакс / интерстициальная эмфизема", desc: "Утечка воздуха. Маленькие колебания не «надувают» дырку — она успевает закрыться.", tag: "Утечка", color: "red", icon: "💨" },
  { code: "CDH", ru: "Врождённая диафрагмальная грыжа", desc: "Гипоплазия лёгких. Низкие объёмы HFO защищают то немногое, что есть.", tag: "Хирургия", color: "cyan", icon: "⚕️" },
  { code: "Rescue", ru: "После неудачи CMV", desc: "Когда обычная ИВЛ требует FiO₂ > 60% и MAP > 12 — переходим на HFO до повреждения.", tag: "Резерв", color: "teal", icon: "🆘" },
];

function Indications() {
  return (
    <section className="block" data-screen-label="04 Indications">
      <SectionLabel n="04" label="Показания · Когда применять" />
      <h2 className="block-title">
        Шесть ситуаций, когда HFO — <span className="accent">правильный выбор.</span>
      </h2>
      <p className="block-sub">
        HFO — не «следующий шаг после обычной ИВЛ». Это <b>другой инструмент</b> для конкретных задач.
        Запомни эти шесть — этого хватит на 95% реальных случаев в ОРИТН.
      </p>

      <div className="ind-grid">
        {INDICATIONS.map(i => (
          <div key={i.code} className={`ind-card ind-${i.color}`}>
            <div className="ind-head">
              <div className="ind-icon">{i.icon}</div>
              <div>
                <div className="ind-code">{i.code}</div>
                <div className="ind-ru">{i.ru}</div>
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
const STEPS = [
  { n: 1, title: "Оптимизация MAP", short: "Раскрытие лёгких",
    body: "Установи MAP на 1–2 см H₂O выше, чем был на CMV. Постепенно повышай по 1 см H₂O каждые 2–3 минуты до улучшения SpO₂. Затем снижай по 1 см до момента, когда SpO₂ начинает падать — это «точка раскрытия». Установи MAP на 2 см выше неё.",
    pitfall: "Слишком высокий MAP → перерастяжение → нарушение перфузии → десатурация. Слишком низкий → ателектаз.",
    visual: "lungs-open" },
  { n: 2, title: "Установка частоты (f)", short: "По возрасту",
    body: "Новорождённые: 10–15 Гц. Дети до 1 года: 8–10 Гц. Старше: 6–8 Гц. Взрослые: 3–5 Гц. Чем меньше пациент — тем выше частота.",
    pitfall: "Частоту меняем редко. Это «грубая настройка», она держит систему в «тонусе».",
    visual: "freq" },
  { n: 3, title: "Подбор Stroke Volume (SV)", short: "Главный регулятор",
    body: "На Humming Vue ты крутишь именно SV (ударный объём поршня), а не амплитуду. Стартовое значение — 2 мл/кг (или 1.2–1.4 мл/кг при гипокапнии / спонтанном дыхании). Шаг — 0.2 мл. Цель — видимая вибрация грудной клетки до пупка. Через 20–30 мин — газы крови, корректируй на 0.5–1 мл.",
    pitfall: "Амплитуда (ΔP) — это следствие SV, а не то, что ты крутишь.",
    visual: "shake" },
  { n: 4, title: "FiO₂ и проверка", short: "Меньше — лучше",
    body: "Стартовый FiO₂ = 90–100%, затем снижай по 5%. Основной инструмент оксигенации — правильно подобранный MAP в комбинации с SV. Хорошо раскрытые лёгкие = меньше FiO₂. Цель: SpO₂ 90–95% при FiO₂ < 60%. Через 30 минут — рентген (8–9 рёбер) и газы крови.",
    pitfall: "FiO₂ > 60% дольше 6 часов — токсическое повреждение лёгких.",
    visual: "xray" },
];

function StepVisual({ kind }) {
  if (kind === "lungs-open") return (
    <svg viewBox="0 0 200 200" className="sv-svg">
      <ellipse cx="75" cy="100" rx="35" ry="55" fill="#0D9488" opacity="0.18"/>
      <ellipse cx="125" cy="100" rx="35" ry="55" fill="#0D9488" opacity="0.18"/>
      <path d="M 75 50 Q 85 100 75 150" stroke="#0D9488" strokeWidth="2" fill="none"/>
      <path d="M 125 50 Q 115 100 125 150" stroke="#0D9488" strokeWidth="2" fill="none"/>
      <line x1="100" y1="20" x2="100" y2="50" stroke="#0A1628" strokeWidth="3"/>
      <line x1="100" y1="50" x2="75" y2="60" stroke="#0A1628" strokeWidth="2"/>
      <line x1="100" y1="50" x2="125" y2="60" stroke="#0A1628" strokeWidth="2"/>
      <text x="100" y="190" textAnchor="middle" fontFamily="Inter Tight" fontWeight="700" fontSize="11" fill="#0A1628">ОТКРЫТЫ</text>
    </svg>
  );
  if (kind === "freq") return (
    <svg viewBox="0 0 200 200" className="sv-svg">
      <text x="100" y="60" textAnchor="middle" fontFamily="Inter Tight" fontWeight="800" fontSize="42" fill="#1E3A5F">10</text>
      <text x="100" y="90" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="14" fill="#64748B">Гц</text>
      <g stroke="#0D9488" strokeWidth="2" fill="none">
        <path d="M 30 130 Q 40 115 50 130 T 70 130 T 90 130 T 110 130 T 130 130 T 150 130 T 170 130"/>
      </g>
      <text x="100" y="180" textAnchor="middle" fontFamily="Inter Tight" fontWeight="700" fontSize="11" fill="#0A1628">НОВОРОЖДЁННЫЙ</text>
    </svg>
  );
  if (kind === "shake") return (
    <svg viewBox="0 0 200 200" className="sv-svg">
      <rect x="50" y="40" width="100" height="120" rx="20" fill="#F59E0B" opacity="0.15" stroke="#F59E0B" strokeWidth="2"/>
      <line x1="50" y1="80" x2="150" y2="80" stroke="#F59E0B" strokeWidth="1" strokeDasharray="3 3"/>
      <line x1="50" y1="120" x2="150" y2="120" stroke="#F59E0B" strokeWidth="1" strokeDasharray="3 3"/>
      <circle cx="100" cy="100" r="4" fill="#F59E0B"/>
      <text x="100" y="180" textAnchor="middle" fontFamily="Inter Tight" fontWeight="700" fontSize="11" fill="#0A1628">ДО ПУПКА</text>
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
      <text x="100" y="190" textAnchor="middle" fontFamily="Inter Tight" fontWeight="700" fontSize="11" fill="#0A1628">8–9 РЁБЕР</text>
    </svg>
  );
}

function HowToStart() {
  const [active, setActive] = useState(1);
  const step = STEPS.find(s => s.n === active);
  return (
    <section className="block block-tinted" data-screen-label="06 Start">
      <SectionLabel n="10" label="Старт · Первые 30 минут" />
      <h2 className="block-title">
        Как <span className="accent">начать</span> пациента на HFO.
      </h2>
      <p className="block-sub">
        Четыре шага по порядку. Не пропускай. Кликай по шагам — раскроется детально.
      </p>

      <div className="steps-tabs">
        {STEPS.map(s => (
          <button key={s.n}
            className={`step-tab ${active === s.n ? "active" : ""}`}
            onClick={() => setActive(s.n)}>
            <div className="step-tab-num">{String(s.n).padStart(2, "0")}</div>
            <div className="step-tab-body">
              <div className="step-tab-title">{s.title}</div>
              <div className="step-tab-short">{s.short}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="step-detail">
        <div className="step-detail-num">{String(step.n).padStart(2, "0")}</div>
        <div className="step-detail-body">
          <h3 className="step-detail-title">{step.title}</h3>
          <p className="step-detail-text">{step.body}</p>
          <div className="step-pitfall">
            <span className="step-pitfall-label">⚠ Подвох</span>
            <span>{step.pitfall}</span>
          </div>
        </div>
        <div className="step-detail-vis">
          <StepVisual kind={step.visual} />
        </div>
      </div>
    </section>
  );
}

/* ---------- 7. ADJUSTMENT MATRIX ---------- */
const ADJUSTMENTS = [
  { problem: "SpO₂ низкий", cause: "Лёгкие недораскрыты или недостаток O₂", fix: "↑ MAP на 1–2 см H₂O · затем ↑ FiO₂", which: "оксигенация" },
  { problem: "SpO₂ высокий, FiO₂ высокий", cause: "Можно отучать", fix: "↓ FiO₂ по 5% · затем ↓ MAP по 1 см", which: "оксигенация" },
  { problem: "pCO₂ высокий (гиперкапния)", cause: "Слабое перемешивание — низкий V_hfo, низкий DCO₂", fix: "↑ SV на 0.5–1 мл · если макс — ↓ f на 1 Гц", which: "вентиляция" },
  { problem: "pCO₂ низкий (гипокапния)", cause: "Перевентиляция · риск алкалоза", fix: "↓ SV на 0.5–1 мл (целься в V_hfo 1.2–1.4 мл/кг)", which: "вентиляция" },
  { problem: "Дрожи нет, грудная клетка не вибрирует, DCO₂ → 0", cause: "Отсоединение или закупорка трубки (ЭТТ)", fix: "Санация · проверь ETT · смотри на ΔA и V_hfo на экране", which: "тревога" },
  { problem: "Внезапное падение SpO₂", cause: "Пневмоторакс? Перерастяжение от высокого MAP?", fix: "Аускультация · рентген срочно · оцени MAP на «измеренном»", which: "тревога" },
  { problem: "ΔA растёт, V_hfo и DCO₂ резко упали", cause: "ЭТТ забита", fix: "Санация немедленно", which: "тревога" },
  { problem: "ΔA растёт, V_hfo чуть снизился, DCO₂ критично упал", cause: "Плохой комплайнс дыхательных путей", fix: "Рекруит-маневр, ↑ MAP · оптимизация SV", which: "вентиляция" },
];

function AdjustmentMatrix() {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? ADJUSTMENTS : ADJUSTMENTS.filter(a => a.which === filter);
  return (
    <section className="block" data-screen-label="07 Adjust">
      <SectionLabel n="11" label="Коррекция · Что делать, если..." />
      <h2 className="block-title">
        Газы крови сказали — <span className="accent">что крутить?</span>
      </h2>
      <p className="block-sub">
        Простая шпаргалка. Сначала определи проблему — оксигенация это или вентиляция. Затем — действие.
      </p>
      <div className="filter-row">
        <button className={`filter-btn ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>Все</button>
        <button className={`filter-btn ${filter === "оксигенация" ? "active" : ""}`} onClick={() => setFilter("оксигенация")}>Оксигенация · SpO₂</button>
        <button className={`filter-btn ${filter === "вентиляция" ? "active" : ""}`} onClick={() => setFilter("вентиляция")}>Вентиляция · CO₂</button>
        <button className={`filter-btn ${filter === "тревога" ? "active" : ""}`} onClick={() => setFilter("тревога")}>Тревога</button>
      </div>
      <table className="adj-table">
        <thead>
          <tr><th>Проблема</th><th>Причина</th><th>Что делать</th><th></th></tr>
        </thead>
        <tbody>
          {filtered.map((a, i) => (
            <tr key={i} className={`adj-row adj-${a.which}`}>
              <td className="adj-problem">{a.problem}</td>
              <td className="adj-cause">{a.cause}</td>
              <td className="adj-fix">{a.fix}</td>
              <td><span className={`adj-tag adj-tag-${a.which}`}>{a.which}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* ---------- 8. MISTAKES ---------- */
const MISTAKES = [
  { do: "Установить MAP по «точке раскрытия» — от мин до макс, потом назад", dont: "Скопировать MAP с CMV — будет мало", why: "На HFO нужно держать лёгкие открытыми постоянно. Слишком низкий MAP → плохой комплайнс. Слишком высокий → перерастяжение → нарушение перфузии → десатурация." },
  { do: "Менять что-то одно за раз", dont: "Покрутить сразу MAP, SV и f", why: "Ты не поймёшь, какое изменение помогло, а какое навредило." },
  { do: "Смотреть на грудную клетку и V_hfo / DCO₂", dont: "Ориентироваться только на цифры или только на глаз", why: "Видимая вибрация до пупка + рост DCO₂ — лучшие индикаторы адекватной работы." },
  { do: "Газы крови через 20–30 минут", dont: "Через 5 минут или через час", why: "Раньше — не успели уравновеситься. Позже — пропустишь декомпенсацию." },
  { do: "Седация и иногда миоплегия", dont: "Бороться с активным дыханием пациента", why: "Спонтанные вдохи на HFO нарушают всю физиологию метода." },
  { do: "Снижать FiO₂ первым при отучении", dont: "Сразу резко снижать MAP", why: "Резкое падение MAP → коллапс альвеол → всё начинай сначала." },
];

function Mistakes() {
  return (
    <section className="block block-tinted" data-screen-label="08 Mistakes">
      <SectionLabel n="12" label="Ошибки · DO & DON'T" />
      <h2 className="block-title">
        Шесть вещей, на которых <span className="accent">спотыкаются все.</span>
      </h2>
      <div className="mistakes-grid">
        {MISTAKES.map((m, i) => (
          <div key={i} className="mistake-card">
            <div className="mistake-num num">{String(i + 1).padStart(2, "0")}</div>
            <div className="mistake-pair">
              <div className="mistake-do">
                <div className="mistake-label mistake-label-do">✓ Делай</div>
                <div className="mistake-text">{m.do}</div>
              </div>
              <div className="mistake-dont">
                <div className="mistake-label mistake-label-dont">✗ Не делай</div>
                <div className="mistake-text">{m.dont}</div>
              </div>
            </div>
            <div className="mistake-why">
              <span className="mistake-why-label">Почему</span>
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
    <svg viewBox="0 0 600 500" className="device-svg">
      <rect x="120" y="60" width="360" height="380" rx="14" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="2"/>
      <rect x="120" y="60" width="360" height="40" rx="14" fill="#1E3A5F"/>
      <text x="140" y="86" fontFamily="Inter Tight" fontWeight="800" fontSize="14" fill="#fff" letterSpacing="2">HUMMING VUE</text>
      <circle cx="460" cy="80" r="5" fill="#F59E0B"/>
      <rect x="150" y="120" width="300" height="150" rx="6" fill="#0A1628" stroke="#0D9488" strokeWidth="1.5"/>
      <text x="165" y="140" fontFamily="JetBrains Mono" fontSize="9" fill="#0D9488">HFO · ACTIVE</text>
      <text x="165" y="170" fontFamily="JetBrains Mono" fontSize="22" fontWeight="600" fill="#14B8A6">12.0</text>
      <text x="165" y="184" fontFamily="JetBrains Mono" fontSize="8" fill="#64748B">MAP cmH₂O</text>
      <text x="245" y="170" fontFamily="JetBrains Mono" fontSize="22" fontWeight="600" fill="#F59E0B">6.0</text>
      <text x="245" y="184" fontFamily="JetBrains Mono" fontSize="8" fill="#64748B">SV мл</text>
      <text x="320" y="170" fontFamily="JetBrains Mono" fontSize="22" fontWeight="600" fill="#fff">10.0</text>
      <text x="320" y="184" fontFamily="JetBrains Mono" fontSize="8" fill="#64748B">f Гц</text>
      <text x="395" y="170" fontFamily="JetBrains Mono" fontSize="22" fontWeight="600" fill="#3B82F6">40</text>
      <text x="395" y="184" fontFamily="JetBrains Mono" fontSize="8" fill="#64748B">FiO₂ %</text>
      <text x="165" y="248" fontFamily="JetBrains Mono" fontSize="10" fill="#94A3B8">DCO₂ 360 · ΔA 22 · V_hfo 5.9 мл</text>
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
          <g key={p.id}
             onMouseEnter={() => setHover(p.id)}
             onMouseLeave={() => setHover(null)}
             style={{ cursor: "pointer" }}>
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

function DeviceAnatomy() {
  const [hover, setHover] = useState(null);
  const parts = [
    { id: "screen", label: "Экран · 4 настройки + 4 автоматических показателя", x: 50, y: 18, desc: "Большой сенсорный экран. Справа — 4 настраиваемых параметра (SV, MAP, f, FiO₂). Слева — 4 авто-показателя: ΔA (амплитуда), MAP измеренный, V_hfo, DCO₂. ΔP не настраивается — она следствие SV." },
    { id: "piston", label: "Поршень 13 мкм · сердце аппарата", x: 25, y: 50, desc: "Прецизионный поршень с точностью 13 микрометров. 90% компонентов — Япония. Создаёт точный Stroke Volume (SV) — ударный объём, формирующий V_hfo. Объёмный принцип → ламинарный поток → точная доставка вне зависимости от комплайнса." },
    { id: "circuit", label: "Дыхательный контур", x: 75, y: 60, desc: "Подогреваемый увлажнитель + специальный HFO-контур. Не путать с обычной ИВЛ-трубкой." },
    { id: "controls", label: "Регуляторы 4-х параметров", x: 50, y: 75, desc: "MAP · SV · f · FiO₂ — четыре главные ручки. SV (Stroke Volume) — основной регулятор вентиляции, разрешение 0.2 мл. Амплитуда ΔA отображается как следствие, не настраивается напрямую." },
    { id: "alarm", label: "Звуковая и световая тревога", x: 85, y: 18, desc: "Различает критическую (красный) и информационную (жёлтый) тревогу. DCO₂ → 0 и резкий рост ΔA — критическая тревога: возможна обструкция ЭТТ." },
  ];
  const active = hover ? parts.find(p => p.id === hover) : null;

  return (
    <section className="block block-dark" data-screen-label="09 Device">
      <SectionLabel n="13" label="Аппарат · Humming Vue" />
      <h2 className="block-title block-title-dark">
        Сам <span className="accent">Humming Vue.</span>
      </h2>
      <p className="block-sub block-sub-dark">
        Наведи курсор на цифры — узнай, что есть что.
      </p>

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
              <div className="device-info-label eyebrow">Технический паспорт</div>
              <ul className="spec-list">
                <li><span className="spec-k">Тип привода</span><span className="spec-v num">Поршневой 13 мкм</span></li>
                <li><span className="spec-k">Происхождение</span><span className="spec-v num">90% Япония</span></li>
                <li><span className="spec-k">Поток</span><span className="spec-v num">Ламинарный (по объёму)</span></li>
                <li><span className="spec-k">Stroke Volume</span><span className="spec-v num">0–160 мл · шаг 0.2 мл</span></li>
                <li><span className="spec-k">MAP</span><span className="spec-v num">3–40 cm H₂O</span></li>
                <li><span className="spec-k">Частота</span><span className="spec-v num">5–17 Гц</span></li>
                <li><span className="spec-k">Пациенты</span><span className="spec-v num">500 г → дети</span></li>
                <li><span className="spec-k">Авто-показатели</span><span className="spec-v num">ΔA · MAP · V_hfo · DCO₂</span></li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------- 10. CHEAT SHEET ---------- */
function CheatSheet() {
  return (
    <section className="block block-final" data-screen-label="10 Summary">
      <SectionLabel n="14" label="Шпаргалка · Положи рядом с аппаратом" />
      <h2 className="block-title">
        HFO в <span className="accent">12 строк.</span>
      </h2>

      <div className="cheat-grid">
        <div className="cheat-card"><div className="cheat-icon">🪽</div><div className="cheat-text"><b>HFO = колибри.</b> Маленькие быстрые колебания вместо больших вдохов.</div></div>
        <div className="cheat-card"><div className="cheat-icon">⚖️</div><div className="cheat-text"><b>Поршень vs JET.</b> Humming Vue — по объёму (гарантирован). JET — по давлению (объём «плывёт», следи за триггером).</div></div>
        <div className="cheat-card"><div className="cheat-icon">🎈</div><div className="cheat-text"><b>Лёгкие открыты постоянно.</b> Не «надуваем-сдуваем». Держим на MAP.</div></div>
        <div className="cheat-card"><div className="cheat-icon">🎯</div><div className="cheat-text"><b>4 настройки справа:</b> SV · MAP · f · FiO₂.</div></div>
        <div className="cheat-card"><div className="cheat-icon">📊</div><div className="cheat-text"><b>4 авто-показателя слева:</b> ΔA · MAP измер · V<sub>hfo</sub> · DCO₂. По ним судим о работе.</div></div>
        <div className="cheat-card"><div className="cheat-icon">🧮</div><div className="cheat-text"><b>DCO₂ = V<sub>hfo</sub>² × f.</b> Точное число, по которому оцениваем процесс.</div></div>
        <div className="cheat-card"><div className="cheat-icon">🫁</div><div className="cheat-text"><b>SpO₂ → MAP и FiO₂.</b> MAP важнее: ищем «точку раскрытия».</div></div>
        <div className="cheat-card"><div className="cheat-icon">💨</div><div className="cheat-text"><b>CO₂ → SV (главное) и f.</b> SV формирует V<sub>hfo</sub>. Шаг 0.2 мл.</div></div>
        <div className="cheat-card"><div className="cheat-icon">⚠️</div><div className="cheat-text"><b>ΔA ↑ + V<sub>hfo</sub>/DCO₂ → 0</b> = ЭТТ забита → санация немедленно.</div></div>
        <div className="cheat-card"><div className="cheat-icon">⏱</div><div className="cheat-text"><b>Газы крови — через 20–30 мин.</b> Не раньше, не позже.</div></div>
        <div className="cheat-card"><div className="cheat-icon">📉</div><div className="cheat-text"><b>Отучаем:</b> сначала FiO₂ по 5%, потом MAP по 1 см. Никогда наоборот.</div></div>
        <div className="cheat-card"><div className="cheat-icon">📡</div><div className="cheat-text"><b>Flow-сенсор = уверенность.</b> С ним видишь реальный V<sub>hfo</sub> и DCO₂. Без него — КЩС + глаз + ΔA.</div></div>
      </div>

      <div className="footer-bar">
        <div className="footer-brand">
          <img src={(typeof window !== 'undefined' && window.__resources && window.__resources.logoWordmark) || "assets/logo-wordmark.svg"} alt="Swanston-Med"/>
        </div>
        <div className="footer-meta">
          <span>Humming Vue · HFO · Bundle C — Neonatal</span>
          <span className="dot">·</span>
          <span>Tashkent · 2026</span>
          <span className="dot">·</span>
          <span>swanston.uz</span>
        </div>
      </div>
    </section>
  );
}

/* Export to window for cross-script access */
Object.assign(window, {
  SectionLabel, Tag,
  Hero, WaveformCompare, Metaphor, Indications,
  HowToStart, AdjustmentMatrix, Mistakes, DeviceAnatomy, CheatSheet,
});
