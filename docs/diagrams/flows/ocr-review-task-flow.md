# OCR Review Task Flow — BICEC VeriPass

**Nom officiel:** OCR Review Task Flow  
**Version:** 1.0  
**Date:** 2026-02-26  
**Auteur:** Ken (UX Designer)

---

## Description

Ce micro-flux détaille le processus de revue et correction des données extraites par OCR depuis la CNI. Il implémente le paradigme "Auto-Extraction" où l'utilisateur ne remplit jamais de formulaires vides, mais confirme/corrige des données pré-remplies avec badges de confiance.

---

## Task Flow Diagram (Mermaid)

```mermaid
graph TD
    START([CNI images captured]) --> B07[B07 OCR Processing<br/>Loading animation<br/>Analyzing...]
    
    B07 --> B07_EXTRACT[PaddleOCR extracts fields:<br/>• Nom<br/>• Prénom<br/>• Date Naissance<br/>• Numéro CNI<br/>• Date Délivrance<br/>• Lieu Naissance]
    
    B07_EXTRACT --> B07_CONFIDENCE[Calculate confidence per field:<br/>🟢 >85% High<br/>🟠 50-85% Low<br/>🔴 <50% Not Detected]
    
    B07_CONFIDENCE --> B08[B08 OCR Review & Edit<br/>Card-based layout<br/>All data PRE-FILLED]
    
    %% ========== FIELD REVIEW ==========
    B08 --> B08_SCAN{User scans<br/>all fields}
    
    B08_SCAN --> B08_GREEN[🟢 Green Fields<br/>High confidence >85%<br/>Non-editable by default<br/>Checkmark icon]
    
    B08_SCAN --> B08_ORANGE[🟠 Orange Fields<br/>Low confidence 50-85%<br/>Tap to edit inline<br/>Warning icon]
    
    B08_SCAN --> B08_RED[🔴 Red Fields<br/>Not detected <50%<br/>Mandatory correction<br/>Alert icon]
    
    %% ========== ORANGE FIELD CORRECTION ==========
    B08_ORANGE --> B08_ORANGE_TAP{User taps<br/>orange field?}
    B08_ORANGE_TAP -->|No - accepts value| B08_VALIDATE
    B08_ORANGE_TAP -->|Yes - edits| B08_ORANGE_EDIT[Inline edit mode<br/>Keyboard appears<br/>Real-time validation]
    
    B08_ORANGE_EDIT --> B08_ORANGE_SAVE{User saves<br/>correction?}
    B08_ORANGE_SAVE -->|Yes| B08_ORANGE_UPDATE[Field updated<br/>Badge changes to 🟢<br/>Manual correction logged]
    B08_ORANGE_UPDATE --> B08_VALIDATE
    B08_ORANGE_SAVE -->|Cancel| B08_ORANGE
    
    %% ========== RED FIELD CORRECTION ==========
    B08_RED --> B08_RED_MANDATORY[❌ CTA disabled<br/>Must correct red fields]
    B08_RED_MANDATORY --> B08_RED_TAP{User taps<br/>red field?}
    B08_RED_TAP -->|No - CTA remains disabled| B08_RED_MANDATORY
    B08_RED_TAP -->|Yes - edits| B08_RED_EDIT[Inline edit mode<br/>Keyboard appears<br/>Format validation]
    
    B08_RED_EDIT --> B08_RED_SAVE{User saves<br/>correction?}
    B08_RED_SAVE -->|Invalid format| B08_RED_ERROR[❌ Format error<br/>Example shown<br/>Retry]
    B08_RED_ERROR --> B08_RED_EDIT
    B08_RED_SAVE -->|Valid format| B08_RED_UPDATE[Field updated<br/>Badge changes to 🟢<br/>Manual entry logged]
    B08_RED_UPDATE --> B08_VALIDATE
    
    %% ========== VALIDATION ==========
    B08_VALIDATE{All fields<br/>validated?}
    B08_VALIDATE -->|🟠 or 🔴 remain| B08_CTA_DISABLED[CTA: Confirmer et continuer<br/>DISABLED state<br/>Gray, 40% opacity]
    B08_CTA_DISABLED --> B08
    
    B08_VALIDATE -->|All 🟢| B08_CTA_ENABLED[CTA: Confirmer et continuer<br/>ENABLED state<br/>Orange, 100% opacity]
    
    B08_CTA_ENABLED --> B08_SUBMIT{User taps<br/>CTA?}
    B08_SUBMIT -->|No - reviews again| B08
    B08_SUBMIT -->|Yes| B08_SAVE[Save validated data<br/>Audit log: Original OCR + Manual corrections]
    
    B08_SAVE --> END([✅ End: OCR data validated<br/>Proceed to Liveness])
    
    %% ========== STYLING ==========
    style START fill:#E37B03,stroke:#333,stroke-width:2px,color:#fff
    style END fill:#10B981,stroke:#333,stroke-width:2px,color:#fff
    
    style B08_GREEN fill:#10B981,stroke:#333,stroke-width:2px,color:#fff
    style B08_ORANGE fill:#F59E0B,stroke:#333,stroke-width:2px,color:#fff
    style B08_RED fill:#EF4444,stroke:#333,stroke-width:2px,color:#fff
    
    style B08_ORANGE_UPDATE fill:#10B981,stroke:#333,stroke-width:2px,color:#fff
    style B08_RED_UPDATE fill:#10B981,stroke:#333,stroke-width:2px,color:#fff
    style B08_RED_ERROR fill:#EF4444,stroke:#333,stroke-width:2px,color:#fff
    
    style B08_CTA_DISABLED fill:#9CA3AF,stroke:#333,stroke-width:2px,color:#fff
    style B08_CTA_ENABLED fill:#E37B03,stroke:#333,stroke-width:2px,color:#fff
```

