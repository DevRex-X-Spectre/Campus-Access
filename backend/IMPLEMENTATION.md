# Implementation Report: Campus Access Face Recognition System

## Project Overview

Campus Access is an AI-based face recognition prototype designed for campus access control. The system allows a user to open a web application, activate a camera, register a face, and later verify whether a captured face belongs to a registered person. It is implemented as a full-stack web application with a React frontend and a FastAPI backend.

The major idea behind the project is to replace or support manual identity checking with a biometric verification flow. The system captures a user's face from a browser camera or phone IP-camera snapshot, detects the face in the browser, crops the detected face, sends the cropped image to the backend, generates a machine-learning face embedding, and compares that embedding with stored embeddings in the database.

The project is a prototype, so it focuses on the core access-control workflow:

1. Register a person by name and face image.
2. Capture a face for verification.
3. Compare the captured face against registered records.
4. Return access granted or access denied.
5. Keep records of recognition attempts.

## Chapter Four: System Implementation

## 4.1 Introduction

This chapter explains how the Campus Access system was implemented. It covers the architecture, development tools, frontend implementation, backend implementation, database structure, API design, face detection pipeline, embedding generation, matching algorithm, deployment setup, and testing process.

The system was designed as a web-based application so that it can run on common devices such as laptops and mobile phones without requiring a separate desktop application. The frontend handles user interaction, camera access, face detection, and image cropping. The backend handles model inference, enrollment storage, recognition matching, and access logging.

## 4.2 System Architecture

The system uses a client-server architecture.

The frontend is responsible for:

- Displaying the user interface.
- Opening the device camera through the browser.
- Supporting a phone IP-camera snapshot source.
- Loading TinyFaceDetector model files.
- Detecting the largest visible face.
- Drawing the face overlay on the preview.
- Cropping the detected face into a base64 JPEG.
- Sending enrollment and recognition requests to the backend.
- Displaying success or failure responses.

The backend is responsible for:

- Starting the FastAPI web server.
- Initializing the SQLite database.
- Loading the FaceNet embedding model.
- Receiving cropped face images.
- Decoding base64 image data.
- Preprocessing images to the model input format.
- Generating 512-dimensional face embeddings.
- Storing personnel and face embeddings.
- Matching captured embeddings against stored embeddings.
- Logging access attempts.
- Exposing health, enrollment, recognition, personnel, and IP-camera proxy endpoints.

The architecture can be represented as follows:

```text
User Camera / Phone IP Camera
        |
        v
React Frontend
        |
        | Face detection with TinyFaceDetector
        | Face crop converted to base64 JPEG
        v
FastAPI Backend
        |
        | FaceNet / InceptionResnetV1 embedding generation
        | Cosine similarity matching
        v
SQLite Database
```

## 4.3 Technologies Used

The project uses the following technologies:

| Layer | Technology | Purpose |
| --- | --- | --- |
| Frontend | React | Building the user interface |
| Frontend build tool | Vite | Fast development server and production build |
| Styling | Tailwind CSS | Responsive and consistent interface styling |
| Camera access | react-webcam | Browser webcam integration |
| Face detection | face-api.js TinyFaceDetector | Detecting faces in the browser |
| Backend | FastAPI | REST API implementation |
| Server | Uvicorn | ASGI server for running FastAPI |
| AI model | facenet-pytorch InceptionResnetV1 | Generating face embeddings |
| ML runtime | PyTorch CPU | Running the embedding model |
| Image processing | Pillow, torchvision transforms | Decoding and preprocessing images |
| Numerical processing | NumPy | Cosine similarity and vector handling |
| Database | SQLite | Local persistence for personnel, embeddings, and access logs |
| Deployment | Render | Hosting backend and frontend services |

## 4.4 Repository Structure

The project is divided into two main directories:

```text
faruk/
├── backend/
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── schemas.py
│   ├── requirements.txt
│   ├── runtime.txt
│   ├── .python-version
│   └── services/
│       ├── embedding.py
│       └── matching.py
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── public/models/
    └── src/
        ├── App.jsx
        ├── api/client.js
        ├── components/
        ├── hooks/
        └── lib/
```

