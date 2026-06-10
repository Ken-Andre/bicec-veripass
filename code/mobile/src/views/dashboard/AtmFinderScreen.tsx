import { useMemo, useState } from 'react';
import { ExternalLink, LocateFixed, MapPin, Search, WifiOff, Check, Sparkles, Clock, Landmark } from 'lucide-react';
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
  if (distanceKm === null) return 'Distance disponible avec votre position';
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  return `${distanceKm.toFixed(1)} km`;
}

export function AtmFinderScreen() {
  const { accessLevel } = useKyc();
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState('');
  const [selectedService, setSelectedService] = useState('Tous');
  const [only24h, setOnly24h] = useState(false);

  const atms = useMemo(() => {
    const filtered = filterAtmsForAccess(accessLevel).filter((atm) => {
      const q = query.trim().toLowerCase();
      const matchesSearch = !q || `${atm.name} ${atm.city} ${atm.address}`.toLowerCase().includes(q);
      
      const matchesService = selectedService === 'Tous' || 
        (selectedService === 'Retrait' && atm.services.includes('Retrait')) ||
        (selectedService === 'Dépôt' && atm.services.includes('Depot cheque'));

      const matches24h = !only24h || atm.available24h;

      return matchesSearch && matchesService && matches24h;
    });
    return rankAtms(filtered, position);
  }, [accessLevel, position, query, selectedService, only24h]);

  const fullCatalog = accessLevel !== 'GUEST';

  const locate = () => {
    setGeoStatus('Recherche de votre position...');
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setPosition({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setGeoStatus('DAB triés par proximité avec votre position.');
      },
      () => setGeoStatus('Position indisponible. La liste reste accessible hors ligne.'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  };

  const serviceFilters = ['Tous', 'Retrait', 'Dépôt'];

  return (
    <ScreenLayoutV2 showBack title="DAB à proximité" contentClassName="px-4 py-4">
      <div className="space-y-5 pb-24">
        {/* Offline Catalog Status Banner */}
        <section className="relative overflow-hidden rounded-2xl border border-primary-bicec-red/20 bg-gradient-to-r from-primary-bicec-red/5 to-primary-bicec-blue/5 p-4 shadow-sm backdrop-blur-md">
          <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-primary-bicec-red/10 blur-xl"></div>
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-bicec-red/10 shadow-inner">
              <WifiOff className="h-5 w-5 text-primary-bicec-red animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-black text-primary-bicec-blue tracking-tight">
                  Catalogue hors ligne v{ATM_CATALOG_VERSION}
                </p>
                <span className="rounded-full bg-primary-bicec-blue/10 px-2 py-0.5 text-[9px] font-black text-primary-bicec-blue uppercase">
                  PWA Local
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {fullCatalog
                  ? 'Accès illimité au catalogue complet des guichets de la banque.'
                  : 'Catalogue de base actif. Soumettez votre dossier pour débloquer la totalité.'}
              </p>
            </div>
          </div>
        </section>

        {/* Premium Search Box */}
        <div className="flex gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-1.5 shadow-sm transition-all duration-300 focus-within:border-primary-bicec-blue focus-within:shadow-md focus-within:shadow-primary-bicec-blue/5">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher une ville, agence, quartier..."
              className="h-12 min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-muted-foreground/60 text-foreground"
            />
          </label>
          <button
            type="button"
            onClick={locate}
            aria-label="Trier par proximité"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-bicec-blue text-white shadow-md shadow-primary-bicec-blue/15 hover:bg-primary-bicec-blue/90 active:scale-95 transition-all duration-200"
          >
            <LocateFixed className="h-5 w-5" />
          </button>
        </div>

        {geoStatus && (
          <div className="flex items-center gap-2 rounded-xl bg-muted/40 px-3.5 py-2">
            <Sparkles className="h-3.5 w-3.5 text-primary-bicec-red shrink-0" />
            <p className="text-xs font-semibold text-muted-foreground">{geoStatus}</p>
          </div>
        )}

        {/* Premium Interaction Service Filters */}
        <div className="space-y-2.5">
          <p className="text-[11px] font-black text-primary-bicec-blue uppercase tracking-widest">Filtrer par service</p>
          <div className="flex flex-wrap gap-2">
            {serviceFilters.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setSelectedService(filter)}
                className={cn(
                  'rounded-xl px-4 py-2 text-xs font-bold transition-all duration-200 flex items-center gap-1.5 border shadow-sm',
                  selectedService === filter
                    ? 'bg-primary-bicec-blue border-primary-bicec-blue text-white shadow-primary-bicec-blue/10'
                    : 'bg-card border-border text-muted-foreground hover:bg-muted/40'
                )}
              >
                {selectedService === filter && <Check className="h-3 w-3" />}
                {filter}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setOnly24h(!only24h)}
              className={cn(
                'rounded-xl px-4 py-2 text-xs font-bold transition-all duration-200 flex items-center gap-1.5 border shadow-sm',
                only24h
                  ? 'bg-primary-bicec-red border-primary-bicec-red text-white shadow-primary-bicec-red/10'
                  : 'bg-card border-border text-muted-foreground hover:bg-muted/40'
              )}
            >
              {only24h && <Check className="h-3 w-3" />}
              <Clock className="h-3.5 w-3.5 shrink-0" />
              Ouvert 24h/24
            </button>
          </div>
        </div>

        {/* Dynamic Results Counter */}
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-bold text-muted-foreground">
            {atms.length} guichet{atms.length > 1 ? 's' : ''} disponible{atms.length > 1 ? 's' : ''}
          </p>
          {!fullCatalog && (
            <span className="text-[10px] font-extrabold text-primary-bicec-red uppercase bg-primary-bicec-red/10 px-2 py-0.5 rounded-md animate-pulse">
              Mode Démo (6/12)
            </span>
          )}
        </div>

        {/* ATM List Cards */}
        <div className="space-y-4" data-testid="atm-finder-list">
          {atms.map((atm, idx) => (
            <article
              key={atm.id}
              data-testid="atm-item"
              className={cn(
                "group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm hover:shadow-md hover:border-primary-bicec-blue/20 transition-all duration-300 animate-slide-in-up",
                `animation-delay-[${idx * 100}ms]`
              )}
            >
              {/* Gold Left Border Highlight on Hover */}
              <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-gradient-to-b from-primary-bicec-red to-primary-bicec-blue opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center flex-wrap gap-2">
                    <h2 className="text-base font-extrabold text-primary-bicec-blue tracking-tight leading-none group-hover:text-primary-bicec-red transition-colors duration-200">
                      {atm.name}
                    </h2>
                    {atm.available24h ? (
                      <span className="shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[9px] font-black text-emerald-600 uppercase tracking-wider flex items-center gap-1 border border-emerald-500/20">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                        H24 / 7J
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[9px] font-black text-amber-600 uppercase tracking-wider flex items-center gap-1 border border-amber-500/20">
                        Horaires Agence
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-muted-foreground leading-relaxed">
                    {atm.city} • <span className="text-muted-foreground/75 font-normal">{atm.address}</span>
                  </p>
                  
                  {/* Distance badge with navigation icon */}
                  <div className="inline-flex items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1 text-xs font-bold text-primary-bicec-blue">
                    <Landmark className="h-3.5 w-3.5 text-primary-bicec-red" />
                    <span>{formatDistance(atm.distanceKm)}</span>
                  </div>
                </div>
                
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted group-hover:bg-primary-bicec-blue group-hover:text-white transition-all duration-300 shadow-sm border border-border/50">
                  <MapPin className="h-5 w-5 text-muted-foreground group-hover:text-white transition-colors duration-300" />
                </div>
              </div>

              {/* Badges and features */}
              <div className="mt-4 pt-3.5 border-t border-dashed border-border flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {atm.services.map((service) => (
                    <span
                      key={service}
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-[10px] font-bold tracking-tight shadow-sm border",
                        service.includes('Depot') || service.includes('Depot')
                          ? "bg-amber-500/5 text-amber-700 border-amber-500/15"
                          : "bg-primary-bicec-blue/5 text-primary-bicec-blue border-primary-bicec-blue/10"
                      )}
                    >
                      {service}
                    </span>
                  ))}
                </div>

                <a
                  href={mapsUrl(atm)}
                  target="_blank"
                  rel="noreferrer"
                  data-testid="atm-open-maps-link"
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-xl border border-primary-bicec-blue/20 bg-card px-4 py-2',
                    'text-xs font-black text-primary-bicec-blue active:scale-95 shadow-sm hover:bg-primary-bicec-blue hover:text-white hover:border-primary-bicec-blue transition-all duration-200',
                  )}
                >
                  Itinéraire <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </article>
          ))}

          {atms.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center bg-card shadow-inner flex flex-col items-center justify-center space-y-3 animate-fade-in">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Search className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-foreground">Aucun DAB ne correspond</p>
                <p className="mt-1 text-xs text-muted-foreground max-w-xs mx-auto">
                  Ajustez vos filtres ou la recherche pour trouver un guichet près de vous.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setSelectedService('Tous');
                  setOnly24h(false);
                }}
                className="text-xs font-bold text-primary-bicec-red underline hover:text-primary-bicec-blue transition-colors"
              >
                Réinitialiser les filtres
              </button>
            </div>
          )}
        </div>
      </div>
    </ScreenLayoutV2>
  );
}
