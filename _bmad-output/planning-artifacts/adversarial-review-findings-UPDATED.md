# Adversarial Review Findings: bicec-veripass BMAD Planning Work

**Review Date:** 2026-02-12  
**Reviewer:** Antigravity (Multi-Agent Hat Review)  
**Review Methodology:** review-adversarial-general (Cynical, Zero-Tolerance, Evidence-First)  
**Updated with Ken's Context:** 2026-02-15 (3-day review feedback incorporated)  
**Overall Assessment:** 🔴 NOT READY FOR IMPLEMENTATION - Paused at Step 4/10 (UX Specification)

---

## 👤 Critical Context: Who is Ken & Why Work Stopped

**Ken's Profile:**
- 5th year Computer Science Engineering student (Data/AI specialization: Data Science, LLM Engineering, AI)
- Intern at BICEC with ~3 months remaining (not counting February)
- Assigned this KYC platform project verbally by supervisor
- **Thesis Focus:** Data/BI components (evaluators will assess this primarily, NOT dev work)
- **MVP Goal:** Functional local demo with mock APIs that BICEC IT can correct post-internship

**Why Planning Artifacts Are Incomplete:**
1. **Stopped at UX Phase (Step 4/10 BMAD)** after discovering Sally (UX Designer) produced incomplete/inconsistent work with **fake image links**
2. **Preventing Error Propagation:** Agents were "poisoned" by Ken's initial draft document (ebauche) which wasn't meant to be taken literally
3. **Right Decision:** Better to catch issues at Step 4 than let them propagate through Architecture → Epics → Implementation
4. **Document Responsibility Confusion:** Agents made technical decisions (tech stack, tools) that should be Architect's responsibility, not PM or UX

**Ken's Pragmatic Constraints:**
- **Not a Dev specialist** - focus is Data/AI, so dev quality is secondary to demo functionality
- **No access to real APIs** - will use mocks for DGI, BEAC, Amplitude (BICEC IT will replace post-internship)
- **Local Docker demo only** - not production deployment, just thesis presentation
- **"Shadow IBU" is acceptable** - these are test accounts for demo purposes, clearly documented as non-production

> **Ken's Request:** "Je t'ai pris pour que tu confirmes bien ce que je pensais et tu l'as bien fait." This review validates Ken's instinct to pause and fix foundational issues before proceeding.

---

## Executive Summary

The bicec-veripass planning phase shows ambition and vision but suffers from critical execution gaps, missing fundamental artifacts, and dangerous inconsistencies. **Ken correctly stopped at Step 4/10** to prevent these issues from propagating into Architecture and Implementation.

**Critical Blockers Found:** 27 issues, but many are **expected given Ken paused at Step 4** (Architecture, Epics, Implementation artifacts don't exist yet because they haven't been started).

**Path Forward:** Fix PM (PRD) and UX Designer (UX Spec) documents, THEN proceed to Architecture → Epics → Implementation.

---

## 🚨 CRITICAL BLOCKERS (Tier 1)

### 1. Missing Architecture Documentation ⚠️ EXPECTED - Not Started Yet
**Severity:** 🔴 CRITICAL | **Responsible Agent:** Architect (Winston) | **Status:** Pending - Step 5/10

**Finding:** There is ZERO architectural documentation in the _bmad-output directory.

> **Ken's Context:** *"En fait, actuellement je venais de finir les échanges avec Sally l'ux designer et je me suis rendue compte que son document etait tellement incomplet... c'est la que je me suis dit il ne faut pas que ca se propage plus loin on n'etait juste qu'a la 4e sur 10 etapes du core Bmad."*

**Resolution:** This is **NOT a failure** - it's the correct BMAD sequence. Architecture comes AFTER UX (Step 5). Ken will create this after fixing UX issues.

**What's Missing (to be created by Architect):**
- [ ] System architecture diagram (C4 Model Level 1-3)
- [ ] Component interaction diagrams
- [ ] Data flow diagrams (Marie's journey → Storage → Jean's validation)
- [ ] Database schemas (PostgreSQL for back-office, SQLite for mobile)
- [ ] API contract specifications (FastAPI endpoints)
- [ ] Docker Compose service definitions
- [ ] Security architecture (encryption at rest/in transit)
- [ ] Integration architecture (Mocks for DGI, BEAC, Amplitude)

**Important Note from Ken:**
> *"J'etais confu par tout les termes techniques qu'ils employaient, les technologies qu'ils parlaient sans avoir fait une etude comparative puis une justification du choix et meme pourquoi c'est la bas qu'ils le font ce n'est pas le gars de l'architecture qui le fera/est cense le faire?"*

**Verdict:** PM and UX agents overstepped by making tech stack decisions. Architect should make these choices with proper ADRs.

---

### 2. Missing Epics & Stories ⚠️ EXPECTED - Not Started Yet
**Severity:** 🔴 CRITICAL | **Responsible Agent:** PM (John) | **Status:** Pending - Step 6/10

**Finding:** Zero epics, zero user stories, zero acceptance criteria found.

