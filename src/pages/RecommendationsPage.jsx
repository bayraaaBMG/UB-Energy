import { useState } from "react";
import { useLang } from "../contexts/LanguageContext";
import { Lightbulb, Home, Sun, Thermometer, Zap, Users, TrendingDown, ChevronDown, ChevronUp } from "lucide-react";
import "./RecommendationsPage.css";

const RECS = [
  {
    category: "insulation",
    icon: Home,
    color: "#3a8fd4",
    title: { mn: "Тусгаарлалтыг сайжруулах", en: "Improve Insulation" },
    savings: "25-35%",
    items: [
      {
        title: { mn: "Гадна ханын тусгаарлалт", en: "Exterior Wall Insulation" },
        desc: { mn: "EPS эсвэл минеральн хөвөн ашиглан ханын тусгаарлалтыг 100-150мм болгох. Энэ нь дулааны алдагдлыг 30% хүртэл бууруулна.", en: "Install 100-150mm EPS or mineral wool on exterior walls. This reduces heat loss by up to 30%." },
        priority: "high",
      },
      {
        title: { mn: "Дээврийн тусгаарлалт", en: "Roof & Ceiling Insulation" },
        desc: { mn: "Дээвэр болон таазны тусгаарлалтыг 200мм болгох. Дулааны 25-30% нь дээврээр алдагддаг.", en: "Increase roof and ceiling insulation to 200mm. 25-30% of heat is lost through the roof." },
        priority: "high",
      },
      {
        title: { mn: "Подвалийн тусгаарлалт", en: "Basement Insulation" },
        desc: { mn: "Подвалийн таазны доод хэсгийг тусгаарлах. Газрын доороос ирэх хүйтэн нь барилгын эрчим хүчний хэрэглээнд нөлөөлнө.", en: "Insulate the underside of the basement ceiling. Cold from the ground significantly impacts energy use." },
        priority: "medium",
      },
    ],
  },
  {
    category: "windows",
    icon: Sun,
    color: "#e9c46a",
    title: { mn: "Цонхны сайжруулалт", en: "Window Upgrades" },
    savings: "15-20%",
    items: [
      {
        title: { mn: "3 давхар шилтэй цонх", en: "Triple-Glazed Windows" },
        desc: { mn: "Энерги хэмнэдэг 3 давхар шилтэй PVC цонхнуудыг суурилуулах. U-утга 1.0 W/(м²·K)-ээс бага байх шаардлагатай.", en: "Install PVC triple-glazed windows with U-value below 1.0 W/(m²·K) for maximum energy efficiency." },
        priority: "high",
      },
      {
        title: { mn: "Цонхны битүүмжлэл", en: "Window Sealing" },
        desc: { mn: "Хуучин цонхны тойрогт нь буруу материал ашиглан битүүмжлэх. Энэ хямд арга их хэмжээний дулаан алдагдлыг бууруулна.", en: "Seal gaps around existing windows with weatherstripping. This low-cost fix greatly reduces heat loss." },
        priority: "medium",
      },
      {
        title: { mn: "Дулаан хусуур хэрэглэх", en: "Use Thermal Curtains" },
        desc: { mn: "Урьдчилан халаасан агаар гаргахгүйн тулд цонхны хусуур эсвэл гардин ашиглах.", en: "Use thermal curtains or blinds to prevent warm air from escaping at night." },
        priority: "low",
      },
    ],
  },
  {
    category: "heating",
    icon: Thermometer,
    color: "#f4a261",
    title: { mn: "Халаалтын систем", en: "Heating System" },
    savings: "20-30%",
    items: [
      {
        title: { mn: "Smart thermostat суурилуулах", en: "Install Smart Thermostat" },
        desc: { mn: "Програмчлах боломжтой термостат ашиглан шөнө болон хүн байхгүй үед температурыг 2-3°C бууруулах.", en: "Use a programmable thermostat to lower the temperature by 2-3°C at night and when unoccupied." },
        priority: "high",
      },
      {
        title: { mn: "Дулааны тэнцвэржүүлэлт", en: "Balancing Radiators" },
        desc: { mn: "Барилгын радиаторуудыг тэнцвэржүүлж, дулааны жигд хуваарилалтыг хангах.", en: "Balance building radiators to ensure even heat distribution throughout the building." },
        priority: "medium",
      },
      {
        title: { mn: "Шугам хоолойн тусгаарлалт", en: "Pipe Insulation" },
        desc: { mn: "Халааны ба халуун усны шугам хоолойг тусгаарлах. Зам дагуу дулааны алдагдлыг бууруулна.", en: "Insulate heating and hot water pipes to reduce heat loss along distribution routes." },
        priority: "medium",
      },
    ],
  },
  {
    category: "lighting",
    icon: Zap,
    color: "#2a9d8f",
    title: { mn: "Гэрэлтүүлэг", en: "Lighting" },
    savings: "10-15%",
    items: [
      {
        title: { mn: "LED гэрлэнд шилжих", en: "Switch to LED Lighting" },
        desc: { mn: "Бүх уламжлалт чийдэнг LED-т солих. LED нь уламжлалтаас 80% цахилгаан хэмнэдэг.", en: "Replace all conventional bulbs with LED. LEDs use 80% less electricity than traditional bulbs." },
        priority: "high",
      },
      {
        title: { mn: "Хөдөлгөөний мэдрэгч", en: "Motion Sensors" },
        desc: { mn: "Коридор, гарц, WC-д хөдөлгөөний мэдрэгч суурилуулах. Хүн байхгүй үед гэрэл автоматаар унтраана.", en: "Install motion sensors in corridors, stairwells, and restrooms. Lights turn off automatically when unoccupied." },
        priority: "medium",
      },
      {
        title: { mn: "Байгалийн гэрэлтүүлэг", en: "Maximize Daylighting" },
        desc: { mn: "Цонхны дэргэдэх ажлын байрыг тэргүүлэх байрлалд оруулах. Өдрийн гэрлийг дээд зэргээр ашиглана.", en: "Prioritize workspaces near windows to maximize use of natural daylight." },
        priority: "low",
      },
    ],
  },
  {
    category: "behavior",
    icon: Users,
    color: "#a8c5e0",
    title: { mn: "Зан үйлийн өөрчлөлт", en: "Behavioral Changes" },
    savings: "5-10%",
    items: [
      {
        title: { mn: "Халаалтын температурыг бууруулах", en: "Lower Heating Temperature" },
        desc: { mn: "Өрөөний температурыг 1°C-аар буулгах нь жилийн эрчим хүчний хэрэглээг 6% хүртэл бууруулна.", en: "Lowering room temperature by 1°C can reduce annual energy consumption by up to 6%." },
        priority: "high",
      },
      {
        title: { mn: "Шөнийн тохиргоо", en: "Night Setback Mode" },
        desc: { mn: "Шөнийн цагаар температурыг 15-16°C болгон бууруулах. Унтаж байхдаа бага дулаан хэрэгтэй.", en: "Lower temperature to 15-16°C at night. Less heat is needed while sleeping." },
        priority: "medium",
      },
      {
        title: { mn: "Ашиглаагүй тоноглолыг унтраах", en: "Turn Off Standby Devices" },
        desc: { mn: "Цахилгаан хэрэгслийг standby горимд орхихгүй байх. Standby горим жилд ойролцоогоор 10% цахилгаан хэрэглэдэг.", en: "Don't leave appliances on standby. Standby mode consumes approximately 10% of annual electricity." },
        priority: "medium",
      },
    ],
  },
];

