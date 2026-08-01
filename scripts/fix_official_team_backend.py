from pathlib import Path

path = Path("backend/server.py")
text = path.read_text(encoding="utf-8")
text = text.replace(
    'async def approve_task(task_id: str, user=Depends(require_roles("admin", "ceo", "vp_development", "vp_investment"))):',
    'async def approve_task(task_id: str, user=Depends(require_roles("admin", "ceo", "vp_development", "national_executive", "finance"))):',
    1,
)
text = text.replace(
    '''        owner_map = {
            "academy": user_id_by_role.get("vp_development"),
            "digital": user_id_by_role.get("vp_development"),
            "development": user_id_by_role.get("vp_development"),
            "corporate": user_id_by_role.get("vp_development"),
            "arak_development": user_id_by_role.get("dev_manager"),
            "investment": user_id_by_role.get("vp_investment"),
        }''',
    '''        owner_map = {
            "academy": user_id_by_role.get("vp_development"),
            "digital": user_id_by_role.get("tech_supervisor") or user_id_by_role.get("vp_development"),
            "development": user_id_by_role.get("vp_development"),
            "corporate": user_id_by_role.get("vp_development"),
            "arak_development": user_id_by_role.get("national_executive"),
            "investment": user_id_by_role.get("finance"),
        }''',
    1,
)
if 'user_id_by_role.get("dev_manager")' in text or 'user_id_by_role.get("vp_investment")' in text:
    raise SystemExit("stale owner roles remain")
path.write_text(text, encoding="utf-8")
