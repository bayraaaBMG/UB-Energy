import { useState } from "react";
import { Link } from "react-router-dom";
import { useLang } from "../contexts/LanguageContext";
import { usePageTitle } from "../hooks/usePageTitle";
import { METRICS } from "../ml/model";
import {
  Brain, Zap, Map, BarChart2, Database, Upload,
  Lightbulb, CloudSun, Home, Building2, Target,
  ChevronRight, CheckCircle, Users, BookOpen,
  TrendingUp, Shield, Globe, Award, Info,
  ArrowRight, Package, XCircle,
} from "lucide-react";
import { MODEL_COMPARISON } from "../ml/model";
import "./AboutPage.css";

const PAGES = (mn) => [
  {
    icon: Home,
    path: "/",
    color: "#3a8fd4",
    name: mn ? "Нүүр хуудас" : "Home",
    what: mn
      ? "Системийн тойм, ML загварын товч танилцуулга, сарын хэрэглээний график"
      : "System overview, ML model summary, monthly consumption chart",
    how: mn
      ? "Нэвтрэлгүй ч харах боломжтой. Таамаглал хийхийн тулд 'Таамаглал хийх' товч дар."
      : "Accessible without login. Click 'Start Prediction' to begin.",
    who: mn ? "Бүх хэрэглэгч" : "All users",
    badge: mn ? "Нийтэд нээлттэй" : "Public",
    badgeColor: "#2a9d8f",
  },
  {
    icon: Brain,
    path: "/predictor",
    color: "#9b72cf",
    name: mn ? "Таамаглагч" : "Predictor",
    what: mn
      ? "Барилгын параметр оруулахад ML загвар жилийн эрчим хүчний хэрэглээ, CO₂ ялгарал, A–G зэрэглэлийг тооцоолно"
      : "Enter building parameters — ML model calculates annual energy use, CO₂ emissions, and A–G efficiency grade",
    how: mn
      ? "① 3 жишээ сценариоос сонгох (эсвэл өөрийн барилга нэмэх) → ② 'Таамаглал хийх' дар → ③ Үр дүн, зөвлөмж харах"
      : "① Choose a sample scenario (or add your building) → ② Click 'Predict' → ③ View results and recommendations",
    who: mn ? "Судлаач, инженер, байшинтай хэрэглэгч" : "Researchers, engineers, building owners",
    badge: mn ? "Нийтэд нээлттэй" : "Public",
    badgeColor: "#2a9d8f",
  },
  {
    icon: Map,
    path: "/map",
    color: "#e9c46a",
    name: mn ? "Газрын зураг" : "Map",
    what: mn
      ? "Улаанбаатарын барилгуудыг OSM-ээс татаж, Shoelace томьёогоор талбайг тооцоолж, ML-ээр хэрэглээг харуулна"
      : "Loads UB buildings from OSM, computes area via Shoelace formula, shows ML-estimated energy use per building",
    how: mn
      ? "Zoom ≥ 14 болгоод барилга дарна → баруун талд үр дүн гарна. Энерги/зэрэглэл/PM2.5 өнгийн горим сонгох боломжтой."
      : "Zoom in (≥ 14) and click any building → results appear on the right. Switch color modes: energy / grade / PM2.5.",
    who: mn ? "Хот төлөвлөгч, судлаач" : "Urban planners, researchers",
    badge: mn ? "Нийтэд нээлттэй" : "Public",
    badgeColor: "#2a9d8f",
  },
  {
    icon: BarChart2,
    path: "/dashboard",
    color: "#f4a261",
    name: mn ? "Хяналтын самбар" : "Dashboard",
    what: mn
      ? "Өөрийн барилгуудын нийт хэрэглээ, CO₂, зэрэглэл, ML загварын нарийвчлал, синтетик vs таамаглал харьцуулалт"
      : "Your buildings' total usage, CO₂, grades, ML model accuracy metrics, synthetic vs prediction comparison",
    how: mn
      ? "Нэвтэрч орж, барилга нэмснийхээ дараа автоматаар тооцоолол гарна. Жил/сар/өдрийн chart-ийг хооронд сэлгэх боломжтой."
      : "Log in and add buildings — calculations appear automatically. Switch between yearly/monthly/daily charts.",
    who: mn ? "Бүртгэлтэй хэрэглэгч" : "Registered users",
    badge: mn ? "Нэвтрэх шаардлагатай" : "Login required",
    badgeColor: "#f4a261",
  },
  {
    icon: Upload,
    path: "/data-input",
    color: "#57cc99",
    name: mn ? "Өгөгдөл оруулах" : "Data Input",
    what: mn
      ? "Барилгын мэдээллийг гараар болон CSV файлаар оруулах. Оруулах үед шууд ML таамаглал харагдана."
      : "Add buildings manually or via CSV upload. Live ML preview appears as you type.",
    how: mn
      ? "① 'CSV загвар татах' товч дарж жишээ файл авах → ② Мэдээллээ бөглөх → ③ 'Хадгалах' дарна → Dashboard-д харагдана"
      : "① Download CSV template → ② Fill in your data → ③ Click 'Save' → Appears in Dashboard",
    who: mn ? "Бүртгэлтэй хэрэглэгч" : "Registered users",
    badge: mn ? "Нэвтрэх шаардлагатай" : "Login required",
    badgeColor: "#f4a261",
  },
  {
    icon: Database,
    path: "/database",
    color: "#3a8fd4",
    name: mn ? "Дата сан" : "Database",
    what: mn
      ? "Нэмсэн барилгуудын жагсаалт, шүүлтүүр, хайлт. Барилга дарахад тооцоолол, 2026–2027 прогноз, зардал хэмнэх зөвлөгөө гарна."
      : "List of added buildings with filters and search. Click any building to see calculations, 2026–2027 forecast, and savings tips.",
    how: mn
      ? "Хүснэгтийн барилга дээр BarChart icon дарах → доор дэлгэрэнгүй panel нээгдэнэ"
      : "Click the BarChart icon on any row → detailed panel opens below",
    who: mn ? "Бүртгэлтэй хэрэглэгч" : "Registered users",
    badge: mn ? "Нэвтрэх шаардлагатай" : "Login required",
    badgeColor: "#f4a261",
  },
  {
    icon: CloudSun,
    path: "/weather",
    color: "#a8c5e0",
    name: mn ? "Цаг уур" : "Weather",
    what: mn
      ? "Open-Meteo API-аас Улаанбаатарын бодит цаг уурын мэдээлэл, HDD (халааны өдрийн тоо), агаарын чанар"
      : "Real-time Ulaanbaatar weather from Open-Meteo API, HDD (heating degree days), air quality",
    how: mn
      ? "Хуудас нээхэд автоматаар ачаалагдана. HDD нь ML загварт чухал оролт."
      : "Loads automatically when page opens. HDD is a key ML model input.",
    who: mn ? "Бүх хэрэглэгч" : "All users",
    badge: mn ? "Нийтэд нээлттэй" : "Public",
    badgeColor: "#2a9d8f",
  },
  {
    icon: Lightbulb,
    path: "/recommendations",
    color: "#e9c46a",
    name: mn ? "Зөвлөмж" : "Recommendations",
    what: mn
      ? "Эрчим хүч хэмнэх арга хэмжээний жагсаалт: дулаалга, цонх, LED, нарны панел, термостат г.м."
      : "Energy-saving measures: insulation, windows, LED, solar panels, smart thermostat, etc.",
    how: mn
      ? "Барилгынхаа параметрт тохирсон зөвлөмжийг Database хуудасны detail panel-д харна."
      : "See building-specific recommendations in the Database page detail panel.",
    who: mn ? "Бүх хэрэглэгч" : "All users",
    badge: mn ? "Нийтэд нээлттэй" : "Public",
    badgeColor: "#2a9d8f",
  },
  {
    icon: Package,
    path: "/my-space",
    color: "#9b72cf",
    name: mn ? "Миний орон зай" : "My Space",
    what: mn
      ? "Хадгалсан барилга, таамаглалын түүх, сценари, дуртай барилгуудын хувийн хуудас"
      : "Personal space for saved buildings, prediction history, scenarios, and favorites",
    how: mn
      ? "Нэвтэрч орсны дараа ашиглах боломжтой. Сценари хадгалаад Predictor-т буцааж ачаалж болно."
      : "Available after login. Save scenarios and reload them in the Predictor page.",
    who: mn ? "Бүртгэлтэй хэрэглэгч" : "Registered users",
    badge: mn ? "Нэвтрэх шаардлагатай" : "Login required",
    badgeColor: "#f4a261",
  },
];

