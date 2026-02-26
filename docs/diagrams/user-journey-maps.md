# User Journey Maps — BICEC VeriPass

**Version:** 2.1  
**Date:** 2026-02-26  
**Auteur:** Ken (UX Designer)

---

## Journey Map: Marie — Le Parcours des 15 Minutes (Success Path)

### Phase 1: DÉCOUVERTE (Avant l'app)
**Durée:** Variable  
**Contexte:** Marie cherche une solution bancaire pour son business

| Étape | Actions | Pensées | Émotions | Points de contact | Opportunités |
|-------|---------|---------|----------|-------------------|--------------|
| Recherche | Demande à ses amis, voit pub BICEC | "Est-ce que c'est vraiment plus rapide?" | 😐 Sceptique | Bouche-à-oreille, Réseaux sociaux | Marketing ciblé 18-35 ans |
| Téléchargement | Cherche "BICEC" sur Play Store | "J'espère que ça ne prend pas trop de data" | 😟 Inquiète | Play Store (19MB) | App size <20MB |

### Phase 2: INSCRIPTION (0-5 min)
**Durée:** 5 minutes  
**Objectif:** Créer un compte sécurisé

| Étape | Actions | Pensées | Émotions | Points de contact | Pain Points | Opportunités |
|-------|---------|---------|----------|-------------------|-------------|--------------|
| Welcome | Lit les 3 bénéfices | "15 minutes? On verra..." | 😐 Neutre | M-A01 Splash | Scepticisme | Preuves sociales (témoignages) |
| Phone OTP | Saisit +237 6XX | "Pourquoi ils veulent mon numéro?" | 😟 Méfiante | M-A02 Phone | Privacy concerns | Expliquer "Pourquoi?" |
| Email | Ajoute son email pro | "Au moins j'ai 2 façons de me connecter" | 😊 Rassurée | M-A04 Email | - | Dual-auth = sécurité |
| PIN Setup | Crée PIN 6 chiffres | "C'est comme mon code bancaire" | 😊 Confiante | M-A05 PIN | - | Familiarité |

**Émotion dominante:** 😐→😊 (Scepticisme → Confiance naissante)

### Phase 3: CAPTURE IDENTITÉ (5-10 min)
**Durée:** 5 minutes  
**Objectif:** Capturer CNI + Selfie

| Étape | Actions | Pensées | Émotions | Points de contact | Pain Points | Opportunités |
|-------|---------|---------|----------|-------------------|-------------|--------------|
| Intro CNI | Lit les instructions | "Ok, ils expliquent bien" | 😊 Guidée | M-B01 Intro | - | Illustrations claires |
| CNI Recto | Cadre sa carte, auto-capture | "Wow, c'est automatique!" | 😃 Impressionnée | M-B02 Capture | Reflets si mauvais éclairage | Guidance temps réel |
| CNI Verso | Retourne la carte | "Facile" | 😊 Confiante | M-B03 Capture | - | - |
| OCR Review | Vérifie les champs extraits | "L'IA a tout lu correctement!" | 😃 Émerveillée | M-B05 Review | 1-2 champs à corriger (orange) | Badges confiance clairs |
| Selfie | Sourit à la caméra | "J'espère que je suis bien cadrée" | 😐 Concentrée | M-B06 Liveness | Éclairage faible | Instructions animées |
| Success | Voit le checkmark vert | "Yes! Ça avance vite" | 😃 Satisfaite | M-B07 Success | - | Célébration micro-moment |

**Émotion dominante:** 😊→😃 (Confiance → Satisfaction)

### Phase 4: ADRESSE & FISCAL (10-13 min)
**Durée:** 3 minutes  
**Objectif:** Prouver domicile + NIU

| Étape | Actions | Pensées | Émotions | Points de contact | Pain Points | Opportunités |
|-------|---------|---------|----------|-------------------|-------------|--------------|
| Adresse | Sélectionne Douala > Akwa > ... | "C'est bien organisé" | 😊 Satisfaite | M-C01 Address | Quartier pas dans la liste | Champ libre lieu-dit |
| GPS (optionnel) | Clique "Me localiser" | "Pratique!" | 😊 Contente | M-C02 GPS | Battery drain | Optionnel |
| ENEO | Photographie sa facture | "J'ai ma facture sous la main" | 😊 Préparée | M-C02 ENEO | Facture illisible | OCR + correction manuelle |
| NIU | Hésite... clique "Plus tard" | "Je n'ai pas mon NIU là, je le ferai après" | 😟 Inquiète | M-D01 NIU | NIU pas disponible | "Plus tard" option |

