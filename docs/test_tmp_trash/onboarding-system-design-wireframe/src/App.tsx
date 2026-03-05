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
                <span className="text-sm font-medium">Retour</span>
              </button>
              <div className="h-5 w-px bg-slate-300" />
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#E37B03] to-[#4A2205] flex items-center justify-center">
                  <span className="text-[10px] font-black text-white">BV</span>
                </div>
                <span className="font-bold text-slate-900 text-sm">BICEC VeriPass</span>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-orange-50 rounded-full px-4 py-1.5 border border-orange-100">
              <Smartphone className="w-4 h-4 text-[#E37B03]" />
              <span className="text-xs font-semibold text-[#E37B03]">Parcours mobile client</span>
            </div>
            <button onClick={() => setViewMode('backoffice')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              <Monitor className="w-4 h-4" /> Portail Back Office
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
                  <Smartphone className="w-5 h-5 text-blue-600" /> Expérience Mobile
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Ce prototype simule le parcours Flutter d'ouverture de compte BICEC. Naviguez en cliquant sur chaque étape.
                </p>
                <div className="space-y-2.5">
                  {[
                    { label: 'Mobile-First Android 8+', desc: 'Optimisé pour appareils Android courants' },
                    { label: 'Résilience hors-ligne', desc: 'Persistance locale & auto-reprise' },
                    { label: 'Upload par tranches', desc: 'Transferts fragmentés avec reprise auto' },
                    { label: 'OCR + Confiance', desc: 'Extraction intelligente avec correction' },
                    { label: 'Détection vivacité', desc: '3 tentatives max avec verrouillage' },
                    { label: 'Portail post-soumission', desc: 'En attente → Limité → Accès complet' },
                  ].map(item => (
                    <div key={item.label} className="flex items-start gap-2.5 px-3 py-2 bg-slate-50 rounded-lg">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#E37B03] mt-1.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-slate-700">{item.label}</p>
                        <p className="text-[11px] text-slate-500">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gradient-to-br from-[#E37B03] to-[#4A2205] rounded-2xl p-5 text-white space-y-3 shadow-lg shadow-orange-100">
                <p className="text-sm font-semibold">💡 Astuce : simulation hors-ligne</p>
                <p className="text-xs text-orange-50">Appuyez sur l'icône WiFi-off dans l'en-tête du téléphone pour simuler une coupure réseau.</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-sm">
                <p className="text-sm font-semibold text-slate-700">Navigation rapide</p>
                <p className="text-xs text-slate-500">Utilisez les points d'étape sous le téléphone pour sauter à n'importe quelle étape.</p>
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
              <ChevronRight className="w-3.5 h-3.5 rotate-180" /> Accueil
            </button>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">BICEC VeriPass — Portail KYC</span>
          </div>
          <button onClick={() => setViewMode('mobile')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">
            <Smartphone className="w-3.5 h-3.5" /> App Mobile
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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E37B03] to-[#4A2205] flex items-center justify-center shadow-lg shadow-orange-200">
              <span className="text-sm font-black text-white">BV</span>
            </div>
            <div>
              <p className="font-bold text-slate-900">BICEC VeriPass</p>
              <p className="text-[10px] text-slate-500 -mt-0.5">Plateforme KYC & Ouverture de Compte</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Prototype Interactif
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center space-y-6 mb-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-orange-50 rounded-full text-xs font-semibold text-[#E37B03] mb-4 border border-orange-100">
              <Shield className="w-3.5 h-3.5" /> Conforme COBAC · Mobile-First · KYC en temps réel
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">
              Ouvrir un compte BICEC
              <br />
              <span className="bg-gradient-to-r from-[#E37B03] to-[#4A2205] bg-clip-text text-transparent">en 15 minutes, pas 14 jours</span>
            </h1>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto mt-4 leading-relaxed">
              BICEC VeriPass — KYC numérique de bout en bout. De la capture CNI biométrique jusqu'au compte actif, sans visite obligatoire en agence.
            </p>
          </motion.div>

          {/* Hero metrics */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-5 mt-2">
            {[
              { before: '14 jours', after: '15 min', label: 'Délai d’ouverture', emoji: '⚡' },
              { before: 'Agence requise', after: '100% mobile', label: 'Parcours client', emoji: '📱' },
              { before: '76%', after: '98.4%', label: 'Score vivacité IA', emoji: '🧠' },
            ].map((m) => (
              <div key={m.label} className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-5 py-3 shadow-sm">
                <span className="text-2xl">{m.emoji}</span>
                <div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400 line-through">{m.before}</span>
                    <ArrowRight className="w-3 h-3 text-slate-300" />
                    <span className="font-black text-slate-900">{m.after}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5">{m.label}</p>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Demo CTAs */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            className="flex items-center justify-center gap-3 pt-2">
            <button onClick={() => setViewMode('mobile')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#E37B03] to-[#4A2205] text-white font-bold rounded-2xl shadow-lg shadow-orange-200 hover:shadow-xl hover:scale-105 transition-all text-sm">
              <Smartphone className="w-4 h-4" /> Lancer la Démo Mobile
            </button>
            <button onClick={() => setViewMode('backoffice')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white font-bold rounded-2xl shadow-sm hover:bg-slate-800 transition-all text-sm">
              <Monitor className="w-4 h-4" /> Portail Back Office
            </button>
          </motion.div>
        </div>

        {/* Three Personas */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="max-w-4xl mx-auto mb-12">
          <h3 className="text-center text-sm font-bold text-slate-500 uppercase tracking-wider mb-5">3 Rôles, 1 Plateforme</h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              { name: 'Jean-Pierre K.', role: 'Chargé KYC', desc: 'Valide les dossiers, vérifie OCR et vivacité', avatar: 'JP', color: 'emerald', view: 'backoffice' },
              { name: 'Thomas N.', role: 'Responsable AML/Ops', desc: 'Screening AML, déduplication, fráude', avatar: 'TN', color: 'orange', view: 'backoffice' },
              { name: 'Sylvie E.', role: 'Directrice', desc: 'KPIs, métriques nationales, pilotage', avatar: 'SE', color: 'purple', view: 'backoffice' },
            ].map((p) => (
              <button key={p.name} onClick={() => setViewMode('backoffice')}
                className="group bg-white rounded-2xl border border-slate-200 p-5 text-left hover:shadow-md hover:border-orange-200 transition-all">
                <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-black mb-4 shadow-sm',
                  p.color === 'emerald' ? 'bg-emerald-100 text-emerald-700' :
                    p.color === 'orange' ? 'bg-orange-100 text-[#E37B03]' : 'bg-purple-100 text-purple-700')}>{p.avatar}</div>
                <p className="font-bold text-slate-900 text-sm">{p.name}</p>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mt-0.5 mb-2">{p.role}</p>
                <p className="text-xs text-slate-400 leading-relaxed">{p.desc}</p>
                <div className="flex items-center gap-1 text-[11px] font-bold text-[#E37B03] mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  Se connecter <ArrowRight className="w-3 h-3" />
                </div>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Feature highlights */}
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h3 className="text-lg font-bold text-slate-900">Points Forts Architecture</h3>
            <p className="text-sm text-slate-500 mt-1">Conçu pour la sécurité, la résilience et la conformité COBAC</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Shield, label: 'Sécurité Bancaire', desc: 'Chiffrement E2E, PIN + biométrie, gestion sécurisée des documents', color: 'blue' },
              { icon: Zap, label: 'Résilience Hors-ligne', desc: 'Persistance locale, auto-reprise, uploads fragmentés avec retry', color: 'amber' },
              { icon: Eye, label: 'Vérification Intelligente', desc: 'OCR avec score de confiance, vivacité, correspondance faciale', color: 'emerald' },
              { icon: Monitor, label: 'Double Interface', desc: 'App mobile client + back-office web pour les chargés KYC', color: 'indigo' },
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
            <h3 className="text-lg font-bold text-slate-900">Vue d'overview du Parcours</h3>
            <p className="text-sm text-slate-500 mt-1">Cycle de vie complet du client : de l'inscription à l'accès plein</p>
          </div>
          <div className="relative">
            <div className="absolute top-0 bottom-0 left-[calc(50%-1px)] w-0.5 bg-gradient-to-b from-blue-300 via-indigo-300 to-emerald-300 hidden md:block" />
            <div className="space-y-4">
              {[
                { phase: 'Entrée & Auth', steps: 'Bienvenue → Langue → OTP téléphone → Email → PIN → Biométrie', color: 'blue', side: 'left' },
                { phase: 'Capture Identité', steps: 'CNI Recto/Verso → Revue OCR + Confiance → Détection Vivacité', color: 'indigo', side: 'right' },
                { phase: 'Adresse & NIU', steps: 'Région→Ville→Quartier→Commune → GPS → Facture ENEO/CAMWATER → NIU', color: 'purple', side: 'left' },
                { phase: 'Consentement & Soumission', steps: 'Acceptation CGU → Signature numérique → Récapitulatif → Upload chiffré', color: 'violet', side: 'right' },
                { phase: 'Post-Soumission', steps: 'En attente → Accès limité (sans NIU) → Accès complet', color: 'emerald', side: 'left' },
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
          <p>BICEC VeriPass — Prototype Interactif · Conforme COBAC</p>
          <p>Développé avec React + Tailwind CSS</p>
        </div>
      </footer>
    </div>
  );
}
