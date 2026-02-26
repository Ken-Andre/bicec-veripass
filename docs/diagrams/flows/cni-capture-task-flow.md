# CNI Capture Task Flow — BICEC VeriPass

**Nom officiel:** CNI Capture Task Flow  
**Version:** 1.0  
**Date:** 2026-02-26  
**Auteur:** Ken (UX Designer)

---

## Description

Ce micro-flux détaille le processus de capture de la Carte Nationale d'Identité (CNI) camerounaise, incluant les guidances, validations qualité, et gestion d'erreurs.

---

## Task Flow Diagram (Mermaid)

```mermaid
graph TD
    START([User arrives at CNI capture]) --> B01[B01 CNI Intro<br/>Illustration + Why we need this]
    
    %% ========== RECTO CAPTURE ==========
    B01 --> B02[B02 CNI Recto Guidance<br/>Animated tips displayed:<br/>• Avoid glare<br/>• Avoid blur<br/>• Align in frame]
    
    B02 --> B02_READY{User taps<br/>Got it?}
    B02_READY -->|Yes| B03
    B02_READY -->|No - reads tips| B02
    
    B03[B03 CNI Recto Capture<br/>Camera active with overlay<br/>Real-time quality checks]
    
    B03 --> B03_QUALITY{Quality<br/>checks?}
    
    B03_QUALITY -->|Glare detected| B03_GLARE[❌ Feedback: Reduce glare<br/>Adjust lighting or angle]
    B03_GLARE --> B03
    
    B03_QUALITY -->|Blur detected| B03_BLUR[❌ Feedback: Image too blurry<br/>Hold phone steady]
    B03_BLUR --> B03
    
    B03_QUALITY -->|Misaligned| B03_ALIGN[❌ Feedback: Align card in frame<br/>Center the document]
    B03_ALIGN --> B03
    
    B03_QUALITY -->|All checks pass| B03_AUTO[✅ Auto-capture triggered<br/>Flash animation]
    
    B03_AUTO --> B04[B04 Capture Success<br/>Green checkmark animation<br/>Great! message]
    
    B04 --> B04_WAIT[Auto-transition after 1.5s]
    B04_WAIT --> B05
    
    %% ========== VERSO CAPTURE ==========
    B05[B05 CNI Verso Guidance<br/>Now the back side<br/>Flip animation]
    
    B05 --> B05_READY{User taps<br/>Got it?}
    B05_READY -->|Yes| B06
    B05_READY -->|No - reads tips| B05
    
    B06[B06 CNI Verso Capture<br/>Camera active with overlay<br/>Same quality guardrails]
    
    B06 --> B06_QUALITY{Quality<br/>checks?}
    
    B06_QUALITY -->|Glare detected| B06_GLARE[❌ Feedback: Reduce glare]
    B06_GLARE --> B06
    
    B06_QUALITY -->|Blur detected| B06_BLUR[❌ Feedback: Hold steady]
    B06_BLUR --> B06
    
    B06_QUALITY -->|Misaligned| B06_ALIGN[❌ Feedback: Align card]
    B06_ALIGN --> B06
    
    B06_QUALITY -->|All checks pass| B06_AUTO[✅ Auto-capture triggered]
    
    B06_AUTO --> B06_SUCCESS[Capture Success<br/>Green checkmark]
    
    B06_SUCCESS --> B06_WAIT[Auto-transition after 1.5s]
    B06_WAIT --> END
    
    END([✅ End: Both sides captured<br/>Proceed to OCR Processing])
    
    %% ========== STYLING ==========
    style START fill:#E37B03,stroke:#333,stroke-width:2px,color:#fff
    style END fill:#10B981,stroke:#333,stroke-width:2px,color:#fff
    
    style B03_GLARE fill:#EF4444,stroke:#333,stroke-width:2px,color:#fff
    style B03_BLUR fill:#EF4444,stroke:#333,stroke-width:2px,color:#fff
    style B03_ALIGN fill:#EF4444,stroke:#333,stroke-width:2px,color:#fff
    style B06_GLARE fill:#EF4444,stroke:#333,stroke-width:2px,color:#fff
    style B06_BLUR fill:#EF4444,stroke:#333,stroke-width:2px,color:#fff
    style B06_ALIGN fill:#EF4444,stroke:#333,stroke-width:2px,color:#fff
    
    style B04 fill:#10B981,stroke:#333,stroke-width:2px,color:#fff
    style B06_SUCCESS fill:#10B981,stroke:#333,stroke-width:2px,color:#fff
```

