from __future__ import annotations

import base64
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote

from fastapi import File, Form, HTTPException, Request, Response, UploadFile

from .file_intelligence import (
    MAX_FILE_BYTES,
    analyse_document_text,
    analyse_pricing_documents,
    extract_file_text,
)

ALLOWED_EXECUTIVE_ROLES = {"admin", "ceo", "vp_development", "vp_investment"}
ALLOWED_CATEGORIES = {
    "meeting_notes", "correspondence", "report", "memo", "presentation", "other",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _public_document(document: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in document.items() if key != "_id"}


def _require_opportunity_access(user: dict[str, Any]) -> None:
    if user.get("role") not in ALLOWED_EXECUTIVE_ROLES:
        raise HTTPException(status_code=403, detail="إدارة الفرص متاحة للقيادة التنفيذية وقطاعات التنمية والاستثمار")


def register_advanced_intelligence_routes(app: Any, core: Any) -> None:
    """Register upload and analysis routes before the mounted core application."""
    existing = {getattr(route, "path", None) for route in app.router.routes}
    if "/api/documents/upload" in existing:
        return

    initial_count = len(app.router.routes)

    @app.post("/api/documents/upload")
    async def upload_document(
        request: Request,
        file: UploadFile = File(...),
        title: str = Form(""),
        description: str = Form(""),
        category: str = Form("other"),
        purpose: str = Form("general"),
        reference_id: str = Form(""),
        project_id: str = Form(""),
        meeting_id: str = Form(""),
        is_public: bool = Form(False),
    ):
        user = await core.get_current_user(request)
        data = await file.read()
        await file.close()
        if len(data) > MAX_FILE_BYTES:
            raise HTTPException(status_code=413, detail="حجم الملف يتجاوز 4 ميجابايت")

        filename = file.filename or "uploaded-file"
        try:
            extracted = extract_file_text(filename, file.content_type or "application/octet-stream", data)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        document_id = core.new_id()
        safe_category = category if category in ALLOWED_CATEGORIES else "other"
        document_title = title.strip() or filename
        analysis = analyse_document_text(
            document_title,
            description,
            extracted["text"],
            purpose=purpose,
        )
        intelligence_id = core.new_id()
        document = {
            "id": document_id,
            "title": document_title,
            "description": description.strip() or analysis.get("summary", "")[:700],
            "category": safe_category,
            "url": f"/api/documents/{document_id}/download",
            "file_type": filename.rsplit(".", 1)[-1].upper() if "." in filename else "FILE",
            "file_name": filename,
            "content_type": file.content_type or "application/octet-stream",
            "size_bytes": len(data),
            "purpose": purpose,
            "reference_id": reference_id or None,
            "project_id": project_id or None,
            "meeting_id": meeting_id or None,
            "is_public": bool(is_public),
            "uploaded_by": user.get("id"),
            "uploaded_by_name": user.get("name"),
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
            "source": "platform-upload",
            "intelligence_status": "processed",
            "intelligence_id": intelligence_id,
            "intelligence": analysis,
            "extraction": extracted["metadata"],
        }
        await core.db.documents.insert_one(dict(document))
        await core.db.document_files.insert_one({
            "id": core.new_id(),
            "document_id": document_id,
            "filename": filename,
            "content_type": document["content_type"],
            "size_bytes": len(data),
            "file_data_b64": base64.b64encode(data).decode("ascii"),
            "extracted_text": extracted["text"],
            "extraction": extracted["metadata"],
            "created_at": _now_iso(),
        })
        await core.db.document_intelligence.insert_one({
            "id": intelligence_id,
            "document_id": document_id,
            "document_title": document_title,
            "uploaded_by": user.get("id"),
            "analysis": analysis,
            "created_at": _now_iso(),
        })
        return _public_document(document)

    @app.get("/api/documents/{document_id}/download")
    async def download_document(document_id: str, request: Request):
        user = await core.get_current_user(request)
        document = await core.db.documents.find_one({"id": document_id}, {"_id": 0})
        if not document:
            raise HTTPException(status_code=404, detail="الملف غير موجود")
        if user.get("role") not in {"admin", "ceo"} and not document.get("is_public") and document.get("uploaded_by") != user.get("id"):
            raise HTTPException(status_code=403, detail="غير مصرح بتنزيل هذا الملف")
        stored = await core.db.document_files.find_one({"document_id": document_id}, {"_id": 0})
        if not stored or not stored.get("file_data_b64"):
            raise HTTPException(status_code=404, detail="بيانات الملف غير متاحة")
        filename = stored.get("filename") or document.get("file_name") or "document"
        encoded_name = quote(filename)
        return Response(
            content=base64.b64decode(stored["file_data_b64"]),
            media_type=stored.get("content_type") or "application/octet-stream",
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_name}"},
        )

    @app.get("/api/opportunities")
    async def list_opportunities(request: Request):
        user = await core.get_current_user(request)
        _require_opportunity_access(user)
        query: dict[str, Any] = {}
        if user.get("role") not in {"admin", "ceo"}:
            query = {"$or": [{"created_by": user.get("id")}, {"owner_id": user.get("id")}, {"is_shared": True}]}
        return await core.db.opportunities.find(query, {"_id": 0}).sort("updated_at", -1).to_list(500)

    @app.post("/api/opportunities")
    async def create_opportunity(request: Request):
        user = await core.get_current_user(request)
        _require_opportunity_access(user)
        payload = await request.json()
        title = str(payload.get("title") or "").strip()
        if not title:
            raise HTTPException(status_code=400, detail="عنوان الفرصة مطلوب")
        now = _now_iso()
        document = {
            "id": core.new_id(),
            "title": title,
            "classification": str(payload.get("classification") or "فرصة استثمارية"),
            "city": str(payload.get("city") or ""),
            "district": str(payload.get("district") or ""),
            "objective": str(payload.get("objective") or ""),
            "askingPrice": float(payload.get("askingPrice") or 0),
            "status": str(payload.get("status") or "مسودة"),
            "stage": str(payload.get("stage") or "استقبال الفرصة"),
            "readiness": int(payload.get("readiness") or 15),
            "confidence": int(payload.get("confidence") or 10),
            "strategicFit": int(payload.get("strategicFit") or 50),
            "missingData": payload.get("missingData") or [
                "المستندات النظامية وحدود الأصل أو المخطط.",
                "سعر العرض وشروط التملك أو الشراكة.",
                "قاعدة مقارنة سوقية حديثة.",
                "التكلفة والجدول الزمني ونموذج التنفيذ.",
            ],
            "evidence": payload.get("evidence") or [],
            "scenarios": payload.get("scenarios") or [],
            "market": payload.get("market") or [],
            "stakeholders": payload.get("stakeholders") or [],
            "risks": payload.get("risks") or [],
            "attachments": payload.get("attachments") or [],
            "created_by": user.get("id"),
            "created_by_name": user.get("name"),
            "owner_id": payload.get("owner_id") or user.get("id"),
            "is_shared": bool(payload.get("is_shared", True)),
            "created_at": now,
            "updated_at": now,
        }
        await core.db.opportunities.insert_one(dict(document))
        return document

    @app.patch("/api/opportunities/{opportunity_id}")
    async def update_opportunity(opportunity_id: str, request: Request):
        user = await core.get_current_user(request)
        _require_opportunity_access(user)
        current = await core.db.opportunities.find_one({"id": opportunity_id}, {"_id": 0})
        if not current:
            raise HTTPException(status_code=404, detail="الفرصة غير موجودة")
        if user.get("role") not in {"admin", "ceo"} and current.get("created_by") != user.get("id") and current.get("owner_id") != user.get("id"):
            raise HTTPException(status_code=403, detail="غير مصرح بتعديل هذه الفرصة")
        payload = await request.json()
        allowed = {
            "title", "classification", "city", "district", "objective", "askingPrice",
            "status", "stage", "readiness", "confidence", "strategicFit", "missingData",
            "evidence", "scenarios", "market", "stakeholders", "risks", "attachments",
            "owner_id", "is_shared",
        }
        updates = {key: value for key, value in payload.items() if key in allowed}
        updates["updated_at"] = _now_iso()
        await core.db.opportunities.update_one({"id": opportunity_id}, {"$set": updates})
        return await core.db.opportunities.find_one({"id": opportunity_id}, {"_id": 0})

    @app.delete("/api/opportunities/{opportunity_id}")
    async def delete_opportunity(opportunity_id: str, request: Request):
        user = await core.get_current_user(request)
        _require_opportunity_access(user)
        current = await core.db.opportunities.find_one({"id": opportunity_id}, {"_id": 0})
        if not current:
            raise HTTPException(status_code=404, detail="الفرصة غير موجودة")
        if user.get("role") not in {"admin", "ceo"} and current.get("created_by") != user.get("id"):
            raise HTTPException(status_code=403, detail="غير مصرح بحذف هذه الفرصة")
        await core.db.opportunities.delete_one({"id": opportunity_id})
        return {"ok": True}

    @app.post("/api/pricing/analyse-documents")
    async def analyse_pricing(request: Request):
        user = await core.get_current_user(request)
        if user.get("role") not in {"admin", "ceo"}:
            raise HTTPException(status_code=403, detail="تحليل التسعير مخصص للرئيس التنفيذي ومدير المنصة")
        payload = await request.json()
        document_ids = [str(value) for value in payload.get("document_ids") or [] if value]
        if not document_ids:
            raise HTTPException(status_code=400, detail="ارفع ملفًا واحدًا على الأقل للتحليل")
        records: list[dict[str, Any]] = []
        for document_id in document_ids[:12]:
            document = await core.db.documents.find_one({"id": document_id}, {"_id": 0})
            stored = await core.db.document_files.find_one({"document_id": document_id}, {"_id": 0, "file_data_b64": 0})
            if not document or not stored:
                continue
            records.append({
                "document_id": document_id,
                "filename": stored.get("filename"),
                "title": document.get("title"),
                "text": stored.get("extracted_text") or "",
                "metadata": stored.get("extraction") or {},
            })
        if not records:
            raise HTTPException(status_code=400, detail="لم تتوفر نصوص قابلة للتحليل في الملفات المرفوعة")
        result = analyse_pricing_documents(
            records,
            target_margin=float(payload.get("target_margin") or 18),
            overhead_rate=float(payload.get("overhead_rate") or 8),
            risk_rate=float(payload.get("risk_rate") or 6),
            win_strength=float(payload.get("win_strength") or 75),
        )
        analysis_id = core.new_id()
        await core.db.pricing_analyses.insert_one({
            "id": analysis_id,
            "project_name": str(payload.get("project_name") or ""),
            "client": str(payload.get("client") or ""),
            "document_ids": document_ids,
            "analysis": result,
            "created_by": user.get("id"),
            "created_by_name": user.get("name"),
            "created_at": _now_iso(),
        })
        result["id"] = analysis_id
        result["document_ids"] = document_ids
        return result

    new_routes = app.router.routes[initial_count:]
    old_routes = app.router.routes[:initial_count]
    app.router.routes[:] = new_routes + old_routes
