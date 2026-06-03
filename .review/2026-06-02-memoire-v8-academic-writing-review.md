# Revue académique consolidée du mémoire v8

Date : 2 juin 2026

Document audité : `docs/rapport-stage/memoire-stage-andre-yoann-kenmogne-v8.docx`

PDF audité : `docs/rapport-stage/memoire-stage-andre-yoann-kenmogne-v8.pdf`

## Vue d'ensemble

Le mémoire v8 est globalement cohérent avec le plan UCAC ICAM en cinq chapitres. Le PDF rendu compte 56 pages, donc il respecte la plage de 54 à 66 pages. La structure suit une progression lisible : contexte bancaire, besoin, architecture, réalisation, évaluation, conclusion, références et annexes.

Le risque principal n'est plus la quantité de contenu. Le risque principal est l'alignement entre les promesses du texte, les preuves techniques réellement disponibles et les citations académiques ou réglementaires. Une bonne passe finale doit donc être ciblée, sans ajouter beaucoup de tableaux ni regonfler le mémoire.

## Limite de la revue LaTeX

Le fichier `parts/introduction.tex` demandé n'existe pas dans le dépôt. Aucun fichier `.tex`, `.bib`, `.cls` ou `.sty` n'a été repéré. La cohérence LaTeX ne peut donc pas être vérifiée sérieusement.

La revue porte sur l'équivalent Word : titres, table des matières, figures, tableaux, citations, bibliographie, logique de chapitre et cohérence du PDF rendu. Il ne faut pas présenter cette passe comme une validation LaTeX.

## Points critiques

1. La promesse de réduction des délais et des erreurs reste plus forte que les preuves présentées.

L'introduction, le chapitre 1 et la conclusion promettent une réduction des reprises, des délais et des erreurs. Le chapitre 5 prouve surtout un prototype fonctionnel, un parcours de bout en bout et une boucle OCR testée sur des identifiants. Il ne prouve pas encore un gain opérationnel en production.

Correction recommandée : reformuler les passages ambitieux comme une capacité à préparer une réduction mesurable. Ajouter en 5.1 ou 5.3 une courte logique de mesure : délai manuel observé, métriques pilotes attendues, preuve déjà disponible, preuve restant à produire en environnement bancaire.

2. La traçabilité entre exigence, composant et preuve doit être rendue plus visible.

Les sections 2.6 et 5.1 annoncent une exigence de preuve, mais le texte ne montre pas assez clairement la correspondance entre besoin, composant technique et élément vérifiable.

Correction recommandée : ajouter un paragraphe en prose dans 5.1 avec quelques exemples concrets : capture CNI associée à un fichier et un hash, OCR associé à un champ extrait et corrigible, liveness associé à un score, soumission associée à un statut, décision associée à une entrée d'audit.

3. La conservation biométrique doit être harmonisée.

Le mémoire présente les résultats biométriques comme conservés et auditables. Le parcours mobile contient cependant une formulation indiquant que le selfie ne sera pas conservé. Cette contradiction est sensible pour un mémoire KYC et données personnelles.

Correction recommandée : choisir une position unique. Option prudente : le selfie est traité pour la vérification et sa conservation éventuelle dépend d'une politique de rétention validée par la conformité. Si le prototype conserve une preuve, il faut le dire sans ambiguïté et distinguer prototype, pilote et production.

4. Les fondements réglementaires doivent être cités plus proprement.

La réglementation COBAC, la protection des données personnelles et la source BICEC structurent le mémoire, mais les citations APA ne sont pas encore assez solides dans le corps du texte. La Loi n° 2024/017 du 23 décembre 2024 doit apparaître dans la bibliographie si elle est utilisée. La source officielle de la Présidence camerounaise confirme cet intitulé. L'article Droit Médias Finance confirme aussi l'entrée en vigueur du Règlement COBAC R 2023/01 au 1er juillet 2024.

Correction recommandée : citer la COBAC dans le corps avec une forme APA explicite, ajouter la référence complète de la loi camerounaise, utiliser BICEC comme sigle après une première citation de groupe auteur, et garder Droit Médias Finance comme source d'éclairage secondaire plutôt que comme source réglementaire principale.

## Points importants

1. Le résultat OCR `60/60` doit être cadré.

