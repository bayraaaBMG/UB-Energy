import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "./contexts/LanguageContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
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
import SmartHomePage from "./pages/SmartHomePage";
import OWIDPage from "./pages/OWIDPage";

function AppLayout({ children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Navbar />
      <main style={{ flex: 1, paddingTop: "1rem" }}>
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
                <Route path="/predictor" element={<PredictorPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/data-input" element={<DataInputPage />} />
                <Route path="/database" element={<DatabasePage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/accessibility" element={<AccessibilityPage />} />
                <Route path="/recommendations" element={<RecommendationsPage />} />
                <Route path="/map" element={<MapPage />} />
                <Route path="/weather" element={<WeatherPage />} />
                <Route path="/smart-home" element={<SmartHomePage />} />
                <Route path="/owid" element={<OWIDPage />} />
              </Routes>
            </AppLayout>
          </AuthProvider>
        </ThemeProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
