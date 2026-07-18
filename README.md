# Campus Access

AI-based face recognition prototype for **campus access control** 

A user opens the web app on a phone browser, grants camera access, and either:

1. **Enrolls** a new face (name + cropped face sample), or  
2. **Recognizes** whether the face is known or unknown.

**Detection** runs client-side in the browser (TinyFaceDetector). **Embedding + matching** run on the server (FaceNet / InceptionResnetV1 on VGGFace2, 512-d vectors, cosine similarity).

## Architecture

```
/frontend   React + Vite + Tailwind CSS 3.4.17 + react-webcam + face-api.js (TinyFaceDetector only)
/backend    FastAPI + facenet-pytorch + SQLite + cosine matching
```

| Concern              | Where                         | Tech                                      |
|----------------------|-------------------------------|-------------------------------------------|
| Camera               | Browser                       | `react-webcam` / `getUserMedia`           |
| Face detection       | Browser                       | `face-api.js` TinyFaceDetector only       |
| Face crop → base64   | Browser                       | Canvas                                    |
| Embedding (512-d)    | Server                        | `facenet-pytorch` InceptionResnetV1       |
| Storage              | Server                        | SQLite (`personnel`, `embeddings`, `access_log`) |
| Matching             | Server                        | Cosine similarity, threshold default `0.6`|

Deploy targets: **Vercel** (frontend) · **Render** (backend).

---

## Repository layout

```
faruk/
├── DESIGN (3).md          # Visual style reference
├── README.md
├── .gitignore
├── backend/
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── schemas.py
│   ├── services/
│   │   ├── embedding.py
│   │   └── matching.py
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── index.html
    ├── .env.example
    ├── public/models/     # TinyFaceDetector weights (download — see below)
    └── src/
```

---

## Prerequisites

- **Node.js** 18+ (recommend 20+)
- **Python** 3.10+ (3.11 recommended)
- A webcam (phone or laptop)
- ~1–2 GB free disk for PyTorch CPU wheels on first install

---

## Local setup — Backend

```bash
cd backend

# Create and activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# Install dependencies (CPU-only PyTorch via extra index in requirements.txt)
pip install -r requirements.txt

# Environment
cp .env.example .env
# Edit .env if needed — defaults work for local Vite on port 5173

# Run (PORT required pattern for Render compatibility)
export PORT=8001
uvicorn main:app --host 0.0.0.0 --port $PORT
```

- API docs: http://localhost:8000/docs  
- Health: http://localhost:8000/health  

First start downloads VGGFace2 pretrained weights (~100MB) and loads the model into memory. Cold start can take 30–90 seconds on a laptop.

### Backend environment variables

| Variable           | Default                     | Description                                      |
|--------------------|-----------------------------|--------------------------------------------------|
| `ALLOWED_ORIGIN`   | `http://localhost:5173`     | Comma-separated CORS origins                     |
| `MATCH_THRESHOLD`  | `0.6`                       | Cosine similarity cutoff for a positive match    |
| `SQLITE_PATH`      | `./campus_access.db`        | SQLite file path                                 |
| `PORT`             | `8000` (local convention)   | Listen port — **do not hardcode** in production  |

### API

| Method | Path          | Body                                      | Notes |
|--------|---------------|-------------------------------------------|-------|
| POST   | `/enroll`     | `{ "name": string, "image": base64 }`     | Creates personnel if name is new; else adds another embedding sample |
| POST   | `/recognize`  | `{ "image": base64 }`                     | Best-match cosine; logs every attempt to `access_log` |
| GET    | `/personnel`  | —                                         | List enrolled people (API only; no admin UI) |
| GET    | `/health`     | —                                         | Model + threshold status |

`image` may be a raw base64 string or a data URL (`data:image/jpeg;base64,...`).

---

## Local setup — Frontend

### 1. Download TinyFaceDetector weights

```bash
cd frontend/public/models

curl -LO https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/tiny_face_detector_model-weights_manifest.json
curl -LO https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/tiny_face_detector_model-shard1
```

You need **only** these two files (not SSD MobileNet, landmarks, or recognition nets).

### 2. Install and run

