import { useNavigate } from 'react-router-dom';
import { ArrowRight, LogIn, UserPlus } from 'lucide-react';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';

export default function AuthEntryScreen() {
  const navigate = useNavigate();

  return (
    <ScreenLayoutV2 className="bg-background">
      <div className="flex min-h-[100dvh] flex-col px-6 py-10">
        <div className="flex flex-1 flex-col justify-center">
          <div className="mb-10 text-center">
            <img
              src={`${import.meta.env.BASE_URL}bicec_logo.jpg`}
              alt="BICEC"
              className="mx-auto mb-6 h-20 w-20 rounded-3xl bg-white object-contain shadow-lg"
            />
            <h1 className="text-3xl font-black tracking-tight text-foreground">BICEC VeriPass</h1>
            <p className="mt-3 text-base font-medium leading-relaxed text-muted-foreground">
              Accédez à votre espace sécurisé ou créez votre compte.
            </p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => navigate('/auth/phone?mode=login')}
              className="flex h-16 w-full items-center justify-between rounded-2xl bg-primary px-5 text-left font-bold text-primary-foreground shadow-lg shadow-primary/20 active:scale-[0.99]"
            >
              <span className="flex items-center gap-3">
                <LogIn className="h-5 w-5" />
                Se connecter
              </span>
              <ArrowRight className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => navigate('/auth/phone?mode=signup')}
              className="flex h-16 w-full items-center justify-between rounded-2xl border border-border bg-card px-5 text-left font-bold text-foreground shadow-sm active:scale-[0.99]"
            >
              <span className="flex items-center gap-3">
                <UserPlus className="h-5 w-5 text-primary" />
                Créer un compte
              </span>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
    </ScreenLayoutV2>
  );
}
