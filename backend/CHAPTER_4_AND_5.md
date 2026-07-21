# 4.0 CHAPTER FOUR: SYSTEM IMPLEMENTATION

This chapter presents the implementation of the Campus Access Face Recognition System. It describes the modules developed, the system interface, the functional implementation, testing procedure, results obtained, and discussion of the results. The chapter focuses on how the system was translated from design into a working application.

The system was implemented as a web-based face recognition application for campus access control. It allows a user to register a face with a name and later verify whether a captured face matches an already registered person. The application is divided into two major parts: the frontend interface and the backend recognition service.

The frontend handles camera access, face detection, face cropping, user interaction, and communication with the backend. The backend handles image decoding, face embedding generation, database storage, similarity matching, and access logging.

## 4.0.1 System Implementation Environment

The implementation environment used for the project is presented in Table 4.1.

**Table 4.1: System Implementation Environment**

| Component | Technology Used | Purpose |
| --- | --- | --- |
| Frontend framework | React | Development of the user interface |
| Frontend build tool | Vite | Development server and production build |
| Styling framework | Tailwind CSS | Responsive page styling |
| Camera library | react-webcam | Browser camera access |
| Face detection library | face-api.js | Client-side face detection |
| Backend framework | FastAPI | REST API development |
| Backend server | Uvicorn | Running the FastAPI application |
| Machine learning framework | PyTorch | Running the face recognition model |
| Face recognition model | FaceNet InceptionResnetV1 | Generation of face embeddings |
| Image processing | Pillow | Decoding and processing images |
| Numerical processing | NumPy | Vector comparison and similarity calculation |
| Database | SQLite | Storage of users, embeddings, and logs |
| Deployment platform | Render | Hosting of frontend and backend services |

## 4.0.2 System Modules

The system was implemented using modular components to separate responsibilities and improve maintainability. The major modules are described below.

### 4.0.2.1 Frontend Module

The frontend module provides the visual interface through which users interact with the system. It allows a user to select either registration mode or verification mode. In registration mode, the user enters a name and captures a face. In verification mode, the user captures a face for recognition.

The frontend also provides camera source selection. A user can use the computer webcam or a phone IP-camera snapshot URL. This improves flexibility because the system can still be tested on devices with poor or unavailable webcams.

### 4.0.2.2 Camera and Face Detection Module

The camera and face detection module handles live camera input and detection of the face area. The system uses TinyFaceDetector from face-api.js to detect the largest visible face in the camera preview. The detected face is highlighted with an overlay so that the user can confirm that the face is properly positioned.

After detection, the system crops the detected face area from the video or image source. The cropped image is converted into base64 JPEG format and sent to the backend for recognition processing.

### 4.0.2.3 Backend API Module

The backend API module was implemented with FastAPI. It receives requests from the frontend and returns structured responses. The main endpoints are used for health checking, enrollment, recognition, personnel listing, and IP-camera snapshot proxying.

The backend API also handles errors such as invalid image input, unavailable model state, database failure, and unreachable IP-camera snapshot URLs.

### 4.0.2.4 Face Embedding Module

The face embedding module converts the cropped face image into a numerical representation. The implementation uses FaceNet InceptionResnetV1 pretrained on VGGFace2. The model generates a 512-dimensional vector for each submitted face image.

Before the image is passed into the model, it is decoded, converted to RGB, resized to 160 by 160 pixels, transformed into a tensor, normalized, and passed through the model in inference mode. The final embedding is normalized so that similarity comparison can be performed reliably.

### 4.0.2.5 Matching Module

The matching module compares a newly captured face embedding with all stored embeddings in the database. The comparison is done using cosine similarity. The system checks all stored embeddings and selects the highest similarity score.

If the highest score is greater than or equal to the configured threshold, the person is recognized and access is granted. If the score is below the threshold, the person is treated as unknown and access is denied.

### 4.0.2.6 Database Module

The database module manages data storage using SQLite. It creates and maintains tables for personnel records, face embeddings, and access logs. Each registered person can have more than one stored embedding. This allows the system to store multiple face samples for the same person, which can improve recognition performance.

The access log records recognition attempts, including whether the user was recognized or not. This provides a basic audit trail for the access-control process.

## 4.0.3 System Interface

The system interface was designed to be simple and direct. It contains a camera section and a control section. The camera section displays the live camera feed or phone IP-camera image. The control section allows the user to choose between registration and verification.

The main interface elements are:

