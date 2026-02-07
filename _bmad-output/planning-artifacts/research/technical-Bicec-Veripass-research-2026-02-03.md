---
stepsCompleted: [1, 2, 3]
inputDocuments: []
workflowType: 'research'
lastStep: 1
research_type: 'technical'
research_topic: 'BICEC Digital Biometric KYC Platform (Cameroon)'
research_goals: 'Technical feasibility and architecture for <15min mobile-first onboarding, involving Sopra Amplitude/Iwomi Core integration, PaddleOCR/DeepFace on-premise, and Law 2024-017 compliance.'
user_name: 'Ken'
date: '2026-02-07'
web_research_enabled: true
source_verification: true
---

# Research Report: technical

**Date:** 2026-02-07
**Author:** Ken
**Research Type:** technical

---

## Technology Stack Analysis

### Programming Languages

The implementation of a self-hosted KYC solution for the Cameroonian market requires a dual-language approach to balance AI performance and cross-platform mobile ease of use.

- **Python (Backend & AI Logic):** The primary language for the OCR and Biometric core. Python's ecosystem (PaddleOCR, DeepFace, FastAPI) is the industry standard for rapid AI prototyping and deployment.
- **Dart (Frontend - Flutter):** Confirmed as the choice for the mobile client. Dart's native compilation provides smooth UI performance, which is critical for "live" capture of documents and selfies.
- **C++ (Performance optimization):** While not used directly by the student, the underlying engines (PaddlePaddle, OpenCV) rely on C++ and SIMD instructions for CPU acceleration on Windows.

_Popular Languages: Python, Dart, SQL (for BI)_
_Emerging Languages: Rust (for high-performance AI wrappers), but not recommended for this MVP due to complexity._
_Language Evolution: Python remains dominant but is increasingly served via asynchronous frameworks like FastAPI to handle concurrent KYC requests._
_Performance Characteristics: Python overhead is mitigated by offloading heavy computation to C++/ONNX runtimes._
_Source: [PaddleOCR Inference Optimization](https://paddleocr.ai), [DeepFace Documentation](https://github.com/serengil/deepface)_

### Development Frameworks and Libraries

For an autonomous KYC solution, the stack must prioritize open-source libraries that offer "on-premise" capabilities without hidden cloud dependencies.

- **PaddleOCR:** The most robust open-source OCR choice. It can be optimized for CPU-only Windows environments using **ONNX Runtime** or **OpenVINO**, achieving sub-second extraction for identity documents.
- **DeepFace:** A multi-model wrapper that simplifies the integration of FaceNet, VGG-Face, and InsightFace. Crucially, it includes **MiniVision Silent-Face-Anti-Spoofing** for liveness detection, allowing for "live" check without external API calls.
- **MediaPipe:** Developed by Google, it is highly optimized for CPUs. It can be used for real-time face detection and "landmarks" (to calculate Eye Aspect Ratio for blink detection) before sending high-quality frames to the Python backend.
- **FastAPI:** A high-performance web framework for the Python backend, supporting asynchronous processing which is vital during heavy I/O tasks like image upload.

_Major Frameworks: Flutter (Mobile), FastAPI (Backend), PaddlePaddle (OCR), TensorFlow/PyTorch (Biometrics)_
_Micro-frameworks: Streamlit (for internal BI/Admin dashboards), Pydantic (data validation)_
_Evolution Trends: Shift towards "Edge AI" where initial liveness checks happen on-device (Flutter/MediaPipe) to reduce server load._
_Ecosystem Maturity: High; large community support for PaddleOCR and Face Recognition libraries ensures stability for a PFE._
_Source: [InsightFace Performance Benchmark](https://insightface.ai), [MediaPipe CPU Performance](https://google.github.io/mediapipe/)_

### Database and Storage Technologies

Data/BI focus requires a structured approach to record keeping (10-year BEAC mandate) and analytics.

- **PostgreSQL:** The definitive open-source relational database. Essential for storing historical KYC records, audit trails, and customer profiles securely.
- **DuckDB:** An in-process SQL OLAP database. Highly recommended for the BI component of the student's project as it allows for extremely fast analytical queries on local datasets (perfect for his 200GB space limit).
- **Redis:** Can be used for temporary storage of session data and "live" verification states, ensuring that liveness challenges are not replayed (anti-fraud).

_Relational Databases: PostgreSQL (Primary storage)_
_NoSQL Databases: Not strictly required, but MongoDB could store unstructured raw OCR results._
_In-Memory Databases: Redis (Session management)_
_Data Warehousing: DuckDB (Local analytical processing for BI)_
_Source: [DuckDB for BI](https://duckdb.org), [BEAC AML/CFT Directives](https://www.beac.int)_

### Development Tools and Platforms

- **Docker Desktop (Windows):** Essential for isolating the Python environment and its complex dependencies (CUDA/ONNX/Paddle). It simplifies deployment for a "demo" scenario.
- **VS Code:** The industry-standard IDE for both Flutter and Python.
- **ONNX Runtime:** The cross-platform engine used to run PaddleOCR and DeepFace models at peak performance on AMD/Intel CPUs under Windows.

_IDE and Editors: VS Code, Android Studio_
_Version Control: Git_
_Build Systems: Docker, CMake (for underlying C++ dependencies)_
_Testing Frameworks: Pytest (Backend logic), Flutter Test (UI flows)_
_Source: [ONNX Runtime Performance](https://onnxruntime.ai)_

### Cloud Infrastructure and Deployment (Local Simulation)

While the project is a local simulation, the architecture should mimic a secure banking environment.

- **On-Premise Server Simulation:** The Windows PC acts as the "Private Cloud".
- **Reverse Proxy (Nginx):** To handle HTTPS (simulated) and secure the communication between the Flutter app and the Python backend.

_Major Cloud Providers: N/A (Project emphasizes local/self-hosted)_
_Container Technologies: Docker (for backend services)_
_Source: [Banking Digital Onboarding Standards](https://voveid.com)_

### Technology Adoption Trends

- **Sovereign identity:** Growing trend in CEMAC for local hosting of sensitive biometric data to comply with COBAC's data sovereignty concerns.
- **Hybrid OCR:** Moving the first layer of OCR (e.g., card detection) to the mobile device (Flutter/TFLite) while the field extraction stays on the server for accuracy.

_Migration Patterns: Moving away from global SaaS APIs (Onfido, Jumio) to local, open-source alternatives for cost and regulatory control._
_Emerging Technologies: Silent Liveness Detection (Passive) replacing active challenges (Smile, blink) for better UX._
_Source: [Fintech Trends in Africa](https://anqacompliance.com)_

---

<!-- Content will be appended sequentially through research workflow steps -->
