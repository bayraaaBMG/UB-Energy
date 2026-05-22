import { Link } from "react-router-dom";
import { useLang } from "../../contexts/LanguageContext";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useSidebar } from "../../contexts/SidebarContext";
import { LogIn, LogOut, Globe, Menu, Sun, Moon, Zap, User } from "lucide-react";
import "./Navbar.css";

export default function Navbar() {
  const { t, toggleLang } = useLang();
  const { user, logout } = useAuth();
  const { toggleColorMode, isDark } = useTheme();
  const { toggle, open } = useSidebar();

  return (
    <nav className="navbar" aria-label="Top bar">
      <div className="navbar-inner">
        {/* Hamburger */}
        <button
          className="navbar-hamburger"
          onClick={toggle}
          aria-label={open ? t.common.close : "Цэс нээх"}
          aria-expanded={open}
          aria-controls="main-sidebar"
        >
          <Menu size={20} />
        </button>

        {/* Logo */}
        <Link to="/" className="navbar-brand">
          <Zap size={20} className="brand-icon" aria-hidden="true" />
          <span className="brand-text">
            <span className="brand-main">UB</span>
            <span className="brand-sub">Energy</span>
          </span>
        </Link>

        {/* Spacer */}
        <div className="navbar-spacer" />

        {/* Controls */}
        <div className="navbar-actions">
          <button
            className="nb-icon-btn"
            onClick={toggleColorMode}
            title={isDark ? "Light mode" : "Dark mode"}
            aria-label={isDark ? "Light mode руу солих" : "Dark mode руу солих"}
          >
            {isDark ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          <button className="nb-icon-btn nb-lang-btn" onClick={toggleLang} title="Хэл солих">
            <Globe size={17} />
            <span className="nb-lang-label">{t.common.lang_switch}</span>
          </button>

          {user ? (
            <>
              <Link to="/profile" className="nb-avatar" title={t.nav.profile} aria-label={t.nav.profile}>
                {user.avatar
                  ? <img src={user.avatar} alt={user.name} />
                  : <span>{user.name.charAt(0).toUpperCase()}</span>
                }
              </Link>
              <button
                className="nb-icon-btn nb-logout"
                onClick={logout}
                title={t.nav.logout}
                aria-label={t.nav.logout}
              >
                <LogOut size={17} />
                <span className="nb-logout-label">{t.nav.logout}</span>
              </button>
            </>
          ) : (
            <Link to="/login" className="btn btn-primary nb-login-btn">
              <LogIn size={16} />
              <span>{t.nav.login}</span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
