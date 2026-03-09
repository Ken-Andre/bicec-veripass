# Building a Production-Ready OCR System for Cameroonian National ID Cards

## From Prototype to Banking-Grade Infrastructure

When building identity verification systems for financial institutions in emerging markets, the gap between a working demo and production-ready infrastructure is vast. This article chronicles the architectural decisions, security considerations, and engineering trade-offs required to build **bicec-veripass**, a KYC (Know Your Customer) system designed to run on modest hardware (Ryzen 7/i3 with 16GB RAM) while handling the unique challenges of Cameroonian national identity cards.

---

## The Challenge: Two Generations of ID Cards

Cameroon is currently in transition between two distinct identity document formats, each presenting unique technical challenges:

### Legacy Cards (Horizontal Format - Teslin/Laminated)
- **Visual characteristics**: Landscape orientation with yellowish-green backgrounds featuring complex guilloche patterns
- **OCR nightmare**: Cards are often worn, folded, or have peeling lamination creating massive reflections. Black ink fades with sweat and time
- **Structure**: Strictly bilingual on the same line (e.g., *Nom / Surname*, *Prénoms / Given names*). Card numbers (typically 9 digits) are positioned variably depending on issuance year

### New Biometric Cards (Vertical Format - Polycarbonate - 2024/2025)
- **Visual characteristics**: Portrait orientation following ICAO directives, laser-engraved text
- **OCR challenge**: While contrast is excellent, reading horizontal text on a vertically-held card disrupts PaddleOCR's native bounding box sorting
- **Structure**: Features a VOS QR Code on the front, laser-changeable imagery (CLI), and critically, a **Machine Readable Zone (MRZ)** on the back using OCR-B font

---

## Architecture Overview: The Hybrid Three-Stage Strategy

Our solution combines three complementary approaches, each optimized for specific scenarios:

### Stage 1: The Sniper (OpenCV Geometric Alignment)

Before any OCR processing, we must handle the reality that users take photos at angles, on textured surfaces, under poor lighting. The geometric alignment stage:

1. **Detects the card's four corners** using edge detection and contour analysis
2. **Applies perspective transformation (homography)** to "flatten" the card into a perfect rectangle
3. **Normalizes resolution** to a standard width (800px) ensuring spatial heuristics remain mathematically invariant across different smartphone cameras

**Critical enhancement**: Morphological closing operations bridge broken edges caused by reflections or background textures, preventing false contour detection.

```python
# Morphological closing to connect broken edges
kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
closed = cv2.morphologyEx(edged, cv2.MORPH_CLOSE, kernel)

# Resolution normalization for consistent spatial reasoning
STANDARD_WIDTH = 800
ratio_warp = STANDARD_WIDTH / float(maxWidth)
standard_height = int(maxHeight * ratio_warp)
warped_standard = cv2.resize(warped, (STANDARD_WIDTH, standard_height))
```

### Stage 2: The Hack (MRZ Fast Path)

For new biometric cards, the back contains a Machine Readable Zone following ICAO TD1 standards (3 lines of exactly 30 characters). This provides:

- **100% accuracy** with built-in check digits
- **Sub-second processing** compared to full OCR
- **Guaranteed field extraction** (card number, name, surname, date of birth)

**Implementation**: Strict regex validation ensures we only accept genuine MRZ patterns, eliminating false positives.

```python
def extract_mrz(blocks):
    mrz_lines = []
    # ICAO TD1: exactly 30 characters per line
    mrz_pattern = re.compile(r'^[A-Z0-9<]{30}$')
    
    for b in blocks:
        text = b['text'].replace(' ', '')
        if mrz_pattern.match(text) and '<' in text:
            mrz_lines.append(text)
            
    if len(mrz_lines) == 3:  # TD1 requires exactly 3 lines
        return {"mrz_found": True, "lines": mrz_lines, "method": "MRZ_ICAO_TD1"}
    return None
```

### Stage 3: The Detective (Spatial Anchoring + Regex)

For card fronts and legacy cards, we employ geometric reasoning rather than sequential text reading:

**The Problem**: PaddleOCR may read text blocks in unpredictable order. The label "Nom / Surname" might be detected before or after the actual name value.

**The Solution**: Spatial anchoring. We don't look for text "after" a label—we look for text **geometrically below** it using coordinate analysis.

