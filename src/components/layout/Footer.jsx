import { Zap } from "lucide-react";
import { useLang } from "../../contexts/LanguageContext";
import { APP_NAME, APP_YEAR } from "../../config/constants";
import "./Footer.css";

export default function Footer() {
  const { t } = useLang();
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-inner">
          <div className="footer-brand">
            <Zap size={18} className="footer-icon" />
            <span className="footer-title">{APP_NAME}</span>
          </div>
          <p className="footer-text">{t.common.tagline}</p>
          <p className="footer-copy">© {APP_YEAR} {APP_NAME}. {t.common.rights}</p>
        </div>
      </div>
    </footer>
  );
}
