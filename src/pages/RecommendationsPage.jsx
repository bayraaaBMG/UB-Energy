import { useState, useMemo } from "react";
import { useLang } from "../contexts/LanguageContext";
import { usePageTitle } from "../hooks/usePageTitle";

import {
  Lightbulb, Home, Sun, Thermometer, Zap, Users, TrendingDown,
  ChevronDown, ChevronUp, Calculator, Clock, DollarSign, BarChart2,
  CheckCircle, AlertTriangle, Info, ArrowRight, Filter, Snowflake,
} from "lucide-react";
import SmartHomePage from "./SmartHomePage";
import "./RecommendationsPage.css";

// ─── Constants ────────────────────────────────────────────────────────────────
const ENERGY_INTENSITY = 250; // kWh/m²/year (UB average)
const TARIFF_ELEC  = 85;      // ₮/kWh (УБЦТС 2024)
const TARIFF_HEAT  = 75;      // ₮/kWh-equivalent (district heating)
const HEAT_SHARE   = 0.72;    // 72% of energy is heating in UB

// Blended ₮/kWh: heating share × heat tariff + electric share × elec tariff
const BLENDED_TARIFF = Math.round(HEAT_SHARE * TARIFF_HEAT + (1 - HEAT_SHARE) * TARIFF_ELEC);