---

## Détails Techniques

### Quality Checks (Real-Time)

#### 1. Glare Detection
- **Algorithme**: Analyse des zones surexposées (pixels >240/255)
- **Seuil**: >15% de la zone document = glare détecté
- **Feedback**: "Réduisez les reflets - Ajustez l'éclairage ou l'angle"
- **Action**: Retry capture

#### 2. Blur Detection
- **Algorithme**: Laplacian variance (mesure de netteté)
- **Seuil**: Variance <100 = blur détecté
- **Feedback**: "Image trop floue - Stabilisez votre téléphone"
- **Action**: Retry capture

#### 3. Alignment Check
- **Algorithme**: Détection des contours du document
- **Seuil**: Document doit occuper 60-80% du cadre
- **Feedback**: "Alignez la carte dans le cadre - Centrez le document"
- **Action**: Retry capture

#### 4. Auto-Capture Trigger
- **Condition**: Tous les checks passent pendant 0.5s consécutives
- **Action**: Flash blanc + capture automatique
- **Feedback**: Vibration haptique légère

### Performance Requirements

- **Frame Rate**: >15 FPS sur Android 8.0 (NFR2)
- **Latency**: Quality checks <100ms par frame
- **Capture Resolution**: 1920x1080 minimum
- **Compression**: JPEG quality 90% pour upload

### Error Handling

| Erreur | Cause | Feedback | Action |
|--------|-------|----------|--------|
| Glare | Éclairage excessif | "Réduisez les reflets" | Retry |
| Blur | Mouvement ou focus | "Stabilisez votre téléphone" | Retry |
| Misalignment | Cadrage incorrect | "Centrez le document" | Retry |
| Timeout | >60s sans capture | "Besoin d'aide?" + Skip option | Retry or Skip |
| Camera Permission | Permission refusée | "Autorisation caméra requise" | Settings |

### Accessibility

- **Visual**: High contrast overlay (white on dark)
- **Motor**: Large capture area (no precise tapping required)
- **Cognitive**: Animated tips with illustrations
- **Auditory**: Visual-only feedback (no audio required)

---

## User Experience Notes

### Success Factors
- **Auto-capture**: Élimine le besoin de bouton manuel
- **Real-time feedback**: Guidance immédiate pour corriger
- **Celebration moment**: Checkmark animation renforce la confiance

### Pain Points Addressed
- **Glare**: Commun avec CNI plastifiées camerounaises
- **Blur**: Fréquent avec téléphones Android 8 (pas de stabilisation optique)
- **Alignment**: Utilisateurs novices ont du mal à cadrer

### Timing
- **Recto capture**: 30-60 secondes (avec retries)
- **Verso capture**: 20-40 secondes (utilisateur comprend le processus)
- **Total**: 1-2 minutes pour les deux faces

---

## Références

- **End-to-End Flow**: `docs/diagrams/flows/end-to-end-user-flow.md`
- **OCR Review Flow**: `docs/diagrams/flows/ocr-review-task-flow.md`
- **UX Spec v2**: `_bmad-output/planning-artifacts/ux-design-specification-v2.md` (Module B)
- **PRD**: `_bmad-output/planning-artifacts/prd.md` (FR2, FR3, NFR2)
