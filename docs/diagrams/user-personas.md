# User Personas — BICEC VeriPass

**Version:** 2.1  
**Date:** 2026-02-26  
**Auteur:** Ken (UX Designer)

---

## Persona 1: Marie — L'Entrepreneure (Client Mobile)

**Démographie**
- **Âge:** 24 ans
- **Localisation:** Douala, Cameroun
- **Profession:** Entrepreneure (boutique de vêtements)
- **Niveau d'éducation:** Bac +2 (Commerce)
- **Revenu mensuel:** 150,000 - 300,000 FCFA

**Contexte Technologique**
- **Smartphone:** Android 8.0 (Samsung Galaxy J7)
- **Connexion:** 3G instable (coupures fréquentes)
- **Data:** 500 MB/mois (coût élevé ~500 FCFA)
- **Littératie digitale:** Moyenne-élevée (utilise Instagram, WhatsApp)

**Objectifs**
- Ouvrir un compte professionnel rapidement sans perdre de temps
- Éviter les déplacements multiples en agence (14 jours actuellement)
- Accéder aux services bancaires modernes (cartes, épargne, virements)
- Protéger ses données personnelles

**Frustrations**
- Processus bancaire traditionnel trop long et bureaucratique
- Coupures de courant ("délestage") qui interrompent les démarches en ligne
- Coût élevé de la data mobile
- Méfiance envers la sécurité des apps bancaires

**Besoins**
- Interface simple et guidée (pas de jargon technique)
- Sauvegarde automatique en cas de coupure réseau
- Feedback visuel clair à chaque étape
- Temps de complétion < 15 minutes

**Citation**
> "Je n'ai pas le temps de faire des allers-retours à la banque. Mon business ne peut pas attendre 2 semaines."

---

## Persona 2: Jean — Le Gardien KYC (Agent d'Agence)

**Démographie**
- **Âge:** 32-45 ans
- **Localisation:** Yaoundé, Cameroun
- **Profession:** Agent KYC BICEC
- **Niveau d'éducation:** Licence (Banque/Finance)
- **Expérience:** 5-10 ans dans le secteur bancaire

**Contexte Professionnel**
- **Poste de travail:** Desktop Windows (écran 1920x1080)
- **Charge de travail:** 15-25 dossiers/jour
- **Responsabilité légale:** Personnelle en cas d'audit COBAC
- **Pression:** SLA 2h pour 90% des dossiers

**Objectifs**
- Valider les dossiers rapidement sans compromettre la qualité
- Avoir une preuve visuelle claire pour chaque décision
- Respecter les SLA sans stress excessif
- Protéger sa responsabilité légale (audit trail)

**Frustrations**
- Photocopies de mauvaise qualité (actuellement)
- Manque de traçabilité des décisions
- Surcharge de travail en fin de mois
- Peur des audits COBAC

**Besoins**
- Vue côte-à-côte (preuve originale vs données extraites)
- Zoom haute résolution sur les documents
- Justification obligatoire pour chaque rejet
- Dashboard de charge de travail en temps réel

**Citation**
> "Je dois pouvoir prouver que j'ai vu le document original avant de valider. C'est ma responsabilité légale."

---

## Persona 3: Thomas — Le Superviseur AML/CFT (National)

**Démographie**
- **Âge:** 38-50 ans
- **Localisation:** Yaoundé (Siège BICEC)
- **Profession:** Superviseur National Conformité AML/CFT
- **Niveau d'éducation:** Master (Droit/Finance)
- **Expérience:** 10-15 ans en conformité bancaire

**Contexte Professionnel**
- **Périmètre:** National (toutes les agences BICEC)
- **Responsabilités:** AML screening, déduplication, administration agences, provisioning Amplitude
- **Outils:** Dashboard web, accès bases de données PEP/Sanctions
- **Pression:** Conformité COBAC, risque réputation

**Objectifs**
- Détecter et bloquer les fraudes avant activation de compte
- Gérer les alertes PEP/Sanctions efficacement
- Administrer les agences (CRUD, load balancing)
- Monitorer le provisioning batch Amplitude

**Frustrations**
- Faux positifs fréquents sur les listes PEP (homonymes)
- Doublons de comptes difficiles à détecter
- Manque de visibilité nationale en temps réel
- Processus de provisioning manuel (actuellement)

**Besoins**
- Dashboard d'alertes AML priorisées (rouge en premier)
- Outil de déduplication avec score de similitude
- Interface CRUD agences simple
- Monitoring batch avec retry granulaire

**Citation**
> "Un seul compte frauduleux activé peut coûter des millions à la banque et détruire notre réputation."

---

## Persona 4: Sylvie — La Commandante (Direction)

**Démographie**
- **Âge:** 45-55 ans
- **Localisation:** Yaoundé (Direction Régionale)
- **Profession:** Directrice Régionale BICEC
- **Niveau d'éducation:** MBA
- **Expérience:** 15-20 ans en management bancaire

**Contexte Professionnel**
- **Périmètre:** Régional (5-10 agences)
- **Responsabilités:** ROI, CAC, SLA, performance équipes
- **Temps disponible:** 30 secondes pour scan matinal
- **Décisions:** Stratégiques (budget, ressources, escalations)

**Objectifs**
- Réduire le CAC de 3x (objectif business)
- Maintenir SLA >90% (2h pour validation)
- Identifier les goulots d'étranglement rapidement
- Prouver le ROI du projet aux actionnaires

**Frustrations**
- Manque de visibilité en temps réel (actuellement)
- Rapports manuels incomplets
- Impossibilité de prédire les surcharges
- Difficulté à justifier les investissements tech

**Besoins**
- Dashboard Rouge/Jaune/Vert (santé globale)
- Funnel de conversion avec drop-off rates
- KPIs agents et agences (sans classement toxique)
- Export conformité COBAC en 1 clic

**Citation**
> "Je dois savoir en 30 secondes si tout va bien ou si je dois intervenir."