```python
def extract_spatial_data(blocks):
    # Find anchor labels
    if "NOM" in text or "SURNAME" in text:
        # Find all blocks physically BELOW the anchor (higher Y coordinate)
        candidates = [
            b for b in blocks 
            if b['cy'] > anchor['cy'] + 5  # At least 5 pixels below
            and abs(b['cx'] - anchor['cx']) < 150  # Horizontally aligned
        ]
        
        if candidates:
            # Take the closest block below
            candidates.sort(key=lambda b: b['cy'] - anchor['cy'])
            extracted_name = candidates[0]['text']
```

---

## Orchestration: Synchronous vs Asynchronous Processing

### The Hybrid Approach

**PaddleOCR (Fast Path) = Synchronous via ThreadPool**

- **Why**: The PRD requires immediate feedback for users to review/correct OCR results
- **Performance**: < 2-3 seconds on CPU-optimized ONNX models
- **Implementation**: Offload to Starlette's threadpool using `run_in_threadpool` to avoid blocking the ASGI event loop

**GLM-OCR (Fallback) = Asynchronous via Celery + Redis**

- **Why**: Heavy semantic extraction (utility bills) or low-confidence fields require 10-30 seconds
- **Implementation**: Push job to Redis queue, dedicated Celery worker processes it
- **Memory safety**: `--concurrency=1 --max-tasks-per-child=1` forces worker restart after each task, ensuring aggressive garbage collection

### Memory Management Strategy

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # PaddleOCR: Multi-threaded for throughput
    sess_options.intra_op_num_threads = 4
    ml_models["ocr_det"] = ort.InferenceSession("models/ch_PP-OCRv4_det_infer.onnx", sess_options)
    
    # MiniFASNetV2: Single-threaded for minimal overhead
    fas_options.intra_op_num_threads = 1
    fas_options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    ml_models["liveness"] = ort.InferenceSession("models/MiniFASNetV2.onnx", fas_options)
    
    yield
    
    ml_models.clear()
    cv_threadpool.shutdown(wait=True)
```

---

## Security Architecture: Defense in Depth

### Liveness Detection: The Bouncer at the Door

**Two-Stage Verification**:

1. **Client-side (MediaPipe WASM)**: Behavioral validation (head rotation, eye blinks) runs on user's device—zero server CPU cost
2. **Server-side (MiniFASNetV2)**: Spectral analysis detects moiré patterns (screens) and texture absence (masks/paper)

**Critical insight**: MiniFASNetV2 is a featherweight model (~600KB, <50MB RAM, 10-20ms inference) that coexists with PaddleOCR without memory pressure.

### Document Authenticity: The Tilt Strategy

Instead of relying on specular reflection detection (which fails under Cameroon's varied lighting conditions), we capture **3 frames at different angles**:

- Card flat
- Tilted upward
- Tilted downward

**Agent interface**: A slider control creates a pseudo-3D effect. Human agents instantly detect whether hologram lighting changes (genuine card) or remains static (screen/photocopy).

---

## Data Lifecycle Management: The Garbage Collector

With a strict 200GB storage limit, automated retention policies are critical:

### Three-Tier Retention Strategy

**Tier 1: Abandoned Sessions (TTL: 72 hours)**
- Status: `DRAFT` or `PENDING_INFO`
- Action: Hard delete images, retain anonymized metadata for analytics

**Tier 2: Fraud Rejections (TTL: 30 days)**
- Status: `REJECTED`
- Action: Retain for ANIF (Financial Investigation Agency) compliance, then delete media while keeping cryptographic audit logs

**Tier 3: Validated Accounts (TTL: 10 years)**
- Status: `ACTIVATED_FULL`
- Action: Merge 3 tilt frames into optimized PDF, encrypt with AES-256, store cold

```python
@shared_task(name="tasks.storage_garbage_collector")
def garbage_collect_kyc_data():
    # Purge abandoned sessions
    abandoned_threshold = datetime.utcnow() - timedelta(hours=72)
    abandoned_sessions = db.query(KYCSession).filter(
        KYCSession.status.in_(['DRAFT', 'PENDING_INFO']),
        KYCSession.updated_at < abandoned_threshold
    ).all()
    
    for session in abandoned_sessions:
        shutil.rmtree(session_dir)
        session.status = 'ABANDONED'
    
    # Disk usage monitoring
    total, used, free = shutil.disk_usage("/")
    if (used / total) * 100 > 85.0:
        trigger_critical_alert()