The backend folder contains the API, database helpers, schemas, AI embedding service, and matching logic. The frontend folder contains the browser application, camera components, face detection utilities, and API client.

## 4.5 Frontend Implementation

## 4.5.1 User Interface

The frontend is implemented using React and Vite. The main application component is `App.jsx`. It manages the current user action, either recognition or enrollment, and coordinates the camera panel and control panel.

The interface is split into two main sections:

- `CameraPanel.jsx`: Displays the camera preview, camera source selector, IP-camera URL input, face detection overlay, and camera status.
- `ControlPanel.jsx`: Displays the mode selector, name input for registration, submit button, and status messages.

On desktop screens, the layout appears as a side-by-side interface. On mobile screens, the camera section stays at the top and the controls are placed below it in a scrollable area. This design makes the application usable on both laptop and phone browsers.

## 4.5.2 Camera Sources

The frontend supports two camera sources:

1. PC camera:
   The system uses `react-webcam` to access the user's webcam through the browser's `getUserMedia` API.

2. Phone IP camera:
   The user can enter a phone snapshot URL, such as a URL from an IP Webcam application. The frontend requests snapshots repeatedly through the backend proxy endpoint. This is useful when the computer does not have a good camera or when a mobile device is preferred for capturing faces.

The selected camera source is stored in the `CameraPanel` component using React state. For PC camera mode, the source is an HTML video element. For IP-camera mode, the source is an HTML image element that refreshes at intervals.

## 4.5.3 Face Detection in the Browser

Face detection is performed on the frontend using `face-api.js` and the TinyFaceDetector model. The model files are stored in:

```text
frontend/public/models/
```

The face detection logic is implemented in:

```text
frontend/src/lib/faceDetection.js
frontend/src/hooks/useFaceDetection.js
```

The `loadTinyFaceDetector` function loads the TinyFaceDetector weights once. Before loading, it checks whether the model manifest file is available. This prevents a common error where a missing model file returns the application's `index.html` instead of the JSON model manifest.

The `useFaceDetection` hook repeatedly runs detection using `requestAnimationFrame`. It does not run detection continuously without control. Instead, it checks an interval so that detection happens at a manageable rate. The hook returns:

- `detectorReady`: whether the model is loaded.
- `detectorError`: whether loading failed.
- `displayBox`: the face box mapped to the visible preview size.
- `mediaBox`: the face box in the original image/video pixel space.
- `score`: the detection confidence from TinyFaceDetector.

The system selects the largest detected face. This is appropriate for an access-control selfie workflow because the person requesting access is expected to be the closest and most centered face.

## 4.5.4 Face Overlay

The detected face is displayed using `FaceOverlay.jsx`. The overlay draws corner brackets around the detected face. The overlay box must match the displayed preview, so the system converts the original media-space coordinates into CSS-pixel coordinates.

For webcam mode, the preview is mirrored for a natural selfie experience. The overlay logic accounts for this by flipping the X coordinate for display. The actual crop sent to the backend is not mirrored, so the backend receives a normal face image.

## 4.5.5 Face Cropping

After a face is detected, the frontend crops the face before sending it to the backend. This is done by the `cropFaceToBase64` function.

The crop process works as follows:

1. Get the detected face box in media pixels.
2. Add padding around the face so that the embedding model receives more complete facial context.
3. Clamp the crop area so it does not exceed the image boundaries.
4. Draw the crop onto a square canvas.
5. Convert the canvas output to a JPEG data URL.
6. Send the base64 image to the backend.

The square crop is useful because the backend later resizes the image to 160 by 160 pixels for the FaceNet model.

## 4.5.6 API Client

The frontend communicates with the backend through `frontend/src/api/client.js`.

The backend URL is controlled by:

```text
VITE_API_URL
```

If the environment variable is not provided, it defaults to:

```text
http://localhost:8000
```

The API client provides functions for:

- `enrollFace`: sends a name and face image to `/enroll`.
- `recognizeFace`: sends a face image to `/recognize`.
- `fetchHealth`: checks `/health`.
- `getIpCameraSnapshotUrl`: builds the URL for the IP-camera proxy endpoint.

