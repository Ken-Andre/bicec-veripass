import { useMemo, useState } from 'react';
import { ExternalLink, LocateFixed, MapPin, Search, WifiOff } from 'lucide-react';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { useKyc } from '../../contexts/KycContext';
import {
  ATM_CATALOG_VERSION,
  filterAtmsForAccess,
  rankAtms,
  type RankedAtm,
} from '../../services/atmLocator';
import { cn } from '../../lib/utils';

function mapsUrl(atm: RankedAtm) {
  return `https://www.google.com/maps/search/?api=1&query=${atm.latitude},${atm.longitude}`;
}

function formatDistance(distanceKm: number | null) {
  if (distanceKm === null) return 'Distance disponible avec la position';
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  return `${distanceKm.toFixed(1)} km`;
}

export function AtmFinderScreen() {
  const { accessLevel } = useKyc();
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState('');

  const atms = useMemo(() => {
    const filtered = filterAtmsForAccess(accessLevel).filter((atm) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return `${atm.name} ${atm.city} ${atm.address}`.toLowerCase().includes(q);
    });
    return rankAtms(filtered, position);
  }, [accessLevel, position, query]);

  const fullCatalog = accessLevel !== 'GUEST';

  const locate = () => {
    setGeoStatus('Recherche de votre position...');
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setPosition({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setGeoStatus('DAB tries par proximite.');
      },
      () => setGeoStatus('Position indisponible. La liste reste accessible hors ligne.'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  };

  return (
    <ScreenLayoutV2 showBack title="DAB a proximite" contentClassName="px-4 py-4">
      <div className="space-y-4 pb-20">
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <WifiOff className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                Catalogue hors ligne v{ATM_CATALOG_VERSION}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {fullCatalog
                  ? 'Catalogue complet disponible apres soumission du dossier.'
                  : 'Catalogue de base disponible avant soumission du dossier.'}
              </p>
            </div>
          </div>
        </section>

        <div className="flex gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ville, quartier, agence..."
              className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </label>
          <button
            type="button"
            onClick={locate}
            aria-label="Trier par proximite"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground active:scale-95"
          >
            <LocateFixed className="h-5 w-5" />
          </button>
        </div>

        {geoStatus && <p className="text-xs font-medium text-muted-foreground">{geoStatus}</p>}

        <div className="space-y-3">
          {atms.map((atm) => (
            <article key={atm.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-sm font-bold text-foreground">{atm.name}</h2>
                    {atm.available24h && (
                      <span className="shrink-0 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">
                        24h
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{atm.city} - {atm.address}</p>
                  <p className="mt-2 text-xs font-semibold text-primary">{formatDistance(atm.distanceKm)}</p>
                </div>
                <MapPin className="h-5 w-5 shrink-0 text-primary" />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {atm.services.map((service) => (
                  <span key={service} className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                    {service}
                  </span>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-[11px] text-muted-foreground">Verifie le {atm.lastVerified}</span>
                <a
                  href={mapsUrl(atm)}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    'inline-flex items-center gap-1 rounded-xl border border-primary/20 px-3 py-2',
                    'text-xs font-bold text-primary active:scale-95',
                  )}
                >
                  Ouvrir Maps <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </article>
          ))}

          {atms.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center">
              <p className="text-sm font-semibold text-foreground">Aucun DAB trouve</p>
              <p className="mt-1 text-xs text-muted-foreground">Essayez une autre ville ou effacez la recherche.</p>
            </div>
          )}
        </div>
      </div>
    </ScreenLayoutV2>
  );
}
