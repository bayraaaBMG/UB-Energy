import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, User, Trash2 } from "lucide-react";
import { useLang } from "../../contexts/LanguageContext";
import { useAuth } from "../../contexts/AuthContext";
import { APP_NAME } from "../../config/constants";
import "./Chatbot.css";

// ─── Bilingual knowledge base ─────────────────────────────────────────────────
const KB = [
  {
    keys: ["эрчим хүч", "electricity", "energy"],
    mn: "Монголын барилгуудын жилийн дундаж эрчим хүчний хэрэглээ нь 150–350 кВт·цаг/м² байдаг. Энэ нь барилгын насжилт, хийц, халаалтын системээс хамаарна.",
    en: "Mongolia's buildings average 150–350 kWh/m²/yr in energy consumption. This varies by building age, construction type, and heating system.",
  },
  {
    keys: ["hdd", "heating degree", "халааны зэрэг"],
    mn: "HDD (Heating Degree Days) нь халааны шаардлагатай өдрүүдийн тооцоолол. Улаанбаатар хот жилд 4500–5000 HDD-тэй — дэлхийн хамгийн өндрийн нэг. Томьёо: HDD = Σ(18°C − T_өдөр)",
    en: "HDD (Heating Degree Days) measures cumulative heating demand. Ulaanbaatar has 4,500–5,000 HDD/year — among the world's highest. Formula: HDD = Σ max(0, 18°C − T_day).",
  },
  {
    keys: ["таамаглал", "predict", "forecast"],
    mn: "AI таамаглагч нь Random Forest болон Gradient Boosting алгоритмуудыг ашиглан ~92% нарийвчлалтайгаар эрчим хүчний хэрэглээг тооцоолно. Барилгын талбай, HDD, барилгасан он хамгийн нөлөөтэй хүчин зүйлс.",
    en: "The AI Predictor uses Random Forest and Gradient Boosting to estimate energy consumption with ~92% accuracy. Building area, HDD, and construction year are the most influential factors.",
  },
  {
    keys: ["зөвлөмж", "хэмнэх", "save", "recommend"],
    mn: "Эрчим хүч хэмнэх гол арга: 1) Ханын тусгаарлалт (100мм+) — 25–35%, 2) 3 давхар шилтэй цонх — 15–20%, 3) Smart thermostat — 20–30%, 4) LED гэрэлтүүлэг — 10–15%. Нийт 40–60% хэмнэх боломжтой.",
    en: "Top energy saving measures: 1) Wall insulation (100mm+) — 25–35%, 2) Triple-glazed windows — 15–20%, 3) Smart thermostat — 20–30%, 4) LED lighting — 10–15%. Total potential: 40–60% savings.",
  },
  {
    keys: ["температур", "temperature", "цаг агаар", "weather"],
    mn: "Улаанбаатарын өвлийн дундаж температур −20°C, хамгийн хүйтэн −40°C хүрдэг. Температур 1°C-аар буурах нь барилгын эрчим хүчний хэрэглээг 2–3%-иар нэмэгдүүлдэг.",
    en: "Ulaanbaatar's winter average is −20°C, dropping to −40°C at its coldest. Each 1°C drop in temperature increases building energy consumption by 2–3%.",
  },
  {
    keys: ["smart home", "ухаалаг гэр", "iot"],
    mn: "Smart Home нь гэрэл, халаалт, камер, цоож зэргийг гар утас эсвэл компьютерээр алсаас хянах боломж олгодог. Home Assistant, Google Home, Apple HomeKit зэрэг платформ байдаг. Зөв хэрэгжүүлбэл 30–40% эрчим хүч хэмнэнэ.",
    en: "Smart Home systems let you control lights, heating, cameras, and locks remotely via smartphone. Platforms include Home Assistant, Google Home, and Apple HomeKit. Proper implementation saves 30–40% on energy.",
  },
  {
    keys: ["co2", "co₂", "нүүрстөрөгч", "carbon", "ялгаруулалт"],
    mn: "Монгол Улсын нэг хүнд ногдох CO₂ ялгаруулалт ~7.5 тонн/жил — дэлхийн дундажаас 2 дахин их. Цахилгааны 92% нүүрснээс үйлдвэрлэгддэгтэй холбоотой.",
    en: "Mongolia's per capita CO₂ emissions are ~7.5 tonnes/year — twice the global average. The main reason: 92% of electricity is generated from coal.",
  },
  {
    keys: ["нарны", "solar", "сэргэн засагдах", "renewable"],
    mn: "Монгол Улс нарны хамгийн их цацрагтай орнуудын нэг — жилд 260–280 нарлаг өдөртэй. 2018-оос нарны эрчим хүчний суурилсан хүчин чадал 10 дахин нэмэгдсэн.",
    en: "Mongolia is among the world's sunniest countries — 260–280 sunny days per year. Installed solar capacity has grown 10× since 2018. Home solar panels can save 30–40% annually.",
  },
  {
    keys: ["халаалт", "heating", "дулаан", "central", "төвлөрсөн"],
    mn: "Улаанбаатарын 70%+ барилга төвлөрсөн дулаан хангамжид холбогдсон. Нийлүүлэлтийн алдагдал өндөртэй тул орон нутгийн халаалт, дулааны насостай системд шилжих нь 20–30% хэмнэлт авчирна.",
    en: "70%+ of Ulaanbaatar's buildings are on the district heating network. Due to high distribution losses, switching to local heating or heat pump systems can save 20–30%.",
  },
  {
    keys: ["тусгаарлалт", "insulation", "дулаалга"],
    mn: "Монгол орны хатуу уур амьсгалд тусгаарлалт хамгийн чухал. Гадна хана: 100–150мм EPS, дээвэр: 200мм минеральн хөвөн. Сайн тусгаарлалт нь дулааны алдагдлыг 50%–иар бууруулна.",
    en: "Insulation is the most critical factor in Mongolia's harsh climate. Exterior walls: 100–150mm EPS; roof: 200mm mineral wool. Good insulation reduces heat loss by up to 50%.",
  },
  {
    keys: ["сайн байна", "сайн уу", "hello", "hi", "сайхан"],
    mn: `Сайн байна уу! Би ${APP_NAME}-ийн AI туслагч. Эрчим хүч, барилга, цаг уур, Smart Home, таамаглал болон ямар ч сэдвээр асуулт тавьж болно!`,
    en: `Hello! I'm the ${APP_NAME} AI assistant. Ask me anything about energy, buildings, weather, Smart Home, or predictions!`,
  },
  {
    keys: ["баярлалаа", "thanks", "thank you", "танд баярлалаа"],
    mn: "Баярлалаа! Цааш ч бас асуух зүйл байвал чөлөөтэй асуугаарай.",
    en: "You're welcome! Feel free to ask anything else anytime.",
  },
  {
    keys: ["чи хэн", "who are you", "танилцуулга", "намайг тань"],
    mn: `Би ${APP_NAME}-ийн AI туслагч. Барилгын эрчим хүч, цаг уур, HDD, Smart Home болон эрчим хүч хэмнэх талаар зөвлөгөө өгч чадна.`,
    en: `I'm the ${APP_NAME} AI assistant. I can advise on building energy consumption, weather, HDD calculations, Smart Home, and energy saving tips.`,
  },
  {
    keys: ["улаанбаатар", "ulaanbaatar", "ub", "монгол", "mongolia"],
    mn: "Улаанбаатар хот нь дэлхийн хамгийн хүйтэн нийслэл — өвлийн дундаж −20°C, жилийн HDD 4500+. Хотын дулааны систем 1930-аад оноос хэрэгжиж ирсэн.",
    en: "Ulaanbaatar is the world's coldest capital — winter average −20°C, annual HDD 4,500+. The district heating system has been in operation since the 1930s.",
  },
  {
    keys: ["aqi", "агаарын чанар", "air quality", "бохирдол"],
    mn: "Улаанбаатарын агаарын бохирдол өвөлдөө (11–3-р сар) дэлхийн хамгийн өндрийн нэг. AQI 200–300 хүрэх нь элбэг. Шалтгаан: гэрийн зуух дулаалах, нүүрс шатаалт.",
    en: "Ulaanbaatar's air pollution in winter (Nov–Mar) is among the world's worst. AQI reaching 200–300 is common. Main cause: residential coal burning for heating.",
  },
  {
    keys: ["kwh", "киловатт", "кВт", "мегаватт"],
    mn: "1 кВт·цаг (kWh) = 1 киловатт хүчний тоноглол 1 цаг ажилласан эрчим хүч. Монголын ердийн орон сууц жилд 5,000–15,000 кВт·цаг зарцуулдаг.",
    en: "1 kWh = 1 kilowatt of power used for 1 hour. A typical Mongolian apartment uses 5,000–15,000 kWh per year. Average tariff ≈ 100–120 MNT/kWh.",
  },
  {
    keys: ["random forest", "gradient boosting", "xgboost", "machine learning", "ml"],
    mn: "Бидний систем Random Forest болон Gradient Boosting (XGBoost) алгоритмуудыг ашигладаг. R² = 0.924 — барилгуудын хэрэглээний 92.4%-ийг зөв тайлбарлана.",
    en: "The system uses Random Forest and Gradient Boosting (XGBoost). R² = 0.924 — correctly explaining 92.4% of building energy variation. Top features: area, HDD, year built.",
  },
  {
    keys: ["csv", "excel", "файл", "import", "өгөгдөл оруулах"],
    mn: "Өгөгдөл оруулах хуудаснаас CSV, Excel, JSON, PDF, Word болон бусад форматаар өгөгдөл оруулах боломжтой.",
    en: "The Data Input page supports CSV, Excel, JSON, PDF, Word, and ZIP file uploads. Real data improves model prediction accuracy.",
  },
  {
    keys: ["dashboard", "хяналт", "статистик", "график"],
    mn: "Хяналтын самбар дээр өдөр, сар, жилийн эрчим хүчний хэрэглээний график, загварын үзүүлэлт (MAE, RMSE, R²), feature importance болон SHAP шинжилгээ харагдана.",
    en: "The Dashboard shows daily, monthly, and yearly energy usage charts, model metrics (MAE, RMSE, R²), feature importance, and SHAP analysis.",
  },
];

