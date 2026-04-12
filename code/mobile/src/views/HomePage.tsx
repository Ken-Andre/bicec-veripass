import { ShieldCheck, ArrowRight, Zap, Lock, Smartphone, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { cn } from '../lib/utils';

const ONBOARDING_SLIDES = [
  {
    id: 1,
    icon: Zap,
    titleKey: 'welcome.speed',
    descKey: 'welcome.speed.desc',
    color: 'from-blue-600 to-indigo-700',
    iconColor: 'text-white',
    bgColor: 'bg-indigo-600'
  },
  {
    id: 2,
    icon: Lock,
    titleKey: 'welcome.security',
    descKey: 'welcome.security.desc',
    color: 'from-emerald-500 to-teal-700',
    iconColor: 'text-white',
    bgColor: 'bg-teal-600'
  },
  {
    id: 3,
    icon: Smartphone,
    titleKey: 'welcome.modernity',
    descKey: 'welcome.modernity.desc',
    color: 'from-amber-500 to-orange-700',
    iconColor: 'text-white',
    bgColor: 'bg-orange-600'
  }
];

const SLIDE_DURATION = 5000;
const SPLASH_DURATION = 2200;
const SWIPE_THRESHOLD = 50;

export function HomePage() {
  const navigate = useNavigate();
  const { isAuthenticated, user, loading } = useAuth();
  const { t, language, setLanguage } = useLanguage();

  const [currentSlide, setCurrentSlide] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showContent, setShowContent] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Touch/swipe state
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isSwiping = useRef(false);
  const longPressTimer = useRef<number | null>(null);

  // Auth Routing & Guard
  useEffect(() => {
    if (!loading) {
      if (isAuthenticated) {
        if (user && !user.has_pin) {
          navigate('/auth/pin-setup', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      } else {
        const savedUser = localStorage.getItem('vp_user');
        if (savedUser) {
          try {
            const parsedUser = JSON.parse(savedUser);
            if (parsedUser.has_pin) {
              navigate('/auth/pin-login', { replace: true });
              return;
            }
          } catch {
            localStorage.removeItem('vp_user');
          }
        }
      }

      const timer = setTimeout(() => setShowContent(true), SPLASH_DURATION);
      return () => clearTimeout(timer);
    }
  }, [loading, isAuthenticated, user, navigate]);

  // Carousel auto-advance
  useEffect(() => {
    if (!showContent || isAuthenticated || isPaused) return;

    let start = performance.now() - (progress / 100) * SLIDE_DURATION;
    let frame: number;

    const animate = (timestamp: number) => {
      const elapsed = timestamp - start;
      const p = Math.min((elapsed / SLIDE_DURATION) * 100, 100);
      setProgress(p);

      if (elapsed >= SLIDE_DURATION) {
        setCurrentSlide((prev) => (prev + 1) % ONBOARDING_SLIDES.length);
        start = timestamp;
        setProgress(0);
      }

      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [showContent, isAuthenticated, isPaused, progress]);

  const goToSlide = useCallback((index: number) => {
    setCurrentSlide(((index % ONBOARDING_SLIDES.length) + ONBOARDING_SLIDES.length) % ONBOARDING_SLIDES.length);
    setProgress(0);
  }, []);

  const goNext = useCallback(() => goToSlide(currentSlide + 1), [currentSlide, goToSlide]);
  const goPrev = useCallback(() => goToSlide(currentSlide - 1), [currentSlide, goToSlide]);

  // Touch handlers for swipe + tap zones + long-press pause
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwiping.current = false;

    // Long press to pause
    longPressTimer.current = window.setTimeout(() => {
      setIsPaused(true);
    }, 300);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;

    // If vertical scroll, don't interfere
    if (Math.abs(dy) > Math.abs(dx)) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      return;
    }

    // If horizontal movement exceeds threshold, it's a swipe
    if (Math.abs(dx) > 10) {
      isSwiping.current = true;
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (isSwiping.current) {
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      if (dx > SWIPE_THRESHOLD) goPrev();
      else if (dx < -SWIPE_THRESHOLD) goNext();
      isSwiping.current = false;
    }
  }, [goNext, goPrev]);

  // Tap zone handler (left = prev, right = next)
  const handleTapZone = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const third = rect.width / 3;

    if (x < third) goPrev();
    else if (x > third * 2) goNext();
  }, [goNext, goPrev]);

  const toggleLanguage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLanguage(language === 'fr' ? 'en' : 'fr');
  };

  // State for 3D Rays initialized after mount to keep render pure
  const [rays, setRays] = useState<{ delay: number; duration: number; zDepth: number; thickness: number }[]>([]);

  useEffect(() => {
    if (!showContent) {
      setTimeout(() => {
        setRays(Array.from({ length: 60 }, () => ({
          delay: Math.random() * 2,
          duration: 0.8 + Math.random() * 1.5,
          zDepth: Math.random() * 1000,
          thickness: 1 + Math.random() * 3
        })));
      }, 0);
    }
  }, [showContent]);

  if (!showContent) {
    return (
      <div className="fixed inset-0 min-h-[100dvh] bg-[#001D45] flex items-center justify-center overflow-hidden perspective-[1200px]">
        {/* CSS Warp Speed Rays */}
        <div className="absolute inset-x-0 bottom-0 top-1/2 -translate-y-1/2 overflow-hidden pointer-events-none mix-blend-screen transform-style-3d z-0">
          {rays.map((ray, i) => (
            <div
              key={i}
              className="ray-3d"
              style={{
                '--angle': `${i * 6}deg`,
                '--delay': `${ray.delay}s`,
                '--duration': `${ray.duration}s`,
                '--z-depth': `${ray.zDepth}px`,
                '--thickness': `${ray.thickness}px`
              } as React.CSSProperties}
            />
          ))}
        </div>

        {/* Central 3D Asset */}
        <div className="relative z-20 flex flex-col items-center transform-gpu animate-float-3d">
          <div className="absolute -inset-16 rounded-full bg-gradient-to-tr from-[#00A3E0]/30 to-transparent blur-[50px] animate-pulse-fast" />

          <div className="relative w-40 h-40 transform-style-3d animate-spin-slow">
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-white/5 backdrop-filter blur-xl border-2 border-white/40 rounded-full shadow-[0_0_150px_rgba(0,163,224,0.6)] flex items-center justify-center translate-z-[20px]">
              <ShieldCheck className="w-20 h-20 text-white drop-shadow-[0_0_30px_rgba(255,255,255,1)]" />
            </div>
            <div className="absolute inset-0 bg-[#00A3E0]/20 rounded-full -translate-z-[20px] blur-sm" />
          </div>

          <div className="mt-16 space-y-2 text-center animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-500 z-30">
            <h1 className="text-5xl font-black text-white tracking-[0.25em] uppercase leading-none drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]">VeriPass</h1>
            <p className="text-[#00A3E0] text-[12px] font-black tracking-[0.8em] ml-2 drop-shadow-md">L'ASSURANCE BICEC</p>
          </div>
        </div>

        <style>{`
          .perspective-[1200px] { perspective: 1200px; }
          .transform-style-3d { transform-style: preserve-3d; }
          
          .ray-3d {
            position: absolute;
            top: 50%;
            left: 50%;
            width: var(--thickness);
            height: 150vh;
            background: linear-gradient(to top, transparent, rgba(0, 163, 224, 0.8), white);
            transform-origin: 0 0;
            transform: rotate(var(--angle)) translateZ(var(--z-depth)) scaleY(0.1);
            animation: warp-3d var(--duration) cubic-bezier(0.4, 0, 0.2, 1) infinite var(--delay);
            filter: blur(2px);
          }
          
          @keyframes warp-3d {
            0% { transform: rotate(var(--angle)) translateZ(var(--z-depth)) scaleY(0.1); opacity: 0; filter: blur(8px); }
            40% { opacity: 1; filter: blur(2px); }
            100% { transform: rotate(var(--angle)) translateZ(calc(var(--z-depth) + 1500px)) scaleY(3); opacity: 0; filter: blur(20px); }
          }
          
          @keyframes float-3d {
            0%, 100% { transform: translateY(0) scale(1) rotateX(10deg); }
            50% { transform: translateY(-20px) scale(1.05) rotateX(-5deg); }
          }
          .animate-float-3d { animation: float-3d 6s ease-in-out infinite; }
          
          @keyframes spin-slow {
            0% { transform: rotateY(0deg) rotateX(10deg); }
            100% { transform: rotateY(360deg) rotateX(10deg); }
          }
          .animate-spin-slow { animation: spin-slow 15s linear infinite; }
          
          .animate-pulse-fast { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        `}</style>
      </div>
    );
  }

  const slide = ONBOARDING_SLIDES[currentSlide];
  const Icon = slide.icon;

  return (
    <div
      className="fixed inset-0 min-h-[100dvh] bg-white flex flex-col overflow-hidden animate-in fade-in duration-700 select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={() => setIsPaused(true)}
      onMouseUp={() => setIsPaused(false)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Tap Zone Overlay for prev/next navigation */}
      <div
        className="absolute inset-0 z-10 flex"
        onClick={handleTapZone}
      >
        {/* Left third: previous */}
        <div className="w-1/3 h-full flex items-center justify-start pl-4 opacity-0 hover:opacity-100 transition-opacity">
          <ChevronLeft className="w-8 h-8 text-slate-300" />
        </div>
        {/* Middle third: no action */}
        <div className="w-1/3 h-full" />
        {/* Right third: next */}
        <div className="w-1/3 h-full flex items-center justify-end pr-4 opacity-0 hover:opacity-100 transition-opacity">
          <ChevronRight className="w-8 h-8 text-slate-300" />
        </div>
      </div>

      {/* Background Decor */}
      <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-[400px] h-[400px] bg-primary-bicec-blue/5 rounded-full blur-[100px]" />

      {/* Header */}
      <div className="relative z-20 w-full space-y-6 pt-12 pb-6 px-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-primary-bicec-blue rounded-xl flex items-center justify-center shadow-lg shadow-primary-bicec-blue/20">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col -space-y-1">
              <span className="font-black text-primary-bicec-blue text-lg tracking-tight">VeriPass</span>
              <span className="text-[8px] font-black tracking-[0.1em] text-slate-400 uppercase">Module Auth</span>
            </div>
          </div>
          <button
            onClick={toggleLanguage}
            className="relative z-30 px-5 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs font-black text-slate-800 shadow-sm active:scale-95 transition-all flex items-center gap-2"
          >
            <span className="opacity-40 uppercase">Lang:</span>
            {language?.toUpperCase() || 'FR'}
          </button>
        </div>

        {/* Progress Bars */}
        <div className="flex w-full gap-2">
          {ONBOARDING_SLIDES.map((s, idx) => (
            <div key={s.id} className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-bicec-blue transition-all duration-100 ease-linear"
                style={{
                  width: idx < currentSlide ? '100%' : idx === currentSlide ? `${progress}%` : '0%',
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Slide Content */}
      <div className="relative z-20 flex-1 flex flex-col justify-center items-center text-center px-6">
        <div className="relative mb-8 sm:mb-12 transform-gpu">
          <div className={`absolute inset-0 bg-gradient-to-tr ${slide.color} opacity-20 blur-3xl rounded-full scale-[2.5]`} />
          <div className={`relative w-36 h-36 sm:w-48 sm:h-48 ${slide.bgColor} rounded-[2.5rem] sm:rounded-[3rem] flex items-center justify-center border-[8px] sm:border-[12px] border-white shadow-[0_30px_60px_rgba(0,0,0,0.12)]`}>
            <Icon className={`w-16 h-16 sm:w-24 sm:h-24 ${slide.iconColor} drop-shadow-2xl`} />
          </div>
        </div>

        <div className="space-y-4 sm:space-y-5 px-4 max-w-sm">
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tighter leading-[0.95] [text-wrap:balance]">
            {t(slide.titleKey)}
          </h2>
          <p className="text-slate-500 font-bold text-base sm:text-lg leading-snug">
            {t(slide.descKey)}
          </p>
        </div>

        {/* Slide indicators (dots) */}
        <div className="flex gap-2 mt-8">
          {ONBOARDING_SLIDES.map((_, idx) => (
            <button
              key={idx}
              onClick={(e) => { e.stopPropagation(); goToSlide(idx); }}
              className={cn(
                'w-2.5 h-2.5 rounded-full transition-all',
                idx === currentSlide ? 'bg-primary-bicec-blue w-8' : 'bg-slate-200'
              )}
            />
          ))}
        </div>
      </div>

      {/* Persistent Buttons Overlay */}
      <div className="relative z-30 w-full pb-6 px-6 space-y-4">
        <button
          onClick={() => navigate('/auth/phone?mode=signup')}
          className="bicec-button w-full h-16 text-xl flex items-center justify-center gap-3 relative overflow-hidden group"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer" />
          <span className="font-black uppercase tracking-tight relative z-10">Créer un profil VeriPass</span>
          <ArrowRight className="w-6 h-6 relative z-10 group-hover:translate-x-1 transition-transform" />
        </button>

        <button
          onClick={() => navigate('/auth/phone?mode=login')}
          className="w-full h-14 bg-white/50 backdrop-blur-md border-2 border-slate-200 text-slate-800 rounded-2xl font-bold uppercase tracking-wide flex items-center justify-center active:scale-95 transition-all shadow-sm"
        >
          Se connecter
        </button>

        <div className="flex flex-col items-center space-y-1 opacity-40 pt-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em]">
              Systeme VeriPass Actif
            </p>
          </div>
          <p className="text-[8px] text-slate-300 font-bold tracking-[0.1em]">BUILD 2026.04.A-ULTRA</p>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
        .group-hover\\:animate-shimmer:hover {
          animation: shimmer 1.5s infinite;
        }
      `}</style>
    </div>
  );
}
