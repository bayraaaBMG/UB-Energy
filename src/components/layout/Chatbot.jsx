import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, User, Trash2 } from "lucide-react";
import { useLang } from "../../contexts/LanguageContext";
import { APP_NAME } from "../../config/constants";
import "./Chatbot.css";

// ─── Өргөн мэдлэгийн сан ──────────────────────────────────────────────────────
const KB = [
  // Эрчим хүч
  { keys: ["эрчим хүч", "electricity", "energy"], ans: "Монголын барилгуудын жилийн дундаж эрчим хүчний хэрэглээ нь 150–350 кВт·цаг/м² байдаг. Энэ нь барилгын насжилт, хийц, халаалтын системээс хамаарна." },
  { keys: ["hdd", "heating degree", "халааны зэрэг"], ans: "HDD (Heating Degree Days) нь халааны шаардлагатай өдрүүдийн тооцоолол. Улаанбаатар хот жилд 4500–5000 HDD-тэй — дэлхийн хамгийн өндрийн нэг. Томьёо: HDD = Σ(18°C − T_өдөр)" },
  { keys: ["таамаглал", "predict", "forecast"], ans: "AI таамаглагч нь Random Forest болон Gradient Boosting алгоритмуудыг ашиглан ~92% нарийвчлалтайгаар эрчим хүчний хэрэглээг тооцоолно. Барилгын талбай, HDD, барилгасан он хамгийн нөлөөтэй хүчин зүйлс." },
  { keys: ["зөвлөмж", "хэмнэх", "сave", "recommend"], ans: "Эрчим хүч хэмнэх гол арга: 1) Ханын тусгаарлалт (100мм+) — 25–35% хэмнэлт, 2) 3 давхар шилтэй цонх — 15–20%, 3) Smart thermostat — 20–30%, 4) LED гэрэлтүүлэг — 10–15%. Нийт 40–60% хэмнэх боломжтой." },
  { keys: ["температур", "temperature", "цаг агаар", "weather"], ans: "Улаанбаатарын өвлийн дундаж температур −20°C, хамгийн хүйтэн −40°C хүрдэг. Температур 1°C-аар буурах нь барилгын эрчим хүчний хэрэглээг 2–3%-иар нэмэгдүүлдэг." },
  { keys: ["smart home", "ухаалаг гэр", "iot"], ans: "Smart Home буюу ухаалаг гэрийн систем нь гэрэл, халаалт, камер, цоож зэргийг гар утас эсвэл компьютерээр алсаас хянах боломж олгодог. Home Assistant, Google Home, Apple HomeKit зэрэг платформ байдаг. Зөв хэрэгжүүлбэл 30–40% эрчим хүч хэмнэнэ." },
  { keys: ["co2", "co₂", "нүүрстөрөгч", "carbon", "ялгаруулалт"], ans: "Монгол Улсын нэг хүнд ногдох CO₂ ялгаруулалт ~7.5 тонн/жил — дэлхийн дундажаас 2 дахин их. Голлох шалтгаан нь цахилгааны 92% нүүрснээс үйлдвэрлэгддэгтэй холбоотой." },
  { keys: ["нарны", "solar", "сэргэн засагдах", "renewable"], ans: "Монгол Улс нарны хамгийн их цацрагтай орнуудын нэг — жилд 260–280 нарлаг өдөртэй. 2018-оос нарны эрчим хүчний суурилсан хүчин чадал 10 дахин нэмэгдсэн. Гэрийн нарны хавтан суурилуулбал жилд 30–40% хэмнэнэ." },
  { keys: ["халаалт", "heating", "дулаан", "central", "төвлөрсөн"], ans: "Улаанбаатарын 70%+ барилга төвлөрсөн дулаан хангамжид холбогдсон. Нийлүүлэлтийн алдагдал өндөртэй тул орон нутгийн халаалт, дулааны насостой системд шилжих нь 20–30% хэмнэлт авчирна." },
  { keys: ["тусгаарлалт", "insulation", "дулаалга"], ans: "Монгол орны хатуу уур амьсгалд тусгаарлалт хамгийн чухал хүчин зүйл. Гадна хана: 100–150мм EPS, дээвэр: 200мм минеральн хөвөн. Сайн тусгаарлалт нь барилгын дулааны алдагдлыг 50%–иар бууруулна." },
  // Ерөнхий асуулт
  { keys: ["сайн байна", "сайн уу", "hello", "hi", "сайхан"], ans: `Сайн байна уу! Би ${APP_NAME}-ийн AI туслагч. Эрчим хүч, барилга, цаг уур, Smart Home, таамаглал болон ямар ч сэдвээр асуулт тавьж болно. Юу мэдэхийг хүсэж байна вэ?` },
  { keys: ["баярлалаа", "thanks", "thank you", "танд баярлалаа"], ans: "Баярлалаа! Цааш ч бас асуух зүйл байвал чөлөөтэй асуугаарай. Таны эрчим хүчний асуудлыг шийдэхэд туслахад таатай байна." },
  { keys: ["чи хэн", "who are you", "танилцуулга", "намайг тань"], ans: `Би ${APP_NAME}-ийн AI туслагч. Барилгын эрчим хүчний хэрэглээ, цаг уур, HDD тооцоо, Smart Home болон эрчим хүч хэмнэх арга хэмжээний талаар мэдээлэл өгч, зөвлөгөө өгч чадна.` },
  { keys: ["улаанбаатар", "ulaanbaatar", "ub", "монгол", "mongolia"], ans: "Улаанбаатар хот нь дэлхийн хамгийн хүйтэн нийслэл — өвлийн дундаж −20°C, жилийн HDD 4500+. Энэ нь барилгын эрчим хүчний хэрэглээнд асар их нөлөөтэй. Хотын дулааны систем 1930-аад оноос хэрэгжиж ирсэн." },
  { keys: ["аqи", "aqi", "агаарын чанар", "air quality", "бохирдол"], ans: "Улаанбаатар хотын агаарын бохирдол өвөлдөө (11–3-р сар) дэлхийн хамгийн өндрийн нэг. AQI 200–300 хүрэх нь элбэг. Шалтгаан: гэрийн зуух дулаалах, тоосго, нүүрс шатаалт." },
  { keys: ["kwh", "киловатт", "кВт", "мегаватт", "мвт"], ans: "1 кВт·цаг (kWh) = 1 киловатт хүчний тоноглол 1 цаг ажилласан эрчим хүч. Монголын ердийн орон сууц жилд 5,000–15,000 кВт·цаг зарцуулдаг. Дундаж тарифф ≈ 100–120 төг/кВт·цаг." },
  { keys: ["random forest", "gradient boosting", "xgboost", "machine learning", "ml"], ans: "Бидний систем Random Forest болон Gradient Boosting (XGBoost) алгоритмуудыг ашигладаг. R² = 0.924 буюу барилгуудын хэрэглээний 92.4%-ийг зөв тайлбарлана. Хамгийн чухал feature: талбай, HDD, барилгасан он." },
  { keys: ["csv", "excel", "файл", "өгөгдөл оруулах", "import"], ans: "Өгөгдөл оруулах хуудаснаас CSV, Excel, JSON, PDF, Word болон бусад форматаар өгөгдөл оруулах боломжтой. Жинхэнэ өгөгдөл оруулах нь таамаглалын нарийвчлалыг улам дээшлүүлнэ." },
  { keys: ["dashboard", "хяналт", "статистик", "график"], ans: "Хяналтын самбар дээр өдөр, сар, жилийн эрчим хүчний хэрэглээний график, загварын үзүүлэлт (MAE, RMSE, R²), feature importance болон SHAP шинжилгээ харагдана." },
];

function getBotResponse(input, lang) {
  const lower = input.toLowerCase();
  // Exact keyword match
  for (const item of KB) {
    if (item.keys.some(k => lower.includes(k))) return item.ans;
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
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { from: "bot", text: lang === "mn"
      ? `Сайн байна уу! Би ${APP_NAME}-ийн AI туслагч. Эрчим хүч, цаг уур, барилга, Smart Home болон ямар ч сэдвээр асуугаарай! 💬`
      : `Hello! I'm the ${APP_NAME} AI assistant. Ask me anything about energy, weather, buildings, or Smart Home!` },
  ]);
  const [input, setInput] = useState("");
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
      ? `Шинэ яриа эхэллээ! Юу асуух вэ? 😊`
      : "New conversation started! What would you like to know?" }
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
              <button onClick={clearChat} className="chatbot-close" title={t.chatbot.clear}>
                <Trash2 size={15} />
              </button>
              <button onClick={() => setOpen(false)} className="chatbot-close">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="chatbot-messages">
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
              <button key={c} className="chip" onClick={() => { setInput(c); }}>
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
      >
        {open ? <X size={24} /> : <MessageCircle size={24} />}
        {!open && <span className="chatbot-pulse" />}
      </button>
    </div>
  );
}
