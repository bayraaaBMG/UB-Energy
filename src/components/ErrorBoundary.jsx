import { Component } from "react";
import mn from "../i18n/mn";
import en from "../i18n/en";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const t = (this.props.lang === "en" ? en : mn).error;
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", minHeight: "50vh", gap: "1rem",
        padding: "2rem", textAlign: "center",
      }} role="alert">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
          stroke="var(--danger, #e63946)" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <h2 style={{ color: "var(--danger, #e63946)", margin: 0 }}>{t.title}</h2>
        <p style={{ color: "var(--text2)", maxWidth: 400, margin: 0, fontSize: "0.9rem" }}>
          {t.message}
        </p>
        {this.state.error && (
          <pre style={{ maxWidth: 600, overflowX: "auto", background: "#1a1a2e", color: "#ff6b6b", padding: "1rem", borderRadius: 8, fontSize: "0.75rem", textAlign: "left", marginTop: "0.5rem" }}>
            {String(this.state.error)}
          </pre>
        )}
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          {t.refresh}
        </button>
      </div>
    );
  }
}
