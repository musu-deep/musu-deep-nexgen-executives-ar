"""Arabic-first entry point for NEXGEN EXECUTIVES.

This module keeps the original backend intact, overrides the AI endpoints that
produce user-facing prose, and delegates every other route to the core app.
Run with: uvicorn backend.arabic_server:app
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    from .server import (
        app as core_app,
        calc_rag,
        db,
        get_current_user,
        new_id,
        now_iso,
        role_sector_filter,
    )
    from .arak_extensions import (
        ExecutiveBriefInput,
        OrchestrateInput,
        _call_gemini,
        ai_agents as core_ai_agents,
        ai_orchestrate as core_ai_orchestrate,
        ai_workforce_status as core_workforce_status,
        daily_executive_report as core_daily_report,
        risk_radar as core_risk_radar,
    )
except ImportError:
    from server import (
        app as core_app,
        calc_rag,
        db,
        get_current_user,
        new_id,
        now_iso,
        role_sector_filter,
    )
    from arak_extensions import (
        ExecutiveBriefInput,
        OrchestrateInput,
        _call_gemini,
        ai_agents as core_ai_agents,
        ai_orchestrate as core_ai_orchestrate,
        ai_workforce_status as core_workforce_status,
        daily_executive_report as core_daily_report,
        risk_radar as core_risk_radar,
    )

app = FastAPI(
    title="NEXGEN EXECUTIVES — النسخة العربية",
    description="نظام التشغيل التنفيذي الذكي باللغة العربية",
)

origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "https://nexgen-executives.vercel.app,http://localhost:5173,http://localhost:3000",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

STATUS_AR = {
    "planning": "قيد التخطيط",
    "active": "نشط",
    "on_hold": "معلّق",
    "completed": "مكتمل",
    "cancelled": "ملغى",
    "pending": "قيد الانتظار",
    "in_progress": "قيد التنفيذ",
    "awaiting_approval": "بانتظار الاعتماد",
    "delayed": "متأخر",
    "scheduled": "مجدول",
    "rescheduled": "أعيدت جدولته",
    "approved": "معتمد",
    "rejected": "مرفوض",
}

PRIORITY_AR = {
    "low": "منخفضة",
    "medium": "متوسطة",
    "high": "مرتفعة",
    "critical": "حرجة",
}

SOURCE_AR = {
    "meeting": "اجتماع",
    "meeting_request": "طلب اجتماع",
    "project": "مشروع",
    "task": "مهمة",
    "daily": "موجز يومي",
    "dashboard": "لوحة القيادة",
    "free_text": "نص حر",
    "document": "مستند",
    "message": "رسالة",
    "voice": "أمر صوتي",
}

AGENT_TRANSLATIONS = {
    "Chief of Staff Agent": ("وكيل رئيس الديوان", "يتابع الأولويات والقرارات والتصعيدات التنفيذية ويقترح الإجراء الأفضل التالي."),
    "Project Intelligence Agent": ("وكيل ذكاء المشروعات", "يربط المشروعات والمهام والمخاطر والمستندات ومؤشرات التقدم والتنفيذ."),
    "Meeting Intelligence Agent": ("وكيل ذكاء الاجتماعات", "يحوّل الاجتماعات والطلبات إلى قرارات ومحاضر ومهام ومتابعات."),
    "Risk Monitoring Agent": ("وكيل مراقبة المخاطر", "يرصد التأخيرات والمؤشرات الحرجة والمهام المتعثرة وبطء اتخاذ القرار."),
    "Document Intelligence Agent": ("وكيل ذكاء المستندات", "يقرأ المستندات ويصنفها ويوجهها ويربطها بالمهام والمشروعات والاجتماعات والتنبيهات."),
    "Communication Agent": ("وكيل الاتصالات", "ينسق الاتصالات الداخلية والتوجيه والملخصات والردود والمتابعات."),
    "Task Agent": ("وكيل المهام", "يراقب المسؤوليات ومواعيد الاستحقاق وتغير الحالات والمهام المتعثرة."),
    "Reporting Agent": ("وكيل التقارير", "ينشئ التقارير التنفيذية والموجزات اليومية والملخصات الجاهزة لمجلس الإدارة."),
    "Executive Briefing Agent": ("وكيل الإحاطة التنفيذية", "يحوّل الضوضاء التشغيلية إلى إحاطات موجزة وجاهزة للرئيس التنفيذي."),
}

STATUS_TEXT_AR = {
    "Active": "نشط",
    "Monitoring": "قيد المراقبة",
    "Needs Attention": "يحتاج إلى انتباه",
    "operational": "يعمل بكفاءة",
}

LAST_ACTION_AR = {
    "Reviewed executive attention queue": "راجع قائمة الموضوعات التي تحتاج إلى انتباه تنفيذي",
    "Scanned active projects for blockers": "فحص المشروعات النشطة بحثًا عن المعوقات",
    "Checked pending meeting requests": "راجع طلبات الاجتماعات المعلقة",
    "Detected items requiring executive review": "رصد عناصر تتطلب مراجعة تنفيذية",
    "Processed incoming documents": "عالج المستندات الواردة",
    "Prepared communication follow-up suggestions": "أعد مقترحات متابعة الاتصالات",
    "Reviewed pending execution items": "راجع بنود التنفيذ المعلقة",
    "Prepared reporting signals": "أعد مؤشرات التقارير",
    "Updated executive briefing queue": "حدّث قائمة الإحاطات التنفيذية",
}


def _arabic_brief(source_type: str, item: dict[str, Any], text: str = "") -> dict[str, Any]:
    title = item.get("title") or item.get("subject") or item.get("name") or "بند تنفيذي"
    description = item.get("description") or text or "لم يُقدّم وصف تفصيلي لهذا البند."
    priority_key = item.get("priority") or item.get("urgency") or "medium"
    status_key = item.get("status") or "under_review"
    score = 1
    score += {"low": 0, "medium": 1, "high": 2, "critical": 3}.get(priority_key, 1)
    if status_key in ("delayed", "pending", "awaiting_approval"):
        score += 1
    if item.get("rag") == "red":
        score += 2
    risk_level = "حرج" if score >= 4 else "مرتفع" if score == 3 else "متوسط"
    decision = (
        "يتطلب اعتماد الرئيس التنفيذي"
        if source_type in ("meeting_request", "project") or status_key in ("pending", "awaiting_approval")
        else "يتطلب المتابعة والتحقق من التنفيذ"
    )

    return {
        "title": f"موجز تنفيذي: {title}",
        "executive_summary": [
            f"يحتاج «{title}» إلى انتباه تنفيذي لما قد يترتب عليه من أثر في التنفيذ أو المواءمة أو ثقة أصحاب المصلحة.",
            f"الحالة الحالية: {STATUS_AR.get(status_key, 'قيد المراجعة')}، والأولوية: {PRIORITY_AR.get(priority_key, 'متوسطة')}.",
            f"الخلاصة السياقية: {description[:320]}",
            "المسار الموصى به هو تحويل الموضوع إلى قرار واضح، ومسؤول محدد، وموعد نهائي، ونقطة متابعة موثقة.",
        ],
        "decisions_required": [
            decision,
            "تأكيد المسؤول المباشر عن التنفيذ",
            "تحديد موعد المراجعة التالية ومعيار الإغلاق",
        ],
        "risks": [
            {"level": risk_level, "risk": "بطء القرار قد يؤخر التنفيذ أو يخلق غموضًا في المسؤوليات."},
            {"level": "متوسط", "risk": "قد تبقى التبعيات المشتركة دون حسم في حال غياب التصعيد المنظم."},
            {"level": "متوسط", "risk": "عدم توثيق المتابعة قد يضعف المساءلة والذاكرة المؤسسية."},
        ],
        "recommended_actions": [
            "تعيين مسؤول واحد مباشر وقابل للمساءلة.",
            "تحويل النقاش إلى مهام قابلة للقياس ومحددة المواعيد.",
            "جدولة متابعة تنفيذية خلال 48 ساعة للمعوقات غير المحسومة.",
            "إرفاق المستندات والقرارات السابقة ذات الصلة لحفظ الذاكرة المؤسسية.",
        ],
        "strategic_impact": "يعزز الرؤية التنفيذية، ويقلل احتكاك المتابعة، ويربط العمليات اليومية بالقرارات الاستراتيجية.",
        "confidence": 0.93,
        "generated_by": "طبقة الذكاء التنفيذي العربية المهيأة لـ Gemini",
    }


def _translate_agent(agent: dict[str, Any]) -> dict[str, Any]:
    translated = dict(agent)
    original_name = agent.get("name", "")
    name, role = AGENT_TRANSLATIONS.get(original_name, (original_name, agent.get("role", "")))
    translated["name"] = name
    translated["role"] = role
    translated["status"] = STATUS_TEXT_AR.get(agent.get("status"), agent.get("status"))
    translated["last_action"] = LAST_ACTION_AR.get(agent.get("last_action"), agent.get("last_action"))
    return translated


def _translate_orchestration_value(value: Any) -> Any:
    if isinstance(value, list):
        return [_translate_orchestration_value(item) for item in value]
    if isinstance(value, dict):
        return {key: _translate_orchestration_value(item) for key, item in value.items()}
    if not isinstance(value, str):
        return value

    exact = {
        "AI Orchestration Layer": "طبقة تنسيق الذكاء الاصطناعي",
        "In-app notification generated": "تم إنشاء إشعار داخل المنصة",
        "Notification skipped": "تم تجاوز الإشعار",
        "Align stakeholders, assign owner, resolve blocker, and document decision.": "مواءمة أصحاب المصلحة وتعيين المسؤول وحل المعوق وتوثيق القرار.",
    }
    if value in exact:
        return exact[value]
    if value.startswith("AI follow-up: "):
        return "متابعة ذكية: " + value.removeprefix("AI follow-up: ")
    if value.startswith("AI review meeting: "):
        return "اجتماع مراجعة ذكي: " + value.removeprefix("AI review meeting: ")
    if value.startswith("Generated by AI Orchestration Layer from "):
        return "تم إنشاؤها بواسطة طبقة تنسيق الذكاء الاصطناعي من السياق التشغيلي. الإجراء التالي: تحديد المسؤول والموعد والمخاطر والقرار المطلوب."
    if value.startswith("AI Orchestration Layer analyzed "):
        return "حللت طبقة تنسيق الذكاء الاصطناعي السياق وأعدت أفضل الإجراءات التالية."
    return value


@app.post("/api/ai/executive-brief")
async def executive_brief_ar(payload: ExecutiveBriefInput, user=Depends(get_current_user)):
    item = payload.item or {}
    brief = _arabic_brief(payload.source_type, item, payload.text or "")
    prompt = f"""أنت مستشار تنفيذي عربي رفيع المستوى.
