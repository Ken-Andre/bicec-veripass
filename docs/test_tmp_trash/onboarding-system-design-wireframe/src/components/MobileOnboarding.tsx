import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Globe, Smartphone, Mail, Lock, Fingerprint,
  CreditCard, ScanLine, Camera, MapPin, FileCheck, FileText,
  ShieldCheck, PenTool, CheckCircle, Upload, PartyPopper,
  ChevronLeft, ChevronRight, Wifi, WifiOff, Battery,
  Signal, Clock, Check, AlertTriangle, Edit3, RotateCcw,
  Eye, EyeOff, X, CreditCard as CardIcon, Send, Ban,
  ArrowRight, Loader2, Shield
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useScenario } from '@/contexts/ScenarioContext';
import { STEP_SEQUENCE, LANGUAGES, MOCK_OCR_FIELDS, REGIONS, REGION_NAMES, validateNIU, type QuartierEntry } from '@/data';
import type { OCRField } from '@/types';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles, Globe, Smartphone, Mail, Lock, Fingerprint,
  CreditCard, ScanLine, Camera, MapPin, FileCheck, FileText,
  ShieldCheck, PenTool, CheckCircle, Upload, PartyPopper,
};

interface MobileOnboardingProps {
  onComplete?: () => void;
}

export function MobileOnboarding({ onComplete }: MobileOnboardingProps) {
  const scenario = useScenario();
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  const [pin, setPin] = useState(['', '', '', '', '', '']);
  const [pinConfirm, setPinConfirm] = useState(['', '', '', '', '', '']);
  const [pinStep, setPinStep] = useState<'create' | 'confirm'>('create');
  const [showPin, setShowPin] = useState(false);
  const [selectedLang, setSelectedLang] = useState('fr');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpSent, setOtpSent] = useState(false);
  const [ocrFields, setOcrFields] = useState<OCRField[]>(MOCK_OCR_FIELDS);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [livenessAttempts, setLivenessAttempts] = useState(0);
  const [livenessState, setLivenessState] = useState<'idle' | 'scanning' | 'success' | 'failed' | 'Bloqué'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadChunks, setUploadChunks] = useState({ total: 5, completed: 0 });
  const [consentChecks, setConsentChecks] = useState({ terms: false, privacy: false, data: false, signature: false });
  const [hasSigned, setHasSigned] = useState(false);
  const [postState, setPostState] = useState<'pending' | 'limited' | 'full' | null>(null);
  const [selectedAddress, setSelectedAddress] = useState({ region: '', city: '', quartier: '', commune: '' });
  const [gpsAssist, setGpsAssist] = useState(false);
  const [showGpsModal, setShowGpsModal] = useState(false);
  const [fiscalType, setFiscalType] = useState<'niu' | ''>('');
  const [niuValue, setNiuValue] = useState('');
  const [niuEntryMode, setNiuEntryMode] = useState<'scan' | 'upload' | 'manual' | null>(null);
  const [niuUploaded, setNiuUploaded] = useState(false);

  const currentStep = STEP_SEQUENCE[currentStepIdx];
  const totalSteps = STEP_SEQUENCE.length;
  const progress = ((currentStepIdx + 1) / totalSteps) * 100;

  // Simuler hors ligne toggle
  useEffect(() => {
    if (!isOnline || scenario.isOffline) {
      setShowOfflineBanner(true);
      if (!scenario.isOffline) {
        const t = setTimeout(() => {
          setIsOnline(true);
          setShowOfflineBanner(false);
        }, 3000);
        return () => clearTimeout(t);
      }
    } else {
      setShowOfflineBanner(false);
    }
  }, [isOnline, scenario.isOffline]);

  const goNext = useCallback(() => {
    if (currentStepIdx < totalSteps - 1) {
      setCurrentStepIdx(prev => prev + 1);
    } else {
      setPostState('pending');
    }
  }, [currentStepIdx, totalSteps]);

  const goBack = useCallback(() => {
    if (currentStepIdx > 0) {
      setCurrentStepIdx(prev => prev - 1);
    }
  }, [currentStepIdx]);

  // Upload simulation
  useEffect(() => {
    if (currentStep?.id === 'uploading') {
      setUploadProgress(0);
      setUploadChunks({ total: 5, completed: 0 });
      let chunk = 0;
      const interval = setInterval(() => {
        chunk++;
        setUploadChunks(prev => ({ ...prev, completed: chunk }));
        setUploadProgress(Math.min((chunk / 5) * 100, 100));
        if (chunk >= 5) {
          clearInterval(interval);
          setTimeout(() => goNext(), 600);
        }
      }, 700);
      return () => clearInterval(interval);
    }
  }, [currentStep?.id, goNext]);

  /* REMOVED: Wet signature canvas logic (Moved to agency physical visit per FR19)
  useEffect(() => {
    if (currentStep?.id === 'signature' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = canvas.offsetWidth * 2;
        canvas.height = canvas.offsetHeight * 2;
        ctx.scale(2, 2);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [currentStep?.id, isSigning]);
  */

  /* REMOVED: Canvas drawing handlers
  const handleCanvasStart = (e: React.MouseEvent | React.TouchEvent) => {
    isDrawingRef.current = true;
    setHasSigned(true);
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    lastPosRef.current = { x: clientX - rect.left, y: clientY - rect.top };
  };

  const handleCanvasMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    lastPosRef.current = { x, y };
  };

  const handleCanvasEnd = () => {
    isDrawingRef.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    setHasSigned(false);
  };
  */

  const confidenceColor = (c: number) => {
    if (c >= 90) return 'text-emerald-600 bg-emerald-50';
    if (c >= 70) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  const renderPostSubmission = () => {
    const effectiveState = scenario.kycState === 'PENDING_INFO' ? 'PENDING_INFO' :
      scenario.kycState === 'REJECTED' ? 'REJECTED' :
        scenario.accessLevel === 'FULL' ? 'full' :
          scenario.accessLevel === 'LIMITED' ? 'limited' :
            postState;

    if (effectiveState === 'PENDING_INFO') {
      return (
        <div className="flex flex-col items-center justify-center h-full px-6 text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Action requise</h2>
            <p className="text-sm text-slate-500 mt-2">L'agent en charge a besoin d'un document supplémentaire pour valider votre dossier.</p>
          </div>
          <div className="w-full bg-blue-50 border border-blue-200 rounded-xl p-4 text-left">
            <p className="text-sm font-semibold text-blue-900 mb-1">Motif de la demande :</p>
            <p className="text-sm text-blue-800 italic">"Bonjour, la facture ENEO fournie est illisible ou tronquée. Merci de renvoyer une photo nette de l'intégralité du document."</p>
          </div>
          <div className="w-full pt-4">
            <button className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 transition-all text-sm shadow-md">
              <Upload className="w-4 h-4" /> Fournir le document manquant
            </button>
            <button className="w-full py-3 mt-2 text-slate-500 font-semibold rounded-xl text-sm hover:bg-slate-50">
              Contacter le support
            </button>
          </div>
        </div>
      );
    }

    if (effectiveState === 'REJECTED') {
      return (
        <div className="flex flex-col items-center justify-center h-full px-6 text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
            <Ban className="w-10 h-10 text-red-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Dossier Rejeté</h2>
            <p className="text-sm text-slate-500 mt-2">Nous ne pouvons malheureusement pas donner suite à votre demande d'ouverture de compte.</p>
          </div>
          <div className="w-full bg-red-50 border border-red-200 rounded-xl p-4 text-left">
            <p className="text-sm font-semibold text-red-900 mb-1">Motif :</p>
            <p className="text-sm text-red-800">Non-conformité vis-à-vis des exigences réglementaires.</p>
          </div>
          <div className="w-full pt-4">
            <button className="w-full py-3 bg-slate-900 text-white font-semibold rounded-xl text-sm shadow-md">
              Retour à l'accueil
            </button>
          </div>
        </div>
      );
    }

    if (effectiveState === 'pending') {
      return (
        <div className="flex flex-col items-center justify-center h-full px-6 text-center space-y-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center">
              <Clock className="w-10 h-10 text-amber-600" />
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Dossier en cours de vérification</h2>
            <p className="text-sm text-slate-500 mt-2">Vos documents sont en cours de validation par notre équipe BICEC. Délai habituel : 1 à 2 jours ouvrés.</p>
          </div>
          <div className="w-full bg-white rounded-xl border border-slate-200 p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Dossier N°</span>
              <span className="font-mono text-slate-900 font-medium">VRF-2026-0006</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Statut</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                <Loader2 className="w-3 h-3 animate-spin" /> En cours de vérification
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Soumis</span>
              <span className="text-slate-900">À l'instant</span>
            </div>
          </div>
          <div className="w-full space-y-3 pt-2">
            <h3 className="text-sm font-semibold text-slate-700">Disponible pendant la vérification :</h3>
            {['Consulter mon compte', 'Découvrir les offres', 'Contacter le support'].map((item) => (
              <div key={item} className="flex items-center gap-3 px-4 py-3 bg-white rounded-lg border border-slate-200">
                <Check className="w-4 h-4 text-emerald-500" />
                <span className="text-sm text-slate-700">{item}</span>
              </div>
            ))}
            {['Virements', 'Carte de débit', 'Investissements'].map((item) => (
              <div key={item} className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-lg border border-slate-200 opacity-60">
                <Ban className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-400">{item}</span>
                <span className="ml-auto text-xs text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">Bloqué</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2 w-full pt-2">
            <button onClick={() => setPostState('limited')} className="flex-1 py-2.5 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 transition-colors">
              Sim : Accès limité
            </button>
            <button onClick={() => setPostState('full')} className="flex-1 py-2.5 bg-emerald-500 text-white text-sm font-semibold rounded-xl hover:bg-emerald-600 transition-colors">
              Sim : Accès complet
            </button>
          </div>
        </div>
      );
    }

    if (effectiveState === 'limited') {
      return (
        <div className="flex flex-col items-center justify-center h-full px-6 text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-orange-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Accès limité</h2>
            <p className="text-sm text-slate-500 mt-2">Votre NIU fiscal est manquant. Complétez-le pour débloquer toutes les fonctionnalités.</p>
          </div>
          <div className="w-full bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
              <div className="text-left">
                <p className="text-sm font-medium text-orange-800">Action requise</p>
                <p className="text-xs text-orange-600 mt-1">Veuillez fournir votre NIU pour débloquer les virements et l'émission de carte.</p>
              </div>
            </div>
          </div>
          <button className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 hover:shadow-lg transition-all">
            <FileText className="w-5 h-5" /> Compléter le NIU fiscal
          </button>
          <button onClick={() => setPostState('full')} className="w-full py-2.5 bg-emerald-500 text-white text-sm font-semibold rounded-xl hover:bg-emerald-600 transition-colors">
            Sim : Approuvé → Accès complet
          </button>
        </div>
      );
    }

    if (effectiveState === 'full') {
      return (
        <div className="flex flex-col h-full bg-slate-50">
          {/* Banking Header */}
          <div className="bg-gradient-to-br from-[#1a3a6b] to-[#0d2247] px-5 pt-6 pb-16">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-blue-300 text-xs">Bonjour,</p>
                <p className="text-white font-bold text-base">Adjoua Cécile M.</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-white font-bold text-sm">AC</span>
              </div>
            </div>
            {/* Balance card */}
            <div className="text-center">
              <p className="text-blue-300 text-xs mb-1">Solde disponible</p>
              <p className="text-white text-4xl font-black tracking-tight">125 000 <span className="text-2xl text-blue-200">XAF</span></p>
              <p className="text-blue-400 text-xs mt-1">≈ 190,55 EUR</p>
            </div>
          </div>

          {/* Visa Card */}
          <div className="px-5 -mt-10 mb-4">
            <div className="relative">
              <svg viewBox="0 0 340 200" className="w-full rounded-2xl" style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.2))' }} xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="card-bg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#E37B03" />
                    <stop offset="100%" stopColor="#4A2205" />
                  </linearGradient>
                </defs>
                <rect width="340" height="200" fill="url(#card-bg)" rx="16" />
                {/* Shine circles */}
                <circle cx="280" cy="60" r="90" fill="white" opacity="0.06" />
                <circle cx="60" cy="160" r="70" fill="white" opacity="0.06" />
                {/* BICEC logo text */}
                <text x="24" y="44" fill="white" fontSize="18" fontWeight="900" fontFamily="Arial" opacity="0.9">BICEC</text>
                <text x="24" y="58" fill="white" fontSize="8" fontFamily="Arial" opacity="0.6">Banque Internationale du Cameroun</text>
                {/* Chip */}
                <rect x="24" y="72" width="42" height="32" fill="#d4a017" rx="5" />
                <rect x="30" y="78" width="30" height="20" fill="#c8951a" rx="3" />
                <line x1="38" y1="78" x2="38" y2="98" stroke="#d4a017" strokeWidth="1" />
                <line x1="46" y1="78" x2="46" y2="98" stroke="#d4a017" strokeWidth="1" />
                <line x1="30" y1="86" x2="60" y2="86" stroke="#d4a017" strokeWidth="1" />
                {/* WiFi symbol */}
                <path d="M82,82 Q90,74 98,82" fill="none" stroke="white" strokeWidth="2" opacity="0.7" />
                <path d="M85,87 Q90,82 95,87" fill="none" stroke="white" strokeWidth="2" opacity="0.7" />
                <circle cx="90" cy="93" r="2" fill="white" opacity="0.7" />
                {/* Card number */}
                <text x="24" y="142" fill="white" fontSize="14" fontFamily="monospace" letterSpacing="2" opacity="0.9">•••• •••• •••• 4521</text>
                {/* Name */}
                <text x="24" y="170" fill="white" fontSize="10" fontFamily="Arial" opacity="0.8">MBARGA ADJOUA CECILE</text>
                {/* Expiry */}
                <text x="24" y="184" fill="white" fontSize="9" fontFamily="Arial" opacity="0.6">Exp: 03/29</text>
                {/* VISA logo */}
                <text x="288" y="175" fill="white" fontSize="22" fontWeight="900" fontFamily="Arial" fontStyle="italic" opacity="0.9">VISA</text>
                {/* Verified badge */}
                <rect x="240" y="24" width="80" height="22" fill="rgba(16,185,129,0.3)" rx="11" />
                <text x="280" y="39" textAnchor="middle" fill="#34d399" fontSize="9" fontWeight="bold" fontFamily="Arial">✓ KYC Validé</text>
              </svg>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="px-5 mb-4">
            <div className="grid grid-cols-4 gap-2">
              {[
                { icon: Send, label: 'Virement', color: 'bg-blue-100 text-blue-700' },
                { icon: ArrowRight, label: 'Recharger', color: 'bg-emerald-100 text-emerald-700' },
                { icon: CardIcon, label: 'Ma Carte', color: 'bg-orange-100 text-orange-700' },
                { icon: Sparkles, label: 'Épargne', color: 'bg-purple-100 text-purple-700' },
              ].map(({ icon: Icon, label, color }) => (
                <button key={label} className="flex flex-col items-center gap-1.5">
                  <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center shadow-sm`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-medium text-slate-600">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Transactions */}
          <div className="px-5 flex-1 overflow-y-auto">
            <p className="text-xs font-semibold text-slate-500 mb-2">Dernières transactions</p>
            <div className="space-y-2">
              {[
                { label: 'Recharge Orange Money', amount: '+50 000', date: 'Hier', type: 'in', icon: '📱' },
                { label: 'Facture ENEO', amount: '-12 500', date: '20 févr.', type: 'out', icon: '⚡' },
                { label: 'Transfert Camtel', amount: '-5 000', date: '19 févr.', type: 'out', icon: '📟' },
                { label: 'Virement reçu', amount: '+200 000', date: '18 févr.', type: 'in', icon: '🏦' },
              ].map((tx) => (
                <div key={tx.label} className="flex items-center gap-3 bg-white rounded-xl p-3 shadow-sm">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-base shrink-0">{tx.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{tx.label}</p>
                    <p className="text-xs text-slate-400">{tx.date}</p>
                  </div>
                  <span className={`text-sm font-bold ${tx.type === 'in' ? 'text-emerald-600' : 'text-red-500'}`}>{tx.amount} XAF</span>
                </div>
              ))}
            </div>
          </div>

          {/* Demo restart */}
          <div className="px-5 py-3">
            <button onClick={() => { setPostState(null); setCurrentStepIdx(0); onComplete?.(); }}
              className="w-full py-2 border border-slate-300 text-slate-500 text-xs font-medium rounded-xl hover:bg-slate-50">
              ↺ Recommencer la démo
            </button>
          </div>
        </div>
      );
    }
    return null;
  };

  const renderStepContent = () => {
    if (!currentStep) return null;

    switch (currentStep.id) {
      case 'welcome':
        return (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center space-y-8">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}
              className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[#E37B03] to-[#4A2205] flex items-center justify-center shadow-2xl shadow-orange-200">
              <span className="text-3xl font-black text-white">BV</span>
            </motion.div>
            <div className="space-y-3">
              <h1 className="text-2xl font-bold text-slate-900">Bienvenue sur BICEC VeriPass</h1>
              <p className="text-slate-500 text-sm leading-relaxed max-w-[260px] mx-auto">
                Ouvrez votre compte en quelques minutes. Sécurisé, numérique, et toujours avec vous.
              </p>
            </div>
            <div className="space-y-2.5 w-full max-w-[260px]">
              {['🔒 Sécurité aux normes COBAC', '⚡ Prêt en 5 minutes', '📱 100% processus numérique'].map(t => (
                <div key={t} className="flex items-center gap-2 text-left text-sm text-slate-600 bg-slate-50 rounded-lg px-4 py-2.5">
                  {t}
                </div>
              ))}
            </div>
          </div>
        );

      case 'language':
        return (
          <div className="px-6 space-y-6">
            <div className="text-center space-y-2">
              <Globe className="w-12 h-12 text-[#E37B03] mx-auto" />
              <h2 className="text-xl font-bold text-slate-900">Choisir la langue</h2>
              <p className="text-sm text-slate-500">Sélectionnez votre langue préférée</p>
            </div>
            <div className="space-y-2.5">
              {LANGUAGES.map(l => (
                <button key={l.code} onClick={() => setSelectedLang(l.code)}
                  className={cn('w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border-2 transition-all',
                    selectedLang === l.code ? 'border-[#E37B03] bg-orange-50' : 'border-slate-200 hover:border-slate-300')}>
                  <span className="text-2xl">{l.flag}</span>
                  <span className={cn('font-medium', selectedLang === l.code ? 'text-orange-800' : 'text-slate-700')}>{l.label}</span>
                  {selectedLang === l.code && <Check className="w-5 h-5 text-[#E37B03] ml-auto" />}
                </button>
              ))}
            </div>
          </div>
        );

      case 'phone-otp':
        return (
          <div className="px-6 space-y-6">
            <div className="text-center space-y-2">
              <Smartphone className="w-12 h-12 text-[#E37B03] mx-auto" />
              <h2 className="text-xl font-bold text-slate-900">Vérification téléphone</h2>
              <p className="text-sm text-slate-500">Nous enverrons un code pour vérifier votre numéro</p>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Numéro de téléphone</label>
              <div className="flex mt-1.5">
                <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-slate-300 bg-slate-50 text-sm text-slate-500">+237</span>
                <input type="tel" placeholder="6 XX XX XX XX" defaultValue="6 74 12 34 56"
                  className="flex-1 px-3 py-2.5 border border-slate-300 rounded-r-xl text-sm focus:ring-2 focus:ring-[#E37B03] focus:border-[#E37B03] outline-none" />
              </div>
            </div>
            {!otpSent ? (
              <button onClick={() => setOtpSent(true)} className="w-full py-3 bg-[#E37B03] text-white font-semibold rounded-xl hover:bg-[#c96c02] transition-colors">
                Envoyer le code OTP
              </button>
            ) : (
              <div className="space-y-4">
                <label className="text-sm font-medium text-slate-700">Entrez le code à 6 chiffres</label>
                <div className="flex justify-center gap-2">
                  {otp.map((d, i) => (
                    <input key={i} type="text" maxLength={1} value={d}
                      onChange={e => { const newOtp = [...otp]; newOtp[i] = e.target.value; setOtp(newOtp); }}
                      className="w-10 h-12 text-center text-lg font-bold border-2 border-slate-300 rounded-lg focus:border-[#E37B03] focus:ring-2 focus:ring-orange-100 outline-none" />
                  ))}
                </div>
                <p className="text-xs text-slate-500 text-center">Pas reçu ? <button className="text-[#E37B03] font-medium">Renvoyer</button></p>
              </div>
            )}
          </div>
        );

      case 'email-verify':
        return (
          <div className="px-6 space-y-6">
            <div className="text-center space-y-2">
              <Mail className="w-12 h-12 text-[#E37B03] mx-auto" />
              <h2 className="text-xl font-bold text-slate-900">Vérification e-mail</h2>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Adresse e-mail</label>
              <input type="email" placeholder="votre@email.com" defaultValue="mbarga.adjoua@gmail.com"
                className="w-full mt-1.5 px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#E37B03] focus:border-[#E37B03] outline-none" />
            </div>
            <div className="bg-orange-50 rounded-xl p-4 flex items-start gap-3 border border-orange-100">
              <Mail className="w-5 h-5 text-[#E37B03] mt-0.5 shrink-0" />
              <p className="text-xs text-orange-800">Nous enverrons un lien de vérification. Cliquez dessus pour confirmer votre adresse e-mail.</p>
            </div>
          </div>
        );

      case 'pin-setup':
        return (
          <div className="px-6 space-y-6">
            <div className="text-center space-y-2">
              <Lock className="w-12 h-12 text-[#E37B03] mx-auto" />
              <h2 className="text-xl font-bold text-slate-900">{pinStep === 'create' ? 'Créer le code PIN' : 'Confirmer le code PIN'}</h2>
              <p className="text-sm text-slate-500">{pinStep === 'create' ? 'Choisissez un PIN à 6 chiffres' : 'Ressaisissez votre PIN pour confirmer'}</p>
            </div>
            <div className="flex justify-center gap-2.5">
              {(pinStep === 'create' ? pin : pinConfirm).map((d, i) => (
                <div key={i} className={cn('w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all',
                  d ? 'border-[#E37B03] bg-[#E37B03]' : 'border-slate-300')}>
                  {d && (showPin ? <span className="text-white font-bold text-sm">{d}</span> : <div className="w-3 h-3 rounded-full bg-white" />)}
                </div>
              ))}
            </div>
            <button onClick={() => setShowPin(!showPin)} className="mx-auto flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
              {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showPin ? 'Masquer' : 'Afficher'} PIN
            </button>
            <div className="grid grid-cols-3 gap-2 max-w-[220px] mx-auto">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, '⌫'].map((n, i) => (
                <button key={i} disabled={n === null}
                  onClick={() => {
                    const arr = pinStep === 'create' ? [...pin] : [...pinConfirm];
                    const setter = pinStep === 'create' ? setPin : setPinConfirm;
                    if (n === '⌫') {
                      const lastIdx = arr.lastIndexOf(arr.filter(Boolean).pop() ?? '');
                      if (lastIdx >= 0) arr[lastIdx] = '';
                      setter(arr);
                    } else if (typeof n === 'number') {
                      const emptyIdx = arr.indexOf('');
                      if (emptyIdx >= 0) {
                        arr[emptyIdx] = String(n);
                        setter(arr);
                        if (emptyIdx === 5 && pinStep === 'create') {
                          setTimeout(() => setPinStep('confirm'), 400);
                        }
                      }
                    }
                  }}
                  className={cn('h-12 rounded-xl text-lg font-semibold transition-all',
                    n === null ? 'invisible' : 'bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800')}>
                  {n === null ? '' : n}
                </button>
              ))}
            </div>
          </div>
        );

      case 'biometrics':
        return (
          <div className="px-6 space-y-6 flex flex-col items-center">
            <div className="text-center space-y-2">
              <div className="w-20 h-20 rounded-full bg-orange-50 flex items-center justify-center mx-auto border border-orange-100">
                <Fingerprint className="w-10 h-10 text-[#E37B03]" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Activer la biométrie</h2>
              <p className="text-sm text-slate-500 max-w-[240px]">Utilisez votre empreinte ou visage pour vous connecter rapidement</p>
            </div>
            <button className="w-full py-3 bg-[#E37B03] text-white font-semibold rounded-xl hover:bg-[#c96c02] transition-colors">
              Activer la biométrie
            </button>
            <button onClick={goNext} className="text-sm text-slate-500 hover:text-slate-700">
              Ignorer pour l'instant
            </button>
          </div>
        );

      case 'id-front':
      case 'id-back':
        return (
          <div className="px-6 space-y-4">
            <div className="text-center space-y-1">
              <CreditCard className="w-10 h-10 text-[#E37B03] mx-auto" />
              <h2 className="text-xl font-bold text-slate-900">
                CNI Biométrique — {currentStep.id === 'id-front' ? 'Recto' : 'Verso'}
              </h2>
              <p className="text-xs text-slate-500">
                {currentStep.id === 'id-back'
                  ? 'Placez le verso de votre CNI dans le cadre'
                  : 'Placez le recto de votre CNI dans le cadre'}
              </p>
            </div>

            {/* Realistic CNI SVG Preview */}
            <div className="relative rounded-2xl overflow-hidden border-2 border-slate-200 bg-slate-50">
              {/* Scan line animation */}
              <motion.div
                className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#E37B03] to-transparent z-20"
                style={{ boxShadow: '0 0 8px 2px rgba(227,123,3,0.5)' }}
                animate={{ top: ['8%', '90%', '8%'] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
              />
              {/* Corner guides */}
              <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-[#E37B03] rounded-tl z-10" />
              <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-[#E37B03] rounded-tr z-10" />
              <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-[#E37B03] rounded-bl z-10" />
              <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-[#E37B03] rounded-br z-10" />

              {currentStep.id === 'id-front' ? (
                /* CNI Recto SVG */
                <svg viewBox="0 0 320 200" className="w-full" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="cni-bg" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#1a3a6b" />
                      <stop offset="100%" stopColor="#0d2247" />
                    </linearGradient>
                    <linearGradient id="stripe" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" />
                      <stop offset="100%" stopColor="#16a34a" />
                    </linearGradient>
                  </defs>
                  <rect width="320" height="200" fill="url(#cni-bg)" rx="8" />
                  {/* Green stripe top */}
                  <rect x="0" y="0" width="320" height="18" fill="url(#stripe)" rx="8" />
                  <rect x="0" y="10" width="320" height="8" fill="url(#stripe)" />
                  {/* Red stripe bottom */}
                  <rect x="0" y="182" width="320" height="18" fill="#dc2626" rx="0" />
                  <rect x="0" y="182" width="320" height="8" fill="#dc2626" />
                  {/* Country header */}
                  <text x="160" y="14" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold" fontFamily="Arial">RÉPUBLIQUE DU CAMEROUN / REPUBLIC OF CAMEROON</text>
                  {/* Title */}
                  <text x="160" y="32" textAnchor="middle" fill="#fcd34d" fontSize="10" fontWeight="bold" fontFamily="Arial">CARTE NATIONALE D'IDENTITÉ</text>
                  <text x="160" y="43" textAnchor="middle" fill="#fcd34d" fontSize="8" fontFamily="Arial">BIOMÉTRIQUE / BIOMETRIC NATIONAL IDENTITY CARD</text>
                  {/* Photo placeholder */}
                  <rect x="14" y="52" width="72" height="90" fill="#2d5a9e" rx="4" />
                  <rect x="16" y="54" width="68" height="86" fill="#1e3f6e" rx="3" />
                  <circle cx="50" cy="82" r="18" fill="#4a7ab5" />
                  <ellipse cx="50" cy="108" rx="22" ry="14" fill="#4a7ab5" />
                  <text x="50" y="138" textAnchor="middle" fill="#93c5fd" fontSize="6" fontFamily="Arial">PHOTO</text>
                  {/* MRZ strip at bottom of photo area */}
                  <rect x="14" y="148" width="72" height="12" fill="#0f1f3d" rx="2" />
                  <text x="50" y="157" textAnchor="middle" fill="#60a5fa" fontSize="4.5" fontFamily="monospace">MBARGA&lt;&lt;ADJOUA</text>
                  {/* Fields */}
                  <text x="100" y="62" fill="#93c5fd" fontSize="6" fontFamily="Arial">NOM / SURNAME</text>
                  <text x="100" y="72" fill="white" fontSize="9" fontWeight="bold" fontFamily="Arial">MBARGA</text>
                  <text x="100" y="86" fill="#93c5fd" fontSize="6" fontFamily="Arial">PRÉNOM / GIVEN NAMES</text>
                  <text x="100" y="96" fill="white" fontSize="8" fontWeight="bold" fontFamily="Arial">Adjoua Cécile</text>
                  <text x="100" y="110" fill="#93c5fd" fontSize="6" fontFamily="Arial">DATE DE NAISSANCE / DATE OF BIRTH</text>
                  <text x="100" y="120" fill="white" fontSize="8" fontFamily="Arial">14/06/1992</text>
                  <text x="100" y="133" fill="#93c5fd" fontSize="6" fontFamily="Arial">LIEU / PLACE OF BIRTH</text>
                  <text x="100" y="143" fill="white" fontSize="8" fontFamily="Arial">YAOUNDÉ</text>
                  <text x="210" y="62" fill="#93c5fd" fontSize="6" fontFamily="Arial">NATIONALITÉ</text>
                  <text x="210" y="72" fill="white" fontSize="8" fontFamily="Arial">CAMEROUNAISE</text>
                  <text x="210" y="86" fill="#93c5fd" fontSize="6" fontFamily="Arial">SEXE / SEX</text>
                  <text x="210" y="96" fill="white" fontSize="8" fontFamily="Arial">F</text>
                  <text x="230" y="86" fill="#93c5fd" fontSize="6" fontFamily="Arial">TAILLE</text>
                  <text x="230" y="96" fill="white" fontSize="8" fontFamily="Arial">1m65</text>
                  <text x="210" y="110" fill="#93c5fd" fontSize="6" fontFamily="Arial">EXPIRATION</text>
                  <text x="210" y="120" fill="#fcd34d" fontSize="8" fontFamily="Arial">14/06/2033</text>
                  {/* Coat of arms placeholder */}
                  <circle cx="290" cy="40" r="14" fill="#2d5a9e" stroke="#4a7ab5" strokeWidth="1" />
                  <text x="290" y="44" textAnchor="middle" fill="#fcd34d" fontSize="9">🦁</text>
                  {/* MRZ bottom */}
                  <rect x="0" y="162" width="320" height="20" fill="#0a1a3a" />
                  <text x="10" y="172" fill="#60a5fa" fontSize="5" fontFamily="monospace">IDCMRMBARGA&lt;&lt;ADJOUA&lt;CECILE&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</text>
                  <text x="10" y="180" fill="#60a5fa" fontSize="5" fontFamily="monospace">YA0120090012345&lt;5&lt;9206148F3306144CMR&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;4</text>
                </svg>
              ) : (
                /* CNI Verso SVG */
                <svg viewBox="0 0 320 200" className="w-full" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="cni-bg2" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#1a3a6b" />
                      <stop offset="100%" stopColor="#0d2247" />
                    </linearGradient>
                  </defs>
                  <rect width="320" height="200" fill="url(#cni-bg2)" rx="8" />
                  <rect x="0" y="0" width="320" height="18" fill="#16a34a" rx="8" />
                  <rect x="0" y="10" width="320" height="8" fill="#16a34a" />
                  <rect x="0" y="182" width="320" height="18" fill="#dc2626" />
                  <text x="160" y="14" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold" fontFamily="Arial">REPÚBLICA DEL CAMERÚN / جمهورية الكاميرون</text>
                  {/* N° National */}
                  <text x="16" y="36" fill="#93c5fd" fontSize="7" fontFamily="Arial">N° NATIONAL / NATIONAL ID NO.</text>
                  <rect x="14" y="40" width="200" height="18" fill="#0f1f3d" rx="3" />
                  <text x="18" y="53" fill="#fcd34d" fontSize="10" fontWeight="bold" fontFamily="monospace">YA01 2009 0012345678901</text>
                  {/* Fingerprint area */}
                  <rect x="240" y="35" width="65" height="65" fill="#0f1f3d" rx="4" />
                  <text x="272" y="58" textAnchor="middle" fill="#60a5fa" fontSize="7" fontFamily="Arial">EMPREINTE</text>
                  {/* Concentric arcs simulating fingerprint */}
                  {[8, 14, 20, 26, 32].map((r, i) => (
                    <ellipse key={i} cx="272" cy="75" rx={r} ry={r * 0.8} fill="none" stroke="#60a5fa" strokeWidth="0.8" opacity="0.7" />
                  ))}
                  {/* Address */}
                  <text x="16" y="78" fill="#93c5fd" fontSize="6" fontFamily="Arial">ADRESSE / ADDRESS</text>
                  <text x="16" y="88" fill="white" fontSize="7.5" fontFamily="Arial">Avenue Jean Paul II, Bastos</text>
                  <text x="16" y="98" fill="white" fontSize="7.5" fontFamily="Arial">YAOUNDÉ I — CENTRE</text>
                  {/* Délivrance */}
                  <text x="16" y="114" fill="#93c5fd" fontSize="6" fontFamily="Arial">DÉLIVRÉE LE / ISSUED</text>
                  <text x="16" y="124" fill="white" fontSize="7.5" fontFamily="Arial">14/06/2023  à YAOUNDÉ</text>
                  {/* Signature line */}
                  <text x="16" y="142" fill="#93c5fd" fontSize="6" fontFamily="Arial">SIGNATURE DU TITULAIRE</text>
                  <path d="M16,158 Q40,140 70,155 T110,150 Q130,145 150,152" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                  {/* Chip */}
                  <rect x="240" y="115" width="50" height="38" fill="#d4a017" rx="4" />
                  <rect x="246" y="121" width="38" height="26" fill="#c8951a" rx="2" />
                  <line x1="258" y1="121" x2="258" y2="147" stroke="#d4a017" strokeWidth="0.8" />
                  <line x1="270" y1="121" x2="270" y2="147" stroke="#d4a017" strokeWidth="0.8" />
                  <line x1="246" y1="131" x2="284" y2="131" stroke="#d4a017" strokeWidth="0.8" />
                  <line x1="246" y1="138" x2="284" y2="138" stroke="#d4a017" strokeWidth="0.8" />
                  <text x="265" y="165" textAnchor="middle" fill="#93c5fd" fontSize="5.5" fontFamily="Arial">PUCE / CHIP</text>
                  {/* MRZ */}
                  <rect x="0" y="162" width="320" height="20" fill="#0a1a3a" />
                  <text x="10" y="172" fill="#60a5fa" fontSize="5" fontFamily="monospace">YA0120090012345678901CMR9206148F3306144&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</text>
                </svg>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Bonne lumière requise · Évitez les reflets et les ombres
            </div>

            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 text-xs text-orange-800 bg-orange-50 border border-orange-200 px-3 py-2 rounded-lg">
                <Check className="w-3.5 h-3.5 text-[#E37B03] shrink-0" /> CNI Biométrique
              </div>
              <button onClick={goNext}
                className="flex-1 py-2.5 bg-gradient-to-r from-[#E37B03] to-[#4A2205] text-white font-semibold rounded-xl flex items-center justify-center gap-2 text-sm">
                <Camera className="w-4 h-4" /> Capturer
              </button>
            </div>
          </div>
        );

      case 'ocr-review':
        return (
          <div className="px-6 space-y-4">
            <div className="text-center space-y-1">
              <ScanLine className="w-10 h-10 text-[#E37B03] mx-auto" />
              <h2 className="text-xl font-bold text-slate-900">Données extraites par IA</h2>
              <p className="text-xs text-slate-500">Vérifiez et corrigez si nécessaire</p>
            </div>

            {/* CNI Thumbnail + Engine badge */}
            <div className="relative rounded-xl overflow-hidden border border-slate-200">
              <svg viewBox="0 0 320 80" className="w-full" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="ocr-bg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#1a3a6b" />
                    <stop offset="100%" stopColor="#0d2247" />
                  </linearGradient>
                </defs>
                <rect width="320" height="80" fill="url(#ocr-bg)" />
                <rect x="0" y="0" width="320" height="7" fill="#16a34a" />
                <rect x="0" y="73" width="320" height="7" fill="#dc2626" />
                {/* Photo placeholder */}
                <rect x="8" y="12" width="36" height="50" fill="#2d5a9e" rx="2" />
                <circle cx="26" cy="30" r="9" fill="#4a7ab5" />
                <ellipse cx="26" cy="50" rx="12" ry="8" fill="#4a7ab5" />
                {/* Field highlights */}
                <rect x="52" y="14" width="80" height="6" fill="#0f1f3d" rx="2" opacity="0.8" />
                <rect x="52" y="24" width="60" height="6" fill="#0f1f3d" rx="2" opacity="0.8" />
                <rect x="52" y="34" width="70" height="6" fill="#0f1f3d" rx="2" opacity="0.8" />
                <rect x="52" y="44" width="55" height="6" fill="#0f1f3d" rx="2" opacity="0.8" />
                <text x="56" y="20" fill="#fcd34d" fontSize="5" fontWeight="bold" fontFamily="monospace">MBARGA Adjoua Cécile</text>
                <text x="56" y="30" fill="white" fontSize="4.5" fontFamily="monospace">née le 14/06/1992</text>
                <text x="56" y="40" fill="white" fontSize="4.5" fontFamily="monospace">YA01 2009 0012345678901</text>
                <text x="56" y="50" fill="#60a5fa" fontSize="4.5" fontFamily="monospace">exp. 14/06/2033</text>
                {/* OCR scan lines */}
                <line x1="0" y1="20" x2="320" y2="20" stroke="rgba(227,123,3,0.15)" strokeWidth="0.5" />
                <line x1="0" y1="32" x2="320" y2="32" stroke="rgba(227,123,3,0.15)" strokeWidth="0.5" />
                <line x1="0" y1="44" x2="320" y2="44" stroke="rgba(227,123,3,0.15)" strokeWidth="0.5" />
                <line x1="0" y1="56" x2="320" y2="56" stroke="rgba(227,123,3,0.15)" strokeWidth="0.5" />
                {/* Engine badge */}
                <rect x="230" y="14" width="80" height="22" fill="#0f1f3d" rx="4" />
                <text x="270" y="22" textAnchor="middle" fill="#E37B03" fontSize="5" fontWeight="bold" fontFamily="monospace">PaddleOCR v5</text>
                <text x="270" y="30" textAnchor="middle" fill={scenario.ocrConfidenceLow ? "#ef4444" : "#10b981"} fontSize="4.5" fontFamily="monospace">
                  {scenario.ocrConfidenceLow ? '⚠️ Confiance 43.2%' : '✓ Confiance 93.6%'}
                </text>
              </svg>
              <div className="absolute top-2 right-2 flex items-center gap-1 bg-emerald-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                <Check className="w-2.5 h-2.5" /> OCR OK
              </div>
            </div>

            {/* Fields */}
            <div className="space-y-2">
              {ocrFields.map(f => {
                const conf = scenario.ocrConfidenceLow ? Math.floor(f.confidence / 2.2) : f.confidence;
                const isLow = conf < 85;
                return (
                  <div key={f.key} className={cn("bg-white rounded-xl border p-3 transition-colors", isLow && !f.edited ? "border-red-200 bg-red-50" : "border-slate-200")}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-500">{f.label}</span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={cn('h-full rounded-full', conf >= 90 ? 'bg-emerald-500' : conf >= 70 ? 'bg-amber-500' : 'bg-red-500')}
                            style={{ width: `${conf}%` }} />
                        </div>
                        <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded-full', confidenceColor(conf))}>
                          {conf}%
                        </span>
                      </div>
                    </div>
                    {editingField === f.key ? (
                      <div className="flex gap-2">
                        <input type="text" defaultValue={f.value}
                          onBlur={(e) => {
                            setOcrFields(prev => prev.map(fld => fld.key === f.key ? { ...fld, value: e.target.value, edited: true } : fld));
                            setEditingField(null);
                          }}
                          className="flex-1 px-2 py-1 border border-orange-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-200 outline-none"
                          autoFocus />
                        <button onClick={() => setEditingField(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className={cn('text-sm font-medium', f.edited ? 'text-orange-800' : 'text-slate-900')}>
                          {f.value} {f.edited && <span className="text-xs text-orange-500">(corrigé)</span>}
                        </span>
                        <button onClick={() => setEditingField(f.key)} className="text-slate-400 hover:text-orange-600">
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {isLow && !f.edited && <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Merci de vérifier cette valeur attentivement.</p>}
                  </div>
                )
              })}
            </div>
          </div>
        );

      case 'liveness':
        return (
          <div className="px-6 space-y-5">
            <div className="text-center space-y-1">
              <Camera className="w-10 h-10 text-[#E37B03] mx-auto" />
              <h2 className="text-xl font-bold text-slate-900">Détection de vivacité</h2>
              <p className="text-xs text-slate-500">
                {livenessState === 'idle' ? 'Regardez la caméra et suivez les instructions' :
                  livenessState === 'scanning' ? '✨ Analyse en cours...' :
                    livenessState === 'success' ? '✓ Vivacité confirmée' :
                      livenessState === 'failed' ? 'Essai échoué — réessayez' : '⛔ Trop de tentatives'}
              </p>
            </div>

            {/* Face illustration */}
            <div className="relative w-52 h-52 mx-auto">
              <div className={cn('w-full h-full rounded-full border-4 flex items-center justify-center overflow-hidden',
                livenessState === 'scanning' ? 'border-[#E37B03]' :
                  livenessState === 'success' ? 'border-emerald-500' :
                    livenessState === 'failed' ? 'border-red-400' :
                      livenessState === 'Bloqué' ? 'border-red-500' : 'border-slate-200')}>
                {/* SVG Face */}
                <svg viewBox="0 0 200 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                  {/* Background */}
                  <rect width="200" height="200" fill={livenessState === 'success' ? '#f0fdf4' : livenessState === 'failed' || livenessState === 'Bloqué' ? '#fef2f2' : '#f8fafc'} />
                  {/* Face oval */}
                  <ellipse cx="100" cy="95" rx="52" ry="62" fill={livenessState === 'success' ? '#dcfce7' : '#e0f2fe'}
                    stroke={livenessState === 'success' ? '#22c55e' : livenessState === 'scanning' ? '#E37B03' : '#94a3b8'} strokeWidth="2" />
                  {/* Eyes */}
                  <ellipse cx="82" cy="82" rx="8" ry="9" fill="white" stroke="#475569" strokeWidth="1.5" />
                  <ellipse cx="118" cy="82" rx="8" ry="9" fill="white" stroke="#475569" strokeWidth="1.5" />
                  <circle cx="82" cy="83" r="4.5" fill="#1e293b" />
                  <circle cx="118" cy="83" r="4.5" fill="#1e293b" />
                  <circle cx="84" cy="81" r="1.5" fill="white" />
                  <circle cx="120" cy="81" r="1.5" fill="white" />
                  {/* Nose */}
                  <path d="M97,95 Q100,105 103,95" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                  {/* Mouth */}
                  {livenessState === 'success' ? (
                    <path d="M88,116 Q100,126 112,116" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" />
                  ) : livenessState === 'failed' || livenessState === 'Bloqué' ? (
                    <path d="M88,120 Q100,112 112,120" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
                  ) : (
                    <path d="M88,116 Q100,122 112,116" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
                  )}
                  {/* Eyebrows */}
                  <path d="M75,70 Q82,66 89,70" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
                  <path d="M111,70 Q118,66 125,70" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
                  {/* Hair */}
                  <path d="M48,85 Q50,35 100,32 Q150,35 152,85" fill="#4a5568" />
                  {/* Ear */}
                  <ellipse cx="47" cy="98" rx="5" ry="9" fill="#fed7aa" stroke="#f97316" strokeWidth="0.5" />
                  <ellipse cx="153" cy="98" rx="5" ry="9" fill="#fed7aa" stroke="#f97316" strokeWidth="0.5" />
                  {/* Neck */}
                  <rect x="88" y="155" width="24" height="18" fill="#e0f2fe" rx="4" />
                  {/* Shoulders */}
                  <path d="M40,185 Q60,165 88,160 L112,160 Q140,165 160,185" fill="#3b82f6" stroke="none" />
                  {/* Success checkmark overlay */}
                  {livenessState === 'success' && (
                    <circle cx="155" cy="40" r="18" fill="#22c55e" />
                  )}
                  {livenessState === 'success' && (
                    <path d="M145,40 L153,48 L165,32" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  )}
                  {/* Scan points */}
                  {livenessState === 'scanning' && [
                    [82, 82], [118, 82], [100, 100], [88, 116], [112, 116], [100, 60]
                  ].map(([x, y], i) => (
                    <circle key={i} cx={x} cy={y} r="3" fill="#E37B03" opacity="0.8" />
                  ))}
                </svg>
              </div>
              {/* Scanning ring */}
              {livenessState === 'scanning' && (
                <motion.div className="absolute inset-0 rounded-full border-4 border-t-[#E37B03] border-r-transparent border-b-transparent border-l-transparent"
                  animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }} />
              )}
              {/* Dot indicators */}
              {livenessState === 'idle' && [
                { angle: 0, label: 'Haut' }, { angle: 90, label: 'Droite' }, { angle: 180, label: 'Bas' }, { angle: 270, label: 'Gauche' }
              ].map((dir) => null)}
            </div>

            {/* Instructions */}
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              {livenessState === 'idle' && (
                <p className="text-xs text-slate-600">👁️ Restez immobile · Éclairage naturel requis · 3 tentatives max
                </p>
              )}
              {livenessState === 'scanning' && (
                <p className="text-xs text-[#E37B03] font-semibold animate-pulse">Analyse de 478 points de repère faciaux...</p>
              )}
              {livenessState === 'success' && (
                <div className="space-y-1">
                  <p className="text-sm font-bold text-emerald-700">✓ Vivacité vérifiée avec succès</p>
                  <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
                    <span>Score vivacité : <strong className="text-emerald-600">98.4%</strong></span>
                    <span>Correspondance : <strong className="text-emerald-600">96.1%</strong></span>
                  </div>
                  <p className="text-[10px] text-slate-400">Moteur : MiniFASNet v2 · MediaPipe 478 pts</p>
                </div>
              )}
            </div>

            <div className="text-center text-xs text-slate-400">
              Tentatives : {livenessAttempts}/3
              {livenessState === 'Bloqué' && <p className="text-red-600 font-medium mt-1">Nombre maximum atteint. Passez en agence.</p>}
            </div>

            {livenessState === 'idle' && (
              <button onClick={() => {
                setLivenessState('scanning');
                setTimeout(() => {
                  const success = Math.random() > 0.3;
                  if (success) {
                    setLivenessState('success');
                  } else {
                    setLivenessAttempts(prev => {
                      const next = prev + 1;
                      if (next >= 3) setLivenessState('Bloqué');
                      else setLivenessState('failed');
                      return next;
                    });
                  }
                }, 2500);
              }} className="w-full py-3 bg-gradient-to-r from-[#E37B03] to-[#4A2205] text-white font-semibold rounded-xl">
                Lancer la vérification de vivacité
              </button>
            )}
            {livenessState === 'failed' && (
              <button onClick={() => setLivenessState('idle')} className="w-full py-3 bg-amber-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2">
                <RotateCcw className="w-5 h-5" /> Réessayer
              </button>
            )}
          </div>
        );

      case 'address':
        return (
          <div className="px-6 space-y-4">
            <div className="text-center space-y-2">
              <MapPin className="w-12 h-12 text-[#E37B03] mx-auto" />
              <h2 className="text-xl font-bold text-slate-900">Votre Adresse</h2>
              <p className="text-sm text-slate-500">Sélectionnez votre localisation</p>
            </div>

            <div className="space-y-3">
              {/* Région */}
              <div>
                <label className="text-sm font-medium text-slate-700">Région</label>
                <select
                  value={selectedAddress.region}
                  onChange={e => setSelectedAddress({ region: e.target.value, city: '', quartier: '', commune: '' })}
                  className="w-full mt-1 px-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-[#E37B03] outline-none">
                  <option value="">Sélectionner la région...</option>
                  {REGION_NAMES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {/* Ville */}
              <div>
                <label className="text-sm font-medium text-slate-700">Ville</label>
                <select
                  value={selectedAddress.city}
                  onChange={e => setSelectedAddress(p => ({ ...p, city: e.target.value, quartier: '', commune: '' }))}
                  disabled={!selectedAddress.region}
                  className="w-full mt-1 px-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white disabled:bg-slate-100 focus:ring-2 focus:ring-[#E37B03] outline-none">
                  <option value="">Sélectionner la ville...</option>
                  {selectedAddress.region && REGIONS[selectedAddress.region] &&
                    Object.keys(REGIONS[selectedAddress.region].villes).map(v =>
                      <option key={v} value={v}>{v}</option>)}
                </select>
              </div>

              {/* Quartier — auto-remplit la commune */}
              <div>
                <label className="text-sm font-medium text-slate-700">Quartier</label>
                <select
                  value={selectedAddress.quartier}
                  onChange={e => {
                    const qName = e.target.value;
                    const quartierData = REGIONS[selectedAddress.region]?.villes[selectedAddress.city]?.quartiers
                      .find((q: QuartierEntry) => q.name === qName);
                    setSelectedAddress(p => ({ ...p, quartier: qName, commune: quartierData?.commune ?? '' }));
                  }}
                  disabled={!selectedAddress.city}
                  className="w-full mt-1 px-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white disabled:bg-slate-100 focus:ring-2 focus:ring-[#E37B03] outline-none">
                  <option value="">Sélectionner le quartier...</option>
                  {selectedAddress.city && REGIONS[selectedAddress.region]?.villes[selectedAddress.city]?.quartiers
                    .map((q: QuartierEntry) => <option key={q.name} value={q.name}>{q.name}</option>)}
                </select>
              </div>

              {/* Commune — auto-remplie, read-only */}
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Commune
                  <span className="ml-1.5 text-xs text-slate-400 font-normal">(auto-remplie)</span>
                </label>
                <div className={cn(
                  'w-full mt-1 px-3 py-2.5 border rounded-xl text-sm',
                  selectedAddress.commune
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-800 font-medium'
                    : 'border-slate-200 bg-slate-50 text-slate-400 italic'
                )}>
                  {selectedAddress.commune || 'Choisis un quartier pour auto-remplir'}
                </div>
              </div>

              {/* Rue */}
              <div>
                <label className="text-sm font-medium text-slate-700">Rue / Point de repère</label>
                <input type="text" placeholder="Avenue Jean Paul II, face Hilton"
                  className="w-full mt-1 px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#E37B03] outline-none" />
              </div>

              {/* GPS domicile */}
              <div>
                <label className="text-sm font-medium text-slate-700">
                  GPS Domicile
                  <span className="ml-1.5 text-xs text-slate-400 font-normal">(optionnel)</span>
                </label>
                <button
                  onClick={() => { if (!gpsAssist) setShowGpsModal(true); }}
                  className={cn(
                    'w-full mt-1 py-2.5 rounded-xl border-2 flex items-center justify-center gap-2 text-sm font-medium transition-all',
                    gpsAssist
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-slate-300 text-slate-600 hover:border-[#E37B03]'
                  )}>
                  <MapPin className="w-4 h-4" />
                  {gpsAssist ? '✓ Localisation GPS détectée (3.862 N, 11.520 E)' : 'Détecter ma position GPS'}
                </button>
              </div>
            </div>

            {/* GPS Privacy Modal */}
            {showGpsModal && (
              <div className="absolute inset-0 bg-black/60 z-50 flex items-end px-4 pb-6 rounded-[44px] overflow-hidden" onClick={() => setShowGpsModal(false)}>
                <div className="bg-white rounded-2xl w-full p-5 space-y-4" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                      <MapPin className="w-5 h-5 text-[#E37B03]" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">Localisation GPS de votre domicile</h3>
                      <p className="text-xs text-slate-500">Utilisation de votre position</p>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-xl px-3 py-3 text-xs text-slate-700 leading-relaxed space-y-2">
                    <p><strong>Pourquoi ?</strong> Nous enregistrons les coordonnées GPS de votre domicile pour <strong>vérifier la cohérence de votre adresse déclarée</strong> et satisfaire aux exigences réglementaires KYC de la COBAC.</p>
                    <p><strong>Quand ?</strong> La position est captée <strong>maintenant, une seule fois</strong>, au moment où vous cliquez sur « Accepter ».</p>
                    <p><strong>Sécurité :</strong> Les coordonnées sont <strong>chiffrées, jamais partagées</strong> avec des tiers et conservées conformément au cadre légal camerounais.</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowGpsModal(false)}
                      className="flex-1 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-600">
                      Annuler
                    </button>
                    <button onClick={() => { setGpsAssist(true); setShowGpsModal(false); }}
                      className="flex-1 py-2.5 bg-blue-600 rounded-xl text-sm font-semibold text-white">
                      Accepter
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'address-proof':
        return (
          <div className="px-6 space-y-6">
            <div className="text-center space-y-2">
              <FileCheck className="w-12 h-12 text-[#E37B03] mx-auto" />
              <h2 className="text-xl font-bold text-slate-900">Justificatif de Domicile</h2>
              <p className="text-sm text-slate-500">Uploadez une facture récente (‹ 3 mois)</p>
            </div>
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:border-blue-400 transition-colors cursor-pointer">
              <Upload className="w-8 h-8 text-slate-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-600">Appuyer pour télécharger ou photographier</p>
              <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG · Max 10 Mo</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500">Documents acceptés :</p>
              {['Facture ENEO (électricité, ‹ 3 mois)', 'Facture CAMWATER (eau, ‹ 3 mois)'].map(d => (
                <div key={d} className="flex items-center gap-2 text-xs text-slate-600">
                  <Check className="w-3.5 h-3.5 text-emerald-500" /> {d}
                </div>
              ))}
            </div>
          </div>
        );

      case 'fiscal-id':
        return (
          <div className="px-6 space-y-4">
            <div className="text-center space-y-1">
              <FileText className="w-10 h-10 text-blue-600 mx-auto" />
              <h2 className="text-xl font-bold text-slate-900">NIU — Attestation Fiscale</h2>
              <p className="text-xs text-slate-500">Numéro d'Identifiant Unique fiscal · DGI Cameroun</p>
            </div>

            {/* Info banner */}
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5 text-xs text-orange-800 leading-relaxed">
              📋 Le NIU est délivré par la <strong>DGI (Direction Générale des Impôts)</strong> — c'est un <strong>identifiant alphanumérique</strong> (ex : <span className="font-mono">P047217105784Y</span>) figurant sur votre <strong>attestation d'immatriculation fiscale</strong> (Harmony / impots.cm). <u>Il ne se trouve pas sur la CNI.</u>
            </div>

            {/* Mode selector */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Comment souhaitez-vous fournir votre NIU ?</p>
              <div className="grid grid-cols-3 gap-2">
                {/* Scan — disabled (future) */}
                <button disabled
                  className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border-2 border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed">
                  <ScanLine className="w-5 h-5 text-slate-400" />
                  <span className="text-[10px] font-medium text-slate-400 text-center leading-tight">Scanner<br />(bientôt)</span>
                </button>
                {/* Upload photo */}
                <button
                  onClick={() => { setNiuEntryMode('upload'); setNiuUploaded(false); }}
                  className={cn(
                    'flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border-2 transition-all',
                    niuEntryMode === 'upload'
                      ? 'border-[#E37B03] bg-orange-50'
                      : 'border-slate-200 hover:border-slate-300'
                  )}>
                  <Upload className="w-5 h-5 text-[#E37B03]" />
                  <span className="text-[10px] font-medium text-slate-700 text-center leading-tight">Photo /<br />Upload</span>
                </button>
                {/* Saisie manuelle */}
                <button
                  onClick={() => setNiuEntryMode('manual')}
                  className={cn(
                    'flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border-2 transition-all',
                    niuEntryMode === 'manual'
                      ? 'border-[#E37B03] bg-orange-50'
                      : 'border-slate-200 hover:border-slate-300'
                  )}>
                  <Edit3 className="w-5 h-5 text-[#E37B03]" />
                  <span className="text-[10px] font-medium text-slate-700 text-center leading-tight">Saisie<br />manuelle</span>
                </button>
              </div>
            </div>

            {/* Upload panel */}
            {niuEntryMode === 'upload' && (
              <div className="space-y-3">
                <div
                  onClick={() => { setNiuUploaded(true); setFiscalType('niu'); }}
                  className={cn(
                    'border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors',
                    niuUploaded ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 hover:border-blue-400'
                  )}>
                  {niuUploaded ? (
                    <>
                      <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                      <p className="text-sm font-medium text-emerald-700">Attestation fiscale reçue</p>
                      <p className="text-xs text-emerald-600 mt-0.5">NIU extrait automatiquement</p>
                    </>
                  ) : (
                    <>
                      <Camera className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm font-medium text-slate-600">Importer l'attestation d'immatriculation DGI</p>
                      <p className="text-xs text-slate-400 mt-0.5">Disponible sur impots.cm · PDF · JPG · Max 10 Mo</p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Manual entry panel */}
            {niuEntryMode === 'manual' && (
              <div className="space-y-2">
                {/* LIMITED_ACCESS notice */}
                <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5">
                  <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-orange-700 leading-relaxed">
                    <strong>Accès limité :</strong> sans NIU validé, certaines fonctionnalités (crypto, investissements, épargne) restent bloquées jusqu'à validation en agence.
                  </p>
                </div>
                <label className="text-sm font-medium text-slate-700">NIU (ex : P047217105784Y)</label>
                <input
                  type="text"
                  autoCapitalize="characters"
                  maxLength={14}
                  value={niuValue}
                  onChange={e => { setNiuValue(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase()); setFiscalType('niu'); }}
                  placeholder="P047217105784Y"
                  className={cn(
                    'w-full px-3 py-2.5 border rounded-xl text-sm font-mono focus:ring-2 outline-none transition-colors tracking-widest',
                    niuValue.length === 14 && validateNIU(niuValue)
                      ? 'border-emerald-500 focus:ring-emerald-300 bg-emerald-50'
                      : niuValue.length > 0
                        ? 'border-amber-400 focus:ring-amber-300'
                        : 'border-slate-300 focus:ring-blue-500'
                  )}
                />
                {niuValue.length > 0 && (
                  <p className={cn('text-xs', niuValue.length === 14 && validateNIU(niuValue) ? 'text-emerald-600' : 'text-amber-600')}>
                    {niuValue.length === 14 && validateNIU(niuValue)
                      ? '✓ Format NIU DGI valide'
                      : `Format attendu : 1 letter + 12 chiffres + 1 letter (ex : P047217105784Y)`}
                  </p>
                )}
              </div>
            )}

            <button onClick={goNext} className="text-xs text-slate-400 hover:text-slate-600 mx-auto block pt-1">
              Ignorer — accès limité sans NIU
            </button>
          </div>
        );

      case 'consent':
        return (
          <div className="px-6 space-y-5">
            <div className="text-center space-y-2">
              <ShieldCheck className="w-12 h-12 text-[#E37B03] mx-auto" />
              <h2 className="text-xl font-bold text-slate-900">Accords & Consentements</h2>
            </div>
            <div className="space-y-3">
              {[
                { key: 'terms' as const, label: "J'accepte les Conditions Générales", desc: "Incluant la convention de compte et la grille tarifaire" },
                { key: 'privacy' as const, label: "J'accepte la Politique de Confidentialité", desc: "Gestion et protection de vos données personnelles" },
                { key: 'data' as const, label: "Je consens au traitement des données", desc: "Pour la vérification d'identité et la conformité KYC" },
              ].map(c => (
                <button key={c.key} onClick={() => setConsentChecks(prev => ({ ...prev, [c.key]: !prev[c.key] }))}
                  className={cn('w-full flex items-start gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all',
                    consentChecks[c.key] ? 'border-blue-600 bg-blue-50' : 'border-slate-200')}>
                  <div className={cn('w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center shrink-0 transition-all',
                    consentChecks[c.key] ? 'border-[#E37B03] bg-[#E37B03]' : 'border-slate-300')}>
                    {consentChecks[c.key] && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{c.label}</p>
                    <p className="text-xs text-slate-500">{c.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 'signature':
        return (
          <div className="px-6 space-y-5">
            <div className="text-center space-y-2">
              <PenTool className="w-12 h-12 text-[#E37B03] mx-auto" />
              <h2 className="text-xl font-bold text-slate-900">Signature Digitale</h2>
              <p className="text-sm text-slate-500">Autorisez numériquement la création de votre compte</p>
            </div>
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-2xl p-6 border-2 border-slate-200 space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed italic">
                  « En cochant cette case, je reconnais que ma signature numérique a la même valeur juridique qu'une signature manuscrite pour la soumission sécurisée de ce dossier KYC à la BICEC. »
                </p>

                <button onClick={() => {
                  const newState = !consentChecks.signature;
                  setConsentChecks(prev => ({ ...prev, signature: newState }));
                  setHasSigned(newState);
                }}
                  className={cn('w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all',
                    consentChecks.signature ? 'border-[#E37B03] bg-orange-50' : 'border-slate-200 bg-white')}>
                  <div className={cn('w-6 h-6 mt-0.5 rounded border-2 flex items-center justify-center shrink-0 transition-all',
                    consentChecks.signature ? 'border-[#E37B03] bg-[#E37B03]' : 'border-slate-300')}>
                    {consentChecks.signature && <Check className="w-4 h-4 text-white" />}
                  </div>
                  <p className="text-sm font-semibold text-slate-800">
                    Je confirme mon identité et consens au traitement de mes données personnelles.
                  </p>
                </button>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                <p className="text-[11px] text-amber-800 leading-tight">
                  <strong>Note importante :</strong> Conformément à la réglementation COBAC (FR19), la signature manuscrite (humide) physique sur papier reste <strong>obligatoire</strong> lors de votre passage en agence pour la remise de votre carte.
                </p>
              </div>

              <div className="text-center text-[10px] text-slate-400">
                Horodatage numérique (Digital Capture) : {new Date().toLocaleString('fr-FR')}
              </div>
            </div>
          </div>
        );

      case 'review-summary':
        return (
          <div className="px-6 space-y-5">
            <div className="text-center space-y-2">
              <CheckCircle className="w-12 h-12 text-blue-600 mx-auto" />
              <h2 className="text-xl font-bold text-slate-900">Récapitulatif & Soumettre</h2>
              <p className="text-sm text-slate-500">Vérifiez que toutes les informations sont correctes</p>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Nom complet', value: 'Adjoua Cécile Mbarga' },
                { label: 'Téléphone', value: '+237 6 74 12 34 56' },
                { label: 'Email', value: 'mbarga.adjoua@gmail.com' },
                { label: 'N° CNI', value: 'CNI-12000018542' },
                { label: 'Adresse', value: 'Av. Jean Paul II, Bastos, Yaoundé' },
                { label: 'Vivacité', value: '✓ Vérifiée' },
                { label: 'Documents', value: '4 fichiers joints' },
                { label: 'Signature', value: hasSigned ? '✓ Signée' : '○ Non signée' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <span className="text-xs text-slate-500">{item.label}</span>
                  <span className="text-sm font-medium text-slate-900">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        );

      case 'uploading':
        return (
          <div className="px-6 space-y-6 flex flex-col items-center justify-center h-full">
            <div className="relative">
              <div className="w-24 h-24 rounded-full border-4 border-orange-100 flex items-center justify-center">
                <Upload className="w-10 h-10 text-[#E37B03]" />
              </div>
              <svg className="absolute inset-0 w-24 h-24" viewBox="0 0 96 96">
                <circle cx="48" cy="48" r="44" fill="none" stroke="#ffedd5" strokeWidth="4" />
                <circle cx="48" cy="48" r="44" fill="none" stroke="#E37B03" strokeWidth="4"
                  strokeDasharray={276.5} strokeDashoffset={276.5 * (1 - uploadProgress / 100)}
                  strokeLinecap="round" transform="rotate(-90 48 48)" className="transition-all duration-300" />
              </svg>
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold text-slate-900">Envoi sécurisé en cours</h2>
              <p className="text-xs text-slate-500">Transfert chiffré AES-256 · par tranches</p>
            </div>
            <div className="w-full max-w-[280px] space-y-3">
              <div className="justify-between flex text-sm">
                <span className="text-slate-600">Progression</span>
                <span className="font-mono font-bold text-[#E37B03]">{Math.round(uploadProgress)}%</span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#E37B03] to-[#4A2205] rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }} />
              </div>
              {/* File list */}
              <div className="space-y-1.5">
                {[
                  { name: 'CNI_recto.jpg', size: '1.2 Mo', done: uploadChunks.completed >= 2 },
                  { name: 'CNI_verso.jpg', size: '1.1 Mo', done: uploadChunks.completed >= 3 },
                  { name: 'Selfie_vivacite.mp4', size: '3.4 Mo', done: uploadChunks.completed >= 4 },
                  { name: 'Facture_ENEO.pdf', size: '0.8 Mo', done: uploadChunks.completed >= 5 },
                ].map((file) => (
                  <div key={file.name} className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-xs', file.done ? 'bg-emerald-50' : 'bg-slate-50')}>
                    {file.done
                      ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      : <Loader2 className="w-3.5 h-3.5 text-slate-400 shrink-0 animate-spin" />}
                    <span className={cn('flex-1 font-medium', file.done ? 'text-emerald-700' : 'text-slate-500')}>{file.name}</span>
                    <span className="text-slate-400">{file.size}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Tranche {uploadChunks.completed}/{uploadChunks.total}</span>
                <span>Retry auto activé</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
              <ShieldCheck className="w-4 h-4" /> Chiffrement de bout en bout actif
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center space-y-5">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}>
              <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center">
                <PartyPopper className="w-12 h-12 text-emerald-600" />
              </div>
            </motion.div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-900">Dossier soumis ! 🎉</h2>
              <p className="text-xs text-slate-500">Vos documents sont transmis. Notre équipe KYC vous contactera sous peu.</p>
            </div>
            <div className="w-full bg-emerald-50 rounded-xl border border-emerald-200 p-4 space-y-2 text-sm text-left">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">N° dossier</span>
                <span className="font-mono font-bold text-slate-900">VRF-2026-0006</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Statut</span>
                <span className="flex items-center gap-1 text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full text-xs font-semibold">
                  <Loader2 className="w-3 h-3 animate-spin" /> En vérification
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Délai estimé</span>
                <span className="text-slate-900 font-medium">1 à 2 jours ouvrés</span>
              </div>
            </div>
            <div className="w-full space-y-2 text-sm text-left">
              <p className="text-xs font-semibold text-slate-500">Prochaines étapes :</p>
              {[
                { step: '1', text: 'Vérification de vos documents par un agent BICEC' },
                { step: '2', text: 'Validation de votre identité et de domicile' },
                { step: '3', text: 'Accès complet débloqué + notification SMS' },
              ].map(item => (
                <div key={item.step} className="flex items-start gap-2 text-slate-600">
                  <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-800 flex items-center justify-center text-xs font-bold shrink-0">{item.step}</span>
                  {item.text}
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (currentStep?.id) {
      case 'liveness':
        return livenessState === 'success';
      case 'consent':
        return consentChecks.terms && consentChecks.privacy && consentChecks.data;
      case 'signature':
        return consentChecks.signature;
      case 'uploading':
        return false;
      default:
        return true;
    }
  };

  return (
    <div className="w-full max-w-[390px] mx-auto">
      {/* Phone frame */}
      <div className="relative bg-slate-900 rounded-[3rem] p-3 shadow-2xl">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 h-7 bg-slate-900 rounded-b-2xl z-20" />

        <div className="relative bg-white rounded-[2.4rem] overflow-hidden" style={{ height: 740 }}>
          {/* Status bar */}
          <div className="flex items-center justify-between px-8 pt-3 pb-1 text-[10px] font-semibold text-slate-900 z-10 relative">
            <span>9:41</span>
            <div className="flex items-center gap-1">
              <Signal className="w-3.5 h-3.5" />
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5 text-red-500" />}
              <Battery className="w-4 h-3.5" />
            </div>
          </div>

          {/* Offline banner */}
          <AnimatePresence>
            {showOfflineBanner && (
              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                className="overflow-hidden z-10 relative">
                <div className="bg-slate-900 text-white text-xs text-center py-1.5 flex items-center justify-center gap-1.5 shadow-md border-b border-slate-800">
                  <WifiOff className="w-3.5 h-3.5" />
                  Pas de connexion Internet. Vos données sont sauvegardées.
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {scenario.kycState === 'LOCKED_LIVENESS' ? (
            <div className="flex flex-col items-center justify-center h-full px-6 text-center space-y-6 pt-12">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center border-4 border-red-50">
                  <Lock className="w-10 h-10 text-red-600" />
                </div>
                <div className="absolute top-0 right-0 w-8 h-8 rounded-full bg-red-500 flex items-center justify-center border-2 border-white">
                  <Ban className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-900">Compte verrouillé</h2>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Suite à 3 échecs consécutifs lors de la détection de vivacité, votre démarche est temporairement bloquée par mesure de sécurité.
                </p>
              </div>
              <div className="w-full bg-red-50 text-red-800 text-sm p-4 rounded-xl border border-red-100 shadow-sm flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="text-left font-medium">
                  <p>Veuillez réessayer dans 60 secondes,</p>
                  <p className="text-red-600 mt-1">ou rendez-vous en agence pour finaliser avec un conseiller.</p>
                </div>
              </div>
              <div className="w-full pt-4 space-y-3">
                <button className="w-full py-3.5 bg-slate-900 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors shadow-md">
                  <MapPin className="w-4 h-4" /> Trouver une agence
                </button>
                <button className="w-full py-2.5 text-slate-500 font-bold rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors">
                  <RotateCcw className="w-4 h-4" /> Réessayer plus tard
                </button>
              </div>
            </div>
          ) : postState || scenario.kycState === 'PENDING_INFO' || scenario.kycState === 'REJECTED' || (scenario.accessLevel !== 'RESTRICTED' && scenario.kycState !== 'DRAFT') ? (
            // Post-submission or forced views
            <div className="h-[calc(100%-2rem)] overflow-y-auto pb-8 pt-4">
              {renderPostSubmission()}
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Header bar */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                <button onClick={goBack} disabled={currentStepIdx === 0}
                  className={cn('p-1 rounded-lg transition-colors', currentStepIdx === 0 ? 'text-slate-300' : 'text-slate-600 hover:bg-slate-100')}>
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="text-center">
                  <p className="text-xs text-slate-500">{currentStep?.group}</p>
                  <p className="text-sm font-semibold text-slate-900">{currentStep?.label}</p>
                </div>
                <button onClick={() => setIsOnline(false)} title="Simuler hors ligne"
                  className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                  <WifiOff className="w-4 h-4" />
                </button>
              </div>

              {/* Progress bar */}
              <div className="px-5 py-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div className="h-full bg-gradient-to-r from-[#E37B03] to-[#4A2205] rounded-full"
                      animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">{currentStepIdx + 1}/{totalSteps}</span>
                </div>
              </div>

              {/* Step content — flex-1 so it fills remaining space and scrolls */}
              <div className="flex-1 overflow-y-auto pb-24">
                <AnimatePresence mode="wait">
                  <motion.div key={currentStep?.id}
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }} className="pt-4">
                    {renderStepContent()}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Bottom action bar */}
              {currentStep?.id !== 'uploading' && currentStep?.id !== 'success' && (
                <div className="absolute bottom-0 left-0 right-0 px-5 py-4 bg-gradient-to-t from-white via-white to-white/0">
                  <button onClick={() => {
                    if (currentStep?.id === 'success') {
                      setPostState('pending');
                    } else {
                      goNext();
                    }
                  }}
                    disabled={!canProceed()}
                    className={cn('w-full py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all',
                      canProceed()
                        ? 'bg-gradient-to-r from-[#E37B03] to-[#4A2205] text-white shadow-lg shadow-orange-200 hover:shadow-xl active:scale-[0.98]'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed')}>
                    {currentStep?.id === 'review-summary' ? 'Soumettre le dossier' : 'Continuer'}
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}

              {currentStep?.id === 'success' && (
                <div className="absolute bottom-0 left-0 right-0 px-5 py-4 bg-gradient-to-t from-white via-white to-white/0">
                  <button onClick={() => setPostState('pending')}
                    className="w-full py-3.5 rounded-2xl font-semibold bg-gradient-to-r from-[#E37B03] to-[#4A2205] text-white shadow-lg shadow-orange-200 flex items-center justify-center gap-2">
                    Aller au tableau de bord <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Home indicator */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-slate-300 rounded-full" />
        </div>
      </div>

      {/* Step indicators below phone */}
      <div className="mt-6 flex flex-wrap gap-1 justify-center">
        {STEP_SEQUENCE.map((s, i) => {
          const Icon = ICON_MAP[s.icon];
          return (
            <button key={s.id} onClick={() => { setPostState(null); setCurrentStepIdx(i); }}
              title={s.label}
              className={cn('w-7 h-7 rounded-lg flex items-center justify-center transition-all',
                i === currentStepIdx ? 'bg-blue-600 text-white scale-110' :
                  i < currentStepIdx ? 'bg-emerald-100 text-emerald-600' :
                    'bg-slate-100 text-slate-400 hover:bg-slate-200')}>
              {Icon ? <Icon className="w-3.5 h-3.5" /> : <span className="text-[10px]">{i + 1}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}


