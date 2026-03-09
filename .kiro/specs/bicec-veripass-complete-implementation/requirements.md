# Requirements Document: BICEC VeriPass Sovereign Digital KYC Platform

## Introduction

BICEC VeriPass is a sovereign digital KYC onboarding platform for BICEC (Banque Internationale du Cameroun pour l'Épargne et le Crédit). The system enables clients to complete identity verification remotely via a Progressive Web Application (PWA) while maintaining 100% data sovereignty through on-premise AI processing. The platform supports the complete KYC lifecycle from client capture through agent validation, AML compliance screening, and operational oversight.

The system serves five primary personas:
- **Marie** — the client performing KYC onboarding via PWA
- **Jean** — the KYC validation agent reviewing dossiers in the back-office
- **Thomas** — the AML/Compliance supervisor managing sanctions screening and identity conflicts
- **Sylvie** — the operations manager overseeing the Command Center and compliance exports
- **Admin IT** — the system administrator managing agent accounts, branch assignments, and system configuration

The platform is built entirely with open-source technologies (React/TypeScript PWA, FastAPI Python backend, PostgreSQL, Redis, Celery) deployed on-premise via Docker Compose, ensuring complete data sovereignty and compliance with Cameroonian regulations (Loi 2024-017) and COBAC requirements.

## Glossary

- **System**: The complete BICEC VeriPass platform including PWA, backend API, AI services, and databases
- **PWA**: Progressive Web Application — the mobile-first client interface used by Marie
- **Back_Office**: The web-based administrative interface used by Jean, Thomas, Sylvie, and Admin IT
- **CNI**: Carte Nationale d'Identité — Cameroonian National Identity Card (mandatory document)
- **NIU**: Numéro d'Identification Unique — Cameroonian tax identification number
- **Dossier**: A complete KYC submission package including documents, biometrics, and metadata
- **Session**: A KYC onboarding session tracked from registration through activation
- **OTP**: One-Time Password — temporary authentication code sent via SMS or email
- **Liveness_Check**: Real-time video selfie verification to detect physical presence
- **OCR_Service**: Optical Character Recognition service for document text extraction
- **Face_Matching_Service**: Biometric service comparing selfie against CNI photo
- **Anti_Spoofing_Service**: Liveness detection service to prevent photo/mask attacks
- **Confidence_Score**: Weighted aggregate score (0-100) combining OCR, biometric, and coherence metrics
- **Agent_Queue**: Prioritized list of dossiers awaiting Jean's validation
- **PEP**: Politically Exposed Person — individual requiring enhanced AML screening
- **Sanctions_List**: Combined UN/EU/OFAC/OpenSanctions database for AML screening
- **Audit_Log**: Immutable SHA-256 hashed record of all system actions
- **COBAC**: Commission Bancaire de l'Afrique Centrale — regional banking regulator
- **Amplitude**: Sopra Banking Amplitude — BICEC's core banking system
- **Access_Level**: Account permission tier (RESTRICTED, LIMITED_ACCESS, FULL_ACCESS, BLOCKED)
- **Admin_IT**: Back-office role with permissions to manage agent accounts and system configuration — distinct from the operational roles (Jean/Thomas/Sylvie) and from the BICEC IT infrastructure team
- **CNI_Identifiant_Unique**: Alphanumeric identifier printed on the CNI, issued by the Centre d'État Civil — distinct from the NIU (issued by DGI/tax authority)
- **CNI_Format_Variant**: Physical format of the CNI document — `CNI_ANCIEN_LANDSCAPE` (pre-2021, landscape orientation, photo on right) or `CNI_NOUVEAU_PORTRAIT` (2021+, portrait orientation, photo at top)

## Requirements

### Requirement 1: Client Authentication and Registration

**User Story:** As Marie, I want to register and authenticate securely using OTP, so that I can access the KYC onboarding platform without managing passwords.

#### Acceptance Criteria

1. WHEN Marie enters her phone number and requests an OTP, THE System SHALL send an SMS via Orange Cameroon SMS API within 10 seconds
2. WHEN Marie enters her email address and requests an OTP, THE System SHALL send an email OTP within 10 seconds
3. THE System SHALL store the OTP in Redis with a 5-minute time-to-live
4. WHEN Marie submits a correct OTP, THE System SHALL delete the OTP from Redis immediately
5. WHEN Marie submits an incorrect OTP 3 consecutive times, THE System SHALL rate-limit further attempts for 60 seconds
6. WHEN Marie successfully verifies an OTP, THE System SHALL issue a JWT access token with 24-hour expiry
7. WHEN Marie successfully verifies an OTP for the first time, THE System SHALL create a Session with status DRAFT
8. WHEN Marie returns to the PWA with an existing Session, THE System SHALL prompt for PIN or biometric authentication
9. WHEN Marie sets up a PIN, THE System SHALL hash the PIN using bcrypt before storage
10. THE System SHALL support biometric authentication using WebAuthn API where available

### Requirement 2: CNI Document Capture with Quality Gates

**User Story:** As Marie, I want to photograph my CNI with real-time quality guidance, so that I submit high-quality images on the first attempt.

#### Acceptance Criteria

1. WHEN Marie accesses the CNI Recto capture screen, THE PWA SHALL activate the device camera using getUserMedia API
2. WHILE the camera is active, THE PWA SHALL process frames using MediaPipe WASM at a minimum of 15 frames per second
3. WHILE processing frames, THE PWA SHALL display visual guidance indicators for blur, glare, and alignment
4. WHEN a frame passes blur threshold AND glare threshold AND alignment threshold, THE PWA SHALL trigger auto-capture
5. WHEN Marie confirms a captured CNI Recto image, THE PWA SHALL encrypt the image and store it in IndexedDB
6. WHEN network connectivity is available, THE PWA SHALL upload the image to POST /kyc/capture/cni endpoint
7. THE System SHALL save uploaded CNI images to filesystem path /data/documents/{session_id}/cni_recto.jpg
8. THE System SHALL compute a SHA-256 hash of each uploaded image
9. THE System SHALL store the file path and SHA-256 hash in the documents table
10. THE System SHALL require both CNI Recto AND CNI Verso before allowing progression to liveness capture
11. WHEN Marie captures CNI Verso, THE System SHALL apply the same quality gates as CNI Recto


### Requirement 3: Liveness Verification with Strike Lockout

**User Story:** As Marie, I want to complete a liveness selfie with adaptive guidance, so that the system verifies my physical presence securely.

#### Acceptance Criteria

1. WHEN Marie accesses the Liveness capture screen, THE PWA SHALL display adaptive gesture prompts
2. WHILE capturing liveness video, THE PWA SHALL use MediaPipe WASM for real-time landmark detection
3. WHEN Marie completes the gesture sequence, THE PWA SHALL upload the video to POST /kyc/capture/liveness
4. WHEN the Anti_Spoofing_Service processes the liveness video, THE System SHALL compute a liveness score between 0 and 100
5. WHEN the Face_Matching_Service processes the selfie, THE System SHALL compute a face match score between 0 and 100
6. IF the liveness score is below the configured threshold, THEN THE System SHALL increment the strike counter
7. IF the strike counter reaches 3 within a single Session, THEN THE System SHALL transition the Session status to LOCKED_LIVENESS
8. WHEN a Session transitions to LOCKED_LIVENESS, THE PWA SHALL display a 60-second cooldown timer
9. WHEN a Session is LOCKED_LIVENESS, THE PWA SHALL display options "Recommencer" and "Aller en agence"
10. WHEN Marie selects "Recommencer", THE System SHALL purge the IndexedDB session cache and create a new Session
11. WHEN Marie selects "Aller en agence", THE PWA SHALL display the nearest BICEC branch locations

### Requirement 4: OCR Extraction and Review

**User Story:** As Marie, I want to review OCR-extracted fields from my documents, so that I can correct any errors before submission.

#### Acceptance Criteria

1. WHEN the OCR_Service receives a CNI image, THE System SHALL extract Nom, Prénom, Date de Naissance, Numéro CNI, Date de Délivrance, and Lieu
2. THE OCR_Service SHALL use PaddleOCR PP-OCRv5 as the primary extraction engine
3. THE OCR_Service SHALL complete CNI extraction within 5 seconds on the benchmark i3 node
4. THE System SHALL compute a confidence score between 0 and 100 for each extracted field
5. IF any field has confidence below 85%, THEN THE System SHALL queue a Celery task for GLM-OCR fallback processing
6. WHEN GLM-OCR processes a document, THE System SHALL complete processing within 30 seconds
7. WHEN Marie views the OCR review screen, THE PWA SHALL display all extracted fields with confidence badges
8. THE PWA SHALL display green badges for confidence ≥85%, orange badges for 60-84%, and red badges for <60%
9. WHEN Marie taps any field, THE PWA SHALL allow manual override of the extracted value
10. WHEN Marie corrects a field value, THE System SHALL flag the field as human_corrected in the ocr_fields table
11. WHEN Marie confirms the OCR review, THE System SHALL store all field values and proceed to the next step

### Requirement 5: Session Resumption and Offline Resilience

**User Story:** As Marie, I want the app to resume my session after network interruption, so that I don't lose my progress during connectivity issues.

#### Acceptance Criteria

1. WHEN Marie completes any capture step, THE PWA SHALL encrypt and store the session state in IndexedDB
2. THE PWA Service Worker SHALL cache the complete app shell for offline access
3. WHEN the PWA detects network restoration, THE System SHALL resume the Session within 2 seconds
4. WHEN resuming a Session, THE PWA SHALL display "Reprise de votre session... Nous avons sauvegardé votre progression."
5. WHEN resuming a Session, THE PWA SHALL upload any locally cached images not yet confirmed by the server
6. WHEN the server confirms image upload with HTTP 200 and matching SHA-256, THE PWA SHALL purge the local encrypted copy
7. THE PWA SHALL serve the app shell from Service Worker cache when offline
8. WHEN Marie attempts to proceed to a new step while offline, THE PWA SHALL display "Connexion requise pour continuer"

### Requirement 6: Address Entry with Progressive Dropdowns

**User Story:** As Marie, I want to enter my address using guided dropdowns, so that my address is consistently structured for agency routing.

#### Acceptance Criteria

1. WHEN Marie accesses the Address entry screen, THE PWA SHALL display a Ville dropdown
2. WHEN Marie selects a Ville, THE System SHALL populate the Quartier dropdown with quartiers for that Ville
3. WHEN Marie selects a Quartier, THE System SHALL auto-populate the Commune field with the appropriate commune for that Quartier
4. WHEN Marie selects a Quartier, THE System SHALL populate the Lieu-dit dropdown with lieu-dits for that Quartier
5. THE System SHALL store the selected Ville, Commune, Quartier, and Lieu-dit in the Session address fields
6. WHEN Marie taps "Utiliser ma position actuelle", THE PWA SHALL request Geolocation API permission
7. WHEN the Geolocation API returns coordinates, THE System SHALL encrypt and store the GPS coordinates in the Session
8. WHEN GPS coordinates are captured, THE PWA SHALL display a privacy notice about GPS data collection
9. IF the GPS distance exceeds 5 kilometers from the selected Quartier centroid, THEN THE PWA SHALL display a non-blocking warning banner
10. THE System SHALL allow Marie to proceed regardless of GPS distance warning

### Requirement 7: Utility Bill Upload and Agency Routing

**User Story:** As Marie, I want to upload my utility bill as proof of address, so that my address can be validated by a certified source.

#### Acceptance Criteria

1. WHEN Marie accesses the Proof of Address screen, THE PWA SHALL display a toggle between ENEO and CAMWATER
2. WHEN Marie selects a utility provider and uploads a bill photo, THE System SHALL upload to POST /kyc/capture/utility_bill
3. THE System SHALL queue a Celery task for GLM-OCR extraction of bill date and agency name
4. WHEN GLM-OCR completes extraction, THE System SHALL return the bill date and agency name within 30 seconds
5. WHEN Marie views the extraction results, THE PWA SHALL display the bill date and agency name for review
6. THE System SHALL allow Marie to manually correct the extracted bill date or agency name
7. THE System SHALL use the utility agency zone to determine the nearest BICEC agency
8. THE System SHALL store the assigned BICEC agency ID in the Session assigned_agency_id field
9. THE System SHALL validate that the bill date is within the last 3 months
10. IF the bill date is older than 3 months, THEN THE System SHALL flag the Dossier for Jean's manual review

### Requirement 8: NIU Declaration and Limited Access Gating

**User Story:** As Marie, I want to upload my NIU attestation or declare my NIU manually, so that I can complete KYC even if I don't have the physical document.

#### Acceptance Criteria

1. WHEN Marie accesses the NIU screen, THE PWA SHALL display options "Upload NIU Attestation" and "Déclarer mon NIU manuellement"
2. WHEN Marie selects "Upload NIU Attestation" and uploads a document, THE System SHALL store the image with niu_type DOCUMENT
3. WHEN Marie selects "Déclarer mon NIU manuellement", THE PWA SHALL display a text input field
4. WHEN Marie submits a manual NIU, THE System SHALL validate the format using Cameroonian NIU regex pattern
5. IF the NIU format is invalid, THEN THE PWA SHALL display "Format NIU invalide (ex: M0XX12345678A)"
6. WHEN a valid manual NIU is submitted, THE System SHALL flag the Session with niu_declarative true
7. WHEN a Session has niu_declarative true, THE System SHALL set the Access_Level to LIMITED_ACCESS upon activation
8. WHEN a Session has niu_declarative true, THE System SHALL add a note visible to Jean: "⚠️ NIU Déclaratif — Vérification Jean requise"
9. WHILE Access_Level is LIMITED_ACCESS, THE PWA SHALL unlock cash-in, view balance, and account settings features
10. WHILE Access_Level is LIMITED_ACCESS, THE PWA SHALL lock outbound transfers, cash-out, crypto, savings, investment, and card issuance features

### Requirement 9: Digital Consent and Dossier Submission

**User Story:** As Marie, I want to provide explicit consent to terms and policies, so that my KYC submission is legally valid.

#### Acceptance Criteria

1. WHEN Marie accesses the Consent screen, THE PWA SHALL display three separate checkboxes
2. THE PWA SHALL display checkbox 1: "J'accepte les Conditions Générales d'Utilisation"
3. THE PWA SHALL display checkbox 2: "J'accepte la Politique de Confidentialité"
4. THE PWA SHALL display checkbox 3: "J'accepte le traitement de mes données biométriques (Loi 2024-017)"
5. THE PWA SHALL disable the "Soumettre mon dossier" button until all three checkboxes are checked
6. WHEN all three checkboxes are checked and Marie taps "Soumettre mon dossier", THE System SHALL record a consent event in the Audit_Log
7. THE System SHALL store the consent timestamp and IP address in the Audit_Log
8. WHEN consent is recorded, THE System SHALL transition the Session status from DRAFT to PENDING_KYC
9. WHEN the Session transitions to PENDING_KYC, THE PWA SHALL display "Dossier Soumis avec Succès" with a reference number
10. THE PWA SHALL display an estimated review time of 24-48 hours

### Requirement 10: Biometric Processing and Face Matching

**User Story:** As the System, I want to verify that the liveness selfie matches the CNI photo, so that biometric integrity is validated.

#### Acceptance Criteria

1. WHEN both CNI Recto and liveness selfie are stored for a Session, THE System SHALL trigger biometric processing
2. THE Face_Matching_Service SHALL use DeepFace for 1:1 face comparison
3. THE Face_Matching_Service SHALL return a similarity score between 0 and 100
4. THE Anti_Spoofing_Service SHALL use MiniFASNet for liveness detection
5. THE Anti_Spoofing_Service SHALL return a liveness score between 0 and 100
6. THE System SHALL store face match score and liveness score in the biometric_results table
7. IF the face match score is below 70, THEN THE System SHALL flag the Dossier with LOW_FACE_MATCH
8. IF the liveness score is below 60, THEN THE System SHALL flag the Dossier with LOW_LIVENESS
9. THE System SHALL complete biometric processing within 10 seconds on the benchmark i3 node
10. THE System SHALL encrypt biometric templates using AES-256 before storage

### Requirement 11: Global Confidence Score and Duplicate Detection

**User Story:** As the System, I want to compute a dossier-level confidence score and detect potential duplicates, so that Jean can prioritize reviews and Thomas can investigate identity conflicts.

#### Acceptance Criteria

1. WHEN OCR processing and biometric processing are complete for a Dossier, THE System SHALL compute a global Confidence_Score
2. THE System SHALL weight the Confidence_Score using: OCR field confidence (40%), liveness score (30%), face match score (20%), and coherence checks (10%)
3. THE System SHALL store the Confidence_Score in the kyc_sessions table global_confidence_score field
4. WHEN computing the Confidence_Score, THE System SHALL query existing users records for potential duplicates
5. THE System SHALL use PostgreSQL pg_trgm extension for fuzzy matching on Nom, Prénom, and Date de Naissance
6. IF a duplicate match score exceeds 85%, THEN THE System SHALL flag the Dossier with duplicate_suspected true
7. WHEN a Dossier is flagged duplicate_suspected, THE System SHALL notify Thomas via the Back_Office notification queue
8. THE System SHALL complete Confidence_Score computation within 5 seconds
9. THE System SHALL prioritize Dossiers in the Agent_Queue by lowest Confidence_Score first
10. THE System SHALL apply FIFO ordering as a secondary sort criterion when Confidence_Scores are equal

### Requirement 12: Agent Queue and Load Balancing

**User Story:** As Jean, I want to see a prioritized queue of dossiers, so that I can focus on the most urgent or risky cases first.

#### Acceptance Criteria

1. WHEN Jean logs into the Back_Office, THE System SHALL display the Agent_Queue on the Validation Desk
2. THE System SHALL sort the Agent_Queue by: escalated SLA flags first, then lowest Confidence_Score, then FIFO
3. THE Agent_Queue SHALL display for each Dossier: client name, submission time, Confidence_Score badge, NIU type, duplicate flag, and assigned agency
4. THE Agent_Queue SHALL auto-refresh every 30 seconds
5. THE System SHALL limit Jean's active Dossiers to between 2 and 10 at a time
6. THE System SHALL use Smooth Weighted Round Robin algorithm for agent load distribution
7. THE System SHALL use Least Connections algorithm to balance load across available agents
8. WHEN an agent's active Dossier count reaches 10, THE System SHALL not assign new Dossiers to that agent
9. WHEN an agent's active Dossier count falls below 2, THE System SHALL prioritize assigning new Dossiers to that agent
10. THE System SHALL track agent availability status (AVAILABLE, BUSY, AWAY) and exclude AWAY agents from assignment

### Requirement 13: Evidence Inspector and Side-by-Side Viewer

**User Story:** As Jean, I want to inspect documents with high-resolution images side-by-side with extracted data, so that I can accurately validate identity and detect fraud.

#### Acceptance Criteria

1. WHEN Jean opens a Dossier from the Agent_Queue, THE Back_Office SHALL display the Evidence Inspector view
2. THE Evidence Inspector SHALL display CNI Recto, CNI Verso, utility bill, and liveness selfie as high-resolution images
3. THE Evidence Inspector SHALL support pan and zoom functionality on all images
4. THE Evidence Inspector SHALL display extracted OCR fields in a panel adjacent to document images
5. THE Evidence Inspector SHALL display a face matching panel with selfie and CNI photo side-by-side
6. THE face matching panel SHALL display the similarity score with color coding (green ≥80%, orange 60-79%, red <60%)
7. THE Evidence Inspector SHALL highlight low-confidence OCR fields in orange (60-84%) or red (<60%)
8. WHEN Jean opens a Dossier, THE System SHALL record a DOSSIER_VIEWED event in the Audit_Log
9. THE DOSSIER_VIEWED event SHALL include Jean's user ID, timestamp, IP address, and Dossier ID
10. THE Evidence Inspector SHALL load and display all images within 3 seconds

### Requirement 14: Agent Decision Actions and Audit Trail

**User Story:** As Jean, I want to approve, reject, or request additional information on a dossier, so that the KYC lifecycle progresses with full accountability.

#### Acceptance Criteria

1. WHEN Jean clicks "Approuver" on a Dossier, THE System SHALL transition the Session status to READY_FOR_OPS
2. WHEN a Dossier is approved, THE System SHALL record a DOSSIER_APPROVED event in the Audit_Log with Jean's ID, timestamp, and IP
3. WHEN a Dossier is approved, THE System SHALL send an in-app notification to Marie: "Votre dossier a été approuvé par notre équipe. La prochaine étape est l'activation."
4. WHEN Jean clicks "Rejeter", THE Back_Office SHALL display a rejection reason dropdown
5. WHEN Jean submits a rejection with a reason, THE System SHALL transition the Session status to REJECTED
6. WHEN a Dossier is rejected, THE System SHALL record a DOSSIER_REJECTED event in the Audit_Log with Jean's ID, timestamp, IP, and rejection reason
7. WHEN a Dossier is rejected, THE System SHALL send an in-app notification to Marie with the rejection reason
8. WHEN Jean clicks "Demander Info", THE Back_Office SHALL display a text input for the specific request
9. WHEN Jean submits an information request, THE System SHALL transition the Session status to PENDING_INFO
10. WHEN an information request is submitted, THE System SHALL send an in-app notification to Marie detailing the required information
11. THE System SHALL record all decision actions in the Audit_Log with SHA-256 hash of the event payload

### Requirement 15: PEP and Sanctions List Management

**User Story:** As Thomas, I want PEP and sanctions lists to be loaded and refreshed weekly, so that AML screening operates on current data without external service calls.

#### Acceptance Criteria

1. THE System SHALL provide a Celery task sanctions_sync_worker for PEP and sanctions list synchronization
2. WHEN the sanctions_sync_worker task executes, THE System SHALL download lists from OpenSanctions, UN, EU, and OFAC via HTTPS
3. THE System SHALL normalize downloaded records and upsert them into the pep_sanctions PostgreSQL table
4. THE System SHALL complete the sync process within 10 minutes on the benchmark i3 node
5. WHEN the sync completes, THE System SHALL record a SANCTIONS_SYNC_COMPLETE event in the Audit_Log
6. THE System SHALL schedule the sanctions_sync_worker task to run weekly via cron
7. WHEN Thomas accesses the Admin panel, THE Back_Office SHALL display the last sync timestamp
8. THE Back_Office SHALL provide a "Synchroniser maintenant" button to trigger manual sync
9. WHEN Thomas triggers manual sync, THE System SHALL execute the sanctions_sync_worker task immediately
10. IF the sync fails, THEN THE System SHALL record a SANCTIONS_SYNC_FAILED event and notify Thomas

### Requirement 16: AML Alert Review and PEP Screening

**User Story:** As Thomas, I want to review dossiers flagged for PEP or sanctions matches, so that I can clear false positives or confirm matches with full audit accountability.

#### Acceptance Criteria

1. WHEN a Dossier is submitted, THE System SHALL perform fuzzy matching against the pep_sanctions table using pg_trgm
2. IF a match score exceeds 75%, THEN THE System SHALL flag the Dossier with aml_alert true
3. WHEN a Dossier is flagged aml_alert, THE System SHALL transition the Session status to COMPLIANCE_REVIEW
4. WHEN a Session status is COMPLIANCE_REVIEW, THE Dossier SHALL appear in Thomas's AML Alerts queue
5. WHEN Thomas opens an AML alert, THE Back_Office SHALL display the client profile and matched PEP/Sanctions entry side-by-side
6. THE side-by-side panel SHALL display: name, date of birth, country, and sanctions programs for both profiles
7. WHEN Thomas clicks "Effacer (Faux Positif)", THE Back_Office SHALL require a mandatory justification text input
8. WHEN Thomas submits a false positive clearance, THE System SHALL transition the Session status to PENDING_KYC
9. WHEN a false positive is cleared, THE System SHALL record an AML_CLEARED event in the Audit_Log with Thomas's ID, justification, and timestamp
10. WHEN Thomas clicks "Confirmer Match — Geler le compte" with justification, THE System SHALL transition the Session status to DISABLED
11. WHEN a sanctions match is confirmed, THE System SHALL record an AML_CONFIRMED_FREEZE event in the Audit_Log

### Requirement 17: Identity Conflict Resolution

**User Story:** As Thomas, I want to resolve cases where a new dossier appears to be a duplicate, so that identity fraud and reincarnation collisions are handled with documented audit trails.

#### Acceptance Criteria

1. WHEN a Dossier is flagged duplicate_suspected, THE Dossier SHALL appear in Thomas's Conflict Resolver queue
2. WHEN Thomas opens the Conflict Resolver for a Dossier, THE Back_Office SHALL display the new Dossier and suspected existing client record side-by-side
3. THE side-by-side view SHALL display: CNI images, extracted fields, biometric scores, and submission dates for both records
4. THE Back_Office SHALL provide action buttons: "Confirmer comme même personne (Lier)" and "Rejeter comme fraude"
5. WHEN Thomas selects any action, THE Back_Office SHALL require a mandatory justification comment
6. WHEN Thomas confirms as same person, THE System SHALL link the new Dossier to the existing client record
7. WHEN Thomas confirms as same person, THE System SHALL record an IDENTITY_LINKED event in the Audit_Log
8. WHEN Thomas rejects as fraud, THE System SHALL transition the Session status to REJECTED
9. WHEN Thomas rejects as fraud, THE System SHALL record an IDENTITY_FRAUD_REJECTED event in the Audit_Log
10. THE Audit_Log events SHALL include Thomas's ID, justification, timestamp, IP address, and both Dossier IDs

### Requirement 18: Agency Management and CRUD Operations

**User Story:** As Thomas, I want to manage BICEC agency records, so that operational continuity is maintained and dossiers are routed correctly.

#### Acceptance Criteria

1. WHEN Thomas accesses the Admin panel, THE Back_Office SHALL display an Agencies section
2. THE Agencies section SHALL display a table of all agencies with: name, region, zone coordinates, and max agent capacity
3. WHEN Thomas clicks "Créer une agence", THE Back_Office SHALL display a form with fields: agency name, region, zone coordinates, max agent capacity
4. WHEN Thomas submits the create form, THE System SHALL insert a new record in the agencies table
5. WHEN Thomas clicks "Modifier" on an agency, THE Back_Office SHALL display an edit form with current values
6. WHEN Thomas submits the edit form, THE System SHALL update the agency record
7. WHEN Thomas clicks "Désactiver" on an agency, THE System SHALL set the agency status to INACTIVE
8. THE System SHALL not assign new Dossiers to agencies with status INACTIVE
9. THE System SHALL record all agency CRUD operations in the Audit_Log
10. THE Audit_Log events SHALL include Thomas's ID, action type, agency ID, and timestamp

### Requirement 19: Amplitude Provisioning Monitoring

**User Story:** As Thomas, I want to monitor Amplitude provisioning batch statuses, so that I can quickly act on provisioning failures.

#### Acceptance Criteria

1. WHEN a Dossier has Session status READY_FOR_OPS, THE Back_Office SHALL display a "Lancer le provisioning Amplitude" button
2. WHEN Thomas clicks "Lancer le provisioning Amplitude", THE System SHALL queue a Celery task in the provisioning_batch queue
3. WHEN the provisioning task is queued, THE System SHALL transition the Session status to PROVISIONING
4. THE System SHALL send an ISO 20022 formatted message to Sopra Banking Amplitude via Axway API Manager
5. IF Amplitude responds with success within 5 minutes, THEN THE System SHALL transition the Session status to VALIDATED_PENDING_AGENCY
6. IF Amplitude does not respond within 5 minutes, THEN THE System SHALL transition the Session status to OPS_ERROR
7. WHEN a Session transitions to OPS_ERROR, THE System SHALL notify Thomas via the Back_Office notification queue
8. WHEN Thomas views an OPS_ERROR Dossier, THE Back_Office SHALL display a "Réessayer le provisioning" button
9. WHEN Thomas clicks "Réessayer le provisioning", THE System SHALL queue a new provisioning task
10. THE System SHALL record all provisioning attempts and responses in the Audit_Log

### Requirement 20: Operational Health Dashboard

**User Story:** As Sylvie, I want to see a color-coded dashboard showing queue health and system metrics, so that I can take proactive action before SLA violations.

#### Acceptance Criteria

1. WHEN Sylvie opens the Command Center, THE Back_Office SHALL display the Operational Health Dashboard
2. THE Dashboard SHALL display status tiles for: Agent Queue SLA, Liveness Failure Rate, Duplicate Alert Rate, Amplitude Batch Success Rate, and System Health
3. THE System SHALL color each tile GREEN when metrics are below threshold, YELLOW when approaching threshold, and RED when threshold is exceeded
4. THE Agent Queue SLA tile SHALL display the percentage of Dossiers validated within 2 hours
5. THE Agent Queue SLA tile SHALL be GREEN when ≥95%, YELLOW when 85-94%, and RED when <85%
6. THE Liveness Failure Rate tile SHALL display the percentage of Sessions with 3 liveness strikes
7. THE System Health tile SHALL monitor FastAPI, PostgreSQL, and Redis availability
8. THE Dashboard SHALL auto-refresh every 30 seconds
9. THE Dashboard SHALL respond to queries within 3 seconds even with 1000+ Dossiers
10. WHEN Sylvie clicks on any RED tile, THE Back_Office SHALL display detailed drill-down metrics
11. THE Back_Office SHALL provide an "Escalader" button to prioritize flagged Dossiers for immediate agent assignment

### Requirement 21: Funnel Drop-Off Analytics

**User Story:** As Sylvie, I want to view analytics on where clients abandon the onboarding journey, so that I can identify UX or technical bottlenecks.

#### Acceptance Criteria

1. WHEN Sylvie opens the Funnel Analytics view, THE Back_Office SHALL display conversion rates for each onboarding step
2. THE Funnel Analytics SHALL display steps: Inscription, CNI Recto, CNI Verso, Liveness, Adresse, NIU, Consentement, Soumis, Approuvé, Activé
3. THE System SHALL compute conversion rate as (completions / starts) × 100 for each step
4. THE Funnel Analytics SHALL allow filtering by date range and agency
5. THE System SHALL source funnel data from the kyc_step_events analytics table
6. WHEN a Session completes any step, THE System SHALL insert a record in kyc_step_events with Session ID, step name, and timestamp
7. THE Funnel Analytics SHALL display a time-to-completion histogram showing average duration per step
8. THE histogram SHALL identify bottleneck steps where average duration exceeds 5 minutes
9. THE Funnel Analytics SHALL support CSV export of raw funnel data
10. THE System SHALL compute funnel metrics within 5 seconds for date ranges up to 90 days

### Requirement 22: Immutable Audit Log

**User Story:** As Sylvie, I want to search and view the complete audit log of every system action, so that I can demonstrate full traceability for COBAC auditors.

#### Acceptance Criteria

1. WHEN Sylvie opens the Audit Log section, THE Back_Office SHALL display a search interface
2. THE Audit Log search SHALL support filtering by: Dossier ID, agent name, date range, and event type
3. WHEN Sylvie submits a search query, THE System SHALL return matching audit events in chronological order
4. THE Audit Log SHALL display for each event: event type, actor user ID, timestamp, IP address, and SHA-256 hash
5. THE System SHALL compute the SHA-256 hash of each event payload before storage
6. THE System SHALL store audit events in an append-only table with no DELETE or UPDATE operations
7. THE Back_Office SHALL provide a "Vérifier l'intégrité" button to validate SHA-256 hashes
8. WHEN Sylvie clicks "Vérifier l'intégrité", THE System SHALL recompute SHA-256 hashes and compare against stored values
9. THE System SHALL record the following event types: DOSSIER_VIEWED, DOSSIER_APPROVED, DOSSIER_REJECTED, AML_CLEARED, AML_CONFIRMED_FREEZE, CONSENT_SIGNED, SESSION_RESUMED, IDENTITY_LINKED, IDENTITY_FRAUD_REJECTED, SANCTIONS_SYNC_COMPLETE, AGENCY_CREATED, AGENCY_UPDATED, PROVISIONING_STARTED, PROVISIONING_SUCCESS, PROVISIONING_FAILED
10. THE Audit Log search SHALL return results within 3 seconds for queries spanning up to 1 year

### Requirement 23: COBAC Compliance Pack Export

**User Story:** As Sylvie, I want to export a complete compliance dossier package with one click, so that I can respond to COBAC audit requests quickly.

#### Acceptance Criteria

1. WHEN Sylvie selects a Dossier and clicks "Exporter le Pack Conformité", THE System SHALL generate a compliance archive
2. THE compliance archive SHALL contain a PDF summary with: client identity, OCR fields, biometric scores, agent decisions, and timestamps
3. THE compliance archive SHALL contain all original high-resolution images: CNI Recto, CNI Verso, liveness selfie, and utility bill
4. THE compliance archive SHALL contain a JSON file with the complete Audit_Log for the Dossier
5. THE System SHALL generate the compliance archive within 30 seconds
6. THE compliance archive SHALL be formatted as a ZIP file with naming convention: COBAC_Export_{Dossier_ID}_{YYYYMMDD}.zip
7. WHEN the export is generated, THE System SHALL record an EXPORT_COMPLIANCE_PACK event in the Audit_Log
8. THE EXPORT_COMPLIANCE_PACK event SHALL include Sylvie's ID, Dossier ID, timestamp, and IP address
9. THE PDF summary SHALL include a QR code linking to the Dossier verification page
10. THE System SHALL retain compliance archives for 10 years in encrypted storage

### Requirement 24: Plan Personalization Frontend Demo

**User Story:** As Marie, I want to see a comparison of BICEC's banking plans, so that I understand the value proposition during my KYC validation wait period.

#### Acceptance Criteria

1. WHEN Marie has submitted her Dossier and Session status is PENDING_KYC or ACTIVATED_*, THE PWA SHALL display a Plans section
2. THE Plans section SHALL display a swipeable tab interface with Standard, Premium, and Ultra plans
3. THE Standard plan SHALL display: 2.5% savings interest rate, standard transaction fees, and basic features
4. THE Premium plan SHALL display: 3.75% savings interest rate, reduced transaction fees, and premium features
5. THE Ultra plan SHALL display: 4.75% savings interest rate, zero transaction fees, and ultra features
6. THE Plans section SHALL display a "Start trial" or "Skip" call-to-action button
7. WHEN Marie taps "Start trial" or "Skip", THE PWA SHALL record the selection in local storage
8. THE Plans section SHALL be a frontend-only demo with no backend banking operations
9. THE PWA SHALL display a disclaimer: "Aperçu des offres BICEC — Activation après validation KYC"
10. THE Plans section SHALL support French and English language toggle

### Requirement 25: Use-Case Personalization Selection

**User Story:** As Marie, I want to select banking use cases relevant to my life, so that BICEC can tailor my onboarding messaging.

#### Acceptance Criteria

1. WHEN Marie accesses the Use-Case selection screen, THE PWA SHALL display use-case category chips
2. THE PWA SHALL display three categories: "Everyday needs", "Global spending", and "Investments"
3. WHEN Marie taps a category chip, THE chip SHALL toggle between selected and unselected states
4. THE PWA SHALL allow Marie to select multiple categories simultaneously
5. WHEN Marie confirms her selections, THE PWA SHALL store the choices in IndexedDB
6. WHEN network connectivity is available, THE PWA SHALL send selections to PATCH /kyc/session/preferences endpoint
7. THE System SHALL store use-case preferences in the kyc_sessions table preferences JSON field
8. THE Use-Case selection SHALL be optional and skippable
9. THE PWA SHALL display descriptive text for each category explaining the relevant features
10. THE Use-Case selection SHALL be a frontend-only demo with no impact on account provisioning

### Requirement 26: Account Status-Based Feature Gating

**User Story:** As Marie, I want to see which features are available based on my KYC validation status, so that I understand what is unlocked now and what requires validation.

#### Acceptance Criteria

1. WHEN Marie's Access_Level is RESTRICTED, THE PWA SHALL display all banking feature tiles with a locked state
2. WHEN Access_Level is RESTRICTED, THE PWA SHALL display "⏳ Votre compte est en cours de validation" on locked tiles
3. WHEN Marie's Access_Level is LIMITED_ACCESS, THE PWA SHALL unlock: cash-in deposits, view balance, and account settings
4. WHEN Access_Level is LIMITED_ACCESS, THE PWA SHALL lock: outbound transfers, cash-out, crypto, savings, investment, and card issuance
5. WHEN Access_Level is LIMITED_ACCESS, THE PWA SHALL display "Complétez votre NIU pour débloquer" on locked tiles
6. WHEN Marie's Access_Level is FULL_ACCESS, THE PWA SHALL display all features as unlocked
7. WHEN Marie's Session status is DISABLED, THE PWA SHALL display "Votre compte a été désactivé. Contactez votre agence ou notre support client."
8. WHEN Session status is DISABLED, THE PWA SHALL display contact information: help_desk@bicec.com and +237612345678
9. THE PWA SHALL poll GET /kyc/session/status every 30 seconds to update Access_Level
10. THE feature gating SHALL be a frontend-only demo with no actual banking operations

### Requirement 27: Notification Strategy and Polling

**User Story:** As Marie, I want to receive timely updates about my KYC status, so that I know when action is required or when my account is activated.

#### Acceptance Criteria

1. THE System SHALL use SMS notifications exclusively for OTP delivery
2. THE System SHALL use in-app notifications for all KYC status updates
3. WHEN the PWA is in foreground, THE PWA SHALL poll GET /notifications?since={timestamp} every 15 seconds
4. WHEN the PWA is in background, THE PWA SHALL poll GET /notifications?since={timestamp} every 60 seconds
5. THE System SHALL return unread notifications with: notification ID, type, message, timestamp, and read status
6. WHEN Marie views a notification, THE PWA SHALL send PATCH /notifications/{id}/read to mark it as read
7. IF the in-app notification delivery fails after 3 polling attempts, THEN THE System SHALL send an Orange SMS fallback notification
8. THE Orange SMS fallback SHALL contain: "BICEC VeriPass: {brief_status_message}. Ouvrez l'app pour plus de détails."
9. THE System SHALL record all notification deliveries in the notifications table
10. THE notifications table SHALL store: user ID, notification type, message, delivery method, timestamp, and read status

### Requirement 28: Back-Office Authentication and RBAC

**User Story:** As a back-office agent, I want to log in with email and password, so that I can securely access my role-specific dashboard.

#### Acceptance Criteria

1. WHEN an agent navigates to the Back_Office login page, THE Back_Office SHALL display email and password input fields
2. WHEN an agent submits valid credentials, THE System SHALL verify the password hash using bcrypt or Argon2
3. WHEN credentials are valid, THE System SHALL issue a JWT token with 8-hour expiry
4. WHEN credentials are valid, THE System SHALL redirect the agent to their role-specific dashboard
5. THE System SHALL redirect Jean to the Validation Desk dashboard
6. THE System SHALL redirect Thomas to the AML/Compliance dashboard
7. THE System SHALL redirect Sylvie to the Command Center dashboard
8. THE System SHALL redirect Admin IT to the Administration Panel (`/admin`)
9. WHEN an agent enters incorrect credentials 5 consecutive times, THE System SHALL lock the account for 15 minutes
10. WHEN an account is locked, THE Back_Office SHALL display "Compte temporairement verrouillé. Réessayez dans 15 minutes."
11. WHEN a JWT token expires, THE System SHALL return HTTP 401 and the Back_Office SHALL redirect to the login page
12. THE System SHALL enforce role-based access control at the API level
13. THE System SHALL deny Jean access to Thomas's AML endpoints, Sylvie's Command Center endpoints, and Admin IT's admin endpoints
14. THE System SHALL deny Admin IT access to Jean's validation endpoints, Thomas's AML endpoints, and Sylvie's metrics endpoints
15. THE System SHALL never store passwords in plain text

### Requirement 29: Docker Compose Infrastructure

**User Story:** As a developer, I want a fully configured Docker Compose environment, so that all services start with a single command.

#### Acceptance Criteria

1. WHEN docker compose up is executed, THE System SHALL start Nginx, FastAPI, PostgreSQL, Redis, Celery, PWA, and Back_Office containers
2. THE System SHALL configure Nginx to listen on port 443 with TLS 1.3 using a self-signed certificate for development
3. THE System SHALL configure Nginx to proxy FastAPI on port 8000
4. THE System SHALL configure Nginx to proxy PWA on port 3000
5. THE System SHALL configure Nginx to proxy Back_Office on port 3001
6. THE System SHALL configure PostgreSQL to listen on port 5432
7. THE System SHALL configure Redis to listen on port 6379
8. THE System SHALL configure WSL2 RAM limit to 8GB via .wslconfig file
9. THE System SHALL provide a docker_prune.sh script that prunes build cache and logs when disk usage exceeds 85%
10. THE System SHALL configure health checks for all containers with 60-second timeout
11. THE System SHALL ensure all containers pass health checks before marking the stack as ready

### Requirement 30: Database Schema and Migrations

**User Story:** As a developer, I want core database tables created via Alembic migrations, so that all epics have a consistent and versioned schema.

#### Acceptance Criteria

1. WHEN alembic upgrade head is executed, THE System SHALL create the following tables: users, kyc_sessions, documents, ocr_fields, biometric_results, notifications, audit_logs, agents, roles, agencies, pep_sanctions, kyc_step_events
2. THE kyc_sessions table SHALL include a status column with allowed values: DRAFT, PENDING_KYC, PENDING_INFO, COMPLIANCE_REVIEW, READY_FOR_OPS, PROVISIONING, OPS_ERROR, OPS_CORRECTION, VALIDATED_PENDING_AGENCY, ACTIVATED_LIMITED, ACTIVATED_PRE_FULL, ACTIVATED_FULL, EXPIRY_WARNING, PENDING_RESUBMIT, MONITORED, REJECTED, DISABLED, ABANDONED
3. THE kyc_sessions table SHALL include an access_level column with allowed values: RESTRICTED, PENDING_ACTIVATION, LIMITED_ACCESS, PRE_FULL_ACCESS, FULL_ACCESS, BLOCKED
4. THE System SHALL add created_at and updated_at timestamp columns to all tables
5. THE System SHALL configure created_at to default to current timestamp
6. THE System SHALL configure updated_at to automatically update on record modification
7. THE Alembic migration SHALL be idempotent and produce no errors when re-run
8. THE documents table SHALL include columns: id, session_id, document_type, format_variant, file_path, sha256_hash, created_at
9. THE ocr_fields table SHALL include columns: id, document_id, field_name, field_value, confidence_score, engine, human_corrected, corrected_value, corrected_by, created_at
10. THE audit_logs table SHALL include columns: id, event_type, actor_id, dossier_id, timestamp, ip_address, payload, sha256_hash
11. THE users table role ENUM SHALL include the value ADMIN_IT in addition to CLIENT, JEAN, THOMAS, SYLVIE
12. THE documents.format_variant column SHALL accept values: CNI_ANCIEN_LANDSCAPE, CNI_NOUVEAU_PORTRAIT, PASSPORT, N/A

### Requirement 31: AI Processing Performance

**User Story:** As the System, I want to complete AI processing within performance targets, so that Marie experiences responsive onboarding and Jean has timely dossier reviews.

#### Acceptance Criteria

1. THE OCR_Service SHALL complete CNI extraction within 5 seconds on the benchmark i3 node with 12GB RAM
2. THE Anti_Spoofing_Service SHALL complete liveness scoring within 10 seconds on the benchmark i3 node
3. THE Face_Matching_Service SHALL complete face matching within 10 seconds on the benchmark i3 node
4. THE System SHALL complete total AI processing (OCR + biometrics) within 15 seconds
5. THE GLM-OCR fallback SHALL complete processing within 30 seconds
6. THE System SHALL process GLM-OCR tasks sequentially with concurrency 1 to avoid CPU saturation
7. THE PWA SHALL process camera frames using MediaPipe WASM at a minimum of 15 frames per second on Android 8.0 devices
8. THE System SHALL support 5 concurrent active onboarding Sessions without CPU or RAM throttling
9. THE System SHALL monitor CPU usage and log warnings when usage exceeds 80% for more than 60 seconds
10. THE System SHALL monitor RAM usage and trigger docker_prune.sh when usage exceeds 85% of allocated memory

### Requirement 32: PWA Performance and Size Constraints

**User Story:** As Marie, I want the app to load quickly and consume minimal data, so that I can complete onboarding even with limited connectivity or device storage.

#### Acceptance Criteria

1. THE PWA SHALL have a total app size of less than 40 megabytes
2. THE PWA SHALL target an initial download size of less than 20 megabytes
3. THE PWA SHALL achieve a cold start time of less than 4 seconds on mid-range Android 8.0 devices
4. THE PWA SHALL resume an in-progress Session within 2 seconds of signal restoration
5. THE PWA Service Worker SHALL cache the complete app shell for offline access
6. THE PWA SHALL use code splitting to defer loading of non-critical features
7. THE PWA SHALL compress images before upload to reduce bandwidth consumption
8. THE PWA SHALL use lazy loading for images in the Evidence Inspector
9. THE PWA SHALL achieve a Lighthouse Performance score of at least 80
10. THE PWA SHALL achieve a Lighthouse Accessibility score of at least 90

### Requirement 33: Security and Encryption

**User Story:** As the System, I want to encrypt sensitive data at rest and in transit, so that client biometric and identity data is protected.

#### Acceptance Criteria

1. THE System SHALL encrypt all biometric templates using AES-256 before storage
2. THE System SHALL encrypt all CNI images using AES-256 before storage in Docker volumes
3. THE System SHALL use TLS 1.3 for all communication between the PWA and FastAPI
4. THE System SHALL use TLS 1.3 for all communication between the Back_Office and FastAPI
5. THE System SHALL hash all passwords using bcrypt with a minimum work factor of 12
6. THE System SHALL support Argon2 as an alternative password hashing algorithm
7. THE System SHALL encrypt GPS coordinates before storage in the kyc_sessions table
8. THE System SHALL encrypt Session state in IndexedDB using Web Crypto API
9. THE System SHALL generate JWT tokens with HS256 algorithm and 256-bit secret key
10. THE System SHALL rotate JWT secret keys every 90 days
11. THE System SHALL never log sensitive data (passwords, OTPs, biometric templates) in plain text

### Requirement 34: Data Sovereignty and Compliance

**User Story:** As BICEC, I want all AI processing to occur on-premise without external service calls, so that we maintain 100% data sovereignty.

#### Acceptance Criteria

1. THE OCR_Service SHALL use PaddleOCR PP-OCRv5 running locally on the i3 node
2. THE OCR_Service SHALL use GLM-OCR 0.9B running locally on the i3 node
3. THE Face_Matching_Service SHALL use DeepFace running locally on the i3 node
4. THE Anti_Spoofing_Service SHALL use MiniFASNet running locally on the i3 node
5. THE System SHALL not make external API calls for OCR, face matching, or liveness detection
6. THE System SHALL store all PEP and sanctions lists in local PostgreSQL tables
7. THE System SHALL download PEP and sanctions lists via HTTPS batch download and store locally
8. THE System SHALL retain KYC documents for 10 years in encrypted storage per COBAC requirements
9. THE System SHALL retain analytics data for 3 years
10. THE System SHALL implement data minimization by collecting only required KYC fields
11. THE System SHALL provide data subject access request (DSAR) functionality for GDPR-equivalent compliance

### Requirement 35: Internationalization and Localization

**User Story:** As Marie, I want to use the app in French or English, so that I can complete onboarding in my preferred language.

#### Acceptance Criteria

1. THE PWA SHALL support French and English language selection
2. THE PWA SHALL default to French for users in Cameroon
3. THE PWA SHALL persist language selection in local storage
4. THE PWA SHALL use regional terminology: NIU (not TIN), ENEO (not utility), CNI (not ID card)
5. THE Back_Office SHALL support French and English language selection
6. THE System SHALL store all user-facing messages in translation files
7. THE System SHALL format dates using DD/MM/YYYY format for French locale
8. THE System SHALL format currency using XAF (Central African CFA franc) symbol
9. THE PWA SHALL display error messages in the selected language
10. THE System SHALL support right-to-left (RTL) layout for future Arabic localization

### Requirement 36: Analytics Infrastructure and Data Warehouse

**User Story:** As Sylvie, I want real-time funnel tracking and dimensional analytics, so that I can identify operational bottlenecks and optimize conversion.

#### Acceptance Criteria

1. THE System SHALL implement a star schema data warehouse in PostgreSQL
2. THE data warehouse SHALL include fact tables: kyc_step_events, agent_actions, ai_processing_metrics, aml_screening_results
3. THE data warehouse SHALL include dimension tables: dim_date, dim_agent, dim_agency, dim_session_status
4. WHEN a Session completes any step, THE System SHALL insert a record in kyc_step_events within 1 second
5. THE kyc_step_events table SHALL include: session_id, step_name, timestamp, duration_seconds, success_flag
6. THE System SHALL compute funnel conversion metrics using SQL aggregations on kyc_step_events
7. THE System SHALL support CSV and JSON export of analytics data
8. THE System SHALL retain analytics data for 3 years
9. THE System SHALL provide API endpoints for real-time metrics: GET /analytics/funnel, GET /analytics/agent_performance, GET /analytics/ai_metrics
10. THE analytics API endpoints SHALL respond within 3 seconds for queries spanning up to 90 days

### Requirement 37: Logging and Observability

**User Story:** As a developer, I want structured JSON logs for all system events, so that I can troubleshoot issues and monitor system health.

#### Acceptance Criteria

1. THE System SHALL output all logs in JSON format
2. THE System SHALL include the following fields in every log entry: timestamp, level, service, message, trace_id
3. THE System SHALL use log levels: DEBUG, INFO, WARNING, ERROR, CRITICAL
4. THE System SHALL log all API requests with: method, path, status_code, duration_ms, user_id
5. THE System SHALL log all AI processing tasks with: task_type, session_id, duration_seconds, success_flag, confidence_score
6. THE System SHALL log all database queries exceeding 1 second duration
7. THE System SHALL never log sensitive data (passwords, OTPs, biometric templates) in plain text
8. THE System SHALL rotate log files daily and retain logs for 30 days
9. THE System SHALL provide a GET /health endpoint returning: service status, database connectivity, Redis connectivity, disk usage
10. THE GET /health endpoint SHALL respond within 500 milliseconds

### Requirement 38: Disk Management and Resource Optimization

**User Story:** As a system administrator, I want automated disk cleanup, so that the 200GB partition does not fill up and cause service disruption.

#### Acceptance Criteria

1. THE System SHALL monitor disk usage on the 200GB partition every 5 minutes
2. IF disk usage exceeds 85%, THEN THE System SHALL trigger the docker_prune.sh script
3. THE docker_prune.sh script SHALL remove unused Docker images, containers, and build cache
4. THE docker_prune.sh script SHALL remove log files older than 30 days
5. THE System SHALL perform a daily PostgreSQL backup before executing cleanup
6. THE PostgreSQL backup SHALL be stored in a separate backup partition
7. THE System SHALL retain daily backups for 7 days
8. THE System SHALL retain weekly backups for 4 weeks
9. THE System SHALL retain monthly backups for 12 months
10. THE System SHALL log all disk cleanup operations in the Audit_Log
11. IF disk usage remains above 85% after cleanup, THEN THE System SHALL send an alert to system administrators

### Requirement 39: Session State Machine and Lifecycle

**User Story:** As the System, I want to enforce a strict state machine for KYC sessions, so that dossiers progress through validation stages with clear audit trails.

#### Acceptance Criteria

1. THE System SHALL initialize new Sessions with status DRAFT
2. WHEN Marie submits consent, THE System SHALL transition Session status from DRAFT to PENDING_KYC
3. WHEN Jean requests additional information, THE System SHALL transition Session status from PENDING_KYC to PENDING_INFO
4. WHEN Marie provides requested information, THE System SHALL transition Session status from PENDING_INFO to PENDING_KYC
5. WHEN an AML alert is triggered, THE System SHALL transition Session status from PENDING_KYC to COMPLIANCE_REVIEW
6. WHEN Thomas clears an AML alert, THE System SHALL transition Session status from COMPLIANCE_REVIEW to PENDING_KYC
7. WHEN Jean approves a Dossier, THE System SHALL transition Session status from PENDING_KYC to READY_FOR_OPS
8. WHEN Amplitude provisioning starts, THE System SHALL transition Session status from READY_FOR_OPS to PROVISIONING
9. WHEN Amplitude provisioning succeeds, THE System SHALL transition Session status from PROVISIONING to VALIDATED_PENDING_AGENCY
10. WHEN Amplitude provisioning fails, THE System SHALL transition Session status from PROVISIONING to OPS_ERROR
11. WHEN a Session is activated with NIU document, THE System SHALL transition Session status to ACTIVATED_FULL
12. WHEN a Session is activated with declarative NIU, THE System SHALL transition Session status to ACTIVATED_LIMITED
13. WHEN Jean rejects a Dossier, THE System SHALL transition Session status to REJECTED (terminal state)
14. WHEN Thomas confirms sanctions match, THE System SHALL transition Session status to DISABLED (terminal state)
15. THE System SHALL record all state transitions in the Audit_Log with timestamp and actor ID

### Requirement 40: Parser and Serializer Requirements

**User Story:** As a developer, I want robust parsing and serialization for ISO 20022 messages, so that Amplitude provisioning is reliable and testable.

#### Acceptance Criteria

1. THE System SHALL provide an ISO_20022_Parser to parse Amplitude response messages
2. THE ISO_20022_Parser SHALL parse XML messages conforming to ISO 20022 pain.001 and pain.002 schemas
3. WHEN the ISO_20022_Parser receives a valid XML message, THE System SHALL parse it into a ProvisioningResponse object
4. WHEN the ISO_20022_Parser receives an invalid XML message, THE System SHALL return a descriptive error with line number and validation issue
5. THE System SHALL provide an ISO_20022_Serializer to format provisioning requests
6. THE ISO_20022_Serializer SHALL format ProvisioningRequest objects into valid ISO 20022 pain.001 XML messages
7. THE System SHALL provide an ISO_20022_Pretty_Printer to format ProvisioningResponse objects back into valid XML
8. FOR ALL valid ProvisioningResponse objects, parsing then printing then parsing SHALL produce an equivalent object (round-trip property)
9. THE System SHALL validate all ISO 20022 messages against the official XSD schema before sending to Amplitude
10. THE System SHALL log all parsing errors with the original message payload for debugging

### Requirement 41: Error Handling and Graceful Degradation

**User Story:** As Marie, I want clear error messages and recovery options, so that I can resolve issues without abandoning my onboarding.

#### Acceptance Criteria

1. WHEN the PWA encounters a network error during upload, THE PWA SHALL display "Erreur de connexion. Vérifiez votre réseau et réessayez."
2. WHEN the PWA encounters a network error, THE PWA SHALL provide a "Réessayer" button
3. WHEN the OCR_Service fails to extract any fields, THE System SHALL allow Marie to manually enter all fields
4. WHEN the Face_Matching_Service fails, THE System SHALL flag the Dossier for Jean's manual review instead of blocking submission
5. WHEN the Anti_Spoofing_Service fails, THE System SHALL flag the Dossier for Jean's manual review instead of blocking submission
6. WHEN the Amplitude API is unreachable, THE System SHALL transition to OPS_ERROR and notify Thomas instead of blocking the queue
7. WHEN Redis is unavailable, THE System SHALL log an error and fall back to database-backed sessions
8. WHEN PostgreSQL is unavailable, THE System SHALL return HTTP 503 Service Unavailable with retry-after header
9. THE PWA SHALL display user-friendly error messages without exposing technical stack traces
10. THE System SHALL log all errors with full stack traces for developer troubleshooting

### Requirement 42: Rate Limiting and Abuse Prevention

**User Story:** As the System, I want to prevent abuse and resource exhaustion, so that legitimate users have consistent service availability.

#### Acceptance Criteria

1. THE System SHALL rate-limit OTP requests to 3 per phone number per hour
2. THE System SHALL rate-limit login attempts to 5 per account per 15 minutes
3. THE System SHALL rate-limit API requests to 100 per user per minute
4. WHEN a rate limit is exceeded, THE System SHALL return HTTP 429 Too Many Requests with retry-after header
5. THE System SHALL implement exponential backoff for failed OTP verification attempts
6. THE System SHALL block IP addresses with more than 50 failed authentication attempts per hour
7. THE System SHALL unblock IP addresses automatically after 24 hours
8. THE System SHALL log all rate limit violations in the Audit_Log
9. THE System SHALL provide a manual IP unblock function in the Admin panel for Thomas
10. THE System SHALL use Redis for distributed rate limiting across multiple FastAPI instances

### Requirement 43: Accessibility and Inclusive Design

**User Story:** As Marie with visual impairment, I want the app to be accessible with screen readers, so that I can complete onboarding independently.

#### Acceptance Criteria

1. THE PWA SHALL provide alt text for all images and icons
2. THE PWA SHALL use semantic HTML elements (header, nav, main, footer, article)
3. THE PWA SHALL provide ARIA labels for all interactive elements
4. THE PWA SHALL support keyboard navigation for all features
5. THE PWA SHALL maintain a focus indicator visible on all interactive elements
6. THE PWA SHALL use color contrast ratios of at least 4.5:1 for normal text
7. THE PWA SHALL use color contrast ratios of at least 3:1 for large text
8. THE PWA SHALL not rely solely on color to convey information
9. THE PWA SHALL provide text alternatives for all audio and video content
10. THE PWA SHALL achieve WCAG 2.1 Level AA compliance for core onboarding flows
11. THE Back_Office SHALL achieve WCAG 2.1 Level AA compliance for agent workflows

### Requirement 44: Testing and Quality Assurance

**User Story:** As a developer, I want comprehensive automated tests, so that I can deploy with confidence and catch regressions early.

#### Acceptance Criteria

1. THE System SHALL provide unit tests for all OCR, face matching, and liveness detection services
2. THE System SHALL provide integration tests for all API endpoints
3. THE System SHALL provide end-to-end tests using Playwright for critical user journeys
4. THE end-to-end tests SHALL cover: registration, CNI capture, liveness, address entry, NIU declaration, consent, and submission
5. THE System SHALL achieve at least 80% code coverage for backend services
6. THE System SHALL achieve at least 70% code coverage for PWA components
7. THE System SHALL provide property-based tests for the ISO_20022_Parser round-trip property
8. THE System SHALL provide load tests simulating 5 concurrent onboarding sessions
9. THE System SHALL run all tests in CI/CD pipeline before deployment
10. THE System SHALL fail the build if any test fails or coverage drops below threshold

### Requirement 45: Admin IT — Gestion du lifecycle des agents back-office

**User Story:** En tant qu'Admin IT BICEC, je veux pouvoir créer, modifier et désactiver les comptes des agents back-office et les assigner à leurs agences, afin que chaque agent puisse se connecter dès son premier jour et que les dossiers soient correctement routés vers la bonne agence.

#### Acceptance Criteria

1. WHEN l'Admin IT accède au panel d'administration, THE System SHALL afficher la liste de tous les agents back-office (nom, email, rôle, agence, statut)
2. WHEN l'Admin IT soumet le formulaire de création d'agent avec nom, prénom, email, rôle et agence, THE System SHALL créer un compte avec un mot de passe initial aléatoire sécurisé (min 16 caractères, hash bcrypt work factor ≥12) et envoyer ce mot de passe par email à l'agent
3. WHEN un compte agent est créé, THE System SHALL associer l'agent à l'agence sélectionnée via `agents.agency_id`
4. WHEN l'Admin IT modifie l'agence d'un agent, THE System SHALL mettre à jour `agents.agency_id` et journaliser l'action dans `audit_logs` avec l'ancien et le nouvel `agency_id`
5. WHEN l'Admin IT désactive un compte agent, THE System SHALL passer `users.status` à `DISABLED`, invalider immédiatement tous les JWT actifs de cet agent (via blacklist Redis), et empêcher toute nouvelle connexion
6. WHEN l'Admin IT déclenche une réinitialisation de mot de passe pour un agent, THE System SHALL générer un token temporaire (TTL 24h) et envoyer un lien de réinitialisation par email à l'agent
7. THE System SHALL rejeter toute tentative de connexion d'un agent dont le statut est `DISABLED` ou `LOCKED`
8. THE System SHALL enregistrer dans `audit_logs` toutes les actions Admin IT avec : actor_id, action, cible (agent_id), timestamp, IP
9. THE System SHALL interdire à l'Admin IT de modifier ou désactiver son propre compte (protection anti-lockout)
10. WHEN le système est déployé pour la première fois, THE System SHALL bootstrapper le premier compte Admin IT via le script `scripts/seed_admin_it.sql` — aucune interface UI n'est requise pour cette opération initiale
11. THE System SHALL rediriger un Admin IT authentifié vers le panel d'administration (route `/admin`) — jamais vers les dashboards Jean, Thomas, ou Sylvie
12. THE System SHALL interdire à l'Admin IT d'accéder aux endpoints de validation KYC, AML, ou aux dashboards opérationnels (RBAC strict)

### Requirement 46: CNI — Gestion des variantes de format et champs OCR complets

**User Story:** En tant que système OCR, je veux détecter automatiquement le format de la CNI (ancienne orientation paysage vs nouvelle orientation portrait) et extraire tous les champs pertinents des deux faces, afin que les dossiers KYC soient complets et que la détection du visage soit précise.

#### Acceptance Criteria

1. WHEN une image CNI Recto est reçue par l'OCR service, THE System SHALL calculer le ratio largeur/hauteur pour détecter le format : ratio > 1.2 → `CNI_ANCIEN_LANDSCAPE`, ratio ≤ 1.2 → `CNI_NOUVEAU_PORTRAIT`
2. THE System SHALL stocker le format détecté dans `documents.format_variant`
3. WHEN le format est `CNI_ANCIEN_LANDSCAPE`, THE Face_Matching_Service SHALL chercher le visage dans la zone droite du recto (≥ 60% de la largeur)
4. WHEN le format est `CNI_NOUVEAU_PORTRAIT`, THE Face_Matching_Service SHALL chercher le visage dans la zone haute du recto (≤ 40% de la hauteur)
5. WHEN une image CNI Recto est traitée, THE OCR_Service SHALL tenter d'extraire les champs : `cni_nom`, `cni_prenom`, `cni_date_naissance`, `cni_lieu_naissance`, `cni_sexe`, `cni_taille`, `cni_profession`, `cni_numero_cni`
6. WHEN une image CNI Verso est traitée, THE OCR_Service SHALL tenter d'extraire les champs : `cni_pere`, `cni_mere`, `cni_situation_pro`, `cni_adresse`, `cni_autorite_nom`, `cni_date_delivrance`, `cni_date_expiration`, `cni_poste_identification`, `cni_identifiant_unique`
7. THE System SHALL stocker chaque champ extrait comme une ligne distincte dans `ocr_fields` avec son `confidence_score` individuel
8. THE System SHALL traiter l'absence d'un champ non-obligatoire (ex: `cni_taille`, `cni_profession`) comme un résultat avec `confidence_score = 0` et `field_value = NULL` — cela ne bloque pas la progression du dossier
9. THE System SHALL NEVER stocker `cni_identifiant_unique` (identifiant état civil de la CNI) dans le champ NIU — ces deux valeurs proviennent d'autorités différentes et sont stockées séparément
10. WHEN `cni_date_expiration` est dans le passé, THE System SHALL positionner `kyc_sessions.doc_expiry_flag = TRUE` et notifier Jean lors de la revue du dossier

---

## Non-Functional Requirements Summary

### Performance Requirements

- **NFR-P1**: Total AI processing (OCR + biometrics) SHALL complete within 15 seconds on the benchmark i3 node
- **NFR-P2**: OCR extraction SHALL complete within 5 seconds per document
- **NFR-P3**: Liveness and face matching SHALL complete within 10 seconds combined
- **NFR-P4**: PWA camera guidance SHALL operate at minimum 15 FPS on Android 8.0 devices
- **NFR-P5**: PWA cold start SHALL complete within 4 seconds
- **NFR-P6**: Session resumption SHALL complete within 2 seconds
- **NFR-P7**: System SHALL support 5 concurrent active onboarding sessions without throttling
- **NFR-P8**: Dashboard queries SHALL respond within 3 seconds for datasets up to 1000 dossiers
- **NFR-P9**: Health check endpoint SHALL respond within 500 milliseconds

### Security Requirements

- **NFR-S1**: All biometric templates SHALL be encrypted using AES-256
- **NFR-S2**: All CNI images SHALL be encrypted using AES-256
- **NFR-S3**: All PWA-to-API communication SHALL use TLS 1.3
- **NFR-S4**: All passwords SHALL be hashed using bcrypt (work factor ≥12) or Argon2
- **NFR-S5**: JWT tokens SHALL use HS256 with 256-bit secret keys
- **NFR-S6**: JWT secret keys SHALL rotate every 90 days
- **NFR-S7**: Sensitive data SHALL never be logged in plain text
- **NFR-S8**: Session state in IndexedDB SHALL be encrypted using Web Crypto API

### Data Sovereignty Requirements

- **NFR-D1**: All AI processing SHALL occur on-premise without external service calls
- **NFR-D2**: PEP and sanctions lists SHALL be stored in local PostgreSQL tables
- **NFR-D3**: KYC documents SHALL be retained for 10 years in encrypted storage (COBAC compliance)
- **NFR-D4**: Analytics data SHALL be retained for 3 years
- **NFR-D5**: System SHALL implement data minimization principles

### Scalability and Resource Requirements

- **NFR-R1**: PWA app size SHALL be less than 40 MB (target: 20 MB initial download)
- **NFR-R2**: Docker Compose deployment SHALL operate within 8GB WSL2 RAM limit
- **NFR-R3**: System SHALL trigger disk cleanup when usage exceeds 85% of 200GB partition
- **NFR-R4**: System SHALL support daily PostgreSQL backups with 7-day retention

### Internationalization Requirements

- **NFR-I1**: System SHALL support French and English languages
- **NFR-I2**: System SHALL use regional terminology (NIU, ENEO, CNI, CAMWATER)
- **NFR-I3**: System SHALL format dates as DD/MM/YYYY for French locale
- **NFR-I4**: System SHALL format currency using XAF symbol

### Observability Requirements

- **NFR-O1**: All logs SHALL be in JSON format
- **NFR-O2**: All logs SHALL include: timestamp, level, service, message, trace_id
- **NFR-O3**: System SHALL log all API requests with duration and status
- **NFR-O4**: System SHALL log all AI processing tasks with duration and confidence scores
- **NFR-O5**: System SHALL rotate logs daily and retain for 30 days

---

## Compliance and Regulatory Requirements

### COBAC Requirements

- **REG-C1**: System SHALL retain KYC documents for 10 years in encrypted storage
- **REG-C2**: System SHALL provide one-click compliance pack export (PDF + JSON + images)
- **REG-C3**: System SHALL maintain immutable SHA-256 audit log of all actions
- **REG-C4**: System SHALL support PEP and sanctions screening against UN/EU/OFAC lists

### Cameroonian Data Protection (Loi 2024-017)

- **REG-L1**: System SHALL obtain explicit consent for biometric data processing
- **REG-L2**: System SHALL display privacy notice for GPS data collection
- **REG-L3**: System SHALL implement data subject access request (DSAR) functionality
- **REG-L4**: System SHALL maintain 100% data sovereignty (no external AI service calls)

### Accessibility Requirements

- **REG-A1**: PWA SHALL achieve WCAG 2.1 Level AA compliance for core onboarding flows
- **REG-A2**: Back-Office SHALL achieve WCAG 2.1 Level AA compliance for agent workflows
- **REG-A3**: System SHALL support screen readers with proper ARIA labels
- **REG-A4**: System SHALL maintain keyboard navigation for all features

---

## Conclusion

This requirements document defines the complete functional and non-functional requirements for the BICEC VeriPass sovereign digital KYC onboarding platform. All requirements follow EARS patterns for clarity and testability, and comply with INCOSE quality rules for precision and completeness.

The requirements cover eight major epics spanning client onboarding (Marie), agent validation (Jean), AML compliance (Thomas), and operational oversight (Sylvie), with comprehensive security, performance, and regulatory compliance constraints.

Implementation of these requirements will deliver a production-ready, sovereign, on-premise KYC platform that meets COBAC regulatory requirements while providing an accessible and resilient user experience for BICEC clients in Cameroon.