## 4.6 Backend Implementation

## 4.6.1 FastAPI Application

The backend is implemented in `backend/main.py` using FastAPI. The application exposes REST endpoints for health checking, enrollment, recognition, personnel listing, and IP-camera snapshot proxying.

The backend uses a lifespan function that runs at startup. During startup, it:

1. Initializes the database schema.
2. Loads the face embedding model.

If the model fails to load, the server logs the error clearly. This is important for deployment because the model can take time to download and load on first boot.

The backend currently allows requests from all origins using FastAPI's CORS middleware:

```text
allow_origins = ["*"]
allow_credentials = False
allow_methods = ["*"]
allow_headers = ["*"]
```

This was configured to make the deployed frontend communicate with the deployed backend without browser CORS errors during prototype testing.

## 4.6.2 Configuration

Runtime configuration is handled in `backend/config.py`.

The main configuration values are:

| Variable | Default | Purpose |
| --- | --- | --- |
| `MATCH_THRESHOLD` | `0.6` | Minimum cosine similarity required for recognition |
| `ALLOWED_ORIGIN` | `http://localhost:5173` | Original CORS configuration value |
| `DATABASE_URL` | `sqlite:///./campus_access.db` | Present for future database expansion |
| `SQLITE_PATH` | `./campus_access.db` | Actual SQLite file path used by the system |

Although `DATABASE_URL` exists in configuration, the current implementation uses Python's `sqlite3` module directly. Therefore, simply setting a PostgreSQL database URL will not switch the application to PostgreSQL unless the persistence layer is rewritten.

## 4.6.3 Database Implementation

The database logic is implemented in `backend/database.py`. SQLite is used because it is simple, lightweight, and suitable for a prototype.

The database contains three main tables:

### Personnel Table

The `personnel` table stores registered people.

| Column | Type | Description |
| --- | --- | --- |
| `id` | INTEGER PRIMARY KEY | Unique personnel ID |
| `name` | TEXT | Name of the registered person |
| `created_at` | TEXT | Registration timestamp |

### Embeddings Table

The `embeddings` table stores face embeddings.

| Column | Type | Description |
| --- | --- | --- |
| `id` | INTEGER PRIMARY KEY | Unique embedding ID |
| `personnel_id` | INTEGER | Linked personnel record |
| `embedding` | TEXT | JSON-encoded 512-dimensional vector |
| `created_at` | TEXT | Timestamp when embedding was saved |

One person can have multiple embeddings. This allows the system to store several face samples for the same person, improving recognition reliability.

### Access Log Table

The `access_log` table stores recognition attempts.

| Column | Type | Description |
| --- | --- | --- |
| `id` | INTEGER PRIMARY KEY | Unique log ID |
| `personnel_id` | INTEGER NULL | Linked person if recognized |
| `recognized` | INTEGER | 1 for recognized, 0 for not recognized |
| `timestamp` | TEXT | Time of recognition attempt |

The system logs both successful and unsuccessful recognition attempts. This is important for auditability in an access-control system.

## 4.6.4 Database Session Handling

The backend uses a `db_session` context manager. It opens a SQLite connection, yields it to the calling function, commits changes if the operation succeeds, rolls back if an error occurs, and closes the connection afterward.

This approach helps avoid leaving database connections open and provides basic transaction safety for enrollment and recognition operations.

## 4.6.5 Data Validation

Request and response schemas are implemented in `backend/schemas.py` using Pydantic.

The main request models are:

- `EnrollRequest`: requires a non-empty name and a non-empty image.
- `RecognizeRequest`: requires a non-empty image.

The validators strip whitespace and reject blank values. This prevents invalid records such as empty names or empty image payloads.

The main response models are:

- `EnrollResponse`
- `RecognizeResponse`
- `PersonnelListResponse`
- `HealthResponse`

Using Pydantic schemas makes the API predictable and helps FastAPI automatically document the endpoints.

## 4.7 Face Embedding Implementation

Face embedding generation is implemented in:

```text
backend/services/embedding.py
```

