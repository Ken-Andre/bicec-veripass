import { ScreenLayout } from '../components/ScreenLayout';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function HomePage() {
  const navigate = useNavigate();

  return (
    <ScreenLayout className="justify-center p-6 text-center">
      <div className="flex flex-col items-center space-y-8 flex-1 justify-center">
        {/* Logo or Icon */}
        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
          <ShieldCheck className="w-12 h-12 text-primary" />
        </div>
        
        {/* Title & Tagline */}
        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight">BICEC VeriPass</h1>
          <p className="text-muted-foreground max-w-[280px] mx-auto text-lg leading-relaxed">
            Ouverture de compte digitale sécurisée et instantanée.
          </p>
        </div>

        {/* CTA */}
        <div className="w-full pt-8 pb-4">
          <button 
            onClick={() => navigate('/')} 
            className="w-full bg-primary text-primary-foreground font-semibold h-14 rounded-xl shadow-lg flex items-center justify-center space-x-2 active:scale-[0.98] transition-all"
          >
            <span>Commencer</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </ScreenLayout>
  );
}
