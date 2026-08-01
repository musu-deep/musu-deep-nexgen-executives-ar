from pathlib import Path

import team_patch_backend
import team_patch_core
import team_patch_ui_tests


def main() -> None:
    team_patch_core.apply()
    team_patch_backend.apply()
    team_patch_ui_tests.patch_workflows = lambda: None
    team_patch_ui_tests.apply()

    root = Path(__file__).resolve().parents[1]
    for relative in [
        "scripts/official_team_data.json",
        "scripts/team_patch_core.py",
        "scripts/team_patch_backend.py",
        "scripts/team_patch_ui_tests.py",
        "scripts/apply_official_team.py",
    ]:
        (root / relative).unlink(missing_ok=True)


if __name__ == "__main__":
    main()
