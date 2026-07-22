import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { Sun, Moon } from "lucide-react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import ExecutiveLoginPage from "./pages/ExecutiveLoginPage";
import ExecutiveDashboardPage from "./pages/ExecutiveDashboardPage";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import TasksPage from "./pages/TasksPage";
import ReportsPage from "./pages/ReportsPage";
import TeamPage from "./pages/TeamPage";
import AdminPage from "./pages/AdminPage";
import MeetingsPage from "./pages/MeetingsPage";
import MeetingRequestsPage from "./pages/MeetingRequestsPage";
import DocumentsPage from "./pages/DocumentsPage";
import CalendarPage from "./pages/CalendarPage";
import VoiceInputPage from "./pages/VoiceInputPage";
import MessagesPage from "./pages/MessagesPage";
import NotificationsPage from "./pages/NotificationsPage";
import SettingsPage from "./pages/SettingsPage";
import ExecutiveDailyBriefPage from "./pages/ExecutiveDailyBriefPage";
import AgentLoungePage from "./pages/AgentLoungePage";
import OfficeUnitPage from "./pages/OfficeUnitPage";
import QualityControlPage from "./pages/QualityControlPage";
import CameraMonitoringPage from "./pages/CameraMonitoringPage";
import AppLayout from "./components/AppLayout";
import ArabicLocalization from "./components/ArabicLocalization";
import "./App.css";
import "./araak-light.css";

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400" dir="rtl">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin mx-auto mb-3"></div>
          جارٍ التحقق من الجلسة الآمنة...
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

function LoginAppearanceToggle() {
  const location = useLocation();
  const { mode, toggleMode } = useTheme();
  if (location.pathname !== "/login") return null;

  return (
    <button
      type="button"
      onClick={toggleMode}
      className="theme-mode-toggle fixed top-5 left-5 z-[70] px-4 py-2.5 rounded-xl border border-white/10 bg-black/25 backdrop-blur-xl text-slate-200 flex items-center gap-2 text-sm font-bold shadow-xl"
      aria-label={mode === "light" ? "تشغيل الوضع الليلي" : "تشغيل الوضع النهاري"}
      title={mode === "light" ? "تشغيل الوضع الليلي" : "تشغيل الوضع النهاري"}
    >
      {mode === "light" ? <Sun size={17} className="text-yellow-500" /> : <Moon size={17} className="text-indigo-300" />}
      {mode === "light" ? "نهاري" : "ليلي"}
    </button>
  );
}

function PlatformToaster() {
  const { mode } = useTheme();
  return <Toaster position="top-center" theme={mode === "light" ? "light" : "dark"} richColors closeButton dir="rtl" />;
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <ArabicLocalization />
      <LoginAppearanceToggle />
      <Routes>
        <Route path="/login" element={<PublicOnly><ExecutiveLoginPage /></PublicOnly>} />
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<ExecutiveDashboardPage />} />
          <Route path="/daily-report" element={<ExecutiveDailyBriefPage />} />
          <Route path="/camera-monitoring" element={<CameraMonitoringPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/executive-secretariat" element={<OfficeUnitPage unit="secretariat" />} />
          <Route path="/legal-affairs" element={<OfficeUnitPage unit="legal" />} />
          <Route path="/presidential-advisor" element={<ProtectedRoute roles={["admin", "ceo"]}><OfficeUnitPage unit="advisor" /></ProtectedRoute>} />
          <Route path="/human-resources" element={<OfficeUnitPage unit="hr" />} />
          <Route path="/quality-control" element={<QualityControlPage />} />
          <Route path="/meetings" element={<MeetingsPage />} />
          <Route path="/meeting-requests" element={<MeetingRequestsPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/voice" element={<ProtectedRoute roles={["ceo", "admin"]}><VoiceInputPage /></ProtectedRoute>} />
          <Route path="/ai-lounge" element={<AgentLoungePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/admin" element={<ProtectedRoute roles={["admin"]}><AdminPage /></ProtectedRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <div className="App" dir="rtl">
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <AppRoutes />
            <PlatformToaster />
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </div>
  );
}

export default App;