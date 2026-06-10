# ADR-030: MediaPipe CDN Exception For MVP Liveness

Date: 2026-05-28

## Status

Accepted for MVP.

## Context

The mobile liveness flow uses MediaPipe face-landmarker WASM and model assets. A fully sovereign posture would self-host these assets, but current field network constraints make first-load latency materially worse when the app serves the model itself.

## Decision

For the MVP, the mobile app defaults `VITE_MEDIAPIPE_ASSET_MODE=cdn` and loads:

- WASM from the public `@mediapipe/tasks-vision` CDN.
- The face-landmarker model from Google-hosted MediaPipe storage.

The implementation also supports `VITE_MEDIAPIPE_ASSET_MODE=local` with `VITE_MEDIAPIPE_WASM_BASE` and `VITE_MEDIAPIPE_FACE_MODEL_PATH` for a future self-hosted deployment.

## Consequences

- MVP liveness startup remains fast on constrained networks.
- The external asset dependency is explicit, auditable, and reversible.
- A later sovereignty hardening pass must package and serve the WASM/model assets from BICEC-controlled infrastructure before declaring an offline/souverainete posture.
