"""Compatibility loader and institutional access modules for ARAAK CEO Office."""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

_PACKAGE_PARENT = __name__.rpartition(".")[0]
_LEGACY_NAME = f"{_PACKAGE_PARENT}._legacy_arak_extensions" if _PACKAGE_PARENT else "_legacy_arak_extensions"
_LEGACY_PATH = Path(__file__).resolve().parent.parent / "arak_extensions.py"
_SPEC = importlib.util.spec_from_file_location(_LEGACY_NAME, _LEGACY_PATH)
if _SPEC is None or _SPEC.loader is None:  # pragma: no cover
    raise ImportError(f"تعذر تحميل امتدادات النظام من {_LEGACY_PATH}")
_LEGACY = importlib.util.module_from_spec(_SPEC)
sys.modules[_LEGACY_NAME] = _LEGACY
_SPEC.loader.exec_module(_LEGACY)

# Re-export the public symbols of the legacy module so imports such as
# `from .arak_extensions import ExecutiveBriefInput` keep working even though
# this compatibility package and the legacy module share the same base name.
for _symbol in dir(_LEGACY):
    if not _symbol.startswith("_"):
        globals()[_symbol] = getattr(_LEGACY, _symbol)

from . import secure_access as secure_access  # noqa: E402,F401
from . import access_fabric as access_fabric  # noqa: E402,F401
from . import access_hotfix as access_hotfix  # noqa: E402,F401

__all__ = [name for name in globals() if not name.startswith("_")]
