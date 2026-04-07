import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { LanguageProvider } from "./contexts/LanguageContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { useAuth } from "./contexts/AuthContext";
import { useLang } from "./contexts/LanguageContext";
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import Chatbot from "./components/layout/Chatbot";
import ErrorBoundary from "./components/ErrorBoundary";

const HomePage           = lazy(() => import("./pages/HomePage"));
const LoginPage          = lazy(() => import("./pages/LoginPage"));
const PredictorPage      = lazy(() => import("./pages/PredictorPage"));
const DashboardPage      = lazy(() => import("./pages/DashboardPage"));
const DataInputPage      = lazy(() => import("./pages/DataInputPage"));
const DatabasePage       = lazy(() => import("./pages/DatabasePage"));
const AdminPage          = lazy(() => import("./pages/AdminPage"));
const AccessibilityPage  = lazy(() => import("./pages/AccessibilityPage"));
const RecommendationsPage = lazy(() => import("./pages/RecommendationsPage"));
const MapPage            = lazy(() => import("./pages/MapPage"));
const WeatherPage        = lazy(() => import("./pages/WeatherPage"));
const OWIDPage           = lazy(() => import("./pages/OWIDPage"));

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
}

function PageLoader() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "40vh" }}>
      <div className="wl-spinner" />
    </div>
  );
}

function AppLayout({ children }) {
  const { lang } = useLang();
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <a href="#main-content" className="skip-link">
        {lang === "mn" ? "Үндсэн агуулга руу орох" : "Skip to main content"}
      </a>
      <Navbar />
      <main id="main-content" style={{ flex: 1, paddingTop: "1rem" }}>
        <ErrorBoundary lang={lang}>
          <Suspense fallback={<PageLoader />}>
            {children}
          </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
      <Chatbot />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppLayout>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/predictor" element={<ProtectedRoute><PredictorPage /></ProtectedRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                <Route path="/data-input" element={<ProtectedRoute><DataInputPage /></ProtectedRoute>} />
                <Route path="/database" element={<ProtectedRoute><DatabasePage /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
                <Route path="/accessibility" element={<ProtectedRoute><AccessibilityPage /></ProtectedRoute>} />
                <Route path="/recommendations" element={<ProtectedRoute><RecommendationsPage /></ProtectedRoute>} />
                <Route path="/map" element={<ProtectedRoute><MapPage /></ProtectedRoute>} />
                <Route path="/weather" element={<ProtectedRoute><WeatherPage /></ProtectedRoute>} />
                <Route path="/smart-home" element={<Navigate to="/recommendations" replace />} />
                <Route path="/owid" element={<ProtectedRoute><OWIDPage /></ProtectedRoute>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppLayout>
          </AuthProvider>
        </ThemeProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
