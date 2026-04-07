import { Component } from "react";

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

    const { lang = "mn" } = this.props;
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
        <h2 style={{ color: "var(--danger, #e63946)", margin: 0 }}>
          {lang === "mn" ? "Алдаа гарлаа" : "Something went wrong"}
        </h2>
        <p style={{ color: "var(--text2)", maxWidth: 400, margin: 0, fontSize: "0.9rem" }}>
          {lang === "mn"
            ? "Энэ хуудсыг ачааллахад алдаа гарлаа. Хуудсыг дахин ачааллана уу."
            : "This page failed to load. Please refresh the page to try again."}
        </p>
        <button
          className="btn btn-primary"
          onClick={() => window.location.reload()}
        >
          {lang === "mn" ? "Дахин ачааллах" : "Refresh page"}
        </button>
      </div>
    );
  }
}
