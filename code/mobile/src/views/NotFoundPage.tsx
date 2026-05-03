import { useNavigate } from 'react-router-dom';
import { ScreenLayoutV2 } from '../components/ui/ScreenLayoutV2';
import { Button } from '../components/ui/button';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <ScreenLayoutV2 center>
      <h1 className="text-4xl font-bold mb-4">404</h1>
      <p className="text-muted-foreground mb-8">Page introuvable.</p>
      <Button variant="secondary" onClick={() => navigate('/')}>
        Retour à l'accueil
      </Button>
    </ScreenLayoutV2>
  );
}
