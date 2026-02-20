import { useState } from 'react';
import { motion } from 'framer-motion';
import { Smartphone, Monitor, ArrowRight, Shield, Zap, Eye, ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';
import { MobileOnboarding } from '@/components/MobileOnboarding';
import { BackOffice } from '@/components/BackOffice';
import type { ViewMode } from '@/types';

export function App() {
  const [viewMode, setViewMode] = useState<ViewMode | null>(null);

  if (viewMode === 'mobile') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-50">
        {/* Top nav */}
        <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/50">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setViewMode(null)} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 transition-colors">
                <ChevronRight className="w-4 h-4 rotate-180" />
                <span className="text-sm font-medium">Back</span>
              </button>
              <div className="h-5 w-px bg-slate-300" />
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
                  <span className="text-xs font-black text-white">B</span>
                </div>
                <span className="font-bold text-slate-900 text-sm">BankCo</span>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-blue-50 rounded-full px-4 py-1.5">
              <Smartphone className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-semibold text-blue-700">Mobile Onboarding Journey</span>
            </div>
            <button onClick={() => setViewMode('backoffice')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              <Monitor className="w-4 h-4" /> Switch to Back Office
            </button>
          </div>
        </div>

        {/* Mobile simulator */}
        <div className="flex items-start justify-center py-8 px-4">
          <div className="flex gap-8 items-start">
            {/* Phone */}
            <MobileOnboarding />

            {/* Side info */}
            <div className="hidden xl:block w-80 sticky top-24 space-y-5">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-blue-600" /> Mobile Experience
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  This simulates the Flutter mobile onboarding flow. Click through each step to experience the customer journey.
                </p>
                <div className="space-y-2.5">
                  {[
                    { label: 'Mobile-First Design', desc: 'Optimized for legacy Android devices' },
                    { label: 'Offline Resilience', desc: 'Local persistence & auto-resume' },
                    { label: 'Chunked Upload', desc: 'Retry-capable file transfers' },
                    { label: 'OCR + Confidence', desc: 'Smart extraction with edit capability' },
                    { label: 'Liveness Detection', desc: 'Limited attempts with lockout' },
                    { label: 'Post-Submit Gating', desc: 'Pending → Limited → Full access' },
                  ].map(item => (
                    <div key={item.label} className="flex items-start gap-2.5 px-3 py-2 bg-slate-50 rounded-lg">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-slate-700">{item.label}</p>
                        <p className="text-[11px] text-slate-500">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-5 text-white space-y-3">
                <p className="text-sm font-semibold">💡 Tip: Try the offline simulation</p>
                <p className="text-xs text-blue-100">Click the WiFi-off icon in the phone header to simulate a network drop. Watch the banner and auto-reconnect behavior.</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-sm">
                <p className="text-sm font-semibold text-slate-700">Quick navigation</p>
                <p className="text-xs text-slate-500">Use the step dots below the phone to jump to any step in the journey.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'backoffice') {
    return (
      <div className="h-screen flex flex-col">
        {/* Minimal top bar for switching */}
        <div className="bg-slate-900 text-white px-4 py-1.5 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setViewMode(null)} className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors">
              <ChevronRight className="w-3.5 h-3.5 rotate-180" /> Back to Home
            </button>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">Back Office — KYC Validation Portal</span>
          </div>
          <button onClick={() => setViewMode('mobile')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">
            <Smartphone className="w-3.5 h-3.5" /> View Mobile App
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <BackOffice />
        </div>
      </div>
    );
  }

  // Landing page
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <header className="px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-200">
              <span className="text-xl font-black text-white">B</span>
            </div>
            <div>
              <p className="font-bold text-slate-900">BankCo</p>
              <p className="text-[10px] text-slate-500 -mt-0.5">Digital Onboarding & KYC Platform</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Interactive Prototype
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center space-y-6 mb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-100 rounded-full text-xs font-semibold text-blue-700 mb-4">
              <Shield className="w-3.5 h-3.5" /> Secure • Compliant • Mobile-First
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">
              Digital Onboarding
              <br />
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">& KYC Platform</span>
            </h1>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto mt-4 leading-relaxed">
              End-to-end identity verification for retail banking. Explore the customer mobile journey 
              and the internal back-office validation workflow side by side.
            </p>
          </motion.div>
        </div>

        {/* Two cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-16">
          <motion.button onClick={() => setViewMode('mobile')}
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
            className="group relative bg-white rounded-3xl border border-slate-200 p-8 text-left hover:border-blue-300 hover:shadow-xl hover:shadow-blue-100/50 transition-all duration-300">
            <div className="absolute top-6 right-6">
              <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
            </div>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200 mb-5">
              <Smartphone className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Customer Mobile App</h2>
            <p className="text-sm text-slate-500 leading-relaxed mb-5">
              Experience the full onboarding journey — from welcome screen through ID capture, liveness check, 
              address verification, and post-submission dashboard states.
            </p>
            <div className="flex flex-wrap gap-2">
              {['18-Step Flow', 'Offline-First', 'OCR Review', 'Liveness', 'Post-Submit Gating'].map(tag => (
                <span key={tag} className="px-2.5 py-1 bg-blue-50 text-blue-700 text-[10px] font-semibold rounded-full">{tag}</span>
              ))}
            </div>
          </motion.button>

          <motion.button onClick={() => setViewMode('backoffice')}
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
            className="group relative bg-white rounded-3xl border border-slate-200 p-8 text-left hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-100/50 transition-all duration-300">
            <div className="absolute top-6 right-6">
              <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
            </div>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200 mb-5">
              <Monitor className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Back Office Validation</h2>
            <p className="text-sm text-slate-500 leading-relaxed mb-5">
              Review submitted applications with side-by-side evidence display. Approve or reject with reasons. 
              View OCR confidence, liveness scores, and risk assessment.
            </p>
            <div className="flex flex-wrap gap-2">
              {['Side-by-Side', 'OCR Confidence', 'Risk Scoring', 'Approve/Reject', 'Audit Trail'].map(tag => (
                <span key={tag} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-semibold rounded-full">{tag}</span>
              ))}
            </div>
          </motion.button>
        </div>

        {/* Feature highlights */}
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h3 className="text-lg font-bold text-slate-900">Architecture Highlights</h3>
            <p className="text-sm text-slate-500 mt-1">Designed for security, resilience, and regulatory compliance</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Shield, label: 'Bank-Grade Security', desc: 'E2E encryption, PIN + biometrics, secure document handling', color: 'blue' },
              { icon: Zap, label: 'Offline Resilience', desc: 'Local persistence, auto-resume, chunked uploads with retry', color: 'amber' },
              { icon: Eye, label: 'Smart Verification', desc: 'OCR with confidence scoring, liveness detection, face match', color: 'emerald' },
              { icon: Monitor, label: 'Dual Interface', desc: 'Mobile customer app + tablet/web back-office for validators', color: 'indigo' },
            ].map(item => (
              <div key={item.label} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center',
                  item.color === 'blue' ? 'bg-blue-100' :
                  item.color === 'amber' ? 'bg-amber-100' :
                  item.color === 'emerald' ? 'bg-emerald-100' : 'bg-indigo-100')}>
                  <item.icon className={cn('w-5 h-5',
                    item.color === 'blue' ? 'text-blue-600' :
                    item.color === 'amber' ? 'text-amber-600' :
                    item.color === 'emerald' ? 'text-emerald-600' : 'text-indigo-600')} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{item.label}</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Journey overview */}
        <div className="max-w-4xl mx-auto mt-16">
          <div className="text-center mb-8">
            <h3 className="text-lg font-bold text-slate-900">Onboarding Journey Overview</h3>
            <p className="text-sm text-slate-500 mt-1">Complete customer lifecycle from sign-up to full account access</p>
          </div>
          <div className="relative">
            <div className="absolute top-0 bottom-0 left-[calc(50%-1px)] w-0.5 bg-gradient-to-b from-blue-300 via-indigo-300 to-emerald-300 hidden md:block" />
            <div className="space-y-4">
              {[
                { phase: 'Entry & Auth', steps: 'Welcome → Language → Phone OTP → Email → PIN → Biometrics', color: 'blue', side: 'left' },
                { phase: 'Identity Capture', steps: 'ID Front/Back → OCR Review + Confidence → Liveness Check', color: 'indigo', side: 'right' },
                { phase: 'Address & Fiscal', steps: 'Cascade Address → GPS Assist → Proof Upload → Tax ID', color: 'purple', side: 'left' },
                { phase: 'Consent & Submit', steps: 'Terms Acceptance → Digital Signature → Review → Chunked Upload', color: 'violet', side: 'right' },
                { phase: 'Post-Submission', steps: 'Pending Dashboard → Limited Access (if incomplete) → Full Access', color: 'emerald', side: 'left' },
              ].map((item, i) => (
                <div key={item.phase} className={cn('flex items-center gap-6', item.side === 'right' ? 'md:flex-row-reverse' : '')}>
                  <div className={cn('flex-1', item.side === 'right' ? 'md:text-right' : '')}>
                    <div className={cn('inline-block bg-white rounded-xl border border-slate-200 p-4 shadow-sm',
                      item.side === 'right' ? 'md:ml-auto' : '')}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white',
                          `bg-${item.color}-500`)}
                          style={{ backgroundColor: item.color === 'blue' ? '#3b82f6' : item.color === 'indigo' ? '#6366f1' : item.color === 'purple' ? '#a855f7' : item.color === 'violet' ? '#8b5cf6' : '#10b981' }}>
                          {i + 1}
                        </span>
                        <p className="text-sm font-bold text-slate-900">{item.phase}</p>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{item.steps}</p>
                    </div>
                  </div>
                  <div className="hidden md:block w-3 h-3 rounded-full border-2 border-white shadow-md shrink-0"
                    style={{ backgroundColor: item.color === 'blue' ? '#3b82f6' : item.color === 'indigo' ? '#6366f1' : item.color === 'purple' ? '#a855f7' : item.color === 'violet' ? '#8b5cf6' : '#10b981' }} />
                  <div className="flex-1 hidden md:block" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-6 py-8 mt-12 border-t border-slate-200">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <p>BankCo Digital Onboarding — Interactive Prototype</p>
          <p>Built with React + Tailwind CSS</p>
        </div>
      </footer>
    </div>
  );
}
