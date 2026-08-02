import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { BriefcaseBusiness, UsersRound } from "lucide-react";
import HumanResourcesPage from "./HumanResourcesPage";
import RecruitmentPage from "./RecruitmentPage";

export default function HumanResourcesWorkspacePage() {
  const location = useLocation();
  const recruitment = /\/recruitment\/?$/.test(location.pathname);
  const base = location.pathname.startsWith("/hr") ? "/hr" : "/human-resources";

  return (
    <div dir="rtl" className="space-y-5">
      <div className="glass-card p-2 border-emerald-500/10 inline-flex gap-2 flex-wrap">
        <NavLink
          to={base}
          end
          className={({ isActive }) => `px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition ${isActive && !recruitment ? "bg-emerald-500/10 text-emerald-200 border border-emerald-500/20" : "text-slate-500 hover:bg-white/5 hover:text-slate-200 border border-transparent"}`}
        >
          <UsersRound size={17}/> القوى العاملة
        </NavLink>
        <NavLink
          to={`${base}/recruitment`}
          className={({ isActive }) => `px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition ${isActive ? "bg-yellow-500/10 text-yellow-200 border border-yellow-500/20" : "text-slate-500 hover:bg-white/5 hover:text-slate-200 border border-transparent"}`}
        >
          <BriefcaseBusiness size={17}/> التوظيف الذكي
        </NavLink>
      </div>
      {recruitment ? <RecruitmentPage /> : <HumanResourcesPage />}
    </div>
  );
}
