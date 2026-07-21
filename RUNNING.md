# Running Campus Access (Local)

Quick guide to run the **backend** and **frontend** on your machine.

## App map

| URL | Purpose |
|-----|---------|
| `/` | **Gate** — phone IP cam scan → Access granted / denied + reason |
| `/admin` | **Admin** — PIN `0852` — register student/staff, areas, blacklist, delete |

**Optimal area model:** Admin defines areas (open vs staff-only). Gate selects the active area (saved in the browser). Students may enter open areas; staff-only areas deny students with a clear reason.

Project root:

```text
~/Documents/Works/Projects/faruk
```

| App | Stack | Default URL |
|-----|--------|-------------|
| Backend | FastAPI + FaceNet + SQLite | `http://localhost:8001` (or `8000` if free) |
| Frontend | Vite + React | `http://localhost:5173` |

> **Use two terminals** — one for the API, one for the UI.

---

## Prerequisites

- **Python 3.11 or 3.12 only** (not 3.13/3.14) — check with `python3.12 -V`
- **Node.js 18+** (20+ recommended) — check with `node -v`
- Webcam (laptop or phone on same network)
- ~2 GB free disk for first PyTorch install

---

## One-time setup

### A. Backend (first time)

```bash
cd ~/Documents/Works/Projects/faruk/backend

# Create venv with Python 3.12 (required)
python3.12 -m venv .venv
source .venv/bin/activate

# Confirm: must print 3.12.x
python -V

pip install --upgrade pip
pip install -r requirements.txt
```

Optional env file (defaults work for local Vite):

```bash
cp .env.example .env
# Edit if needed:
#   ALLOWED_ORIGIN=http://localhost:5173
#   MATCH_THRESHOLD=0.6
#   SQLITE_PATH=./campus_access.db
```

### B. Frontend (first time)

```bash
cd ~/Documents/Works/Projects/faruk/frontend

# Face detector weights (required — without these the camera UI fails)
mkdir -p public/models
cd public/models
curl -fLO https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/tiny_face_detector_model-weights_manifest.json
curl -fLO https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/tiny_face_detector_model-shard1
cd ../..

# Env — point at your backend port (see Port notes below)
cp .env.example .env
# Example if API runs on 8001:
#   VITE_API_URL=http://localhost:8001

npm install
```

You need these two files under `frontend/public/models/`:

- `tiny_face_detector_model-weights_manifest.json`
- `tiny_face_detector_model-shard1`

---

## Every time you run (daily)

### Terminal 1 — Backend

```bash
cd ~/Documents/Works/Projects/faruk/backend
source .venv/bin/activate

# If 8000 is free:
export PORT=8000
# If 8000 is busy (e.g. Docker), use:
# export PORT=8001

uvicorn main:app --host 0.0.0.0 --port $PORT
```

**Success looks like:**

```text
Database schema ready
Loading InceptionResnetV1 (VGGFace2) on CPU…
Embedding model ready (512-d output).
Application startup complete.
```

First start may download ~107 MB of model weights and take 1–2 minutes.

**Checks:**

| URL | Expect |
|-----|--------|
| http://localhost:PORT/health | `"status":"ok"`, `"model_loaded":true` |
| http://localhost:PORT/docs | Swagger UI |

Stop with `Ctrl+C`. Leave the venv with `deactivate`.

### Terminal 2 — Frontend

```bash
cd ~/Documents/Works/Projects/faruk/frontend

# .env must match backend port, e.g.:
#   VITE_API_URL=http://localhost:8001
# Restart Vite after any .env change.

npm run dev
```

