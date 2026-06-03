# Architecture C4 consolidée — outils de rendu

Ce dossier contient les **artefacts visuels** et les **scripts de rendu** de l'architecture C4 du projet BICEC VeriPass.

## Contenu

| Élément | Description |
| --- | --- |
| `../BICEC-VERIPASS-VUE-ENSEMBLE.md` | **Document maître** (markdown, ~20+ diagrammes Mermaid inline). C'est la source de vérité. |
| `diagrams/*.svg` | Rendu SVG de chaque diagramme Mermaid (un fichier par diagramme). Régénéré par `render.sh` / `render.ps1`. |
| `mermaid/*.mmd` | Sources Mermaid extraites du document maître (un fichier `.mmd` par diagramme, nommé `c4-{chapter}-{n}-{slug}.mmd`). |
| `BICEC-VERIPASS-VUE-ENSEMBLE.pdf` | PDF imprimable A4 du document maître, avec SVGs intégrés et logo BICEC (uniquement après exécution avec `--pdf` / `-Pdf`). |
| `BICEC-VERIPASS-VUE-ENSEMBLE.html` | HTML intermédiaire (pandoc) utilisé pour la génération du PDF. Conservé pour debug. |
| `render.sh` | Wrapper bash (Linux/WSL) qui extrait les blocs Mermaid, génère les SVG via `mmdc`, et optionnellement le PDF via `pandoc + chrome`. |
| `render.ps1` | Wrapper PowerShell (Windows) équivalent. |
| `print_pdf.py` | Script Python partagé qui orchestre la génération du PDF (pandoc + chrome-headless-shell). |
| `rename_mermaid.py` | Renomme les `.mmd` extraits avec un slug sémantique (`c4-{chap}-{n}-{slug}.mmd`). |
| `normalize_mermaid.py` | Pré-traite les `.mmd` pour qu'ils passent le lexer strict de Mermaid 11 (parens, crochets, `/*`, Unicode, etc.). |

## Pré-requis

