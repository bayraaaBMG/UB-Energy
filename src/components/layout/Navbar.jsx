import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useLang } from "../../contexts/LanguageContext";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useSidebar } from "../../contexts/SidebarContext";
import { LogIn, LogOut, Globe, Menu, Sun, Moon, Zap, Search, X } from "lucide-react";
import "./Navbar.css";

function getSearchItems(t) {
  return [
    { path: "/",               label: t.nav.home },
    { path: "/predictor",      label: t.nav.predictor },
    { path: "/map",            label: t.nav.map },
    { path: "/weather",        label: t.nav.weather },
    { path: "/owid",           label: t.nav.owid },
    { path: "/recommendations",label: t.nav.recommendations },
    { path: "/dashboard",      label: t.nav.dashboard },
    { path: "/data-input",     label: t.nav.dataInput },
    { path: "/database",       label: t.nav.database },
    { path: "/my-space",       label: t.nav.mySpace },
    { path: "/profile",        label: t.nav.settingsLabel },
    { path: "/accessibility",  label: t.nav.help },
  ];
}

function SearchBox({ query, setQuery, showDrop, setShowDrop, filtered, onSelect, closeLabel, placeholder, inputRef, className }) {
  return (
    <div className={`navbar-search ${className ?? ""}`}>
      <Search size={15} className="ns-icon" aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        className="ns-input"
        placeholder={placeholder}
        value={query}
        onChange={e => { setQuery(e.target.value); setShowDrop(true); }}
        onFocus={() => setShowDrop(true)}
        onBlur={() => setTimeout(() => setShowDrop(false), 150)}
        aria-label={placeholder}
        autoComplete="off"
      />
      {query && (
        <button
          className="ns-clear"
          onClick={() => { setQuery(""); setShowDrop(false); }}
          aria-label={closeLabel}
          tabIndex={-1}
        >
          <X size={13} />
        </button>
      )}
      {showDrop && filtered.length > 0 && (
        <div className="ns-dropdown" role="listbox">
          {filtered.map(item => (
            <button
              key={item.path}
              className="ns-result"
              onMouseDown={() => onSelect(item.path)}
              role="option"
            >
              <Search size={12} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { t, toggleLang } = useLang();
  const { user, logout } = useAuth();
  const { toggleColorMode, isDark } = useTheme();
  const { toggle, open } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();

  const [query, setQuery]               = useState("");
  const [showDrop, setShowDrop]         = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const mobileInputRef = useRef(null);

  useEffect(() => {
    setMobileSearch(false);
    setQuery("");
    setShowDrop(false);
  }, [location.pathname]);

  const allItems = getSearchItems(t);
  const filtered = query
    ? allItems.filter(i => i.label.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
    : [];

  function goTo(path) {
    navigate(path);
    setQuery("");
    setMobileSearch(false);
    setShowDrop(false);
  }

  function openMobileSearch() {
    setMobileSearch(true);
    setTimeout(() => mobileInputRef.current?.focus(), 60);
  }

  function closeMobileSearch() {
    setMobileSearch(false);
    setQuery("");
    setShowDrop(false);
  }

  const searchProps = {
    query, setQuery, showDrop, setShowDrop,
    filtered, onSelect: goTo,
    closeLabel: t.common.close,
    placeholder: t.common.search,
  };

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

        {/* Desktop search — hidden on mobile via CSS */}
        <SearchBox {...searchProps} className="navbar-search-desktop" />

        {/* Spacer */}
        <div className="navbar-spacer" />

        {/* Actions */}
        <div className="navbar-actions">
          {/* Search icon — mobile only */}
          <button
            className="nb-icon-btn nb-search-mobile"
            onClick={openMobileSearch}
            aria-label={t.common.search}
          >
            <Search size={17} />
          </button>

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

      {/* Mobile search overlay */}
      {mobileSearch && (
        <div className="navbar-mobile-search" role="search">
          <button className="nb-icon-btn" onClick={closeMobileSearch} aria-label={t.common.close}>
            <X size={18} />
          </button>
          <SearchBox {...searchProps} inputRef={mobileInputRef} className="navbar-search-mobile-input" />
        </div>
      )}
    </nav>
  );
}
