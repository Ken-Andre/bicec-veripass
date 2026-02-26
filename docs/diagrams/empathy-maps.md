# Empathy Maps — BICEC VeriPass

**Version:** 2.1  
**Date:** 2026-02-26  
**Auteur:** Ken (UX Designer)

---

## Empathy Map: Marie (L'Entrepreneure)

### 🎯 Objectif
Ouvrir un compte bancaire professionnel en moins de 15 minutes sans se déplacer

### 👀 Ce qu'elle VOIT
- Ses amis utilisent Mobile Money (Orange Money, MTN MoMo)
- Les banques traditionnelles avec de longues files d'attente
- Des publicités pour des néobanques étrangères (Revolut, N26)
- Son business qui grandit et nécessite un compte pro

### 👂 Ce qu'elle ENTEND
- "Les banques sont trop lentes et bureaucratiques"
- "Tu dois revenir 3-4 fois pour compléter ton dossier"
- "Attention aux arnaques en ligne"
- "BICEC est une banque sérieuse mais traditionnelle"

### 💭 Ce qu'elle PENSE et RESSENT
- **Frustration:** "Pourquoi ça prend 14 jours alors que je peux ouvrir un compte Mobile Money en 5 minutes?"
- **Méfiance:** "Est-ce que mes données seront en sécurité?"
- **Espoir:** "Si BICEC digitalise, peut-être que ça va changer"
- **Stress:** "Je ne peux pas perdre du temps, mon business en dépend"

### 🗣️ Ce qu'elle DIT
- "Je n'ai pas le temps de faire des allers-retours"
- "Mon forfait data est limité"
- "J'ai besoin d'un compte pro pour mes factures"
- "Les coupures de courant m'empêchent de finir mes démarches en ligne"

### 💪 Ce qu'elle FAIT
- Utilise Instagram et WhatsApp Business pour son commerce
- Gère ses transactions via Mobile Money
- Évite les déplacements inutiles
- Cherche des solutions rapides et efficaces

### 😰 DOULEURS (Pains)
- **Temps perdu:** 14 jours de processus actuel
- **Déplacements multiples:** 3-4 visites en agence
- **Coût data:** 500 FCFA pour 500MB
- **Coupures réseau:** Délestages fréquents
- **Complexité:** Formulaires papier incompréhensibles

### 🎁 GAINS (Gains)
- **Rapidité:** Compte ouvert en 15 minutes
- **Confort:** Tout depuis son téléphone
- **Sécurité:** Banque Tier-1 régulée
- **Services modernes:** Cartes, épargne, virements
- **Résilience:** Sauvegarde automatique en cas de coupure

---

## Empathy Map: Jean (Agent KYC)

### 🎯 Objectif
Valider 15-25 dossiers/jour avec qualité et traçabilité pour protéger sa responsabilité légale

### 👀 Ce qu'il VOIT
- Des photocopies de CNI de mauvaise qualité
- Des dossiers incomplets qui reviennent plusieurs fois
- La pression des audits COBAC
- Ses collègues débordés en fin de mois

### 👂 Ce qu'il ENTEND
- "L'audit COBAC arrive le mois prochain"
- "Ce dossier a été rejeté 3 fois déjà"
- "On doit respecter le SLA de 2h"
- "Si tu valides un faux, c'est ta responsabilité personnelle"

### 💭 Ce qu'il PENSE et RESSENT
- **Anxiété:** "Est-ce que j'ai bien vérifié tous les champs?"
- **Frustration:** "Ces photocopies sont illisibles"
- **Responsabilité:** "Je dois pouvoir prouver que j'ai fait mon travail"
- **Fierté:** "Je suis le gardien de la conformité"

### 🗣️ Ce qu'il DIT
- "Je ne peux pas valider sans voir le document original"
- "Il me faut une preuve pour l'audit"
- "Ce dossier est incomplet, je dois le rejeter"
- "Je préfère prendre 5 minutes de plus que de faire une erreur"

### 💪 Ce qu'il FAIT
- Vérifie chaque champ manuellement
- Compare les documents avec les données saisies
- Note les raisons de rejet sur papier
- Appelle les clients pour clarifications

### 😰 DOULEURS (Pains)
- **Qualité documents:** Photocopies floues, tachées
- **Manque de traçabilité:** Pas de log des décisions
- **Surcharge:** 25+ dossiers en fin de mois
- **Peur audit:** Responsabilité personnelle
- **Outils inadaptés:** Pas de zoom, pas de comparaison côte-à-côte