---

## Détails Techniques

### Confidence Calculation

#### PaddleOCR Output
```json
{
  "nom": {
    "text": "MBARGA",
    "confidence": 0.92
  },
  "prenom": {
    "text": "Jean",
    "confidence": 0.88
  },
  "date_naissance": {
    "text": "15/03/1985",
    "confidence": 0.76
  },
  "numero_cni": {
    "text": "123456789",
    "confidence": 0.45
  }
}
```

#### Badge Assignment Logic
```python
def assign_badge(confidence):
    if confidence >= 0.85:
        return "🟢 HIGH"  # Green - Non-editable by default
    elif confidence >= 0.50:
        return "🟠 LOW"   # Orange - Tap to edit
    else:
        return "🔴 NOT_DETECTED"  # Red - Mandatory correction
```

### Field Validation Rules

| Field | Format | Example | Validation |
|-------|--------|---------|------------|
| Nom | Alpha only | MBARGA | Regex: `^[A-ZÀ-Ÿ\s-]+$` |
| Prénom | Alpha only | Jean | Regex: `^[A-ZÀ-Ÿa-zà-ÿ\s-]+$` |
| Date Naissance | DD/MM/YYYY | 15/03/1985 | Age 18-100 years |
| Numéro CNI | 9 digits | 123456789 | Regex: `^\d{9}$` |
| Date Délivrance | DD/MM/YYYY | 10/01/2020 | After Date Naissance |
| Lieu Naissance | Alpha + spaces | Yaoundé | Regex: `^[A-ZÀ-Ÿa-zà-ÿ\s-]+$` |

### Inline Editing UX

#### Orange Field (Low Confidence)
```
┌─────────────────────────────────────┐
│ 🟠 Date de Naissance                │
│ ┌─────────────────────────────────┐ │
│ │ 15/03/1985                      │ │ ← Tap to edit
│ └─────────────────────────────────┘ │
│ Confiance: 76% - Vérifiez SVP      │
└─────────────────────────────────────┘
```

#### Red Field (Not Detected)
```
┌─────────────────────────────────────┐
│ 🔴 Numéro CNI                       │
│ ┌─────────────────────────────────┐ │
│ │ [Vide - Saisissez manuellement] │ │ ← Must fill
│ └─────────────────────────────────┘ │
│ Format: 9 chiffres (ex: 123456789) │
└─────────────────────────────────────┘
```

#### Green Field (High Confidence)
```
┌─────────────────────────────────────┐
│ 🟢 Nom                              │
│ MBARGA                              │ ← Non-editable (tap to unlock)
│ ✓ Validé                            │
└─────────────────────────────────────┘
```

### Audit Trail

Every correction is logged for Jean's review:

```json
{
  "field": "date_naissance",
  "ocr_value": "15/03/1985",
  "ocr_confidence": 0.76,
  "user_correction": "15/03/1986",
  "correction_timestamp": "2026-02-26T14:32:15Z",
  "correction_type": "MANUAL_EDIT"
}
```

---

## User Experience Notes

### Auto-Extraction Paradigm
- **NO blank forms**: All fields pre-filled by AI
- **User role**: Validator, not data entry clerk
- **Cognitive load**: Reduced from "fill 6 fields" to "verify 6 fields"

### Confidence Badges
- **🟢 Green**: Builds trust ("AI got it right")
- **🟠 Orange**: Prompts attention ("Please verify")
- **🔴 Red**: Clear action required ("Must correct")

### Inline Editing
- **No modals**: Edit directly in card (Revolut pattern)
- **No separate screens**: Keeps context visible
- **Real-time validation**: Immediate feedback on format errors

### CTA Gating
- **Disabled state**: Clear visual (gray, 40% opacity)
- **Enabled state**: Vibrant orange, 100% opacity
- **Logic**: Prevents submission with unresolved 🟠🔴 fields

### Timing
- **OCR Processing**: 3-5 seconds
- **User Review**: 1-2 minutes (depends on corrections needed)
- **Total**: 1.5-2.5 minutes

---

## Accessibility

- **Visual**: High contrast badges (WCAG AA compliant)
- **Motor**: Large tap targets (48x48dp minimum)
- **Cognitive**: Clear icons + text labels (not color-only)
- **Screen Readers**: Badge states announced ("High confidence, validated")

---

## Références

- **CNI Capture Flow**: `docs/diagrams/flows/cni-capture-task-flow.md`
- **End-to-End Flow**: `docs/diagrams/flows/end-to-end-user-flow.md`
- **UX Spec v2**: `_bmad-output/planning-artifacts/ux-design-specification-v2.md` (Module B, Screen B08)
- **PRD**: `_bmad-output/planning-artifacts/prd.md` (FR5, FR20, FR24)
