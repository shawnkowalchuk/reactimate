import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import "./store/themeStore"; // side-effect: apply persisted theme before first paint
import { HomePage } from "./pages/HomePage";
import { EditorPage } from "./pages/EditorPage";
import { FeedbackPage } from "./pages/FeedbackPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { AdminUsers } from "./pages/admin/AdminUsers";
import { AdminFeedback } from "./pages/admin/AdminFeedback";
import { AdminFeedbackDetail } from "./pages/admin/AdminFeedbackDetail";
import { AuthGate } from "./auth/AuthGate";
import { AdminGate } from "./auth/AdminGate";
import { AdminSync } from "./auth/AdminSync";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AdminSync />
      <Analytics />
      <SpeedInsights />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/feedback" element={<FeedbackPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route
          path="/app"
          element={
            <AuthGate>
              <EditorPage />
            </AuthGate>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminGate>
              <AdminDashboard />
            </AdminGate>
          }
        />
        <Route
          path="/admin/users"
          element={
            <AdminGate>
              <AdminUsers />
            </AdminGate>
          }
        />
        <Route
          path="/admin/feedback"
          element={
            <AdminGate>
              <AdminFeedback />
            </AdminGate>
          }
        />
        <Route
          path="/admin/feedback/:id"
          element={
            <AdminGate>
              <AdminFeedbackDetail />
            </AdminGate>
          }
        />
        <Route path="*" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