- Camera preview area.
- Camera source selector.
- Phone IP-camera URL input.
- Face detection overlay.
- Registration and verification mode selector.
- Name input field for registration.
- Action button for registering or verifying a face.
- Status message area for access granted, access denied, or error feedback.

<!-- Insert Screenshot 4.1: Main interface of the Campus Access system showing the camera preview and control panel. -->

<!-- Insert Screenshot 4.2: Registration interface showing the name field and face registration button. -->

<!-- Insert Screenshot 4.3: Verification interface showing the face detection overlay and verification button. -->

<!-- Insert Screenshot 4.4: Result display showing access granted or access denied feedback. -->

## 4.0.4 Enrollment Process

The enrollment process registers a new user or adds another face sample to an existing user. The steps involved are:

1. The user selects Register mode.
2. The user enters a valid name.
3. The camera module detects the face.
4. The detected face is cropped and converted to base64 format.
5. The frontend sends the name and image to the backend.
6. The backend generates a face embedding.
7. The backend checks whether the name already exists.
8. If the name is new, a personnel record is created.
9. The generated embedding is stored in the database.
10. The system returns a success message to the frontend.

This process allows multiple embeddings to be stored for one user. Additional samples can help the system recognize the user under different lighting, position, and camera conditions.

## 4.0.5 Recognition Process

The recognition process verifies whether a captured face belongs to a registered user. The steps involved are:

1. The user selects Check in mode.
2. The camera module detects the face.
3. The detected face is cropped and converted to base64 format.
4. The frontend sends the image to the backend.
5. The backend generates a face embedding.
6. The backend fetches all stored embeddings from the database.
7. The captured embedding is compared against each stored embedding.
8. The highest cosine similarity score is selected.
9. If the score meets the threshold, access is granted.
10. If the score does not meet the threshold, access is denied.
11. The recognition attempt is recorded in the access log.

## 4.0.6 Database Design

The system uses three main database tables. These are personnel, embeddings, and access_log.

**Table 4.2: Personnel Table**

| Field | Data Type | Description |
| --- | --- | --- |
| id | Integer | Unique identifier for each registered person |
| name | Text | Name of the registered person |
| created_at | Text | Date and time of registration |

**Table 4.3: Embeddings Table**

| Field | Data Type | Description |
| --- | --- | --- |
| id | Integer | Unique identifier for each embedding |
| personnel_id | Integer | Reference to the registered person |
| embedding | Text | Stored face embedding in JSON format |
| created_at | Text | Date and time the embedding was saved |

**Table 4.4: Access Log Table**

| Field | Data Type | Description |
| --- | --- | --- |
| id | Integer | Unique identifier for each access attempt |
| personnel_id | Integer | Reference to the recognized person, if any |
| recognized | Integer | Recognition status, where 1 means recognized and 0 means not recognized |
| timestamp | Text | Date and time of the access attempt |

## 4.0.7 API Implementation

The backend exposes REST API endpoints that allow communication between the frontend and the backend.

**Table 4.5: API Endpoints**

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | /health | Checks the API and model status |
| POST | /enroll | Registers a new face or adds another sample |
| POST | /recognize | Verifies a captured face |
| GET | /personnel | Lists registered personnel |
| GET | /ip-camera/snapshot | Fetches an IP-camera snapshot through the backend |

The `/health` endpoint is used to confirm whether the backend is available and whether the face embedding model has loaded. The `/enroll` endpoint handles face registration. The `/recognize` endpoint performs face matching and returns the recognition decision. The `/personnel` endpoint lists registered users and their number of stored samples. The `/ip-camera/snapshot` endpoint solves browser restrictions that may occur when loading images from a phone IP-camera application.

## 4.0.8 Recognition Threshold

The system uses a similarity threshold to determine whether a face should be accepted as a match. The default threshold is 0.6. When the best similarity score is equal to or higher than 0.6, the user is recognized. When the score is lower than 0.6, the user is not recognized.

The threshold affects the strictness of the system. A lower threshold may increase successful recognition but may also increase false acceptance. A higher threshold may reduce false acceptance but may increase false rejection.

## 4.0.9 Deployment Implementation

The project was prepared for deployment on Render. The backend is deployed as a web service, while the frontend is deployed as a static site.

**Table 4.6: Backend Deployment Configuration**

| Setting | Value |
| --- | --- |
| Platform | Render |
| Service type | Web Service |
| Root directory | backend |
| Build command | pip install -r requirements.txt |
| Start command | uvicorn main:app --host 0.0.0.0 --port $PORT |
| Python version | 3.12.8 |