The backend uses `facenet-pytorch` and the `InceptionResnetV1` model pretrained on VGGFace2. The model produces a 512-dimensional embedding vector for each face image.

The model is loaded once at application startup and stored in memory. A thread lock is used to prevent multiple simultaneous model-loading operations.

The embedding pipeline follows these steps:

1. Receive a base64 image string from the frontend.
2. Remove the data URL prefix if present.
3. Decode the base64 data into bytes.
4. Open the image with Pillow.
5. Convert the image to RGB.
6. Resize it to 160 by 160 pixels.
7. Convert it to a tensor.
8. Normalize pixel values using mean `0.5` and standard deviation `0.5`.
9. Run the image through InceptionResnetV1.
10. L2-normalize the resulting embedding.
11. Return the embedding as a Python list of floats.

The model runs on CPU. Gradients are disabled because the application only performs inference and does not train the model.

## 4.8 Matching Algorithm

The matching logic is implemented in:

```text
backend/services/matching.py
```

The system uses cosine similarity to compare embeddings. Cosine similarity measures how close two vectors are in direction. Since face embeddings are L2-normalized, cosine similarity is suitable for comparing whether two face images represent the same person.

The recognition algorithm works as follows:

1. Generate an embedding for the captured face.
2. Fetch all stored embeddings from the database.
3. Compare the captured embedding with every stored embedding.
4. Keep the highest cosine similarity score.
5. If the highest score is greater than or equal to `MATCH_THRESHOLD`, return the associated person.
6. If the highest score is below the threshold, return unknown.
7. Log the recognition attempt.

The default threshold is:

```text
0.6
```

This threshold can be adjusted using the `MATCH_THRESHOLD` environment variable. A lower threshold makes the system more likely to recognize a person but can increase false acceptance. A higher threshold makes the system stricter but can increase false rejection.

## 4.9 API Endpoints

