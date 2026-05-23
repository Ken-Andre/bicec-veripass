import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Lock, Smartphone, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';

const ONBOARDING_SLIDES = [
  {
    id: 1,
    icon: Zap,
    titleKey: 'welcome.speed',
    descKey: 'welcome.speed.desc',
    color: 'from-orange-400 to-amber-600',
  },
  {
    id: 2,
    icon: Lock,
    titleKey: 'welcome.security',
    descKey: 'welcome.security.desc',
    color: 'from-emerald-400 to-teal-600',
  },
  {
    id: 3,
    icon: Smartphone,
    titleKey: 'welcome.modernity',
    descKey: 'welcome.modernity.desc',
    color: 'from-sky-400 to-blue-600',
  },
];

const SLIDE_DURATION = 5000;
const SPLASH_DURATION = 2500;

function FloatingParticles() {
  const particles = useMemo(() => Array.from({ length: 24 }, (_, i) => ({
    id: i,
    size: 4 + ((i * 7 + 3) % 8),
    left: `${(i * 17 + 11) % 100}%`,
    top: `${(i * 23 + 7) % 100}%`,
    duration: 8 + ((i * 13 + 5) % 12),
    delay: (i * 3) % 5,
  })), []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full bg-white/10 animate-float-particle"
          style={{
            width: p.size,
            height: p.size,
            left: p.left,
            top: p.top,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const { isAuthenticated, user, loading } = useAuth();
  const { t, language, setLanguage } = useLanguage();

  const [currentSlide, setCurrentSlide] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [progress, setProgress] = useState(0);

  // Auth routing
  useEffect(() => {
    if (loading) return;
    if (isAuthenticated) {
      navigate(user && !user.has_pin ? '/auth/pin-setup' : '/dashboard', { replace: true });
      return;
    }
    if (user?.has_pin) {
      navigate('/auth/pin-login', { replace: true });
      return;
    }
    const timer = setTimeout(() => setShowOnboarding(true), SPLASH_DURATION);
    return () => clearTimeout(timer);
  }, [loading, isAuthenticated, user, navigate]);

  // Auto-advance carousel
  useEffect(() => {
    if (!showOnboarding) return;
    let start = performance.now() - (progress / 100) * SLIDE_DURATION;
    let frame: number;

    const animate = (timestamp: number) => {
      const elapsed = timestamp - start;
      const p = Math.min((elapsed / SLIDE_DURATION) * 100, 100);
      setProgress(p);
      if (elapsed >= SLIDE_DURATION) {
        setCurrentSlide(prev => (prev + 1) % ONBOARDING_SLIDES.length);
        start = timestamp;
        setProgress(0);
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [showOnboarding, progress]);

  const goToSlide = (index: number) => {
    setCurrentSlide(((index % ONBOARDING_SLIDES.length) + ONBOARDING_SLIDES.length) % ONBOARDING_SLIDES.length);
    setProgress(0);
  };
  const goNext = () => goToSlide(currentSlide + 1);
  const goPrev = () => goToSlide(currentSlide - 1);

  const toggleLanguage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLanguage(language === 'fr' ? 'en' : 'fr');
  };

  // Splash screen
  if (!showOnboarding) {
    return (
      <div className="fixed inset-0 min-h-[100dvh] bg-gradient-to-br from-[#1a0f00] via-[#2d1b05] to-[#001d45] flex items-center justify-center overflow-hidden">
        <FloatingParticles />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,140,0,0.12),transparent_60%)]" />

        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 100, damping: 15, delay: 0.3 }}
          className="relative z-10 flex flex-col items-center text-center px-6"
        >
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-orange-500/20 blur-3xl rounded-full scale-150" />
            <div className="relative w-28 h-28 rounded-3xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-2xl shadow-orange-500/30 overflow-hidden">
              <img
                src={`${import.meta.env.BASE_URL}bicec_logo.jpg`}
                alt="BICEC"
                className="w-24 h-24 object-contain rounded-2xl bg-white"
              />
            </div>
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-4xl font-black text-white tracking-tight mb-2"
          >
            VeriPass
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="text-sm font-bold text-orange-300/80 tracking-[0.2em] uppercase"
          >
            L'identité numérique BICEC
          </motion.p>
        </motion.div>
      </div>
    );
  }

  const slide = ONBOARDING_SLIDES[currentSlide];
  const Icon = slide.icon;

  return (
    <div className="fixed inset-0 min-h-[100dvh] bg-background flex flex-col overflow-hidden select-none">
      {/* Header */}
      <div className="relative z-20 w-full pt-12 pb-4 px-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <img
              src={`${import.meta.env.BASE_URL}bicec_logo.jpg`}
              alt="BICEC"
              className="w-9 h-9 object-contain rounded-xl shadow-lg bg-white"
            />
            <span className="font-black text-foreground text-lg tracking-tight">VeriPass</span>
          </div>
          <button
            onClick={toggleLanguage}
            className="px-4 py-2 bg-muted border border-border rounded-full text-xs font-bold text-foreground shadow-sm active:scale-95 transition-all"
          >
            {language?.toUpperCase() || 'FR'}
          </button>
        </div>

        {/* Progress Bars */}
        <div className="flex w-full gap-2">
          {ONBOARDING_SLIDES.map((s, idx) => (
            <div key={s.id} className="h-1 flex-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-100 ease-linear"
                style={{ width: idx < currentSlide ? '100%' : idx === currentSlide ? `${progress}%` : '0%' }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Slide Content with tap zones */}
      <div className="relative z-10 flex-1 flex flex-col">
        <div className="flex-1 flex flex-col justify-center items-center text-center px-6 relative" onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          if (x < rect.width / 3) goPrev();
          else if (x > rect.width * 2 / 3) goNext();
        }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center"
            >
              <div className={`w-32 h-32 rounded-[2rem] bg-gradient-to-tr ${slide.color} flex items-center justify-center shadow-xl mb-8`}>
                <Icon className="w-14 h-14 text-white" />
              </div>
              <h2 className="text-3xl font-black text-foreground tracking-tighter leading-tight mb-3 max-w-xs">
                {t(slide.titleKey)}
              </h2>
              <p className="text-muted-foreground font-medium text-base leading-snug max-w-xs">
                {t(slide.descKey)}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Dots */}
          <div className="flex gap-2 mt-8">
            {ONBOARDING_SLIDES.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => { e.stopPropagation(); goToSlide(idx); }}
                className={cn('h-2 rounded-full transition-all', idx === currentSlide ? 'bg-primary w-8' : 'bg-muted w-2')}
              />
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div className="px-6 pb-8 pt-4 space-y-3">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/auth/phone?mode=signup')}
            className="w-full h-14 bg-primary text-primary-foreground rounded-2xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg shadow-primary/25"
          >
            {t('welcome.cta.primary')}
            <ArrowRight className="w-5 h-5" />
          </motion.button>
          <button
            onClick={() => navigate('/auth/phone?mode=login')}
            className="w-full h-12 bg-muted/50 border border-border text-foreground rounded-2xl font-semibold active:scale-95 transition-all"
          >
            {t('welcome.cta.secondary')}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes float-particle {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
          25% { transform: translateY(-20px) translateX(10px); opacity: 0.6; }
          50% { transform: translateY(-40px) translateX(-10px); opacity: 0.4; }
          75% { transform: translateY(-20px) translateX(5px); opacity: 0.5; }
        }
        .animate-float-particle {
          animation: float-particle ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
