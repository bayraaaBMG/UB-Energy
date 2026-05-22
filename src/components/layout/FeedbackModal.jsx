import { useState } from "react";
import { X, Star, Send, CheckCircle, MessageSquare } from "lucide-react";
import "./FeedbackModal.css";

const CATEGORIES = [
  { value: "bug",        label: "🐛  Алдааны мэдэгдэл" },
  { value: "suggestion", label: "💡  Санал дэвшүүлэх" },
  { value: "compliment", label: "⭐  Магтаал" },
  { value: "other",      label: "💬  Бусад" },
];

export default function FeedbackModal({ open, onClose, user }) {
  const [rating, setRating]       = useState(0);
  const [hovered, setHovered]     = useState(0);
  const [category, setCategory]   = useState("suggestion");
  const [name, setName]           = useState(user?.name ?? "");
  const [message, setMessage]     = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (!open) return null;

  function handleSubmit(e) {
    e.preventDefault();
    if (!message.trim()) return;

    const subject = encodeURIComponent(`[UB Energy] Санал хүсэлт — ${CATEGORIES.find(c => c.value === category)?.label.replace(/^.{3}/, "").trim()}`);
    const body = encodeURIComponent(
      [
        `Нэр: ${name || "—"}`,
        `Үнэлгээ: ${"★".repeat(rating) + "☆".repeat(5 - rating)} (${rating}/5)`,
        `Төрөл: ${CATEGORIES.find(c => c.value === category)?.label.replace(/^.{3}/, "").trim()}`,
        "",
        "Санал хүсэлт:",
        message.trim(),
        "",
        "— UB Energy хэрэглэгч",
      ].join("\n")
    );

    window.open(`mailto:bbayraaa20@gmail.com?subject=${subject}&body=${body}`, "_blank");
    setSubmitted(true);
  }

  function handleClose() {
    onClose();
    // Reset after close animation
    setTimeout(() => {
      setRating(0);
      setHovered(0);
      setCategory("suggestion");
      setName(user?.name ?? "");
      setMessage("");
      setSubmitted(false);
    }, 300);
  }

  return (
    <div className="fb-backdrop" onClick={handleClose} role="dialog" aria-modal="true" aria-label="Санал хүсэлт">
      <div className="fb-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="fb-header">
          <div className="fb-title-row">
            <MessageSquare size={18} className="fb-title-icon" aria-hidden="true" />
            <h2 className="fb-title">Санал хүсэлт</h2>
          </div>
          <button className="fb-close" onClick={handleClose} aria-label="Хаах">
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          /* Success state */
          <div className="fb-success">
            <CheckCircle size={48} className="fb-success-icon" aria-hidden="true" />
            <h3>Баярлалаа!</h3>
            <p>Таны санал хүсэлтийг хүлээн авлаа. Email клиент нээгдсэн бол илгээнэ үү.</p>
            <button className="btn btn-primary" onClick={handleClose}>Хаах</button>
          </div>
        ) : (
          /* Form */
          <form className="fb-form" onSubmit={handleSubmit} noValidate>

            {/* Stars */}
            <div className="fb-field">
              <label className="fb-label">Үнэлгээ</label>
              <div className="fb-stars" role="radiogroup" aria-label="Үнэлгээ">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={rating === n}
                    aria-label={`${n} од`}
                    className={`fb-star ${n <= (hovered || rating) ? "filled" : ""}`}
                    onClick={() => setRating(n)}
                    onMouseEnter={() => setHovered(n)}
                    onMouseLeave={() => setHovered(0)}
                  >
                    <Star size={24} />
                  </button>
                ))}
                {rating > 0 && (
                  <span className="fb-star-label">
                    {["", "Маш муу", "Муу", "Дунд", "Сайн", "Маш сайн"][rating]}
                  </span>
                )}
              </div>
            </div>

            {/* Category */}
            <div className="fb-field">
              <label className="fb-label" htmlFor="fb-category">Төрөл</label>
              <select
                id="fb-category"
                className="fb-select"
                value={category}
                onChange={e => setCategory(e.target.value)}
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Name */}
            <div className="fb-field">
              <label className="fb-label" htmlFor="fb-name">Нэр <span className="fb-optional">(заавал биш)</span></label>
              <input
                id="fb-name"
                type="text"
                className="fb-input"
                placeholder="Таны нэр"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={80}
              />
            </div>

            {/* Message */}
            <div className="fb-field">
              <label className="fb-label" htmlFor="fb-message">
                Санал хүсэлт <span className="fb-required">*</span>
              </label>
              <textarea
                id="fb-message"
                className="fb-textarea"
                placeholder="Таны санал, мэдэгдэл, асуулт..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={4}
                maxLength={1000}
                required
              />
              <span className="fb-char-count">{message.length}/1000</span>
            </div>

            <div className="fb-actions">
              <button type="button" className="btn btn-secondary" onClick={handleClose}>Цуцлах</button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!message.trim()}
              >
                <Send size={15} aria-hidden="true" />
                Илгээх
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
