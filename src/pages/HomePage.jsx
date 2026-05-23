import React from "react";
import { Link } from "react-router-dom";
import { useApp } from "../hooks/useApp";
import { usePageTitle } from "../hooks/usePageTitle";
import {
  Brain, BarChart2, CloudRain, Lightbulb, ArrowRight,
  Building2, Zap, Database, Target, Info, LogIn, FlaskConical, CheckCircle,
  ShieldAlert, Clock, Thermometer, Snowflake, Leaf, TrendingDown, Calculator,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import EnergyDualChart from "../components/charts/EnergyDualChart";
import { monthlyEnergyData } from "../data/mockData";
import { METRICS } from "../ml/model";
import { computeStats } from "../utils/buildingStorage";
import { useData } from "../contexts/DataContext";
import "./HomePage.css";

const FEATURES = (t) => [
  { icon: Brain,     title: t.home.feature1_title, text: t.home.feature1_text, color: "#3a8fd4", path: "/predictor" },
  { icon: CloudRain, title: t.home.feature2_title, text: t.home.feature2_text, color: "#2a9d8f", path: "/weather"   },
  { icon: BarChart2, title: t.home.feature3_title, text: t.home.feature3_text, color: "#e9c46a", path: "/dashboard" },
  { icon: Lightbulb, title: t.home.feature4_title, text: t.home.feature4_text, color: "#f4a261", path: "/recommendations" },
];

export default function HomePage() {
  const { t, lang, user } = useApp();
  const mn = lang === "mn";
  usePageTitle(t.nav.home);
  const monthlyData = monthlyEnergyData.map(d => ({
    ...d,
    month: lang === "mn" ? d.month : d.month_en,
  }));

  const { buildings: allBuildings } = useData();
  const stats = React.useMemo(() => computeStats(allBuildings), [allBuildings]);

  const DEMO_BADGE = { mn: "Синтетик өгөгдөл", en: "Synthetic data", icon: FlaskConical, color: "#f4a261" };
  const REAL_BADGE = { mn: "Бодит үзүүлэлт", en: "Real metric", icon: CheckCircle,  color: "#2a9d8f" };
  const SYNT_BADGE = { mn: "Синтетик датасет", en: "Synthetic dataset", icon: FlaskConical, color: "#6c757d" };

  const STATS = [
    {
      icon: Building2,
      value: stats ? `${stats.count.toLocaleString()} ${t.home.stat1_unit}` : `— ${t.home.stat1_unit}`,
      label: t.home.stat1_label,
      color: "#3a8fd4", src: t.home.stat1_src, badge: DEMO_BADGE,
    },
    {
      icon: Zap,
      value: stats ? `${stats.totalMwh >= 1000 ? (stats.totalMwh / 1000).toFixed(1) + " GWh" : stats.totalMwh + " MWh"}` : "— MWh",
      label: t.home.stat2_label,
      color: "#e9c46a", src: t.home.stat2_src, badge: DEMO_BADGE,
    },
    {
      icon: Target,
      value: `${(METRICS.r2 * 100).toFixed(1)}%`,
      label: t.home.stat3_label,
      color: "#2a9d8f", src: t.home.stat3_src, badge: REAL_BADGE,
    },
    {
      icon: Database,
      value: `${METRICS.n_total} ${t.home.stat4_unit}`,
      label: t.home.stat4_label,
      color: "#f4a261", src: t.home.stat4_src, badge: SYNT_BADGE,
    },
  ];

  return (
    <div className="home-page">

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-bg-grid" />
        <div className="container hero-content animate-fade">
          <div className="hero-badge">
            <Zap size={14} />
            <span>XGBoost · EUI Model · Open-Meteo · {mn ? "Монголын нөхцөлд" : "Mongolia-adapted"}</span>
          </div>
          {user && (
            <div className="hero-welcome">
              <div className="hw-avatar">{user.name.charAt(0)}</div>
              <span>{t.home.welcome.replace("{name}", user.name)}</span>
            </div>
          )}
          <h1 className="hero-title">{t.home.hero_title}</h1>

          <div className="hero-actions">
            <Link to="/predictor" className="btn btn-accent">
              <Brain size={18} />
              {t.home.hero_btn}
            </Link>
            <Link to="/dashboard" className="btn btn-secondary">
              <BarChart2 size={18} />
              {t.home.hero_btn3}
            </Link>
          </div>
          {!user && (
            <p className="hero-login-hint">
              <LogIn size={13} />
              {t.home.login_hint}
              {" "}<Link to="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>
                {t.home.login_link}
              </Link>
            </p>
          )}

          {/* ── Dashboard preview strip ── */}
          <div className="hero-preview-strip">
            <div className="hps-header">
              <span className="hps-dot" style={{ background: "#2a9d8f" }} />
              <span className="hps-dot" style={{ background: "#e9c46a" }} />
              <span className="hps-dot" style={{ background: "#e63946" }} />
              <span className="hps-label">{mn ? "Dashboard харагдац" : "Dashboard Preview"}</span>
            </div>
            <div className="hps-metrics">
              <div className="hps-metric">
                <span className="hps-val" style={{ color: "#3a8fd4" }}>
                  {stats ? stats.count : "—"}
                </span>
                <span className="hps-lbl">{mn ? "Барилга" : "Buildings"}</span>
              </div>
              <span className="hps-sep" />
              <div className="hps-metric">
                <span className="hps-val" style={{ color: "#2a9d8f" }}>
                  {(METRICS.r2 * 100).toFixed(1)}%
                </span>
                <span className="hps-lbl">R² {mn ? "нарийвчлал" : "Accuracy"}</span>
              </div>
              <span className="hps-sep" />
              <div className="hps-metric">
                <span className="hps-val" style={{ color: "#e9c46a" }}>~4,500</span>
                <span className="hps-lbl">HDD / {mn ? "жил" : "year"}</span>
              </div>
              <span className="hps-sep" />
              <div className="hps-metric">
                <span className="hps-val" style={{ color: "#f4a261" }}>30+</span>
                <span className="hps-lbl">{mn ? "Параметр" : "Parameters"}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="stats-section">
        <div className="container">
          <div className="grid grid-4">
            {STATS.map(({ icon: Icon, value, label, color, badge }) => {
              const BadgeIcon = badge.icon;
              return (
                <div className="stat-card card animate-fade" key={label}>
                  <div className="stat-icon" style={{ background: `${color}22`, color }}>
                    <Icon size={24} />
                  </div>
                  <div className="stat-value">{value}</div>
                  <div className="stat-label">{label}</div>
                  <span className="stat-data-badge" style={{ color: badge.color, borderColor: `${badge.color}44`, background: `${badge.color}10` }}>
                    <BadgeIcon size={10} />
                    {lang === "mn" ? badge.mn : badge.en}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Stats source table */}
          <div className="stats-source-box">
            <div className="ssb-head">
              <Info size={14} />
              {t.home.stats_source_title}
            </div>
            <div className="ssb-rows">
              {STATS.map(({ icon: Icon, value, label, color, src }) => (
                <div className="ssb-row" key={label}>
                  <span className="ssb-val" style={{ color }}>
                    <Icon size={12} /> {value}
                  </span>
                  <span className="ssb-label">{label}</span>
                  <span className="ssb-src">{src}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Disclaimer / Data source ── */}
      <section className="disclaimer-section">
        <div className="container">
          <div className="disclaimer-block">
            <div className="disclaimer-left">
              <ShieldAlert size={16} className="disclaimer-icon" aria-hidden="true" />
              <strong>{t.home.disclaimer_title}</strong>
            </div>
            <p className="disclaimer-text">{t.home.disclaimer_text}</p>
            <p className="disclaimer-sources">{t.home.disclaimer_sources}</p>
            <p className="disclaimer-updated">
              <Clock size={11} aria-hidden="true" />
              {t.home.last_updated}: <time dateTime="2026-04-18">2026-04-18</time>
            </p>
          </div>
        </div>
      </section>

      {/* ── Methodology ── */}
      <section className="methodology-section">
        <div className="container">
          <h2 className="section-title">{mn ? "Тооцооллын аргачлал" : "Calculation Methodology"}</h2>
          <p className="meth-sub">
            {mn
              ? "Систем юун дээр суурилж тооцооллыг хийдэг вэ?"
              : "What is the calculation based on?"}
          </p>
          <div className="meth-grid">
            <div className="meth-card card">
              <div className="meth-num">①</div>
              <div className="meth-content">
                <div className="meth-title">Heating Degree Days (HDD)</div>
                <div className="meth-body">
                  <div className="meth-formula">HDD = Σ max(T<sub>base</sub> − T<sub>daily</sub>, 0)</div>
                  <div className="meth-detail">
                    {mn
                      ? "Базисын температур: 18°C · УБ дундаж: ~4,500 HDD/жил · Улирлын хэрэглээний жин"
                      : "Base: 18°C · UB average: ~4,500 HDD/year · Seasonal weighting factor"}
                  </div>
                </div>
              </div>
            </div>

            <div className="meth-card card">
              <div className="meth-num">②</div>
              <div className="meth-content">
                <div className="meth-title">
                  {mn
                    ? "XGBoost + EUI загварын таамаглал"
                    : "XGBoost + EUI Model Prediction"}
                </div>
                <div className="meth-body">
                  <div className="meth-formula">ŷ = XGBoost(area, age, HDD, insulation, …, x₃₀)</div>
                  <div className="meth-detail">
                    {mn
                      ? "Gradient Boosting (n=60, depth=4, eta=0.15) · EUI физик томьёогоор баталгаажуулсан"
                      : "Gradient Boosting (n=60, depth=4, eta=0.15) · validated against physics EUI formula"}
                  </div>
                  <div className="meth-dataset-row">
                    <span className="meth-ds-chip">N = {METRICS.n_total}</span>
                    <span className="meth-ds-chip">80/20 train/test split</span>
                    <span className="meth-ds-chip">{mn ? "Hold-out validation" : "Hold-out validation"}</span>
                    <span className="meth-ds-chip meth-ds-pilot">{mn ? "Синтетик пилот датасет" : "Synthetic pilot dataset"}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="meth-card card">
              <div className="meth-num">③</div>
              <div className="meth-content">
                <div className="meth-title">{mn ? "Барилгын параметрүүд (30+)" : "Building Parameters (30+)"}</div>
                <div className="meth-body">
                  <div className="meth-params">
                    {(mn
                      ? ["Талбай (м²)", "Барилгасан он", "Давхрын тоо", "Дулаалга", "Цонхны төрөл", "Халаалт", "Ханын материал", "HDD"]
                      : ["Area (m²)", "Year built", "Floors", "Insulation", "Window type", "Heating", "Wall material", "HDD"]
                    ).map(p => (
                      <span key={p} className="meth-param-tag">{p}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="meth-accuracy-row">
            {[
              { label: "R²",   value: `${(METRICS.r2 * 100).toFixed(1)}%`,
                desc: mn ? "Тайлбарлах чадвар" : "Explained variance", color: "#2a9d8f" },
              { label: "MAPE", value: `±${METRICS.mape}%`,
                desc: mn ? "УБ цаг уурын нөхцөлд · синтетик пилот" : "UB climate · synthetic pilot", color: "#3a8fd4" },
              { label: "MAE",  value: `${METRICS.mae.toLocaleString()} kWh`,
                desc: mn ? "Дундаж абсолют алдаа" : "Mean absolute error", color: "#9b72cf" },
              { label: "RMSE", value: `${METRICS.rmse.toLocaleString()} kWh`,
                desc: mn ? "Үндэс квадрат алдаа · estimated" : "Root mean sq. error · estimated", color: "#e9c46a" },
            ].map(({ label, value, desc, color }) => (
              <div key={label} className="meth-acc-item">
                <div className="meth-acc-label">{label}</div>
                <div className="meth-acc-value" style={{ color }}>{value}</div>
                <div className="meth-acc-desc">{desc}</div>
              </div>
            ))}
          </div>
          <div className="meth-pilot-note">
            <Info size={12} />
            <span>
              {mn
                ? "Дээрх метрикүүд 600 синтетик барилгын hold-out test set дээр тооцсон — бодит барилгын мэдээллийн дутагдлаас шалтгаалан (estimated / pilot-based). Бодит НЭТЭГ өгөгдөл ирэхэд шинэчлэгдэнэ."
                : "Metrics are estimated on a 600-sample synthetic hold-out test set (pilot-based) due to the absence of publicly available Mongolian building energy records. Will be updated when real district heating data becomes available."}
              {" "}
              <strong style={{ color: "#2a9d8f" }}>
                {mn
                  ? "→ Бодит датасет нэгтгэлт төлөвлөгдөж байна: 2026 III улирал (50+ барилга, пилот)"
                  : "→ Real dataset integration planned: Q3 2026 (50+ buildings, pilot phase)"}
              </strong>
            </span>
          </div>
        </div>
      </section>

      {/* ── Limitations ── */}
      <section className="limitations-section">
        <div className="container">
          <div className="lim-card card">
            <div className="lim-header">
              <ShieldAlert size={15} className="lim-icon" />
              <span className="lim-title">{mn ? "Загварын хязгаарлалтууд" : "Model Limitations"}</span>
              <span className="lim-sub">{mn ? "— инженерүүдэд мэдэгдэх зүйл" : "— known constraints for engineers"}</span>
            </div>
            <div className="lim-grid">
              {[
                {
                  icon: "👤",
                  mn: "Оршин суугчдын зан үйлийг загварчлахгүй",
                  en: "Does not model occupant behaviour",
                  detail_mn: "Гэрт байх цаг, агааржуулалтын дадал, цаг алдаатай эсвэл хэт их халаах зэрэг хүний хүчин зүйлийг тооцохгүй.",
                  detail_en: "Occupancy schedules, ventilation habits, and over- or under-heating patterns are not captured.",
                },
                {
                  icon: "🔥",
                  mn: "Тогтмол дулаан хангамж гэж үздэг",
                  en: "Assumes steady district heating supply",
                  detail_mn: "Дулааны станцийн ачааллын хэлбэлзэл, хоолойн алдагдал, даралтын уналтыг тооцохгүй.",
                  detail_en: "Does not account for heat plant load fluctuation, pipe losses, or pressure drops.",
                },
                {
                  icon: "🏗",
                  mn: "Барилгын бүрхүүлийн хялбаршуулсан загвар",
                  en: "Simplified building envelope model",
                  detail_mn: "Дулааны гүүр, хаалганы хаалт, суурийн дулааны алдагдлыг нарийн тооцохгүй — EUI коэффициентэд дундажлагдсан.",
                  detail_en: "Thermal bridging, door seals, and slab heat loss are averaged into EUI coefficients, not modelled precisely.",
                },
                {
                  icon: "📊",
                  mn: "Синтетик пилот датасет",
                  en: "Synthetic pilot dataset",
                  detail_mn: "600 барилга физик томьёогоор үүсгэгдсэн — бодит НЭТЭГ / дулааны тоолуурын датаар солигдох боломжтой.",
                  detail_en: "600 buildings generated via physics formula — pending real district heating meter data for production use.",
                },
              ].map(({ icon, mn: t_mn, en: t_en, detail_mn, detail_en }) => (
                <div key={t_en} className="lim-item">
                  <div className="lim-item-header">
                    <span className="lim-emoji">{icon}</span>
                    <span className="lim-item-title">{mn ? t_mn : t_en}</span>
                  </div>
                  <div className="lim-item-detail">{mn ? detail_mn : detail_en}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Case Study ── */}
      <section className="casestudy-section">
        <div className="container">
          <div className="cs-section-header">
            <h2 className="section-title">{mn ? "Жишээ барилга — Case Study" : "Case Study — Sample Building"}</h2>
            <span className="cs-sim-badge">
              <FlaskConical size={11} />
              {mn ? "Sample simulation · estimated" : "Sample simulation · estimated"}
            </span>
          </div>
          <div className="cs-grid">
            <div className="card cs-info">
              <div className="cs-tag">{mn ? "Суурь үзүүлэлт" : "Baseline"}</div>
              <div className="cs-building-title">
                <Building2 size={16} />
                {mn ? "Баянмонгол-1 орон сууц" : "Bayanmongol-1 Apartment"}
              </div>
              <div className="cs-specs">
                {[
                  { k: mn ? "Байршил"    : "Location",  v: mn ? "Баянзүрх дүүрэг, УБ" : "Bayanzurkh, UB" },
                  { k: mn ? "Талбай"     : "Area",      v: "1,200 м²" },
                  { k: mn ? "Баригдсан"  : "Built",     v: "1995 он" },
                  { k: mn ? "Давхар"     : "Floors",    v: "9 давхар" },
                  { k: mn ? "Ханы мат."  : "Wall",      v: mn ? "Панель бетон" : "Panel concrete" },
                  { k: mn ? "Дулаалга"   : "Insulation",v: mn ? "Муу (хуучин)" : "Poor (aged)" },
                ].map(({ k, v }) => (
                  <div key={k} className="cs-spec-row">
                    <span className="cs-spec-k">{k}</span>
                    <span className="cs-spec-v">{v}</span>
                  </div>
                ))}
              </div>
              <div className="cs-baseline-metrics">
                <div className="cs-bm-item cs-bm-bad">
                  <div className="cs-bm-val">245 kWh/м²</div>
                  <div className="cs-bm-lbl">kWh/м²/жил</div>
                </div>
                <div className="cs-bm-item">
                  <div className="cs-bm-val">294,000 kWh</div>
                  <div className="cs-bm-lbl">{mn ? "Жилийн нийт" : "Annual total"}</div>
                </div>
                <div className="cs-bm-item">
                  <div className="cs-bm-val" style={{ color: "#e63946" }}>F</div>
                  <div className="cs-bm-lbl">{mn ? "Зэрэглэл" : "Grade"}</div>
                </div>
              </div>
            </div>

            <div className="card cs-retrofits">
              <div className="cs-tag cs-tag-green">{mn ? "Retrofit хувилбарууд" : "Retrofit Options"}</div>
              {[
                { name: mn ? "① Дулаалга нэмэх"           : "① Insulation upgrade",
                  saving: 22, payback: 3.5, newInt: 191, newGrade: "D", cost: "₮12.5M" },
                { name: mn ? "② 3-давхар шилтэй цонх"     : "② Triple-pane windows",
                  saving: 15, payback: 5.2, newInt: 208, newGrade: "E", cost: "₮9.8M" },
                { name: mn ? "③ Хослол (дулаалга + цонх)" : "③ Combined (insul. + windows)",
                  saving: 35, payback: 4.1, newInt: 159, newGrade: "D", cost: "₮21.8M" },
              ].map(({ name, saving, payback, newInt, newGrade, cost }) => {
                const gradeColor = { D:"#f4a261", E:"#e76f51", C:"#a8c686" };
                const co2saved = Math.round((245 - newInt) * 1200 * 0.73 / 1000 * 10) / 10;
                return (
                  <div key={name} className="cs-retrofit-row">
                    <div className="cs-ret-name">{name}</div>
                    <div className="cs-ret-kwhrow">
                      <span className="cs-ret-before">245</span>
                      <span className="cs-ret-arrow">→</span>
                      <span className="cs-ret-after">{newInt} kWh/м²</span>
                      <span className="cs-ret-grade-badge" style={{ background: gradeColor[newGrade] || "#888" }}>{newGrade}</span>
                    </div>
                    <div className="cs-ret-metrics">
                      <span className="cs-ret-saving"><TrendingDown size={12} />−{saving}%</span>
                      <span className="cs-ret-co2">−{co2saved} tCO₂/жил</span>
                      <span className="cs-ret-roi">
                        <Calculator size={12} />
                        {cost} · {payback} {mn ? "жил · энгийн нөхөлт" : "yr · simple payback"}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div className="cs-note">
                {mn
                  ? "* Тооцоолол нь УБЦТС тарифт (~256₮/kWh), EUI загварт болон IEA 2022 ашиглалтын коэффициентэд тулгуурлана."
                  : "* Estimates based on UBEG tariff (~256₮/kWh), EUI model, and IEA 2022 retrofit coefficients."}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Chart + Intro ── */}
      <section className="chart-preview">
        <div className="container">
          <div className="grid chart-preview-grid gap-3">

            <div className="card intro-card">
              <h2 className="section-title">{t.home.intro_title}</h2>
              <p style={{ color: "var(--text2)", lineHeight: 1.7, marginBottom: "1.5rem" }}>
                {t.home.intro_text}
              </p>
              <div className="tech-tags">
                {["XGBoost", "EUI Formula", "Open-Meteo API", "БНТУ норм", "Shoelace Area", "OSM Overpass"].map(tag => (
                  <span key={tag} className="tech-tag">{tag}</span>
                ))}
              </div>
              <Link to="/predictor" className="btn btn-primary mt-3">
                <ArrowRight size={16} />
                {t.home.hero_btn}
              </Link>
            </div>

            <div className="card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                <h3 className="section-title" style={{ fontSize: "1rem", margin: 0 }}>
                  {t.home.chart_title}
                </h3>
                <span className="stat-data-badge" style={{ color: "#f4a261", borderColor: "rgba(244,162,97,0.4)", background: "rgba(244,162,97,0.1)" }}>
                  <FlaskConical size={10} />
                  {lang === "mn" ? "Синтетик өгөгдөл" : "Synthetic data"}
                </span>
              </div>
              <EnergyDualChart
                lang={lang}
                height={200}
                leftTitle={lang === "mn" ? "Stacked: Дулаалга + Цахилгаан = Нийт" : "Stacked: Heating + Electric = Use"}
                rightTitle={lang === "mn" ? "Сар бүрийн нийт хэрэглээ (MWh)" : "Monthly total consumption (MWh)"}
                data={monthlyData.map(d => ({
                  month:    lang === "mn" ? d.month : d.month_en,
                  heating:  d.heating,
                  electric: d.electric,
                  total:    d.usage,
                }))}
              />

              {/* Chart source note */}
              <div className="chart-source-box" style={{ marginTop: "0.5rem" }}>
                <div className="csb-head">
                  <Info size={13} />
                  {t.home.chart_src_title}
                </div>
                <div className="csb-items">
                  <div className="csb-item">
                    <span className="csb-swatch" style={{ background: "#e63946" }} />
                    <div>
                      <strong>{lang === "mn" ? "Дулаалга" : "Heating"}</strong>
                      <span>{lang === "mn" ? "Дүүргийн халаалт — БНТУ 23-02-09 коэффициент" : "District heating — БНТУ 23-02-09 seasonal coefficient"}</span>
                    </div>
                  </div>
                  <div className="csb-item">
                    <span className="csb-swatch" style={{ background: "#1a6eb5" }} />
                    <div>
                      <strong>{lang === "mn" ? "Цахилгаан" : "Electric"}</strong>
                      <span>{t.home.chart_src_pred_desc}</span>
                    </div>
                  </div>
                </div>
                <div className="csb-note">{t.home.chart_src_note}</div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── ML Credibility section ── */}
      <section className="ml-cred-section">
        <div className="container">
          <div className="ml-cred-header">
            <h2 className="section-title">{mn ? "Машин сургалтын загварын тухай" : "About the ML model"}</h2>
            <p className="ml-cred-sub">
              {mn
                ? "Энэ систем үнэхээр машин сургалтын аргыг ашиглаж байна уу? — Тийм. Доор тайлбарласан."
                : "Does this system actually use machine learning? — Yes. Details below."}
            </p>
          </div>
          <div className="ml-cred-grid">
            {[
              {
                label: mn ? "Ашигласан арга" : "Method used",
                value: "XGBoost",
                sub:   mn ? "(Gradient Boosting — n=60, depth=4, eta=0.15)" : "(Gradient Boosting — n=60, depth=4, eta=0.15)",
                color: "#e9c46a",
              },
              {
                label: mn ? "Сургалтын өгөгдөл" : "Training data",
                value: "600",
                sub:   mn ? "синтетик Монгол барилга (EUI физик томьёо + ±12% дуу чимээ)" : "synthetic Mongolian buildings (physics EUI + ±12% noise)",
                color: "#2a9d8f",
              },
              {
                label: mn ? "Нарийвчлал (R²)" : "Accuracy (R²)",
                value: `${(METRICS.r2 * 100).toFixed(1)}%`,
                sub:   mn ? `MAE = ${METRICS.mae.toLocaleString()} kWh · MAPE = ${METRICS.mape}%` : `MAE = ${METRICS.mae.toLocaleString()} kWh · MAPE = ${METRICS.mape}%`,
                color: "#9b72cf",
              },
              {
                label: mn ? "Оролтын хувьсагч" : "Input features",
                value: "30+",
                sub:   mn ? "талбай, нас, давхар, дулаалга, цонх, халаалт, материал, HDD..." : "area, age, floors, insulation, window, heating, material, HDD...",
                color: "#e9c46a",
              },
              {
                label: mn ? "Монголын нөхцөл" : "Mongolia-specific",
                value: "УБ HDD",
                sub:   mn ? "~4,500 HDD/жил · Панель барилга · Нүүрсний хүчин зүйл 0.73 kg CO₂/kWh" : "~4,500 HDD/yr · Panel buildings · Coal factor 0.73 kg CO₂/kWh",
                color: "#e76f51",
              },
              {
                label: mn ? "Тайлбарлах боломж" : "Explainability",
                value: mn ? "Бүрэн" : "Full",
                sub:   mn ? "Feature importance (XGBoost gain) · SHAP-proxy дашбордод байна" : "Feature importance (XGBoost gain) · SHAP-proxy available in dashboard",
                color: "#57cc99",
              },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="ml-cred-card card">
                <div className="mlc-label">{label}</div>
                <div className="mlc-value" style={{ color }}>{value}</div>
                <div className="mlc-sub">{sub}</div>
              </div>
            ))}
          </div>
          <div className="ml-cred-flow">
            {[
              { step: mn ? "Оролт" : "Input",      desc: mn ? "Барилгын параметр" : "Building parameters" },
              { step: "XGBoost",                    desc: mn ? "Gradient boosting" : "Gradient boosting" },
              { step: mn ? "Таамаглал" : "Output",  desc: mn ? "kWh, зэрэглэл, CO₂" : "kWh, grade, CO₂" },
              { step: mn ? "Зөвлөмж" : "Actions",  desc: mn ? "Хэмнэлтийн санал" : "Savings recommendations" },
            ].map(({ step, desc }, i, arr) => (
              <span key={step} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span className="mlc-flow-node">
                  <span className="mlc-flow-step">{step}</span>
                  <span className="mlc-flow-desc">{desc}</span>
                </span>
                {i < arr.length - 1 && <span className="mlc-flow-arr">→</span>}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="features-section">
        <div className="container">
          <div className="grid grid-4">
            {FEATURES(t).map(({ icon: Icon, title, text, color, path }) => (
              <Link to={path} className="feature-card card animate-fade" key={title}>
                <div className="feature-icon" style={{ background: `${color}22`, color }}>
                  <Icon size={28} />
                </div>
                <h3 className="feature-title">{title}</h3>
                <p className="feature-text">{text}</p>
                <span className="feature-arrow" style={{ color }}>
                  <ArrowRight size={16} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