The backend exposes the following endpoints:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/health` | Returns system health, model status, and match threshold |
| POST | `/enroll` | Registers a new person or adds another face sample to an existing person |
| POST | `/recognize` | Checks whether a captured face matches a stored person |
| GET | `/personnel` | Lists registered personnel and embedding counts |
| GET | `/ip-camera/snapshot` | Fetches a phone IP-camera image through the backend |

## 4.9.1 Enrollment Endpoint

The `/enroll` endpoint receives:

```json
{
  "name": "Student Name",
  "image": "base64-image"
}
```

The process is:

1. Check that the model is loaded.
2. Generate an embedding from the submitted image.
3. Search the database for an existing person with the same name.
4. If the person exists, reuse the existing personnel ID.
5. If the person does not exist, create a new personnel record.
6. Store the generated embedding.
7. Return a success response.

If a person registers more than once using the same name, the system stores another embedding sample under the same person instead of creating a duplicate name entry.

## 4.9.2 Recognition Endpoint

The `/recognize` endpoint receives:

```json
{
  "image": "base64-image"
}
```

The process is:

1. Check that the model is loaded.
2. Generate an embedding from the submitted image.
3. Fetch all saved embeddings.
4. If no embeddings exist, return a message asking the user to register first.
5. Find the best match using cosine similarity.
6. Return access granted if the score meets the threshold.
7. Return access denied if no score meets the threshold.
8. Save the attempt in the access log.

## 4.9.3 IP-Camera Snapshot Endpoint

The `/ip-camera/snapshot` endpoint allows the frontend to fetch an image from a phone camera URL through the backend.

This endpoint is useful because many phone IP-camera apps do not include CORS headers. If the browser tries to fetch the image directly, the browser may block it. By proxying the request through the backend, the frontend can still display and process the image.

The endpoint validates that the submitted URL uses `http` or `https`, limits the snapshot size to 5 MB, uses a 3-second timeout, and only accepts responses whose content type starts with `image/`.

## 4.10 Deployment Implementation

The project was prepared for deployment on Render.

The backend runs as a Render Web Service. Important backend settings are:

```text
Root Directory: backend
Build Command: pip install -r requirements.txt
Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT
Python Version: 3.12.8
```

The frontend runs as a Render Static Site. Important frontend settings are:

```text
Root Directory: frontend
Build Command: npm install && npm run build
Publish Directory: dist
```

The frontend must be built with:

```text
VITE_API_URL=https://campus-access.onrender.com
```

This allows the deployed frontend to call the deployed backend.

The backend uses SQLite by default. On Render's normal service filesystem, local SQLite files may not be permanently reliable after redeploys or restarts. For a production system, the project should use persistent disk storage or migrate the database layer to PostgreSQL.

## 4.11 Testing

Testing was performed through the normal user workflow.

## 4.11.1 Camera Test

The camera test verifies that:

- The browser asks for camera permission.
- The webcam preview is displayed.
- The IP-camera source can accept a snapshot URL.
- Errors are shown if camera permission is denied or the camera cannot be opened.

## 4.11.2 Face Detection Test

The face detection test verifies that:

- TinyFaceDetector model files load from `/models`.
- The application detects a face in the preview.
- The overlay follows the detected face.
- The system displays "Face ready" when a usable face is detected.

## 4.11.3 Enrollment Test

The enrollment test verifies that:

- The user can enter a name.
- A detected face can be cropped.
- The frontend sends the name and base64 image to the backend.
- The backend generates a 512-dimensional embedding.
- The database stores the personnel record and embedding.
- The frontend displays a registration success message.

## 4.11.4 Recognition Test

The recognition test verifies that:

- The frontend captures a fresh face image.
- The backend compares the captured embedding with stored embeddings.
- The system grants access when the score meets the threshold.
- The system denies access when no stored embedding meets the threshold.
- The recognition attempt is written to the access log.

## 4.11.5 API Health Test

The `/health` endpoint verifies that:

- The API is reachable.
- The embedding model has loaded.
- The active match threshold is visible.

An expected healthy response contains:

```json
{
  "status": "ok",
  "model_loaded": true,
  "match_threshold": 0.6
}
```

## 4.12 Results and Observations

The implemented system successfully demonstrates the main concept of AI-based campus access control. A user can register a face and later verify identity using the camera. The system separates face detection and face recognition responsibilities clearly:

- Face detection is done on the client side.
- Face embedding and matching are done on the server side.

This separation reduces backend image-processing work because the backend receives only cropped face images. It also avoids sending continuous video streams to the server, which improves simplicity and reduces bandwidth usage.

The use of multiple embeddings per person improves flexibility. If a person registers several samples under the same name, the recognition process can match against any of those stored samples and select the best score.

The access log provides a basic audit trail by recording whether each recognition attempt was successful or unsuccessful.

## 4.13 Challenges Encountered

Several implementation challenges were addressed during development.

## 4.13.1 Browser Camera Restrictions

Modern browsers require camera access to run on `localhost` or HTTPS. This means that camera testing on deployed environments must use an HTTPS domain. The application handles camera permission errors and displays friendly messages to the user.

## 4.13.2 CORS Issues

The deployed frontend and backend run on different domains. Browsers block cross-origin requests unless the backend sends the proper CORS headers. During deployment testing, CORS was opened to allow all origins so the frontend could communicate with the backend.

## 4.13.3 AI Model Startup Time

The FaceNet model is large compared with normal web dependencies. On first deployment, the backend may take time to install PyTorch, download model weights, and load the model into memory. The `/health` endpoint helps confirm whether the model is ready.

## 4.13.4 SQLite Persistence on Render

SQLite works well for local development and prototype testing. However, normal cloud service filesystems may not preserve local database files reliably after redeploys or restarts. For long-term use, a persistent database solution is required.

## 4.13.5 IP-Camera CORS Limitations

Phone IP-camera apps may not include browser CORS headers. To solve this, the backend includes an IP-camera snapshot proxy endpoint. The frontend fetches the image through the backend instead of directly from the phone camera URL.

## 4.14 Security Considerations

The system is a prototype and does not yet include all production security features. Important security considerations include:

- Face images and embeddings are biometric data and should be protected.
- The current API does not require administrator authentication for enrollment.
- CORS is currently open for prototype testing.
- SQLite data should be stored securely if used beyond testing.
- HTTPS is required for secure camera use and API communication.
- Access logs should be protected from unauthorized access.

For production, authentication, authorization, encryption, stricter CORS rules, rate limiting, and stronger database protection should be added.

## Chapter Five: Summary, Conclusion, and Recommendations

## 5.1 Summary

This project implemented a web-based AI face recognition system for campus access control. The system provides two main workflows: registration and verification. During registration, a user's name and face image are captured, processed, and stored as a face embedding. During verification, a new face image is captured and compared with stored embeddings to decide whether access should be granted or denied.

The frontend was developed using React, Vite, Tailwind CSS, react-webcam, and face-api.js. It handles user interaction, camera access, face detection, face cropping, and communication with the backend. The backend was developed using FastAPI, PyTorch, facenet-pytorch, Pillow, NumPy, and SQLite. It handles model inference, database storage, matching, and logging.

The system uses TinyFaceDetector for browser-side face detection and FaceNet InceptionResnetV1 for backend-side embedding generation. Recognition is performed using cosine similarity with a configurable threshold.

## 5.2 Conclusion

The implementation demonstrates that face recognition can be used to support campus access control in a web-based environment. The project successfully combines frontend camera capture, client-side face detection, backend AI embedding generation, database storage, and similarity-based recognition into one working prototype.

The system shows that a user's face can be registered and later recognized without requiring continuous video streaming to the server. This makes the architecture simpler and more efficient. By storing embeddings instead of raw video streams, the system focuses on compact biometric representations for matching.

Although the application is a prototype, it provides a strong foundation for a more complete access-control system. It proves the feasibility of using browser cameras and AI models for identity verification in an academic campus environment.

## 5.3 Contributions of the Project

The main contributions of the project are:

- A functional web-based face recognition prototype for campus access control.
- A responsive frontend that supports PC webcam and phone IP-camera sources.
- Client-side face detection and cropping using TinyFaceDetector.
- Backend embedding generation using FaceNet InceptionResnetV1.
- SQLite database storage for personnel, embeddings, and access logs.
- Cosine similarity matching with a configurable recognition threshold.
- REST API endpoints for enrollment, recognition, personnel listing, health checking, and IP-camera proxying.
- Deployment-ready configuration for Render.

## 5.4 Limitations

The system has the following limitations:

- It does not include user login or administrator authentication.
- It does not include role-based access control.
- It uses SQLite, which is suitable for a prototype but not ideal for large-scale production deployment.
- It does not include liveness detection, so it may be vulnerable to photo presentation attacks.
- It does not include hardware integration such as automatic door locks or turnstiles.
- It does not include a full administrative dashboard.
- Recognition accuracy depends on image quality, lighting, camera angle, and the number of enrolled samples.
- The backend model can require significant memory and startup time on low-resource cloud hosting.

## 5.5 Recommendations

The following improvements are recommended for future work:

1. Add administrator authentication so that only authorized staff can enroll users.
2. Migrate the database from SQLite to PostgreSQL for production reliability.
3. Add persistent cloud storage and backup for biometric records.
4. Add liveness detection to reduce spoofing with printed photos or screen images.
5. Add an admin dashboard for viewing personnel, deleting records, and reviewing access logs.
6. Add role-based permissions for students, staff, visitors, and security personnel.
7. Add support for multiple campus gates or access points.
8. Add hardware integration for doors, gates, or attendance devices.
9. Improve the recognition threshold through controlled testing with a larger dataset.
10. Add rate limiting and request logging to reduce abuse.
11. Add stricter CORS settings after deployment testing is complete.
12. Encrypt sensitive data and protect biometric embeddings.

## 5.6 Final Remarks

Campus Access provides a practical implementation of an AI-assisted access-control system. It demonstrates how browser-based face capture, frontend detection, backend recognition, and database persistence can work together to solve an identity verification problem.

The project is suitable as an academic prototype because it clearly shows the full implementation flow from user interaction to recognition result. With additional security, persistence, liveness detection, and administrative features, it can be extended into a more complete campus access management solution.