- **Node.js 18+** + `npm i -g @mermaid-js/mermaid-cli` (binaire `mmdc`).
- **Python 3** (utilisé par `rename_mermaid.py`, `normalize_mermaid.py`, `print_pdf.py`).
- (optionnel, pour le PDF) **Pandoc 3.x** + **Chrome / chrome-headless-shell**.
  - Sous Windows, le binaire est attendu dans
    `%USERPROFILE%\.cache\puppeteer\chrome-headless-shell\win64-149.0.7827.22\chrome-headless-shell-win64\chrome-headless-shell.exe`
    (il s'agit du binaire que Puppeteer installe pour `mmdc` ; voir plus bas).
  - Sous WSL, le pipeline PDF utilise **weasyprint** à la place de chrome (le
    snap chromium-browser de WSL a un bug connu avec `--print-to-pdf`).
    `print_pdf.py` détecte automatiquement ce cas et bascule sur weasyprint
    si disponible (`pip3 install --break-system-packages weasyprint`).
  - Si vous voulez forcer un Chrome custom, positionnez la variable
    d'environnement `$VERIPASS_CHROME` sur le chemin de votre binaire.

> **Pas de LaTeX requis.** Le pipeline PDF utilise `pandoc → HTML5`, puis imprime le HTML via `chrome --headless --print-to-pdf` (Windows) ou `weasyprint` (WSL). Aucune installation de `lualatex`, `tectonic` ou `wkhtmltopdf` n'est nécessaire.

### Note technique : version de Chrome (Windows)

`mmdc` 11.x installe `puppeteer-core` 24.x, qui attend Chrome 148.0.7778.97. Si Puppeteer n'arrive pas à télécharger cette version exacte (réseau / mirror HS), on peut copier le binaire d'une autre version mineure (149 a été utilisée ici) vers le chemin attendu :

```powershell
# Après npm i -g @mermaid-js/mermaid-cli, si mmdc échoue avec "Could not find Chromium" :
$src = "$env:USERPROFILE\.cache\puppeteer\chrome-headless-shell\win64-149.0.7827.22"
$dst = "$env:USERPROFILE\.cache\puppeteer\chrome-headless-shell\win64-148.0.7778.97"
Copy-Item -Recurse -Force $src $dst
```

### Note technique : pipeline WSL

`render.sh` fonctionne sous WSL Ubuntu, mais l'environnement par défaut de WSL n'a ni Node ni mmdc installés. La procédure minimale (testée sur Ubuntu 24.04) :

```bash
# 1) Installer Node 20 (via archive tar.xz, plus rapide qu'apt)
curl -sSL https://nodejs.org/dist/v20.10.0/node-v20.10.0-linux-x64.tar.xz | tar -xJ -C $HOME/.local
export PATH="$HOME/.local/node-v20.10.0-linux-x64/bin:$PATH"

# 2) Installer mmdc + weasyprint (via npm + pip, sans sudo)
export PUPPETEER_SKIP_DOWNLOAD=1
npm install -g @mermaid-js/mermaid-cli --prefix $HOME/.local
pip3 install --break-system-packages --user weasyprint
export PATH="$HOME/.local/bin:$HOME/.local/node/bin:$PATH"

# 3) Installer chromium-browser (snap, ou apt si sudo dispo)
sudo apt install -y chromium-browser
# OU, si vous voulez utiliser un Chromium système déjà présent :
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# 4) Lancer le rendu
cd /mnt/c/<votre-chemin>/docs/c4-architecture
./render.sh --pdf
```

Le pipeline WSL utilise `chromium-browser` (natif Linux) pour les SVG et bascule automatiquement sur `weasyprint` pour le PDF (le snap chromium de WSL a un bug avec `--print-to-pdf`). Le PDF WSL fait ~270 KB (weasyprint rasterise les SVG en PNG) ; le PDF Windows fait ~1.1 MB (chrome-headless-shell garde les SVG vectoriels).

## Utilisation

### Windows (PowerShell)

```powershell
cd docs\c4-architecture
.\render.ps1            # SVG uniquement
.\render.ps1 -Pdf       # SVG + PDF
.\render.ps1 -Clean     # nettoyer les artefacts
```

### Linux / WSL (bash)

```bash
cd docs/c4-architecture
./render.sh             # SVG uniquement
./render.sh --pdf       # SVG + PDF
./render.sh --clean     # nettoyer les artefacts
```

## Workflow recommandé

1. Éditer `../BICEC-VERIPASS-VUE-ENSEMBLE.md` (Mermaid inline dans les blocs ` ```mermaid `).
2. Exécuter `render.ps1 -Pdf` (ou `render.sh --pdf`) pour régénérer les SVG et le PDF.
3. Committer le `.md`, les `.svg` modifiés, et le `.pdf` régénéré.

## Convention de nommage des fichiers produits

| Pattern | Exemple | Sens |
| --- | --- | --- |
| `diagrams/c4-{chapter}-{n}-{slug}.svg` | `diagrams/c4-2-1-containers-overview.svg` | SVG du diagramme 2.1 « Vue d'ensemble des containers » |
| `mermaid/c4-{chapter}-{n}-{slug}.mmd` | `mermaid/c4-4-1-kyc-state-machine.mmd` | Source Mermaid du diagramme 4.1 |

- `chapter` = niveau C4 (0=index, 1=Context, 2=Container, 3=Component, 4=Code, 5=Ops).
- `n` = numéro du diagramme dans le chapitre (1, 2, 3, …).
- `slug` = identifiant court dérivé du titre de la section.

## Limites connues

- **Pas d'exécution automatique** : les scripts ne sont pas lancés par opencode. Ils sont fournis à l'équipe BICEC pour régénérer les artefacts après édition.
- **Mermaid 11 lexer** est strict : `normalize_mermaid.py` réécrit les labels incompatibles (parens, crochets, `/*`, etc.) avant le rendu. Les diagrammes source dans le master `.md` ne sont pas modifiés — c'est seulement les `.mmd` extraits qui sont normalisés.
- **Les noms de fichiers `.svg` et `.mmd` peuvent contenir des accents** (`séquence`, `modèle`, `opérations`). C'est volontaire pour rester lisible. Si vous avez un pipeline qui n'aime pas l'UTF-8, changez les slugs dans `rename_mermaid.py`.
- **Chrome 149 vs 148** : voir la section « Note technique » ci-dessus. Le PDF généré via Chrome 149 est compatible.
- **Mermaid CLI** peut échouer sur des diagrammes très complexes ; dans ce cas, décomposez-les dans le master doc en plusieurs diagrammes numérotés.