**Émotion dominante:** 😊→😟 (Satisfaction → Inquiétude légère)  
**Note:** Marie choisit "Plus tard" pour le NIU → compte LIMITED_ACCESS

### Phase 5: CONSENTEMENT & SOUMISSION (13-15 min)
**Durée:** 2 minutes  
**Objectif:** Accepter CGU et soumettre

| Étape | Actions | Pensées | Émotions | Points de contact | Pain Points | Opportunités |
|-------|---------|---------|----------|-------------------|-------------|--------------|
| Récapitulatif | Scroll la liste résumé | "Tout est correct" | 😊 Confiante | M-E01 Summary | - | Miniatures rassurantes |
| CGU | Coche les 3 cases | "Je fais confiance à BICEC" | 😐 Neutre | M-E01b Consent | Texte légal long | Liens PDF courts |
| Upload | Voit la progress bar | "Ça envoie..." | 😐 Attentive | M-E02 Upload | Coupure réseau (retry auto) | Chunked upload résilient |
| Success | Confettis + checkmark | "Yes! C'est fait!" | 😃 Ravie | M-E03 Success | - | Célébration forte |

**Émotion dominante:** 😊→😃 (Confiance → Joie)

### Phase 6: ATTENTE VALIDATION (15 min - 24h)
**Durée:** Variable (cible <2h)  
**Objectif:** Découvrir les services pendant la validation

| Étape | Actions | Pensées | Émotions | Points de contact | Pain Points | Opportunités |
|-------|---------|---------|----------|-------------------|-------------|--------------|
| Dashboard RESTRICTED | Explore les fonctionnalités bloquées | "Ah, je vois ce que je pourrai faire après" | 😊 Anticipation | M-F01 Dashboard | Frustration si trop long | Push notification quand validé |
| Plans | Compare Ultra/Premium/Standard | "Ultra a l'air bien mais cher" | 🤔 Réfléchie | Plans Discovery | - | Essai gratuit 30j |
| Notification | Reçoit "Compte activé!" | "Déjà?! C'est rapide!" | 😃 Surprise positive | Push Notification | - | Timing <2h = WOW |

**Émotion dominante:** 😊→😃 (Anticipation → Surprise positive)

### Phase 7: ACTIVATION & USAGE (24h+)
**Durée:** Continue  
**Objectif:** Utiliser le compte

| Étape | Actions | Pensées | Émotions | Points de contact | Pain Points | Opportunités |
|-------|---------|---------|----------|-------------------|-------------|--------------|
| Dashboard LIMITED | Voit bannière "Ajoutez NIU" | "Ah oui, je dois faire ça" | 😐 Rappel | M-F02 Dashboard | Plafonds limités | CTA clair "Débloquer" |
| Ajout NIU | Upload attestation NIU | "Maintenant je peux tout faire" | 😊 Satisfaite | NIU Upload | - | - |
| Dashboard FULL | Explore toutes les fonctionnalités | "C'est comme Revolut!" | 😃 Impressionnée | M-F03 Dashboard | - | Onboarding features |

**Émotion dominante:** 😐→😃 (Neutre → Impressionnée)

---

## Journey Map: Marie — Le Parcours Résilient (Coupure Réseau)

### Scénario: Délestage pendant l'upload

| Étape | Actions | Pensées | Émotions | Points de contact | Solution UX |
|-------|---------|---------|----------|-------------------|-------------|
| Upload en cours | Progress bar à 60% | "Ça envoie..." | 😐 Attentive | M-E02 Upload | - |
| **COUPURE** | Écran noir, réseau perdu | "Oh non! Pas encore!" | 😤 Frustrée | Délestage | - |
| 20 min plus tard | Rallume le téléphone | "J'espère que je n'ai pas tout perdu..." | 😟 Inquiète | - | - |
| Réouverture app | Voit "Reprise de session..." | "Quoi?! Ils ont sauvegardé?!" | 😲 Surprise | Toast notification | Cache SQLite |
| Reprise | Progress bar reprend à 60% | "Incroyable! Ça marche!" | 😃 Ravie | M-E02 Upload | Chunked upload |
| Success | Confettis | "BICEC a compris le Cameroun!" | 😃 Fidélisée | M-E03 Success | Trust++ |

**Insight clé:** La résilience transforme une frustration en moment WOW qui crée de la fidélité.

---

## Journey Map: Jean — Validation d'un Dossier (3-5 min)

### Phase: VALIDATION QUOTIDIENNE

