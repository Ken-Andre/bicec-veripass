# Prompt a copier-coller dans l'autre IA

Tu es expert en pitch deck bancaire, strategie B2B, storytelling executif et presentation PowerPoint pour comite de direction.

Je vais te joindre un dossier plat de fichiers sur VeriPass, un MVP de KYC digital construit pour la BICEC. Je dois presenter ce projet aujourd'hui en preview avec une superieure, puis devant des responsables hierarchiques BICEC et des responsables metier. Le public n'est pas technique. Il ne faut pas parler de code, de frameworks, de tickets, de details d'architecture ou de developpement. Le deck doit etre clair pour un manager non technique et doit surtout vendre l'importance business du projet.

## Mission

Refais une presentation PowerPoint en francais, tres professionnelle, vendeuse et comprehensible par des responsables BICEC.

Le but n'est pas de dire "j'ai code une application". Le but est de montrer que VeriPass peut devenir une option strategique pour BICEC: controler la porte d'entree digitale du client, reduire la friction KYC, structurer la preuve, renforcer la conformite et mesurer un pilote avant toute decision de production.

Si tu peux generer un fichier PPTX, genere-le. Sinon, donne un plan slide par slide avec:

- titre de slide;
- message cle en une phrase;
- contenu exact a mettre dans la slide;
- visuel recommande parmi les fichiers joints;
- notes orales du presentateur;
- chiffres ou champs a valider.

## Positionnement obligatoire

Ne presente jamais VeriPass comme "une app KYC" ou "un prototype etudiant sympa".

Positionne VeriPass comme:

- un rail KYC souverain pour BICEC;
- une porte d'entree digitale controlee;
- un dossier client structure avant decision bancaire;
- une preuve auditable pour la conformite;
- un outil de pilotage pour les managers;
- un pilote mesurable avant un budget lourd.

Phrase directrice:

> VeriPass ne remplace pas le jugement de la banque. Il donne a la banque de meilleures preuves avant que le jugement soit rendu.

## Public cible

Le deck doit parler a plusieurs responsables dans la meme salle:

- Direction generale / sponsor metier;
- Banque de Detail, reseau, agences;
- Conformite / AML-CFT;
- Risques et controles;
- Audit interne;
- Operations / Production bancaire;
- Finance / controle de gestion;
- DSI / Organisation / Securite;
- Marketing / Digital / CRM.

Chaque profil doit entendre ce qu'il gagne personnellement.

## Contraintes absolues

Ne pas faire:

- pas de jargon technique;
- pas de slide de code ou d'architecture detaillee;
- pas de promesse de production immediate;
- pas de promesse d'integration core banking, DGI, Sopra Amplitude, Axway ou CRM comme fait actuel;
- pas de couverture passeport/permis/multi-pays comme fait actuel;
- pas de decision automatique sans controle humain;
- pas de ROI invente;
- pas de chiffres internes BICEC non valides;
- pas de critique frontale de BICEC.

Faire:

- expliquer simplement;
- vendre un probleme metier et une decision;
- montrer que la banque garde le controle;
- laisser une place visible pour les chiffres qui seront valides par la superieure;
- utiliser les captures produit comme preuves, pas comme decoration;
- finir avec une demande claire de pilote.

## Sources a lire en priorite

Lis d'abord les fichiers:

- `03_source_strategie_roi__business-case-buy-in-roi-veripass-bicec-2026-05-31.md`
- `03_source_strategie_roi__war-room-strategie-commerciale-veripass-2026-05-31.md`
- `03_source_strategie_roi__sources-consolidees-presentation-veripass-2026-05-31.md`
- `04_benchmark_reference__analyse-benchmark-digitalkyc-adaptation-veripass-2026-05-31.md`

Puis utilise:

- `01_piece_jointe__deck-reference-veripass-rail-kyc-souverain-bicec.pptx`
- `01_piece_jointe__benchmark-digital-kyc-modules-proximus-telindus.pdf`
- les fichiers commencant par `05_preuve_produit__`
- les fichiers commencant par `06_preview_deck__`

Les fichiers commencant par `02_deck_existant__` sont des references. Ne les copie pas aveuglement: leur contenu ne reflete pas assez le besoin final.

## Chiffres et ROI

Tu peux utiliser les chiffres externes sourcables contenus dans les fichiers, en gardant une formulation prudente:

- CEMAC / BEAC 2024: poids du Cameroun dans les paiements CEMAC, electronic money, comptes mobile money et valeur des transactions.
- FATF / GAFI: le Cameroun reste sous monitoring renforce au 13 fevrier 2026 selon la source citee dans les fichiers.
- World Bank ID4D: friction d'identite au Cameroun selon la source citee.
- DataReportal / mobile connections: uniquement comme contexte mobile, pas comme preuve BICEC.
- Fenergo ou Grand View Research: uniquement comme benchmark mondial, pas comme fait BICEC.

Important: si tu n'es pas capable de verifier un chiffre, garde-le comme "source a confirmer" ou propose une formulation sans chiffre exact. Ne fabrique jamais de chiffre BICEC.

La slide ROI doit avoir des champs a remplir:

- dossiers KYC/mois: [a valider BICEC];
- delai moyen actuel demande -> dossier valide: [a valider];
- delai cible pilote: [a valider];
- taux actuel de dossiers incomplets: [a valider];
- minutes de ressaisie/reprise par dossier: [a valider];
- cout horaire complet agent: [a valider];
- taux d'abandon avant ouverture effective: [a valider];
- valeur moyenne d'un client active sur 12 mois: [a valider].

