import { useState, useEffect, useCallback, useRef } from 'react';
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
import { STEP_SEQUENCE, LANGUAGES, MOCK_OCR_FIELDS, STATES } from '@/data';
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
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  const [pin, setPin] = useState(['', '', '', '', '', '']);
  const [pinConfirm, setPinConfirm] = useState(['', '', '', '', '', '']);
  const [pinStep, setPinStep] = useState<'create' | 'confirm'>('create');
  const [showPin, setShowPin] = useState(false);
  const [selectedLang, setSelectedLang] = useState('es');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpSent, setOtpSent] = useState(false);
  const [ocrFields, setOcrFields] = useState<OCRField[]>(MOCK_OCR_FIELDS);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [livenessAttempts, setLivenessAttempts] = useState(0);
  const [livenessState, setLivenessState] = useState<'idle' | 'scanning' | 'success' | 'failed' | 'locked'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadChunks, setUploadChunks] = useState({ total: 5, completed: 0 });
  const [consentChecks, setConsentChecks] = useState({ terms: false, privacy: false, data: false });
  const [isSigning, setIsSigning] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const [postState, setPostState] = useState<'pending' | 'limited' | 'full' | null>(null);
  const [selectedAddress, setSelectedAddress] = useState({ state: '', city: '', colony: '' });
  const [gpsAssist, setGpsAssist] = useState(false);
  const [fiscalType, setFiscalType] = useState<'rfc' | 'curp' | 'other' | ''>('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });

  const currentStep = STEP_SEQUENCE[currentStepIdx];
  const totalSteps = STEP_SEQUENCE.length;
  const progress = ((currentStepIdx + 1) / totalSteps) * 100;

  // Simulate offline toggle
  useEffect(() => {
    if (!isOnline) {
      setShowOfflineBanner(true);
      const t = setTimeout(() => {
        setIsOnline(true);
        setShowOfflineBanner(false);
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [isOnline]);

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

  // Canvas signature setup
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

  const confidenceColor = (c: number) => {
    if (c >= 90) return 'text-emerald-600 bg-emerald-50';
    if (c >= 70) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  const renderPostSubmission = () => {
    if (postState === 'pending') {
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
            <h2 className="text-xl font-bold text-slate-900">Application Under Review</h2>
            <p className="text-sm text-slate-500 mt-2">Your documents are being validated by our team. This usually takes 1-2 business days.</p>
          </div>
          <div className="w-full bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Application ID</span>
              <span className="font-mono text-slate-900 font-medium">APP-2024-0006</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Status</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                <Loader2 className="w-3 h-3 animate-spin" /> Pending Review
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Submitted</span>
              <span className="text-slate-900">Just now</span>
            </div>
          </div>
          <div className="w-full space-y-3 pt-2">
            <h3 className="text-sm font-semibold text-slate-700">Available while pending:</h3>
            {['View account details', 'Explore plans', 'Contact support'].map((item) => (
              <div key={item} className="flex items-center gap-3 px-4 py-3 bg-white rounded-lg border border-slate-200">
                <Check className="w-4 h-4 text-emerald-500" />
                <span className="text-sm text-slate-700">{item}</span>
              </div>
            ))}
            {['Send transfers', 'Request debit card', 'Investments'].map((item) => (
              <div key={item} className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-lg border border-slate-200 opacity-60">
                <Ban className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-400">{item}</span>
                <span className="ml-auto text-xs text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">Locked</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2 w-full pt-2">
            <button onClick={() => setPostState('limited')} className="flex-1 py-2.5 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 transition-colors">
              Sim: Limited Access
            </button>
            <button onClick={() => setPostState('full')} className="flex-1 py-2.5 bg-emerald-500 text-white text-sm font-semibold rounded-xl hover:bg-emerald-600 transition-colors">
              Sim: Full Access
            </button>
          </div>
        </div>
      );
    }

    if (postState === 'limited') {
      return (
        <div className="flex flex-col items-center justify-center h-full px-6 text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-orange-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Limited Access</h2>
            <p className="text-sm text-slate-500 mt-2">Your fiscal/tax ID is missing. Complete it to unlock all features.</p>
          </div>
          <div className="w-full bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
              <div className="text-left">
                <p className="text-sm font-medium text-orange-800">Action Required</p>
                <p className="text-xs text-orange-600 mt-1">Please provide your RFC or CURP to unlock transfers and card issuance.</p>
              </div>
            </div>
          </div>
          <button className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 hover:shadow-lg transition-all">
            <FileText className="w-5 h-5" /> Complete Fiscal Info
          </button>
          <button onClick={() => setPostState('full')} className="w-full py-2.5 bg-emerald-500 text-white text-sm font-semibold rounded-xl hover:bg-emerald-600 transition-colors">
            Simulate: Approved → Full Access
          </button>
        </div>
      );
    }

    if (postState === 'full') {
      return (
        <div className="flex flex-col items-center justify-center h-full px-6 text-center space-y-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
              <Shield className="w-10 h-10 text-emerald-600" />
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
              <Check className="w-4 h-4 text-white" />
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Full Access Unlocked! 🎉</h2>
            <p className="text-sm text-slate-500 mt-2">Your identity has been verified. All features are now available.</p>
          </div>
          <div className="w-full space-y-3">
            {[
              { label: 'Send & Receive Transfers', icon: Send },
              { label: 'Request Debit Card', icon: CardIcon },
              { label: 'Investments & Savings', icon: Sparkles },
              { label: 'Credit Pre-approval', icon: CheckCircle },
            ].map(({ label, icon: Icon }) => (
              <div key={label} className="flex items-center gap-3 px-4 py-3.5 bg-white rounded-xl border border-emerald-200 shadow-sm">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-emerald-600" />
                </div>
                <span className="text-sm font-medium text-slate-700">{label}</span>
                <ArrowRight className="w-4 h-4 text-slate-400 ml-auto" />
              </div>
            ))}
          </div>
          <button onClick={() => { setPostState(null); setCurrentStepIdx(0); onComplete?.(); }} className="w-full py-2.5 border border-slate-300 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors mt-2">
            Restart Demo
          </button>
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
              className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-2xl shadow-blue-300">
              <span className="text-4xl font-black text-white">B</span>
            </motion.div>
            <div className="space-y-3">
              <h1 className="text-2xl font-bold text-slate-900">Welcome to BankCo</h1>
              <p className="text-slate-500 text-sm leading-relaxed max-w-[260px] mx-auto">
                Open your account in minutes. Secure, digital, and always with you.
              </p>
            </div>
            <div className="space-y-2.5 w-full max-w-[260px]">
              {['🔒 Bank-grade security', '⚡ Ready in 5 minutes', '📱 100% digital process'].map(t => (
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
              <Globe className="w-12 h-12 text-blue-600 mx-auto" />
              <h2 className="text-xl font-bold text-slate-900">Choose Language</h2>
              <p className="text-sm text-slate-500">Select your preferred language</p>
            </div>
            <div className="space-y-2.5">
              {LANGUAGES.map(l => (
                <button key={l.code} onClick={() => setSelectedLang(l.code)}
                  className={cn('w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border-2 transition-all',
                    selectedLang === l.code ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300')}>
                  <span className="text-2xl">{l.flag}</span>
                  <span className={cn('font-medium', selectedLang === l.code ? 'text-blue-700' : 'text-slate-700')}>{l.label}</span>
                  {selectedLang === l.code && <Check className="w-5 h-5 text-blue-600 ml-auto" />}
                </button>
              ))}
            </div>
          </div>
        );

      case 'phone-otp':
        return (
          <div className="px-6 space-y-6">
            <div className="text-center space-y-2">
              <Smartphone className="w-12 h-12 text-blue-600 mx-auto" />
              <h2 className="text-xl font-bold text-slate-900">Phone Verification</h2>
              <p className="text-sm text-slate-500">We'll send a code to verify your number</p>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Phone Number</label>
              <div className="flex mt-1.5">
                <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-slate-300 bg-slate-50 text-sm text-slate-500">+52</span>
                <input type="tel" placeholder="55 1234 5678" defaultValue="55 1234 5678"
                  className="flex-1 px-3 py-2.5 border border-slate-300 rounded-r-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
              </div>
            </div>
            {!otpSent ? (
              <button onClick={() => setOtpSent(true)} className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors">
                Send OTP Code
              </button>
            ) : (
              <div className="space-y-4">
                <label className="text-sm font-medium text-slate-700">Enter 6-digit code</label>
                <div className="flex justify-center gap-2">
                  {otp.map((d, i) => (
                    <input key={i} type="text" maxLength={1} value={d}
                      onChange={e => {
                        const newOtp = [...otp];
                        newOtp[i] = e.target.value;
                        setOtp(newOtp);
                      }}
                      className="w-10 h-12 text-center text-lg font-bold border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none" />
                  ))}
                </div>
                <p className="text-xs text-slate-500 text-center">Didn't receive it? <button className="text-blue-600 font-medium">Resend</button></p>
              </div>
            )}
          </div>
        );

      case 'email-verify':
        return (
          <div className="px-6 space-y-6">
            <div className="text-center space-y-2">
              <Mail className="w-12 h-12 text-blue-600 mx-auto" />
              <h2 className="text-xl font-bold text-slate-900">Email Verification</h2>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Email Address</label>
              <input type="email" placeholder="your@email.com" defaultValue="maria.garcia@email.com"
                className="w-full mt-1.5 px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
            </div>
            <div className="bg-blue-50 rounded-xl p-4 flex items-start gap-3">
              <Mail className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-700">We'll send a verification link. Click it to confirm your email address.</p>
            </div>
          </div>
        );

      case 'pin-setup':
        return (
          <div className="px-6 space-y-6">
            <div className="text-center space-y-2">
              <Lock className="w-12 h-12 text-blue-600 mx-auto" />
              <h2 className="text-xl font-bold text-slate-900">{pinStep === 'create' ? 'Create PIN' : 'Confirm PIN'}</h2>
              <p className="text-sm text-slate-500">{pinStep === 'create' ? 'Choose a 6-digit PIN' : 'Re-enter your PIN to confirm'}</p>
            </div>
            <div className="flex justify-center gap-2.5">
              {(pinStep === 'create' ? pin : pinConfirm).map((d, i) => (
                <div key={i} className={cn('w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all',
                  d ? 'border-blue-600 bg-blue-600' : 'border-slate-300')}>
                  {d && (showPin ? <span className="text-white font-bold text-sm">{d}</span> : <div className="w-3 h-3 rounded-full bg-white" />)}
                </div>
              ))}
            </div>
            <button onClick={() => setShowPin(!showPin)} className="mx-auto flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
              {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showPin ? 'Hide' : 'Show'} PIN
            </button>
            <div className="grid grid-cols-3 gap-2 max-w-[220px] mx-auto">
              {[1,2,3,4,5,6,7,8,9,null,0,'⌫'].map((n, i) => (
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
              <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
                <Fingerprint className="w-10 h-10 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Enable Biometrics</h2>
              <p className="text-sm text-slate-500 max-w-[240px]">Use your fingerprint or face to sign in faster</p>
            </div>
            <button className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors">
              Enable Biometrics
            </button>
            <button onClick={goNext} className="text-sm text-slate-500 hover:text-slate-700">
              Skip for now
            </button>
          </div>
        );

      case 'id-front':
      case 'id-back':
        return (
          <div className="px-6 space-y-6">
            <div className="text-center space-y-2">
              <CreditCard className="w-12 h-12 text-blue-600 mx-auto" />
              <h2 className="text-xl font-bold text-slate-900">
                Capture ID — {currentStep.id === 'id-front' ? 'Front' : 'Back'}
              </h2>
              <p className="text-sm text-slate-500">Place your national ID within the frame</p>
            </div>
            <div className="relative aspect-[1.6/1] bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center">
              <div className="absolute inset-4 border-2 border-dashed border-white/40 rounded-xl" />
              <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-blue-400 rounded-tl-lg" />
              <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-blue-400 rounded-tr-lg" />
              <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-blue-400 rounded-bl-lg" />
              <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-blue-400 rounded-br-lg" />
              <div className="text-center z-10">
                <Camera className="w-8 h-8 text-white/60 mx-auto mb-2" />
                <p className="text-white/60 text-xs">Camera preview</p>
              </div>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
                <span className="text-xs text-white/80 bg-black/40 px-3 py-1 rounded-full">
                  {currentStep.id === 'id-front' ? 'Front side' : 'Back side'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Ensure good lighting and avoid glare
            </div>
            <button onClick={goNext} className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2">
              <Camera className="w-5 h-5" /> Capture
            </button>
          </div>
        );

      case 'ocr-review':
        return (
          <div className="px-6 space-y-5">
            <div className="text-center space-y-2">
              <ScanLine className="w-12 h-12 text-blue-600 mx-auto" />
              <h2 className="text-xl font-bold text-slate-900">Review Extracted Data</h2>
              <p className="text-sm text-slate-500">Verify and correct the information below</p>
            </div>
            <div className="space-y-2.5">
              {ocrFields.map(f => (
                <div key={f.key} className="bg-white rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-500">{f.label}</span>
                    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', confidenceColor(f.confidence))}>
                      {f.confidence}%
                    </span>
                  </div>
                  {editingField === f.key ? (
                    <div className="flex gap-2">
                      <input type="text" defaultValue={f.value}
                        onBlur={(e) => {
                          setOcrFields(prev => prev.map(fld => fld.key === f.key ? { ...fld, value: e.target.value, edited: true } : fld));
                          setEditingField(null);
                        }}
                        className="flex-1 px-2 py-1 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none"
                        autoFocus />
                      <button onClick={() => setEditingField(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className={cn('text-sm font-medium', f.edited ? 'text-blue-700' : 'text-slate-900')}>
                        {f.value} {f.edited && <span className="text-xs text-blue-500">(edited)</span>}
                      </span>
                      <button onClick={() => setEditingField(f.key)} className="text-slate-400 hover:text-blue-600">
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );

      case 'liveness':
        return (
          <div className="px-6 space-y-6">
            <div className="text-center space-y-2">
              <Camera className="w-12 h-12 text-blue-600 mx-auto" />
              <h2 className="text-xl font-bold text-slate-900">Liveness Check</h2>
              <p className="text-sm text-slate-500">Look at the camera and follow instructions</p>
            </div>
            <div className="relative w-48 h-48 mx-auto">
              <div className={cn('w-full h-full rounded-full border-4 flex items-center justify-center',
                livenessState === 'scanning' ? 'border-blue-500 animate-pulse' :
                livenessState === 'success' ? 'border-emerald-500' :
                livenessState === 'failed' ? 'border-red-500' :
                livenessState === 'locked' ? 'border-red-500' :
                'border-slate-300')}>
                <div className="w-40 h-40 rounded-full bg-slate-800 flex items-center justify-center">
                  {livenessState === 'success' ? (
                    <Check className="w-16 h-16 text-emerald-400" />
                  ) : livenessState === 'failed' ? (
                    <X className="w-16 h-16 text-red-400" />
                  ) : livenessState === 'locked' ? (
                    <Ban className="w-16 h-16 text-red-400" />
                  ) : (
                    <Camera className="w-12 h-12 text-white/40" />
                  )}
                </div>
              </div>
              {livenessState === 'scanning' && (
                <motion.div className="absolute inset-0 rounded-full border-4 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent"
                  animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} />
              )}
            </div>
            <div className="text-center text-sm text-slate-500">
              Attempts: {livenessAttempts}/3
              {livenessState === 'locked' && <p className="text-red-600 font-medium mt-1">Maximum attempts reached. Please contact support.</p>}
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
                      if (next >= 3) setLivenessState('locked');
                      else setLivenessState('failed');
                      return next;
                    });
                  }
                }, 2000);
              }} className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl">
                Start Liveness Check
              </button>
            )}
            {livenessState === 'failed' && (
              <button onClick={() => setLivenessState('idle')} className="w-full py-3 bg-amber-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2">
                <RotateCcw className="w-5 h-5" /> Try Again
              </button>
            )}
            {livenessState === 'success' && (
              <div className="bg-emerald-50 rounded-xl p-4 text-center text-sm text-emerald-700 font-medium">
                ✓ Liveness verified successfully
              </div>
            )}
          </div>
        );

      case 'address':
        return (
          <div className="px-6 space-y-5">
            <div className="text-center space-y-2">
              <MapPin className="w-12 h-12 text-blue-600 mx-auto" />
              <h2 className="text-xl font-bold text-slate-900">Your Address</h2>
              <p className="text-sm text-slate-500">Cascade selection for your address</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700">State</label>
                <select value={selectedAddress.state} onChange={e => setSelectedAddress(p => ({ ...p, state: e.target.value, city: '', colony: '' }))}
                  className="w-full mt-1 px-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">Select state...</option>
                  {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">City</label>
                <select value={selectedAddress.city} onChange={e => setSelectedAddress(p => ({ ...p, city: e.target.value }))}
                  disabled={!selectedAddress.state}
                  className="w-full mt-1 px-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white disabled:bg-slate-100 focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">Select city...</option>
                  {selectedAddress.state && <option value="Centro">Centro</option>}
                  {selectedAddress.state && <option value="Norte">Norte</option>}
                  {selectedAddress.state && <option value="Sur">Sur</option>}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Street & Number</label>
                <input type="text" placeholder="Av. Reforma 222" defaultValue=""
                  className="w-full mt-1 px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Postal Code</label>
                <input type="text" placeholder="06600" defaultValue=""
                  className="w-full mt-1 px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>
            <button onClick={() => setGpsAssist(!gpsAssist)}
              className={cn('w-full py-2.5 rounded-xl border-2 flex items-center justify-center gap-2 text-sm font-medium transition-all',
                gpsAssist ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-300 text-slate-600 hover:border-slate-400')}>
              <MapPin className="w-4 h-4" />
              {gpsAssist ? '✓ GPS Location Detected' : 'Use GPS to Assist'}
            </button>
          </div>
        );

      case 'address-proof':
        return (
          <div className="px-6 space-y-6">
            <div className="text-center space-y-2">
              <FileCheck className="w-12 h-12 text-blue-600 mx-auto" />
              <h2 className="text-xl font-bold text-slate-900">Proof of Address</h2>
              <p className="text-sm text-slate-500">Upload a utility bill or bank statement</p>
            </div>
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:border-blue-400 transition-colors cursor-pointer">
              <Upload className="w-8 h-8 text-slate-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-600">Tap to upload or take photo</p>
              <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG · Max 10MB</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500">Accepted documents:</p>
              {['Utility bill (last 3 months)', 'Bank statement', 'Government letter'].map(d => (
                <div key={d} className="flex items-center gap-2 text-xs text-slate-600">
                  <Check className="w-3.5 h-3.5 text-emerald-500" /> {d}
                </div>
              ))}
            </div>
          </div>
        );

      case 'fiscal-id':
        return (
          <div className="px-6 space-y-5">
            <div className="text-center space-y-2">
              <FileText className="w-12 h-12 text-blue-600 mx-auto" />
              <h2 className="text-xl font-bold text-slate-900">Fiscal / Tax ID</h2>
              <p className="text-sm text-slate-500">Choose your tax identifier type</p>
            </div>
            <div className="space-y-2">
              {[
                { id: 'rfc' as const, label: 'RFC (Registro Federal de Contribuyentes)', desc: '13-character tax ID' },
                { id: 'curp' as const, label: 'CURP', desc: '18-character population ID' },
                { id: 'other' as const, label: 'Other / Foreign Tax ID', desc: 'For non-Mexican residents' },
              ].map(t => (
                <button key={t.id} onClick={() => setFiscalType(t.id)}
                  className={cn('w-full text-left px-4 py-3 rounded-xl border-2 transition-all',
                    fiscalType === t.id ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300')}>
                  <p className={cn('text-sm font-medium', fiscalType === t.id ? 'text-blue-700' : 'text-slate-700')}>{t.label}</p>
                  <p className="text-xs text-slate-500">{t.desc}</p>
                </button>
              ))}
            </div>
            {fiscalType && (
              <div>
                <label className="text-sm font-medium text-slate-700">Enter your {fiscalType.toUpperCase()}</label>
                <input type="text" placeholder={fiscalType === 'rfc' ? 'GALM900315HDF' : fiscalType === 'curp' ? 'GALM900315HDFRPL09' : 'Tax ID number'}
                  className="w-full mt-1.5 px-3 py-2.5 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            )}
            <button onClick={goNext} className="text-sm text-slate-500 hover:text-slate-700 mx-auto block">
              Skip — provide later (limited access)
            </button>
          </div>
        );

      case 'consent':
        return (
          <div className="px-6 space-y-5">
            <div className="text-center space-y-2">
              <ShieldCheck className="w-12 h-12 text-blue-600 mx-auto" />
              <h2 className="text-xl font-bold text-slate-900">Terms & Consent</h2>
            </div>
            <div className="space-y-3">
              {[
                { key: 'terms' as const, label: 'I accept the Terms and Conditions', desc: 'Including account agreement and fee schedule' },
                { key: 'privacy' as const, label: 'I accept the Privacy Policy', desc: 'How we handle and protect your data' },
                { key: 'data' as const, label: 'I consent to data processing', desc: 'For identity verification and regulatory compliance' },
              ].map(c => (
                <button key={c.key} onClick={() => setConsentChecks(prev => ({ ...prev, [c.key]: !prev[c.key] }))}
                  className={cn('w-full flex items-start gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all',
                    consentChecks[c.key] ? 'border-blue-600 bg-blue-50' : 'border-slate-200')}>
                  <div className={cn('w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center shrink-0 transition-all',
                    consentChecks[c.key] ? 'border-blue-600 bg-blue-600' : 'border-slate-300')}>
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
              <PenTool className="w-12 h-12 text-blue-600 mx-auto" />
              <h2 className="text-xl font-bold text-slate-900">Digital Signature</h2>
              <p className="text-sm text-slate-500">Sign below to complete your agreement</p>
            </div>
            {!isSigning ? (
              <div className="space-y-4">
                <button onClick={() => setIsSigning(true)} className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2">
                  <PenTool className="w-5 h-5" /> Draw Signature
                </button>
                <p className="text-xs text-center text-slate-500">Your signature will be applied to the account agreement</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative bg-white rounded-xl border-2 border-slate-300 overflow-hidden">
                  <canvas ref={canvasRef} style={{ width: '100%', height: 160 }}
                    onMouseDown={handleCanvasStart} onMouseMove={handleCanvasMove} onMouseUp={handleCanvasEnd} onMouseLeave={handleCanvasEnd}
                    onTouchStart={handleCanvasStart} onTouchMove={handleCanvasMove} onTouchEnd={handleCanvasEnd}
                    className="cursor-crosshair touch-none" />
                  {!hasSigned && (
                    <p className="absolute inset-0 flex items-center justify-center text-slate-300 text-sm pointer-events-none">
                      Sign here
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={clearCanvas} className="flex-1 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-600 flex items-center justify-center gap-1">
                    <RotateCcw className="w-4 h-4" /> Clear
                  </button>
                  <button onClick={() => setIsSigning(false)} className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium">
                    Accept
                  </button>
                </div>
              </div>
            )}
          </div>
        );

      case 'review-summary':
        return (
          <div className="px-6 space-y-5">
            <div className="text-center space-y-2">
              <CheckCircle className="w-12 h-12 text-blue-600 mx-auto" />
              <h2 className="text-xl font-bold text-slate-900">Review & Submit</h2>
              <p className="text-sm text-slate-500">Please verify all information is correct</p>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Full Name', value: 'María García López' },
                { label: 'Phone', value: '+52 55 1234 5678' },
                { label: 'Email', value: 'maria.garcia@email.com' },
                { label: 'National ID', value: 'INE-1234567890' },
                { label: 'Address', value: 'Av. Reforma 222, Col. Juárez, CDMX' },
                { label: 'Liveness', value: '✓ Verified' },
                { label: 'Documents', value: '4 files attached' },
                { label: 'Signature', value: hasSigned ? '✓ Signed' : '○ Not signed' },
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
              <div className="w-24 h-24 rounded-full border-4 border-blue-200 flex items-center justify-center">
                <Upload className="w-10 h-10 text-blue-600" />
              </div>
              <svg className="absolute inset-0 w-24 h-24" viewBox="0 0 96 96">
                <circle cx="48" cy="48" r="44" fill="none" stroke="#dbeafe" strokeWidth="4" />
                <circle cx="48" cy="48" r="44" fill="none" stroke="#2563eb" strokeWidth="4"
                  strokeDasharray={276.5} strokeDashoffset={276.5 * (1 - uploadProgress / 100)}
                  strokeLinecap="round" transform="rotate(-90 48 48)" className="transition-all duration-300" />
              </svg>
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold text-slate-900">Uploading Documents</h2>
              <p className="text-sm text-slate-500">Secure upload with chunked transfer</p>
            </div>
            <div className="w-full max-w-[260px] space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Progress</span>
                <span className="font-mono font-bold text-blue-600">{Math.round(uploadProgress)}%</span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }} />
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>Chunk {uploadChunks.completed}/{uploadChunks.total}</span>
                <span>Retry: auto</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
              <ShieldCheck className="w-4 h-4" /> End-to-end encrypted
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center space-y-6">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}>
              <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center">
                <PartyPopper className="w-12 h-12 text-emerald-600" />
              </div>
            </motion.div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-900">Application Submitted! 🎉</h2>
              <p className="text-sm text-slate-500">Your documents are being reviewed. We'll notify you once verification is complete.</p>
            </div>
            <div className="w-full bg-slate-50 rounded-xl p-4 space-y-2 text-sm text-left">
              <p className="font-medium text-slate-700">What happens next?</p>
              <div className="flex items-start gap-2 text-slate-600">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">1</span>
                Document review (1-2 business days)
              </div>
              <div className="flex items-start gap-2 text-slate-600">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">2</span>
                Identity verification confirmation
              </div>
              <div className="flex items-start gap-2 text-slate-600">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">3</span>
                Full account access unlocked
              </div>
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
                <div className="bg-amber-500 text-white text-xs text-center py-1.5 flex items-center justify-center gap-1.5">
                  <WifiOff className="w-3.5 h-3.5" />
                  Offline — progress saved locally. Reconnecting...
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {postState ? (
            // Post-submission views
            <div className="h-[calc(100%-2rem)] overflow-y-auto pb-8 pt-4">
              {renderPostSubmission()}
            </div>
          ) : (
            <>
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
                <button onClick={() => setIsOnline(false)} title="Simulate offline"
                  className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                  <WifiOff className="w-4 h-4" />
                </button>
              </div>

              {/* Progress bar */}
              <div className="px-5 py-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full"
                      animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">{currentStepIdx + 1}/{totalSteps}</span>
                </div>
              </div>

              {/* Step content */}
              <div className="h-[calc(100%-10.5rem)] overflow-y-auto pb-4">
                <AnimatePresence mode="wait">
                  <motion.div key={currentStep?.id}
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }} className="h-full pt-4">
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
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-200 hover:shadow-xl active:scale-[0.98]'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed')}>
                    {currentStep?.id === 'review-summary' ? 'Submit Application' : 'Continue'}
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}

              {currentStep?.id === 'success' && (
                <div className="absolute bottom-0 left-0 right-0 px-5 py-4 bg-gradient-to-t from-white via-white to-white/0">
                  <button onClick={() => setPostState('pending')}
                    className="w-full py-3.5 rounded-2xl font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-200 flex items-center justify-center gap-2">
                    Go to Dashboard <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </>
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
