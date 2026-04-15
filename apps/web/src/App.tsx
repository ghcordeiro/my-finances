import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./layout/AppLayout.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { OrganizationSettingsPage } from "./pages/OrganizationSettingsPage.js";
import { RegisterPage } from "./pages/RegisterPage.js";
import { WorkspaceAccountsPage } from "./pages/WorkspaceAccountsPage.js";
import { WorkspaceTransfersPage } from "./pages/WorkspaceTransfersPage.js";
import { WorkspacesPage } from "./pages/WorkspacesPage.js";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/app" element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="workspaces" element={<WorkspacesPage />} />
        <Route path="workspaces/:workspaceId/accounts" element={<WorkspaceAccountsPage />} />
        <Route path="workspaces/:workspaceId/transfers" element={<WorkspaceTransfersPage />} />
        <Route path="organization" element={<OrganizationSettingsPage />} />
      </Route>
    </Routes>
  );
}