function getBotResponse(input, lang) {
  const lower = input.toLowerCase();
  // Keyword match — return answer in the correct language
  for (const item of KB) {
    if (item.keys.some(k => lower.includes(k))) {
      return lang === "en" ? item.en : item.mn;
    }
  }
  // Number questions
  if (/\d+/.test(lower) && (lower.includes("хэд") || lower.includes("хэчнээн") || lower.includes("how many") || lower.includes("how much"))) {
    return lang === "en"
      ? "For specific figures, enter your building details in the AI Predictor page. The model calculates precise consumption based on area, year built, and heating type."
      : "Тоон мэдээлэл авахын тулд тодорхой барилгын мэдээллийг AI Таамаглагч хуудсанд оруулаарай. Талбай, барилгасан он, халаалтын төрлөөс хамааран нарийвчлалтай тооцоо гаргана.";
  }
  // Fallback — still helpful
  if (lang === "en") {
    return `I'm the ${APP_NAME} AI assistant. I can help you with: energy consumption, HDD calculations, weather data, building efficiency, Smart Home, ML predictions, and more. Could you rephrase your question or ask about a specific topic?`;
  }
  return `Та "${input.slice(0, 30)}..." талаар асуув. Би эрчим хүч, HDD, цаг уур, Smart Home, барилгын тусгаарлалт, таамаглал болон дэлхийн статистик зэрэг олон сэдвээр хариулж чадна. Дэлгэрэнгүй асуулт тавьвал илүү сайн хариулт өгнө!`;
}