function RecSection({ rec, lang, t }) {
  const [open, setOpen] = useState(false);
  const Icon = rec.icon;

  const priorityColor = { high: "var(--danger)", medium: "var(--warning)", low: "var(--success)" };
  const priorityLabel = { high: t.recommendations.priority_high, medium: t.recommendations.priority_medium, low: t.recommendations.priority_low };

  return (
    <div className="rec-section card">
      <div className="rec-header" onClick={() => setOpen(!open)}>
        <div className="rec-header-left">
          <div className="rec-icon" style={{ background: `${rec.color}22`, color: rec.color }}>
            <Icon size={22} />
          </div>
          <div>
            <h3 className="rec-title">{rec.title[lang] || rec.title.mn}</h3>
            <div className="rec-savings">
              <TrendingDown size={14} style={{ color: "var(--success)" }} />
              <span style={{ color: "var(--success)", fontWeight: 600, fontSize: "0.85rem" }}>
                {rec.savings} {t.recommendations.savings_unit}
              </span>
            </div>
          </div>
        </div>
        <div className="rec-toggle">
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>

      {open && (
        <div className="rec-items animate-fade">
          {rec.items.map((item, i) => (
            <div key={i} className="rec-item">
              <div className="rec-item-header">
                <span className="rec-item-title">{item.title[lang] || item.title.mn}</span>
                <span className="priority-dot" style={{ background: priorityColor[item.priority] }}
                  title={priorityLabel[item.priority]}>
                  {priorityLabel[item.priority]}
                </span>
              </div>
              <p className="rec-item-desc">{item.desc[lang] || item.desc.mn}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RecommendationsPage() {
  const { t, lang } = useLang();

  return (
    <div className="recommendations-page">
      <div className="container">
        <div className="page-header">
          <h1><Lightbulb size={28} style={{ marginRight: 8, verticalAlign: "middle" }} />{t.recommendations.title}</h1>
          <p>{t.recommendations.subtitle}</p>
        </div>

        <div className="savings-overview card mb-3">
          <h3 style={{ color: "var(--text)", marginBottom: "1rem" }}>{t.recommendations.total_label}</h3>
          <div className="savings-grid">
            {RECS.map(r => (
              <div key={r.category} className="saving-item">
                <div className="saving-dot" style={{ background: r.color }} />
                <span className="saving-cat">{r.title[lang] || r.title.mn}</span>
                <span className="saving-pct" style={{ color: r.color }}>{r.savings}</span>
              </div>
            ))}
          </div>
          <div className="total-savings">
            <TrendingDown size={20} style={{ color: "var(--success)" }} />
            <span>{t.recommendations.total_label}: <strong style={{ color: "var(--success)", fontSize: "1.2rem" }}>{t.recommendations.total_value}</strong></span>
          </div>
        </div>

        <div className="rec-list">
          {RECS.map(rec => <RecSection key={rec.category} rec={rec} lang={lang} t={t} />)}
        </div>

        <div className="rec-note card mt-3">
          <Lightbulb size={18} style={{ color: "var(--accent)" }} />
          <div>
            <strong style={{ color: "var(--accent)" }}>{t.recommendations.note_title}:</strong>
            <p style={{ color: "var(--text2)", fontSize: "0.875rem", marginTop: "0.3rem", lineHeight: 1.7 }}>
              {t.recommendations.note_text}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
