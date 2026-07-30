"""ARAAK Access Fabric: scoped RBAC + contextual ABAC + relationship access."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal, Optional

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field

try:
    from .. import server as core
except (ImportError, ValueError):
    import server as core  # type: ignore

CLASSIFICATION_RANK = {
    "internal": 1,
    "restricted": 2,
    "confidential": 3,
    "executive_secret": 4,
    "financial_sensitive": 4,
    "legal_privileged": 4,
}

MODULES = [
    "dashboard", "daily_report", "camera_monitoring", "projects", "tasks",
    "executive_secretariat", "presidential_advisor", "legal_affairs",
    "opportunity_intelligence", "pricing_intelligence", "human_resources",
    "quality_control", "calendar", "meetings", "meeting_requests", "documents",
    "messages", "voice", "ai_lounge", "odoo_integration", "reports", "team",
    "notifications", "settings", "admin", "access_control",
]

LEGACY_ROLE_MAP = {
    "admin": "system_admin",
    "ceo": "chief_executive",
    "vp_development": "development_vp",
    "vp_investment": "investment_vp",
    "dev_manager": "unit_manager",
    "tracker": "executive_followup",
}


def module_permission(module: str) -> str:
    return f"module.{module}.view"


BASE_PERMISSIONS = [
    ("access.manage", "إدارة نسيج الصلاحيات", "security"),
    ("access.simulate", "محاكاة قرارات الوصول", "security"),
    ("audit.view", "عرض سجل التدقيق", "security"),
    ("user.invite", "دعوة المستخدمين", "identity"),
    ("user.disable", "تعطيل المستخدمين", "identity"),
    ("organization.manage", "إدارة الهيكل التنظيمي", "organization"),
    ("project.view", "عرض المشروعات", "project"),
    ("project.create", "إنشاء المشروعات", "project"),
    ("project.update", "تحديث المشروعات", "project"),
    ("project.close", "إغلاق المشروعات", "project"),
    ("task.view", "عرض المهام", "task"),
    ("task.assign", "إسناد المهام", "task"),
    ("task.approve", "اعتماد المهام", "task"),
    ("document.view", "عرض المستندات", "document"),
    ("document.upload", "رفع المستندات", "document"),
    ("document.download", "تنزيل المستندات", "document"),
    ("document.classify", "تصنيف المستندات", "document"),
    ("tender.view", "عرض المنافسات", "tender"),
    ("tender.price.view", "عرض التسعير", "tender"),
    ("tender.price.edit", "تعديل التسعير", "tender"),
    ("tender.submit", "تقديم المنافسة", "tender"),
    ("tender.approve", "اعتماد المنافسة", "tender"),
    ("report.view", "عرض التقارير", "report"),
    ("report.approve", "اعتماد التقارير", "report"),
    ("meeting.manage", "إدارة الاجتماعات", "meeting"),
]
DEFAULT_PERMISSIONS = BASE_PERMISSIONS + [
    (module_permission(module), f"عرض وحدة {module}", "module") for module in MODULES
]

COMMON_MODULES = {
    "dashboard", "projects", "tasks", "meetings", "meeting_requests",
    "messages", "notifications",
}


def module_permissions(modules: set[str]) -> list[str]:
    return [module_permission(module) for module in sorted(modules)]


ALL_BUSINESS_MODULES = set(MODULES) - {"admin", "access_control"}
DEFAULT_ROLES = {
    "system_admin": (
        "مدير النظام",
        "إدارة الهوية والصلاحيات دون افتراض الاطلاع على كل المحتوى التنفيذي.",
        [
            "access.manage", "access.simulate", "audit.view", "user.invite",
            "user.disable", "organization.manage", module_permission("dashboard"),
            module_permission("admin"), module_permission("access_control"),
        ],
        "executive_secret",
    ),
    "chief_executive": (
        "الرئيس التنفيذي",
        "صلاحية تنفيذية شاملة على الكيانات والمشروعات والمحتوى.",
        [code for code, _, _ in DEFAULT_PERMISSIONS if code != "access.manage"]
        + module_permissions(ALL_BUSINESS_MODULES),
        "executive_secret",
    ),
    "development_vp": (
        "نائب الرئيس للتنمية",
        "صلاحيات قطاع التنمية والتطوير ضمن النطاق المعتمد.",
        [
            "project.view", "project.create", "project.update", "task.view",
            "task.assign", "task.approve", "document.view", "document.upload",
            "report.view", "report.approve", "meeting.manage",
        ] + module_permissions(COMMON_MODULES | {
            "daily_report", "executive_secretariat", "presidential_advisor",
            "human_resources", "calendar", "documents", "reports", "team",
            "ai_lounge", "settings",
        }),
        "confidential",
    ),
    "investment_vp": (
        "نائب الرئيس للاستثمار",
        "صلاحيات الاستثمار والمنافسات والتسعير ضمن النطاق المعتمد.",
        [
            "project.view", "project.create", "project.update", "task.view",
            "task.assign", "task.approve", "document.view", "document.upload",
            "tender.view", "tender.price.view", "tender.price.edit",
            "report.view", "report.approve",
        ] + module_permissions(COMMON_MODULES | {
            "daily_report", "opportunity_intelligence", "pricing_intelligence",
            "calendar", "documents", "reports", "ai_lounge", "settings",
        }),
        "financial_sensitive",
    ),
    "unit_manager": (
        "مدير وحدة",
        "إدارة التنفيذ داخل الوحدة التنظيمية أو المشروع المحدد.",
        [
            "project.view", "project.update", "task.view", "task.assign",
            "document.view", "document.upload", "report.view",
        ] + module_permissions(COMMON_MODULES | {"calendar", "documents", "team"}),
        "restricted",
    ),
    "executive_followup": (
        "المتابعة التنفيذية",
        "متابعة مشتركة للمهام والاجتماعات والمستندات ضمن النطاق.",
        [
            "project.view", "task.view", "task.assign", "document.view",
            "report.view", "meeting.manage",
        ] + module_permissions(COMMON_MODULES | {
            "executive_secretariat", "calendar", "documents", "reports", "team",
        }),
        "confidential",
    ),
    "viewer": (
        "مشاهد",
        "وصول للقراءة فقط ضمن نطاق محدد.",
        ["project.view", "task.view", "document.view", "report.view"]
        + module_permissions({"dashboard", "projects", "tasks", "documents", "reports", "notifications"}),
        "internal",
    ),
    "technical_committee": (
        "عضو لجنة فنية",
        "مراجعة فنية مؤقتة للمنافسات والمستندات المرتبطة.",
        ["tender.view", "document.view", "report.view"]
        + module_permissions({"dashboard", "opportunity_intelligence", "documents", "reports", "notifications"}),
        "confidential",
    ),
    "financial_reviewer": (
        "مراجع مالي",
        "مراجعة مالية مقيدة للمنافسات والتقارير.",
        ["tender.view", "tender.price.view", "report.view"]
        + module_permissions({"dashboard", "pricing_intelligence", "reports", "notifications"}),
        "financial_sensitive",
    ),
}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def parse_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def active_window(item: dict) -> bool:
    now = utcnow()
    starts_at = parse_datetime(item.get("starts_at"))
    expires_at = parse_datetime(item.get("expires_at"))
    if starts_at and starts_at > now:
        return False
    if expires_at and expires_at <= now:
        return False
    return item.get("active", True)


async def descendants(scope_id: Optional[str]) -> set[str]:
    if not scope_id:
        return set()
    seen, frontier = {scope_id}, [scope_id]
    while frontier:
        rows = await core.db.organization_units.find(
            {"parent_id": {"$in": frontier}},
            {"_id": 0, "id": 1},
        ).to_list(1000)
        frontier = [row["id"] for row in rows if row["id"] not in seen]
        seen.update(frontier)
    return seen


async def effective_permissions(user: dict, resource: Optional[dict] = None) -> dict:
    assignments = await core.db.role_assignments.find(
        {"user_id": user["id"]},
        {"_id": 0},
    ).to_list(500)

    memberships = await core.db.group_memberships.find(
        {"user_id": user["id"], "active": True},
        {"_id": 0},
    ).to_list(500)
    group_ids = [item["group_id"] for item in memberships]
    if group_ids:
        assignments += await core.db.role_assignments.find(
            {"group_id": {"$in": group_ids}},
            {"_id": 0},
        ).to_list(500)

    assignments = [item for item in assignments if active_window(item)]
    role_ids = list({item["role_id"] for item in assignments})
    roles = (
        await core.db.access_roles.find(
            {"id": {"$in": role_ids}, "active": True},
            {"_id": 0},
        ).to_list(500)
        if role_ids
        else []
    )
    role_map = {role["id"]: role for role in roles}
    resource_scope = (resource or {}).get("scope_id") or (resource or {}).get("unit_id")

    granted: set[str] = set()
    matched: list[dict] = []
    for assignment in assignments:
        role = role_map.get(assignment["role_id"])
        if not role:
            continue
        scope_type = assignment.get("scope_type", "global")
        scope_id = assignment.get("scope_id")
        applies = scope_type == "global" or not resource
        if not applies and resource_scope and scope_id:
            applies = resource_scope in await descendants(scope_id)
        if applies:
            granted.update(role.get("permissions", []))
            matched.append({"assignment": assignment, "role": role})

    return {"permissions": sorted(granted), "matches": matched}


async def evaluate(
    user: dict,
    action: str,
    resource: Optional[dict] = None,
    context: Optional[dict] = None,
) -> dict:
    context = context or {}
    resource = resource or {}
    effective = await effective_permissions(user, resource)
    allowed = action in effective["permissions"]
    reasons = [
        "مُنحت الصلاحية بواسطة تعيين دور نشط ضمن النطاق."
        if allowed
        else "لا يوجد دور نشط ضمن النطاق يمنح هذه الصلاحية."
    ]

    classification = resource.get("classification", "internal")
    clearance = user.get("clearance", "internal")
    if CLASSIFICATION_RANK.get(classification, 1) > CLASSIFICATION_RANK.get(clearance, 1):
        allowed = False
        reasons.append("تصنيف المورد أعلى من مستوى تصريح المستخدم.")

    policies = await core.db.policy_rules.find(
        {"active": True, "$or": [{"action": action}, {"action": "*"}]},
        {"_id": 0},
    ).sort("priority", -1).to_list(500)
    for policy in policies:
        conditions = policy.get("conditions", {})
        matched = True
        if conditions.get("require_mfa") and not context.get("mfa_verified"):
            matched = False
        if conditions.get("max_amount") is not None:
            try:
                if float(context.get("amount", 0)) > float(conditions["max_amount"]):
                    matched = False
            except (TypeError, ValueError):
                matched = False
        allowed_classifications = conditions.get("classification")
        if allowed_classifications and classification not in allowed_classifications:
            matched = False
        if matched:
            reasons.append(f"انطبقت السياسة: {policy.get('name')} ({policy.get('effect')}).")
            allowed = policy.get("effect") == "allow"
            if policy.get("effect") == "deny":
                break

    delegations = await core.db.delegations.find(
        {"delegate_id": user["id"], "active": True},
        {"_id": 0},
    ).to_list(200)
    for delegation in delegations:
        if not active_window(delegation):
            continue
        if action in delegation.get("exclusions", []):
            continue
        if action in delegation.get("permissions", []):
            allowed = True
            reasons.append("مُنحت الصلاحية بواسطة تفويض مؤقت نشط.")

    decision = {
        "allowed": allowed,
        "action": action,
        "resource": resource,
        "reasons": reasons,
        "matched_roles": [item["role"].get("name") for item in effective["matches"]],
        "effective_permissions": effective["permissions"],
        "evaluated_at": core.now_iso(),
    }
    await core.db.authorization_decisions.insert_one({
        "id": core.new_id(),
        "user_id": user["id"],
        **decision,
    })
    return decision


class OrganizationInput(BaseModel):
    name: str
    code: str
    kind: Literal["group", "company", "department", "branch", "committee", "project", "team"] = "department"
    parent_id: Optional[str] = None
    active: bool = True


class RoleInput(BaseModel):
    name: str
    code: str
    description: str = ""
    permissions: list[str] = Field(default_factory=list)
    clearance: str = "internal"
    active: bool = True


class AssignmentInput(BaseModel):
    user_id: Optional[str] = None
    group_id: Optional[str] = None
    role_id: str
    scope_type: Literal["global", "organization", "unit", "project", "resource"] = "global"
    scope_id: Optional[str] = None
    starts_at: Optional[str] = None
    expires_at: Optional[str] = None


class GroupInput(BaseModel):
    name: str
    code: str
    description: str = ""
    unit_id: Optional[str] = None


class MembershipInput(BaseModel):
    user_id: str
    group_id: str


class DelegationInput(BaseModel):
    delegator_id: str
    delegate_id: str
    permissions: list[str]
    scope_id: Optional[str] = None
    starts_at: str
    expires_at: str
    exclusions: list[str] = Field(default_factory=list)


class PolicyInput(BaseModel):
    name: str
    action: str = "*"
    effect: Literal["allow", "deny"] = "deny"
    priority: int = 100
    conditions: dict[str, Any] = Field(default_factory=dict)
    active: bool = True


class SimulationInput(BaseModel):
    user_id: str
    action: str
    resource: dict[str, Any] = Field(default_factory=dict)
    context: dict[str, Any] = Field(default_factory=dict)


def admin_only(user: dict) -> None:
    if user.get("role") != "admin":
        raise HTTPException(403, "إدارة نسيج الصلاحيات حصرية لمدير النظام.")


async def bootstrap_payload() -> dict:
    return {
        "organizations": await core.db.organization_units.find({}, {"_id": 0}).sort("name", 1).to_list(1000),
        "roles": await core.db.access_roles.find({}, {"_id": 0}).sort("name", 1).to_list(1000),
        "permissions": await core.db.permissions.find({}, {"_id": 0}).sort("code", 1).to_list(2000),
        "assignments": await core.db.role_assignments.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000),
        "groups": await core.db.access_groups.find({}, {"_id": 0}).sort("name", 1).to_list(1000),
        "memberships": await core.db.group_memberships.find({"active": True}, {"_id": 0}).to_list(2000),
        "delegations": await core.db.delegations.find({"active": True}, {"_id": 0}).to_list(1000),
        "policies": await core.db.policy_rules.find({}, {"_id": 0}).sort("priority", -1).to_list(1000),
        "users": await core.db.users.find(
            {},
            {"_id": 0, "password_hash": 0, "invite_token_hash": 0},
        ).sort("name", 1).to_list(1000),
    }


@core.api_router.get("/access/bootstrap")
async def access_bootstrap(user=Depends(core.get_current_user)):
    admin_only(user)
    return await bootstrap_payload()


@core.api_router.get("/access/me")
async def my_access(user=Depends(core.get_current_user)):
    effective = await effective_permissions(user)
    modules = sorted({
        code.split(".")[1]
        for code in effective["permissions"]
        if code.startswith("module.") and code.endswith(".view") and len(code.split(".")) == 3
    })
    return {
        "user_id": user["id"],
        "permissions": effective["permissions"],
        "modules": modules,
        "roles": [item["role"] for item in effective["matches"]],
        "clearance": user.get("clearance", "internal"),
    }


@core.api_router.post("/access/check")
async def check_access(payload: SimulationInput, user=Depends(core.get_current_user)):
    return await evaluate(user, payload.action, payload.resource, payload.context)


@core.api_router.post("/access/organizations")
async def create_organization(payload: OrganizationInput, user=Depends(core.get_current_user)):
    admin_only(user)
    doc = {"id": core.new_id(), **payload.model_dump(), "created_at": core.now_iso(), "created_by": user["id"]}
    await core.db.organization_units.insert_one(doc)
    doc.pop("_id", None)
    return doc


@core.api_router.patch("/access/organizations/{item_id}")
async def update_organization(item_id: str, payload: dict, user=Depends(core.get_current_user)):
    admin_only(user)
    payload["updated_at"] = core.now_iso()
    await core.db.organization_units.update_one({"id": item_id}, {"$set": payload})
    return await core.db.organization_units.find_one({"id": item_id}, {"_id": 0})


@core.api_router.post("/access/roles")
async def create_role(payload: RoleInput, user=Depends(core.get_current_user)):
    admin_only(user)
    if await core.db.access_roles.find_one({"code": payload.code}):
        raise HTTPException(409, "رمز الدور مستخدم بالفعل.")
    doc = {
        "id": core.new_id(),
        **payload.model_dump(),
        "system": False,
        "created_at": core.now_iso(),
        "created_by": user["id"],
    }
    await core.db.access_roles.insert_one(doc)
    doc.pop("_id", None)
    return doc


@core.api_router.patch("/access/roles/{role_id}")
async def update_role(role_id: str, payload: RoleInput, user=Depends(core.get_current_user)):
    admin_only(user)
    await core.db.access_roles.update_one(
        {"id": role_id},
        {"$set": {**payload.model_dump(), "updated_at": core.now_iso()}},
    )
    return await core.db.access_roles.find_one({"id": role_id}, {"_id": 0})


@core.api_router.post("/access/assignments")
async def create_assignment(payload: AssignmentInput, user=Depends(core.get_current_user)):
    admin_only(user)
    if bool(payload.user_id) == bool(payload.group_id):
        raise HTTPException(422, "حدد مستخدماً أو مجموعة واحدة فقط.")
    doc = {
        "id": core.new_id(),
        **payload.model_dump(),
        "active": True,
        "created_at": core.now_iso(),
        "created_by": user["id"],
    }
    await core.db.role_assignments.insert_one(doc)
    doc.pop("_id", None)
    return doc


@core.api_router.delete("/access/assignments/{assignment_id}")
async def revoke_assignment(assignment_id: str, user=Depends(core.get_current_user)):
    admin_only(user)
    await core.db.role_assignments.update_one(
        {"id": assignment_id},
        {"$set": {"active": False, "revoked_at": core.now_iso(), "revoked_by": user["id"]}},
    )
    return {"ok": True}


@core.api_router.post("/access/groups")
async def create_group(payload: GroupInput, user=Depends(core.get_current_user)):
    admin_only(user)
    if await core.db.access_groups.find_one({"code": payload.code}):
        raise HTTPException(409, "رمز المجموعة مستخدم بالفعل.")
    doc = {"id": core.new_id(), **payload.model_dump(), "active": True, "created_at": core.now_iso()}
    await core.db.access_groups.insert_one(doc)
    doc.pop("_id", None)
    return doc


@core.api_router.post("/access/memberships")
async def add_membership(payload: MembershipInput, user=Depends(core.get_current_user)):
    admin_only(user)
    doc = {
        "id": core.new_id(),
        **payload.model_dump(),
        "active": True,
        "created_at": core.now_iso(),
    }
    await core.db.group_memberships.update_one(
        {"user_id": payload.user_id, "group_id": payload.group_id},
        {"$set": doc},
        upsert=True,
    )
    return doc


@core.api_router.delete("/access/memberships/{membership_id}")
async def remove_membership(membership_id: str, user=Depends(core.get_current_user)):
    admin_only(user)
    await core.db.group_memberships.update_one(
        {"id": membership_id},
        {"$set": {"active": False, "removed_at": core.now_iso()}},
    )
    return {"ok": True}


@core.api_router.post("/access/delegations")
async def create_delegation(payload: DelegationInput, user=Depends(core.get_current_user)):
    admin_only(user)
    doc = {
        "id": core.new_id(),
        **payload.model_dump(),
        "active": True,
        "created_at": core.now_iso(),
        "created_by": user["id"],
    }
    await core.db.delegations.insert_one(doc)
    doc.pop("_id", None)
    return doc


@core.api_router.delete("/access/delegations/{delegation_id}")
async def revoke_delegation(delegation_id: str, user=Depends(core.get_current_user)):
    admin_only(user)
    await core.db.delegations.update_one(
        {"id": delegation_id},
        {"$set": {"active": False, "revoked_at": core.now_iso(), "revoked_by": user["id"]}},
    )
    return {"ok": True}


@core.api_router.post("/access/policies")
async def create_policy(payload: PolicyInput, user=Depends(core.get_current_user)):
    admin_only(user)
    doc = {
        "id": core.new_id(),
        **payload.model_dump(),
        "created_at": core.now_iso(),
        "created_by": user["id"],
    }
    await core.db.policy_rules.insert_one(doc)
    doc.pop("_id", None)
    return doc


@core.api_router.patch("/access/policies/{policy_id}")
async def update_policy(policy_id: str, payload: PolicyInput, user=Depends(core.get_current_user)):
    admin_only(user)
    await core.db.policy_rules.update_one(
        {"id": policy_id},
        {"$set": {**payload.model_dump(), "updated_at": core.now_iso()}},
    )
    return await core.db.policy_rules.find_one({"id": policy_id}, {"_id": 0})


@core.api_router.post("/access/simulate")
async def simulate(payload: SimulationInput, user=Depends(core.get_current_user)):
    admin_only(user)
    target = await core.db.users.find_one({"id": payload.user_id}, {"_id": 0})
    if not target:
        raise HTTPException(404, "المستخدم غير موجود.")
    return await evaluate(target, payload.action, payload.resource, payload.context)


@core.app.on_event("startup")
async def initialize_access_fabric() -> None:
    for collection, field in (
        (core.db.organization_units, "code"),
        (core.db.access_roles, "code"),
        (core.db.permissions, "code"),
        (core.db.access_groups, "code"),
    ):
        await collection.create_index(field, unique=True)
    await core.db.role_assignments.create_index([("user_id", 1), ("active", 1)])
    await core.db.group_memberships.create_index([("user_id", 1), ("active", 1)])
    await core.db.authorization_decisions.create_index("created_at")

    root = await core.db.organization_units.find_one({"code": "ARAAK"}, {"_id": 0})
    if not root:
        root = {
            "id": core.new_id(),
            "name": "مجموعة اراك للتنمية",
            "code": "ARAAK",
            "kind": "group",
            "parent_id": None,
            "active": True,
            "system": True,
            "created_at": core.now_iso(),
        }
        await core.db.organization_units.insert_one(dict(root))

    for code, name, category in DEFAULT_PERMISSIONS:
        await core.db.permissions.update_one(
            {"code": code},
            {"$set": {"name": name, "category": category, "active": True}, "$setOnInsert": {"id": core.new_id(), "created_at": core.now_iso()}},
            upsert=True,
        )

    role_ids: dict[str, str] = {}
    for code, (name, description, permissions, clearance) in DEFAULT_ROLES.items():
        current = await core.db.access_roles.find_one({"code": code}, {"_id": 0})
        role_id = current.get("id") if current else core.new_id()
        role_ids[code] = role_id
        await core.db.access_roles.update_one(
            {"code": code},
            {"$set": {
                "id": role_id,
                "name": name,
                "description": description,
                "permissions": sorted(set(permissions)),
                "clearance": clearance,
                "active": True,
                "system": True,
                "updated_at": core.now_iso(),
            }, "$setOnInsert": {"created_at": core.now_iso()}},
            upsert=True,
        )

    users = await core.db.users.find({}, {"_id": 0}).to_list(2000)
    for user in users:
        role_code = LEGACY_ROLE_MAP.get(user.get("role"), "viewer")
        role_id = role_ids[role_code]
        assignment = await core.db.role_assignments.find_one({
            "user_id": user["id"],
            "role_id": role_id,
            "scope_type": "global",
            "migration_source": "legacy_role",
            "active": True,
        })
        if not assignment:
            await core.db.role_assignments.insert_one({
                "id": core.new_id(),
                "user_id": user["id"],
                "group_id": None,
                "role_id": role_id,
                "scope_type": "global",
                "scope_id": root["id"],
                "starts_at": None,
                "expires_at": None,
                "active": True,
                "migration_source": "legacy_role",
                "created_at": core.now_iso(),
            })
        role_clearance = DEFAULT_ROLES[role_code][3]
        await core.db.users.update_one(
            {"id": user["id"]},
            {"$set": {
                "clearance": user.get("clearance") or role_clearance,
                "access_fabric_version": 1,
                "updated_at": core.now_iso(),
            }},
        )
