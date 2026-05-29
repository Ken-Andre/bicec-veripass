import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Maximize2, RotateCw, ZoomIn, ZoomOut, Sun, Contrast } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface FocusRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageViewerProps {
  src: string;
  alt: string;
  focusRegion?: FocusRegion | null;
  className?: string;
  onOpenOriginal?: () => void;
  onDownload?: () => void;
}

export function ImageViewer({
  src,
  alt,
  focusRegion,
  className,
  onOpenOriginal,
  onDownload,
}: ImageViewerProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOrigin, setDragOrigin] = useState({ x: 0, y: 0 });
  const [hasError, setHasError] = useState(false);

  // Advanced legibility filters state
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [invert, setInvert] = useState(false);

  const zoomIn = useCallback(() => setScale((value) => Math.min(value + 0.25, 4)), []);
  const zoomOut = useCallback(() => setScale((value) => Math.max(value - 0.25, 0.5)), []);
  const rotate = useCallback(() => setRotation((value) => (value + 90) % 360), []);
  const reset = useCallback(() => {
    setScale(1);
    setRotation(0);
    setTranslate({ x: 0, y: 0 });
    setBrightness(100);
    setContrast(100);
    setInvert(false);
  }, []);

  const focusOn = useCallback((region: FocusRegion) => {
    setScale(2.5);
    setRotation(0);
    const centerX = region.x + region.width / 2;
    const centerY = region.y + region.height / 2;
    setTranslate({ x: -centerX + 150, y: -centerY + 100 });
  }, []);

  useEffect(() => {
    if (!focusRegion) return;
    const timer = setTimeout(() => focusOn(focusRegion), 0);
    return () => clearTimeout(timer);
  }, [focusRegion, focusOn]);

  useEffect(() => {
    setHasError(false);
    reset();
  }, [src, reset]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setDragOrigin({
      x: event.clientX - translate.x,
      y: event.clientY - translate.y,
    });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setTranslate({
      x: event.clientX - dragOrigin.x,
      y: event.clientY - dragOrigin.y,
    });
  };

  const onPointerUp = () => setIsDragging(false);

  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (event.deltaY < 0) {
      zoomIn();
    } else {
      zoomOut();
    }
  };

  return (
    <div className={cn('relative overflow-hidden rounded-lg border border-border bg-muted/30', className)}>
      <div className="absolute right-2 top-2 z-10 flex flex-wrap items-center gap-1">
        <Button
          variant="secondary"
          size="sm"
          className="h-7 w-7 bg-card/80 p-0 backdrop-blur-sm"
          onClick={zoomIn}
          title="Zoom +"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="h-7 w-7 bg-card/80 p-0 backdrop-blur-sm"
          onClick={zoomOut}
          title="Zoom -"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="h-7 w-7 bg-card/80 p-0 backdrop-blur-sm"
          onClick={rotate}
          title="Faire pivoter"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="h-7 w-7 bg-card/80 p-0 backdrop-blur-sm"
          onClick={reset}
          title="Réinitialiser"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>

        <div className="h-6 w-[1px] bg-border/80 mx-1 hidden sm:block" />

        <Button
          variant="secondary"
          size="sm"
          className="h-7 px-1.5 bg-card/80 text-[10px] font-mono backdrop-blur-sm flex items-center gap-0.5"
          onClick={() => setBrightness((b) => Math.max(b - 15, 40))}
          title="Luminosité -"
        >
          <Sun className="h-3.5 w-3.5 text-muted-foreground" />-
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="h-7 px-1.5 bg-card/80 text-[10px] font-mono backdrop-blur-sm flex items-center gap-0.5"
          onClick={() => setBrightness((b) => Math.min(b + 15, 200))}
          title="Luminosité +"
        >
          <Sun className="h-3.5 w-3.5" />+
        </Button>

        <Button
          variant="secondary"
          size="sm"
          className="h-7 px-1.5 bg-card/80 text-[10px] font-mono backdrop-blur-sm flex items-center gap-0.5"
          onClick={() => setContrast((c) => Math.max(c - 15, 40))}
          title="Contraste -"
        >
          <Contrast className="h-3.5 w-3.5 text-muted-foreground" />-
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="h-7 px-1.5 bg-card/80 text-[10px] font-mono backdrop-blur-sm flex items-center gap-0.5"
          onClick={() => setContrast((c) => Math.min(c + 15, 200))}
          title="Contraste +"
        >
          <Contrast className="h-3.5 w-3.5" />+
        </Button>

        <Button
          variant={invert ? "default" : "secondary"}
          size="sm"
          className={cn("h-7 px-2 text-[10px] font-medium backdrop-blur-sm flex items-center", invert ? "bg-blue-600 text-white" : "bg-card/80")}
          onClick={() => setInvert((i) => !i)}
          title="Inverser les couleurs"
        >
          Inverser
        </Button>

        {onOpenOriginal && (
          <Button
            variant="secondary"
            size="sm"
            className="h-7 bg-card/80 px-2 text-xs backdrop-blur-sm"
            onClick={onOpenOriginal}
          >
            Ouvrir
          </Button>
        )}
        {onDownload && (
          <Button
            variant="secondary"
            size="sm"
            className="h-7 bg-card/80 px-2 text-xs backdrop-blur-sm"
            onClick={onDownload}
          >
            Telecharger
          </Button>
        )}
      </div>

      <div
        className={cn(
          'flex h-full min-h-[220px] w-full items-center justify-center overflow-hidden',
          isDragging ? 'cursor-grabbing' : 'cursor-grab',
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onWheel={onWheel}
      >
        {hasError ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <p>Apercu indisponible pour ce fichier.</p>
            {onOpenOriginal && (
              <Button size="sm" variant="outline" onClick={onOpenOriginal}>
                Ouvrir le fichier
              </Button>
            )}
          </div>
        ) : (
          <>
            <img
              src={src}
              alt={alt}
              className="max-w-full select-none transition-transform duration-200"
              style={{
                transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale}) rotate(${rotation}deg)`,
                filter: `brightness(${brightness}%) contrast(${contrast}%) ${invert ? 'invert(1)' : ''}`,
              }}
              draggable={false}
              onError={() => setHasError(true)}
            />
            {focusRegion && scale > 1.5 && (
              <div
                className="pointer-events-none absolute animate-pulse rounded-sm border-2 border-yellow-400"
                style={{
                  left: `${(focusRegion.x + translate.x) * scale}px`,
                  top: `${(focusRegion.y + translate.y) * scale}px`,
                  width: `${focusRegion.width * scale}px`,
                  height: `${focusRegion.height * scale}px`,
                }}
              />
            )}
          </>
        )}
      </div>

      <div className="absolute bottom-2 left-2 flex gap-2 rounded bg-card/80 px-2 py-0.5 font-mono text-2xs text-muted-foreground backdrop-blur-sm">
        <span>Zoom: {Math.round(scale * 100)}%</span>
        {brightness !== 100 && <span>Lumière: {brightness}%</span>}
        {contrast !== 100 && <span>Contraste: {contrast}%</span>}
        {invert && <span>Négatif</span>}
      </div>
    </div>
  );
}
