import { useState } from 'react';
import { ScreenLayout } from '../../components/ScreenLayout';
import { useAuth } from '../../contexts/AuthContext';
import { User, ShieldCheck, CreditCard, Landmark, History, PlusCircle, ArrowRight, LogOut, Settings, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export function DashboardPage() {
    const { user, logout, isAuthenticated, isLocked } = useAuth();
    const navigate = useNavigate();
    const [showLogoutModal, setShowLogoutModal] = useState(false);

    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/', { replace: true });
        }
    }, [isAuthenticated, navigate]);

    useEffect(() => {
        if (isLocked) {
            navigate('/auth/lock', { replace: true });
        }
    }, [isLocked, navigate]);

    if (!isAuthenticated) return null;

    return (
        <ScreenLayout showNav title="Tableau de bord">
            <div className="space-y-8 pb-10">
                {/* Premium Profile Header */}
                <div className="relative overflow-hidden bg-gradient-to-br from-primary-bicec-blue to-blue-900 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-primary/30">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl opacity-50" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary-bicec-red/10 rounded-full -ml-16 -mb-16 blur-2xl opacity-30" />

                    <div className="relative flex justify-between items-center mb-10">
                        <div className="space-y-1">
                            <p className="text-white/60 text-sm font-bold uppercase tracking-widest">Compte VeriPass</p>
                            <h2 className="text-3xl font-black">{user?.phone?.replace('+237', '') || 'Utilisateur'}</h2>
                        </div>
                        <div className="h-16 w-16 bg-white/10 backdrop-blur-xl border border-white/20 rounded-[1.5rem] flex items-center justify-center shadow-inner">
                            <User className="w-8 h-8 text-white" />
                        </div>
                    </div>

                    <div className="relative flex items-center justify-between">
                        <div className="flex -space-x-3">
                            <div className="h-10 w-10 rounded-full border-2 border-primary bg-primary-bicec-red flex items-center justify-center text-[10px] font-bold shadow-lg">B</div>
                            <div className="h-10 w-10 rounded-full border-2 border-primary bg-white/20 backdrop-blur-md flex items-center justify-center text-[10px] font-bold shadow-lg">VP</div>
                        </div>
                        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 text-xs font-bold uppercase tracking-tighter">
                            <div className="w-2 h-2 rounded-full bg-accent-gold animate-pulse" />
                            Session active
                        </div>
                    </div>
                </div>

                {/* Quick Actions Title */}
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-xl font-extrabold text-slate-800">Services BICEC</h3>
                    <button className="text-primary font-bold text-sm">Voir tout</button>
                </div>

                {/* Modern Action Grid */}
                <div className="grid grid-cols-2 gap-5">
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-start space-y-4 active:scale-95 transition-all active:bg-slate-50">
                        <div className="p-4 bg-blue-50 rounded-2xl">
                            <Landmark className="w-6 h-6 text-primary-bicec-blue" />
                        </div>
                        <div>
                            <p className="font-black text-slate-800">Comptes</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Consultation</p>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-start space-y-4 active:scale-95 transition-all active:bg-slate-50">
                        <div className="p-4 bg-red-50 rounded-2xl">
                            <CreditCard className="w-6 h-6 text-primary-bicec-red" />
                        </div>
                        <div>
                            <p className="font-black text-slate-800">Cartes</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Gestion GIMAC</p>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-start space-y-4 active:scale-95 transition-all active:bg-slate-50">
                        <div className="p-4 bg-amber-50 rounded-2xl">
                            <History className="w-6 h-6 text-amber-600" />
                        </div>
                        <div>
                            <p className="font-black text-slate-800">Historique</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Transactions</p>
                        </div>
                    </div>

                    <div className="bg-primary-bicec-blue p-6 rounded-[2rem] shadow-lg shadow-primary/20 flex flex-col items-start space-y-4 active:scale-95 transition-all">
                        <div className="p-4 bg-white/10 rounded-2xl">
                            <PlusCircle className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <p className="font-black text-white">Nouveau</p>
                            <p className="text-[10px] text-white/60 font-bold uppercase tracking-widest">Demande</p>
                        </div>
                    </div>
                </div>

                {/* High-Attention KYC Banner */}
                <div className="relative group overflow-hidden bg-white border-2 border-slate-100 p-6 rounded-[2.5rem] shadow-xl">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 transition-all group-hover:scale-150" />

                    <div className="flex items-start gap-4">
                        <div className="h-14 w-14 bg-red-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                            <ShieldCheck className="w-8 h-8 text-primary-bicec-red" />
                        </div>
                        <div className="space-y-1">
                            <h4 className="text-lg font-black text-slate-800">Identification Requise</h4>
                            <p className="text-sm text-slate-500 leading-relaxed">
                                Votre profil VeriPass n'est pas encore certifié par la BICEC.
                            </p>
                        </div>
                    </div>

                    <div className="mt-8">
                        <button
                            onClick={() => navigate('/kyc/intro')}
                            className="bicec-button w-full h-16 text-md flex items-center justify-center gap-3"
                        >
                            Démarrer la certification KYC
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Settings Section */}
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100">
                        <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
                            <Settings className="w-5 h-5 text-slate-400" />
                            Paramètres
                        </h3>
                    </div>
                    <button
                        onClick={() => navigate('/settings/delete-account')}
                        className="w-full flex items-center gap-4 px-6 py-5 hover:bg-red-50 transition-colors text-left"
                    >
                        <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center">
                            <Trash2 className="w-5 h-5 text-primary-bicec-red" />
                        </div>
                        <div>
                            <p className="font-bold text-slate-800">Supprimer mon compte</p>
                            <p className="text-xs text-slate-400 font-medium">Action irréversible</p>
                        </div>
                    </button>
                </div>

                {/* Logout Footer */}
                <div className="pt-4 pb-10">
                    <button
                        onClick={() => setShowLogoutModal(true)}
                        className="w-full h-14 text-slate-400 font-bold text-xs uppercase tracking-[0.2em] hover:text-red-500 transition-colors"
                    >
                        Se déconnecter
                    </button>
                    <p className="text-center text-[10px] text-slate-300 font-medium mt-4">
                        VeriPass v1.2.0 • BICEC Official Application
                    </p>
                </div>
            </div>

            {/* Logout Confirmation Modal */}
            {showLogoutModal && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowLogoutModal(false)} />
                    <div className="relative bg-white rounded-t-[2rem] sm:rounded-[2.5rem] w-full sm:max-w-sm p-8 pb-12 shadow-2xl animate-slide-up">
                        <button
                            onClick={() => setShowLogoutModal(false)}
                            className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 transition-colors"
                        >
                            <X className="w-5 h-5 text-slate-400" />
                        </button>

                        <div className="text-center">
                            <div className="h-16 w-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                <LogOut className="w-8 h-8 text-slate-500" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 mb-2">Se déconnecter ?</h3>
                            <p className="text-slate-500 text-sm mb-8">
                                Vous devrez vous reconnecter avec votre numéro et votre PIN.
                            </p>

                            <div className="space-y-3">
                                <button
                                    onClick={() => {
                                        logout();
                                        navigate('/', { replace: true });
                                    }}
                                    className="w-full h-14 bg-primary-bicec-red text-white font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all"
                                >
                                    <LogOut className="w-5 h-5" />
                                    Confirmer
                                </button>
                                <button
                                    onClick={() => setShowLogoutModal(false)}
                                    className="w-full h-14 bg-slate-100 text-slate-600 font-bold rounded-2xl active:scale-95 transition-all"
                                >
                                    Annuler
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </ScreenLayout>
    );
}
