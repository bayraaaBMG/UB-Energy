import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { LanguageProvider } from "./contexts/LanguageContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { useAuth } from "./contexts/AuthContext";
import { DataProvider } from "./contexts/DataContext";
import { useLang } from "./contexts/LanguageContext";
import { SidebarProvider } from "./contexts/SidebarContext";
import Navbar from "./components/layout/Navbar";
import Sidebar from "./components/layout/Sidebar";
import Footer from "./components/layout/Footer";
import Chatbot from "./components/layout/Chatbot";
import ErrorBoundary from "./components/ErrorBoundary";

const HomePage              = lazy(() => import("./pages/HomePage"));
const LoginPage             = lazy(() => import("./pages/LoginPage"));
const PredictorPage         = lazy(() => import("./pages/PredictorPage"));
const DashboardPage         = lazy(() => import("./pages/DashboardPage"));
const DataInputPage         = lazy(() => import("./pages/DataInputPage"));
const DatabasePage          = lazy(() => import("./pages/DatabasePage"));
const AdminPage             = lazy(() => import("./pages/AdminPage"));
const AccessibilityPage     = lazy(() => import("./pages/AccessibilityPage"));
const RecommendationsPage   = lazy(() => import("./pages/RecommendationsPage"));
const MapPage               = lazy(() => import("./pages/MapPage"));
const WeatherPage           = lazy(() => import("./pages/WeatherPage"));
const OWIDPage              = lazy(() => import("./pages/OWIDPage"));
const ProfilePage           = lazy(() => import("./pages/ProfilePage"));
const MySpacePage           = lazy(() => import("./pages/MySpacePage"));
const BuildingDetailPage    = lazy(() => import("./pages/BuildingDetailPage"));
const VerifyEmailPage       = lazy(() => import("./pages/VerifyEmailPage"));
const ForgotSuccessPage     = lazy(() => import("./pages/ForgotSuccessPage"));
const ResetPasswordPage     = lazy(() => import("./pages/ResetPasswordPage"));
const EmailVerifiedPage     = lazy(() => import("./pages/EmailVerifiedPage"));

function ProtectedRoute({ children }) {
  const { user, authLoading } = useAuth();
  const location = useLocation();
  if (authLoading) return <PageLoader />;
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
    <div className="app-root">
      <a href="#main-content" className="skip-link">
        {lang === "mn" ? "Үндсэн агуулга руу шилжих" : "Skip to main content"}
      </a>

      {/* Top navbar */}
      <Navbar />

      <div className="app-body">
        {/* Left sidebar */}
        <Sidebar />

        {/* Page content — shifts right on desktop to make room for sidebar */}
        <main
          id="main-content"
          className="app-main"
          style={{ paddingTop: "clamp(0.5rem, 2vw, 1rem)", overflowX: "hidden" }}
        >
          <ErrorBoundary lang={lang}>
            <Suspense fallback={<PageLoader />}>
              {children}
            </Suspense>
          </ErrorBoundary>
          <Footer />
        </main>
      </div>

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
            <DataProvider>
              <SidebarProvider>
                <AppLayout>
                  <Routes>
                    {/* ── Public routes ── */}
                    <Route path="/" element={<HomePage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/weather" element={<WeatherPage />} />
                    <Route path="/predictor" element={<PredictorPage />} />
                    <Route path="/map" element={<MapPage />} />
                    <Route path="/owid" element={<OWIDPage />} />
                    <Route path="/recommendations" element={<RecommendationsPage />} />
                    <Route path="/accessibility" element={<AccessibilityPage />} />
                    <Route path="/building/:id" element={<BuildingDetailPage />} />
                    <Route path="/smart-home"      element={<Navigate to="/recommendations" replace />} />
                    <Route path="/verify-email"    element={<VerifyEmailPage />} />
                    <Route path="/forgot-success"  element={<ForgotSuccessPage />} />
                    <Route path="/reset-password"  element={<ResetPasswordPage />} />
                    <Route path="/email-verified"  element={<EmailVerifiedPage />} />

                    {/* ── Private routes ── */}
                    <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                    <Route path="/data-input" element={<ProtectedRoute><DataInputPage /></ProtectedRoute>} />
                    <Route path="/database" element={<ProtectedRoute><DatabasePage /></ProtectedRoute>} />
                    <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                    <Route path="/my-space" element={<ProtectedRoute><MySpacePage /></ProtectedRoute>} />
                    <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </AppLayout>
              </SidebarProvider>
            </DataProvider>
          </AuthProvider>
        </ThemeProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
