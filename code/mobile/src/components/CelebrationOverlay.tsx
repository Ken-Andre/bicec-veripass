import { useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';

interface CelebrationOverlayProps {
  show: boolean;
  title: string;
  message: string;
  onComplete?: () => void;
  autoHide?: number;
}

export function CelebrationOverlay({ show, title, message, onComplete, autoHide = 4000 }: CelebrationOverlayProps) {
  const fired = useRef(false);

  const fireConfetti = useCallback(() => {
    if (fired.current) return;
    fired.current = true;
    const duration = 2000;
    const end = Date.now() + duration;
    const frame = () => {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors: ['#E37B03', '#4A2205', '#2563EB', '#10B981'] });
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors: ['#E37B03', '#4A2205', '#2563EB', '#10B981'] });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, []);

  useEffect(() => {
    if (show) {
      fireConfetti();
      if (autoHide && onComplete) {
        const timer = setTimeout(onComplete, autoHide);
        return () => clearTimeout(timer);
      }
    } else {
      fired.current = false;
    }
  }, [show, fireConfetti, autoHide, onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="text-center p-8"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.4 }}
              className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500"
            >
              <Check className="h-10 w-10 text-white" />
            </motion.div>
            <h2 className="text-2xl font-bold text-foreground mb-2">{title}</h2>
            <p className="text-muted-foreground">{message}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
