import { Navigate, Route, Routes } from "react-router-dom";
import { RegisterPage } from "./pages/RegisterPage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { ShellPage } from "./pages/ShellPage.js";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/app" element={<ShellPage />} />
    </Routes>
  );
}
