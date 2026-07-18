# face-api.js TinyFaceDetector models

This app loads **only** the TinyFaceDetector weights (no SSD MobileNet, landmarks, or recognition net).

Place these two files in this folder (`frontend/public/models/`):

- `tiny_face_detector_model-weights_manifest.json`
- `tiny_face_detector_model-shard1`

## Download (from the face-api.js weights repo)

```bash
cd frontend/public/models

curl -LO https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/tiny_face_detector_model-weights_manifest.json
curl -LO https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/tiny_face_detector_model-shard1
```

Or open those URLs in a browser and save the files here.

After download, Vite serves them at `/models/...` automatically.