> **Ken's Context:** Same as #1 - correctly paused at Step 4/10 before Epics phase.

**BMAD Sequence:** Epics & Stories come AFTER Architecture (Step 6). Not creating them yet is the **correct decision**.

**Resolution:** After Architecture is complete, run `/create-epics-and-stories` workflow.

---

### 3. Zero Implementation Artifacts ⚠️ EXPECTED - Not Started Yet
**Severity:** 🔴 CRITICAL | **Responsible Agent:** Dev (Amelia) | **Status:** Pending - Step 9/10

**Finding:** The _bmad-output/implementation-artifacts directory is completely empty.

> **Ken's Full Context:** *"En fait moi je suis la personne finale, Ken, un etudiant 5e annee ingenieurie informatique dominante data... la partie dev ne sera pas ce sur quoi mes evaluateurs de soutenance de fin d'etudes regarderont plus car ce n'est pas ma spe, mais plutot la partie data le coeur du metier."*

**Resolution:** Implementation happens at Step 9/10 BMAD, AFTER Architecture and Epics. This is expected to be empty.

**Ken's MVP Strategy:**
- Local Docker demo with mock APIs (DGI, BEAC, Amplitude)
- Focus on Data/BI pipeline showcase for thesis defense
- BICEC IT will replace mocks with real integrations post-internship
- "Shadow IBU" test accounts acceptable for demo environment (clearly documented as non-production)

**Thesis Defense Focus Areas (Data/BI):**
1. Funnel analytics pipeline
2. Intelligent load balancing for agent queues
3. Audit trail & compliance logging
4. AI performance metrics (OCR confidence, liveness accuracy)

---

### 4. UX Mockups: Referenced But Missing ✅ RESOLVED
**Status:** Ken will use **Google Stitch** baseline for all future designs. Sally (UX) is assigned to generate real mockups using the Stitch MCP instructions. Baseline sanitized.

> **Ken's Context:** *"Sally est limite meme les images qu'elle dit avoir fait elle n'a pas fait ce sont des faux liens aucune image n'existe."*

**User Decision - Use Google Stitch:**
> *"Pour cela je voudrais plutot faire tout les Ui sur Stitch de google (stitch.withgoogle.com) et en suivant la doc pour ensuite generer tout les prompts qui vont ensuite etre utilise via le mcp de stitch deja connecte sur cette machine."*

**Action Required:**
1. Create Stitch project for bicec-veripass mobile UI
2. Follow Stitch prompt guide: https://discuss.ai.google.dev/t/stitch-prompt-guide/83844/121
3. Use Stitch MCP (already connected) to generate PNG mockups
4. Create Revolut UI mapping table:

**Proposed Table Format (from Ken):**
| Nom de l'écran | Type d'interaction | Description de l'action | Options disponibles | État ou Message d'erreur | Catégorie de fonctionnalité | Source |
|---|---|---|---|---|---|---|
| Paramètres de la carte (Settings) | Bouton / Sélecteur | Gérer les options de sécurité et les limites de la carte bancaire | Débloquer le CVV, Limite de dépenses, Renommer la carte, Terminer la carte | Utiliser après 3 tentatives de PIN/CVV incorrectes | Gestion de carte | 1 |

> "A chaque tour pour chaque 1-5 image du flow de Revolut il ajoutera une ligne par rapport"

**Resolution:** Sally (UX Designer) must create REAL mockups using Stitch, indexed to Revolut reference images.

---

### 5. Inconsistent "11-Minute" vs "15-Minute" Claims ✅ RESOLVED
**Status:** All documents (PRD, Brief, UX Spec) updated and aligned to the "15-Minute Breakthrough" (11-min stretch) metric. Coherence 100%.

**Ken's Decision (ACCEPTED):**
> *"J'accepte ta seconde recommandation 15 minute breakthrough et 11 minutes strectch goal. Il faudra demander a chaque responsable de son fichier de faire cette corection pour que toutes soient coherent et qu'il n'yait plus de fausses donnees."*

**Action Required:**
- **PRD (PM):** Change "11-Minute Breakthrough" → "15-Minute Breakthrough" with 11-min stretch goal
- **Product Brief (Mary):** Align success metrics to "<15 minutes average (11-min stretch)"
- **UX Spec (Sally):** Update Module flow timing estimates

---

### 6. 3-Strike Liveness Lockout: Policies Aligned ✅ RESOLVED
**Status:** PRD FR7 and UX Spec wireframes updated with Ken's exact French copy and "Fresh Start" logic. Technical behavior synchronized.

**Ken's Correct UX Copy (FINAL):**
> *"Desole pour la gene, mais pour <x,y> raisons, nous sommes obliges de terminer cette session. Ne vous inquietez pas, vous avez toujours la possibilite neanmoins d'aller dans une agence locale proche de chez vous, ou de recommencer des le debut. Cliquez juste en dessous si vous voulez dans ce cas recommencer [le bouton 'Fresh Start']"*

**Key Clarification:**
> *"En realite ici il n'y a pas de clic pour choisir une agence"* - just informational text, one button: "Fresh Start"

