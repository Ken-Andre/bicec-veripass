/**
 * Smart image compression for document uploads.
 *
 * Strategy:
 * - Skip if already small (< 300KB) — no quality loss
 * - Resize to max 1800px (printable A4, zoomable by agents)
 * - JPEG 0.70 (preserves text edges, good for printing)
 * - If still > 500KB, progressive compression to 0.55
 * - Target: 200-500KB output, readable when printed
 */

const TARGET_MAX_BYTES = 500 * 1024;       // 500KB
const SKIP_THRESHOLD_BYTES = 300 * 1024;   // 300KB
const MAX_DIMENSION = 1800;
const INITIAL_QUALITY = 0.70;
const AGGRESSIVE_QUALITY = 0.55;

export async function compressForUpload(source: File | Blob): Promise<Blob> {
  // Skip if already small enough
  if (source.size <= SKIP_THRESHOLD_BYTES) return source;

  // Don't compress PDFs
  if (source.type === 'application/pdf') return source;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(source);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width;
      let h = img.height;

      // Resize only if dimensions exceed max
      if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / w, MAX_DIMENSION / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);

      // First pass: initial quality
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(source);
            return;
          }

          // If still too large, compress more aggressively
          if (blob.size > TARGET_MAX_BYTES) {
            canvas.toBlob(
              (blob2) => resolve(blob2 ?? blob),
              'image/jpeg',
              AGGRESSIVE_QUALITY,
            );
          } else {
            resolve(blob);
          }
        },
        'image/jpeg',
        INITIAL_QUALITY,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(source);
    };

    img.src = url;
  });
}
