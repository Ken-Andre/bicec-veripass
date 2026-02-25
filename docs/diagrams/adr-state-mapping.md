# ADR: Authoritative State & Flow Mapping

**Date:** 2026-02-23
**Context:** The interactive MVP prototype (`MobileOnboarding.tsx` and `BackOffice.tsx`) has been finalized and validated. Previous planning artifacts contained discrepancies and outdated steps. This document establishes the authoritative flow, state machines, and UX mapping based exactly on the prototype's implementation.

## 1. Mobile Onboarding Flow (The 18-Step Sequence)

The mobile onboarding follows a strict, linear 18-step sequence before reaching the post-submission dashboard states.

```mermaid
graph TD
    %% Démarrage
    S1[welcome - Bienvenue] --> S2[language - Langue]
    
    %% Auth
    S2 --> S3[phone-otp - Téléphone & OTP]
    S3 --> S4[email-verify - Email]
    S4 --> S5[pin-setup - Code PIN]
    S5 --> S6[biometrics - Biométrie]
    
    %% Identité
    S6 --> S7[id-front - CNI Recto]
    S7 --> S8[id-back - CNI Verso]
    S8 --> S9[ocr-review - Vérification OCR]
    S9 --> S10[liveness - Détection Vivacité]
    
    %% Domicile
    S10 --> S11[address - Adresse]
    S11 --> S12[address-proof - Justificatif]
    
    %% Fiscal
    S12 --> S13[fiscal-id - NIU]
    
    %% Finalisation
    S13 --> S14[consent - Consentement]
    S14 --> S15[signature - Signature]
    S15 --> S16[review-summary - Récapitulatif]
    S16 --> S17[uploading - Envoi sécurisé]
    S17 --> S18[success - Soumis]
    
    %% Post-Submission Dashboard States
    S18 --> D_PENDING[Dashboard: En cours de vérification]
    D_PENDING -.->|Validation Agent Mismatch| D_LIMITED[Dashboard: Accès limité - NIU manquant]
    D_PENDING -.->|Validation Totale| D_FULL[Dashboard: Accès Complet]
    D_LIMITED -.->|Ajout NIU ultérieur| D_FULL
```

## 2. Liveness State Machine

The liveness step (Step 10) contains its own internal state machine to handle the 3-strikes rule and camera interactions.

```mermaid
stateDiagram-v2
    [*] --> idle
    idle --> scanning : Commencer
    scanning --> success : Liveness Validé
    scanning --> failed : Échec (Strike +1)
    
    failed --> idle : Réessayer (Strikes < 3)
    failed --> Bloqué : 3 Strikes Atteints
    
    Bloqué --> [*] : Recommencer (Wipe cache)
    success --> [*] : Suivant
```

## 3. Back-Office Persona Flow & Views

The Back-Office is governed by a Strict Role-Based Access Control (RBAC) mapping to specific React views.

```mermaid
graph LR
    Login[Login: Choix Persona] --> Router{Persona Routing}
    
    %% Jean (Opérationnel Agence)
    Router -->|Jean K.| Jean[Agent Agence]
    Jean --> JB1[Dashboard Agent]
    Jean --> JB2[File de Validation Applications]
    JB2 --> JB3[Détail Application Side-by-Side]
    
    %% Thomas (National AML/CFT)
    Router -->|Thomas N.| Thomas[Superviseur National]
    Thomas --> TB1[Dashboard National]
    Thomas --> TB2[Screening AML / Fraude]
    Thomas --> TB3[Déduplication & Conflits]
    Thomas --> TB4[Administration Agences]
    Thomas --> TB5[Batch Amplitude Monitoring]
    Thomas --> TB6[Métriques Nationales]
    
    %% Sylvie (Direction)
    Router -->|Sylvie E.| Sylvie[Direction & Pilotage]
    Sylvie --> SB1[Command Center Pilotage]
    Sylvie --> SB2[Audit Logs Viewer]
```
