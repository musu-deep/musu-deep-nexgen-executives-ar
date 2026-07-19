@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ==================================================
echo   NEXGEN EXECUTIVES - مكتب الرئيس التنفيذي الرقمي
echo ==================================================
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo [خطأ] لم يتم العثور على Python في PATH.
  echo ثبّت Python 3.12 أو أحدث ثم أعد التشغيل.
  pause
  exit /b 2
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [خطأ] لم يتم العثور على npm في PATH.
  echo ثبّت Node.js ثم أعد التشغيل.
  pause
  exit /b 2
)

python scripts\dev.py
set EXIT_CODE=%ERRORLEVEL%

if not "%EXIT_CODE%"=="0" (
  echo.
  echo توقف التشغيل برمز %EXIT_CODE%. راجع الرسالة أعلاه.
  pause
)

exit /b %EXIT_CODE%
