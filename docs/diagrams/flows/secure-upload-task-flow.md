# Secure Upload Task Flow — BICEC VeriPass

**Nom officiel:** Secure Upload Task Flow  
**Version:** 1.0  
**Date:** 2026-02-26  
**Auteur:** Ken (UX Designer)

---

## Description

Ce micro-flux détaille le processus de soumission sécurisée du dossier KYC avec upload progressif, résilience réseau, et gestion des coupures ("Délestage").

---

## Task Flow Diagram (Mermaid)

```mermaid
graph TD
    START([User completes consent]) --> E01[E01 Review Summary<br/>Final checklist:<br/>✓ CNI Recto/Verso<br/>✓ Selfie<br/>✓ Utility Bill<br/>✓ NIU optional<br/>✓ Signatures]
    
    E01 --> E01_CHECK{User reviews<br/>all data?}
    E01_CHECK -->|No - edits| E01_EDIT[Navigate back to edit<br/>Preserve all data]
    E01_EDIT --> E01
    E01_CHECK -->|Yes| E01_SUBMIT{User taps<br/>Soumettre?}
    E01_SUBMIT -->|No - reviews again| E01
    E01_SUBMIT -->|Yes| 