export default function Chatbot() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const greeting = lang === "mn"
    ? `Сайн байна уу${user ? `, ${user.name}` : ""}! Би ${APP_NAME}-ийн AI туслагч. Эрчим хүч, цаг уур, барилга, Smart Home болон ямар ч сэдвээр асуугаарай! 💬`
    : `Hello${user ? `, ${user.name}` : ""}! I'm the ${APP_NAME} AI assistant. Ask me anything about energy, weather, buildings, or Smart Home!`;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ from: "bot", text: greeting }]);
  const [input, setInput] = useState("");

  // Reset greeting when language switches
  useEffect(() => {
    setMessages([{ from: "bot", text: greeting }]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    const userMsg = { from: "user", text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setTyping(true);
    // Simulate slight delay for realism
    setTimeout(() => {
      const botMsg = { from: "bot", text: getBotResponse(text, lang) };
      setMessages(prev => [...prev, botMsg]);
      setTyping(false);
    }, 600 + Math.random() * 400);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const clearChat = () => setMessages([
    { from: "bot", text: lang === "mn"
      ? `Шинэ яриа эхэллээ${user ? `, ${user.name}` : ""}! Юу асуух вэ? 😊`
      : `New conversation started${user ? `, ${user.name}` : ""}! What would you like to know?` }
  ]);

  // Quick question chips
  const chips = lang === "mn"
    ? ["HDD гэж юу вэ?", "Эрчим хүч хэмнэх арга", "Улаанбаатарын цаг уур", "Smart Home давуу тал"]
    : ["What is HDD?", "Energy saving tips", "UB weather", "Smart Home benefits"];

  return (
    <div className="chatbot-wrapper">
      {open && (
        <div className="chatbot-box animate-fade">
          <div className="chatbot-header">
            <div className="chatbot-header-left">
              <div className="chatbot-bot-avatar">
                <Bot size={16} />
              </div>
              <div>
                <span className="chatbot-header-name">{APP_NAME} AI</span>
                <span className="chatbot-status">● {t.chatbot.online}</span>
              </div>
            </div>
            <div className="chatbot-header-actions">
              <button onClick={clearChat} className="chatbot-close" title={t.chatbot.clear} aria-label={t.chatbot.clear}>
                <Trash2 size={15} />
              </button>
              <button onClick={() => setOpen(false)} className="chatbot-close" aria-label={t.common.close}>
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="chatbot-messages" aria-live="polite" aria-atomic="false" aria-label={t.chatbot.title}>
            {messages.map((msg, i) => (
              <div key={i} className={`chat-msg ${msg.from}`}>
                <div className="chat-avatar">
                  {msg.from === "bot" ? <Bot size={13} /> : <User size={13} />}
                </div>
                <div className="chat-bubble">{msg.text}</div>
              </div>
            ))}
            {typing && (
              <div className="chat-msg bot">
                <div className="chat-avatar"><Bot size={13} /></div>
                <div className="chat-bubble typing-indicator">
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick chips */}
          <div className="chatbot-chips">
            {chips.map(c => (
              <button key={c} className="chip" disabled={typing} onClick={() => {
                const userMsg = { from: "user", text: c };
                setMessages(prev => [...prev, userMsg]);
                setTyping(true);
                setTimeout(() => {
                  setMessages(prev => [...prev, { from: "bot", text: getBotResponse(c, lang) }]);
                  setTyping(false);
                }, 600 + Math.random() * 400);
              }}>
                {c}
              </button>
            ))}
          </div>

          <div className="chatbot-input-row">
            <input
              className="chatbot-input form-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={t.chatbot.placeholder}
            />
            <button className="btn btn-primary chatbot-send" onClick={send} disabled={typing}>
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      <button
        className={`chatbot-toggle ${open ? "open" : ""}`}
        onClick={() => setOpen(!open)}
        title={t.chatbot.title}
        aria-label={t.chatbot.title}
        aria-expanded={open}
      >
        {open ? <X size={24} /> : <MessageCircle size={24} />}
        {!open && <span className="chatbot-pulse" />}
      </button>
    </div>
  );
}