const STEPS = (mn) => [
  {
    num: "1",
    color: "#3a8fd4",
    title: mn ? "Хуудас нь нийтэд нээлттэй" : "Public pages — no login needed",
    desc:  mn
      ? "Нүүр хуудас, Таамаглагч, Газрын зураг, Цаг уур, Зөвлөмж хуудсуудыг нэвтрэлгүй ашиглаж болно."
      : "Home, Predictor, Map, Weather, and Recommendations work without an account.",
    link: "/predictor",
    linkLabel: mn ? "Таамаглал хийх →" : "Try Predictor →",
  },
  {
    num: "2",
    color: "#9b72cf",
    title: mn ? "Бүртгүүлж нэвтэрнэ" : "Sign up or log in",
    desc:  mn
      ? "Бүртгүүлснээр Dashboard, Өгөгдөл оруулах, Дата сан, Миний орон зай хуудсуудыг бүрэн ашиглах боломжтой болно."
      : "Creating an account unlocks Dashboard, Data Input, Database, and My Space.",
    link: "/login",
    linkLabel: mn ? "Бүртгүүлэх →" : "Sign up →",
  },
  {
    num: "3",
    color: "#2a9d8f",
    title: mn ? "Барилгын мэдээлэл оруулна" : "Add your building",
    desc:  mn
      ? "'Өгөгдөл оруулах' хуудсанд барилгын нэр, талбай, давхар, дулаалга, халаалтын систем зэрэг мэдээллийг бөглөнө."
      : "In 'Data Input', fill in building name, area, floors, insulation, and heating system.",
    link: "/data-input",
    linkLabel: mn ? "Мэдээлэл оруулах →" : "Add data →",
  },
  {
    num: "4",
    color: "#f4a261",
    title: mn ? "ML таамаглал харна" : "View ML prediction",
    desc:  mn
      ? "Dashboard болон Дата сан хуудсанд таны барилгын жилийн хэрэглээ, CO₂, зэрэглэл, 2026–2027 прогноз автоматаар гарна."
      : "Dashboard and Database show annual usage, CO₂, grade, and 2026–2027 forecast automatically.",
    link: "/dashboard",
    linkLabel: mn ? "Dashboard үзэх →" : "Open Dashboard →",
  },
];