```bash
cd frontend

cp .env.example .env
# VITE_API_URL=http://localhost:8000

npm install
npm run dev
```

Open http://localhost:5173 (or the LAN URL Vite prints for phone testing).

### Frontend environment variables

| Variable              | Default                 | Description                          |
|-----------------------|-------------------------|--------------------------------------|
| `VITE_API_URL`        | `http://localhost:8000` | Backend base URL (no trailing slash) |
| `VITE_FACE_MODEL_URL` | `/models`               | Base path for TinyFaceDetector files |

---

## Test the enroll → recognize loop locally

1. Start **backend** on port 8000; wait until `/health` shows `"model_loaded": true`.
2. Start **frontend**; allow camera permission.
3. Wait until the UI says the face detector is ready and a white box locks onto your face.
4. Switch to **Enroll new face**, type your name, click **Capture & enroll**.
5. Switch to **Recognize face**, click **Capture & recognize**.
6. Expect a success card with your name and a **cosine confidence** (e.g. `0.75`).
7. Optional: enroll a second sample of the same name (adds another embedding; matching uses **best score**).
8. Have a different person try recognize — should return **Unknown face** (if score &lt; threshold).

### Common issues

| Symptom | Fix |
|---------|-----|
| “Could not load the face detector model” | Weights missing under `frontend/public/models/` |
| Camera permission denied | Browser site settings → allow camera; HTTPS or localhost required |
| “No face detected” | Better light, face the camera, move closer |
| CORS error in browser console | Set `ALLOWED_ORIGIN` on backend to the exact frontend origin |
| Network / failed to fetch | Confirm `VITE_API_URL` and that uvicorn is running |
| First recognize: “No enrolled faces yet” | Enroll at least one person first |
| Low confidence / wrong unknown | Enroll 2–3 samples per person; adjust `MATCH_THRESHOLD` (try `0.5`–`0.7`) |

---

## Deployment

### Backend → Render

1. Push this repo to GitHub.
2. [Render](https://render.com) → **New Web Service** → connect the repo.
3. Settings:
   - **Root Directory:** `backend`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Environment variables:
   - `ALLOWED_ORIGIN` = `https://your-frontend.vercel.app` (exact Vercel URL)
   - `MATCH_THRESHOLD` = `0.6` (optional)
   - `SQLITE_PATH` = `/tmp/campus_access.db`  
     *(Render free disk is ephemeral — DB resets on redeploy; fine for a prototype demo.)*
5. Choose a plan with enough RAM for PyTorch CPU (free tier may be tight; starter is safer).
6. Deploy and copy the service URL (e.g. `https://campus-access-api.onrender.com`).
7. Hit `/health` until `model_loaded` is true (first boot downloads weights).

### Frontend → Vercel

1. [Vercel](https://vercel.com) → **New Project** → import the same repo.
2. Settings:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Environment variables:
   - `VITE_API_URL` = `https://your-service.onrender.com` (no trailing slash)
4. Ensure TinyFaceDetector model files are committed under `frontend/public/models/` so they ship with the static build.
5. Deploy. Update Render’s `ALLOWED_ORIGIN` if the Vercel URL changed.

### Post-deploy checklist

- [ ] Frontend loads over HTTPS (camera requires secure context except localhost)
- [ ] Camera permission prompt appears on phone
- [ ] Bounding box draws on a face
- [ ] Enroll succeeds
- [ ] Recognize returns the enrolled name
- [ ] Unknown person returns not recognized

---

## Design notes (UI)

- **Desktop:** 50/50 cream (camera) | void (controls).  
- **Mobile:** stacked cream top / void bottom.  
- **No shadows**, 6px buttons, 10px video tile, monochrome + cream only.  
- **One** display headline (`ACCESS BY FACE`, weight 900).  
- Fonts: **Inter** (body 300–400, display 900) as free substitutes for Telka / TelkaExtended.

Full token list and component rules: see `DESIGN (3).md`.

---

## What this prototype intentionally omits

- Continuous video streaming, websockets, queues  
- Auth / login  
- Multi-camera  
- GPU code  
- Email alerts / real-time admin dashboards  

Those are out of scope for this POC.

---

## License

Academic prototype — use and modify for coursework as needed.