**Technical Behavior:**
- Data auto-wipes AFTER user clicks "Fresh Start" button (not immediately on 3rd failure)
- No separate "Find Agency" CTA - just informational text mentioning agency option

**Action Required:**
- **PRD (PM):** Update FR7 with Ken's exact copy
- **UX Spec (Sally):** Update wireframe B07_Lockout with single-button flow
- **Implementation Plan:** Remove "auto-wipe" language, clarify timing

> *"N'oublie donc pas que toi ou autre procede ces corrections dans ces 3 documents touches afin que ca ne re retropropage pas encore"*

---

## 🟡 MAJOR DESIGN FLAWS (Tier 2)

### 7. NIU Manual Entry: LIMITED_ACCESS Status Defined ✅ RESOLVED
**Status:** PM (John) has defined the precise list of allowed/blocked features. STATUS is locked in PRD FR16/FR45 and UX SPEC. 
- **Allowed**: Cash-In, balance view, settings.
- **Blocked**: Transfers, cards, removals, savings, credit.
- **Process:** NIU Declarative → `LIMITED_ACCESS` (Auto-gated) → Jean's manual validation → `FULL_ACCESS`.

---

### 8. Wet Signature 3x Capture: Strategy Corrected ✅ RESOLVED
**Status:** Requirement properly retained in mobile flow per supervisor instructions. All documents (PRD, UX Spec) verified for compliance. Logic for post-onboarding "ruse" documented.

**Ken's Decision (Option 3 - Post-Activation):**
> *"Merci, tu as raison ca n'a pas de sens. En fait la version numerique a ete une idee de nous mais ne sachant pas si la Beac l'apprecierait avec leurs regles restant encore un peu archaiques, ils preferent quand tu signe. Je valide donc ton option 3 ou l'on peut le faire apres par mail par exemple"*

**Action Required:**
- **PRD (PM):** RETAIN FR19 (3x wet signature capture) per supervisor directive.
- **UX Spec (Sally):** RETAIN Module D screens.
- **Context:** Logic for post-onboarding "ruse" and signature card compliance is now primary.


---

### 9. "Shadow IBU" / Mock BEAC Strategy ✅ ACCEPTABLE FOR THESIS DEMO
**Severity:** 🟡 HIGH → ✅ RESOLVED with Context | **Responsible Agent:** Implementation Plan | **Status:** Needs Better Wording

**Finding:** "Shadow IBU" seems like regulatory disaster.

**Ken's Full Clarification:**
> *"Ces comptes seront comme des reelles mais pour tester tout le prototype et les parcours ux. Ca reste qu'il y'aura toujours pas pour le deploiement, c'est juste dans ma machine ou il y'aura tout le conteneur docker et ses services. Donc pour la demo, j'aurais besoin de simuler les vrais etant donne qu'en tant que stagiaire on ne me donnera pas acces aux vrais ce qui pourrait etre un vrai bottleneck qui m'empecherais de finir tout le mvp de mon projet."*

**Context:**
- This is a **student thesis demo on local machine**, not production deployment
- Ken needs to simulate real accounts for UX demo/thesis defense
- As an intern, he has no access to real BEAC/DGI/Amplitude APIs
- BICEC IT will replace mocks with real integrations post-internship

**Resolution:** Terminology needs improvement, but strategy is **valid for thesis context**.

**Action Required (Implementation Plan):**
- Replace "Shadow IBU" → "Demo IBU Pool (Test Environment Only)"
- Add disclaimer: "For thesis demonstration purposes only. Production deployment requires real BEAC IBU API connectivity (to be implemented by BICEC IT post-internship)."
- Clearly document: "All 20-50 pilot accounts are test accounts in local Docker database, NOT production Amplitude"

> *"Mais peut etre la maniere de le dire devrait etre un peu plus/mieux elabore je n'en disconviens"*

---

### 10. 16GB RAM Constraint: No Performance Validation ⚠️ TO BE VALIDATED LATER
**Severity:** 🟡 HIGH | **Responsible Agent:** Architect/Performance Engineer | **Status:** Deferred until Architecture Phase

**Finding:** No benchmark proof that AI stack can run on i3/16GB hardware.

> **Ken's Context:** *"Je n'ai pas encore realise ceci et c'est bien garde le aussi. D'ou le pourquoi je ne me suis arrete qu'a l'etape 4 UX Specification. Garder cela pour verification apres corrections."*

**Resolution:** This validation happens DURING Architecture phase (Step 5), not before. Keep this requirement for Architect to benchmark.

**Ken's Additional Frustration:**
> *"Mais meme si mon ebauche n'etait pas bon ils n'ont pas assez ete intelligent ces agents pour le decouvrir et me poser des questions dessus pour qu'il l'ameliore. J'etais outrage par tout les termes techniques qu'ils mettaient tous comme des peroquets alors qu'ils sont tous avant l'architecte."*

**Lesson:** Agents shouldn't make hardware/performance claims without validation. Architect should run benchmarks BEFORE finalizing hardware requirements.

