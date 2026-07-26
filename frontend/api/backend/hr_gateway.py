"""Odoo-backed workforce routes for the hosted executive platform.

The module registers Vercel-safe routes before the catch-all mounted app. Team
views receive a public organisational directory, while compensation data is
restricted to the CEO, platform administrator, and the designated HR account.
"""
from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, Request
from starlette.routing import Mount

EMPLOYEE_FIELDS = [
    "id", "name", "active", "work_email", "work_phone", "mobile_phone",
    "department_id", "job_id", "parent_id", "coach_id", "company_id",
    "work_location_id", "employee_type", "barcode", "first_contract_date",
    "create_date", "write_date",
]

CONTRACT_FIELDS = [
    "id", "name", "employee_id", "date_start", "date_end", "wage", "state",
    "job_id", "department_id", "company_id", "currency_id", "contract_type_id",
    "resource_calendar_id", "create_date", "write_date",
]

EMAIL_ROLE_MAP = {
    "admin@company.demo": "admin",
    "ceo@company.demo": "ceo",
    "development@company.demo": "vp_development",
    "investment@company.demo": "vp_investment",
    "followup@company.demo": "tracker",
    "secretariat@company.demo": "tracker",
}


def _many2one_id(value: Any) -> int | None:
    if isinstance(value, (list, tuple)) and value:
        try:
            return int(value[0])
        except (TypeError, ValueError):
            return None
    if isinstance(value, int):
        return value
    return None


def _many2one_name(value: Any) -> str:
    if isinstance(value, (list, tuple)) and len(value) > 1:
        return str(value[1] or "")
    if isinstance(value, str):
        return value
    return ""


