import { useState } from 'react';
import {
  Search, CheckCircle, XCircle,
  Clock, AlertTriangle, Eye, User, CreditCard, Camera,
  FileText, MapPin, Shield, ScanLine, ThumbsUp, ThumbsDown,
  MessageSquare, ZoomIn,
  BarChart3, Users, FileCheck, Settings, Bell, LogOut,
  Check, X
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { MOCK_APPLICATIONS } from '@/data';
import type { ApplicationData } from '@/types';

export function BackOffice() {
  const [applications, setApplications] = useState<ApplicationData[]>(MOCK_APPLICATIONS);
  const [selectedApp, setSelectedApp] = useState<ApplicationData | null>(null);
  const [activeTab, setActiveTab] = useState<'identity' | 'address' | 'liveness' | 'summary'>('identity');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [validatorNote, setValidatorNote] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showImageZoom, setShowImageZoom] = useState<string | null>(null);

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
    const bgColors: Record<string, string> = {
      'id-front': 'from-slate-700 to-slate-800',
      'id-back': 'from-slate-600 to-slate-700',
      'selfie': 'from-blue-800 to-indigo-900',
      'proof': 'from-amber-700 to-orange-800',
      'signature': 'from-slate-100 to-white',
    };
    const icons: Record<string, React.ReactNode> = {
      'id-front': <CreditCard className="w-8 h-8 text-white/50" />,
      'id-back': <CreditCard className="w-8 h-8 text-white/50" />,
      'selfie': <Camera className="w-8 h-8 text-white/50" />,
      'proof': <FileText className="w-8 h-8 text-white/50" />,
      'signature': <FileText className="w-8 h-8 text-slate-300" />,
    };

    return (
      <button onClick={() => setShowImageZoom(label)}
        className="group relative aspect-[4/3] rounded-xl overflow-hidden border border-slate-200 hover:border-blue-400 transition-all hover:shadow-lg cursor-pointer">
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

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-md">
              <span className="text-lg font-black text-white">B</span>
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm">BankCo</p>
              <p className="text-xs text-slate-500">Back Office</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {[
            { icon: BarChart3, label: 'Dashboard', active: false },
            { icon: Users, label: 'Applications', active: true },
            { icon: FileCheck, label: 'Approved', active: false },
            { icon: XCircle, label: 'Rejected', active: false },
            { icon: AlertTriangle, label: 'Limited Access', active: false },
          ].map(item => (
            <button key={item.label}
              className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                item.active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50')}>
              <item.icon className={cn('w-4.5 h-4.5', item.active ? 'text-blue-600' : 'text-slate-400')} />
              {item.label}
              {item.label === 'Applications' && (
                <span className="ml-auto text-xs bg-blue-600 text-white rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                  {statusCounts.pending}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-100 space-y-1">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">
            <Settings className="w-4.5 h-4.5 text-slate-400" /> Settings
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">
            <LogOut className="w-4.5 h-4.5 text-slate-400" /> Log Out
          </button>
        </div>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <User className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-900">Agent: Laura M.</p>
              <p className="text-[10px] text-slate-500">KYC Validator</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-lg font-bold text-slate-900">KYC Application Review</h1>
            <p className="text-xs text-slate-500">Review and validate customer onboarding submissions</p>
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
          {/* Application list */}
          <div className={cn('border-r border-slate-200 bg-white flex flex-col transition-all shrink-0',
            selectedApp ? 'w-80' : 'w-full max-w-lg')}>
            {/* Search + filters */}
            <div className="p-4 border-b border-slate-100 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" placeholder="Search by name or ID..."
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {['all', 'pending', 'approved', 'rejected', 'limited'].map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                      filterStatus === s ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
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
                    selectedApp?.id === app.id && 'bg-blue-50 border-l-2 border-l-blue-600')}>
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
                        <ThumbsUp className="w-4 h-4" /> Approve
                      </button>
                      <button onClick={() => setShowRejectModal(true)}
                        className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 flex items-center gap-2 transition-colors">
                        <ThumbsDown className="w-4 h-4" /> Reject
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
                      activeTab === tab.id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
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
                      <CreditCard className="w-4 h-4 text-blue-600" /> Document Captures
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <DocumentPlaceholder label="ID Front" type="id-front" />
                      <DocumentPlaceholder label="ID Back" type="id-back" />
                    </div>
                  </div>

                  {/* OCR Extracted fields */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                      <ScanLine className="w-4 h-4 text-blue-600" /> OCR Extracted Fields
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
                                {f.edited && <span className="text-xs text-blue-500 ml-1">(user edited)</span>}
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
                        <Camera className="w-4 h-4 text-blue-600" /> Selfie Capture
                      </h3>
                      <DocumentPlaceholder label="Live Selfie" type="selfie" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-blue-600" /> ID Photo (for comparison)
                      </h3>
                      <DocumentPlaceholder label="ID Photo" type="id-front" />
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-600" /> Liveness Analysis
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
                      <MapPin className="w-4 h-4 text-blue-600" /> Address Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: 'Street Address', value: selectedApp.address },
                        { label: 'City', value: selectedApp.city },
                        { label: 'State', value: selectedApp.state },
                        { label: 'Country', value: 'México' },
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
                        <FileText className="w-4 h-4 text-blue-600" /> Proof of Address
                      </h3>
                      <DocumentPlaceholder label="Utility Bill" type="proof" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600" /> Signature
                      </h3>
                      <DocumentPlaceholder label="Wet Signature" type="signature" />
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                    <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" /> Fiscal / Tax Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-500">Fiscal ID (RFC)</p>
                        <p className={cn('text-sm font-mono mt-0.5', selectedApp.fiscalId ? 'font-medium text-slate-900' : 'text-orange-600 italic')}>
                          {selectedApp.fiscalId || 'Not provided'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Status</p>
                        {selectedApp.fiscalId ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 mt-0.5"><Check className="w-3.5 h-3.5" /> Provided</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-orange-600 mt-0.5"><AlertTriangle className="w-3.5 h-3.5" /> Missing — Limited Access</span>
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
                        { label: 'Full Name', value: selectedApp.fullName },
                        { label: 'Phone', value: selectedApp.phone },
                        { label: 'Email', value: selectedApp.email },
                        { label: 'National ID', value: selectedApp.nationalId },
                        { label: 'Date of Birth', value: selectedApp.dateOfBirth },
                        { label: 'Address', value: selectedApp.address },
                        { label: 'City', value: selectedApp.city },
                        { label: 'State', value: selectedApp.state },
                        { label: 'Fiscal ID', value: selectedApp.fiscalId || '—' },
                        { label: 'Submitted', value: new Date(selectedApp.submittedAt).toLocaleString() },
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
                        { label: 'OCR Avg Confidence', value: `${Math.round(selectedApp.ocrFields.reduce((a, b) => a + b.confidence, 0) / selectedApp.ocrFields.length)}%`,
                          color: selectedApp.ocrFields.reduce((a, b) => a + b.confidence, 0) / selectedApp.ocrFields.length >= 80 ? 'emerald' : 'amber' },
                        { label: 'Liveness Score', value: `${selectedApp.livenessScore}%`,
                          color: selectedApp.livenessScore >= 80 ? 'emerald' : selectedApp.livenessScore >= 60 ? 'amber' : 'red' },
                        { label: 'Fiscal ID', value: selectedApp.fiscalId ? 'Complete' : 'Missing',
                          color: selectedApp.fiscalId ? 'emerald' : 'orange' },
                        { label: 'Overall Risk', value:
                          selectedApp.livenessScore >= 80 && selectedApp.ocrFields.reduce((a, b) => a + b.confidence, 0) / selectedApp.ocrFields.length >= 80 ? 'Low' :
                          selectedApp.livenessScore >= 60 ? 'Medium' : 'High',
                          color: selectedApp.livenessScore >= 80 ? 'emerald' : selectedApp.livenessScore >= 60 ? 'amber' : 'red' },
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
                        <MessageSquare className="w-4 h-4 text-blue-600" /> Validator Notes
                      </h3>
                      <textarea value={validatorNote} onChange={e => setValidatorNote(e.target.value)}
                        placeholder="Add internal notes about this application..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm resize-none h-20 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
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
        </div>
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
  );
}
