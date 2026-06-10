import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from '@mediapipe/tasks-vision';

let faceLandmarker: FaceLandmarker | null = null;
let initPromise: Promise<FaceLandmarker> | null = null;

const MEDIAPIPE_ASSET_MODE = (import.meta.env.VITE_MEDIAPIPE_ASSET_MODE || 'cdn').toLowerCase();
const MEDIAPIPE_WASM_BASE =
  MEDIAPIPE_ASSET_MODE === 'local'
    ? (import.meta.env.VITE_MEDIAPIPE_WASM_BASE || '/mobile/mediapipe/wasm')
    : 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
const MEDIAPIPE_MODEL_PATH =
  MEDIAPIPE_ASSET_MODE === 'local'
    ? (import.meta.env.VITE_MEDIAPIPE_FACE_MODEL_PATH || '/mobile/mediapipe/face_landmarker.task')
    : 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

/**
 * Initialize FaceLandmarker singleton.
 * MVP default loads Google-hosted assets for latency; local mode is reserved for sovereign hosting.
 */
export async function initFaceLandmarker(): Promise<FaceLandmarker> {
  if (faceLandmarker) return faceLandmarker;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_BASE);
    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MEDIAPIPE_MODEL_PATH,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    });
    return faceLandmarker;
  })();

  return initPromise;
}

export function detectForVideo(video: HTMLVideoElement, timestampMs: number) {
  if (!faceLandmarker) throw new Error('FaceLandmarker not initialized');
  return faceLandmarker.detectForVideo(video, timestampMs);
}

/**
 * Check if at least one face is detected with enough landmarks.
 */
export function isFacePresent(landmarks: NormalizedLandmark[][]): boolean {
  return landmarks.length > 0 && landmarks[0].length >= 468;
}

// Landmark indices for geometric helpers
// Nose tip: 1, Left ear tragion: 234, Right ear tragion: 454
// Left eye: 33, 160, 158, 133, 153, 144
// Right eye: 362, 385, 387, 263, 373, 380
// Upper lip: 13, Lower lip: 14, Left mouth corner: 61, Right mouth corner: 291

/**
 * Compute head yaw angle in degrees from face landmarks.
 * Negative = turned left, Positive = turned right.
 */
export function computeYawAngle(landmarks: NormalizedLandmark[]): number {
  const noseTip = landmarks[1];
  const leftEar = landmarks[234];
  const rightEar = landmarks[454];

  if (!noseTip || !leftEar || !rightEar) return 0;

  const midX = (leftEar.x + rightEar.x) / 2;
  const earDist = Math.abs(rightEar.x - leftEar.x);
  if (earDist < 0.001) return 0;

  const offset = (noseTip.x - midX) / earDist;
  return Math.asin(Math.min(Math.max(offset * 2, -1), 1)) * (180 / Math.PI);
}

/**
 * Compute Eye Aspect Ratio (EAR) — average of both eyes.
 * Low EAR (< 0.2) indicates blink.
 */
export function computeEAR(landmarks: NormalizedLandmark[]): number {
  const leftEAR = eyeAspectRatio(landmarks, [33, 160, 158, 133, 153, 144]);
  const rightEAR = eyeAspectRatio(landmarks, [362, 385, 387, 263, 373, 380]);
  return (leftEAR + rightEAR) / 2;
}

function eyeAspectRatio(lm: NormalizedLandmark[], idx: number[]): number {
  const p = idx.map(i => lm[i]);
  if (p.some(pt => !pt)) return 0.3;

  const vertDist1 = dist2d(p[1], p[5]);
  const vertDist2 = dist2d(p[2], p[4]);
  const horizDist = dist2d(p[0], p[3]);
  if (horizDist < 0.0001) return 0.3;

  return (vertDist1 + vertDist2) / (2 * horizDist);
}

/**
 * Compute smile score (0–1) based on mouth opening ratio.
 */
export function computeSmileScore(landmarks: NormalizedLandmark[]): number {
  const leftCorner = landmarks[61];
  const rightCorner = landmarks[291];
  const upperLip = landmarks[13];
  const lowerLip = landmarks[14];

  if (!leftCorner || !rightCorner || !upperLip || !lowerLip) return 0;

  const mouthWidth = dist2d(leftCorner, rightCorner);
  const mouthHeight = dist2d(upperLip, lowerLip);
  if (mouthWidth < 0.0001) return 0;

  const ratio = mouthHeight / mouthWidth;
  return Math.min(ratio / 0.5, 1);
}

function dist2d(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Compute Laplacian variance for blur detection on a canvas.
 */
export function computeLaplacianVariance(ctx: CanvasRenderingContext2D, width: number, height: number): number {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    const idx = i * 4;
    gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  }

  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const lap = 4 * gray[idx]
        - gray[idx - 1] - gray[idx + 1]
        - gray[idx - width] - gray[idx + width];
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }

  if (count === 0) return 0;
  const mean = sum / count;
  return sumSq / count - mean * mean;
}

export type { NormalizedLandmark };
