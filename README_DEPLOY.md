# CEO Office — GitHub / Vercel Ready

## Frontend
The active frontend is `frontend-new` and has been converted to Vite while preserving the original UI from `frontend/src`.

```bash
npm --prefix frontend-new install
npm --prefix frontend-new run dev
npm --prefix frontend-new run build
```

Set this environment variable in Vercel:

```bash
VITE_BACKEND_URL=https://your-backend-domain.com
```

## Backend
The FastAPI backend is in `backend`.

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
copy .env.example .env
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

Required backend environment variables:

```bash
MONGO_URL=mongodb://localhost:27017
DB_NAME=ceo_office
JWT_SECRET=replace-with-a-strong-random-secret
CORS_ORIGINS=http://localhost:5173,https://your-vercel-domain.vercel.app
COOKIE_SECURE=true
COOKIE_SAMESITE=none
```

## GitHub upload
Do not commit real `.env` files. Commit `.env.example` only.

```bash
git init
git add .
git commit -m "Prepare CEO Office for Vite and Vercel deployment"
git branch -M main
git remote add origin <your-repository-url>
git push -u origin main
```
