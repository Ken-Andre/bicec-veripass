# GitHub Project timeline update report

Generated from `docs/planning/github-open-issues-inventory.json` and applied through
`scripts/apply_project_timeline_updates.py`.

## Scope

- Project: `Bicec-Veripass Project`
- Fields updated: `Status`, `Debut`, `Fin`
- Target status for dated open issues: `In progress`
- Issues were not closed.
- Docker was not started.

## Result

- 78 issues were selected by the conservative manifest as `Terminé probable` with a first commit date.
- The final Project dry-run returned `planned: []`, which means every selected issue that was present in the Project and still in `Todo` had already been updated or was updated during this pass.
- Issues already in `In Progress` were left as-is.
- Issues not present in the Project were not created automatically.

## Explicit example: issue #60

Issue #60, `[CAPTURE-06] Integration — MediaPipe WASM client-side quality gate`, was not updated automatically.

Reason: the inventory marks it as `Partiellement terminé`, not `Terminé probable`. There is a local trace around `code/mobile/src/services/mediapipeService.ts`, but not enough evidence for a complete blur/glare thresholding plus callback implementation, and no reliable first commit candidate was found. It should be reviewed manually before assigning project dates.

## Re-run commands

Dry-run:

```powershell
python scripts\apply_project_timeline_updates.py
```

Apply:

```powershell
python scripts\apply_project_timeline_updates.py --apply
```

Target specific issues:

```powershell
python scripts\apply_project_timeline_updates.py --apply --issues 60,61
```
