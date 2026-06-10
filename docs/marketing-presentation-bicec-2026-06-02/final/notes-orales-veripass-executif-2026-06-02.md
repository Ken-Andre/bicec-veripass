# Notes orales - VeriPass, support exécutif BICEC

Date: 2026-06-02  
Usage: support oral pour managers et hauts responsables BICEC non techniques.

## Slide 1 - La décision

Claim: transformer le KYC en porte d'entrée digitale contrôlée.

Preuve à l'écran: MVP visible, parcours mobile et positionnement rail KYC souverain.

Note orale:  
Le sujet n'est pas de présenter "une application KYC". Le sujet est de montrer qu'un stage a produit une base stratégique: une entrée client digitale, contrôlée par la banque, auditable, mesurable et encore suffisamment bornée pour être testée sans promettre un déploiement immédiat. La décision demandée est claire: autoriser un pilote contrôlé, pas annoncer une mise en production.

## Slide 2 - Pourquoi maintenant

Claim: les usages mobiles sont installés, mais l'ouverture digitale reste contrainte par la preuve d'identité.

Preuve à l'écran: DataReportal/Kepios 2026 pour le mobile et l'internet au Cameroun; GAFI/FATF pour le contexte conformité; BEAC/DSMP pour la dynamique des paiements mobiles en CEMAC.

Note orale:  
Le contexte est favorable au digital, mais pas permissif. Les chiffres mobiles montrent un terrain d'usage; ils ne disent pas que tous les clients sont prêts, ni que BICEC peut ouvrir sans contrôle. La vraie opportunité est bancaire: convertir l'entrée digitale en processus gouverné, avec des preuves structurées avant décision.

## Slide 3 - Problème métier

Claim: la charge opérationnelle invisible du KYC vient de l'incertitude du dossier.

Preuve à l'écran: chaîne métier qualitative: entrée client, agence/agent, conformité, audit/management.

Note orale:  
Le problème n'est pas seulement la lenteur. C'est l'incertitude: pièce manquante, relance, reprise, contrôle tardif, dossier difficile à reconstituer. Aucun chiffre BICEC n'est inventé ici. Le pilote doit justement mesurer le délai, le rework, l'abandon et la charge agent avec une baseline interne.

## Slide 4 - Réponse VeriPass

Claim: VeriPass prépare un dossier client structuré avant la décision humaine.

Preuve à l'écran: chaîne Client -> Dossier -> Risque -> Banque; phrase centrale.

Note orale:  
La phrase à retenir est celle-ci: "VeriPass ne remplace pas le jugement de la banque. Il donne à la banque de meilleures preuves avant que le jugement soit rendu." Ici, "meilleures preuves" signifie preuves mieux structurées, plus lisibles, plus traçables. Cela ne veut pas dire validation officielle par une autorité externe, ni décision automatique.

## Slide 5 - Gains responsables

Claim: chaque responsable retrouve une preuve utile, pas un écran de plus.

Preuve à l'écran: matrice rôle -> preuve utile.

Note orale:  
Le même rail KYC parle à plusieurs responsables. La Direction obtient une option stratégique testable. Le Réseau reçoit un dossier mieux préparé. La Conformité voit alertes et justifications. L'Audit retrouve un journal. Les Opérations pilotent files et SLA. La Finance obtient un modèle à chiffrer avec des données BICEC, pas un ROI inventé.

## Slide 6 - Preuve client

Claim: le client entre par un parcours mobile sobre, cadré sur la CNI Cameroun.

Preuve à l'écran: captures mobile/PWA; périmètre documentaire borné.

Note orale:  
Le parcours client est volontairement sobre: accès, écrans guidés, collecte structurée. Le périmètre actuel est limité à la CNI Cameroun. Passeport, permis et multi-pays ne sont pas présentés comme disponibles. Cette restriction est une force pour un pilote: moins de promesses, moins de risques, plus de mesure.

## Slide 7 - Preuve agent

Claim: le chargé KYC ne reçoit plus des fragments; il reçoit un dossier à juger.

Preuve à l'écran: backoffice Jean, persona de démonstration; file et dossier structuré; happy path API du 26/05/2026.

Note orale:  
L'agent n'est pas remplacé. Son attention est déplacée vers ce qui compte: prioriser, comprendre, demander un complément, refuser ou approuver. VeriPass ne promet pas moins d'agents; il promet un dossier plus lisible. Les gains de temps, eux, devront être mesurés en pilote.

## Slide 8 - Preuve conformité / audit

Claim: la vitesse ne contourne pas le risque; l'alerte impose une revue avant validation.

Preuve à l'écran: alerte AML ouverte, vue conformité, audit/export.

Note orale:  
La conformité est au centre du récit. L'objectif n'est pas d'accélérer en contournant le risque. L'objectif est de rendre visible ce qui doit arrêter ou ralentir le flux: alerte ouverte, justification requise, décision tracée. Dans le MVP, l'approbation est refusée tant qu'une alerte AML ouverte subsiste.

## Slide 9 - Pilotage manager

Claim: les managers peuvent piloter le flux KYC, pas seulement ouvrir des dossiers isolés.

Preuve à l'écran: command center, analytics, indicateurs à brancher sur données BICEC.

Note orale:  
Un manager n'a pas seulement besoin de voir un dossier. Il doit voir le flux: charge, files, délais, alertes, reprise, SLA. Les écrans existent comme base produit. Les chiffres réels doivent être alimentés par une baseline BICEC et suivis pendant le pilote.

## Slide 10 - ROI à valider

Claim: le business case doit être mesuré, pas maquillé.

Preuve à l'écran: formules sans valeurs inventées; placeholders `[à valider BICEC]`.

Note orale:  
Cette slide protège la crédibilité du projet. On ne met pas un ROI fictif dans un deck bancaire. On met un modèle: volumes, minutes économisées, coût horaire complet, dossiers incomplets évités, effort audit. La valeur du pilote est de remplacer les hypothèses par des chiffres internes validés.

## Slide 11 - Phase pilote

Claim: un cadrage pilote interne de 8 à 12 semaines, durée à valider, permet de décider sur preuves.

Preuve à l'écran: phases cadrer, tester, mesurer, décider; démonstration mobile via Cloudflare Quick Tunnel; back-office hors route publique.

Note orale:  
Le pilote proposé est interne, borné et gouverné. Périmètre: CNI Cameroun, pas d'intégration core banking, pas de promesse de production. La démonstration mobile peut être exposée temporairement via tunnel Cloudflare tant que la machine hôte tourne. Le back-office et les surfaces sensibles restent hors accès public dans le cadrage actuel.

## Slide 12 - Demande finale

Claim: la prochaine décision est d'autoriser le cadrage d'un pilote contrôlé.

Preuve à l'écran: quatre décisions minimales: sponsor métier, baseline data, revue conformité, revue sécurité.

Note orale:  
La demande n'est pas technique. Elle est managériale: qui sponsorise, quelles données internes sont fournies, quelles règles conformité sont retenues, quelles exigences sécurité doivent être validées. À la sortie: go, no-go, durcir, acheter ou hybrider, avec chiffres BICEC.

