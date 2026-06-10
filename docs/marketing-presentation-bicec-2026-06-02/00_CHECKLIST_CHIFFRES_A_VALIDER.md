# Checklist chiffres a valider en preview

But: remplacer les placeholders ROI du deck par des chiffres BICEC valides. Ne pas inventer ces valeurs.

## Chiffres prioritaires

| Donnee a demander | Pourquoi c'est utile | Valeur validee |
| --- | --- | --- |
| Nombre de dossiers KYC / ouvertures de compte par mois | Base du calcul ROI | [a remplir] |
| Delai moyen actuel entre premiere demande et dossier valide | Mesure de friction client | [a remplir] |
| Temps moyen agent/agence par dossier | Calcul gain operationnel | [a remplir] |
| Temps moyen backoffice/conformite par dossier | Calcul gain operationnel | [a remplir] |
| Taux de dossiers incomplets au premier depot | Mesure du rework | [a remplir] |
| Taux de dossiers renvoyes pour complement | Mesure du rework client | [a remplir] |
| Taux d'abandon avant ouverture effective | Mesure du gain commercial possible | [a remplir] |
| Cout horaire complet agent/backoffice | Conversion temps gagne -> argent | [a remplir] |
| Valeur moyenne d'un client active sur 12 mois | Conversion uplift -> revenu | [a remplir] |
| Nombre de demandes audit/conformite par periode | Mesure gain preuve/audit | [a remplir] |
| Temps moyen pour reconstituer un dossier pour audit | Calcul gain conformite | [a remplir] |
| Taux d'alertes AML ou dossiers sensibles | Mesure interet controle risque | [a remplir] |

## Formules a garder

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

## Phrase prudente a utiliser

"Je ne veux pas maquiller le business case. Le role du pilote est justement de mesurer ces variables avec les chiffres BICEC, puis de decider sur faits."

## Questions de decision

- Quel sponsor metier peut porter le pilote ?
- Quel responsable conformite/AML doit valider le perimetre ?
- Quel responsable IT/securite doit cadrer la revue ?
- Quel segment ou agence pilote serait le moins risque ?
- Quelles donnees peut-on mesurer sans integration core banking ?
- Quel delai de pilote est credible pour les responsables ?