**Table 4.7: Frontend Deployment Configuration**

| Setting | Value |
| --- | --- |
| Platform | Render |
| Service type | Static Site |
| Root directory | frontend |
| Build command | npm install && npm run build |
| Publish directory | dist |
| Backend URL variable | VITE_API_URL |

## 4.1 RESULTS

This section presents the results obtained from implementing and testing the Campus Access Face Recognition System.

## 4.1.1 Functional Test Results

The functional testing focused on confirming that each major feature of the system works as expected.

**Table 4.8: Functional Test Results**

| Test Case | Expected Result | Actual Result | Status |
| --- | --- | --- | --- |
| Open application | The frontend interface should load successfully | The interface loaded successfully | Passed |
| Activate PC camera | Browser should request camera permission and display preview | Camera preview was displayed after permission was granted | Passed |
| Load face detector | TinyFaceDetector model should load from the models folder | Face detector loaded successfully | Passed |
| Detect face | Face overlay should appear around detected face | Face overlay appeared when face was visible | Passed |
| Register face | Name and cropped face should be sent to backend and stored | Personnel and embedding were stored | Passed |
| Recognize registered face | System should return access granted | Registered face was recognized | Passed |
| Recognize unknown face | System should return access denied | Unknown face was rejected | Passed |
| List personnel | API should return registered users | Registered personnel were returned | Passed |
| Health check | API should return model and threshold status | Health response was returned | Passed |

## 4.1.2 Enrollment Result

The enrollment test confirmed that the system can register a user by name and store the user's face embedding in the database. When the same name is registered again, the system does not create a duplicate personnel record. Instead, it adds another embedding sample to the existing user.

**Table 4.9: Enrollment Result**

| Operation | Input | System Response | Result |
| --- | --- | --- | --- |
| New registration | Name and cropped face image | Registration successful | User record created |
| Additional registration | Existing name and new face image | Profile updated | New embedding added |
| Empty name registration | Empty name field | Error message | Registration rejected |
| No face detected | Camera image without usable face | Error message | Registration prevented |

<!-- Insert Screenshot 4.5: Successful registration result. -->

## 4.1.3 Recognition Result

The recognition test confirmed that the system can compare a newly captured face with stored face embeddings. A registered user was recognized when the best similarity score met the configured threshold. An unregistered user was denied access when the similarity score did not meet the threshold.

**Table 4.10: Recognition Result**

| Test Scenario | Expected Output | Actual Output | Result |
| --- | --- | --- | --- |
| Registered user attempts verification | Access granted | Access granted | Successful |
| Unregistered user attempts verification | Access denied | Access denied | Successful |
| Verification before registration | Message to register first | No enrolled faces message returned | Successful |
| Camera not ready | User should be asked to wait | Camera readiness error displayed | Successful |

<!-- Insert Screenshot 4.6: Successful recognition result showing access granted. -->

<!-- Insert Screenshot 4.7: Failed recognition result showing access denied. -->

## 4.1.4 API Response Results

The backend API returned structured responses for frontend use. The health endpoint confirmed the availability of the model and threshold configuration.

**Table 4.11: API Response Summary**

| Endpoint | Response Information |
| --- | --- |
| /health | Returns system status, model loading state, and match threshold |
| /enroll | Returns registration status, personnel ID, name, and whether the person is new |
| /recognize | Returns recognition status, name when recognized, confidence score, and message |
| /personnel | Returns registered personnel and embedding counts |
| /ip-camera/snapshot | Returns an image response from the supplied IP-camera URL |

## 4.1.5 Database Result

The database was able to store personnel records, face embeddings, and access logs. Each registration created or updated records in the personnel and embeddings tables. Each recognition attempt created a record in the access_log table.

**Table 4.12: Database Operation Result**

| Database Operation | Table Affected | Result |
| --- | --- | --- |
| Create new user | personnel | User details saved |
| Store face embedding | embeddings | Embedding stored as JSON text |
| Fetch embeddings | embeddings and personnel | Stored embeddings retrieved for matching |
| Log access attempt | access_log | Recognition attempt saved |
| List registered users | personnel and embeddings | Users and embedding counts returned |

## 4.2 DISCUSSION

The implementation results show that the Campus Access Face Recognition System achieved its main objective. The system was able to register users, detect faces, generate embeddings, compare captured faces with stored records, and return access decisions.

