import { useLang } from "../contexts/LanguageContext";
import { usePageTitle } from "../hooks/usePageTitle";
import { useTheme } from "../contexts/ThemeContext";
import {
  Accessibility, Type, Contrast, Eye, Keyboard, Check,
  Zap, AlertTriangle, ChevronDown, ChevronUp, MousePointerClick,
} from "lucide-react";
import "./AccessibilityPage.css";

// ── Compliance item data ───────────────────────────────────────────────────────
// status: "done" | "partial" | "planned"
const COMPLIANCE = [
  { status: "done",    label: "Skip-to-content link",              desc: "Tab дарахад 'Skip to main content' линк харагдана" },
  { status: "done",    label: "Font size scaling",                  desc: "16 / 18 / 22px — бүх хуудсанд CSS rem ашиглана" },
  { status: "done",    label: "High contrast mode",                 desc: ".high-contrast классаар CSS хувьсагч бүрийг дахин тодорхойлно" },
  { status: "done",    label: "Reduce motion",                      desc: "Анимейшн болон transition-ийг 0.01ms болгон хаана" },
  { status: "done",    label: "System prefers-reduced-motion",      desc: "@media (prefers-reduced-motion) дэмжлэг нэмэгдсэн" },
  { status: "done",    label: "Focus-visible ring",                 desc: ":focus-visible бүх interactive элементэд 2px цагаан/цэнхэр хүрээ" },
  { status: "done",    label: "aria-current='page'",               desc: "Navbar-ийн идэвхтэй линк screen reader-д зөв дамжина" },
  { status: "done",    label: "aria-label on icon buttons",         desc: "Navbar menu toggle, password toggle-д aria-label байна" },
  { status: "done",    label: "aria-expanded on collapsibles",      desc: "Mobile navbar menu aria-expanded ашиглана" },
  { status: "done",    label: "Semantic HTML headings",             desc: "h1→h2→h3 дарааллыг бүх хуудсанд баримталсан" },
  { status: "done",    label: "<main id='main-content'>",           desc: "Skip link-ийн зорилт тодорхойлогдсон" },
  { status: "partial", label: "Form labels linked to inputs",       desc: "Ихэнх form-д label байна; зарим icon-only input-д байхгүй" },
  { status: "partial", label: "Color contrast WCAG AA",             desc: "Ихэнх текст 4.5:1 давна; зарим placeholder хангалтгүй" },
  { status: "partial", label: "Table scope/caption attributes",     desc: "Зарим хүснэгтэд scope='col' байна; caption байхгүй" },
  { status: "planned", label: "Full ARIA live regions",             desc: "Динамик агуулгын шинэчлэлт screen reader-д зарлагдах" },
  { status: "planned", label: "Complete keyboard trap prevention",  desc: "Modal/dialog-д focus trap зөв хэрэгжүүлэх" },
  { status: "planned", label: "Backend-driven data, real WCAG audit", desc: "Бодит хэрэгжилтийн шалгалт хийх шаардлагатай" },
];

function StatusIcon({ status }) {
  if (status === "done")    return <Check size={14} className="comp-icon done"    aria-label="Хэрэгжсэн" />;
  if (status === "partial") return <AlertTriangle size={14} className="comp-icon partial" aria-label="Хэсэгчлэн хэрэгжсэн" />;
  return <ChevronDown size={14} className="comp-icon planned" aria-label="Төлөвлөгдсөн" />;
}

