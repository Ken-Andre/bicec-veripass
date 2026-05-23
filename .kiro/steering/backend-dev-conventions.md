# Conventions de développement backend

## Gestionnaire de paquets et exécution des commandes

Ce projet utilise **uv** comme gestionnaire de paquets Python. Le virtualenv est géré par uv dans `code/backend/.venv`.

**Toujours préfixer les commandes Python/pytest avec `uv run` :**

```bash
# Lancer les tests
uv run pytest tests/ -v

# Lancer un script Python
uv run python script.py

# Installer une dépendance
uv add <package>
```

Ne jamais utiliser `pip install`, `python -m pytest` directement, ou `pip run` — ces commandes utilisent le Python système et non le venv du projet, ce qui provoque des `ModuleNotFoundError` même pour des packages listés dans `pyproject.toml`.

Le répertoire de travail pour toutes les commandes backend est `code/backend`.

## Structure des tests

- Les tests unitaires (sans base de données) vont dans `tests/unit/`.
- Ce sous-dossier a son propre `conftest.py` qui neutralise le fixture `setup_test_db` session-scoped défini dans `tests/conftest.py` — sans ça, l'absence de PostgreSQL fait sauter tous les tests de la session.
- Les tests d'intégration qui nécessitent PostgreSQL restent dans `tests/` à la racine.

```
tests/
├── conftest.py          # fixtures DB session-scoped (PostgreSQL requis)
├── unit/
│   ├── conftest.py      # override no-op de setup_test_db
│   └── test_*.py        # tests sans dépendance DB
└── test_*.py            # tests avec DB
```

## Commande de référence pour valider rapidement

```bash
# Depuis code/backend
uv run pytest tests/unit/ -v
```