The use of a browser-based frontend made the system easy to access because users do not need to install a separate desktop application. The camera runs directly in the browser, and the interface provides immediate feedback when a face is detected. This improves usability because users can adjust their face position before submitting the image for registration or verification.

Client-side face detection reduced the amount of unnecessary data sent to the backend. Instead of sending full video frames or continuous video streams, the frontend sends only the cropped face image. This makes the system more efficient and easier to deploy.

The backend implementation using FastAPI provided a simple and structured API for the frontend. The use of Pydantic schemas improved input validation and made the request and response formats consistent. The backend also checks whether the embedding model is loaded before processing enrollment or recognition requests.

The embedding model produced 512-dimensional vectors that could be stored and compared efficiently. The cosine similarity method was suitable for comparing these embeddings because the vectors were normalized. The best-match approach allowed the system to compare a submitted face against all registered samples and choose the closest match.

The use of multiple embeddings per person is an important feature. It allows one user to register more than one face sample. This can improve recognition in real-life conditions where lighting, camera angle, facial expression, and distance from the camera may vary.

The SQLite database was suitable for the prototype because it is simple and requires no separate database server. However, for a production campus access system, a more reliable database such as PostgreSQL would be more appropriate. This is especially important when the system is deployed to cloud hosting, where local files may not always be persistent.

The test results also show that the system handles common error conditions. If the camera is not ready, the user is asked to wait. If no face is detected, the system prevents submission. If no users have been registered, the recognition endpoint returns a message asking the user to register first.

Overall, the system demonstrates a complete working prototype for AI-assisted campus access control. It provides the core functions required for registration, verification, and access logging.

# 5.0 CHAPTER FIVE: SUMMARY, CONCLUSION AND RECOMMENDATION

## 5.1 Summary

This project focused on the design and implementation of a face recognition system for campus access control. The system was developed to provide a simple method of verifying users through facial identity. It allows a person to register with a name and face image, and later verify identity by capturing a new face image.

The project was implemented as a full-stack web application. The frontend was developed using React, Vite, Tailwind CSS, react-webcam, and face-api.js. The backend was developed using FastAPI, PyTorch, facenet-pytorch, Pillow, NumPy, and SQLite.

The system uses the browser for camera access and face detection. Once a face is detected, the frontend crops the face and sends it to the backend. The backend generates a face embedding using FaceNet InceptionResnetV1 and compares it with stored embeddings using cosine similarity. If the similarity score meets the configured threshold, access is granted. If the score does not meet the threshold, access is denied.

The system also stores personnel records, face embeddings, and recognition attempts in a database. This provides a foundation for further development into a more complete access-control system.

## 5.2 Conclusion

The Campus Access Face Recognition System was successfully implemented as a working prototype. The system achieved its main objective of using facial recognition to support identity verification for campus access.

The implementation demonstrated that face detection can be performed in the browser while face embedding and matching can be handled by a backend service. This separation of tasks made the system efficient and practical for web deployment. The frontend provides a user-friendly interface for registration and verification, while the backend provides reliable processing and decision making.

The project proves that artificial intelligence can be applied to improve access-control processes in an academic environment. Although the system is a prototype, it provides the essential functions required for biometric access verification.

## 5.3 Limitation of the Study

The system has some limitations that should be considered:

1. The system does not include administrator login or authentication.
2. The system does not include role-based access control for different categories of users.
3. The system uses SQLite, which is suitable for a prototype but not ideal for large production use.
4. The system does not include liveness detection, so it may be vulnerable to photo-based spoofing.
5. The system does not include hardware integration with gates, doors, or turnstiles.
6. The recognition accuracy depends on lighting, camera quality, face angle, and image clarity.
7. The backend model may require significant memory and startup time on low-resource hosting platforms.
8. The current system does not include a full administrative dashboard for managing users and logs.
9. The system currently depends on internet hosting availability when deployed online.

## 5.4 Recommendation

The following recommendations are made for future improvement:

1. Administrator authentication should be added to control who can register and manage users.
2. The database should be migrated from SQLite to PostgreSQL for better production reliability.
3. Liveness detection should be added to reduce spoofing using printed photos or phone screens.
4. An administrative dashboard should be developed for viewing users, deleting records, and reviewing access logs.
5. Role-based access control should be added for students, staff, visitors, and security officers.
6. The system should be tested with a larger number of users to improve threshold selection.
7. Persistent cloud storage should be used for reliable long-term data retention.
8. The system should include encryption and stronger protection for biometric data.
9. Hardware integration should be added for automatic door or gate control.
10. Rate limiting should be added to protect the API from abuse.
11. CORS settings should be restricted to trusted frontend domains after testing.

