/**
 * CNI quality + lightweight authenticity heuristics.
 *
 * Runs entirely in the browser and acts as a pre-OCR gate: if any check
 * fails, the upload is blocked and the user gets actionable feedback
 * (too dark, too blurry, wrong aspect ratio, etc.). Authenticity here
 * is only a heuristic — the real check still happens server-side after
 * OCR/MRZ parsing.
 */

export type CniCheckCode =
  | 'resolution'
  | 'sharpness'
  | 'brightness'
  | 'glare'
  | 'aspect_ratio';

export interface CniMetrics {
  width: number;
  height: number;
  sharpness: number;     // Laplacian variance
  avgBrightness: number; // 0..255
  maxBrightness: number; // 0..255
}

export interface CniCheckResult {
  ok: boolean;
  failures: CniCheckCode[];
  authenticityScore: number; // 0..1
  metrics: CniMetrics;
}

const MIN_PIXELS = 1280 * 720;
const MIN_SHARPNESS = 120;
const MIN_BRIGHTNESS = 60;
const MAX_BRIGHTNESS = 210;
const GLARE_MAX = 245;
const GLARE_AVG = 200;
const ASPECT_MIN = 1.45;
const ASPECT_MAX = 1.75; // ID-1 ≈ 1.586

export function evaluateCni(m: CniMetrics): CniCheckResult {
  const failures: CniCheckCode[] = [];

  if (m.width * m.height < MIN_PIXELS) failures.push('resolution');
  if (m.sharpness < MIN_SHARPNESS) failures.push('sharpness');
  if (m.avgBrightness < MIN_BRIGHTNESS || m.avgBrightness > MAX_BRIGHTNESS) failures.push('brightness');
  if (m.maxBrightness > GLARE_MAX && m.avgBrightness > GLARE_AVG) failures.push('glare');
  const ar = m.height > 0 ? m.width / m.height : 0;
  if (ar < ASPECT_MIN || ar > ASPECT_MAX) failures.push('aspect_ratio');

  // Authenticity: weighted score from each criterion, all-or-nothing per axis.
  const passed = 5 - failures.length;
  const authenticityScore = passed / 5;

  return { ok: failures.length === 0, failures, authenticityScore, metrics: m };
}

/** Verso MRZ sanity: ICAO TD-1 has 3 lines of 30 chars in [A-Z0-9<]. */
export function looksLikeMrz(text: string | undefined): boolean {
  if (!text) return false;
  const lines = text.split(/\r?\n/).filter((l) => l.length >= 28 && l.length <= 32);
  return lines.some((l) => /^[A-Z0-9<]{28,32}$/.test(l.trim()));
}

export const CNI_FAILURE_LABELS: Record<CniCheckCode, { fr: string; en: string }> = {
  resolution: { fr: 'Résolution insuffisante', en: 'Resolution too low' },
  sharpness: { fr: 'Image floue', en: 'Image is blurry' },
  brightness: { fr: 'Luminosité incorrecte', en: 'Brightness out of range' },
  glare: { fr: 'Reflets détectés', en: 'Glare detected' },
  aspect_ratio: { fr: 'Cadrage incorrect', en: 'Wrong framing' },
};

/**
 * Compute image metrics from a canvas context for CNI quality evaluation.
 */
export function computeCniMetrics(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
): CniMetrics {
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Laplacian variance (sharpness)
  let sum = 0;
  let sumSq = 0;
  let pixelCount = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const idxTop = ((y - 1) * width + x) * 4;
      const idxBot = ((y + 1) * width + x) * 4;
      const idxLeft = (y * width + (x - 1)) * 4;
      const idxRight = (y * width + (x + 1)) * 4;

      const gray = (v: number) => data[v] * 0.299 + data[v + 1] * 0.587 + data[v + 2] * 0.114;

      const laplacian =
        -4 * gray(idx) +
        gray(idxTop) + gray(idxBot) + gray(idxLeft) + gray(idxRight);

      sum += laplacian;
      sumSq += laplacian * laplacian;
      pixelCount++;
    }
  }

  const variance = pixelCount > 0 ? sumSq / pixelCount - (sum / pixelCount) ** 2 : 0;

  // Brightness
  let totalBrightness = 0;
  let maxBrightness = 0;
  const totalPixels = width * height;

  for (let i = 0; i < data.length; i += 4) {
    const brightness = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    totalBrightness += brightness;
    if (brightness > maxBrightness) maxBrightness = brightness;
  }

  return {
    width,
    height,
    sharpness: Math.max(0, variance),
    avgBrightness: totalBrightness / totalPixels,
    maxBrightness,
  };
}
