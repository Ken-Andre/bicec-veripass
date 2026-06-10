# Scorecard QA finale

Date: 2026-06-02  
Statut: GO pour support exécutif, avec limites explicites ci-dessous.

## Contrôles réalisés

| Contrôle | Résultat |
|---|---|
| Sous-agent source-audit | Faits prouvés, hypothèses et claims exclus distingués. |
| Sous-agent research/benchmark | Sources externes vérifiées avec sources officielles ou réputées. |
| Sous-agent executive narrative | Arc narratif exécutif restructuré pour Direction, Conformité, Opérations, Réseau, Audit, IT/Sécurité, Finance, Digital. |
| Sous-agent red-team QA | Go conditionnel; corrections appliquées sur mobile, ROI, CNI, pilote, décision finale. |
| Build PPTX | 12 slides, fichier `.pptx` généré. |
| Vérification package | 12 slides, 14 médias, 0 média vide. |
| Vérification layout | 0 erreur, 5 avertissements de texte serré acceptés après contrôle visuel. |
| Contrôle visuel contact sheet | Cohérence visuelle vérifiée; style sobre bancaire maintenu. |

## Score par critère

| Critère | Score | Justification |
|---|---:|---|
| Hallucinations | 4.7 / 5 | Claims sensibles exclus; chiffres BICEC en placeholders; sources externes sourcées. Risque résiduel: interprétation orale trop ambitieuse. |
| Lisibilité | 4.4 / 5 | Un message fort par slide; slides lisibles en aperçu. Quelques zones de texte serrées mais sans erreur de rendu. |
| Émotion exécutive | 4.2 / 5 | Le récit repositionne le stage comme base stratégique, sans ton startup. La phrase centrale donne l'ancrage mémorable. |
| Précision | 4.6 / 5 | Distinction MVP / pilote / production claire. Les limites CNI, Cloudflare, ROI et décision humaine sont explicites. |
| Cohérence | 4.5 / 5 | Structure 12 slides cohérente: décision, contexte, problème, réponse, preuves, pilotage, ROI, pilote, demande. |
| Force narrative | 4.4 / 5 | La progression amène une décision managériale, pas une démonstration technique. |

## Corrections red-team appliquées

- Slide 2: "marché mobile" remplacé par "usages mobiles installés"; les chiffres ne sont pas interprétés comme readiness BICEC.
- Slide 3: "coût caché" remplacé par "charge opérationnelle invisible"; aucun coût interne inventé.
- Slide 4: ajout de "preuves mieux structurées" pour encadrer la phrase centrale.
- Slide 5: matrice rôle -> preuve clarifiée.
- Slide 6: "authentification" retiré du récit produit; CNI formulée en capture et structuration, pas validation officielle.
- Slide 7: "Jean" encadré comme persona de démonstration.
- Slide 8: "blocage" reformulé en revue avant validation, tout en conservant la preuve MVP d'approbation refusée si alerte AML ouverte.
- Slide 11: pilote présenté comme cadrage interne de 8 à 12 semaines, durée à valider, sans core banking.
- Slide 12: demande finale reformulée en autorisation du cadrage d'un pilote contrôlé.

## Limites restantes

- Aucun chiffre interne BICEC n'a été fourni; tous les volumes, délais, coûts et gains restent `[à valider BICEC]`.
- La démonstration Cloudflare dépend d'une machine hôte allumée et d'un tunnel lancé le jour de la démo.
- Le deck n'affirme pas de validation officielle de la CNI ni de connexion à une source d'autorité.
- Le deck n'affirme pas de conformité finale, d'hébergement production ou de go-live.
- Le fichier a été vérifié par rendu PNG/contact sheet et contrôle package; il n'a pas été ouvert manuellement dans PowerPoint via interface graphique.