أنشئ موجزًا تنفيذيًا عربيًا فصيحًا ومكثفًا وجاهزًا للرئيس التنفيذي.
نوع المصدر: {SOURCE_AR.get(payload.source_type, payload.source_type)}
دور المستخدم: {user.get('role')}
بيانات البند: {json.dumps(item, ensure_ascii=False, default=str)}
النص الحر: {payload.text or ''}
اكتب بالعربية فقط، ونظّم الناتج إلى: الملخص التنفيذي، القرارات المطلوبة، المخاطر، الإجراءات الموصى بها، والأثر الاستراتيجي.
"""
    gemini_text = _call_gemini(prompt, system="أجب باللغة العربية فقط، وبأسلوب تنفيذي واضح ودقيق.")
    if gemini_text:
        brief["gemini_brief"] = gemini_text
        brief["generated_by"] = "Google Gemini — طبقة الذكاء التنفيذي العربية"
        brief["confidence"] = 0.97

    await db.executive_ai_memory.insert_one({
        "id": new_id(),
        "user_id": user["id"],
        "source_type": payload.source_type,
        "item": item,
        "brief": brief,
        "provider": brief.get("generated_by"),
        "language": "ar",
        "created_at": now_iso(),
    })
    return brief


@app.get("/api/reports/daily-executive")
async def daily_executive_report_ar(user=Depends(get_current_user)):
    report = await core_daily_report(user)
    metrics = report.get("metrics", {})
    context = (
        f"إجمالي المشروعات {metrics.get('total_projects', 0)}، منها {metrics.get('active_projects', 0)} نشط، "
        f"و{metrics.get('critical_projects', 0)} حرج، مع {metrics.get('overdue_tasks', 0)} مهمة متأخرة، "
        f"و{metrics.get('pending_requests', 0)} طلب اجتماع معلق. متوسط الإنجاز {metrics.get('avg_progress', 0)}%."
    )
    prompt = f"اكتب موجزًا يوميًا عربيًا موجزًا للرئيس التنفيذي يتضمن أهم ثلاث إجراءات بناءً على السياق التالي:\n{context}"
    gemini_summary = _call_gemini(prompt, system="أجب باللغة العربية فقط وبأسلوب تنفيذي مباشر.")
    report["ai_summary"] = gemini_summary or (
        f"موجز رئيس الديوان الذكي: يوجد {metrics.get('critical_projects', 0)} مشروع حرج، "
        f"و{metrics.get('overdue_tasks', 0)} مهمة متأخرة، و{metrics.get('pending_requests', 0)} طلب اجتماع يحتاج إلى قرار اليوم. "
        "التسلسل الموصى به: مراجعة المخاطر الحرجة، وحسم الطلبات المعلقة، ثم تعيين مسؤولين واضحين للمهام المتأخرة."
    )
    report["language"] = "ar"
    return report


@app.get("/api/ai/risk-radar")
async def risk_radar_ar(user=Depends(get_current_user)):
    payload = await core_risk_radar(user)
    for risk in payload.get("risks", []):
        risk["level"] = {"Critical": "حرج", "High": "مرتفع", "Medium": "متوسط"}.get(risk.get("level"), risk.get("level"))
        if risk.get("type") == "project":
            risk["type_label"] = "مشروع"
            risk["reason"] = "انخفاض الإنجاز أو ارتفاع الأولوية يستلزم مراجعة تنفيذية."
            risk["recommended_action"] = "مراجعة الرئيس التنفيذي وإزالة المعوقات خلال 48 ساعة."
        else:
            risk["type_label"] = "مهمة"
            risk["reason"] = "تأخر المهمة أو ارتفاع أولويتها قد يؤثر في مسار التنفيذ."
            risk["recommended_action"] = "إعادة تأكيد المسؤول والموعد وتصعيد التبعيات المؤثرة."
    payload["generated_by"] = "رادار المخاطر التنفيذي العربي"
    return payload


@app.get("/api/ai/chief-of-staff")
async def chief_of_staff_ar(user=Depends(get_current_user)):
    project_filter = role_sector_filter(user["role"]) or {}
    projects = await db.projects.find(project_filter, {"_id": 0}).to_list(500)
    tasks = await db.tasks.find(project_filter, {"_id": 0}).to_list(2000)
    pending_requests = (
        await db.meeting_requests.count_documents({"status": "pending"})
        if user["role"] in ("admin", "ceo", "tracker")
        else await db.meeting_requests.count_documents({"status": "pending", "requester_id": user["id"]})
    )
    for project in projects:
        project["rag"] = calc_rag(project)
    critical = [project for project in projects if project.get("rag") == "red" or project.get("priority") == "critical"]
    delayed = [task for task in tasks if task.get("status") == "delayed"]
    awaiting = [task for task in tasks if task.get("status") == "awaiting_approval"]
    return {
        "greeting": f"صباح الخير، {user.get('name', 'القائد التنفيذي')}",
        "headline": "تحتاج القرارات والمخاطر ومسارات التنفيذ المتأخرة إلى انتباهك التنفيذي.",
        "insights": [
            f"{len(critical)} من البنود الاستراتيجية تتطلب اطلاعًا تنفيذيًا مباشرًا.",
            f"{len(delayed)} من المهام متأخرة وقد تحتاج إلى تصعيد.",
            f"{len(awaiting)} من المهام تنتظر الاعتماد.",
            f"{pending_requests} من طلبات الاجتماعات تنتظر قرارًا.",
        ],
        "recommended_next_step": "ابدأ بالمخاطر الحرجة، ثم احسم الطلبات المعلقة، وأعد توجيه مسارات التنفيذ المتأخرة.",
        "confidence": 0.95,
        "language": "ar",
    }


@app.get("/api/ai/workforce-status")
async def workforce_status_ar(user=Depends(get_current_user)):
    payload = await core_workforce_status(user)
    payload["title"] = "حالة القوى العاملة الذكية"
    payload["status"] = "يعمل بكفاءة"
    payload["summary"] = "يراقب الوكلاء الأذكياء التدفق المؤسسي عبر المشروعات والمستندات والاجتماعات والمهام والاتصالات والمخاطر والتقارير التنفيذية."
    payload["agents"] = [_translate_agent(agent) for agent in payload.get("agents", [])]
    payload["language"] = "ar"
    return payload


@app.get("/api/ai/agents")
async def ai_agents_ar(user=Depends(get_current_user)):
    payload = await core_ai_agents(user)
    payload["agents"] = [_translate_agent(agent) for agent in payload.get("agents", [])]
    translated_activity = []
    for activity in payload.get("activity", []):
        item = dict(activity)
        agent_name = item.get("agent", "")
        item["agent"] = AGENT_TRANSLATIONS.get(agent_name, (agent_name, ""))[0]
        action = item.get("action", "")
        if action.startswith("Processed "):
            item["action"] = "عالج مستندًا وأنشأ توصيات للتوجيه المؤسسي."
        elif action == "Workspace monitored and ready for executive commands.":
            item["action"] = "تمت مراقبة مساحة العمل وهي جاهزة للأوامر التنفيذية."
        elif action == "Risk radar standing by for project and task signals.":
            item["action"] = "رادار المخاطر مستعد لالتقاط مؤشرات المشروعات والمهام."
        translated_activity.append(item)
    payload["activity"] = translated_activity
    payload["language"] = "ar"
    return payload


@app.post("/api/ai/orchestrate")
async def orchestrate_ar(payload: OrchestrateInput, user=Depends(get_current_user)):
    result = await core_ai_orchestrate(payload, user)
    result = _translate_orchestration_value(result)
    result["generated_by"] = "طبقة تنسيق الذكاء الاصطناعي العربية"
    result["language"] = "ar"
    return result


# All routes not overridden above remain available from the original application.
app.mount("/", core_app)
