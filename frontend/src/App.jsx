import React from "react";
import Navbar from "./components/Navbar";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/useAuthStore";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";
import SignUpPage from "./pages/SignUpPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import { useEffect } from "react";
import {Loader} from "lucide-react";
import { Toaster } from "react-hot-toast";
import { useThemeStore } from "./store/useThemeStore";
const App = () => {
  const { authUser, checkAuth ,isCheckingAuth} = useAuthStore();
  const { theme, initializeTheme } = useThemeStore();
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);
  useEffect(() => {
    initializeTheme();
  }, [initializeTheme]);

  if (isCheckingAuth && !authUser)
    return (
    <div className="flex h-screen items-center justify-center bg-slate-950">
      <Loader className="size-10 animate-spin text-slate-100" />
    </div>
  );
  return (


    <div data-theme={theme} className="min-h-screen bg-base-100 text-base-content">
      <Navbar />
      <main className="px-0 py-0">
        <Routes>
          <Route path="/" element={authUser ?<HomePage />:<Navigate to="/login"/>} />
          <Route path="/signup" element={!authUser?<SignUpPage />:<Navigate to="/"/>} />
          <Route path="/login" element={!authUser?<LoginPage />:<Navigate to="/"/>} />
          <Route path="/forgot-password" element={!authUser?<ForgotPasswordPage />:<Navigate to="/"/>} />
          <Route path="/reset-password/:token" element={!authUser?<ResetPasswordPage />:<Navigate to="/"/>} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/profile" element={authUser ?<ProfilePage />:<Navigate to="/login"/>} />
        </Routes>
            <Toaster
              position="top-center"
              toastOptions={{
                style: {
                  background: "#0f172a",
                  color: "#e2e8f0",
                  border: "1px solid #334155",
                  fontSize: "16px",
                  padding: "14px 18px",
                  minWidth: "340px",
                  borderRadius: "10px",
                },
              }}
            />
      </main>
    </div>
  );
};

export default App;