Formules simples a afficher:

```text
Gain operationnel mensuel =
dossiers/mois x minutes economisees par dossier x cout horaire complet / 60
```

```text
Gain commercial =
prospects additionnels convertis x valeur moyenne client active
```

```text
Gain conformite =
dossiers incomplets evites x cout moyen de reprise ou d'incident
```

La formulation orale doit etre:

> Je ne veux pas maquiller le business case. Le pilote sert justement a mesurer ces variables avec les chiffres BICEC.

## Structure de deck recommandee

Fais un deck de 10 a 12 slides maximum.

### Slide 1 - La decision

Message: BICEC peut transformer le KYC d'un passage lourd en porte d'entree digitale controlee.

Titre possible: `VeriPass - Transformer le KYC en porte d'entree digitale BICEC`

### Slide 2 - Pourquoi maintenant

Message: le marche financier est deja mobile, mais l'entree bancaire reste freinee par la preuve KYC.

Utilise 2 ou 3 chiffres externes maximum, avec sources courtes.

### Slide 3 - Le probleme metier

Message: quand le dossier KYC est fragile, tout le monde perd du temps: client, agence, backoffice, conformite, audit.

Ne parle pas de technique. Parle de dossiers incomplets, relances, ressaisie, controle tardif, preuve difficile a reconstituer.

### Slide 4 - La reponse VeriPass

Message: VeriPass prepare un dossier propre avant decision humaine.

Schema simple:

Client mobile -> dossier structure -> agent validation -> conformite -> audit/pilotage -> decision.

### Slide 5 - Ce que chaque responsable achete

Faire une matrice tres lisible:

- Direction: option strategique et pilote mesure;
- Reseau/agences: moins de friction, dossier prepare;
- Conformite: preuves, alertes, blocage;
- Audit: trace claire;
- Operations: files et SLA visibles;
- IT/Securite: pilote borne et revisable;
- Finance: ROI mesurable avant budget lourd.

### Slide 6 - Preuve client

Utiliser ces captures si elles sont jointes:

- `05_preuve_produit__mobile-client-apres-connexion.png`
- `05_preuve_produit__mobile-scope-cni-cameroun-options-desactivees.png`
- les visuels iOS commencant par `05_preuve_produit__ios-...`

Message: le client peut commencer simplement, mais dans un cadre controle.

### Slide 7 - Preuve agent

Utiliser:

- `05_preuve_produit__backoffice-jean-file-priorite-biometrique.png`
- `05_preuve_produit__backoffice-jean-dossier-approuve.png`
- `05_preuve_produit__backoffice-jean-dossier-risque-biometrique-alerte-aml.png`

Message: l'agent ne recoit pas des fragments; il recoit un dossier structure.

### Slide 8 - Preuve conformite et audit

Utiliser:

- `05_preuve_produit__backoffice-approbation-bloquee-alerte-aml-ouverte.png`
- `05_preuve_produit__backoffice-thomas-conformite.png`
- `05_preuve_produit__audit-cobac-interface-finale.png`
- `05_preuve_produit__audit-cobac-document-final.png`

Message: aller plus vite ne signifie pas contourner le risque.

### Slide 9 - Pilotage manager

Utiliser:

- `05_preuve_produit__backoffice-sylvie-command-center-pilotage.png`
- `05_preuve_produit__backoffice-sylvie-analytics.png`

Message: ce qui etait disperse devient visible: charge, files, alertes, SLA, audit.

### Slide 10 - ROI a valider

Cette slide doit etre visuellement prete mais avec des champs remplacables.

Ne donne pas un chiffre final. Montre:

- 3 leviers: rework, conversion, conformite;
- les formules;
- les champs a valider par BICEC.

### Slide 11 - Pilote propose

Message: ne pas demander un deploiement national. Demander un pilote court, encadre, mesurable.

Exemple:

- duree: 8 a 12 semaines, ou une duree a valider;
- perimetre: segment ou agence pilote;
- sponsors: Conformite + Operations + IT + Retail;
- sortie: KPI, risques, budget, decision build/buy/hybrid.

### Slide 12 - Demande finale

Demande claire:

- nommer un sponsor;
- autoriser la collecte de chiffres baseline;
- valider un pilote controle;
- planifier revue securite/conformite;
- produire une decision go/no-go.

Phrase de fermeture:

> N'achetez pas un logiciel aujourd'hui. Achetez l'avance de pouvoir tester, mesurer et decider avant que la porte d'entree client ne soit prise ailleurs.

## Style visuel

Style sobre, bancaire, moderne:

- pas de design trop academique;
- pas de surcharge de texte;
- slides lisibles a 5 metres;
- 1 message fort par slide;
- captures produit grandes et propres;
- chiffres en gros, mais limites;
- tons professionnels proches BICEC si possible;
- eviter le style startup tape-a-l'oeil.

## Livrables attendus

Produis:

1. Le deck final ou un contenu slide par slide pret a mettre dans PowerPoint.
2. Les notes orales pour chaque slide.
3. Une slide ROI avec placeholders.
4. Une liste des chiffres a demander a ma superieure.
5. Une mini FAQ objections/reponses pour managers.

Le resultat doit m'aider a me vendre sans paraitre technique: montrer que mon travail est important pour BICEC parce qu'il parle acquisition client, conformite, operations, audit et decision pilote.