| Étape | Actions | Pensées | Émotions | Points de contact | Pain Points | Opportunités |
|-------|---------|---------|----------|-------------------|-------------|--------------|
| Login | Se connecte au back-office | "Combien de dossiers aujourd'hui?" | 😐 Neutre | A-J02 Dashboard | - | - |
| Dashboard | Voit 8 dossiers en attente | "Ça va, c'est gérable" | 😊 Soulagé | A-J02 Dashboard | >15 = stress | Load balancing auto |
| Queue | Clique sur dossier prioritaire | "Celui-là est urgent (SLA)" | 😟 Pressé | A-J03 Queue | SLA proche | Badge rouge |
| Side-by-Side | Zoom sur CNI recto | "La photo est nette, parfait" | 😊 Confiant | A-J04 Review | - | Zoom haute-res |
| Vérification | Compare champs un par un | "Tout correspond" | 😊 Satisfait | A-J04 Review | - | ✓ par champ |
| Approve | Clique "Approve All" | "Dossier propre, validé" | 😊 Fier | A-J04 Review | - | Audit trail auto |
| Next | Retour à la queue | "Suivant!" | 😊 Productif | A-J03 Queue | - | - |

**Émotion dominante:** 😐→😊 (Neutre → Satisfait)  
**Temps moyen:** 3-5 minutes/dossier

---

## Journey Map: Thomas — Gestion Alerte AML (10-15 min)

### Phase: SCREENING AML

| Étape | Actions | Pensées | Émotions | Points de contact | Pain Points | Opportunités |
|-------|---------|---------|----------|-------------------|-------------|--------------|
| Dashboard | Voit 3 alertes rouges | "Priorité aux rouges" | 😟 Vigilant | A-T02 Dashboard | - | Tri auto sévérité |
| Alerte PEP | Ouvre "Jean MBARGA - PEP Match" | "Encore un homonyme?" | 😤 Frustré | A-T03 Queue | Faux positifs 70% | - |
| Investigation | Compare profil vs liste PEP | "Dates de naissance différentes" | 🤔 Analytique | A-T04 Detail | - | Score match % |
| Clear | Clique "Clear" + justification | "Faux positif confirmé" | 😊 Soulagé | A-T04 Detail | - | Log obligatoire |
| Next | Alerte suivante | "Celle-là semble vraie..." | 😟 Inquiet | A-T03 Queue | - | - |
| Escalate | Clique "Confirm Match" | "Je dois bloquer ce compte" | 😤 Déterminé | A-T04 Detail | - | Workflow gel |

**Émotion dominante:** 😟→😤 (Vigilance → Détermination)  
**Temps moyen:** 10-15 minutes/alerte

---

## Journey Map: Sylvie — Scan Matinal (30 secondes)

### Phase: MORNING CHECK

| Étape | Actions | Pensées | Émotions | Points de contact | Opportunités |
|-------|---------|---------|----------|-------------------|--------------|
| Login | Ouvre le Command Center | "Voyons la santé du système" | 😐 Neutre | S-S01 Dashboard | - |
| Status | Voit bandeau VERT | "Tout va bien" | 😊 Rassurée | S-S01 Dashboard | - |
| Funnel | Scan rapide drop-off | "Liveness à 12%, normal" | 😊 Satisfaite | S-S01 Dashboard | - |
| SLA | Voit 92% dans SLA | "On respecte l'engagement" | 😊 Fière | S-S01 Dashboard | - |
| Logout | Ferme le dashboard | "Parfait, je peux me concentrer sur autre chose" | 😊 Sereine | - | - |

**Émotion dominante:** 😐→😊 (Neutre → Sereine)  
**Temps:** 30 secondes

---

## Insights Clés

### Marie (Mobile)
- **Moment WOW #1:** Auto-capture CNI (impression technologique)
- **Moment WOW #2:** Reprise après coupure (confiance++)
- **Moment WOW #3:** Validation <2h (surprise positive)

### Jean (Agent)
- **Besoin critique:** Preuve visuelle haute-res
- **Soulagement:** Audit trail automatique
- **Productivité:** 3-5 min/dossier vs 15 min actuellement

### Thomas (Superviseur)
- **Frustration majeure:** 70% faux positifs PEP
- **Besoin:** Priorisation automatique (rouge en premier)
- **Sérénité:** Visibilité nationale temps réel

### Sylvie (Direction)
- **Besoin:** Scan 30s Rouge/Jaune/Vert
- **KPI clé:** SLA >90% + CAC reduction 3x
- **Décision:** Intervention uniquement si rouge
