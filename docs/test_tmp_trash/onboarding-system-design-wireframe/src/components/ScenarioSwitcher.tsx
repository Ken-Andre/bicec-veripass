import { useState } from 'react';
import { Settings, X, WifiOff, ShieldAlert, FileWarning, Briefcase, RefreshCcw } from 'lucide-react';
import { useScenario, type AccessLevel } from '@/contexts/ScenarioContext';
import { cn } from '@/utils/cn';

export function ScenarioSwitcher() {
    const [isOpen, setIsOpen] = useState(false);
    const {
        isOffline, kycState, accessLevel, ocrConfidenceLow,
        amlAlertActive, batchError, setScenario, resetScenarios
    } = useScenario();

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 left-6 z-[100] bg-slate-900 text-white p-3 rounded-full shadow-2xl hover:scale-110 transition-transform flex items-center gap-2 group border border-slate-700 hover:bg-slate-800"
            >
                <Settings className="w-5 h-5 group-hover:animate-spin-slow text-orange-400" />
                <span className="text-xs font-bold w-0 overflow-hidden group-hover:w-auto opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap">
                    Scenario Injector
                </span>
            </button>
        );
    }

    return (
        <div className="fixed bottom-6 left-6 z-[100] w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-orange-400" />
                    <h3 className="text-sm font-bold">Scenario Injector</h3>
                </div>
                <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-6">
                <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Résilience (Global)</p>
                    <button
                        onClick={() => setScenario({ isOffline: !isOffline })}
                        className={cn("w-full flex items-center justify-between p-2 rounded-lg border text-sm transition-colors outline-none",
                            isOffline ? "bg-red-50 border-red-200 text-red-700 font-medium" : "bg-slate-50 border-slate-200 hover:bg-slate-100")}
                    >
                        <span className="flex items-center gap-2"><WifiOff className="w-4 h-4" /> Perte Réseau</span>
                        <div className={cn("w-8 h-4 rounded-full transition-colors relative", isOffline ? "bg-red-500" : "bg-slate-300")}>
                            <div className={cn("absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform", isOffline ? "translate-x-4" : "")} />
                        </div>
                    </button>
                </div>

                <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mobile Onboarding</p>
                    <button
                        onClick={() => setScenario({ ocrConfidenceLow: !ocrConfidenceLow })}
                        className={cn("w-full flex items-center justify-between p-2 rounded-lg border text-sm outline-none transition-colors",
                            ocrConfidenceLow ? "bg-orange-50 border-orange-200 text-orange-700 font-medium" : "bg-slate-50 border-slate-200 hover:bg-slate-100")}
                    >
                        <span className="flex items-center gap-2"><FileWarning className="w-4 h-4" /> Fallback OCR (&lt; 85%)</span>
                        <div className={cn("w-8 h-4 rounded-full transition-colors relative", ocrConfidenceLow ? "bg-orange-500" : "bg-slate-300")}>
                            <div className={cn("absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform", ocrConfidenceLow ? "translate-x-4" : "")} />
                        </div>
                    </button>
                    <button
                        onClick={() => setScenario({ kycState: kycState === 'LOCKED_LIVENESS' ? 'DRAFT' : 'LOCKED_LIVENESS' })}
                        className={cn("w-full flex items-center justify-between p-2 rounded-lg border text-sm outline-none transition-colors",
                            kycState === 'LOCKED_LIVENESS' ? "bg-red-50 border-red-200 text-red-700 font-medium" : "bg-slate-50 border-slate-200 hover:bg-slate-100")}
                    >
                        <span className="flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Lockout Liveness (3x)</span>
                        <div className={cn("w-8 h-4 rounded-full transition-colors relative", kycState === 'LOCKED_LIVENESS' ? "bg-red-500" : "bg-slate-300")}>
                            <div className={cn("absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform", kycState === 'LOCKED_LIVENESS' ? "translate-x-4" : "")} />
                        </div>
                    </button>
                    <button
                        onClick={() => setScenario({ kycState: kycState === 'PENDING_INFO' ? 'DRAFT' : 'PENDING_INFO' })}
                        className={cn("w-full flex items-center justify-between p-2 rounded-lg border text-sm outline-none transition-colors",
                            kycState === 'PENDING_INFO' ? "bg-blue-50 border-blue-200 text-blue-700 font-medium" : "bg-slate-50 border-slate-200 hover:bg-slate-100")}
                    >
                        <span className="flex items-center gap-2"><Briefcase className="w-4 h-4" /> Demander Complément</span>
                        <div className={cn("w-8 h-4 rounded-full transition-colors relative", kycState === 'PENDING_INFO' ? "bg-blue-500" : "bg-slate-300")}>
                            <div className={cn("absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform", kycState === 'PENDING_INFO' ? "translate-x-4" : "")} />
                        </div>
                    </button>
                </div>

                <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">État du Compte Client</p>
                    <select
                        className="w-full p-2 text-sm border-slate-300 rounded-lg bg-slate-50 border focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        value={accessLevel}
                        onChange={(e) => setScenario({ accessLevel: e.target.value as AccessLevel })}
                    >
                        <option value="RESTRICTED">RESTRICTED (Lecture seule)</option>
                        <option value="LIMITED">LIMITED (Sans NIU)</option>
                        <option value="PRE_FULL">PRE_FULL (Attente signature)</option>
                        <option value="FULL">FULL (Compte actif)</option>
                        <option value="DISABLED">DISABLED (Bloqué)</option>
                    </select>
                </div>

                <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Erreurs Back-Office / Ops</p>
                    <button
                        onClick={() => setScenario({ amlAlertActive: !amlAlertActive })}
                        className={cn("w-full flex items-center justify-between p-2 rounded-lg border text-sm outline-none transition-colors",
                            amlAlertActive ? "bg-red-50 border-red-200 text-red-700 font-medium" : "bg-slate-50 border-slate-200 hover:bg-slate-100")}
                    >
                        <span className="flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Alerte AML (Thomas)</span>
                        <div className={cn("w-8 h-4 rounded-full transition-colors relative", amlAlertActive ? "bg-red-500" : "bg-slate-300")}>
                            <div className={cn("absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform", amlAlertActive ? "translate-x-4" : "")} />
                        </div>
                    </button>
                    <button
                        onClick={() => setScenario({ batchError: !batchError })}
                        className={cn("w-full flex items-center justify-between p-2 rounded-lg border text-sm outline-none transition-colors",
                            batchError ? "bg-orange-50 border-orange-200 text-orange-700 font-medium" : "bg-slate-50 border-slate-200 hover:bg-slate-100")}
                    >
                        <span className="flex items-center gap-2"><FileWarning className="w-4 h-4" /> Alerte Batch Amplitude</span>
                        <div className={cn("w-8 h-4 rounded-full transition-colors relative", batchError ? "bg-orange-500" : "bg-slate-300")}>
                            <div className={cn("absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform", batchError ? "translate-x-4" : "")} />
                        </div>
                    </button>
                </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0">
                <button
                    onClick={resetScenarios}
                    className="w-full py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                >
                    <RefreshCcw className="w-4 h-4" /> Réinitialiser tout
                </button>
            </div>
        </div>
    );
}