export default function AccessibilityPage() {
  const { t } = useLang();
  usePageTitle(t.nav.accessibility);
  const { fontSize, setFontSize, highContrast, setHighContrast, reduceMotion, setReduceMotion } = useTheme();

  const fontSizes = [
    { value: "normal", label: t.accessibility.normal, px: "16px" },
    { value: "large",  label: t.accessibility.large,  px: "18px" },
    { value: "xlarge", label: t.accessibility.xlarge, px: "22px" },
  ];

  const srFeatures = [
    t.accessibility.sr_f1,
    t.accessibility.sr_f2,
    t.accessibility.sr_f3,
    t.accessibility.sr_f4,
    t.accessibility.sr_f5,
  ];

  const shortcuts = [
    { key: "Tab",        desc: t.accessibility.kb_tab       },
    { key: "Shift+Tab",  desc: t.accessibility.kb_shift_tab },
    { key: "Enter",      desc: t.accessibility.kb_enter     },
    { key: "Escape",     desc: t.accessibility.kb_escape    },
    { key: "↑ / ↓",     desc: t.accessibility.kb_arrows    },
    { key: "Space",      desc: "Товч / checkbox идэвхжүүлэх"  },
    { key: "Alt+←",     desc: "Хуудасны түүхэнд буцах"     },
  ];

  const done    = COMPLIANCE.filter(c => c.status === "done").length;
  const partial = COMPLIANCE.filter(c => c.status === "partial").length;
  const total   = COMPLIANCE.length;

  return (
    <div className="accessibility-page">
      <div className="container">
        <div className="page-header">
          <h1>
            <Accessibility size={28} aria-hidden="true" style={{ marginRight: 8, verticalAlign: "middle" }} />
            {t.accessibility.title}
          </h1>
          <p>{t.accessibility.subtitle}</p>
        </div>

        {/* ── Live preview bar ── */}
        <div className="acc-preview-bar card" aria-live="polite" aria-atomic="true">
          <span className="acc-preview-label">Одоогийн тохиргоо:</span>
          <span className="acc-preview-chip">
            {t.accessibility.font_size}: <strong>{fontSizes.find(f => f.value === fontSize)?.px}</strong>
          </span>
          <span className="acc-preview-chip">
            {highContrast ? "Өндөр контраст ✓" : "Стандарт харагдалт"}
          </span>
          <span className="acc-preview-chip">
            {reduceMotion ? "Хөдөлгөөн хязгаарлагдсан ✓" : "Анимейшн идэвхтэй"}
          </span>
          <span className="acc-preview-sample" style={{ fontSize: fontSizes.find(f => f.value === fontSize)?.px }}>
            UB Energy — дээж текст
          </span>
        </div>

        <div className="access-grid">

          {/* ── Font size ── */}
          <section className="card access-section" aria-labelledby="sec-font">
            <div className="access-header">
              <Type size={22} className="access-icon" aria-hidden="true" />
              <h2 className="access-title" id="sec-font">{t.accessibility.font_size}</h2>
            </div>
            <p className="access-desc">{t.accessibility.font_size_desc}</p>
            <div className="font-options" role="radiogroup" aria-labelledby="sec-font">
              {fontSizes.map(({ value, label, px }) => (
                <button
                  key={value}
                  role="radio"
                  aria-checked={fontSize === value}
                  className={`font-option${fontSize === value ? " active" : ""}`}
                  onClick={() => setFontSize(value)}
                >
                  {fontSize === value && <Check size={14} className="check-icon" aria-hidden="true" />}
                  <span className="font-preview" style={{ fontSize: px }} aria-hidden="true">Аа</span>
                  <span className="font-label">{label}</span>
                  <span className="font-px">{px}</span>
                </button>
              ))}
            </div>
          </section>

          {/* ── Contrast ── */}
          <section className="card access-section" aria-labelledby="sec-contrast">
            <div className="access-header">
              <Contrast size={22} className="access-icon" aria-hidden="true" />
              <h2 className="access-title" id="sec-contrast">{t.accessibility.contrast}</h2>
            </div>
            <p className="access-desc">{t.accessibility.contrast_desc}</p>
            <div className="contrast-options" role="radiogroup" aria-labelledby="sec-contrast">
              <button
                role="radio"
                aria-checked={!highContrast}
                className={`contrast-opt${!highContrast ? " active" : ""}`}
                onClick={() => setHighContrast(false)}
              >
                {!highContrast && <Check size={14} aria-hidden="true" />}
                <div className="contrast-preview normal-preview" aria-hidden="true"><span>Аа</span></div>
                <span>{t.accessibility.normal}</span>
              </button>
              <button
                role="radio"
                aria-checked={highContrast}
                className={`contrast-opt${highContrast ? " active" : ""}`}
                onClick={() => setHighContrast(true)}
              >
                {highContrast && <Check size={14} aria-hidden="true" />}
                <div className="contrast-preview high-preview" aria-hidden="true"><span>Аа</span></div>
                <span>{t.accessibility.high_contrast}</span>
              </button>
            </div>
          </section>

          {/* ── Reduce motion (NEW real control) ── */}
          <section className="card access-section" aria-labelledby="sec-motion">
            <div className="access-header">
              <Zap size={22} className="access-icon" aria-hidden="true" />
              <h2 className="access-title" id="sec-motion">Хөдөлгөөн хязгаарлах</h2>
            </div>
            <p className="access-desc">
              Анимейшн болон transition-ийг унтраах нь эпилепси болон вестибуляр мэдрэмж өндөртэй хүмүүст тустай.
              Энэ тохиргоо бүх хуудсанд нэн даруй хэрэглэгдэнэ.
            </p>
            <div className="motion-toggle-row">
              <label className="acc-toggle" htmlFor="reduce-motion-toggle">
                <input
                  id="reduce-motion-toggle"
                  type="checkbox"
                  checked={reduceMotion}
                  onChange={e => setReduceMotion(e.target.checked)}
                  aria-describedby="motion-desc"
                />
                <span className="acc-toggle-track" />
                <span className="acc-toggle-label">
                  {reduceMotion ? "Хөдөлгөөн хязгаарлагдсан" : "Анимейшн идэвхтэй"}
                </span>
              </label>
              <p id="motion-desc" className="acc-toggle-hint">
                {reduceMotion
                  ? "✓ Бүх анимейшн болон transition унтарсан байна."
                  : "Үйлдлийн системийн тохиргоо: " + (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "хязгаарлах" : "зөвшөөрөх")
                }
              </p>
            </div>
          </section>

          {/* ── Keyboard navigation ── */}
          <section className="card access-section" aria-labelledby="sec-kb">
            <div className="access-header">
              <Keyboard size={22} className="access-icon" aria-hidden="true" />
              <h2 className="access-title" id="sec-kb">{t.accessibility.keyboard_nav}</h2>
            </div>
            <p className="access-desc">{t.accessibility.kb_desc}</p>
            <div className="keyboard-shortcuts" role="table" aria-label="Гарын товчлол">
              <div role="rowgroup">
                {shortcuts.map(({ key, desc }) => (
                  <div key={key} className="shortcut-row" role="row">
                    <kbd className="kbd" role="cell">{key}</kbd>
                    <span role="cell">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="skip-link-demo">
              <MousePointerClick size={14} aria-hidden="true" />
              <span>
                Tab дарахад хуудасны дээд хэсэгт <strong>"Үндсэн агуулга руу шилжих"</strong> товч гарч ирнэ —
                энэ нь navigation-г алгасаж шууд агуулга руу очно.
              </span>
            </div>
          </section>

          {/* ── Screen reader ── */}
          <section className="card access-section" aria-labelledby="sec-sr">
            <div className="access-header">
              <Eye size={22} className="access-icon" aria-hidden="true" />
              <h2 className="access-title" id="sec-sr">{t.accessibility.screen_reader}</h2>
            </div>
            <p className="access-desc">{t.accessibility.sr_desc}</p>
            <div className="access-features-list" role="list">
              {srFeatures.map(f => (
                <div key={f} className="af-item" role="listitem">
                  <Check size={14} style={{ color: "var(--success)", flexShrink: 0 }} aria-hidden="true" />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ── Compliance checklist ── */}
          <section className="card access-section acc-compliance" aria-labelledby="sec-compliance">
            <div className="access-header">
              <Check size={22} className="access-icon" aria-hidden="true" />
              <h2 className="access-title" id="sec-compliance">Хэрэгжилтийн байдал</h2>
            </div>
            <p className="access-desc">
              Одоогийн хэрэгжилтийн бодит байдал — юу ажиллаж байна, юу хэсэгчлэн, юу бас хийгдэхгүй байна.
            </p>

            <div className="comp-summary" aria-label={`${done} хэрэгжсэн, ${partial} хэсэгчлэн, ${total - done - partial} төлөвлөгдсөн`}>
              <div className="comp-sum-item done">
                <span className="comp-sum-num">{done}</span>
                <span className="comp-sum-lbl">Хэрэгжсэн</span>
              </div>
              <div className="comp-sum-item partial">
                <span className="comp-sum-num">{partial}</span>
                <span className="comp-sum-lbl">Хэсэгчлэн</span>
              </div>
              <div className="comp-sum-item planned">
                <span className="comp-sum-num">{total - done - partial}</span>
                <span className="comp-sum-lbl">Төлөвлөгдсөн</span>
              </div>
              <div className="comp-progress-wrap">
                <div
                  className="comp-progress-bar"
                  style={{ width: `${Math.round((done + partial * 0.5) / total * 100)}%` }}
                  role="progressbar"
                  aria-valuenow={Math.round((done + partial * 0.5) / total * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Нийт хэрэгжилтийн хувь"
                />
              </div>
            </div>

            <div className="comp-list" role="list">
              {COMPLIANCE.map((item, i) => (
                <div key={i} className={`comp-item comp-${item.status}`} role="listitem">
                  <StatusIcon status={item.status} />
                  <div className="comp-text">
                    <span className="comp-label">{item.label}</span>
                    <span className="comp-desc">{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>

        {/* ── WCAG note ── */}
        <div className="access-note card mt-3">
          <h3 style={{ color: "var(--accent)", marginBottom: "0.5rem" }}>{t.accessibility.wcag_title}</h3>
          <p style={{ color: "var(--text2)", fontSize: "0.9rem", lineHeight: 1.7 }}>
            {t.accessibility.wcag_desc}
          </p>
        </div>
      </div>
    </div>
  );
}