```

---

## Cryptographic Strategy: The Security Triptyque

### 1. Proof Documents (Images/Videos)
- **Storage**: Disk volume encrypted with LUKS
- **Integrity**: SHA-256 hashes stored in database for tamper detection

### 2. Strict PII (NIU, ID Numbers)
- **Encryption**: Application-level (FastAPI/Fernet) - database never sees plaintext
- **Searchability**: Blind indexing using HMAC-SHA256 for deduplication

```python
def prepare_data_for_db(niu_plaintext):
    # Encrypted value (for display)
    niu_encrypted = fernet.encrypt(niu_plaintext.encode()).decode()
    
    # Blind index (for searching)
    niu_blind_index = hmac.new(
        BLIND_INDEX_SECRET.encode(),
        niu_plaintext.encode(),
        hashlib.sha256
    ).hexdigest()
    
    return niu_encrypted, niu_blind_index
```

### 3. Searchable PII (Names)
- **Storage**: Plaintext in database for fuzzy matching (`pg_trgm`)
- **Protection**: LUKS volume encryption + RBAC in FastAPI

---

## Network Resilience: The Idempotency Shield

In Cameroon's 3G environment, the "HTTP 200 lost in limbo" syndrome is common. Our solution:

### Client-Side Hash Calculation
PWA calculates SHA-256 of image using `SubtleCrypto` API before upload, sends in `X-Document-Hash` header

### Server-Side Short-Circuit
```python
@router.post("/kyc/session/{session_id}/document/{doc_type}")
async def upload_kyc_document(
    session_id: str,
    doc_type: str,
    x_file_hash: str = Header(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    existing_doc = db.query(Document).filter(
        Document.kyc_session_id == session_id,
        Document.document_type == doc_type,
        Document.status.in_(['PROCESSING', 'COMPLETED'])
    ).first()

    if existing_doc and existing_doc.file_hash == x_file_hash:
        if existing_doc.status == 'COMPLETED':
            # Zero CPU impact: return cached OCR results
            return JSONResponse(status_code=200, content=existing_doc.extracted_data)
        elif existing_doc.status == 'PROCESSING':
            # Race condition protection: tell client to wait
            return JSONResponse(status_code=202, content={"retry_after": 2})
```

**Benefits**:
- Zero CPU waste on network retries
- Race condition protection via state machine
- Natural handling of user photo retakes

---

## Compliance and Audit: Immutability by Design

### PostgreSQL Trigger-Based Audit Log

Rather than application-level audit logging (vulnerable to crashes and bugs), we use database triggers:

```sql
CREATE TRIGGER audit_kyc_changes
AFTER INSERT OR UPDATE ON kyc_sessions
FOR EACH ROW EXECUTE FUNCTION log_audit_event();
```

**Advantages**:
- Survives application crashes
- Immune to developer errors
- Captures manual DBA interventions
- COBAC compliance guarantee

---

## Lessons Learned: From Demo to Production

### 1. Geometric Reasoning Over Sequential Reading
Bilingual cards and variable layouts make sequential text parsing fragile. Spatial anchoring using coordinate geometry is robust.

### 2. Hybrid Strategies Win
No single approach handles all scenarios. MRZ for new cards, spatial anchoring for old cards, human-in-the-loop for edge cases.

### 3. Memory is the Real Constraint
On modest hardware, memory management trumps raw speed. Worker recycling, model size optimization, and aggressive garbage collection are non-negotiable.

### 4. Network Resilience is Not Optional
In emerging markets, idempotency and state machines aren't nice-to-haves—they're survival mechanisms.

### 5. Security Through Separation
Application-level encryption, blind indexing, and database triggers create defense in depth that survives individual component compromise.

---

## Conclusion

Building production-ready identity verification for banking requires engineering discipline that extends far beyond getting OCR to work on a test image. The bicec-veripass architecture demonstrates that with careful attention to:

- **Geometric preprocessing** (alignment, normalization)
- **Hybrid extraction strategies** (MRZ fast path, spatial anchoring, regex)
- **Memory-conscious orchestration** (synchronous fast path, asynchronous fallback)
- **Defense-in-depth security** (client-side validation, server-side verification, human oversight)
- **Network resilience** (idempotency, state machines, hash-based deduplication)
- **Compliance by design** (trigger-based auditing, automated retention policies)

...it's possible to build banking-grade systems that run on modest hardware while handling the real-world complexities of emerging market deployments.

The gap between prototype and production is measured not in features, but in the unglamorous engineering that makes systems resilient, secure, and maintainable under real-world conditions.

---

*This article is based on the architectural design of bicec-veripass, a KYC system built for BICEC (Banque Internationale du Cameroun pour l'Épargne et le Crédit) to enable 15-minute account opening while maintaining COBAC (Central African Banking Commission) compliance.*
