import { useLang } from "../contexts/LanguageContext";
import { useTheme } from "../contexts/ThemeContext";
import { Accessibility, Type, Contrast, Eye, Keyboard, Check } from "lucide-react";
import "./AccessibilityPage.css";

export default function AccessibilityPage() {
  const { t } = useLang();
  const { fontSize, setFontSize, highContrast, setHighContrast } = useTheme();

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
    { key: "Tab",       desc: t.accessibility.kb_tab       },
    { key: "Shift+Tab", desc: t.accessibility.kb_shift_tab },
    { key: "Enter",     desc: t.accessibility.kb_enter     },
    { key: "Escape",    desc: t.accessibility.kb_escape    },
    { key: "↑↓",        desc: t.accessibility.kb_arrows    },
  ];

  return (
    <div className="accessibility-page">
      <div className="container">
        <div className="page-header">
          <h1><Accessibility size={28} style={{ marginRight: 8, verticalAlign: "middle" }} />{t.accessibility.title}</h1>
          <p>{t.accessibility.subtitle}</p>
        </div>

        <div className="access-grid">
          {/* Font size */}
          <div className="card access-section">
            <div className="access-header">
              <Type size={22} className="access-icon" />
              <h2 className="access-title">{t.accessibility.font_size}</h2>
            </div>
            <p className="access-desc">{t.accessibility.font_size_desc}</p>
            <div className="font-options">
              {fontSizes.map(({ value, label, px }) => (
                <button
                  key={value}
                  className={`font-option ${fontSize === value ? "active" : ""}`}
                  onClick={() => setFontSize(value)}
                >
                  {fontSize === value && <Check size={14} className="check-icon" />}
                  <span className="font-preview" style={{ fontSize: px }}>Аа</span>
                  <span className="font-label">{label}</span>
                  <span className="font-px">{px}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Contrast */}
          <div className="card access-section">
            <div className="access-header">
              <Contrast size={22} className="access-icon" />
              <h2 className="access-title">{t.accessibility.contrast}</h2>
            </div>
            <p className="access-desc">{t.accessibility.contrast_desc}</p>
            <div className="contrast-options">
              <button
                className={`contrast-opt ${!highContrast ? "active" : ""}`}
                onClick={() => setHighContrast(false)}
              >
                {!highContrast && <Check size={14} />}
                <div className="contrast-preview normal-preview">
                  <span>Аа</span>
                </div>
                <span>{t.accessibility.normal}</span>
              </button>
              <button
                className={`contrast-opt ${highContrast ? "active" : ""}`}
                onClick={() => setHighContrast(true)}
              >
                {highContrast && <Check size={14} />}
                <div className="contrast-preview high-preview">
                  <span>Аа</span>
                </div>
                <span>{t.accessibility.high_contrast}</span>
              </button>
            </div>
          </div>

          {/* Screen reader */}
          <div className="card access-section">
            <div className="access-header">
              <Eye size={22} className="access-icon" />
              <h2 className="access-title">{t.accessibility.screen_reader}</h2>
            </div>
            <p className="access-desc">{t.accessibility.sr_desc}</p>
            <div className="access-features-list">
              {srFeatures.map(f => (
                <div key={f} className="af-item">
                  <Check size={14} style={{ color: "var(--success)", flexShrink: 0 }} />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Keyboard nav */}
          <div className="card access-section">
            <div className="access-header">
              <Keyboard size={22} className="access-icon" />
              <h2 className="access-title">{t.accessibility.keyboard_nav}</h2>
            </div>
            <p className="access-desc">{t.accessibility.kb_desc}</p>
            <div className="keyboard-shortcuts">
              {shortcuts.map(({ key, desc }) => (
                <div key={key} className="shortcut-row">
                  <kbd className="kbd">{key}</kbd>
                  <span>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

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