### 🎁 GAINS (Gains)
- **Preuve visuelle:** Documents haute résolution
- **Traçabilité:** Audit trail automatique
- **Efficacité:** Validation en 3-5 minutes
- **Sérénité:** Protection légale assurée
- **Dashboard:** Visibilité sur sa charge de travail

---

## Empathy Map: Thomas (Superviseur AML/CFT)

### 🎯 Objectif
Protéger BICEC des fraudes et assurer la conformité COBAC nationale

### 👀 Ce qu'il VOIT
- Des alertes PEP avec beaucoup de faux positifs
- Des doublons de comptes difficiles à détecter
- Le risque réputation de la banque
- Les sanctions COBAC contre d'autres banques

### 👂 Ce qu'il ENTEND
- "Une banque voisine a été sanctionnée pour blanchiment"
- "On a activé un compte frauduleux le mois dernier"
- "Les listes PEP sont mises à jour chaque semaine"
- "Le provisioning Amplitude échoue souvent"

### 💭 Ce qu'il PENSE et RESSENT
- **Vigilance:** "Un seul compte frauduleux peut tout détruire"
- **Frustration:** "Trop de faux positifs me font perdre du temps"
- **Responsabilité:** "La réputation de BICEC dépend de mon travail"
- **Surcharge:** "Je dois gérer 10 agences en même temps"

### 🗣️ Ce qu'il DIT
- "Cette alerte PEP est probablement un homonyme"
- "On doit vérifier ce doublon avant d'activer"
- "Le batch Amplitude a échoué, il faut retry"
- "Je veux une vue nationale en temps réel"

### 💪 Ce qu'il FAIT
- Analyse les alertes AML une par une
- Compare les profils suspects avec les listes noires
- Gère les conflits de déduplication
- Administre les agences (CRUD)
- Monitore le provisioning Amplitude

### 😰 DOULEURS (Pains)
- **Faux positifs:** 70% des alertes PEP sont des homonymes
- **Manque de visibilité:** Pas de dashboard national
- **Processus manuel:** Provisioning Amplitude non automatisé
- **Doublons:** Difficiles à détecter sans outil
- **Pression:** Risque réputation énorme

### 🎁 GAINS (Gains)
- **Priorisation:** Alertes rouges en premier
- **Déduplication:** Score de similitude automatique
- **Automation:** Provisioning batch avec retry
- **Visibilité:** Dashboard national temps réel
- **Sérénité:** Conformité COBAC assurée

---

## Empathy Map: Sylvie (Direction)

### 🎯 Objectif
Réduire le CAC de 3x et prouver le ROI du projet digital

### 👀 Ce qu'elle VOIT
- Les KPIs mensuels en retard
- Les rapports Excel incomplets
- La concurrence qui digitalise
- Les actionnaires qui demandent des résultats

### 👂 Ce qu'elle ENTEND
- "Le CAC est trop élevé"
- "On perd des clients jeunes au profit de Mobile Money"
- "Le projet digital coûte cher"
- "Les agences sont débordées"

### 💭 Ce qu'elle PENSE et RESSENT
- **Pression:** "Je dois prouver que l'investissement vaut le coup"
- **Urgence:** "On doit agir avant de perdre plus de parts de marché"
- **Confiance:** "Si on digitalise bien, on peut gagner"
- **Stress:** "Je n'ai que 30 secondes pour voir si tout va bien"

### 🗣️ Ce qu'elle DIT
- "Quel est le ROI de ce projet?"
- "Pourquoi le SLA n'est pas respecté?"
- "On doit réduire le CAC de 3x"
- "Je veux un dashboard Rouge/Jaune/Vert"

### 💪 Ce qu'elle FAIT
- Analyse les KPIs chaque matin
- Prend des décisions stratégiques (budget, ressources)
- Escalade les problèmes critiques
- Présente les résultats aux actionnaires

### 😰 DOULEURS (Pains)
- **Manque de visibilité:** Pas de dashboard temps réel
- **Rapports manuels:** Excel incomplets et en retard
- **Imprévisibilité:** Impossible de prévoir les surcharges
- **Justification:** Difficulté à prouver le ROI

### 🎁 GAINS (Gains)
- **Scan 30s:** Dashboard R/Y/G instantané
- **Funnel:** Drop-off rates par étape
- **KPIs:** Performance agents et agences
- **Export:** Conformité COBAC en 1 clic
- **ROI:** Preuve du 3x CAC reduction