const ADVANTAGES = (mn) => [
  {
    icon: Brain,
    color: "#9b72cf",
    title: mn ? "Бодит ML загвар" : "Real ML model",
    desc:  mn
      ? "OLS шугаман регресс — 600 барилгын синтетик датасет дээр сургасан. R² = 0.924, MAE тооцоологдсон."
      : "OLS linear regression trained on 600 synthetic buildings. R² = 0.924, MAE computed.",
  },
  {
    icon: Globe,
    color: "#3a8fd4",
    title: mn ? "Монголын нөхцөлд тохируулсан" : "Mongolia-adapted",
    desc:  mn
      ? "УБ-ын ~4,500 HDD, нүүрсний CO₂ хүчин зүйл, панель барилгын хэв, БНТУ норм ашигласан."
      : "Uses UB's ~4,500 HDD, coal CO₂ factor, panel building archetypes, and БНТУ norms.",
  },
  {
    icon: Target,
    color: "#2a9d8f",
    title: mn ? "Шууд тайлбарлагдана" : "Fully explainable",
    desc:  mn
      ? "β-коэффициент бүр параметрийн нөлөөг харуулна. Dashboard-д SHAP-lite, Feature importance байна."
      : "Each β coefficient shows the parameter's impact. Dashboard includes SHAP-lite and feature importance.",
  },
  {
    icon: Zap,
    color: "#e9c46a",
    title: mn ? "Шуурхай тооцоолол" : "Instant calculation",
    desc:  mn
      ? "Мэдээлэл оруулмагц шууд тооцоолно — backend server шаардлагагүй, бүх зүйл хөтөч дотор ажиллана."
      : "Calculates instantly as you type — no backend server needed, runs entirely in the browser.",
  },
  {
    icon: Building2,
    color: "#e76f51",
    title: mn ? "Газрын зургаас шууд" : "Direct from map",
    desc:  mn
      ? "OSM-ийн барилга дарахад Shoelace томьёогоор талбайг автоматаар тооцоолж, ML-ээр хэрэглээ гаргана."
      : "Click any building on the map — Shoelace formula computes area automatically, ML predicts energy use.",
  },
  {
    icon: Award,
    color: "#57cc99",
    title: mn ? "A–G зэрэглэл" : "A–G grading",
    desc:  mn
      ? "Европын EPC стандарттай нийцсэн A (<50 kWh/m²) — G (≥300 kWh/m²) зэрэглэлийн систем."
      : "European EPC-aligned grading: A (<50 kWh/m²) through G (≥300 kWh/m²).",
  },
];

