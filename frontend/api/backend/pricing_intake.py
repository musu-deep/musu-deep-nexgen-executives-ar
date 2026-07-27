from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, Request

from . import file_intelligence

EXECUTIVE_PRICING_ROLES = {"admin", "ceo"}
SOURCE_LABELS = {
    "file": "ملف خارجي",
    "project": "مشروع جارٍ",
    "task": "مهمة أو بند عمل",
    "manual": "بند تكلفة يدوي",
    "retrospective": "مراجعة لاحقة",
    "document": "مستند من الذاكرة المؤسسية",
}
REVIEW_MODE_LABELS = {
    "pre_award": "مراجعة قبل التقديم أو التعاقد",
    "active": "مراجعة أثناء التنفيذ",
    "retrospective": "مراجعة لاحقة بعد التنفيذ أو الالتزام",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _require_pricing_access(user: dict[str, Any]) -> None:
    if user.get("role") not in EXECUTIVE_PRICING_ROLES:
        raise HTTPException(status_code=403, detail="مركز التسعير مخصص للرئيس التنفيذي ومدير المنصة")


def _normalise_option_language(result: dict[str, Any]) -> dict[str, Any]:
    """Use institutional terminology throughout the pricing result."""
    normalised = dict(result)
    options = []
    for option in result.get("offer_options") or []:
        item = dict(option)
        if item.get("key") == "aggressive" or "هجومي" in str(item.get("name") or ""):
            item["key"] = "competitive"
            item["name"] = "عرض تنافسي"
            item["purpose"] = "تعزيز قابلية الفوز مع الحفاظ على الحد المالي الآمن"
        options.append(item)
    normalised["offer_options"] = options
    recommendation = str(normalised.get("recommendation") or "")
    recommendation = recommendation.replace("الباقة الهجومية", "الخيار التنافسي")
    recommendation = recommendation.replace("العرض الهجومي", "العرض التنافسي")
    recommendation = recommendation.replace("هجومي", "تنافسي")
    normalised["recommendation"] = recommendation
    return normalised


def institutional_pricing_analysis(*args: Any, **kwargs: Any) -> dict[str, Any]:
    return _normalise_option_language(file_intelligence.analyse_pricing_documents(*args, **kwargs))


def _flatten_snapshot(value: Any, prefix: str = "") -> list[str]:
    lines: list[str] = []
    if isinstance(value, dict):
        for key, item in value.items():
            if key in {"_id", "password_hash", "file_data_b64"}:
                continue
            label = f"{prefix}.{key}" if prefix else str(key)
            lines.extend(_flatten_snapshot(item, label))
    elif isinstance(value, list):
        for index, item in enumerate(value[:30]):
            lines.extend(_flatten_snapshot(item, f"{prefix}[{index}]"))
    elif value not in (None, ""):
        lines.append(f"{prefix}: {value}")
    return lines[:300]


def _intake_to_analysis_record(item: dict[str, Any]) -> dict[str, Any]:
    currency = str(item.get("currency") or "SAR")
    amount = float(item.get("amount") or 0)
    source_type = str(item.get("source_type") or "manual")
    review_mode = str(item.get("review_mode") or "active")
    text_lines = [
        f"المصدر: {SOURCE_LABELS.get(source_type, source_type)}",
        f"نوع المراجعة: {REVIEW_MODE_LABELS.get(review_mode, review_mode)}",
        f"العنوان: {item.get('title') or ''}",
        f"الوصف: {item.get('description') or ''}",
        f"الملاحظات: {item.get('notes') or ''}",
    ]
    if amount > 0:
        amount_label = "التكلفة الفعلية" if review_mode == "retrospective" else "التكلفة التقديرية"
        text_lines.append(f"{amount_label}: {amount} {currency}")
        text_lines.append(f"القيمة الإجمالية: {amount} {currency}")

    snapshot = item.get("source_snapshot") or {}
    for key in ("budget", "amount", "cost", "direct_cost", "estimated_cost", "actual_cost", "planned_cost"):
        raw = snapshot.get(key) if isinstance(snapshot, dict) else None
        try:
            numeric = float(raw or 0)
        except (TypeError, ValueError):
            numeric = 0
        if numeric > 0:
            label = "التكلفة" if "cost" in key else "الميزانية"
            text_lines.append(f"{label}: {numeric} {currency}")
    text_lines.extend(_flatten_snapshot(snapshot))
    return {
        "document_id": f"intake-{item.get('id')}",
        "filename": f"{SOURCE_LABELS.get(source_type, source_type)} — {item.get('title') or 'بند تسعير'}",
        "title": item.get("title") or "بند تسعير",
        "text": "\n".join(text_lines),
        "metadata": {"parser": "institutional-intake", "warning": "", "source_type": source_type},
    }


def register_pricing_intake_routes(app: Any, core: Any) -> None:
    existing = {getattr(route, "path", None) for route in app.router.routes}
    if "/api/pricing/intake" in existing:
        return

    initial_count = len(app.router.routes)

    @app.get("/api/pricing/intake")
    async def list_pricing_intake(request: Request):
        user = await core.get_current_user(request)
        _require_pricing_access(user)
        return await core.db.pricing_intake.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)

    @app.post("/api/pricing/intake")
    async def create_pricing_intake(request: Request):
        user = await core.get_current_user(request)
        payload = await request.json()
        title = str(payload.get("title") or "").strip()
        if not title:
            raise HTTPException(status_code=400, detail="عنوان بند المراجعة مطلوب")
        source_type = str(payload.get("source_type") or "manual")
        review_mode = str(payload.get("review_mode") or "active")
        if source_type not in SOURCE_LABELS:
            source_type = "manual"
        if review_mode not in REVIEW_MODE_LABELS:
            review_mode = "active"
        try:
            amount = float(payload.get("amount") or 0)
        except (TypeError, ValueError):
            amount = 0
        item = {
            "id": core.new_id(),
            "source_type": source_type,
            "source_label": SOURCE_LABELS[source_type],
            "source_id": str(payload.get("source_id") or ""),
            "title": title,
            "description": str(payload.get("description") or ""),
            "notes": str(payload.get("notes") or ""),
            "amount": amount,
            "currency": str(payload.get("currency") or "SAR"),
            "review_mode": review_mode,
            "review_mode_label": REVIEW_MODE_LABELS[review_mode],
            "source_snapshot": payload.get("source_snapshot") or {},
            "status": "بانتظار المراجعة",
            "priority": str(payload.get("priority") or "medium"),
            "referred_by": user.get("id"),
            "referred_by_name": user.get("name"),
            "referred_by_department": user.get("department") or "",
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        }
        await core.db.pricing_intake.insert_one(dict(item))
        await core.db.notifications.insert_one({
            "id": core.new_id(),
            "user_id": "vercel_usr_02",
            "type": "pricing_referral",
            "title": f"إحالة جديدة إلى مركز التسعير: {title}",
            "body": f"المصدر: {item['source_label']} • نوع المراجعة: {item['review_mode_label']}",
            "link": "/pricing-intelligence",
            "read": False,
            "created_at": _now_iso(),
        })
        return item

    @app.patch("/api/pricing/intake/{item_id}")
    async def update_pricing_intake(item_id: str, request: Request):
        user = await core.get_current_user(request)
        _require_pricing_access(user)
        payload = await request.json()
        allowed = {"status", "priority", "notes", "amount", "currency", "review_mode"}
        updates = {key: value for key, value in payload.items() if key in allowed}
        if "review_mode" in updates and updates["review_mode"] in REVIEW_MODE_LABELS:
            updates["review_mode_label"] = REVIEW_MODE_LABELS[updates["review_mode"]]
        updates["updated_at"] = _now_iso()
        await core.db.pricing_intake.update_one({"id": item_id}, {"$set": updates})
        item = await core.db.pricing_intake.find_one({"id": item_id}, {"_id": 0})
        if not item:
            raise HTTPException(status_code=404, detail="بند التسعير غير موجود")
        return item

    @app.delete("/api/pricing/intake/{item_id}")
    async def delete_pricing_intake(item_id: str, request: Request):
        user = await core.get_current_user(request)
        _require_pricing_access(user)
        await core.db.pricing_intake.delete_one({"id": item_id})
        return {"ok": True}

    @app.post("/api/pricing/analyse-sources")
    async def analyse_pricing_sources(request: Request):
        user = await core.get_current_user(request)
        _require_pricing_access(user)
        payload = await request.json()
        document_ids = [str(value) for value in payload.get("document_ids") or [] if value]
        intake_ids = [str(value) for value in payload.get("intake_ids") or [] if value]
        records: list[dict[str, Any]] = []

        for document_id in document_ids[:12]:
            document = await core.db.documents.find_one({"id": document_id}, {"_id": 0})
            stored = await core.db.document_files.find_one({"document_id": document_id}, {"_id": 0, "file_data_b64": 0})
            if document and stored:
                records.append({
                    "document_id": document_id,
                    "filename": stored.get("filename"),
                    "title": document.get("title"),
                    "text": stored.get("extracted_text") or "",
                    "metadata": stored.get("extraction") or {},
                })

        intake_items: list[dict[str, Any]] = []
        for intake_id in intake_ids[:30]:
            item = await core.db.pricing_intake.find_one({"id": intake_id}, {"_id": 0})
            if item:
                intake_items.append(item)
                records.append(_intake_to_analysis_record(item))

        if not records:
            raise HTTPException(status_code=400, detail="اختر ملفًا أو مشروعًا أو مهمة أو بند تكلفة واحدًا على الأقل")

        result = institutional_pricing_analysis(
            records,
            target_margin=float(payload.get("target_margin") or 18),
            overhead_rate=float(payload.get("overhead_rate") or 8),
            risk_rate=float(payload.get("risk_rate") or 6),
            win_strength=float(payload.get("win_strength") or 75),
        )
        modes = list(dict.fromkeys(item.get("review_mode") or "active" for item in intake_items))
        if "retrospective" in modes:
            result["recommendation"] = (
                f"{result.get('recommendation', '')} وتُستكمل المراجعة اللاحقة بمقارنة المعتمد أو المتعاقد عليه "
                "بالتكلفة الفعلية، وقياس الانحراف وأسبابه وقابلية تكراره في التسعيرات القادمة."
            ).strip()
        result["review_modes"] = modes
        result["source_summary"] = {
            "files": len(document_ids),
            "internal_items": len(intake_items),
            "projects": sum(1 for item in intake_items if item.get("source_type") == "project"),
            "tasks": sum(1 for item in intake_items if item.get("source_type") == "task"),
            "retrospective": sum(1 for item in intake_items if item.get("review_mode") == "retrospective"),
        }
        analysis_id = core.new_id()
        await core.db.pricing_analyses.insert_one({
            "id": analysis_id,
            "project_name": str(payload.get("project_name") or ""),
            "client": str(payload.get("client") or ""),
            "document_ids": document_ids,
            "intake_ids": intake_ids,
            "analysis": result,
            "created_by": user.get("id"),
            "created_by_name": user.get("name"),
            "created_at": _now_iso(),
        })
        if intake_ids:
            await core.db.pricing_intake.update_many(
                {"id": {"$in": intake_ids}},
                {"$set": {"status": "تم التحليل", "analysis_id": analysis_id, "updated_at": _now_iso()}},
            )
        result["id"] = analysis_id
        result["document_ids"] = document_ids
        result["intake_ids"] = intake_ids
        return result

    new_routes = app.router.routes[initial_count:]
    old_routes = app.router.routes[:initial_count]
    app.router.routes[:] = new_routes + old_routes