Open the URL Vite prints (usually **http://localhost:5173**).

Allow **camera** access when the browser asks.

---

## Port notes (important)

On this machine, **port 8000 is often taken by Docker**. If you see:

```text
[Errno 98] address already in use
```

use another port:

```bash
export PORT=8001
uvicorn main:app --host 0.0.0.0 --port $PORT
```

and set the frontend to match:

```env
# frontend/.env
VITE_API_URL=http://localhost:8001
```

Then restart Vite (`Ctrl+C`, then `npm run dev`).

---

## Test the full loop

1. Backend healthy (`/health` → `model_loaded: true`).
2. Frontend open; status under the camera is **not** “Camera setup is incomplete”.
3. Wait until you see **Face ready** (or a face lock on the preview).
4. Switch to **Register** → enter your name → **Register face**.
5. Switch to **Check in** → **Verify face**.
6. Expect **Access granted** with your name.

---

## Environment variables

### Backend (`backend/.env` or shell)

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `8000` | Listen port (set in shell for uvicorn) |
| `ALLOWED_ORIGIN` | `http://localhost:5173` | CORS — must match frontend origin |
| `MATCH_THRESHOLD` | `0.6` | Cosine similarity cutoff |
| `SQLITE_PATH` | `./campus_access.db` | SQLite file path |

### Frontend (`frontend/.env`)

| Variable | Example | Purpose |
|----------|---------|---------|
| `VITE_API_URL` | `http://localhost:8001` | Backend base URL, **no trailing slash** |
| `VITE_FACE_MODEL_URL` | `/models` | Optional; default is fine |

Vite only reads `VITE_*` vars at **start** time — always restart `npm run dev` after edits.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|--------|-----|
| `Camera setup is incomplete` | Missing face-api model files | Download the two files into `frontend/public/models/` (see one-time setup) |
| `address already in use` on 8000 | Docker or another process | Use `PORT=8001` and update `VITE_API_URL` |
| `Could not reach the server` / network error | Backend down or wrong URL | Start uvicorn; match `VITE_API_URL` to port; restart Vite |
| CORS error in browser console | Origin not allowed | Set `ALLOWED_ORIGIN=http://localhost:5173` on backend |
| `No matching distribution` / pip conflicts | Wrong Python (3.14) | Recreate venv: `rm -rf .venv && python3.12 -m venv .venv` |
| `facenet-pytorch` vs torch/numpy/Pillow conflict | Wrong pins | Use the repo `requirements.txt` as-is with Python 3.12 |
| `No face in view` | Lighting / angle | Center face; wait for **Face ready** |
| `Access denied` on first try | Nobody enrolled yet | Use **Register** first |
| Camera permission denied | Browser blocked camera | Allow camera for localhost; use HTTPS or localhost only |
| Health ok but UI points at Render | `VITE_API_URL` is remote | For local API set `VITE_API_URL=http://localhost:PORT` |

### Quick health checks

```bash
# Backend (replace 8001 with your PORT)
curl http://localhost:8001/health

# Model files present
ls ~/Documents/Works/Projects/faruk/frontend/public/models/

# Venv Python version
~/Documents/Works/Projects/faruk/backend/.venv/bin/python -V
```

---

## Phone testing (same Wi‑Fi)

1. Start backend with `--host 0.0.0.0` (already in the command above).
2. Start frontend (`npm run dev` — Vite prints a Network URL).
3. Set `VITE_API_URL` to your PC’s LAN IP, e.g. `http://192.168.x.x:8001`.
4. Set backend `ALLOWED_ORIGIN` to the phone’s frontend origin (or the Vite network URL).
5. Open the Vite **Network** URL on the phone; allow camera.

---

## Minimal copy-paste (after one-time setup)

**Terminal 1**

```bash
cd ~/Documents/Works/Projects/faruk/backend
source .venv/bin/activate
export PORT=8001
uvicorn main:app --host 0.0.0.0 --port $PORT
```

**Terminal 2**

```bash
cd ~/Documents/Works/Projects/faruk/frontend
# ensure .env has: VITE_API_URL=http://localhost:8001
npm run dev
```

Open **http://localhost:5173** → Register → Check in.

---

## What talks to what

```text
Browser camera
    → face-api.js TinyFaceDetector (local /models files)
    → crop face → POST /enroll or POST /recognize
         → FastAPI (VITE_API_URL)
              → FaceNet embedding + SQLite match
```

- **Camera / “Face ready”** = frontend models only  
- **Register / Verify result** = backend API  

If the camera message fails, fix `/models`. If Register fails with network errors, fix backend URL and port.
