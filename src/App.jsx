import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { LanguageProvider } from "./contexts/LanguageContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { useAuth } from "./contexts/AuthContext";
import { useLang } from "./contexts/LanguageContext";
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import Chatbot from "./components/layout/Chatbot";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import PredictorPage from "./pages/PredictorPage";
import DashboardPage from "./pages/DashboardPage";
import DataInputPage from "./pages/DataInputPage";
import DatabasePage from "./pages/DatabasePage";
import AdminPage from "./pages/AdminPage";
import AccessibilityPage from "./pages/AccessibilityPage";
import RecommendationsPage from "./pages/RecommendationsPage";
import MapPage from "./pages/MapPage";
import WeatherPage from "./pages/WeatherPage";
import OWIDPage from "./pages/OWIDPage";

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
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
        {children}
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