// ─── Recommendations data ─────────────────────────────────────────────────────
// cost_per_m2: ₮ per m² of floor area (installed, including labor)
// saving_pct:  fraction of total annual energy saved
// payback_yr:  years to payback at 70m² reference (recalculated live)
const RECS = [
  {
    category: "insulation",
    icon: Home,
    color: "#3a8fd4",
    title: { mn: "Дулаалгын сайжруулалт", en: "Insulation Upgrades" },
    items: [
      {
        id: "wall_eps",
        title: { mn: "Гадна ханын EPS дулаалга (100–150мм)", en: "Exterior EPS Wall Insulation (100–150mm)" },
        desc:  { mn: "EPS эсвэл минеральн хөвөн 100–150мм ханад суурилуулах. Дулааны алдагдлын 35–40% нь ханаар дамжина. УБ-д барилгын дулаалгыг сайжруулах хамгийн өндөр нөлөөтэй арга.", en: "Install 100–150mm EPS or mineral wool on exterior walls. 35–40% of heat loss is through walls — the single highest-impact retrofit for UB buildings." },
        priority: "high",
        cost_per_m2: 22000,
        saving_pct: 0.22,
        source: "БНТУ 23-02-09 · dulaan.mn",
      },
      {
        id: "roof_insul",
        title: { mn: "Дээвэр / таазны дулаалга (200мм)", en: "Roof & Ceiling Insulation (200mm)" },
        desc:  { mn: "Дээвэр болон таазны дулаалгыг 200мм болгох. Дулааны 20–25% нь дээврээр алдагддаг. Орон сууцны дээрх давхарт хамгийн ач холбогдолтой.", en: "Increase roof/ceiling insulation to 200mm. 20–25% of heat is lost through the roof — most relevant for top-floor apartments." },
        priority: "high",
        cost_per_m2: 12000,
        saving_pct: 0.16,
        source: "БНТУ 23-02-09",
      },
      {
        id: "basement_insul",
        title: { mn: "Подвалийн таазны доод хэсгийн дулаалга", en: "Basement Ceiling Insulation" },
        desc:  { mn: "Подвалийн таазны доод хэсгийг 80мм минеральн хөвөнгөөр дулаална. 1-р давхрын айлуудад дулаан алдагдлыг мэдэгдэхүйц бууруулна.", en: "Insulate the underside of the basement ceiling with 80mm mineral wool. Most impactful for ground-floor apartments." },
        priority: "medium",
        cost_per_m2: 8000,
        saving_pct: 0.09,
        source: "SNiP 23-02-2003",
      },
    ],
  },
  {
    category: "windows",
    icon: Sun,
    color: "#e9c46a",
    title: { mn: "Цонхны сайжруулалт", en: "Window Upgrades" },
    items: [
      {
        id: "window_sealing",
        title: { mn: "Цонхны болон хаалганы битүүмжлэл", en: "Window & Door Weatherstripping" },
        desc:  { mn: "Хуучин цонх, хаалганы тойрогт силикон болон уян резинэн битүүмжлэлт тавих. Хямд зардалтай хамгийн богино хугацаанд буцаан нөхөгддөг арга. Нэг цонхонд 3,000–8,000₮ орно.", en: "Apply silicone or rubber weatherstripping around existing windows and doors. Lowest cost, fastest payback. ~3,000–8,000₮ per window including sealant and labor." },
        priority: "high",
        cost_per_m2: 3000,
        saving_pct: 0.07,
        source: "IEA Building Efficiency 2023",
      },
      {
        id: "window_triple",
        title: { mn: "Гурван давхар шилтэй PVC цонх суурилуулах", en: "Install Triple-Glazed PVC Windows" },
        desc:  { mn: "U-утга 0.8–1.0 W/(м²·K)-тэй гурван давхар шилтэй цонхоор солих. Нэг цонхонд 800,000–1,200,000₮ орно. Цонхны хийц алдагдлыг 60% хүртэл бууруулна.", en: "Replace with triple-glazed windows (U-value 0.8–1.0 W/(m²·K)). ~800,000–1,200,000₮ per window installed. Reduces window heat loss by up to 60%." },
        priority: "medium",
        cost_per_m2: 50000,
        saving_pct: 0.13,
        source: "БНТУ 23-02-09 · tog.mn",
      },
      {
        id: "thermal_curtains",
        title: { mn: "Дулаан гардин / хусуур хэрэглэх", en: "Thermal Curtains / Blinds" },
        desc:  { mn: "Шөнийн цагаар дулаан гардин ашиглах нь цонхоор дамжих дулааны алдагдлыг 20–30% бууруулна. Зардал бага, нэн даруй нөлөөтэй.", en: "Using thermal curtains at night cuts window heat loss by 20–30%. Low cost, immediate effect — combine with weatherstripping for best results." },
        priority: "low",
        cost_per_m2: 2500,
        saving_pct: 0.04,
        source: "Energy Saving Trust UK (адаптацлагдсан)",
      },
    ],
  },
  {
    category: "heating",
    icon: Thermometer,
    color: "#f4a261",
    title: { mn: "Халаалтын систем", en: "Heating System" },
    items: [
      {
        id: "thermostat",
        title: { mn: "Ухаалаг термостат суурилуулах", en: "Install Smart Thermostat" },
        desc:  { mn: "Програмчлах боломжтой термостат ашиглан шөнийн цагаар температурыг 2–3°C буулгах. Нэгж: 150,000–350,000₮ (суурилуулалттай). 1°C бууруулах нь жилийн халааны зардлыг 6% хэмнэнэ.", en: "Programmable thermostat: lower temperature 2–3°C at night and when unoccupied. Unit cost: 150,000–350,000₮ installed. Each 1°C reduction saves ~6% of heating cost annually." },
        priority: "high",
        cost_per_m2: 5000,
        saving_pct: 0.12,
        source: "Ecofys · IEA",
      },
      {
        id: "radiator_balance",
        title: { mn: "Радиаторын тэнцвэржүүлэлт", en: "Radiator Balancing" },
        desc:  { mn: "Барилгын радиаторуудыг мэргэжлийн инженерээр тохируулах. Дулааны нэгдсэн тархалт нь хэт халалт болон дутуу халалтыг арилгаж, зардлыг 10–15% бууруулна. Зардал: 100,000–300,000₮.", en: "Professional radiator balancing ensures even heat distribution, eliminating overheating and cold spots. Saves 10–15%. Cost: 100,000–300,000₮ for whole building." },
        priority: "medium",
        cost_per_m2: 2500,
        saving_pct: 0.10,
        source: "УБДС ТӨХК зөвлөмж",
      },
      {
        id: "pipe_insul",
        title: { mn: "Шугам хоолойн дулаалга", en: "Heating Pipe Insulation" },
        desc:  { mn: "Подвал болон нийтийн хэсэгт байрлах халааны шугам хоолойг 30–50мм минеральн хөвөнгөөр тусгаарлах. Дамжуулалтын дулааны алдагдлыг 5–8% бууруулна.", en: "Insulate heating pipes in basement and common areas with 30–50mm mineral wool. Reduces distribution heat loss by 5–8%." },
        priority: "medium",
        cost_per_m2: 6000,
        saving_pct: 0.06,
        source: "БНТУ 41-01-2003",
      },
    ],
  },
  {
    category: "lighting",
    icon: Zap,
    color: "#2a9d8f",
    title: { mn: "Гэрэлтүүлэг", en: "Lighting" },
    items: [
      {
        id: "led",
        title: { mn: "Бүх чийдэнг LED-т солих", en: "Full LED Upgrade" },
        desc:  { mn: "Уламжлалт ба галоген чийдэнг LED-т бүрэн солих. LED нь 80% цахилгаан хэмнэж, нэг чийдэнд 3,000–8,000₮ орно. Ашиглалтын хугацаа 10–15 жил.", en: "Replace all conventional and halogen bulbs with LED. 80% electricity savings per bulb, 3,000–8,000₮ each, 10–15 year lifespan. Fastest payback of any retrofit measure." },
        priority: "high",
        cost_per_m2: 3000,
        saving_pct: 0.05,
        source: "IEC / Mongolian Energy Regulatory Authority",
      },
      {
        id: "motion_sensor",
        title: { mn: "Хөдөлгөөний мэдрэгч (коридор, WC)", en: "Motion Sensors (Corridors, WC)" },
        desc:  { mn: "Коридор, шат, WC-д хөдөлгөөний мэдрэгч суурилуулах. Хүн байхгүй үед гэрэл автоматаар унтраана. Нийтийн зориулалтын байр, оффист хамгийн үр дүнтэй.", en: "Install PIR motion sensors in corridors, stairwells, and restrooms. Lights off when unoccupied. Most effective for commercial and office buildings with shared spaces." },
        priority: "medium",
        cost_per_m2: 7000,
        saving_pct: 0.04,
        source: "ASHRAE 90.1",
      },
      {
        id: "daylight",
        title: { mn: "Байгалийн гэрэлтүүлгийг дээд зэргээр ашиглах", en: "Maximize Natural Daylighting" },
        desc:  { mn: "Цонхны дэргэдэх ажлын байрыг тэргүүлэх байрлалд оруулж, хөшиг сэлгэх. Ажлын цагт хиймэл гэрлийн хэрэглээг 30–50% бууруулж болно.", en: "Prioritize workstations near windows and use light-colored surfaces. Can cut artificial lighting use by 30–50% during working hours with zero cost." },
        priority: "low",
        cost_per_m2: 0,
        saving_pct: 0.02,
        source: "LEED v4.1 Daylighting Credit",
      },
    ],
  },
  {
    category: "mongolia",
    icon: Snowflake,
    color: "#9b72cf",
    title: { mn: "Монгол-специфик шийдэл", en: "Mongolia-Specific Solutions" },
    items: [
      {
        id: "solar_thermal",
        title: { mn: "Нарны дулааны коллектор (ахуйн халуун ус)", en: "Solar Thermal Collector (Domestic Hot Water)" },
        desc: {
          mn: "Монгол орон жилд 260 гаруй нарлаг өдөртэй — дэлхийн хамгийн өндөр үзүүлэлтийн нэг. Хавтгай нарны коллектор суурилуулснаар ахуйн халуун усны зардлыг 50–60% хүртэл бууруулж болно. УБ-д 10–30м²-ийн коллектор ихэнх айл өрхийн хэрэгцээг хангана. Хаврын ба намрын улиралд бүрэн өөрөө хангах боломжтой.",
          en: "Mongolia has 260+ sunny days/year — among the highest globally. A flat-plate solar thermal collector can cut domestic hot water costs by 50–60%. A 10–30m² system meets most household DHW needs in UB. Full self-sufficiency is achievable in spring and autumn.",
        },
        priority: "high",
        cost_per_m2: 25000,
        saving_pct: 0.10,
        source: "НББЕГ · GIZ Mongolia · IFC Solar Report 2023",
      },
      {
        id: "window_film",
        title: { mn: "Цонхны Low-E дулааны хальс", en: "Low-E Window Thermal Film" },
        desc: {
          mn: "Одоо байгаа давхар цонхон дээр Low-E (low-emissivity) дулааны хальс наах. Цонхоор дамжих дулааны алдагдлыг 25–35% бууруулна. Цонх бүрэн солихоос 10 дахин хямд бөгөөд 1–2 жилд буцаан нөхөгддөг. УБ-ын панел байшингийн давхар цонхонд хамгийн тохиромжтой завсрын арга хэмжээ.",
          en: "Apply Low-E thermal film to existing double-glazed windows. Cuts window heat loss by 25–35%. 10× cheaper than full window replacement, pays back in 1–2 years. Ideal interim measure for UB panel-block apartments before committing to full triple-glazed replacement.",
        },
        priority: "high",
        cost_per_m2: 3500,
        saving_pct: 0.05,
        source: "AAMA · dulaan.mn (тохируулсан) · 3M Window Film",
      },
      {
        id: "night_tariff",
        title: { mn: "УБЦТС шөнийн тариф: дулааны хуримтлуур", en: "UBCTS Night-Rate Thermal Storage Heating" },
        desc: {
          mn: "УБЦТС-ийн шөнийн цагийн (22:00–06:00) цахилгааны тариф нь өдрийн тарифаас 40–50% хямд. Дулааны хуримтлуурт зуух суурилуулж шөнийн хямд цахилгаанаар дулааныг хуримтлуулан өдрийн цагт суллана. Тоолуур шилжүүлэх шаардлагатай. Цахилгааны нийт зардлыг 12–18% бууруулна.",
          en: "UBCTS night tariff (22:00–06:00) is 40–50% lower than peak rate. Install a thermal storage heater: charge at night using cheap electricity, release heat during the day. Requires time-of-use meter upgrade. Reduces total electricity heating cost by 12–18%. Highly effective for metered UB apartments.",
        },
        priority: "medium",
        cost_per_m2: 12000,
        saving_pct: 0.12,
        source: "УБЦТС тарифын журам 2024 · НББЕГ",
      },
      {
        id: "sheep_wool",
        title: { mn: "Орон нутгийн хонины ноосон дулаалга", en: "Local Sheep Wool Insulation" },
        desc: {
          mn: "Монгол хонины ноос нь дулаалгын утгаараа минеральн хөвөнгийн дүйцэхүйц (λ ≈ 0.035–0.040 W/(м·K)). Орон нутагт хүртээмжтэй, боловсруулалт хялбар, экологийн цэвэр, нүүрс хүчлийн хий нейтрал. Дотор хана, таазны дулаалгад тохиромжтой бөгөөд орон нутгийн эдийн засгийг дэмжинэ.",
          en: "Mongolian sheep wool has comparable thermal performance to mineral wool (λ ≈ 0.035–0.040 W/(m·K)). Locally sourced, easy to process, carbon-neutral, and eco-friendly. Suitable for interior walls and ceiling insulation — and supports the local rural economy.",
        },
        priority: "medium",
        cost_per_m2: 7000,
        saving_pct: 0.09,
        source: "MNS 6785 · МИБЕГ тайлан 2023 · WWF Mongolia",
      },
      {
        id: "ger_flue",
        title: { mn: "Гэр хорооллын зуухны яндангийн дулаан сэргээгч", en: "Ger District Stove Flue Heat Exchanger" },
        desc: {
          mn: "Гэр хорооллын нүүрсэн зуухны яндан дээр дулаан сэргээгч суурилуулах. Утаагаар ялгарч буй дулааны 30–40% буцааж ашиглагдана. Нийт түлшний зардлыг 15–20% бууруулж, утааны бохирдлыг бууруулахад туслана. УБ-ын гэр хорооллын онцлог шийдэл.",
          en: "Install a flue heat exchanger on ger district coal stoves. Recovers 30–40% of heat that would otherwise escape through the chimney flue. Reduces total fuel costs by 15–20% and also lowers smoke emissions. A UB ger district–specific measure with high community-level impact.",
        },
        priority: "high",
        cost_per_m2: 6000,
        saving_pct: 0.14,
        source: "АГБХ · WHO Mongolia Air Quality Program · Улаанбаатар хот",
      },
    ],
  },
  {
    category: "behavior",
    icon: Users,
    color: "#a8c5e0",
    title: { mn: "Зан үйлийн өөрчлөлт", en: "Behavioral Changes" },
    items: [
      {
        id: "night_setback",
        title: { mn: "Шөнийн температур бууруулалт (15–16°C)", en: "Night Temperature Setback (15–16°C)" },
        desc:  { mn: "Унтаж байхдаа өрөөний температурыг 15–16°C болгон бууруулах. Жилийн халааны зардлыг 8–12% бууруулна. Хэрэгжүүлэх зардал: 0₮.", en: "Set heating to 15–16°C during sleeping hours. Reduces annual heating cost by 8–12%. Zero cost — just adjust the thermostat or use a timer." },
        priority: "high",
        cost_per_m2: 0,
        saving_pct: 0.09,
        source: "EnergyStar · Ecofys",
      },
      {
        id: "standby",
        title: { mn: "Standby горимыг арилгах", en: "Eliminate Standby Power" },
        desc:  { mn: "Ашиглаагүй цахилгаан хэрэгслийг розеткоос суга. Standby горим жилд 5–10% цахилгаан хэрэглэдэг. Хамтарсан залгуур ашиглан нэг даралтаар унтраах.", en: "Unplug or use smart power strips for all devices when not in use. Standby consumes 5–10% of electricity annually. Zero cost, immediate savings." },
        priority: "medium",
        cost_per_m2: 0,
        saving_pct: 0.03,
        source: "IEA Standby Power · IRENA",
      },
      {
        id: "lower_temp",
        title: { mn: "Ажлын цагт температурыг 1°C бууруулах", en: "Reduce Daytime Temperature 1°C" },
        desc:  { mn: "Өрөөний температурыг 21-ийн оронд 20°C тохируулах. 1°C бууруулах нь жилийн халааны зардлыг 6% хэмнэнэ — хувцасны давхарга нэмэхэд хүрэлцэнэ.", en: "Set room temperature to 20°C instead of 21°C. Each 1°C reduction saves ~6% of heating. A simple habit change — add a layer of clothing instead." },
        priority: "medium",
        cost_per_m2: 0,
        saving_pct: 0.06,
        source: "WHO · European Building Performance Directive",
      },
    ],
  },
];

