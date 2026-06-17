# Flux de capture signature manuscrite — BICEC VeriPass

**Version:** 1.0
**Date:** 2026-06-17

---

## Description

Ce flux détaille la capture et l'upload d'une feuille de papier blanc comportant 3 signatures manuscrites et la date du jour. L'image est ensuite compressée, uploadée en tant que document `SIGNATURE_SHEET`, puis liée à l'enregistrement de consentement de la session KYC.

Le dessin sur canvas (ancien flux) a été supprimé. La caméra est le mode de capture prioritaire, avec un sélecteur de fichier en fallback (JPG/PNG uniquement, pas de PDF).

---

## Flux Mermaid

```mermaid
graph TD
    START([Écran Signature]) --> INSTR[État instructions<br/>Texte : Signez 3 fois sur une feuille blanche,<br/>ajoutez la date du jour, puis prenez-la en photo]

    INSTR --> CHOIX{Choix de capture}
    CHOIX -->|Caméra| CAM[Ouvrir caméra arrière<br/>getUserMedia environment]
    CHOIX -->|Fichier| FILE[Ouvrir sélecteur fichiers<br/>accept .jpg .jpeg .png]

    CAM --> CAPTURE[Capturer frame<br/>canvas toBlob JPEG 0.90]
    FILE --> VALIDATE{Validation fichier}

    VALIDATE -->|Type invalide| ERR_TYPE[Erreur : format non supporté]
    ERR_TYPE --> INSTR
    VALIDATE -->|Trop volumineux| ERR_SIZE[Erreur : taille max 10 Mo]
    ERR_SIZE --> INSTR
    VALIDATE -->|OK| COMPRESS

    CAPTURE --> COMPRESS[compressForUpload<br/>Max 1800px, JPEG 0.70<br/>Cible 500 Ko]

    COMPRESS --> CHECK_SIZE{Taille post-compression<br/>≤ 10 Mo ?}
    CHECK_SIZE -->|Non| ERR_CAP_SIZE[Erreur : image trop volumineuse]
    ERR_CAP_SIZE --> INSTR
    CHECK_SIZE -->|Oui| REVIEW[État review<br/>Aperçu de l'image capturée]

    REVIEW --> DECISION{Action utilisateur}
    DECISION -->|Reprendre| INSTR
    DECISION -->|Confirmer| UPLOAD

    UPLOAD[Upload vers backend] --> DOC_UPLOAD[POST /api/v1/kyc/document/upload<br/>FormData : file + doc_type=SIGNATURE_SHEET<br/>+ session_id + client_sha256]

    DOC_UPLOAD --> DOC_OK{Réponse 200 ?}
    DOC_OK -->|Non| OFFLINE_DOC[Enqueue offline<br/>submit_signature]
    DOC_OK -->|Oui| SIG_SUBMIT[POST /api/v1/kyc/signature/submit<br/>JSON : document_id]

    SIG_SUBMIT --> SIG_OK{Réponse 200 ?}
    SIG_OK -->|Non| OFFLINE_SIG[Enqueue offline<br/>submit_signature]
    SIG_OK -->|Oui| DONE[completeStep signature<br/>Navigation vers /kyc/ocr-review]

    OFFLINE_DOC --> DONE
    OFFLINE_SIG --> DONE
```

---

## États de l'écran

| État | UI | Comportement |
| --- | --- | --- |
| `instructions` | `ScreenLayoutV2`, texte d'instruction, boutons Capturer / Choisir un fichier | État initial |
| `camera` | Plein écran, flux vidéo, overlay cadre, bouton capture | Caméra arrière prioritaire, fallback caméra frontale |
| `review` | Aperçu image, boutons Reprendre / Confirmer | Compression appliquée, vérification taille |
| `uploading` | Indicateur de progression | Upload en cours |

---

## Points d'intégration

- **Compression :** `compressForUpload()` depuis `src/utils/imageCompression.ts` (max 1800px, JPEG 0.70, cible 500 Ko, fallback 0.55)
- **Intégrité :** SHA-256 calculé via `crypto.subtle.digest`, envoyé comme `client_sha256`
- **Offline :** `enqueueOfflineSignature()` depuis `kycSyncService.ts`, op_type `submit_signature`
- **Replay offline :** upload du document `SIGNATURE_SHEET` puis appel `signature/submit` avec le `document_id`
- **OCR :** le pipeline OCR n'est pas déclenché pour `SIGNATURE_SHEET` (absent de `OCR_ENABLED_DOC_TYPES`)
- **Backoffice :** le document `SIGNATURE_SHEET` apparaît automatiquement comme onglet dans `EvidenceViewerPage` via le chargement dynamique des documents du dossier
