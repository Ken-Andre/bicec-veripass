# Guide orateur - VeriPass, phase d'essai interne BICEC

Objectif: presenter ce qui a ete realise pendant le stage sans jargon technique, puis obtenir l'accord pour une phase d'essai interne encadree.

## Fil directeur

VeriPass n'est pas presente comme un produit fini. C'est une preuve fonctionnelle qui permet a BICEC de tester plus vite, mesurer plus juste et garder le controle de l'entree client numerique.

## Script par slide

### 1. VeriPass

Dire: "Je ne viens pas vous montrer du code. Je viens vous montrer une porte d'entree client que la banque peut reprendre en main."

Point a faire retenir: le stage a produit une version fonctionnelle visible, testable, et orientee decision bancaire.

### 2. Pourquoi maintenant

Dire: "Le client camerounais est deja habitue aux services financiers mobiles. La vraie question n'est donc plus: est-ce que le numerique arrive ? La question est: est-ce que BICEC garde la maitrise de l'identite avant d'ouvrir l'acces bancaire ?"

Sources utiles:
- BEAC 2024: le Cameroun concentre 65,10% du volume de paiement CEMAC, et la monnaie electronique represente 94,34% des operations CEMAC.
- GSMA 2026: plus de 2 000 milliards USD ont transite par les portefeuilles de paiement mobile dans le monde en 2025.
- BICEC: BI PAY existe deja comme produit mobile grand public.

### 3. La friction

Dire: "Une connaissance client fragile ne ralentit pas seulement le client. Elle cree des reprises pour l'agence, du flou pour l'espace agents, du risque pour la conformite, et une preuve difficile a reconstituer pour l'audit."

Garde-fou: ne pas critiquer BICEC. Parler d'un probleme bancaire general.

### 4. Ce qui a ete livre

Dire: "Le stage a transforme une intuition en objet testable. On peut ouvrir, essayer, observer, corriger. Ce n'est pas une promesse de production, c'est une base de decision."

Faits prouvables: application web mobile, espace agents, lecture automatique des pieces, preuve de presence, validation humaine, blocage LCB-FT, audit et pilotage.

### 5. Preuve client

Dire: "Le plus important ici n'est pas seulement que les ecrans existent. C'est que le perimetre est volontairement borne. La version actuelle assume la CNI Cameroun d'abord, et ne pretend pas couvrir passeport, permis ou multi-pays tant que ce n'est pas prouve."

Garde-fou: ne pas vendre passeport/permis/multi-pays.

### 6. Preuve agent

Dire: "Jean ne recoit pas un dossier brut. Il recoit une file, des preuves, un statut, et la possibilite de demander un complement. La decision reste humaine, mais elle devient plus lisible."

Preuve: parcours API de bout en bout du 26 mai 2026, dossier soumis puis approuve.

### 7. Preuve conformite

Dire: "La vitesse ne vaut rien si elle contourne le risque. Ici, quand une alerte LCB-FT reste ouverte, l'approbation est bloquee. C'est exactement le type de garde-fou qui rend une numerisation acceptable pour une banque."

Source externe: GAFI, Cameroun sous surveillance accrue, 13 fevrier 2026.

### 8. Pilotage et audit

Dire: "Ce qui etait disperse devient visible: charge, alertes, decisions, audit. Pour un responsable, la valeur n'est pas un joli tableau de bord; c'est la capacite de voir ou le parcours bloque et qui doit agir."

Preuve: centre de pilotage, indicateurs, audit COBAC demo.

### 9. Phase d'essai interne

Dire: "Le tunnel Cloudflare n'est pas l'architecture cible. C'est un moyen pragmatique de rendre la version fonctionnelle accessible a quelques personnes tant que la machine reste allumee, pour tester et recueillir des retours sans deploiement lourd."

Garde-fou: ne pas appeler cela production.

### 10. Phase 2

Dire: "La phase 2 doit etre une validation collective: metier, conformite, SI, operations et donnees. Le but n'est pas d'empiler des fonctionnalites, mais de savoir ce qui tient, ce qui casse, et ce qui merite investissement."

Sorties possibles: continuer, arreter, refondre, acheter, ou retenir une approche mixte.

### 11. Retour sur investissement

Dire: "Je ne veux pas maquiller le dossier economique. Le pilote sert justement a mesurer ces variables avec les chiffres BICEC."

Variables a demander: dossiers par mois, delai actuel, taux de dossiers incomplets, temps agent, cout horaire complet, abandon avant ouverture, valeur moyenne client actif.

### 12. Decision

Dire: "Je ne vous demande pas d'acheter une promesse. Je vous demande de donner a BICEC le droit de mesurer son avance avant que la porte d'entree client ne soit prise ailleurs."

Demande concrete: nommer un porteur, autoriser la phase d'essai, mesurer l'etat initial, decider sur faits.

## Affirmations a ne pas faire

- Pas d'affirmation que la solution est prete pour la production ou certifiee bancaire.
- Pas d'integration DGI, Sopra Amplitude, Axway ou systeme bancaire central.
- Pas de decision automatique sans controle humain.
- Pas de retour sur investissement chiffre sans donnees BICEC validees.
- Pas de promesse passeport, permis, multi-pays, personnes morales ou couverture globale.
- Pas d'affirmation que la biometrie est toujours reussie; un parcours de bout en bout a eu `face_match_status: FAILED`, donc parler de controle et de reprise manuelle, pas de precision en production.