const CATEGORY_LABELS = {
  all:        { mn: "Бүгд", en: "All" },
  insulation: { mn: "Дулаалга", en: "Insulation" },
  windows:    { mn: "Цонх", en: "Windows" },
  heating:    { mn: "Халаалт", en: "Heating" },
  lighting:   { mn: "Гэрэл", en: "Lighting" },
  behavior:   { mn: "Зан үйл", en: "Behavior" },
  mongolia:   { mn: "Монгол-специфик", en: "Mongolia" },
};

const SORT_OPTIONS = [
  { key: "payback", label: { mn: "Буцаан нөхөгдөх хугацаа", en: "Payback period" } },
  { key: "saving",  label: { mn: "Хэмнэлтийн хэмжээ", en: "Savings amount" } },
  { key: "cost",    label: { mn: "Өртөг (бага→их)", en: "Cost (low→high)" } },
];

const PRIORITY_CONFIG = {
  high:   { color: "#e63946", label: { mn: "Өндөр", en: "High" } },
  medium: { color: "#f4a261", label: { mn: "Дунд", en: "Medium" } },
  low:    { color: "#2a9d8f", label: { mn: "Бага", en: "Low" } },
};

const DIFFICULTY_CONFIG = {
  easy:   { color: "#2a9d8f", label: { mn: "Хялбар", en: "Easy" } },
  medium: { color: "#f4a261", label: { mn: "Дунд", en: "Medium" } },
  hard:   { color: "#e63946", label: { mn: "Хэцүү", en: "Hard" } },
};