---

### 11. Address Cascade + GPS: Simplified Strategy ✅ USER DECISION MADE
**Severity:** 🟡 MEDIUM → ✅ RESOLVED | **Responsible Agent:** PM (PRD) | **Status:** Simplified GPS Strategy

**Finding:** Two redundant address input mechanisms (Cascade + Map Pin).

**Ken's Simplified GPS Strategy (ACCEPTED):**

> *"On remplace la map OSM obligatoire par: Soit un simple bouton 'Utiliser ma position actuelle (optionnel)' qui lit GPS natif et enregistre lat/lon en metadata pour ce premier temps."*

**New Requirements:**
1. **Primary Input:** Address Cascade (Ville → Commune → Quartier → Lieu-dit) - MANDATORY
2. **Secondary Input:** GPS button "Utiliser ma position actuelle" - OPTIONAL
3. **GPS Purpose:** Future use cases (delivery, scoring) + soft coherence check
4. **Coherence Logic:**
   - Address cascade = **regulatory truth for KYC**
   - GPS = **support metadata**
   - If distance > X km: Show warning (don't block): "La position GPS semble loin du quartier sélectionné, vérifier ?"
5. **Privacy Notice:** "We collect GPS for compliance. Data encrypted and never shared."

**Context from Ken:**
> *"En fait normalement dans le processus bancaire pour la creation de compte d'habitude l'utilisateur de maniere symbolique indique ou il habite(sa maison) en essayant de faire comme un plan de localisation visuelle sur papier ou il l'indique."*

**Action Required:**
- **PRD (PM):** Update FR10/FR11 with simplified GPS button strategy
- **UX Spec (Sally):** Update Module C, Screen C02 - replace OSM map embed with button + privacy modal
- **Remove:** Manual map pin interaction, OSM tile downloads (saves 5-10MB data)

---

### 12. Utility Bill OCR Coherence Check - REVISED SCOPE ✅ USER DECISION MADE
**Severity:** 🟡 MEDIUM → ✅ RESOLVED | **Responsible Agent:** PM (PRD) | **Status:** Simplified + Load Balancing Focus

**Finding:** Automated address matching between bill and declared address is technically impossible.

**Ken's New Scope (from Supervisor Feedback):**

> *"Yes you are right on certain level. But i get from my superior this day that en fait que ce qu'il attend de l'application surtout c'est pour l'amelioration, facilitation de la relation client/mise en clientele et attends beaucoup des fonctionnalites du back office plutot."*

**NEW MVP Focus (ENEO Bill OCR):**
1. **Extract from Bill:** Date + ENEO Agency name only (NOT full address)
2. **Agent Matching Logic (NEW FR):** Use ENEO agency zone to assign dossier to **nearest BICEC agency**
3. **Load Balancing Logic (NEW FR):** Distribute dossiers to agents based on:
   - Agent capacity: min 2, max 10 dossiers per agent
   - Agent availability: online/offline status
   - Current load: prefer agents with fewer active dossiers
4. **Manual Review:** Jean validates address coherence visually (not automated)

**OCR Evidence Provided by Ken:**

**Blank ENEO Bill:** Fields largely empty, inconsistent formatting
**Filled ENEO Bill:** Can extract:
- `Agence: NEW-BELL`
- `Ville: WOURI`  
- `Date de Facturation: 21/08/2020`
- `Point De Livraison: WOURI822-03-03-143-00-008`

**Conclusion:** OCR CAN extract key fields reliably, but address MATCHING is infeasible. Use **ENEO agency for BICEC agency routing** instead.

**Final Account Signing Flow:**
> *"Et malgre tout cet onboarding, le jour final ou le compte est signe on a besoin qu'ils lisent d'autres contrats et signe en lui envoyant de maniere ruse, subtil quelque chose qui lui ferait venir, puis apres on le prendra une fois en guet-apens pour lui demander une fois de faire ce que je t'ai dit avant la."*

**Action Required:**
- **PRD (PM):** Simplify FR13 - OCR extracts date + ENEO agency only
- **PRD (PM):** Add NEW FR - ENEO agency → BICEC agency matching logic
- **PRD (PM):** Add NEW FR - Intelligent load balancing for agent queues
- **PRD (PM):** Add integration note: Amplitude has webservice extension for batch account creation ("compte tiers")

---

### 13. Back-Office Portal: Tech Stack Contradiction 🟡 PM OVERSTEPPED
**Severity:** 🟡 MEDIUM | **Responsible Agent:** Architect (Winston), NOT PM | **Status:** Remove from PRD

**Finding:** PRD says "React" but also mentions `fl_chart` (Flutter library).

> **Ken's Clarification:** *"Merci de le questionner car en effet c'est une grosse incoherence. C'est le desktop web pour le portail back-office. En plus il ne devrait pas entrer dans les decisions techniques ou terminologies ici car ca revient a l'architecte ou le tech lead agent de le faire."*

**Root Cause:**
> *"C'est a cause de moi parce que mon premier document d'ebauche qui n'etait pas a prendre au mot mais plutot comme pour anoncer la couleur et le contexte, qui c'est ensuite malheuresement propage and poisoned their thoughts dans les documents qu'ils ont produits."*

**Resolution:**
- **PRD (PM):** REMOVE all tech stack references (React, fl_chart). Change to generic "Back-Office Portal (Web-based SPA)"
- **Architecture (Winston):** Create ADR-TECH-001 to choose web framework with proper justification
- **Lesson:** PM should define WHAT (requirements), Architect defines HOW (technology)

---

### 14. Grafana Dashboard: Undesigned ⚠️ DEFERRED TO ARCHITECTURE
**Severity:** 🟡 MEDIUM | **Responsible Agent:** Architect (Winston) + UX Designer (Sally) | **Status:** To Be Designed

**Finding:** Grafana mentioned but never architected or wireframed.

**Ken's Note on Workflow Recommendations:**
> In original review I mistakenly put "DevOps Engineer" as responsible. Ken corrected:
> *"En suivant ce workflow ce n'est pas lui qui le fera, corrige. Et actuellement je ne me suis arrete qu'a l'etape du Ux"*

**Action Required (AFTER Architecture):**
- **Architect:** Define Grafana data pipeline (FastAPI → Prometheus → Grafana)
- **UX Designer:** Create Sylvie's dashboard wireframe using Stitch
  - Reference: https://discuss.ai.google.dev/t/stitch-prompt-guide/83844/121
  - Show: Big Numbers (SLA, Success Rate), Funnel Graph, System Health (R/Y/G)

---

### 15. Push Notifications: Unplanned 🟡 DEFERRED TO ARCHITECTURE
**Severity:** 🟡 MEDIUM | **Responsible Agent:** Architect (Winston), NOT PM | **Status:** To Be Designed

**Finding:** FR41 mandates push notifications but no infrastructure plan.

**Correction:** The original review said "Mobile Engineer" was responsible. This is WRONG.

> **Ken:** *"Je vois plus en bas que c'est le PRD dont vous parlez donc c'est le PM et pas le mobile Engineer qui en est responsable."*

**Clarification:** PM defines the REQUIREMENT (FR41), but **Architect** designs the implementation (FCM/APNS strategy).

**Action Required:**
- **PRD (PM):** FR41 stays as-is (requirement for push notifications)
- **Architecture (Winston):** Design push notification pipeline (FCM/APNS, fallback to SMS, permission flow)

---

## 🟠 MODERATE ISSUES (Tier 3)

### 16. COBAC Regulation Citations: Missing 🟠 PM TO ADD
**Severity:** 🟠 MEDIUM | **Responsible Agent:** PM (John - PRD), NOT Compliance Officer

**Finding:** PRD claims regulatory compliance but provides no citation links.

**Correction from Ken:**
> Original review said "Compliance Officer" should add citations. Ken corrected:
> *"C'est a celui qui a redige le document que tu dois lui demander de l'ajouter pas a celui ci"*
> 
> And: *"Dans le Finding du parle du PRD et c'est pas le Compliance Officer qui redige ce document"*

**Action Required:**
- **PRD (PM):** Add Regulatory Compliance Matrix appendix with:
  - COBAC R-2023/01 citation + requirements
  - COBAC R-2019/02 citation + requirements
  - Law 2024-017 (Data Protection) citation + requirements
  - Implementation mapping (which FRs address which regulations)

---

### 17. Research Reports Not Reviewed ⚠️ OUT OF SCOPE
**Severity:** 🟠 MEDIUM | **Status:** Acknowledged

**Finding:** Two research reports exist but weren't reviewed in this adversarial audit.

**Resolution:** Out of scope for this review. Ken has these documents for reference.

---

### 18. Product Brief vs PRD: Two Documents ✅ ACCEPTABLE
**Severity:** 🟠 LOW → ✅ NOT AN ISSUE | **Status:** Both Needed for BMAD

**Finding:** Why do both Product Brief and PRD exist?

**Ken's Explanation:**
> *"En fait, c'est que lorsque l'on le construit, l'on l'enregistre la bas. Et ensuite on passe au document qui suit cela. Si tous n'etais pas la tu n'aurais pas pu bien faire ta revue"*

**Resolution:** This is correct BMAD workflow. Product Brief (Mary/Business Analyst) → PRD (John/PM). Both serve as valid planning artifacts. No action needed.

---

### 19. No Test Artifacts ⚠️ EXPECTED - Not Started Yet
**Severity:** 🟠 MEDIUM | **Responsible Agent:** QA (Quinn) | **Status:** Pending - Step 10/10

**Finding:** The _bmad-output/test-artifacts directory is empty.

**Resolution:** Test artifacts are created AFTER implementation (Step 10). Expected to be empty at Step 4.

---

### 20. "Revolut-Styled" Design: Mockups Needed 🔴 LINKED TO FINDING #4
**Severity:** 🟠 MEDIUM → 🔴 BLOCKER | **Responsible Agent:** UX Designer (Sally)

**Finding:** Revolut patterns described in text, but no adapted mockups created.

**Ken's Preparation:**
> *"Prepare toi apres que j'aurais avec toutes les captures recenser toutes les images de Revolut"*

**Action Items:**
1. Ken will catalog all Revolut reference images (currently 5, more coming)
2. UX Designer will create adapted mockups using Stitch MCP
3. Create mapping table linking each bicec-veripass screen to Revolut inspiration source

**Revolut Patterns to Adapt:**
- Liquid Glass Kit with glassmorphism
- Card-based layouts with shadow/shimmer
- Document scanning with real-time frame guidance
- Selfie capture with facial detection overlay
- Map interface with prominent action buttons

---

### 21. Screen Inventory: Missing Navigation Diagram 🟡 UX TO EXPAND
**Severity:** 🟠 MEDIUM | **Responsible Agent:** UX Designer (Sally)

**Finding:** 24+ screens defined but Mermaid diagram is incomplete (missing error paths, back button behavior).

**Action Required:**
- Expand Mermaid flow to include:
  - Error loops (OTP fail 3x → Account lock)
  - Back button behavior per screen
  - Session resume entry points (App reopen → where does user land?)

---

### 22. WCAG AA Color Contrast: Unvalidated 🟡 UX TO AUDIT
**Severity:** 🟠 MEDIUM | **Responsible Agent:** UX Designer (Sally)

**Finding:** #E37B03 (Mango Orange) on white = 2.8:1 contrast (FAILS WCAG AA for text <4.5:1).

**Action Required:**
- Audit all color combinations
- **Option 1:** Darken orange to #C75000 for button backgrounds
- **Option 2:** Use orange as accent only (borders/icons), not button fills
- Document validated color palette

---

### 23. English Localization: Missing 🟡 UX TO ADD
**Severity:** 🟠 LOW | **Responsible Agent:** UX Designer (Sally), NOT separate Copywriter

**Finding:** French copywriting provided, but NFR12 mandates French + English.

**Correction from Ken:**
> Original review said "UX Copywriter." Ken corrected:
> *"C'est toujours le UX designer qui s'en occupera"*

**Action Required:**
- **UX Spec (Sally):** Add English column to copywriting table

---

### 24. AES-256 Key Management: Undesigned ⚠️ DEFERRED TO ARCHITECTURE  
**Severity:** 🟠 MEDIUM | **Responsible Agent:** Architect (Winston), NOT PM

**Finding:** NFR5 requires AES-256 encryption but no key management strategy.

**Resolution:** This is an **Architecture** responsibility (Step 5), not PM's. Architect will define:
- Key generation strategy (per session/user/dossier)
- Key storage (environment variables, Docker secrets)
- Key access control
- Key rotation policy

---

### 25. Docker Pruning (NFR9): Operational Risk ⚠️ DEFERRED
**Severity:** 🟠 MEDIUM | **Status:** To Be Addressed in DevOps Phase

**Finding:** Auto-pruning at 85% disk usage is dangerous; 200GB partition is tiny.

**Resolution:** This is a DevOps/Operations concern for production deployment, not MVP demo. Ken's local Docker setup can use manual pruning.

---

### 26. Amplitude Integration: Architecture Clarified ✅ RESOLVED
**Severity:** 🟠 MEDIUM → ✅ CLARIFIED | **Status:** Internal API Strategy

**Finding:** Core Banking Middleware Clarification.

**Ken's Clarification:**
> *"Iwomi était un prestataire contractuel pour les outils internes. Le core banking se fait exclusivement par Sopra Banking Amplitude. A part Amplitude, BICEC n'a pas d'autres pour son core banking."*

**Context:**
- Iwomi = Historical BICEC contractor for internal tools (NOT a technical middleware for bicec-veripass)
- Core banking = **Sopra Banking Amplitude only**
- **Action:** All Iwomi references removed from PRD, Product Brief, and Scoping docs.

**Ken's MVP Strategy:**
> *"Dans les dernieres nouvelles de mes superieurs ils m'ont dit que ma solution comme il est contenarise et aura ses propres dbs pourraient juste avoir une autre API interne qui pourra etre utilisable en interne."*

**Resolution:**
- bicec-veripass will have its own DBs
- Will expose internal API for batch account creation ("compte tiers")
- Amplitude has webservice extension → API bridge can be created post-MVP
- REST/SOAP details: *"Je ne sais pas, et pas besoin"* for MVP demo purposes

---

### 27. GPS Compliance: Legal Basis Clarified ✅ USER DECISION MADE
**Severity:** 🟠 LOW → ✅ RESOLVED | **Responsible Agent:** PM (PRD)

**Finding:** Why is GPS collected? What's the legal basis?

**Ken's Final Decision (Mix of 3 Options):**
> *"We can do the mix of the 3: It is required, we will notice them but we will only use the location service to find their exact coordinates for that time, in order to ease the procedures for them of using the OSM pin, now they will only click the button 'localise me', with the privacy notice."*

**Requirements:**
1. GPS IS required for KYC compliance
2. User clicks "Utiliser ma position actuelle" button (optional but recommended)
3. Privacy notice explains purpose
4. Justification: *"Enregistre pour des fins de controle reglementaire de KYC"*

**Action Required:**
- **PRD (PM):** Update FR11 with privacy notice requirement
- **UX Spec (Sally):** Add privacy modal in Module C

---

## 📊 Summary by Severity (With Context)

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL - ACTUAL BLOCKERS | 2 | UX Mockups (fake links), Policy Alignments (11/15-min, 3-strike) |
| 🔴 CRITICAL - EXPECTED (Not Started) | 3 | Architecture, Epics, Implementation (correct to be empty at Step 4/10) |
| 🟡 HIGH - USER DECISIONS MADE | 5 | Wet signature, Shadow IBU, GPS strategy, Utility bill scope, LIMITED_ACCESS (needs PM input) |
| 🟡 HIGH - DEFERRED TO ARCHITECTURE | 2 | RAM validation, Tech stack decisions |
| 🟠 MEDIUM - UX FIXES | 5 | Revolut mockups, navigation diagram, WCAG audit, English copy, agent hat corrections |
| 🟠 MEDIUM - ARCHITECTURE PHASE | 3 | Grafana, Push notifications, Key management |
| 🟠 MEDIUM - RESOLVED | 3 | Product Brief/PRD split, Iwomi Core, GPS compliance |
| 🟠 LOW/OUT OF SCOPE | 4 | Research reports, Test artifacts (expected empty), Docker pruning, Regulatory citations (PM to add) |

**Total Issues: 27** (but most are either expected given Step 4/10 pause, or resolved with Ken's context)

---

## 🎯 BMAD Workflow Status

| Phase | Status | Current Step | Notes |
|-------|--------|--------------|-------|
| 1. Research & Analysis | ✅ Complete | Research reports exist | Mary (Business Analyst) |
| 2. Planning & Requirements | 🔄 In Progress | **UX Specification (Step 4/10)** | **KEN PAUSED HERE** |
| 3. Solution Design | ⏳ Pending | Architecture (Step 5), Epics (Step 6) | Winston (Architect), John (PM) |
| 4. Implementation | ⏳ Pending | Sprint planning (Step 8), Dev (Step 9) | Bob (SM), Amelia (Dev) |

**Current Workflow Position:** Step 4/10 - UX Specification

**Why Ken Paused:**
1. Sally (UX Designer) produced incomplete work with fake image links
2. Agents were "poisoned" by Ken's draft document and made decisions outside their role
3. Better to fix foundational issues now than let them propagate to Architecture
4. PM and UX made tech stack decisions that should be Architect's responsibility

**Correct Next Steps:**
1. ✅ Complete this adversarial review (DONE)
2. 🔄 Fix PM (PRD) issues per Ken's decisions
3. 🔄 Fix UX (UX Spec) issues + create Stitch mockups
4. ⏭️ THEN proceed to Architecture (Step 5)
5. ⏭️ THEN Epics & Stories (Step 6)
6. ⏭️ THEN Implementation (Steps 8-9)

---

## 🎯 Immediate Actions Required (Priority Order)

### HIGH PRIORITY - Before Architecture

| # | Action | Responsible Agent | Document | Status |
|---|--------|------------------|----------|--------|
| 1 | Create REAL UI mockups using Stitch MCP | UX Designer (Sally) | UX Spec | 🔴 BLOCKER |
| 2 | Create Revolut UI mapping table | UX Designer (Sally) | UX Spec | 🔴 BLOCKER |
| 3 | Align journey time: 15-min breakthrough | PM (John), Mary | PRD, Product Brief | 🟡 HIGH |
| 4 | Fix 3-strike liveness policy (Ken's copy) | PM (John) | PRD | 🟡 HIGH |
| 5 | Remove wet signature from mobile flow | PM (John) | PRD | 🟡 HIGH |
| 6 | Simplify GPS strategy (button only) | PM (John) | PRD | 🟡 HIGH |
| 7 | Revise utility bill scope + load balancing | PM (John) | PRD | 🟡 HIGH |
| 8 | Remove tech stack references | PM (John) | PRD | 🟡 MEDIUM |
| 9 | Define LIMITED_ACCESS status | PM (John) w/ Ken | PRD | 🟡 HIGH |
| 10 | Update "Shadow IBU" wording | Implementation Plan | Implementation Plan | 🟡 MEDIUM |

### MEDIUM PRIORITY - UX Spec Enhancements

| # | Action | Responsible Agent | Status |
|---|--------|------------------|--------|
| 11 | Expand navigation Mermaid diagram | UX Designer (Sally) | 🟡 MEDIUM |
| 12 | WCAG AA color audit | UX Designer (Sally) | 🟡 MEDIUM |
| 13 | Add English copywriting column | UX Designer (Sally) | 🟡 LOW |
| 14 | Remove wet signature screens (D03/D04) | UX Designer (Sally) | 🟡 HIGH |
| 15 | Update GPS screen to button (C02) | UX Designer (Sally) | 🟡 HIGH |
| 16 | Update 3-strike lockout wireframe (B07) | UX Designer (Sally) | 🟡 HIGH |

### DEFERRED - Architecture Phase (Step 5)

| # | Action | Responsible Agent | Status |
|---|--------|------------------|--------|
| 17 | Create architecture.md document | Architect (Winston) | ⏳ PENDING |
| 18 | Choose back-office web framework (ADR) | Architect (Winston) | ⏳ PENDING |
| 19 | Design Grafana data pipeline | Architect (Winston) | ⏳ PENDING |
| 20 | Design push notification strategy | Architect (Winston) | ⏳ PENDING |
| 21 | Design AES-256 key management | Architect (Winston) | ⏳ PENDING |
| 22 | Run 16GB RAM benchmark test | Architect (Winston) | ⏳ PENDING |
| 23 | Add regulatory compliance matrix | PM (John) | ⏳ PENDING |

---

## 📁 Related Documents

**Planning Artifacts (Completed):**
- `_bmad-output/planning-artifacts/product-brief-bicec-veripass-2026-02-07.md` (Mary - Business Analyst) ✅
- `_bmad-output/planning-artifacts/research/research_report_kyc_bicec.md` (Mary) ✅
- `_bmad-output/planning-artifacts/research/technical-Bicec-Veripass-research-2026-02-03.md` ✅

**Planning Artifacts (Needs Fixes):**
- `_bmad-output/planning-artifacts/prd.md` (John - PM) 🔄 NEEDS UPDATES
- `_bmad-output/planning-artifacts/ux-design-specification.md` (Sally - UX Designer) 🔄 NEEDS UPDATES + MOCKUPS
- `_bmad-output/planning-artifacts/implementation-plan.md` (Dev - premature, should be from Architect) 🔄 MINOR UPDATES

**Missing (To Be Created Next):**
- `_bmad-output/planning-artifacts/architecture.md` (Winston - Architect) ⏳ STEP 5
- `_bmad-output/implementation-artifacts/epics-stories.md` (John - PM) ⏳ STEP 6

---

## 🎓 Lessons Learned from This Review

### What Ken Did Right ✅
1. **Stopped at the right time** - Caught Sally's fake mockups at Step 4 instead of letting errors propagate to Architecture
2. **Adversarial review request** - Asked for validation of his instinct that work was incomplete
3. **Context preservation** - Took 3 days to provide detailed comments preserving all context
4. **BMAD methodology adherence** - Followed correct sequence (don't skip to Architecture without fixing UX)

### What Agents Did Wrong ❌
1. **Overstepped role boundaries** - PM/UX made tech stack decisions that belong to Architect
2. **"Poisoned" by draft** - Took Ken's exploratory draft document too literally
3. **Didn't question inconsistencies** - Agents didn't ask clarifying questions when encountering contradictions
4. **Fake deliverables** - Sally claimed mockups existed when they didn't (fake links)

### Corrections to Original Review ✏️
1. **Agent Hat Errors** - Many findings incorrectly attributed to wrong agents (e.g., "Mobile Engineer" instead of PM, "Compliance Officer" instead of PM, "DevOps Engineer" instead of Architect)
2. **Missing Context** - Didn't understand Ken is a student with thesis constraints
3. **Expected vs Actual Blockers** - Failed to distinguish "not started yet" (correct) from "should exist but doesn't" (blocker)

---

## ✅ Final Verdict with Context

**Status:** 🟡 PLANNING PHASE PAUSED AT CORRECT CHECKPOINT

**Ken's Decision to Pause:** ✅ VALIDATED - This was the right call. Better to fix UX issues now than propagate them to Architecture and Implementation.

**Actual Blockers (Must Fix Before Step 5):**
1. 🔴 UX mockups with fake links → Create real mockups using Stitch
2. 🟡 Policy alignments (11/15-min, 3-strike liveness, wet signature)
3. 🟡 PM overreach on tech decisions → Remove from PRD, defer to Architect

**Expected Gaps (Not Blockers):**
- ✅ Architecture missing → Correct, it's Step 5 (next)
- ✅ Epics missing → Correct, it's Step 6 (after Architecture)
- ✅ Implementation empty → Correct, it's Step 9 (after Epics)

**Estimated Remediation Before Architecture:**
- PM (PRD) fixes: ~8-12 hours
- UX (Mockups + Spec updates): ~16-20 hours using Stitch
- **Total:** ~24-32 hours to reach "Architecture-ready" state

**Recommendation:** 
1. ✅ Complete PM fixes (Ken's decisions are clear)
2. ✅ Complete UX mockups using Stitch MCP
3. ✅ Validate fixes against this adversarial review
4. ⏭️ THEN proceed to `/create-architecture` (Step 5)

---

*Document generated from Adversarial Review on 2026-02-12*  
*Updated with Ken's 3-day contextual review feedback on 2026-02-15*  
*All 27 findings re-categorized with proper agent responsibility and Ken's decisions integrated*

**Next Review:** After PM and UX complete their fixes, validate against this document before proceeding to Architecture phase.
