"""Version-aware Odoo connector for NEXGEN EXECUTIVES.

Supports Odoo 19 JSON-2 and legacy XML-RPC for Odoo 14-18.
The integration is read-only by default and maps Odoo projects/tasks to the
platform's existing operational schema.
"""
from __future__ import annotations

import asyncio
import html
import json
import os
import re
import xmlrpc.client
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any, Iterable

import requests

VALID_SECTORS = {
    "development",
    "investment",
    "arak_development",
    "academy",
    "digital",
    "corporate",
}

PROJECT_BASE_FIELDS = [
    "id", "name", "description", "active", "company_id", "user_id",
    "date_start", "date", "stage_id", "tag_ids", "task_count",
    "closed_task_count", "allocated_hours", "effective_hours",
    "write_date", "create_date",
]

TASK_BASE_FIELDS = [
    "id", "name", "description", "active", "project_id", "company_id",
    "user_ids", "date_deadline", "stage_id", "priority", "kanban_state",
    "planned_hours", "effective_hours", "write_date", "create_date",
]


class OdooConnectorError(RuntimeError):
    """Raised when Odoo cannot be reached or returns an invalid response."""


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_json(name: str, default: Any) -> Any:
    raw = os.getenv(name)
    if not raw:
        return default
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return default


def _normalise_url(value: str) -> str:
    return value.strip().rstrip("/")


def _many2one_id(value: Any) -> Any:
    if isinstance(value, (list, tuple)) and value:
        return value[0]
    return value if isinstance(value, int) else None


def _many2one_name(value: Any) -> str:
    if isinstance(value, (list, tuple)) and len(value) > 1:
        return str(value[1] or "")
    if isinstance(value, str):
        return value
    return ""


def _plain_text(value: Any) -> str:
    text = str(value or "")
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def _as_number(value: Any, default: float = 0.0) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return default


def _date_is_overdue(value: Any) -> bool:
    if not value:
        return False
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed < datetime.now(timezone.utc)
    except (TypeError, ValueError):
        return False


@dataclass(frozen=True)
class OdooConfig:
    enabled: bool
    url: str
    database: str
    username: str
    api_key: str
    protocol: str
    timeout: int
    read_only: bool
    default_sector: str
    sector_map: dict[str, str]
    project_domain: list[Any]
    task_domain: list[Any]
    project_budget_field: str
    project_sector_field: str
    project_progress_field: str
    task_sector_field: str
    task_progress_field: str

    @classmethod
    def from_env(cls) -> "OdooConfig":
        default_sector = os.getenv("ODOO_DEFAULT_SECTOR", "corporate").strip()
        if default_sector not in VALID_SECTORS:
            default_sector = "corporate"
        sector_map = {
            str(key).strip().lower(): str(value).strip()
            for key, value in _env_json("ODOO_SECTOR_MAP_JSON", {}).items()
            if str(value).strip() in VALID_SECTORS
        }
        protocol = os.getenv("ODOO_PROTOCOL", "auto").strip().lower()
        if protocol not in {"auto", "json2", "xmlrpc"}:
            protocol = "auto"
        return cls(
            enabled=_env_bool("ODOO_ENABLED", False),
            url=_normalise_url(os.getenv("ODOO_URL", "")),
            database=os.getenv("ODOO_DATABASE", "").strip(),
            username=os.getenv("ODOO_USERNAME", "").strip(),
            api_key=os.getenv("ODOO_API_KEY", "").strip(),
            protocol=protocol,
            timeout=max(3, int(os.getenv("ODOO_TIMEOUT", "20"))),
            read_only=_env_bool("ODOO_READ_ONLY", True),
            default_sector=default_sector,
            sector_map=sector_map,
            project_domain=_env_json("ODOO_PROJECT_DOMAIN", []),
            task_domain=_env_json("ODOO_TASK_DOMAIN", []),
            project_budget_field=os.getenv("ODOO_PROJECT_BUDGET_FIELD", "").strip(),
            project_sector_field=os.getenv("ODOO_PROJECT_SECTOR_FIELD", "").strip(),
            project_progress_field=os.getenv("ODOO_PROJECT_PROGRESS_FIELD", "progress").strip(),
            task_sector_field=os.getenv("ODOO_TASK_SECTOR_FIELD", "").strip(),
            task_progress_field=os.getenv("ODOO_TASK_PROGRESS_FIELD", "progress").strip(),
        )

    @property
    def configured(self) -> bool:
        if not self.enabled or not self.url or not self.api_key:
            return False
        if self.protocol == "xmlrpc":
            return bool(self.database and self.username)
        return True

    def public_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data.pop("api_key", None)
        data["configured"] = self.configured
        data["has_api_key"] = bool(self.api_key)
        return data