// Infer difficulty from cost
function getDifficulty(cost_per_m2) {
  if (cost_per_m2 === 0) return "easy";
  if (cost_per_m2 < 8000) return "easy";
  if (cost_per_m2 < 25000) return "medium";
  return "hard";
}

// ─── ROI calc helper ──────────────────────────────────────────────────────────
function calcROI(item, area) {
  const annualEnergy_kwh = area * ENERGY_INTENSITY;
  const saved_kwh        = Math.round(annualEnergy_kwh * item.saving_pct);
  const saved_tugrug     = Math.round(saved_kwh * BLENDED_TARIFF);
  const total_cost       = Math.round(area * item.cost_per_m2);
  const payback_years    = total_cost > 0 ? +(total_cost / saved_tugrug).toFixed(1) : 0;
  return { saved_kwh, saved_tugrug, total_cost, payback_years };
}

// ─── Payback bar ─────────────────────────────────────────────────────────────
function PaybackBar({ years, lang }) {
  const mn = lang === "mn";
  const max = 15;
  const pct = Math.min(100, (years / max) * 100);
  const barColor = years === 0 ? "#2a9d8f" : years < 3 ? "#2a9d8f" : years < 7 ? "#f4a261" : "#e63946";
  const label = years === 0
    ? (mn ? "Нэн даруй" : "Now")
    : `${years} ${mn ? "жил" : "yr"}`;
  return (
    <div className="payback-bar-wrap">
      <div className="payback-bar-track">
        <div className="payback-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
      </div>
      <span className="payback-bar-label" style={{ color: barColor }}>{label}</span>
    </div>
  );
}

