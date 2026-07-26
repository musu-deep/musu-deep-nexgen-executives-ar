import React from "react";
import { useAuth } from "../contexts/AuthContext";
import HRExecutiveDashboard, { isHumanResourcesUser } from "../components/HRExecutiveDashboard";
import PersonalExecutiveDashboard from "../components/PersonalExecutiveDashboard";
import ExecutiveDashboardPage from "./ExecutiveDashboardPage";
import { isFullAccessUser } from "../lib/accessPolicy";

export default function RoleAwareDashboardPage() {
  const { user } = useAuth();

  if (isFullAccessUser(user)) return <ExecutiveDashboardPage />;
  if (isHumanResourcesUser(user)) return <HRExecutiveDashboard user={user} />;
  return <PersonalExecutiveDashboard user={user} />;
}