Ce résultat peut être lu comme une précision parfaite, ce qui serait trop fort. Il faut préciser qu'il s'agit d'identifiants ayant produit au moins une revue OCR exploitable après reprises, et non d'une mesure de précision par champ avec vérité terrain indépendante.

2. Les états dégradés du pipeline doivent être mentionnés.

La machine d'états principale décrit bien le chemin nominal, mais elle ne rend pas assez visibles les cas `LOCKED_LIVENESS` et `ABANDONED`, qui sont utiles pour montrer la maîtrise des cas d'échec.

3. Le périmètre AML/CFT doit être séparé en trois catégories.

Le texte évoque analyste AML/CFT, alertes, sanctions, conflits et doublons. Il faut distinguer ce qui est implémenté dans le prototype, ce qui est préparé par le modèle de données, et ce qui reste hors périmètre de mise en production.

4. Les figures et tableaux doivent être mieux exploités dans la prose.

La numérotation est correcte et les titres sont au bon endroit. En revanche, les figures et tableaux ne sont pas toujours référencés puis interprétés dans le corps. Le chapitre 3 doit dire explicitement ce que le lecteur doit voir dans la Figure 1, la Figure 2, la Figure 3 et le Tableau 4.

5. Les sources techniques listées en bibliographie doivent être citées ou retirées.

FastAPI, Docker, OpenAPI et PostgreSQL apparaissent en bibliographie, mais leur usage dans le corps n'est pas toujours lié à une citation. Il faut les citer dans les sections techniques concernées, ou retirer les entrées si le protocole APA de l'école préfère limiter les références à la littérature et aux normes.

6. Les acronymes doivent être complétés.

Ajouter ou définir clairement : GAFI, CGAP, OTP, MVP, TLS, HTTP, JSONB, MLD, IP et éventuellement IT. Le Tableau 1 peut être complété sans alourdir le mémoire, car il sert directement la lecture.

7. La section sur Docker Compose doit rester démonstrative, pas productive.

Le mémoire doit signaler que le tunnel public de démonstration et le montage du socket Docker relèvent d'un environnement local ou de test. Ces éléments ne doivent pas être présentés comme acceptables tels quels dans un SI bancaire.

8. Le titre doit être corrigé.

Le titre contient un défaut d'espacement repéré : `client :intégration` et `l'automatisationde`. Correction possible : `Conception et développement d'un écosystème intelligent d'acquisition client pour l'automatisation de la conformité KYC à la BICEC`.

## Revue chapitre par chapitre

## Parties liminaires et introduction

La page de garde, les résumés et la table des matières donnent une base propre. La table des matières Word est préférable à un sommaire provisoire. Il faut seulement corriger le titre et vérifier les espacements visibles.

L'introduction pose bien le contexte bancaire camerounais, la pression concurrentielle et la contrainte COBAC. Elle gagnerait à alléger les premières phrases, qui empilent plusieurs enjeux. Les questions opérationnelles peuvent être résumées en une phrase analytique au lieu d'une liste longue.

Correction prioritaire : réduire les formulations qui promettent directement des gains et les remplacer par des objectifs mesurables à valider par pilote.

## Chapitre 1

Le chapitre 1 remplit sa fonction : cadre institutionnel, métier, réglementation, limites du processus manuel, problématique. Il respecte mieux la consigne BICEC avec environ 600 collaborateurs.

Les faiblesses restantes sont surtout bibliographiques. La source BICEC doit être citée selon une forme APA cohérente. Les documents internes doivent être nommés ou renvoyés à l'annexe A. La partie économique doit rester prudente : coût de reprise, relances et temps agent sont des indicateurs cibles, pas des résultats prouvés.

Correction prioritaire : rendre 1.5 moins répétitif par rapport à l'introduction. Cette section peut davantage analyser les écarts opérationnels concrets au lieu de reformuler la problématique complète.

## Chapitre 2

Le chapitre 2 est mieux cadré que les versions précédentes. Il couvre les acteurs, le parcours, les données, la qualité des captures, l'état de l'art, les exigences et la méthode projet.

