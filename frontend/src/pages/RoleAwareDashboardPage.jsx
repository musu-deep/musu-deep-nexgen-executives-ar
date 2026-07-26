import React from "react";
import { useAuth } from "../contexts/AuthContext";
import HRExecutiveDashboard, { isHumanResourcesUser } from "../components/HRExecutiveDashboard";
import ExecutiveDashboardPage from "./ExecutiveDashboardPage";

export default function RoleAwareDashboardPage() {
  const { user } = useAuth();

  if (isHumanResourcesUser(user)) {
    return <HRExecutiveDashboard user={user} />;
  }

  return <ExecutiveDashboardPage />;
}
