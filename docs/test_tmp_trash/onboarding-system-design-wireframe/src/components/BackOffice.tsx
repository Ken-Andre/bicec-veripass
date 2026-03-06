import { useState, useEffect } from 'react';
import {
  Search, CheckCircle, XCircle,
  Clock, AlertTriangle, Eye, User, CreditCard, Camera,
  FileText, MapPin, Shield, ScanLine, ThumbsUp, ThumbsDown,
  MessageSquare, ZoomIn,
  BarChart3, Users, Settings, Bell, LogOut,
  Check, X, Building2, LineChart, FileTerminal, ArrowRightLeft
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { MOCK_APPLICATIONS } from '@/data';
import type { ApplicationData } from '@/types';


const PERSONAS = {
  jean: {
    id: 'jean',
    name: 'Jean-Pierre K.',
    role: 'Chargé KYC (Validateur)',
    avatar: 'JP',
    color: 'emerald',
    description: 'Validation des dossiers, revue de cohérence et conformité.',
    permissions: ['agent-dashboard', 'applications', 'review', 'settings']
  },
  thomas: {
    id: 'thomas',
    name: 'Thomas N.',
    role: 'Responsable AML/Ops',
    avatar: 'TN',
    color: 'orange',
    description: 'Gestion des risques, détection de fraude et supervision.',
    permissions: ['thomas-dashboard', 'fraud', 'dedup', 'agencies', 'batch-amplitude', 'national-metrics', 'settings']
  },
  sylvie: {
    id: 'sylvie',
    name: 'Sylvie E.',
    role: 'Directrice (Metrics)',
    avatar: 'SE',
    color: 'purple',
    description: 'Tableaux de bord stratégiques, KPIs et pilotage.',
    permissions: ['dashboard', 'analytics', 'audit', 'reports', 'settings']
  }
} as const;

type PersonaId = keyof typeof PERSONAS;

export function BackOffice() {
  const [currentPersona, setCurrentPersona] = useState<PersonaId | null>(null);
  const [applications, setApplications] = useState<ApplicationData[]>(MOCK_APPLICATIONS);
  const [selectedApp, setSelectedApp] = useState<ApplicationData | null>(null);
  const [activeTab, setActiveTab] = useState<'identity' | 'address' | 'liveness' | 'summary'>('identity');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showAddAgencyModal, setShowAddAgencyModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [validatorNote, setValidatorNote] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showImageZoom, setShowImageZoom] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<string>('thomas-dashboard');

  // Set default view based on persona when logging in
  useEffect(() => {
    if (currentPersona === 'sylvie') setCurrentView('dashboard');
    else if (currentPersona === 'thomas') setCurrentView('thomas-dashboard');
    else setCurrentView('agent-dashboard');
  }, [currentPersona]);

  const filteredApps = applications.filter(a => {
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    if (searchQuery && !a.fullName.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !a.id.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const statusCounts = {
    all: applications.length,
    pending: applications.filter(a => a.status === 'pending').length,
    approved: applications.filter(a => a.status === 'approved').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
    limited: applications.filter(a => a.status === 'limited').length,
  };

  const handleApprove = (appId: string) => {
    setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: 'approved' as const, validatorNotes: validatorNote } : a));
    if (selectedApp?.id === appId) {
      setSelectedApp(prev => prev ? { ...prev, status: 'approved', validatorNotes: validatorNote } : null);
    }
    setValidatorNote('');
  };

  const handleReject = (appId: string) => {
    setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: 'rejected' as const, rejectionReason: rejectReason, validatorNotes: validatorNote } : a));
    if (selectedApp?.id === appId) {
      setSelectedApp(prev => prev ? { ...prev, status: 'rejected', rejectionReason: rejectReason, validatorNotes: validatorNote } : null);
    }
    setRejectReason('');
    setValidatorNote('');
    setShowRejectModal(false);
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-700 border-amber-200',
      approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      rejected: 'bg-red-100 text-red-700 border-red-200',
      limited: 'bg-orange-100 text-orange-700 border-orange-200',
    };
    const icons: Record<string, React.ReactNode> = {
      pending: <Clock className="w-3 h-3" />,
      approved: <CheckCircle className="w-3 h-3" />,
      rejected: <XCircle className="w-3 h-3" />,
      limited: <AlertTriangle className="w-3 h-3" />,
    };
    return (
      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border', styles[status])}>
        {icons[status]} {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const confidenceBar = (c: number) => (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', c >= 90 ? 'bg-emerald-500' : c >= 70 ? 'bg-amber-500' : 'bg-red-500')}
          style={{ width: `${c}%` }} />
      </div>
      <span className={cn('text-xs font-mono font-bold', c >= 90 ? 'text-emerald-600' : c >= 70 ? 'text-amber-600' : 'text-red-600')}>{c}%</span>
    </div>
  );

  const DocumentPlaceholder = ({ label, type }: { label: string; type: 'id-front' | 'id-back' | 'selfie' | 'proof' | 'signature' }) => {
    if (type === 'id-front') {
      return (
        <button onClick={() => setShowImageZoom(label)}
          className="group relative w-full rounded-xl overflow-hidden border border-slate-200 hover:border-[#E37B03] transition-all hover:shadow-lg cursor-pointer">
          <svg viewBox="0 0 320 200" className="w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="bo-cni-bg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#1a3a6b" />
                <stop offset="100%" stopColor="#0d2247" />
              </linearGradient>
            </defs>
            <rect width="320" height="200" fill="url(#bo-cni-bg)" rx="6" />
            <rect x="0" y="0" width="320" height="14" fill="#16a34a" rx="6" />
            <rect x="0" y="8" width="320" height="6" fill="#16a34a" />
            <rect x="0" y="186" width="320" height="14" fill="#dc2626" />
            <text x="160" y="11" textAnchor="middle" fill="white" fontSize="5.5" fontWeight="bold" fontFamily="Arial">RÉPUBLIQUE DU CAMEROUN / REPUBLIC OF CAMEROON</text>
            <text x="160" y="26" textAnchor="middle" fill="#fcd34d" fontSize="8" fontWeight="bold" fontFamily="Arial">CARTE NATIONALE D'IDENTITÉ BIOMÉTRIQUE</text>
            <rect x="12" y="38" width="56" height="74" fill="#2d5a9e" rx="3" />
            <circle cx="40" cy="62" r="14" fill="#4a7ab5" />
            <ellipse cx="40" cy="84" rx="18" ry="11" fill="#4a7ab5" />
            <rect x="12" y="118" width="56" height="10" fill="#0f1f3d" rx="1" />
            <text x="40" y="126" textAnchor="middle" fill="#60a5fa" fontSize="3.5" fontFamily="monospace">MBARGA&lt;&lt;ADJOUA</text>
            <text x="80" y="48" fill="#93c5fd" fontSize="5" fontFamily="Arial">NOM / SURNAME</text>
            <text x="80" y="57" fill="white" fontSize="7.5" fontWeight="bold" fontFamily="Arial">MBARGA</text>
            <text x="80" y="70" fill="#93c5fd" fontSize="5" fontFamily="Arial">PRÉNOM(S) / GIVEN NAMES</text>
            <text x="80" y="79" fill="white" fontSize="7" fontWeight="bold" fontFamily="Arial">Adjoua Cécile</text>
            <text x="80" y="92" fill="#93c5fd" fontSize="5" fontFamily="Arial">NÉ(E) LE / DATE OF BIRTH</text>
            <text x="80" y="101" fill="white" fontSize="7" fontFamily="Arial">14/06/1992 — YAOUNDÉ</text>
            <text x="80" y="113" fill="#93c5fd" fontSize="5" fontFamily="Arial">NATIONALITÉ</text>
            <text x="80" y="122" fill="white" fontSize="7" fontFamily="Arial">CAMEROUNAISE  F</text>
            <text x="200" y="48" fill="#93c5fd" fontSize="5" fontFamily="Arial">EXPIRATION</text>
            <text x="200" y="58" fill="#fcd34d" fontSize="7" fontWeight="bold" fontFamily="Arial">14/06/2033</text>
            <rect x="0" y="132" width="320" height="16" fill="#0a1a3a" />
            <text x="8" y="141" fill="#60a5fa" fontSize="4" fontFamily="monospace">IDCMRMBARGA&lt;&lt;ADJOUA&lt;CECILE&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</text>
            <text x="8" y="150" fill="#60a5fa" fontSize="4" fontFamily="monospace">YA0120090012345&lt;9206148F3306144CMR&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;4</text>
          </svg>
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
            <ZoomIn className="w-6 h-6 text-white" />
          </div>
        </button>
      );
    }
    if (type === 'id-back') {
      return (
        <button onClick={() => setShowImageZoom(label)}
          className="group relative w-full rounded-xl overflow-hidden border border-slate-200 hover:border-[#E37B03] transition-all hover:shadow-lg cursor-pointer">
          <svg viewBox="0 0 320 200" className="w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="bo-cni-bg2" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#1a3a6b" />
                <stop offset="100%" stopColor="#0d2247" />
              </linearGradient>
            </defs>
            <rect width="320" height="200" fill="url(#bo-cni-bg2)" rx="6" />
            <rect x="0" y="0" width="320" height="14" fill="#16a34a" rx="6" />
            <rect x="0" y="8" width="320" height="6" fill="#16a34a" />
            <rect x="0" y="186" width="320" height="14" fill="#dc2626" />
            <text x="8" y="30" fill="#93c5fd" fontSize="5.5" fontFamily="Arial">N° NATIONAL / NATIONAL ID NO.</text>
            <rect x="8" y="33" width="170" height="15" fill="#0f1f3d" rx="2" />
            <text x="12" y="44" fill="#fcd34d" fontSize="8.5" fontWeight="bold" fontFamily="monospace">YA01 2009 0012345678901</text>
            <rect x="240" y="26" width="72" height="54" fill="#0f1f3d" rx="3" />
            {[8, 13, 18, 23, 28].map((r, i) => <ellipse key={i} cx="276" cy="60" rx={r} ry={r * 0.75} fill="none" stroke="#60a5fa" strokeWidth="0.7" opacity="0.7" />)}
            <text x="276" y="38" textAnchor="middle" fill="#60a5fa" fontSize="5.5" fontFamily="Arial">EMPREINTE</text>
            <text x="8" y="64" fill="#93c5fd" fontSize="5.5" fontFamily="Arial">ADRESSE / ADDRESS</text>
            <text x="8" y="73" fill="white" fontSize="7" fontFamily="Arial">Avenue Jean Paul II, Bastos — YAOUNDÉ I</text>
            <text x="8" y="85" fill="#93c5fd" fontSize="5.5" fontFamily="Arial">DÉLIVREee LE / ISSUED ON</text>
            <text x="8" y="94" fill="white" fontSize="7" fontFamily="Arial">14/06/2023 à YAOUNDÉ</text>
            <path d="M8,115 Q32,98 58,112 T92,107 Q110,103 125,110" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="220" y="100" width="50" height="36" fill="#d4a017" rx="4" />
            <rect x="226" y="106" width="38" height="24" fill="#c8951a" rx="2" />
            <line x1="234" y1="106" x2="234" y2="130" stroke="#d4a017" strokeWidth="0.8" />
            <line x1="244" y1="106" x2="244" y2="130" stroke="#d4a017" strokeWidth="0.8" />
            <line x1="226" y1="115" x2="264" y2="115" stroke="#d4a017" strokeWidth="0.8" />
            <line x1="226" y1="122" x2="264" y2="122" stroke="#d4a017" strokeWidth="0.8" />
            <rect x="0" y="145" width="320" height="16" fill="#0a1a3a" />
            <text x="8" y="155" fill="#60a5fa" fontSize="4" fontFamily="monospace">YA0120090012345678901CMR9206148F3306144&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</text>
          </svg>
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
            <ZoomIn className="w-6 h-6 text-white" />
          </div>
        </button>
      );
    }

    const bgColors: Record<string, string> = {
      'selfie': 'from-orange-800 to-orange-950',
      'proof': 'from-amber-700 to-orange-800',
      'signature': 'from-slate-100 to-white',
    };
    const icons: Record<string, React.ReactNode> = {
      'selfie': <Camera className="w-8 h-8 text-white/50" />,
      'proof': <FileText className="w-8 h-8 text-white/50" />,
      'signature': <FileText className="w-8 h-8 text-slate-300" />,
    };

    return (
      <button onClick={() => setShowImageZoom(label)}
        className="group relative aspect-[4/3] rounded-xl overflow-hidden border border-slate-200 hover:border-[#E37B03] transition-all hover:shadow-lg cursor-pointer">
        <div className={cn('w-full h-full bg-gradient-to-br flex flex-col items-center justify-center gap-2', bgColors[type])}>
          {icons[type]}
          <span className={cn('text-xs font-medium', type === 'signature' ? 'text-slate-400' : 'text-white/60')}>{label}</span>
          {type === 'signature' && (
            <svg viewBox="0 0 200 60" className="absolute inset-x-4 bottom-4 w-[calc(100%-2rem)]">
              <path d="M20,40 Q40,10 60,35 T100,30 Q120,25 140,35 T180,25" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </div>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
          <ZoomIn className="w-6 h-6 text-white" />
        </div>
      </button>
    );
  };

  const persona = currentPersona ? PERSONAS[currentPersona] : null;

  if (!persona) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-[#E37B03] shadow-xl shadow-orange-200 mb-6">
              <span className="text-2xl font-black text-white">BV</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900">BICEC VeriPass</h1>
            <p className="text-slate-500 mt-2 text-lg">Portail Interne de Validation & Pilotage</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {(Object.values(PERSONAS)).map((p) => (
              <button
                key={p.id}
                onClick={() => setCurrentPersona(p.id as PersonaId)}
                className="group relative bg-white rounded-3xl border border-slate-200 p-8 text-left hover:border-orange-300 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1"
              >
                <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-md shadow-slate-100 group-hover:scale-110 transition-transform',
                  p.color === 'emerald' ? 'bg-emerald-100 text-emerald-600' :
                    p.color === 'orange' ? 'bg-orange-100 text-[#E37B03]' :
                      'bg-purple-100 text-purple-600'
                )}>
                  <User className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">{p.name}</h3>
                <p className="text-xs font-semibold text-slate-500 mb-4">{p.role}</p>
                <p className="text-xs text-slate-400 leading-relaxed mb-6">
                  {p.description}
                </p>
                <div className="flex items-center gap-2 text-xs font-bold text-[#E37B03] opacity-0 group-hover:opacity-100 transition-opacity">
                  Se connecter <Check className="w-3.5 h-3.5" />
                </div>
              </button>
            ))}
          </div>

          <p className="text-center text-slate-400 text-xs mt-12">
            Usage interne uniquement • BICEC Compliance Framework v2.6
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-slate-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E37B03] flex items-center justify-center shadow-md">
              <span className="text-sm font-black text-white">BV</span>
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm">BICEC VeriPass</p>
              <p className="text-xs text-slate-500">Portail KYC</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto min-h-0">
          {[
            { icon: BarChart3, label: 'Dashboard', id: 'dashboard', access: ['dashboard'] },
            { icon: BarChart3, label: 'Dashboard Agent', id: 'agent-dashboard', access: ['agent-dashboard'] },
            { icon: Users, label: 'Applications', id: 'applications', access: ['applications'] },
            { icon: Shield, label: 'Dashboard National', id: 'thomas-dashboard', access: ['thomas-dashboard'] },
            { icon: AlertTriangle, label: 'Screening AML', id: 'fraud', access: ['fraud'] },
            { icon: ArrowRightLeft, label: 'Déduplication', id: 'dedup', access: ['dedup'] },
            { icon: Building2, label: 'Agences', id: 'agencies', access: ['agencies'] },
            { icon: FileTerminal, label: 'Batch Amplitude', id: 'batch-amplitude', access: ['batch-amplitude'] },
            { icon: LineChart, label: 'Métriques', id: 'national-metrics', access: ['national-metrics'] },
            { icon: FileTerminal, label: 'Audit & Rapports', id: 'audit', access: ['audit', 'reports'] },
            { icon: Settings, label: 'Paramètres', id: 'settings', access: ['settings'] },
          ].filter(item => item.access.some(a => (persona.permissions as any).includes(a))).map(item => (
            <button key={item.label}
              onClick={() => setCurrentView(item.id)}
              className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                currentView === item.id ? 'bg-orange-50 text-orange-800' : 'text-slate-600 hover:bg-slate-50')}>
              <item.icon className={cn('w-4.5 h-4.5', currentView === item.id ? 'text-[#E37B03]' : 'text-slate-400')} />
              {item.label}
              {item.label === 'Applications' && (
                <span className="ml-auto text-xs bg-[#E37B03] text-white rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                  {statusCounts.pending}
                </span>
              )}
            </button>
          ))}
        </nav>


        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold',
              persona.color === 'emerald' ? 'bg-emerald-100 text-emerald-700' :
                persona.color === 'orange' ? 'bg-orange-100 text-orange-700' :
                  'bg-purple-100 text-purple-700'
            )}>
              {persona.avatar}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-900">{persona.name}</p>
              <p className="text-[10px] text-slate-500">{persona.role}</p>
            </div>
            <button onClick={() => setCurrentPersona(null)} className="ml-auto text-slate-400 hover:text-red-500 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Revue Dossiers KYC — BICEC VeriPass</h1>
            <p className="text-xs text-slate-500">Vérification et validation des dossiers d'ouverture de compte</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-xl hover:bg-slate-100 text-slate-500">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex items-center gap-4 text-xs">
              {Object.entries(statusCounts).filter(([k]) => k !== 'all').map(([key, count]) => (
                <div key={key} className="flex items-center gap-1.5">
                  {statusBadge(key)}
                  <span className="font-bold text-slate-700">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Dashboard View — Sylvie (Direction / Metrics) */}
          {currentView === 'dashboard' && (
            <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Tableau de Bord — Pilotage KYC</h2>
                  <p className="text-slate-500 text-sm">Métriques temps réel · Dernières 24h</p>
                </div>
                <button className="bg-[#E37B03] text-white rounded-xl px-5 py-2.5 text-sm font-bold shadow-md shadow-orange-200 hover:bg-orange-600 transition-colors">
                  Exporter Rapport
                </button>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Dossiers Reçus', value: '1 284', trend: '+12%', up: true, icon: Users },
                  { label: 'En Attente', value: String(statusCounts.pending), trend: '−5%', up: false, icon: Clock },
                  { label: 'Taux Approbation', value: '94.2%', trend: '+0.8%', up: true, icon: CheckCircle },
                  { label: 'Délai Moyen', value: '42 min', trend: '−8 min', up: true, icon: Clock },
                ].map(kpi => (
                  <div key={kpi.label} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <kpi.icon className="w-5 h-5 text-[#E37B03]" />
                      <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-md',
                        kpi.up ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600')}>
                        {kpi.trend}
                      </span>
                    </div>
                    <h4 className="text-2xl font-black text-slate-900">{kpi.value}</h4>
                    <p className="text-xs text-slate-500 mt-1">{kpi.label}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-4">
                {/* Bar Chart — Weekly Throughput */}
                <div className="col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">Dossiers traités par jour (7 derniers jours)</h3>
                  <div className="flex items-end gap-3 h-48">
                    {[
                      { day: 'Lun', val: 42 }, { day: 'Mar', val: 58 }, { day: 'Mer', val: 35 },
                      { day: 'Jeu', val: 67 }, { day: 'Ven', val: 52 }, { day: 'Sam', val: 18 }, { day: 'Dim', val: 8 },
                    ].map(d => (
                      <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[10px] font-bold text-slate-600">{d.val}</span>
                        <div className="w-full rounded-t-lg bg-[#E37B03] transition-all" style={{ height: `${(d.val / 67) * 100}%`, opacity: d.val > 50 ? 1 : 0.6 }} />
                        <span className="text-[10px] text-slate-400 font-medium">{d.day}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Donut Chart — Status Distribution */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">Répartition des statuts</h3>
                  <div className="flex items-center justify-center">
                    <svg viewBox="0 0 36 36" className="w-32 h-32">
                      {/* Approved 60% */}
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#10b981" strokeWidth="3.8"
                        strokeDasharray="60 40" strokeDashoffset="25" />
                      {/* Pending 22% */}
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f59e0b" strokeWidth="3.8"
                        strokeDasharray="22 78" strokeDashoffset="65" />
                      {/* Rejected 10% */}
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#ef4444" strokeWidth="3.8"
                        strokeDasharray="10 90" strokeDashoffset="43" />
                      {/* Limited 8% */}
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#E37B03" strokeWidth="3.8"
                        strokeDasharray="8 92" strokeDashoffset="33" />
                      <text x="18" y="18.5" textAnchor="middle" className="text-[5px] font-black fill-slate-800">1 284</text>
                      <text x="18" y="22" textAnchor="middle" className="text-[2.5px] fill-slate-400">dossiers</text>
                    </svg>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {[
                      { label: 'Approuvé', pct: '60%', color: 'bg-emerald-500' },
                      { label: 'En attente', pct: '22%', color: 'bg-amber-500' },
                      { label: 'Rejeté', pct: '10%', color: 'bg-red-500' },
                      { label: 'Limité', pct: '8%', color: 'bg-[#E37B03]' },
                    ].map(s => (
                      <div key={s.label} className="flex items-center gap-2 text-xs">
                        <div className={cn('w-2.5 h-2.5 rounded-full', s.color)} />
                        <span className="text-slate-600">{s.label}</span>
                        <span className="ml-auto font-bold text-slate-900">{s.pct}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Funnel + Recent Activity */}
              <div className="grid grid-cols-2 gap-4">
                {/* Conversion Funnel */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">Entonnoir de Conversion</h3>
                  <div className="space-y-2">
                    {[
                      { step: 'Inscription', val: 1284, pct: 100 },
                      { step: 'OTP Vérifié', val: 1180, pct: 92 },
                      { step: 'CNI Scannée', val: 1050, pct: 82 },
                      { step: 'Liveness OK', val: 980, pct: 76 },
                      { step: 'Dossier Soumis', val: 920, pct: 72 },
                      { step: 'Approuvé', val: 770, pct: 60 },
                    ].map(f => (
                      <div key={f.step} className="flex items-center gap-3">
                        <span className="text-xs text-slate-500 w-28 shrink-0">{f.step}</span>
                        <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-[#E37B03] transition-all" style={{ width: `${f.pct}%`, opacity: 0.3 + (f.pct / 100) * 0.7 }} />
                        </div>
                        <span className="text-xs font-bold text-slate-700 w-12 text-right">{f.val}</span>
                        <span className="text-[10px] text-slate-400 w-8">{f.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Decisions */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">Dernières Décisions</h3>
                  <div className="space-y-3">
                    {applications.slice(0, 5).map(app => (
                      <div key={app.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
                          app.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                            app.status === 'rejected' ? 'bg-red-100 text-red-700' :
                              app.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                'bg-orange-100 text-orange-700')}>
                          {app.fullName.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-900 truncate">{app.fullName}</p>
                          <p className="text-[10px] text-slate-400">{new Date(app.submittedAt).toLocaleDateString('fr-FR')}</p>
                        </div>
                        {statusBadge(app.status)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Agent Dashboard & Performance View — Jean (Chargé KYC) */}
          {currentView === 'agent-dashboard' && (
            <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Tableau de Bord — Agent KYC</h2>
                  <p className="text-slate-500 text-sm">Vos objectifs et performances d'agence</p>
                </div>
                <button onClick={() => setCurrentView('applications')} className="bg-[#E37B03] text-white rounded-xl px-5 py-2.5 text-sm font-bold shadow-md shadow-orange-200 hover:bg-orange-600 transition-colors">
                  Voir ma file
                </button>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-3 gap-6">
                {/* Ring Daily Target */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center gap-6">
                  <div className="relative w-20 h-20">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path className="text-slate-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                      <path className="text-[#E37B03] drop-shadow-sm" strokeDasharray="65, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                      <span className="text-lg font-black text-slate-900">65%</span>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-500">Objectif Quotidien</h3>
                    <p className="text-2xl font-black text-slate-900 mt-1">13 <span className="text-base font-medium text-slate-400">/ 20</span></p>
                    <p className="text-xs text-emerald-600 font-medium mt-1">Excellent rythme</p>
                  </div>
                </div>

                {/* Agency Stats */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-center">
                  <div className="flex items-center gap-3 text-slate-500 mb-2">
                    <Building2 className="w-5 h-5 text-[#E37B03]" />
                    <h3 className="text-sm font-bold">En attente (Agence)</h3>
                  </div>
                  <p className="text-3xl font-black text-slate-900">42</p>
                  <p className="text-xs text-slate-400 mt-2">Dossiers à traiter par l'équipe</p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-center">
                  <div className="flex items-center gap-3 text-slate-500 mb-2">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                    <h3 className="text-sm font-bold">FTR Collectif</h3>
                  </div>
                  <p className="text-3xl font-black text-slate-900">88%</p>
                  <p className="text-xs text-emerald-600 bg-emerald-50 w-max px-2 py-0.5 rounded mt-2">+2% vs hier</p>
                </div>
              </div>

              {/* Table last 5 */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">Mes derniers dossiers traités</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="p-4 border-b border-slate-200">ID</th>
                        <th className="p-4 border-b border-slate-200">Client</th>
                        <th className="p-4 border-b border-slate-200">Soumission</th>
                        <th className="p-4 border-b border-slate-200">Décision</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-slate-100">
                      {applications.slice(0, 5).map(app => (
                        <tr key={app.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 font-medium text-slate-900">{app.id}</td>
                          <td className="p-4 font-medium text-slate-700">{app.fullName}</td>
                          <td className="p-4 text-slate-500">{new Date(app.submittedAt).toLocaleDateString('fr-FR')}</td>
                          <td className="p-4">{statusBadge(app.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Déduplication View — Thomas */}
          {currentView === 'dedup' && (
            <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Résolution de Conflits — Déduplication</h2>
                  <p className="text-slate-500 text-sm">Comptes potentiellement multiples pour le même individu</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                <div className="flex max-w-4xl mx-auto gap-8 items-stretch relative">
                  {/* Profile 1 */}
                  <div className="flex-1 rounded-xl border-2 border-slate-100 p-6 bg-slate-50 relative">
                    <span className="absolute top-4 right-4 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-1 rounded">COMPTE ACTIF</span>
                    <div className="w-24 h-24 bg-slate-200 rounded-full mx-auto mb-6 flex items-center justify-center overflow-hidden">
                      <User className="w-10 h-10 text-slate-400" />
                    </div>
                    <h3 className="text-center font-black text-slate-900 text-lg mb-6">M. Cédric M.</h3>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 mb-1">Date de naissance</p>
                        <p className="font-medium bg-orange-100/50 text-orange-900 p-2 rounded border border-orange-200">12/04/1985</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 mb-1">Téléphone</p>
                        <p className="font-medium text-slate-900 p-2">+237 6 99 XX XX 42</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 mb-1">N° CNI</p>
                        <p className="font-medium bg-orange-100/50 text-orange-900 p-2 rounded border border-orange-200">123456789</p>
                      </div>
                    </div>
                  </div>

                  {/* Match Icon */}
                  <div className="w-16 flex items-center justify-center relative">
                    <div className="absolute top-1/3 -translate-y-1/2 flex flex-col items-center">
                      <div className="w-12 h-12 bg-orange-100 text-[#E37B03] rounded-full flex items-center justify-center shadow-md shadow-orange-200 border-2 border-white z-10">
                        <ArrowRightLeft className="w-6 h-6" />
                      </div>
                      <span className="mt-2 text-sm font-black text-[#E37B03]">95%</span>
                      <span className="text-[10px] text-slate-500 text-center font-bold">SIMILITUDE</span>
                    </div>
                  </div>

                  {/* Profile 2 */}
                  <div className="flex-1 rounded-xl border-2 border-[#E37B03] p-6 bg-orange-50/30 relative shadow-md shadow-orange-100/50">
                    <span className="absolute top-4 right-4 bg-orange-100 text-orange-800 text-[10px] font-bold px-2 py-1 rounded">NOUVELLE DEMANDE</span>
                    <div className="w-24 h-24 bg-slate-200 rounded-full mx-auto mb-6 flex items-center justify-center overflow-hidden">
                      <User className="w-10 h-10 text-slate-400" />
                    </div>
                    <h3 className="text-center font-black text-slate-900 text-lg mb-6">Cédric M.</h3>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 mb-1">Date de naissance</p>
                        <p className="font-medium bg-orange-100/50 text-orange-900 p-2 rounded border border-orange-200">12/04/1985</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 mb-1">Téléphone</p>
                        <p className="font-medium text-slate-900 p-2">+237 6 77 Y Y Y 11</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 mb-1">N° CNI</p>
                        <p className="font-medium bg-orange-100/50 text-orange-900 p-2 rounded border border-orange-200">123456789</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="max-w-4xl mx-auto mt-8 flex justify-end gap-3 pt-6 border-t border-slate-100">
                  <button className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors">
                    Escalader Level 3
                  </button>
                  <button className="px-5 py-2.5 rounded-xl bg-red-50 text-red-700 font-semibold text-sm hover:bg-red-100 transition-colors">
                    Rejeter comme doublon (Fraude)
                  </button>
                  <button className="px-5 py-2.5 rounded-xl bg-[#E37B03] text-white font-semibold text-sm hover:bg-orange-600 transition-colors shadow-md shadow-orange-200">
                    Fusionner (Mise à jour)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Admin Agences View — Thomas */}
          {currentView === 'agencies' && (
            <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Administration des Agences</h2>
                  <p className="text-slate-500 text-sm">Gestion du réseau BICEC et affectation du routing</p>
                </div>
                <button onClick={() => setShowAddAgencyModal(true)} className="bg-[#2563EB] text-white rounded-xl px-5 py-2.5 text-sm font-bold shadow-md shadow-blue-200 hover:bg-blue-700 transition-colors flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Ajouter une agence
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="p-4 border-b border-slate-200">Code</th>
                        <th className="p-4 border-b border-slate-200">Nom Agence</th>
                        <th className="p-4 border-b border-slate-200">Ville / Région</th>
                        <th className="p-4 border-b border-slate-200 text-center">Agents Actifs</th>
                        <th className="p-4 border-b border-slate-200 text-center">Routing</th>
                        <th className="p-4 border-b border-slate-200"></th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-slate-100">
                      {[
                        { code: 'B-001', name: 'Agence Bonanjo Principale', city: 'Douala, Littoral', agents: 4, active: true },
                        { code: 'B-002', name: 'Agence Akwa Liberté', city: 'Douala, Littoral', agents: 2, active: true },
                        { code: 'Y-001', name: 'Agence Yaoundé Centre', city: 'Yaoundé, Centre', agents: 5, active: true },
                        { code: 'B-015', name: 'Point de service Mboppi', city: 'Douala, Littoral', agents: 0, active: false },
                      ].map(ag => (
                        <tr key={ag.code} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 font-mono font-medium text-slate-500">{ag.code}</td>
                          <td className="p-4 font-bold text-slate-900">{ag.name}</td>
                          <td className="p-4 text-slate-500">{ag.city}</td>
                          <td className="p-4 text-center font-medium text-slate-700">{ag.agents}</td>
                          <td className="p-4 text-center">
                            <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold', ag.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500')}>
                              {ag.active ? 'ACTIF' : 'SUSPENDU'}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <button className="text-blue-600 font-medium text-xs hover:underline">Gérer</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Add Agency Modal */}
              {showAddAgencyModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                  <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                    <div className="flex items-center justify-between p-5 border-b border-slate-100">
                      <h3 className="font-bold text-slate-900 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-[#2563EB]" /> Ajouter une Agence
                      </h3>
                      <button onClick={() => setShowAddAgencyModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto overflow-x-hidden">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nom de l'agence</label>
                        <input type="text" placeholder="Ex: Agence Bonanjo" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Code Agence</label>
                          <input type="text" placeholder="Ex: B-020" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Ville</label>
                          <input type="text" placeholder="Ex: Douala" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                        </div>
                      </div>

                      <div className="border-t border-slate-100 pt-4 mt-2">
                        <h4 className="text-xs font-bold text-slate-900 mb-3 flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-slate-400" /> Données de Routing Automatique
                        </h4>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Adresse Complète (Quartier/Rue)</label>
                            <input type="text" placeholder="Ex: Bonanjo, Rue Joss, face direction générale" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                            <p className="text-[10px] text-slate-500 mt-1">Utilisé pour le matching de similarité avec l'adresse saisie par le client.</p>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Latitude (GPS)</label>
                              <input type="text" placeholder="Ex: 4.0416" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Longitude (GPS)</label>
                              <input type="text" placeholder="Ex: 9.6954" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Alias OCR Facture (Eneo / CamWater)</label>
                            <input type="text" placeholder="Ex: DOUALA-BONANJO, AKWA-SUD" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                            <p className="text-[10px] text-slate-500 mt-1">Tags séparés par virgules. Assigne le dossier à cette agence si l'OCR détecte l'un de ces libellés sur le justificatif.</p>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 flex items-center justify-between border-t border-slate-100">
                        <span className="text-sm font-medium text-slate-700">Activer le routing immédiat</span>
                        <button className="w-10 h-6 bg-blue-600 rounded-full relative transition-colors focus:outline-none shrink-0">
                          <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform translate-x-4 shadow-sm" />
                        </button>
                      </div>
                    </div>
                    <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                      <button onClick={() => setShowAddAgencyModal(false)} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors">Annuler</button>
                      <button onClick={() => setShowAddAgencyModal(false)} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-[#2563EB] hover:bg-blue-700 shadow-sm transition-colors">Créer l'agence</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Batch Amplitude Monitor View — Thomas */}
          {currentView === 'batch-amplitude' && (
            <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Monitorage Provisioning & Batch</h2>
                  <p className="text-slate-500 text-sm">Synchronisation des profils validés vers le Core Banking (Amplitude)</p>
                </div>
                <button className="bg-white border border-slate-200 text-slate-700 rounded-xl px-5 py-2.5 text-sm font-bold shadow-sm hover:bg-slate-50 transition-colors flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> Relancer Échecs
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h3 className="text-sm font-semibold text-slate-700">Chronologie des Batchs d'Intégration</h3>
                </div>
                <div className="divide-y divide-slate-100 p-2">
                  {[
                    { date: '22 Fév 2026, 14:00', total: 45, success: 45, failed: 0, status: 'success', id: 'BCH-8902' },
                    { date: '22 Fév 2026, 13:00', total: 52, success: 50, failed: 2, status: 'warning', id: 'BCH-8901' },
                    { date: '22 Fév 2026, 12:00', total: 38, success: 38, failed: 0, status: 'success', id: 'BCH-8900' },
                    { date: '22 Fév 2026, 11:00', total: 61, success: 0, failed: 61, status: 'error', id: 'BCH-8899' },
                  ].map((batch, i) => (
                    <div key={i} className="px-4 py-4 flex items-center gap-6 hover:bg-slate-50 transition-colors rounded-xl m-2">
                      <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border-2',
                        batch.status === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                          batch.status === 'warning' ? 'bg-amber-50 border-amber-100 text-amber-600' :
                            'bg-red-50 border-red-100 text-red-600'
                      )}>
                        {batch.status === 'success' ? <CheckCircle className="w-6 h-6" /> :
                          batch.status === 'warning' ? <AlertTriangle className="w-6 h-6" /> :
                            <XCircle className="w-6 h-6" />}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <p className="text-sm font-bold text-slate-900">{batch.date}</p>
                          <span className="text-[10px] uppercase font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded">{batch.id}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-semibold">
                          <span className="text-slate-500">Total: {batch.total} dossiers</span>
                          <span className="text-emerald-600">{batch.success} succès</span>
                          {batch.failed > 0 && <span className="text-red-500 bg-red-50 px-1.5 py-0.5 rounded">{batch.failed} échecs</span>}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {batch.status !== 'success' && (
                          <button className="px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                            Voir logs
                          </button>
                        )}
                        {batch.status === 'error' && (
                          <button className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm">
                            Retry
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Métriques Nationales View — Thomas */}
          {currentView === 'national-metrics' && (
            <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Métriques Nationales</h2>
                  <p className="text-slate-500 text-sm">Vue consolidée du réseau et performance AML</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Bar chart per agency */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-700 mb-6">Volume de KYC par Agence (Top 5)</h3>
                  <div className="space-y-4">
                    {[
                      { name: 'Bonanjo Principale', val: 450, pct: 100 },
                      { name: 'Yaoundé Centre', val: 320, pct: 71 },
                      { name: 'Akwa Liberté', val: 280, pct: 62 },
                      { name: 'Bafoussam Marché', val: 190, pct: 42 },
                      { name: 'Garoua Centre', val: 110, pct: 24 },
                    ].map(ag => (
                      <div key={ag.name}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-semibold text-slate-700">{ag.name}</span>
                          <span className="font-bold text-slate-900">{ag.val}</span>
                        </div>
                        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 rounded-full" style={{ width: `${ag.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700">Taux d'Approbation National</h3>
                      <p className="text-4xl font-black text-slate-900 mt-2">76.4%</p>
                      <p className="text-xs text-emerald-600 mt-1 font-medium">+1.2% ce mois</p>
                    </div>
                    <div className="w-24 h-24 relative">
                      <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                        <circle cx="18" cy="18" r="15.9155" fill="transparent" stroke="#f1f5f9" strokeWidth="4" />
                        <circle cx="18" cy="18" r="15.9155" fill="transparent" stroke="#E37B03" strokeWidth="4" strokeDasharray="76.4 100" className="drop-shadow" />
                      </svg>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-700 mb-4">Délai moyen de traitement</h3>
                    <div className="flex items-end gap-4">
                      <p className="text-3xl font-black text-slate-900">4m 12s</p>
                      <p className="text-xs text-slate-500 mb-1">Cible: <span className="font-bold text-slate-700">5m 00s</span></p>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-100 flex gap-4">
                      <div className="flex-1">
                        <p className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Automatique</p>
                        <p className="text-sm font-bold text-slate-900 mt-0.5">0m 45s</p>
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Validation Manuelle</p>
                        <p className="text-sm font-bold text-slate-900 mt-0.5">3m 27s</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Audit Log Viewer — Sylvie */}
          {currentView === 'audit' && (
            <div className="flex-1 overflow-y-auto p-8 bg-slate-50 flex flex-col h-full">
              <div className="flex items-center justify-between mb-6 shrink-0">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Logs d'Audit & Opérations</h2>
                  <p className="text-slate-500 text-sm">Traçabilité complète des actions (Conformité COBAC)</p>
                </div>
                <div className="flex gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder="Rechercher IP, Utilisateur, ID..." className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#E37B03]/20 focus:border-[#E37B03]" />
                  </div>
                  <button className="bg-white border border-slate-200 text-slate-700 rounded-xl px-4 py-2 text-sm font-bold hover:bg-slate-50 transition-colors flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Export CSV
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col">
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                        <th className="p-4 border-b border-slate-200">Date & Heure</th>
                        <th className="p-4 border-b border-slate-200">Utilisateur</th>
                        <th className="p-4 border-b border-slate-200">Action</th>
                        <th className="p-4 border-b border-slate-200">Cible (Dossier/ID)</th>
                        <th className="p-4 border-b border-slate-200">Détails / Raison</th>
                        <th className="p-4 border-b border-slate-200">IP Mobile/Poste</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm border-t border-slate-100 font-mono">
                      {[
                        { date: '22 Fév 2026, 14:32:01', user: 'jean.k', action: 'APPROVE_KYC', target: 'APP-8849', details: 'All fields verified manually', ip: '10.22.4.15 (Agence A)' },
                        { date: '22 Fév 2026, 14:30:12', user: 'SYSTEM', action: 'LIVENESS_FAIL', target: 'USR-9912', details: 'Strike 2: Face not detected properly', ip: '197.100.22.1 (Mobile)' },
                        { date: '22 Fév 2026, 14:28:55', user: 'thomas.n', action: 'ESCALATE_PEP', target: 'ALERT-09', details: 'Forwarded to central compliance', ip: '10.22.1.2 (HQ)' },
                        { date: '22 Fév 2026, 14:25:33', user: 'jean.k', action: 'REJECT_KYC', target: 'APP-8848', details: 'Document_Blurred | CNI illisible', ip: '10.22.4.15 (Agence A)' },
                        { date: '22 Fév 2026, 14:22:10', user: 'SYSTEM', action: 'AUTO_APPROVE', target: 'APP-8847', details: 'Confidence >95% on all checks', ip: 'internal-api-gateway' },
                        { date: '22 Fév 2026, 14:15:00', user: 'SYSTEM', action: 'OCR_PROCESS', target: 'USR-9915', details: 'Extracted with 98% avg confidence', ip: 'ml-worker-03' },
                        { date: '22 Fév 2026, 14:10:22', user: 'sylvie.e', action: 'LOGIN', target: 'SESSION-XYZ', details: 'Token granted', ip: '10.22.1.8 (HQ)' },
                      ].map((log, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 border-b border-slate-50 last:border-0 text-[11px]">
                          <td className="p-3 text-slate-500">{log.date}</td>
                          <td className="p-3 font-semibold text-slate-700">{log.user}</td>
                          <td className="p-3"><span className={cn('px-1.5 py-0.5 rounded font-bold text-[9px]',
                            log.action.includes('REJECT') || log.action.includes('FAIL') ? 'bg-red-100 text-red-700' :
                              log.action.includes('APPROVE') ? 'bg-emerald-100 text-emerald-700' :
                                log.action.includes('ESCALATE') ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600')}>{log.action}</span></td>
                          <td className="p-3 text-blue-600 hover:underline cursor-pointer">{log.target}</td>
                          <td className="p-3 text-slate-500 max-w-[200px] truncate" title={log.details}>{log.details}</td>
                          <td className="p-3 text-slate-400">{log.ip}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Deduplication & Conflict Resolver View — Thomas (A-T05) */}
          {currentView === 'dedup' && (
            <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Résolution des Conflits & Déduplication</h2>
                  <p className="text-slate-500 text-sm">Gestion des doublons et similitudes biométriques</p>
                </div>
                <div className="bg-amber-100 text-amber-700 font-bold px-3 py-1.5 rounded-lg text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> 3 conflits urgents
                </div>
              </div>

              {/* Conflict queue */}
              <div className="grid grid-cols-1 gap-6">
                {[
                  {
                    id: 'CONF-2026-0042',
                    type: 'Similitude Faciale (89%)',
                    status: 'pending',
                    profileA: { id: 'VRF-2026-0005', name: 'Njoya Inès Bella', date: 'Aujourd\'hui, 10:15', dob: '14/05/1992', city: 'Douala', doc: 'CNI: 112233445' },
                    profileB: { id: 'BCE-2019-8841', name: 'Bella Njoya Inès', date: 'Client Existant (Depuis 2019)', dob: '14/05/1992', city: 'Douala', doc: 'CNI: 112233445' }
                  }
                ].map((conf, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] uppercase font-mono bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md font-bold">{conf.id}</span>
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <Users className="w-4 h-4 text-[#E37B03]" /> {conf.type}
                        </h3>
                      </div>
                      <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded">En attente</span>
                    </div>

                    <div className="p-6 grid grid-cols-2 divide-x divide-slate-100">
                      {/* Profile A (New) */}
                      <div className="pr-6">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Profil Entrant</span>
                          <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-medium">{conf.profileA.date}</span>
                        </div>
                        <div className="space-y-4">
                          <div className="flex items-start gap-4">
                            <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                              <img src="https://images.unsplash.com/photo-1531123897727-8f129e1bfff8?auto=format&fit=crop&q=80&w=150" alt="New Profile" className="w-full h-full object-cover" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{conf.profileA.name}</p>
                              <p className="text-xs font-mono text-slate-500 mt-0.5">{conf.profileA.id}</p>
                            </div>
                          </div>
                          <div className="space-y-2 bg-slate-50 p-4 rounded-xl text-sm">
                            <div className="flex justify-between"><span className="text-slate-500">Document</span><span className="font-medium bg-amber-100 text-amber-900 px-1 rounded">{conf.profileA.doc}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Naissance</span><span className="font-medium">{conf.profileA.dob}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Ville</span><span className="font-medium">{conf.profileA.city}</span></div>
                          </div>
                        </div>
                      </div>

                      {/* Profile B (Existing) */}
                      <div className="pl-6">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Profil Existant</span>
                          <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-medium">{conf.profileB.date}</span>
                        </div>
                        <div className="space-y-4">
                          <div className="flex items-start gap-4">
                            <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                              <img src="https://images.unsplash.com/photo-1531123897727-8f129e1bfff8?auto=format&fit=crop&q=80&w=150" alt="Existing Profile" className="w-full h-full object-cover filter grayscale" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{conf.profileB.name}</p>
                              <p className="text-xs font-mono text-slate-500 mt-0.5">{conf.profileB.id}</p>
                            </div>
                          </div>
                          <div className="space-y-2 bg-slate-50 p-4 rounded-xl text-sm">
                            <div className="flex justify-between"><span className="text-slate-500">Document</span><span className="font-medium bg-amber-100 text-amber-900 px-1 rounded">{conf.profileB.doc}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Naissance</span><span className="font-medium">{conf.profileB.dob}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Ville</span><span className="font-medium">{conf.profileB.city}</span></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ZoomIn className="w-5 h-5 text-slate-400" />
                        <span className="text-sm font-medium text-slate-600">Similitude CNI exacte détectée. Risque de compte doublon.</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                          Marquer Faux Positif
                        </button>
                        <button className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 shadow-sm transition-colors flex items-center gap-2">
                          <XCircle className="w-4 h-4" /> Rejeter Entrant
                        </button>
                        <button className="px-4 py-2 text-sm font-bold text-white bg-[#E37B03] rounded-xl hover:bg-orange-600 shadow-sm transition-colors flex items-center gap-2">
                          <ArrowRightLeft className="w-4 h-4" /> Profils Liés (Merge)
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dashboard National — Thomas (Superviseur AML/CFT) A-T02 */}
          {currentView === 'thomas-dashboard' && (
            <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Supervision Nationale</h2>
                  <p className="text-slate-500 text-sm">Vue globale réseau et conformité AML/CFT</p>
                </div>
                <button onClick={() => setCurrentView('fraud')} className="bg-[#E37B03] text-white rounded-xl px-5 py-2.5 text-sm font-bold shadow-md shadow-orange-200 hover:bg-orange-600 transition-colors">
                  Voir Alertes AML
                </button>
              </div>

              {/* Banner */}
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-red-900">Alertes Critiques Actives</h3>
                    <p className="text-xs text-red-700 mt-0.5">2 hits PEP majeurs et 5 dossiers suspects nécessitent votre validation.</p>
                  </div>
                </div>
                <button onClick={() => setCurrentView('fraud')} className="text-sm font-bold text-red-700 bg-white px-4 py-2 rounded-xl shadow-sm hover:bg-red-50 transition-colors">
                  Traiter (7)
                </button>
              </div>

              {/* 3 Stat Cards */}
              <div className="grid grid-cols-3 gap-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Agences Actives</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">42 <span className="text-xs text-emerald-600 font-medium ml-1">+1</span></p>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                    <FileText className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Dossiers Nationaux (Jour)</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">1,204 <span className="text-xs text-emerald-600 font-medium ml-1">+14%</span></p>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center">
                    <Shield className="w-6 h-6 text-[#E37B03]" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Alertes AML Ouvertes</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">7 <span className="text-xs text-red-600 font-medium ml-1">Urgent</span></p>
                  </div>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-2 gap-6">
                {/* Bar chart per agency */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-700 mb-6">Répartition par Agence (Top 5)</h3>
                  <div className="space-y-4">
                    {[
                      { name: 'Bonanjo Principale', val: 450, pct: 100 },
                      { name: 'Yaoundé Centre', val: 320, pct: 71 },
                      { name: 'Akwa Liberté', val: 280, pct: 62 },
                      { name: 'Bafoussam Marché', val: 190, pct: 42 },
                      { name: 'Garoua Centre', val: 110, pct: 24 },
                    ].map(ag => (
                      <div key={ag.name}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-semibold text-slate-700">{ag.name}</span>
                          <span className="font-bold text-slate-900">{ag.val}</span>
                        </div>
                        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-[#2563EB] rounded-full" style={{ width: `${ag.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Approval Rate */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-center items-center">
                  <h3 className="text-sm font-semibold text-slate-700 w-full text-left mb-6">Taux d'Approbation National</h3>
                  <div className="w-32 h-32 relative mb-4">
                    <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                      <circle cx="18" cy="18" r="15.9155" fill="transparent" stroke="#f1f5f9" strokeWidth="4" />
                      <circle cx="18" cy="18" r="15.9155" fill="transparent" stroke="#E37B03" strokeWidth="4" strokeDasharray="76.4 100" strokeLinecap="round" className="drop-shadow-sm" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                      <span className="text-2xl font-black text-slate-900">76%</span>
                    </div>
                  </div>
                  <p className="text-xs text-emerald-600 font-medium bg-emerald-50 px-3 py-1 rounded-full">+1.2% par rapport à hier</p>
                </div>
              </div>
            </div>
          )}



          {/* Screening AML View — Thomas */}
          {currentView === 'fraud' && (
            <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Screening AML / CFT</h2>
                  <p className="text-slate-500 text-sm">Alertes de conformité — Correspondances PEP, Sanctions et comportement suspect</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="bg-red-100 text-red-700 font-bold px-3 py-1.5 rounded-xl text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> 7 alertes actives
                  </span>
                </div>
              </div>

              {/* Critical Alert — PEP Hit */}
              <div className="bg-red-50 rounded-2xl border-2 border-red-200 p-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-bold bg-red-600 text-white px-2 py-0.5 rounded uppercase">CRITIQUE — PEP</span>
                      <span className="text-xs font-mono text-slate-500">ALERT-2026-0041 · Il y a 12 min</span>
                    </div>
                    <h3 className="text-base font-bold text-red-900 mb-1">Correspondance liste sanctions ONU — Dossier VRF-2026-0008</h3>
                    <p className="text-sm text-red-700 mb-4">Nom: <strong>Ndoumbe Théodore Michel</strong> — Score similarité: <strong className="text-red-900">94.7%</strong> avec liste OFAC/ONU. Occupation déclarée : Conseiller ministériel.</p>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      {[
                        { label: 'Similarité Nom', value: '94.7%', color: 'red' },
                        { label: 'Date Naissance', value: '07/12/1967 ✓', color: 'orange' },
                        { label: 'Nationalité', value: 'CMR ✓', color: 'orange' },
                      ].map(item => (
                        <div key={item.label} className="bg-white rounded-xl p-3 text-center border border-red-100">
                          <p className={`text-lg font-black ${item.color === 'red' ? 'text-red-600' : 'text-orange-600'}`}>{item.value}</p>
                          <p className="text-xs text-slate-500 mt-1">{item.label}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      <button className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 shadow-sm transition-colors flex items-center gap-2">
                        <XCircle className="w-4 h-4" /> Bloquer & Escalader Direction
                      </button>
                      <button className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors">
                        Faux Positif (Homonymie)
                      </button>
                      <button className="px-4 py-2 text-sm font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors">
                        Demander justificatifs
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* AML Queue Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">File d'attente AML — 7 alertes</h3>
                  <button className="text-xs font-bold text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50">
                    Exporter Rapport COBAC
                  </button>
                </div>
                <div className="divide-y divide-slate-100">
                  {[
                    { id: 'ALERT-2026-0041', name: 'Ndoumbe Théodore M.', type: 'PEP / Sanctions ONU', score: '94.7%', level: 'CRITIQUE', dossier: 'VRF-2026-0008', time: 'il y a 12 min' },
                    { id: 'ALERT-2026-0040', name: 'Biyiha Jean-Claude R.', type: 'Transactions suspectes (>5M XAF)', score: '78.2%', level: 'URGENT', dossier: 'VRF-2026-0007', time: 'il y a 34 min' },
                    { id: 'ALERT-2026-0039', name: 'Mbouda Clarisse A.', type: 'Tentatives multiples identité', score: '65.1%', level: 'MOYEN', dossier: 'VRF-2026-0005', time: 'il y a 1h' },
                    { id: 'ALERT-2026-0038', name: 'Kamgang Aristide N.', type: 'Homonymie liste sanctions EU', score: '51.3%', level: 'FAIBLE', dossier: 'VRF-2026-0003', time: 'il y a 2h' },
                  ].map((alert) => (
                    <div key={alert.id} className="flex items-center gap-6 px-6 py-4 hover:bg-slate-50 transition-colors">
                      <div className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-black ${alert.level === 'CRITIQUE' ? 'bg-red-100 text-red-700' :
                          alert.level === 'URGENT' ? 'bg-orange-100 text-orange-700' :
                            alert.level === 'MOYEN' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                        }`}>{alert.level}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900">{alert.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{alert.type}</p>
                      </div>
                      <div className="text-center shrink-0 w-16">
                        <p className={`text-sm font-black ${parseFloat(alert.score) >= 90 ? 'text-red-600' :
                            parseFloat(alert.score) >= 70 ? 'text-orange-600' : 'text-amber-600'
                          }`}>{alert.score}</p>
                        <p className="text-[10px] text-slate-400">similarité</p>
                      </div>
                      <div className="shrink-0">
                        <p className="text-xs font-mono text-blue-600">{alert.dossier}</p>
                        <p className="text-[10px] text-slate-400">{alert.time}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">Bloquer</button>
                        <button className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors">Classer</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Application list View (Jean/Thomas) */}
          {currentView === 'applications' && (
            <>
              <div className={cn('border-r border-slate-200 bg-white flex flex-col transition-all shrink-0',
                selectedApp ? 'w-80' : 'w-full max-w-lg')}>
                {/* Search + filters */}
                <div className="p-4 border-b border-slate-100 space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="text" placeholder="Search by name or ID..."
                      value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#E37B03] focus:border-[#E37B03] outline-none" />
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {['all', 'pending', 'approved', 'rejected', 'limited'].map(s => (
                      <button key={s} onClick={() => setFilterStatus(s)}
                        className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                          filterStatus === s ? 'bg-[#E37B03] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
                        {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)} ({statusCounts[s as keyof typeof statusCounts]})
                      </button>
                    ))}
                  </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto">
                  {filteredApps.map(app => (
                    <button key={app.id} onClick={() => { setSelectedApp(app); setActiveTab('identity'); }}
                      className={cn('w-full text-left px-4 py-3.5 border-b border-slate-100 hover:bg-slate-50 transition-all',
                        selectedApp?.id === app.id && 'bg-orange-50 border-l-2 border-l-[#E37B03]')}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold',
                            app.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                              app.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                app.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                  'bg-orange-100 text-orange-700')}>
                            {app.fullName.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{app.fullName}</p>
                            <p className="text-xs text-slate-500 font-mono">{app.id}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          {statusBadge(app.status)}
                          <p className="text-[10px] text-slate-400 mt-1">
                            {new Date(app.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                  {filteredApps.length === 0 && (
                    <div className="p-8 text-center text-sm text-slate-500">
                      No applications match your filters
                    </div>
                  )}
                </div>
              </div>

              {/* Detail panel - Side by side review */}
              {selectedApp && (
                <div className="flex-1 overflow-y-auto p-6">
                  {/* App header */}
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold',
                        selectedApp.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          selectedApp.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                            selectedApp.status === 'rejected' ? 'bg-red-100 text-red-700' :
                              'bg-orange-100 text-orange-700')}>
                        {selectedApp.fullName.charAt(0)}
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-slate-900">{selectedApp.fullName}</h2>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-sm text-slate-500 font-mono">{selectedApp.id}</span>
                          {statusBadge(selectedApp.status)}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {selectedApp.status === 'pending' && (
                        <>
                          <button onClick={() => handleApprove(selectedApp.id)}
                            className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 flex items-center gap-2 transition-colors">
                            <ThumbsUp className="w-4 h-4" /> Approuver
                          </button>
                          <button onClick={() => setShowRejectModal(true)}
                            className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 flex items-center gap-2 transition-colors">
                            <ThumbsDown className="w-4 h-4" /> Rejeter
                          </button>
                        </>
                      )}
                      <button onClick={() => setSelectedApp(null)}
                        className="p-2 rounded-xl border border-slate-300 text-slate-500 hover:bg-slate-50">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Rejection reason display */}
                  {selectedApp.status === 'rejected' && selectedApp.rejectionReason && (
                    <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <XCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-red-800">Rejection Reason</p>
                          <p className="text-sm text-red-700 mt-1">{selectedApp.rejectionReason}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tabs */}
                  <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1">
                    {[
                      { id: 'identity' as const, label: 'Identity & OCR', icon: CreditCard },
                      { id: 'liveness' as const, label: 'Liveness', icon: Camera },
                      { id: 'address' as const, label: 'Address & Docs', icon: MapPin },
                      { id: 'summary' as const, label: 'Summary', icon: Shield },
                    ].map(tab => (
                      <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={cn('flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all',
                          activeTab === tab.id ? 'bg-white text-orange-850 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                        <tab.icon className="w-3.5 h-3.5" /> {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Tab content */}
                  {activeTab === 'identity' && (
                    <div className="space-y-6">
                      {/* Side by side documents */}
                      <div>
                        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-[#E37B03]" /> Captures CNI biométrique
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <DocumentPlaceholder label="CNI Recto" type="id-front" />
                          <DocumentPlaceholder label="CNI Verso" type="id-back" />
                        </div>
                      </div>

                      {/* OCR Extracted fields */}
                      <div>
                        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                          <ScanLine className="w-4 h-4 text-[#E37B03]" /> OCR Extracted Fields
                        </h3>
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                          <table className="w-full">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Field</th>
                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Extracted Value</th>
                                <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500">Confidence</th>
                                <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedApp.ocrFields.map(f => (
                                <tr key={f.key} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                  <td className="px-4 py-3 text-sm text-slate-600">{f.label}</td>
                                  <td className="px-4 py-3 text-sm font-medium text-slate-900 font-mono">
                                    {f.value}
                                    {f.edited && <span className="text-xs text-orange-600 ml-1">(user edited)</span>}
                                  </td>
                                  <td className="px-4 py-3 w-32">{confidenceBar(f.confidence)}</td>
                                  <td className="px-4 py-3 text-center">
                                    {f.confidence >= 90 ? (
                                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><CheckCircle className="w-3.5 h-3.5" /> OK</span>
                                    ) : f.confidence >= 70 ? (
                                      <span className="inline-flex items-center gap-1 text-xs text-amber-600"><AlertTriangle className="w-3.5 h-3.5" /> Review</span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-xs text-red-600"><XCircle className="w-3.5 h-3.5" /> Flag</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'liveness' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                            <Camera className="w-4 h-4 text-[#E37B03]" /> Selfie Capture
                          </h3>
                          <DocumentPlaceholder label="Live Selfie" type="selfie" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-[#E37B03]" /> ID Photo (for comparison)
                          </h3>
                          <DocumentPlaceholder label="ID Photo" type="id-front" />
                        </div>
                      </div>

                      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <Shield className="w-4 h-4 text-[#E37B03]" /> Liveness Analysis
                        </h3>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-slate-50 rounded-xl p-4 text-center">
                            <div className={cn('text-2xl font-black', selectedApp.livenessScore >= 80 ? 'text-emerald-600' : selectedApp.livenessScore >= 60 ? 'text-amber-600' : 'text-red-600')}>
                              {selectedApp.livenessScore}%
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Overall Score</p>
                          </div>
                          <div className="bg-slate-50 rounded-xl p-4 text-center">
                            <div className={cn('text-2xl font-black', selectedApp.livenessScore >= 80 ? 'text-emerald-600' : 'text-amber-600')}>
                              {selectedApp.livenessScore >= 80 ? 'Pass' : 'Fail'}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Liveness Result</p>
                          </div>
                          <div className="bg-slate-50 rounded-xl p-4 text-center">
                            <div className={cn('text-2xl font-black', selectedApp.livenessScore >= 70 ? 'text-emerald-600' : 'text-red-600')}>
                              {selectedApp.livenessScore >= 70 ? 'Match' : 'No Match'}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Face Comparison</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {[
                            { label: 'Face Detection', score: Math.min(selectedApp.livenessScore + 3, 100) },
                            { label: 'Eye Movement', score: Math.max(selectedApp.livenessScore - 5, 0) },
                            { label: 'Depth Analysis', score: Math.max(selectedApp.livenessScore - 2, 0) },
                            { label: 'Spoof Detection', score: Math.min(selectedApp.livenessScore + 1, 100) },
                          ].map(item => (
                            <div key={item.label} className="flex items-center gap-3">
                              <span className="text-xs text-slate-600 w-28">{item.label}</span>
                              {confidenceBar(item.score)}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'address' && (
                    <div className="space-y-6">
                      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-[#E37B03]" /> Address Information
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          {[
                            { label: 'Rue / Point de repère', value: selectedApp.address },
                            { label: 'Ville', value: selectedApp.city },
                            { label: 'Région', value: selectedApp.region },
                            { label: 'Pays', value: 'Cameroun' },
                          ].map(f => (
                            <div key={f.label}>
                              <p className="text-xs text-slate-500">{f.label}</p>
                              <p className="text-sm font-medium text-slate-900 mt-0.5">{f.value}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[#E37B03]" /> Proof of Address
                          </h3>
                          <DocumentPlaceholder label="Utility Bill" type="proof" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[#E37B03]" /> Signature
                          </h3>
                          <DocumentPlaceholder label="Wet Signature" type="signature" />
                        </div>
                      </div>

                      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-[#E37B03]" /> NIU — Numéro d'Identifiant Unique
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-slate-500">NIU fiscal DGI (attestation d'immatriculation)</p>
                            <p className={cn('text-sm font-mono mt-0.5', selectedApp.niuId ? 'font-medium text-slate-900' : 'text-orange-600 italic')}>
                              {selectedApp.niuId || 'Non renseigné'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Statut</p>
                            {selectedApp.niuId ? (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 mt-0.5"><Check className="w-3.5 h-3.5" /> Fourni</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-orange-600 mt-0.5"><AlertTriangle className="w-3.5 h-3.5" /> Manquant — Accès limité</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'summary' && (
                    <div className="space-y-6">
                      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                        <h3 className="text-sm font-semibold text-slate-700">Application Summary</h3>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                          {[
                            { label: 'Nom complet', value: selectedApp.fullName },
                            { label: 'Téléphone', value: selectedApp.phone },
                            { label: 'Email', value: selectedApp.email },
                            { label: 'N° série CNI', value: selectedApp.nationalId },
                            { label: 'Date de naissance', value: selectedApp.dateOfBirth },
                            { label: 'Adresse', value: selectedApp.address },
                            { label: 'Ville', value: selectedApp.city },
                            { label: 'Région', value: selectedApp.region },
                            { label: 'NIU', value: selectedApp.niuId || '—' },
                            { label: 'Soumis le', value: new Date(selectedApp.submittedAt).toLocaleString() },
                          ].map(f => (
                            <div key={f.label} className="py-2 border-b border-slate-100">
                              <p className="text-xs text-slate-500">{f.label}</p>
                              <p className="text-sm font-medium text-slate-900 mt-0.5">{f.value}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Overall risk assessment */}
                      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                        <h3 className="text-sm font-semibold text-slate-700">Risk Assessment</h3>
                        <div className="grid grid-cols-4 gap-3">
                          {[
                            {
                              label: 'OCR Avg Confidence', value: `${Math.round(selectedApp.ocrFields.reduce((a, b) => a + b.confidence, 0) / selectedApp.ocrFields.length)}%`,
                              color: selectedApp.ocrFields.reduce((a, b) => a + b.confidence, 0) / selectedApp.ocrFields.length >= 80 ? 'emerald' : 'amber'
                            },
                            {
                              label: 'Liveness Score', value: `${selectedApp.livenessScore}%`,
                              color: selectedApp.livenessScore >= 80 ? 'emerald' : selectedApp.livenessScore >= 60 ? 'amber' : 'red'
                            },
                            {
                              label: 'NIU', value: selectedApp.niuId ? 'Fourni' : 'Manquant',
                              color: selectedApp.niuId ? 'emerald' : 'orange'
                            },
                            {
                              label: 'Overall Risk', value:
                                selectedApp.livenessScore >= 80 && selectedApp.ocrFields.reduce((a, b) => a + b.confidence, 0) / selectedApp.ocrFields.length >= 80 ? 'Low' :
                                  selectedApp.livenessScore >= 60 ? 'Medium' : 'High',
                              color: selectedApp.livenessScore >= 80 ? 'emerald' : selectedApp.livenessScore >= 60 ? 'amber' : 'red'
                            },
                          ].map(item => (
                            <div key={item.label} className={cn('rounded-xl p-4 text-center',
                              item.color === 'emerald' ? 'bg-emerald-50' :
                                item.color === 'amber' ? 'bg-amber-50' :
                                  item.color === 'orange' ? 'bg-orange-50' : 'bg-red-50')}>
                              <p className={cn('text-lg font-black',
                                item.color === 'emerald' ? 'text-emerald-600' :
                                  item.color === 'amber' ? 'text-amber-600' :
                                    item.color === 'orange' ? 'text-orange-600' : 'text-red-600')}>{item.value}</p>
                              <p className="text-[10px] text-slate-500 mt-1">{item.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Validator notes */}
                      {selectedApp.status === 'pending' && (
                        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-[#E37B03]" /> Validator Notes
                          </h3>
                          <textarea value={validatorNote} onChange={e => setValidatorNote(e.target.value)}
                            placeholder="Add internal notes about this application..."
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm resize-none h-20 focus:ring-2 focus:ring-[#E37B03] focus:border-[#E37B03] outline-none" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Empty state */}
              {!selectedApp && filteredApps.length > 0 && (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center space-y-3">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
                      <Eye className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-500">Select an application to review</p>
                    <p className="text-xs text-slate-400">Click on any application from the list</p>
                  </div>
                </div>
              )}

            </>
          )}
        </div>

        {/* Reject modal */}
        {showRejectModal && selectedApp && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <ThumbsDown className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Reject Application</h3>
                  <p className="text-xs text-slate-500">{selectedApp.fullName} — {selectedApp.id}</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Rejection Reason *</label>
                <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                  placeholder="Provide a clear reason for rejection..."
                  className="w-full mt-1.5 px-3 py-2 border border-slate-300 rounded-xl text-sm resize-none h-24 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none" />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                <strong>Note:</strong> The customer will be notified of the rejection and can contact support or re-submit.
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setShowRejectModal(false); setRejectReason(''); }}
                  className="px-4 py-2 border border-slate-300 text-sm font-medium text-slate-600 rounded-xl hover:bg-slate-50">
                  Cancel
                </button>
                <button onClick={() => handleReject(selectedApp.id)} disabled={!rejectReason.trim()}
                  className={cn('px-4 py-2 text-sm font-semibold rounded-xl flex items-center gap-2 transition-colors',
                    rejectReason.trim() ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed')}>
                  <XCircle className="w-4 h-4" /> Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Image zoom modal */}
        {showImageZoom && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-8" onClick={() => setShowImageZoom(null)}>
            <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-900">{showImageZoom}</h3>
                <button onClick={() => setShowImageZoom(null)} className="p-1 rounded-lg hover:bg-slate-100">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <div className="aspect-[4/3] bg-gradient-to-br from-slate-700 to-slate-900 rounded-xl flex items-center justify-center">
                <div className="text-center">
                  <CreditCard className="w-16 h-16 text-white/30 mx-auto mb-3" />
                  <p className="text-white/50 text-sm">Document preview placeholder</p>
                  <p className="text-white/30 text-xs mt-1">In production, the actual captured image appears here</p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