def _as_number(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _role_for(email: str, title: str) -> str:
    normalised_email = str(email or "").strip().lower()
    if normalised_email in EMAIL_ROLE_MAP:
        return EMAIL_ROLE_MAP[normalised_email]

    text = str(title or "").lower()
    if "الرئيس التنفيذي" in text and "نائب" not in text:
        return "ceo"
    if "نائب" in text and "تنمية" in text:
        return "vp_development"
    if "نائب" in text and ("استثمار" in text or "محافظ" in text):
        return "vp_investment"
    if any(token in text for token in ("متابعة", "سكرتارية")):
        return "tracker"
    if any(token in text for token in ("منصة", "نظام", "تقنية")):
        return "admin"
    return "dev_manager"


def _can_view_compensation(user: dict[str, Any]) -> bool:
    return (
        user.get("role") in {"admin", "ceo"}
        or str(user.get("email") or "").strip().lower() == "hr@company.demo"
    )


def _is_assumed_contract(contract: dict[str, Any]) -> bool:
    name = str(contract.get("name") or "").lower()
    return any(token in name for token in ("بيانات تعاقد أولية", "افتراضي", "initial data"))


def _date_key(value: Any) -> tuple[int, str]:
    if not value:
        return (0, "")
    text = str(value)
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return (1, parsed.isoformat())
    except (TypeError, ValueError):
        return (1, text)


async def _odoo_records(odoo_server: Any, include_compensation: bool) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    connector = odoo_server.get_odoo_connector()
    employees = await connector._compatible_search_read(
        "hr.employee", [], EMPLOYEE_FIELDS, 1000, "name asc, id asc"
    )

    contracts: list[dict[str, Any]] = []
    if include_compensation:
        try:
            contracts = await connector._compatible_search_read(
                "hr.contract", [], CONTRACT_FIELDS, 2000, "date_start desc, id desc"
            )
        except Exception:
            contracts = []
    return employees, contracts


def _map_employees(
    records: list[dict[str, Any]],
    contracts: list[dict[str, Any]],
    include_compensation: bool,
) -> list[dict[str, Any]]:
    latest_contract: dict[int, dict[str, Any]] = {}
    for contract in sorted(
        contracts,
        key=lambda item: (_date_key(item.get("date_start")), int(item.get("id") or 0)),
        reverse=True,
    ):
        employee_id = _many2one_id(contract.get("employee_id"))
        if employee_id and employee_id not in latest_contract:
            latest_contract[employee_id] = contract

    mapped: list[dict[str, Any]] = []
    for record in records:
        employee_id = int(record.get("id") or 0)
        title = _many2one_name(record.get("job_id"))
        email = str(record.get("work_email") or "").strip()
        contract = latest_contract.get(employee_id)
        hire_date = (
            record.get("first_contract_date")
            or (contract or {}).get("date_start")
            or record.get("create_date")
        )

        item: dict[str, Any] = {
            "id": f"odoo-employee-{employee_id}",
            "odoo_id": employee_id,
            "source": "odoo",
            "employee_number": record.get("barcode") or f"ODOO-{employee_id}",
            "name": record.get("name") or f"Employee {employee_id}",
            "email": email,
            "work_email": email,
            "work_phone": record.get("work_phone") or "",
            "mobile_phone": record.get("mobile_phone") or "",
            "title": title,
            "job_title": title,
            "department": _many2one_name(record.get("department_id")),
            "department_id": _many2one_id(record.get("department_id")),
            "manager": _many2one_name(record.get("parent_id")),
            "manager_id": _many2one_id(record.get("parent_id")),
            "coach": _many2one_name(record.get("coach_id")),
            "entity": _many2one_name(record.get("company_id")),
            "location": _many2one_name(record.get("work_location_id")),
            "employee_type": record.get("employee_type") or "employee",
            "hire_date": hire_date,
            "active": bool(record.get("active", True)),
            "role": _role_for(email, title),
            "created_at": record.get("create_date"),
            "updated_at": record.get("write_date"),
        }

        if include_compensation:
            wage = _as_number((contract or {}).get("wage")) if contract else 0.0
            item.update(
                salary=wage,
                salary_currency=_many2one_name((contract or {}).get("currency_id")),
                salary_is_assumed=_is_assumed_contract(contract or {}),
                contract_id=(contract or {}).get("id"),
                contract_name=(contract or {}).get("name") or "",
                contract_state=(contract or {}).get("state") or "not_available",
                contract_start=(contract or {}).get("date_start"),
                contract_end=(contract or {}).get("date_end"),
            )

        mapped.append(item)
    return mapped


async def _platform_fallback(core: Any) -> list[dict[str, Any]]:
    records = await core.db.users.find({}, {"_id": 0, "password_hash": 0}).sort("name", 1).to_list(1000)
    return [
        {
            "id": item.get("id"),
            "source": "platform",
            "employee_number": item.get("id"),
            "name": item.get("name") or item.get("title") or "عضو فريق",
            "email": item.get("email") or "",
            "work_email": item.get("email") or "",
            "title": item.get("title") or "",
            "job_title": item.get("title") or "",
            "department": item.get("department") or "",
            "manager": "",
            "entity": "مجموعة اراك للتنمية",
            "location": "",
            "hire_date": item.get("created_at"),
            "active": bool(item.get("active", True)),
            "role": item.get("role") or "dev_manager",
        }
        for item in records
        if item.get("active", True)
    ]


async def _workforce(core: Any, odoo_server: Any, include_compensation: bool) -> tuple[str, list[dict[str, Any]], str | None]:
    try:
        records, contracts = await _odoo_records(odoo_server, include_compensation)
        employees = _map_employees(records, contracts, include_compensation)
        return "odoo", employees, None
    except Exception as exc:
        fallback = await _platform_fallback(core)
        return "platform", fallback, str(exc)[:260]


def _department_summary(employees: list[dict[str, Any]]) -> list[dict[str, Any]]:
    counts = Counter(str(item.get("department") or "غير مصنف") for item in employees if item.get("active", True))
    return [
        {"department": department, "count": count}
        for department, count in sorted(counts.items(), key=lambda pair: (-pair[1], pair[0]))
    ]


def register_hr_routes(app: Any, core: Any, odoo_server: Any) -> None:
    """Register routes before the existing catch-all Mount route."""

    existing_paths = {getattr(route, "path", None) for route in app.router.routes}
    if "/api/employees" in existing_paths:
        return

    initial_count = len(app.router.routes)

    async def employee_directory(request: Request):
        await core.get_current_user(request)
        source, employees, warning = await _workforce(core, odoo_server, include_compensation=False)
        return {
            "source": source,
            "employees": employees,
            "total": len(employees),
            "warning": warning,
            "compensation_visible": False,
        }

    async def hr_overview(request: Request):
        user = await core.get_current_user(request)
        compensation_visible = _can_view_compensation(user)
        source, employees, warning = await _workforce(
            core, odoo_server, include_compensation=compensation_visible
        )
        active = [item for item in employees if item.get("active", True)]
        salaries = [float(item.get("salary") or 0) for item in active if compensation_visible]
        managers = {str(item.get("manager") or "").strip() for item in active if item.get("manager")}
        assumed_count = sum(1 for item in active if item.get("salary_is_assumed")) if compensation_visible else 0

        return {
            "source": source,
            "warning": warning,
            "compensation_visible": compensation_visible,
            "salary_data_classification": "restricted",
            "salary_note": "الرواتب الحالية قيم افتراضية لبناء النموذج وليست اعتماداً مالياً." if assumed_count else "",
            "totals": {
                "employees": len(employees),
                "active_employees": len(active),
                "inactive_employees": len(employees) - len(active),
                "departments": len({item.get("department") for item in active if item.get("department")}),
                "managers": len(managers),
                "monthly_payroll": round(sum(salaries), 2) if compensation_visible else None,
                "average_salary": round(sum(salaries) / max(len(salaries), 1), 2) if compensation_visible else None,
                "assumed_salary_records": assumed_count if compensation_visible else None,
            },
            "departments": _department_summary(employees),
            "employees": employees,
        }

    async def hr_employees(request: Request):
        user = await core.get_current_user(request)
        compensation_visible = _can_view_compensation(user)
        source, employees, warning = await _workforce(
            core, odoo_server, include_compensation=compensation_visible
        )
        return {
            "source": source,
            "employees": employees,
            "total": len(employees),
            "warning": warning,
            "compensation_visible": compensation_visible,
        }

    app.add_api_route("/api/employees", employee_directory, methods=["GET"], tags=["Human Resources"])
    app.add_api_route("/api/hr/overview", hr_overview, methods=["GET"], tags=["Human Resources"])
    app.add_api_route("/api/hr/employees", hr_employees, methods=["GET"], tags=["Human Resources"])

    added = app.router.routes[initial_count:]
    del app.router.routes[initial_count:]
    mount_index = next(
        (index for index, route in enumerate(app.router.routes) if isinstance(route, Mount)),
        len(app.router.routes),
    )
    for offset, route in enumerate(added):
        app.router.routes.insert(mount_index + offset, route)