class OdooConnector:
    def __init__(self, config: OdooConfig | None = None):
        self.config = config or OdooConfig.from_env()
        self._field_cache: dict[str, set[str]] = {}
        self._version_cache: dict[str, Any] | None = None
        self._uid: int | None = None

    async def version(self, refresh: bool = False) -> dict[str, Any]:
        if self._version_cache is not None and not refresh:
            return self._version_cache
        self._require_configured()
        self._version_cache = await asyncio.to_thread(self._version_sync)
        return self._version_cache

    async def status(self, check: bool = False) -> dict[str, Any]:
        result = {
            "provider": "odoo",
            "operational_source": os.getenv("OPERATIONAL_DATA_SOURCE", "mongo").strip().lower(),
            **self.config.public_dict(),
            "connected": False,
            "resolved_protocol": None,
            "version": None,
            "message": "بيئة Odoo غير مفعلة أو لم تكتمل إعداداتها.",
        }
        if not self.config.configured:
            return result
        if not check:
            result["message"] = "إعدادات Odoo مكتملة؛ استخدم اختبار الاتصال للتحقق الفعلي."
            return result
        try:
            version = await self.version(refresh=True)
            protocol = await asyncio.to_thread(self._resolve_working_protocol_sync)
            result.update(
                connected=True,
                resolved_protocol=protocol,
                version=version.get("version") or version.get("server_version"),
                version_info=version.get("version_info") or version.get("server_version_info"),
                message="تم الاتصال ببيئة Odoo بنجاح.",
            )
        except Exception as exc:
            result["message"] = f"تعذر الاتصال بـ Odoo: {str(exc)[:240]}"
        return result

    async def projects(self, limit: int = 500) -> list[dict[str, Any]]:
        fields = list(PROJECT_BASE_FIELDS)
        fields.extend(field for field in [
            self.config.project_budget_field,
            self.config.project_sector_field,
            self.config.project_progress_field,
        ] if field)
        records = await self._compatible_search_read(
            "project.project", self.config.project_domain, fields, limit,
            "write_date desc, id desc",
        )
        return [self._map_project(record) for record in records]

    async def tasks(self, limit: int = 1500) -> list[dict[str, Any]]:
        fields = list(TASK_BASE_FIELDS)
        fields.extend(field for field in [
            self.config.task_sector_field,
            self.config.task_progress_field,
        ] if field)
        records = await self._compatible_search_read(
            "project.task", self.config.task_domain, fields, limit,
            "write_date desc, id desc",
        )
        return [self._map_task(record) for record in records]

    async def _compatible_search_read(
        self,
        model: str,
        domain: list[Any],
        requested_fields: Iterable[str],
        limit: int,
        order: str,
    ) -> list[dict[str, Any]]:
        self._require_configured()
        available = await self._fields(model)
        fields = list(dict.fromkeys(field for field in requested_fields if field and field in available))
        return await asyncio.to_thread(self._search_read_sync, model, domain, fields, limit, order)

    async def _fields(self, model: str) -> set[str]:
        if model in self._field_cache:
            return self._field_cache[model]
        values = await asyncio.to_thread(self._fields_sync, model)
        self._field_cache[model] = values
        return values

    def _require_configured(self) -> None:
        if not self.config.configured:
            raise OdooConnectorError("إعدادات Odoo غير مكتملة")

    def _version_sync(self) -> dict[str, Any]:
        response = requests.get(f"{self.config.url}/web/version", timeout=self.config.timeout)
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict):
            raise OdooConnectorError("استجابة إصدار Odoo غير صالحة")
        return payload

    def _protocol_candidates(self) -> list[str]:
        if self.config.protocol != "auto":
            return [self.config.protocol]
        try:
            version = self._version_cache or self._version_sync()
            info = version.get("version_info") or version.get("server_version_info") or []
            major = int(info[0]) if info else int(str(version.get("version", "0")).split(".")[0])
            return ["json2", "xmlrpc"] if major >= 19 else ["xmlrpc", "json2"]
        except Exception:
            return ["json2", "xmlrpc"]

    def _resolve_working_protocol_sync(self) -> str:
        errors: list[str] = []
        for protocol in self._protocol_candidates():
            try:
                if protocol == "json2":
                    self._json2_call("res.users", "context_get", {})
                else:
                    self._xmlrpc_uid()
                return protocol
            except Exception as exc:
                errors.append(f"{protocol}: {exc}")
        raise OdooConnectorError("؛ ".join(errors) or "لا يوجد بروتوكول Odoo متاح")

    def _fields_sync(self, model: str) -> set[str]:
        payload = self._call_model_sync(model, "fields_get", [], {"attributes": ["string", "type"]})
        if not isinstance(payload, dict):
            raise OdooConnectorError(f"تعذر قراءة حقول النموذج {model}")
        return set(payload.keys())

    def _search_read_sync(
        self,
        model: str,
        domain: list[Any],
        fields: list[str],
        limit: int,
        order: str,
    ) -> list[dict[str, Any]]:
        payload = self._call_model_sync(
            model,
            "search_read",
            [domain],
            {"fields": fields, "limit": limit, "order": order},
        )
        if not isinstance(payload, list):
            raise OdooConnectorError(f"استجابة {model}.search_read غير صالحة")
        return [item for item in payload if isinstance(item, dict)]

    def _call_model_sync(
        self,
        model: str,
        method: str,
        args: list[Any],
        kwargs: dict[str, Any],
    ) -> Any:
        errors: list[str] = []
        for protocol in self._protocol_candidates():
            try:
                if protocol == "json2":
                    body = dict(kwargs)
                    if method == "search_read":
                        body["domain"] = args[0] if args else []
                    return self._json2_call(model, method, body)
                return self._xmlrpc_call(model, method, args, kwargs)
            except Exception as exc:
                errors.append(f"{protocol}: {exc}")
        raise OdooConnectorError("؛ ".join(errors) or "فشل استدعاء Odoo")

    def _json2_call(self, model: str, method: str, body: dict[str, Any]) -> Any:
        headers = {
            "Authorization": f"bearer {self.config.api_key}",
            "Content-Type": "application/json; charset=utf-8",
            "User-Agent": "NEXGEN-EXECUTIVES-Odoo-Connector/1.0",
        }
        if self.config.database:
            headers["X-Odoo-Database"] = self.config.database
        response = requests.post(
            f"{self.config.url}/json/2/{model}/{method}",
            headers=headers,
            json=body,
            timeout=self.config.timeout,
        )
        response.raise_for_status()
        payload = response.json()
        if isinstance(payload, dict) and payload.get("error"):
            raise OdooConnectorError(str(payload["error"]))
        return payload

    def _xmlrpc_uid(self) -> int:
        if self._uid:
            return self._uid
        if not self.config.database or not self.config.username:
            raise OdooConnectorError("يتطلب XML-RPC اسم قاعدة البيانات واسم مستخدم Odoo")
        common = xmlrpc.client.ServerProxy(f"{self.config.url}/xmlrpc/2/common", allow_none=True)
        uid = common.authenticate(
            self.config.database,
            self.config.username,
            self.config.api_key,
            {},
        )
        if not uid:
            raise OdooConnectorError("رفض Odoo بيانات المصادقة")
        self._uid = int(uid)
        return self._uid

    def _xmlrpc_call(
        self,
        model: str,
        method: str,
        args: list[Any],
        kwargs: dict[str, Any],
    ) -> Any:
        uid = self._xmlrpc_uid()
        models = xmlrpc.client.ServerProxy(f"{self.config.url}/xmlrpc/2/object", allow_none=True)
        return models.execute_kw(
            self.config.database,
            uid,
            self.config.api_key,
            model,
            method,
            args,
            kwargs,
        )

    def _sector(self, raw: Any) -> str:
        value = _many2one_name(raw) or str(raw or "")
        normalised = value.strip().lower()
        if normalised in VALID_SECTORS:
            return normalised
        if normalised in self.config.sector_map:
            return self.config.sector_map[normalised]
        aliases = {
            "investment": "investment", "استثمار": "investment",
            "digital": "digital", "تقنية": "digital", "رقمي": "digital",
            "academy": "academy", "أكاديمية": "academy",
            "training": "academy", "تدريب": "academy",
            "development": "development", "تنمية": "development",
            "operations": "arak_development", "تشغيل": "arak_development",
            "corporate": "corporate", "مؤسسية": "corporate",
        }
        for token, sector in aliases.items():
            if token in normalised:
                return sector
        return self.config.default_sector

    def _map_project(self, record: dict[str, Any]) -> dict[str, Any]:
        task_count = int(_as_number(record.get("task_count")))
        closed_count = int(_as_number(record.get("closed_task_count")))
        planned_hours = _as_number(record.get("allocated_hours"))
        effective_hours = _as_number(record.get("effective_hours"))
        custom_progress = _as_number(record.get(self.config.project_progress_field), -1)
        if custom_progress >= 0:
            progress = round(max(0, min(100, custom_progress)))
        elif task_count:
            progress = round((closed_count / task_count) * 100)
        elif planned_hours:
            progress = round(max(0, min(100, (effective_hours / planned_hours) * 100)))
        else:
            progress = 0

        stage_name = _many2one_name(record.get("stage_id")).lower()
        completed_tokens = ("done", "completed", "closed", "مكتمل", "منجز", "مغلق")
        if not record.get("active", True):
            status = "cancelled"
        elif progress >= 100 or any(token in stage_name for token in completed_tokens):
            status = "completed"
        else:
            status = "active"

        sector_raw = record.get(self.config.project_sector_field) if self.config.project_sector_field else ""
        budget = _as_number(record.get(self.config.project_budget_field)) if self.config.project_budget_field else 0
        project_id = record.get("id")
        return {
            "id": f"odoo-project-{project_id}",
            "odoo_id": project_id,
            "source": "odoo",
            "name": record.get("name") or f"Odoo Project {project_id}",
            "description": _plain_text(record.get("description")),
            "sector": self._sector(sector_raw),
            "owner_id": _many2one_id(record.get("user_id")),
            "start_date": record.get("date_start") or None,
            "end_date": record.get("date") or None,
            "progress": progress,
            "status": status,
            "budget": budget,
            "priority": "high" if _date_is_overdue(record.get("date")) and status != "completed" else "medium",
            "created_at": record.get("create_date"),
            "updated_at": record.get("write_date"),
            "odoo_stage": _many2one_name(record.get("stage_id")),
            "odoo_company": _many2one_name(record.get("company_id")),
        }

    def _map_task(self, record: dict[str, Any]) -> dict[str, Any]:
        planned_hours = _as_number(record.get("planned_hours"))
        effective_hours = _as_number(record.get("effective_hours"))
        custom_progress = _as_number(record.get(self.config.task_progress_field), -1)
        if custom_progress >= 0:
            progress = round(max(0, min(100, custom_progress)))
        elif planned_hours:
            progress = round(max(0, min(100, (effective_hours / planned_hours) * 100)))
        else:
            progress = 0

        stage_name = _many2one_name(record.get("stage_id")).lower()
        completed_tokens = ("done", "completed", "closed", "مكتمل", "منجز", "مغلق")
        cancelled_tokens = ("cancel", "cancelled", "ملغ", "موقوف")
        due_date = record.get("date_deadline") or None
        if not record.get("active", True) or any(token in stage_name for token in cancelled_tokens):
            status = "cancelled"
        elif any(token in stage_name for token in completed_tokens) or progress >= 100:
            status = "completed"
            progress = max(progress, 100)
        elif _date_is_overdue(due_date):
            status = "delayed"
        elif record.get("kanban_state") == "blocked":
            status = "awaiting_approval"
        elif progress > 0:
            status = "in_progress"
        else:
            status = "pending"

        priority_value = str(record.get("priority") or "0")
        priority = "critical" if priority_value in {"2", "3"} else "high" if priority_value == "1" else "medium"
        project_odoo_id = _many2one_id(record.get("project_id"))
        sector_raw = record.get(self.config.task_sector_field) if self.config.task_sector_field else ""
        task_id = record.get("id")
        return {
            "id": f"odoo-task-{task_id}",
            "odoo_id": task_id,
            "source": "odoo",
            "title": record.get("name") or f"Odoo Task {task_id}",
            "description": _plain_text(record.get("description")),
            "project_id": f"odoo-project-{project_odoo_id}" if project_odoo_id else None,
            "odoo_project_id": project_odoo_id,
            "sector": self._sector(sector_raw),
            "assignee_id": (record.get("user_ids") or [None])[0] if isinstance(record.get("user_ids"), list) else None,
            "due_date": due_date,
            "priority": priority,
            "status": status,
            "progress": progress,
            "created_at": record.get("create_date"),
            "updated_at": record.get("write_date"),
            "odoo_stage": _many2one_name(record.get("stage_id")),
            "odoo_company": _many2one_name(record.get("company_id")),
        }


_CONNECTOR: OdooConnector | None = None


def get_odoo_connector(refresh: bool = False) -> OdooConnector:
    global _CONNECTOR
    if _CONNECTOR is None or refresh:
        _CONNECTOR = OdooConnector()
    return _CONNECTOR