export default function AboutPage() {
  const { t, lang } = useLang();
  const mn = lang === "mn";
  usePageTitle(mn ? "Системийн тухай" : "About");
  const [openPage, setOpenPage] = useState(null);

  const pages = PAGES(mn);
  const steps = STEPS(mn);
  const advantages = ADVANTAGES(mn);

  return (
    <div className="about-page">
      <div className="container">

        {/* ── Hero ── */}
        <section className="about-hero card">
          <div className="ah-badge">
            <BookOpen size={14} />
            {mn ? "Дипломын ажил · Судалгааны систем" : "Graduation Project · Research System"}
          </div>
          <h1 className="ah-title">
            {mn ? "UB Energy AI — Системийн тухай" : "UB Energy AI — About this system"}
          </h1>
          <p className="ah-sub">
            {mn
              ? "Монгол Улсын барилгуудын эрчим хүчний хэрэглээг машин сургалтын OLS загвараар тооцоолох, таамаглах, дүн шинжилгээ хийх нэгдсэн тавцан."
              : "A unified research platform for predicting, analyzing, and optimizing building energy consumption in Mongolia using OLS machine learning."}
          </p>
          <div className="ah-stats">
            {[
              { label: "R²", val: `${(METRICS.r2 * 100).toFixed(1)}%`, sub: mn ? "Загварын нарийвчлал" : "Model accuracy" },
              { label: "600", val: "600", sub: mn ? "Сургалтын барилга" : "Training buildings" },
              { label: "30+", val: "30+", sub: mn ? "Оролтын feature" : "Input features" },
              { label: "A–G", val: "A–G", sub: mn ? "Зэрэглэлийн систем" : "Grade system" },
            ].map(s => (
              <div key={s.label} className="ah-stat">
                <div className="ah-stat-val">{s.val}</div>
                <div className="ah-stat-sub">{s.sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Quick start ── */}
        <section className="about-section">
          <h2 className="about-section-title">
            <Target size={20} style={{ color: "#2a9d8f" }} />
            {mn ? "Яаж эхлэх вэ?" : "How to get started?"}
          </h2>
          <div className="about-steps">
            {steps.map((s, i) => (
              <div key={i} className="about-step">
                <div className="as-num" style={{ background: s.color }}>{s.num}</div>
                <div className="as-content">
                  <div className="as-title">{s.title}</div>
                  <div className="as-desc">{s.desc}</div>
                  <Link to={s.link} className="as-link" style={{ color: s.color }}>
                    {s.linkLabel}
                  </Link>
                </div>
                {i < steps.length - 1 && <div className="as-connector" />}
              </div>
            ))}
          </div>
        </section>

        {/* ── Page guide ── */}
        <section className="about-section">
          <h2 className="about-section-title">
            <Info size={20} style={{ color: "#3a8fd4" }} />
            {mn ? "Хуудас болгоны тайлбар" : "Page-by-page guide"}
          </h2>
          <p className="about-section-sub">
            {mn
              ? "Хуудас дарахад дэлгэрэнгүй тайлбар нээгдэнэ."
              : "Click any page to expand its description."}
          </p>
          <div className="about-pages-grid">
            {pages.map((p) => {
              const Icon = p.icon;
              const isOpen = openPage === p.path;
              return (
                <div
                  key={p.path}
                  className={`about-page-card${isOpen ? " open" : ""}`}
                  style={{ borderLeftColor: p.color }}
                >
                  <button className="apc-header" onClick={() => setOpenPage(isOpen ? null : p.path)}>
                    <span className="apc-icon" style={{ background: `${p.color}18`, color: p.color }}>
                      <Icon size={18} />
                    </span>
                    <span className="apc-name">{p.name}</span>
                    <span className="apc-badge" style={{ background: `${p.badgeColor}18`, color: p.badgeColor }}>
                      {p.badge}
                    </span>
                    <ChevronRight size={16} className={`apc-chevron${isOpen ? " rotated" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="apc-body">
                      <div className="apc-row">
                        <span className="apc-row-label">{mn ? "Юу хийдэг вэ?" : "What it does"}</span>
                        <span>{p.what}</span>
                      </div>
                      <div className="apc-row">
                        <span className="apc-row-label">{mn ? "Яаж ашиглах вэ?" : "How to use"}</span>
                        <span>{p.how}</span>
                      </div>
                      <div className="apc-row">
                        <span className="apc-row-label">{mn ? "Хэнд хэрэгтэй?" : "Who needs it"}</span>
                        <span>{p.who}</span>
                      </div>
                      <Link to={p.path} className="apc-link" style={{ color: p.color }}>
                        {mn ? "Хуудас руу орох" : "Go to page"} <ArrowRight size={13} />
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── ML model for users ── */}
        <section className="about-section">
          <h2 className="about-section-title">
            <Brain size={20} style={{ color: "#9b72cf" }} />
            {mn ? "ML загвар хэрэглэгчид ямар үр дүн гаргах вэ?" : "What does the ML model output?"}
          </h2>
          <div className="about-ml-flow">
            {[
              {
                label: mn ? "Та оруулна" : "You input",
                color: "#3a8fd4",
                items: mn
                  ? ["Барилгын талбай (м²)", "Барилгасан он", "Давхрын тоо", "Дулаалгын чанар", "Цонхны төрөл", "Халаалтын систем", "Хана материал"]
                  : ["Building area (m²)", "Year built", "Number of floors", "Insulation quality", "Window type", "Heating system", "Wall material"],
              },
              {
                label: mn ? "OLS загвар тооцоолно" : "OLS model computes",
                color: "#9b72cf",
                items: mn
                  ? ["annual_kWh = Xβ", "600 барилга дээр сургасан", "R² = " + METRICS.r2, "MAE = " + METRICS.mae.toLocaleString() + " kWh", "30+ β коэффициент"]
                  : ["annual_kWh = Xβ", "Trained on 600 buildings", "R² = " + METRICS.r2, "MAE = " + METRICS.mae.toLocaleString() + " kWh", "30+ β coefficients"],
              },
              {
                label: mn ? "Та хардаг" : "You receive",
                color: "#2a9d8f",
                items: mn
                  ? ["Жилийн хэрэглээ (kWh)", "Сарын дундаж (kWh)", "CO₂ ялгарал (тонн)", "PM2.5 тоосонцор", "kWh/m² эрч", "A–G зэрэглэл", "2026–2027 прогноз", "Зардал хэмнэх зөвлөмж"]
                  : ["Annual usage (kWh)", "Monthly average (kWh)", "CO₂ emissions (tonnes)", "PM2.5 particulates", "kWh/m² intensity", "A–G grade", "2026–2027 forecast", "Energy-saving tips"],
              },
            ].map((col, i) => (
              <div key={i} className="aml-col">
                <div className="aml-col-title" style={{ color: col.color }}>{col.label}</div>
                <ul className="aml-list">
                  {col.items.map(it => (
                    <li key={it} className="aml-item">
                      <CheckCircle size={13} style={{ color: col.color, flexShrink: 0 }} />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ── ML загварын харьцуулалт ── */}
        <section className="about-section">
          <h2 className="about-section-title">
            <Brain size={20} style={{ color: "#9b72cf" }} />
            {mn ? "Яагаад OLS аргыг сонгов? — Загваруудын бодит харьцуулалт" : "Why OLS? — Real model comparison"}
          </h2>
          <p className="about-section-sub">
            {mn
              ? "3 загварыг нэг тест өгөгдөл дээр харьцуулж, OLS хамгийн өндөр нарийвчлалтай, хамгийн тайлбарлагдахуйц гэж тогтоосон."
              : "3 models were trained and evaluated on the same held-out test set. OLS achieved the highest accuracy and best interpretability."}
          </p>

          {/* Бодит тооцооны хүснэгт */}
          <div className="aml-compare-wrap">
            <table className="aml-compare-table">
              <thead>
                <tr>
                  <th>{mn ? "Загвар" : "Model"}</th>
                  <th>R²</th>
                  <th>MAE (kWh)</th>
                  <th>MAPE %</th>
                  <th>{mn ? "Итгэлцлэл ±15%" : "Conf ±15%"}</th>
                  <th>{mn ? "Тайлбарлагдах" : "Explainable"}</th>
                  <th>{mn ? "Хөтөч дотор" : "Browser-run"}</th>
                </tr>
              </thead>
              <tbody>
                {MODEL_COMPARISON.map((m, i) => {
                  const isWinner = i === 0;
                  return (
                    <tr key={m.id} className={isWinner ? "aml-row-winner" : ""}>
                      <td>
                        <span className="aml-dot" style={{ background: m.color }} />
                        <strong style={{ color: isWinner ? m.color : "var(--text)" }}>
                          {mn ? m.name_mn : m.name}
                        </strong>
                        {isWinner && (
                          <span className="aml-winner-badge">
                            {mn ? "Сонгосон" : "Selected"}
                          </span>
                        )}
                      </td>
                      <td style={{ color: m.color, fontWeight: 700 }}>{m.r2}</td>
                      <td>{m.mae.toLocaleString()}</td>
                      <td>{m.mape}%</td>
                      <td>{m.confidence}%</td>
                      <td style={{ color: isWinner ? "#2a9d8f" : "#e76f51", fontWeight: 600 }}>
                        {isWinner ? (mn ? "Тийм ✓" : "Yes ✓") : (mn ? "Үгүй" : "No")}
                      </td>
                      <td style={{ color: isWinner ? "#2a9d8f" : "#e76f51", fontWeight: 600 }}>
                        {isWinner ? (mn ? "Тийм ✓" : "Yes ✓") : (m.id === "dt" ? (mn ? "Хэсэгчлэн" : "Partial") : (mn ? "Үгүй" : "No"))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* OLS-ийн 4 давуу тал */}
          <div className="aml-ols-reasons">
            <div className="aml-ols-title">
              <CheckCircle size={15} style={{ color: "#2a9d8f" }} />
              {mn ? "OLS сонгосны 4 шалтгаан" : "4 reasons OLS was chosen"}
            </div>
            <div className="aml-ols-grid">
              {[
                {
                  num: "①",
                  color: "#3a8fd4",
                  title: mn ? "Тайлбарлагдах (Interpretability)" : "Interpretability",
                  desc: mn
                    ? "β-коэффициент бүр параметрийн нөлөөг шууд харуулна. 'Талбай 1м² нэмэгдэхэд хэрэглээ X кВт·цаг нэмэгдэнэ' гэж тайлбарлаж болно."
                    : "Each β coefficient shows a feature's exact impact. 'Adding 1m² increases usage by X kWh' — directly explainable.",
                },
                {
                  num: "②",
                  color: "#9b72cf",
                  title: mn ? "Жижиг датасетэд тохиромжтой" : "Small dataset friendly",
                  desc: mn
                    ? "Random Forest, XGBoost нь 10,000+ дата шаардана. OLS 600 барилгад хэт тохируулагдахгүй (overfitting гарахгүй)."
                    : "Random Forest/XGBoost need 10,000+ samples. OLS doesn't overfit on 600 buildings.",
                },
                {
                  num: "③",
                  color: "#2a9d8f",
                  title: mn ? "Explainable AI — дипломын шаардлага" : "Explainable AI — thesis requirement",
                  desc: mn
                    ? "Дипломын судалгаанд загвар яаж шийдвэр гаргаж байгааг тайлбарлах ёстой. OLS үүнийг бүрэн хангана — SHAP-lite ч ажиллана."
                    : "Thesis research must explain how the model makes decisions. OLS satisfies this fully — SHAP-lite works out of the box.",
                },
                {
                  num: "④",
                  color: "#e9c46a",
                  title: mn ? "Хөтөч дотор ажиллана (~5мс)" : "Runs in browser (~5ms)",
                  desc: mn
                    ? "Neural Net, Random Forest нь GPU/сервер шаардана. OLS матриц үржүүлэлт ашигладаг тул JavaScript дотор ~5мс-д сургана."
                    : "Neural nets & RF need GPU/server. OLS uses matrix multiplication — trains in ~5ms in JavaScript, no backend needed.",
                },
              ].map(r => (
                <div key={r.num} className="aml-ols-card">
                  <div className="aml-ols-num" style={{ color: r.color }}>{r.num}</div>
                  <div>
                    <div className="aml-ols-card-title" style={{ color: r.color }}>{r.title}</div>
                    <div className="aml-ols-card-desc">{r.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Яагаад бусад аргыг ашиглаагүй вэ */}
          <div className="aml-rejected">
            <div className="aml-rejected-title">
              <XCircle size={15} style={{ color: "#e76f51" }} />
              {mn ? "Яагаад Random Forest / XGBoost / Neural Net ашиглаагүй вэ?" : "Why not Random Forest / XGBoost / Neural Net?"}
            </div>
            <div className="aml-rejected-grid">
              {[
                {
                  name: "Random Forest / XGBoost",
                  color: "#e76f51",
                  reasons: mn
                    ? ["10,000+ бодит дата шаардана", "Хар хайрцаг — тайлбарлахад хэцүү", "600 синтетик датасетэд overfitting", "Хөтөч дотор ажиллуулахад хэт хүнд"]
                    : ["Needs 10,000+ real samples", "Black-box — hard to explain", "Overfits 600 synthetic samples", "Too heavy for browser deployment"],
                },
                {
                  name: "Neural Network (MLP/LSTM)",
                  color: "#e76f51",
                  reasons: mn
                    ? ["10,000+ дата + GPU шаардана", "LSTM цаг цувааны загвар — нэг удаагийн таамаглалд тохиромжгүй", "Тайлбарлах аргагүй (black-box)", "Backend сервер шаардлагатай"]
                    : ["Needs 10,000+ samples + GPU", "LSTM is sequential — wrong for single-building prediction", "Completely unexplainable", "Requires backend server"],
                },
                {
                  name: "SVR / KNN / GP",
                  color: "#f4a261",
                  reasons: mn
                    ? ["SVR: O(n²–n³) сургалт — удаан", "KNN: Монголын барилгын 'хөрш' байхгүй", "GP: O(n³) тооцоолол — хөтөч дотор боломжгүй", "Hyperparameter тохируулах нарийн ажил"]
                    : ["SVR: O(n²–n³) training — slow", "KNN: no real Mongolian building neighbors", "GP: O(n³) complexity — not browser-feasible", "Complex hyperparameter tuning needed"],
                },
              ].map(r => (
                <div key={r.name} className="aml-rej-card">
                  <div className="aml-rej-name" style={{ color: r.color }}>{r.name}</div>
                  <ul className="aml-rej-list">
                    {r.reasons.map((reason, i) => (
                      <li key={i}>
                        <XCircle size={11} style={{ color: r.color, flexShrink: 0 }} />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="aml-conclusion">
            <CheckCircle size={14} style={{ color: "#2a9d8f" }} />
            <span>
              {mn
                ? `Дүгнэлт: OLS нь Монголын нөхцөлд (жижиг датасет, browser-only, explainable AI шаардлага) хамгийн тохиромжтой. Бодит тест өгөгдөл дээр R² = ${MODEL_COMPARISON[0].r2}, MAE = ${MODEL_COMPARISON[0].mae.toLocaleString()} kWh — Decision Tree болон Ridge Regression-оос давуу.`
                : `Conclusion: OLS best fits Mongolian conditions (small dataset, browser-only, explainable AI requirement). On real test data: R² = ${MODEL_COMPARISON[0].r2}, MAE = ${MODEL_COMPARISON[0].mae.toLocaleString()} kWh — outperforms Decision Tree and Ridge Regression.`}
            </span>
          </div>
        </section>

        {/* ── Advantages ── */}
        <section className="about-section">
          <h2 className="about-section-title">
            <TrendingUp size={20} style={{ color: "#f4a261" }} />
            {mn ? "Системийн давуу тал" : "System advantages"}
          </h2>
          <div className="about-adv-grid">
            {advantages.map((a) => {
              const Icon = a.icon;
              return (
                <div key={a.title} className="about-adv-card card">
                  <div className="aac-icon" style={{ background: `${a.color}15`, color: a.color }}>
                    <Icon size={22} />
                  </div>
                  <div className="aac-title">{a.title}</div>
                  <div className="aac-desc">{a.desc}</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="about-section">
          <h2 className="about-section-title">
            <Shield size={20} style={{ color: "#57cc99" }} />
            {mn ? "Түгээмэл асуулт" : "FAQ"}
          </h2>
          <div className="about-faq">
            {(mn ? [
              { q: "Өгөгдөл минь хаана хадгалагдах вэ?", a: "Таны мэдээлэл зөвхөн таны хөтөч (localStorage)-д хадгалагдана. Бид ямар ч серверт илгээхгүй." },
              { q: "Таамаглал нь 100% нарийн байна уу?", a: "Үгүй. ML загварын R² = " + METRICS.r2 + ", MAE = " + METRICS.mae.toLocaleString() + " kWh. Тооцоолол нь лавлагааны шинжтэй — бодит хэмжилтийн орлуулалт биш." },
              { q: "Ямар барилга оруулж болох вэ?", a: "Орон сууц, оффис, сургууль, эмнэлэг, агуулах, худалдааны барилга бүгд ажиллана. Талбай ба он заавал шаардлагатай." },
              { q: "CSV файлаар оруулж болох уу?", a: "'Өгөгдөл оруулах' хуудсанд 'CSV загвар татах' товч дарж жишээ файл татаад, мэдээллээ бөглөж импортлоно уу." },
              { q: "Газрын зурагт барилга харагдахгүй байвал юу хийх вэ?", a: "Zoom 14-ээс их болгоод хэдэн секунд хүлээнэ үү. Overpass API-аас татахад 5–25 секунд болно." },
              { q: "Систем үнэ төлбөргүй юу?", a: "Тийм, бүрэн үнэгүй. Энэ бол дипломын судалгааны ажлын хэрэгжүүлэлт." },
            ] : [
              { q: "Where is my data stored?", a: "Your data is stored only in your browser (localStorage). We do not send it to any server." },
              { q: "Is the prediction 100% accurate?", a: "No. The ML model has R² = " + METRICS.r2 + " and MAE = " + METRICS.mae.toLocaleString() + " kWh. Results are indicative — not a replacement for real measurements." },
              { q: "What building types are supported?", a: "Apartment, office, school, hospital, warehouse, and commercial buildings. Area and year are required fields." },
              { q: "Can I import via CSV?", a: "Yes. In 'Data Input', click 'Download CSV template', fill in your data, and import." },
              { q: "Buildings not appearing on map?", a: "Zoom in to level 14 or higher and wait 5–25 seconds for the Overpass API to load." },
              { q: "Is this system free?", a: "Yes, completely free. This is a graduation research project implementation." },
            ]).map(({ q, a }, i) => (
              <details key={i} className="faq-item">
                <summary className="faq-q">{q}</summary>
                <p className="faq-a">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="about-cta card">
          <h2>{mn ? "Одоо эхлэцгээе" : "Ready to start?"}</h2>
          <p>{mn ? "Таамаглагч хуудсанд 3 жишээ сценари байна — нэвтрэлгүй туршиж болно." : "The Predictor page has 3 sample scenarios — try without logging in."}</p>
          <div className="about-cta-btns">
            <Link to="/predictor" className="btn btn-accent">
              <Brain size={17} />{mn ? "Таамаглал хийх" : "Start Predicting"}
            </Link>
            <Link to="/map" className="btn btn-secondary">
              <Map size={17} />{mn ? "Газрын зураг" : "View Map"}
            </Link>
            <Link to="/login" className="btn btn-secondary">
              <Users size={17} />{mn ? "Бүртгүүлэх" : "Sign Up"}
            </Link>
          </div>
        </section>

      </div>
    </div>
  );
}
