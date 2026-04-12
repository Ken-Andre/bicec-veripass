/**
 * ImageViewer — Document viewer avec zoom, rotation et bbox highlighting
 * Source: veripass-gatekeeper prototype
 * Mapping vers BICEC VeriPass — pour EvidenceViewerPage (Jean) et inspection documents
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ZoomIn, ZoomOut, RotateCw, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

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
}

export function ImageViewer({ src, alt, focusRegion, className }: ImageViewerProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const zoomIn = () => setScale((s) => Math.min(s + 0.25, 4));
  const zoomOut = () => setScale((s) => Math.max(s - 0.25, 0.5));
  const rotate = () => setRotation((r) => (r + 90) % 360);
  const reset = () => {
    setScale(1);
    setRotation(0);
    setTranslate({ x: 0, y: 0 });
  };

  const focusOn = useCallback((region: FocusRegion) => {
    setScale(2.5);
    setRotation(0);
    const centerX = region.x + region.width / 2;
    const centerY = region.y + region.height / 2;
    setTranslate({ x: -centerX + 150, y: -centerY + 100 });
  }, []);

  useEffect(() => {
    if (focusRegion) {
      const timer = setTimeout(() => focusOn(focusRegion), 0);
      return () => clearTimeout(timer);
    }
  }, [focusRegion, focusOn]);

  return (
    <div className={cn('relative rounded-lg overflow-hidden border border-border bg-muted/30', className)}>
      {/* Toolbar */}
      <div className="absolute top-2 right-2 z-10 flex gap-1">
        <Button variant="secondary" size="sm" className="h-7 w-7 p-0 backdrop-blur-sm bg-card/80" onClick={zoomIn}>
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button variant="secondary" size="sm" className="h-7 w-7 p-0 backdrop-blur-sm bg-card/80" onClick={zoomOut}>
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <Button variant="secondary" size="sm" className="h-7 w-7 p-0 backdrop-blur-sm bg-card/80" onClick={rotate}>
          <RotateCw className="h-3.5 w-3.5" />
        </Button>
        <Button variant="secondary" size="sm" className="h-7 w-7 p-0 backdrop-blur-sm bg-card/80" onClick={reset}>
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Image */}
      <div
        ref={containerRef}
        className="w-full h-full overflow-hidden cursor-grab active:cursor-grabbing min-h-[200px] flex items-center justify-center"
      >
        <img
          src={src}
          alt={alt}
          className="transition-transform duration-300 max-w-full"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale}) rotate(${rotation}deg)`,
          }}
          draggable={false}
        />
        {/* Focus highlight overlay pour bbox OCR */}
        {focusRegion && scale > 1.5 && (
          <div
            className="absolute border-2 border-yellow-400 rounded-sm animate-pulse pointer-events-none"
            style={{
              left: `${(focusRegion.x + translate.x) * scale}px`,
              top: `${(focusRegion.y + translate.y) * scale}px`,
              width: `${focusRegion.width * scale}px`,
              height: `${focusRegion.height * scale}px`,
            }}
          />
        )}
      </div>

      {/* Scale indicator */}
      <div className="absolute bottom-2 left-2 text-xs bg-card/80 backdrop-blur-sm px-2 py-0.5 rounded text-muted-foreground font-mono">
        {Math.round(scale * 100)}%
      </div>
    </div>
  );
}