// ─── Single rec card ──────────────────────────────────────────────────────────
function RecCard({ item, color, lang, area }) {
  const [open, setOpen] = useState(false);
  const roi = useMemo(() => calcROI(item, area), [item, area]);
  const diff = getDifficulty(item.cost_per_m2);
  const mn = lang === "mn";

  return (
    <div className="rec-card card">
      <button className="rec-card-header" onClick={() => setOpen(!open)}>
        <div className="rcc-top">
          <div className="rcc-title-row">
            <span className="rcc-title">{item.title[lang] || item.title.mn}</span>
            <span className="rcc-saving-badge">−{Math.round(item.saving_pct * 100)}%</span>
            <span className="rcc-priority"
              style={{ background: `${PRIORITY_CONFIG[item.priority].color}20`, color: PRIORITY_CONFIG[item.priority].color, borderColor: `${PRIORITY_CONFIG[item.priority].color}40` }}>
              {PRIORITY_CONFIG[item.priority].label[lang]}
            </span>
          </div>

          <div className="rcc-metrics">
            {/* Cost */}
            <div className="rcc-metric">
              <span className="rcc-metric-icon" style={{ color: "#9b72cf" }}>₮</span>
              <div>
                <div className="rcc-metric-val">
                  {roi.total_cost === 0
                    ? (mn ? "Үнэгүй" : "Free")
                    : `${(roi.total_cost / 1000).toFixed(0)}k₮`}
                </div>
                <div className="rcc-metric-lbl">{mn ? "Нийт өртөг" : "Total cost"}</div>
              </div>
            </div>
            {/* Annual saving */}
            <div className="rcc-metric">
              <TrendingDown size={14} style={{ color: "#2a9d8f", flexShrink: 0 }} />
              <div>
                <div className="rcc-metric-val" style={{ color: "#2a9d8f" }}>
                  {(roi.saved_tugrug / 1000).toFixed(0)}k₮/{mn ? "жил" : "yr"}
                </div>
                <div className="rcc-metric-lbl">
                  {roi.saved_kwh.toLocaleString()} kWh
                </div>
              </div>
            </div>
            {/* Payback */}
            <div className="rcc-metric rcc-payback-col">
              <Clock size={14} style={{ color: "#e9c46a", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <PaybackBar years={roi.payback_years} lang={lang} />
                <div className="rcc-metric-lbl">{mn ? "Буцаан нөхөгдөх хугацаа" : "Payback period"}</div>
              </div>
            </div>
            {/* Difficulty */}
            <div className="rcc-metric">
              <span className="rcc-diff-badge"
                style={{ background: `${DIFFICULTY_CONFIG[diff].color}18`, color: DIFFICULTY_CONFIG[diff].color }}>
                {DIFFICULTY_CONFIG[diff].label[lang]}
              </span>
            </div>
          </div>
        </div>

        <span className="rcc-toggle">{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
      </button>

      {open && (
        <div className="rcc-body animate-fade">
          <p className="rcc-desc">{item.desc[lang] || item.desc.mn}</p>

          <div className="rcc-detail-grid">
            <div className="rcc-detail-box">
              <div className="rcd-label">₮ {mn ? "өртөг" : "cost"}</div>
              <div className="rcd-val">
                {roi.total_cost === 0
                  ? (mn ? "Хэрэгжүүлэх зардалгүй" : "No implementation cost")
                  : `${roi.total_cost.toLocaleString()} ₮`}
              </div>
              <div className="rcd-sub">{mn ? `(${item.cost_per_m2.toLocaleString()} ₮/м² × ${area} м²)` : `(${item.cost_per_m2.toLocaleString()} ₮/m² × ${area} m²)`}</div>
            </div>
            <div className="rcc-detail-box">
              <div className="rcd-label">{mn ? "Жилийн хэмнэлт" : "Annual savings"}</div>
              <div className="rcd-val" style={{ color: "#2a9d8f" }}>{roi.saved_tugrug.toLocaleString()} ₮</div>
              <div className="rcd-sub">{roi.saved_kwh.toLocaleString()} kWh · {BLENDED_TARIFF}₮/kWh</div>
            </div>
            <div className="rcc-detail-box">
              <div className="rcd-label">{mn ? "Буцаан нөхөгдөх" : "Payback"}</div>
              <div className="rcd-val">{roi.payback_years === 0 ? (mn ? "Нэн даруй" : "Immediate") : `${roi.payback_years} ${mn ? "жил" : "yr"}`}</div>
              <div className="rcd-sub">{mn ? "Дунд тарифаар (85₮/kWh цах, 75₮/kWh дулаан)" : "Blended rate (85₮/kWh elec, 75₮/kWh heat)"}</div>
            </div>
          </div>

          <div className="rcc-source">
            <Info size={11} />
            {mn ? "Эх сурвалж" : "Source"}: {item.source}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Category section ─────────────────────────────────────────────────────────
function RecSection({ rec, lang, area, sortKey }) {
  const Icon = rec.icon;
  const mn = lang === "mn";

  const sorted = useMemo(() => {
    const items = rec.items.map(item => ({ item, roi: calcROI(item, area) }));
    if (sortKey === "payback") return items.sort((a, b) => a.roi.payback_years - b.roi.payback_years);
    if (sortKey === "saving")  return items.sort((a, b) => b.roi.saved_tugrug - a.roi.saved_tugrug);
    if (sortKey === "cost")    return items.sort((a, b) => a.roi.total_cost - b.roi.total_cost);
    return items;
  }, [rec.items, area, sortKey]);

  const totalSavingPct = rec.items.reduce((s, i) => s + i.saving_pct, 0);
  const totalSaved = Math.round(area * ENERGY_INTENSITY * totalSavingPct * BLENDED_TARIFF);

  return (
    <div className="rec-category-section">
      <div className="rec-cat-header">
        <div className="rec-cat-icon-wrap" style={{ background: `${rec.color}20`, color: rec.color }}>
          <Icon size={20} />
        </div>
        <div className="rec-cat-info">
          <h3 className="rec-cat-title">{rec.title[mn ? "mn" : "en"]}</h3>
          <div className="rec-cat-summary">
            <span style={{ color: "#2a9d8f", fontWeight: 700 }}>
              {mn ? `≈${(totalSaved / 1000).toFixed(0)}k₮/жил` : `≈${(totalSaved / 1000).toFixed(0)}k₮/yr`}
            </span>
            <span style={{ color: "var(--text3)" }}>
              {mn ? `хүртэл хэмнэгдэх боломжтой · ${Math.round(totalSavingPct * 100)}% хэрэглээ` : `potential savings · ${Math.round(totalSavingPct * 100)}% consumption`}
            </span>
          </div>
        </div>
      </div>
      <div className="rec-cat-items">
        {sorted.map(({ item }) => (
          <RecCard key={item.id} item={item} color={rec.color} lang={lang} area={area} />
        ))}
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function RecommendationsPage() {
  const { t, lang } = useLang();
  usePageTitle(t.nav.recommendations);
  const mn = lang === "mn";

  const [area,      setArea]      = useState(70);
  const [category,  setCategory]  = useState("all");
  const [sortKey,   setSortKey]   = useState("payback");

  const filteredRecs = useMemo(
    () => category === "all" ? RECS : RECS.filter(r => r.category === category),
    [category]
  );

  // Flat list of all items with ROI for the overview bar
  const allItems = useMemo(() =>
    RECS.flatMap(r => r.items.map(item => ({ ...item, categoryColor: r.color, roi: calcROI(item, area) }))),
    [area]
  );

  const topItems = useMemo(() =>
    [...allItems].sort((a, b) => {
      if (a.roi.payback_years === 0 && b.roi.payback_years !== 0) return -1;
      if (b.roi.payback_years === 0 && a.roi.payback_years !== 0) return 1;
      return a.roi.payback_years - b.roi.payback_years;
    }).slice(0, 5),
    [allItems]
  );

  const totalAnnualSaved = Math.round(
    RECS.flatMap(r => r.items).reduce((s, i) => s + i.saving_pct, 0) * area * ENERGY_INTENSITY * BLENDED_TARIFF
  );

  return (
    <div className="recommendations-page">
      <div className="container">
        <div className="page-header">
          <h1><Lightbulb size={28} style={{ marginRight: 8, verticalAlign: "middle" }} />{t.recommendations.title}</h1>
          <p>{t.recommendations.subtitle}</p>
        </div>

        {/* ── ROI Calculator ── */}
        <div className="roi-calc-card card mb-3">
          <div className="roi-calc-header">
            <Calculator size={18} style={{ color: "#9b72cf" }} />
            <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700 }}>
              {mn ? "ROI тооцоолуур — барилгын талбайд суурилсан" : "ROI Calculator — based on your building area"}
            </h3>
          </div>
          <div className="roi-calc-body">
            <div className="roi-area-control">
              <label className="form-label" style={{ fontSize: "0.85rem" }}>
                {mn ? `Барилгын талбай: ${area} м²` : `Building area: ${area} m²`}
              </label>
              <input type="range" min={30} max={5000} step={10} value={area}
                onChange={e => setArea(Number(e.target.value))}
                className="range-input" />
              <div className="range-labels"><span>30 м²</span><span>5,000 м²</span></div>
              <div className="roi-quick-btns">
                {[
                  { label: mn ? "1 айл" : "Apt (1 unit)", v: 70 },
                  { label: mn ? "Жижиг оффис" : "Small office", v: 200 },
                  { label: mn ? "Дундаж барилга" : "Mid-size", v: 1200 },
                  { label: mn ? "Том барилга" : "Large", v: 5000 },
                ].map(({ label, v }) => (
                  <button key={v} onClick={() => setArea(v)}
                    className={`quick-btn${area === v ? " active" : ""}`}>
                    {label} ({v}м²)
                  </button>
                ))}
              </div>
            </div>
            <div className="roi-summary-grid">
              <div className="roi-sum-card">
                <div className="roi-sum-val">{(totalAnnualSaved / 1000000).toFixed(1)} сая₮</div>
                <div className="roi-sum-lbl">{mn ? "Нийт боломжит хэмнэлт/жил" : "Total potential savings/yr"}</div>
              </div>
              <div className="roi-sum-card">
                <div className="roi-sum-val">{Math.round(allItems.reduce((s, i) => s + i.saving_pct, 0) * 100)}%</div>
                <div className="roi-sum-lbl">{mn ? "Нийт хэрэглээний бууралт" : "Total consumption reduction"}</div>
              </div>
              <div className="roi-sum-card">
                <div className="roi-sum-val">{Math.round(allItems.reduce((s, i) => s + i.roi.saved_kwh, 0)).toLocaleString()} kWh</div>
                <div className="roi-sum-lbl">{mn ? "kWh хэмнэлт/жил" : "kWh saved/yr"}</div>
              </div>
            </div>
          </div>

          {/* Top 5 by payback */}
          <div className="roi-top5">
            <div className="roi-top5-title">
              <BarChart2 size={14} style={{ color: "#3a8fd4" }} />
              {mn ? `Хамгийн богино хугацааны буцаан нөхөлт (${area}м²-д)` : `Fastest payback measures (for ${area}m²)`}
            </div>
            <div className="roi-top5-list">
              {topItems.map((item, i) => (
                <div key={item.id} className="roi-top5-row">
                  <span className="rt5-rank" style={{ color: item.categoryColor }}>#{i + 1}</span>
                  <span className="rt5-name">{item.title[lang]}</span>
                  <span className="rt5-cost">{item.roi.total_cost === 0 ? (mn ? "Үнэгүй" : "Free") : `${(item.roi.total_cost / 1000).toFixed(0)}k₮`}</span>
                  <span className="rt5-saving" style={{ color: "#2a9d8f" }}>+{(item.roi.saved_tugrug / 1000).toFixed(0)}k₮/{mn ? "жил" : "yr"}</span>
                  <span className="rt5-payback">
                    {item.roi.payback_years === 0
                      ? <CheckCircle size={13} style={{ color: "#2a9d8f" }} />
                      : `${item.roi.payback_years}${mn ? " жил" : " yr"}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="rec-filters mb-3">
          <div className="rec-filter-group">
            <Filter size={13} style={{ color: "var(--text3)" }} />
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <button key={key}
                className={`rec-filter-btn${category === key ? " active" : ""}`}
                onClick={() => setCategory(key)}>
                {label[lang]}
              </button>
            ))}
          </div>
          <div className="rec-sort-group">
            <span style={{ fontSize: "0.78rem", color: "var(--text3)" }}>{mn ? "Эрэмбэлэх:" : "Sort:"}</span>
            <select className="form-select" style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}
              value={sortKey} onChange={e => setSortKey(e.target.value)}>
              {SORT_OPTIONS.map(o => (
                <option key={o.key} value={o.key}>{o.label[lang]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Recommendation sections ── */}
        <div className="rec-list">
          {filteredRecs.map(rec => (
            <RecSection key={rec.category} rec={rec} lang={lang} area={area} sortKey={sortKey} />
          ))}
        </div>

        {/* ── Disclaimer ── */}
        <div className="rec-note card mt-3">
          <Info size={18} style={{ color: "var(--accent)", flexShrink: 0 }} />
          <div>
            <strong style={{ color: "var(--accent)" }}>{mn ? "Тооцооллын үндэслэл" : "About these estimates"}:</strong>
            <p style={{ color: "var(--text2)", fontSize: "0.82rem", marginTop: "0.3rem", lineHeight: 1.7 }}>
              {mn
                ? `Бүх өртөг, хэмнэлт, буцаан нөхөгдөх хугацааны тооцоо нь ${area}м² талбай, дундаж эрчим хүчний эрч ${ENERGY_INTENSITY} kWh/м²/жил, цахилгаан ${TARIFF_ELEC}₮/kWh, дулаан ${TARIFF_HEAT}₮/kWh-ийн тарифт үндэслэсэн загварчлал юм. Бодит тоо харилцан адилгүй байж болно. Суурилуулалтын өртөгийг мэргэжлийн байгуулагаас саналын тооцоо авч нягтална уу.`
                : `All cost, saving, and payback estimates are model-based using ${area}m² area, ${ENERGY_INTENSITY} kWh/m²/yr energy intensity, ${TARIFF_ELEC}₮/kWh electricity, ${TARIFF_HEAT}₮/kWh heating. Actual figures will vary. Verify installation costs by getting quotes from certified contractors.`}
            </p>
          </div>
        </div>
      </div>

      <SmartHomePage />
    </div>
  );
}
