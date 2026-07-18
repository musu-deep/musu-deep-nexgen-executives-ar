# CEO Office AI — Project Final Upgrade

This package positions the platform as an **AI Chief of Staff / Executive Intelligence OS** for the Google Cloud Rapid Agent Project.

## What changed

- English-first interface from login onward, with an EN/AR language switch retained.
- AI Command Bar retained and improved as the main agentic entry point.
- Gemini-ready Executive Brief endpoint:
  - `POST /api/ai/executive-brief`
  - Uses `GEMINI_API_KEY` / `GOOGLE_API_KEY` if configured.
  - Falls back to deterministic executive intelligence when no key is available, so demos remain stable.
- MongoDB organizational memory:
  - projects, tasks, meetings, meeting requests, documents, notifications, voice directives, and generated executive AI memory.
- Executive AI memory collection:
  - `executive_ai_memory`
  - stores generated briefs and source context for explainability and follow-up.
- Role-based navigation already filters modules by user role.
- CORS configured for local development.

## Run locally

Backend:
```powershell
cd backend
python -m pip install -r requirements.txt
python -m uvicorn server:app --host 127.0.0.1 --port 8000 --reload
```

Frontend:
```powershell
cd frontend
npm install
npm run dev
```

Open:
```text
http://localhost:5173
```

## Gemini configuration

Edit `backend/.env`:

```env
GEMINI_API_KEY=your_google_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
```

If no Gemini key is set, the Executive AI Layer still returns a stable demo-safe fallback.

## Project story

**CEO Office AI** is not a dashboard. It is an AI Chief of Staff that turns enterprise operational data into executive briefs, risks, decisions, and follow-up actions.

Recommended demo sequence:

1. Login with CEO account.
2. Type: `open meeting requests`.
3. Return to dashboard and show AI Chief of Staff + Risk Radar.
4. Type: `generate executive brief`.
5. Open Daily AI Brief.
6. Click a KPI/card and generate an executive brief.
7. Explain that MongoDB stores the organizational memory and Gemini produces/augments executive intelligence.