La section 2.5 contient les références scientifiques attendues, mais elle reste encore un peu compacte. Il faut mieux distinguer trois plans : littérature OCR et documents d'identité, littérature biométrique et liveness, littérature KYC et identité numérique. La transition vers VeriPass doit être plus nette : OCR local, reprise humaine, prudence biométrique, conservation des preuves.

Correction prioritaire : ajouter une phrase de conclusion à 2.5 qui justifie l'approche hybride de VeriPass sans prétendre que la littérature valide directement le prototype.

## Chapitre 3

Le chapitre 3 est le plus solide techniquement. L'architecture en couches, le pipeline KYC, l'OCR, la biométrie et le modèle relationnel forment un ensemble cohérent.

Deux améliorations renforceraient la crédibilité ingénieur. D'abord, référencer et interpréter activement les figures. Ensuite, ajouter les états dégradés du pipeline et préciser que GLM OCR est un renfort d'ingénierie, pas un moteur évalué scientifiquement dans le mémoire.

Correction prioritaire : dans 3.2, ajouter les cas verrouillage liveness et abandon. Dans 3.3, cadrer GLM OCR comme fallback sur faible confiance.

## Chapitre 4

Le chapitre 4 décrit bien la réalisation : backend FastAPI, PWA, pipeline OCR, biométrie, back office et arbitrages. Le ton est plus concret et moins générique.

Il faut néanmoins séparer les capacités réellement implémentées des capacités préparées par l'architecture. Les contrôles AML/CFT, sanctions, doublons et conflits NIU ne doivent pas donner l'impression d'un moteur de conformité complet s'ils ne sont pas entièrement réalisés.

Correction prioritaire : ajouter dans 4.6 une phrase qui classe les contrôles en prototype implémenté, préparation technique, et périmètre futur.

## Chapitre 5

Le chapitre 5 est prudent, ce qui est une force. Il évite de vendre le prototype comme une production bancaire finalisée.

Il manque encore des renvois précis aux preuves techniques et aux annexes. Le scénario de bout en bout doit citer les preuves disponibles dans le dépôt ou les annexes. La section OCR doit clarifier que `60/60` n'est pas une précision par champ. Les durées doivent être chiffrées à partir de preuves ou remplacées par une formulation qualitative.

Correction prioritaire : renforcer 5.1 à 5.3 avec des preuves nommées et limiter les affirmations de performance.

## Conclusion générale

La conclusion est alignée avec le mémoire et rappelle bien les acquis techniques, organisationnels et humains. Elle doit cependant éviter de répéter trop longuement la même tension : digitalisation, conformité, sécurité, validation humaine.

Correction prioritaire : calibrer la formule finale sur le socle RegTech. Dire que VeriPass peut constituer une base de travail pour un futur socle, sous réserve de pilote, calibration et validation conformité.

## Bibliographie et annexes

La bibliographie couvre les besoins principaux, mais plusieurs entrées doivent être reliées au corps du texte. Les références réglementaires doivent être les plus officielles possible. Les URL exactes et DOI disponibles doivent être ajoutés lorsque c'est pertinent.

Les annexes sont utiles et ne doivent pas être supprimées. Il faut cependant mieux les exploiter dans le corps du texte. L'annexe C doit être présentée comme un extrait non exhaustif si tous les endpoints ne sont pas listés. L'annexe E doit préciser qu'elle montre le noyau KYC/OCR/biométrie si elle n'inclut pas consentements, affectations et support.

## Ordre de correction recommandé

1. Corriger le titre et les espacements visibles.

2. Corriger les citations réglementaires et ajouter la référence de la Loi n° 2024/017 du 23 décembre 2024.

3. Harmoniser la conservation biométrique dans le mémoire et dans le parcours mobile.

4. Revoir 5.1 à 5.3 pour distinguer preuve de prototype, métrique expérimentale et gain attendu.

5. Ajouter les renvois aux figures, tableaux et annexes dans les chapitres 3 à 5.

6. Compléter le tableau des sigles.

7. Reserrer les phrases longues de l'introduction, de 1.5, de 3.5 et de la conclusion.

## Décision éditoriale

Le mémoire ne doit pas être réécrit en entier. La bonne intervention est une passe ciblée de correction : titres, citations, cadrage des preuves, quelques transitions et quelques paragraphes de clarification. Ajouter beaucoup de contenu ou beaucoup de tableaux affaiblirait le document.