## 5.5 Contribution to Knowledge

This project contributes to knowledge by demonstrating how a web-based face recognition system can be implemented for campus access control using modern open-source technologies. It shows how browser-based face detection can be combined with backend machine-learning recognition to create a practical identity verification workflow.

The project also demonstrates a modular approach to biometric system implementation. The frontend handles camera interaction and face cropping, while the backend handles embedding generation, matching, storage, and logging. This separation provides a useful model for developing similar biometric applications.

In addition, the project shows how multiple face embeddings can be stored for one person to improve recognition flexibility. It also provides a simple database structure for storing registered users, biometric embeddings, and access attempts.

# APPENDIX

## Appendix A: Backend Enrollment and Recognition Logic

This appendix presents the core backend logic responsible for registering users and recognizing faces. The code is summarized to show only the important implementation flow.

```python
@app.post("/enroll", response_model=EnrollResponse)
def enroll(body: EnrollRequest) -> EnrollResponse:
    if not is_model_loaded():
        raise HTTPException(status_code=503, detail="Embedding model is not ready.")

    embedding = generate_embedding(body.image)

    with db_session() as conn:
        existing = find_personnel_by_name(conn, body.name)
        if existing is not None:
            personnel_id = int(existing["id"])
            display_name = existing["name"]
            is_new = False
        else:
            personnel_id = create_personnel(conn, body.name)
            display_name = body.name.strip()
            is_new = True

        insert_embedding(conn, personnel_id, embedding)

    return EnrollResponse(
        success=True,
        personnel_id=personnel_id,
        name=display_name,
        is_new_personnel=is_new,
        message="Enrollment completed.",
    )


@app.post("/recognize", response_model=RecognizeResponse)
def recognize(body: RecognizeRequest) -> RecognizeResponse:
    if not is_model_loaded():
        raise HTTPException(status_code=503, detail="Embedding model is not ready.")

    probe = generate_embedding(body.image)

    with db_session() as conn:
        gallery = fetch_all_embeddings(conn)
        match = find_best_match(probe, gallery, settings.match_threshold)
        log_access(conn, recognized=match.recognized, personnel_id=match.personnel_id)

    return RecognizeResponse(
        recognized=match.recognized,
        name=match.name,
        confidence=match.confidence,
        personnel_id=match.personnel_id,
        message="Access granted." if match.recognized else "Access denied.",
    )
```

## Appendix B: Face Embedding Generation Logic

This appendix presents the core image decoding and embedding generation process. The backend receives a base64 face image, preprocesses it, and generates a normalized 512-dimensional embedding.

```python
def generate_embedding(image_b64: str) -> list[float]:
    if not _model_ready or _model is None:
        raise RuntimeError("Embedding model is not loaded yet")

    image = decode_base64_image(image_b64)

    tensor = transforms.Compose(
        [
            transforms.Resize((160, 160)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5]),
        ]
    )(image).unsqueeze(0)

    with torch.inference_mode():
        embedding = _model(tensor)
        embedding = torch.nn.functional.normalize(embedding, p=2, dim=1)

    return embedding.squeeze(0).cpu().numpy().astype(np.float64).tolist()
```

## Appendix C: Frontend Face Detection and Cropping Logic

This appendix presents the core frontend logic used to load the face detector, detect the largest face, crop it from the camera image, and convert it to base64 format for backend processing.

```javascript
export async function loadTinyFaceDetector() {
  if (modelsLoaded) return;
  if (loadPromise) return loadPromise;

  loadPromise = faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
  await loadPromise;
  modelsLoaded = true;
}

export async function detectLargestFace(video) {
  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.5,
  });

  const detections = await faceapi.detectAllFaces(video, options);
  if (!detections.length) return null;

  return detections.reduce((best, current) => {
    const bestArea = best.box.width * best.box.height;
    const currentArea = current.box.width * current.box.height;
    return currentArea > bestArea ? current : best;
  });
}

export function cropFaceToBase64(video, mediaBox) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = Math.round(mediaBox.width);
  canvas.height = Math.round(mediaBox.height);

  ctx.drawImage(
    video,
    mediaBox.x,
    mediaBox.y,
    mediaBox.width,
    mediaBox.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  return canvas.toDataURL("image/jpeg", 0.92);
}
```
