import { ScreenLayout } from '../components/ScreenLayout';
import { useNavigate } from 'react-router-dom';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <ScreenLayout className="justify-center p-6 text-center items-center">
      <h1 className="text-4xl font-bold mb-4">404</h1>
      <p className="text-muted-foreground mb-8">Page introuvable.</p>
      <button 
        onClick={() => navigate('/')}
        className="text-primary font-medium px-4 py-2 border border-primary/20 rounded-lg"
      >
        Retour à l'accueil
      </button>
    </ScreenLayout>
  );
}
