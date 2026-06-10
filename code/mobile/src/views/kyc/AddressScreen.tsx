import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { Button } from '../../components/ui/button';
import { CheckCircle, Loader2, MapPin, Navigation, RefreshCw } from 'lucide-react';
import { useKyc } from '../../contexts/KycContext';
import { fetchWithCorrelation } from '../../services/apiClient';
import { enqueueOfflineAddress } from '../../services/kycSyncService';
import {
  getGeoCities,
  getGeoQuartiers,
  getGeoRegions,
  preloadGeoRegions,
  type GeoItem,
} from '../../services/geoReferenceService';

interface AddressForm {
  region: string;
  city: string;
  commune: string;
  quartier: string;
  lieu_dit: string;
  gps_lat?: number;
  gps_lng?: number;
}

export default function AddressScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { setAddress, completeStep, sessionId, setSessionId } = useKyc();
  const [regions, setRegions] = useState<GeoItem[]>([]);
  const [cities, setCities] = useState<GeoItem[]>([]);
  const [quartiers, setQuartiers] = useState<GeoItem[]>([]);
  const [form, setForm] = useState<AddressForm>({
    region: '',
    city: '',
    commune: '',
    quartier: '',
    lieu_dit: '',
  });
  const [regionsLoading, setRegionsLoading] = useState(true);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [quartiersLoading, setQuartiersLoading] = useState(false);
  const [geoMessage, setGeoMessage] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [gpsSuccess, setGpsSuccess] = useState(false);

  const text = useCallback((key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  }, [t]);

  const loadRegions = useCallback(async () => {
    setRegionsLoading(true);
    setGeoMessage('');
    const result = await getGeoRegions();
    setRegions(result.items);
    if (result.unavailable) {
      setGeoMessage(
        result.items.length
          ? text('address.geo.fallback', 'Mode secours actif: certaines localites restent disponibles.')
          : text('address.geo.unavailable', 'Service de localites temporairement indisponible. Reessayez.'),
      );
    }
    setRegionsLoading(false);
  }, [text]);

  useEffect(() => {
    preloadGeoRegions();
    const timer = window.setTimeout(() => {
      void loadRegions();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadRegions]);

  useEffect(() => {
    if (!form.region) {
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      setCitiesLoading(true);
      setGeoMessage('');
      void getGeoCities(form.region)
        .then((result) => {
          if (!active) return;
          setCities(result.items);
          if (result.unavailable) {
            setGeoMessage(
              result.items.length
                ? text('address.geo.fallback', 'Mode secours actif: certaines localites restent disponibles.')
                : text('address.geo.unavailable', 'Service de localites temporairement indisponible. Reessayez.'),
            );
          }
        })
        .finally(() => {
          if (active) setCitiesLoading(false);
        });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [form.region, text]);

  useEffect(() => {
    if (!form.city) {
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      setQuartiersLoading(true);
      setGeoMessage('');
      void getGeoQuartiers(form.city)
        .then((result) => {
          if (!active) return;
          setQuartiers(result.items);
          if (result.unavailable) {
            setGeoMessage(
              result.items.length
                ? text('address.geo.fallback', 'Mode secours actif: certaines localites restent disponibles.')
                : text('address.geo.unavailable', 'Service de localites temporairement indisponible. Reessayez.'),
            );
          }
        })
        .finally(() => {
          if (active) setQuartiersLoading(false);
        });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [form.city, text]);

  const captureGps = () => {
    if (!navigator.geolocation) {
      setGpsError(text('address.gps.unsupported', "La geolocalisation n'est pas disponible sur cet appareil."));
      return;
    }

    setGpsLoading(true);
    setGpsError('');
    setGpsSuccess(false);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const inCameroon = 2.0 <= latitude && latitude <= 13.0 && 8.0 <= longitude && longitude <= 17.0;
        setForm((prev) => ({ ...prev, gps_lat: latitude, gps_lng: longitude }));
        setGpsLoading(false);
        setGpsSuccess(inCameroon);
        if (!inCameroon) {
          setGpsError(text('address.gps.outOfCameroon', 'Position hors du Cameroun. Verifiez votre localisation.'));
        }
      },
      () => {
        setGpsLoading(false);
        setGpsError(text('address.gps.error', 'Impossible d obtenir la position. Verifiez les permissions GPS.'));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };

  const blockerReason = !form.gps_lat || !gpsSuccess
    ? text('address.blocker.gps', 'Capturez votre position GPS pour continuer.')
    : !form.region
      ? text('address.blocker.region', 'Selectionnez votre region.')
      : !form.city
        ? text('address.blocker.city', 'Selectionnez votre ville.')
        : !form.quartier
          ? text('address.blocker.quartier', 'Selectionnez votre quartier.')
          : '';

  const handleSubmit = async () => {
    if (blockerReason) return;

    const addressData = {
      region: form.region,
      city: form.city,
      commune: form.commune,
      quartier: form.quartier,
      lieu_dit: form.lieu_dit,
      gps_lat: form.gps_lat,
      gps_lng: form.gps_lng,
    };
    setAddress(addressData);

    const sid = sessionId || `offline-${Date.now()}`;
    if (!sessionId) setSessionId(sid);

    const online = typeof navigator !== 'undefined' && navigator.onLine;
    if (online) {
      try {
        await fetchWithCorrelation('/api/v1/kyc/address/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(addressData),
        });
      } catch {
        await enqueueOfflineAddress({ sessionId: sid, address: addressData });
      }
    } else {
      await enqueueOfflineAddress({ sessionId: sid, address: addressData });
    }

    completeStep('address');
    navigate('/kyc/niu');
  };

  return (
    <ScreenLayoutV2 title={text('address.title', 'Adresse de residence')} showBack>
      <div className="flex flex-col gap-4 py-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="w-4 h-4" />
          <span>{text('address.gps.notice', 'Indiquez votre adresse actuelle pour la validation KYC.')}</span>
        </div>

        <div className="bg-accent/10 border border-accent/20 rounded-xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                <Navigation className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{text('address.gps.title', 'Localisation GPS')}</p>
                {form.gps_lat && form.gps_lng ? (
                  <p className="text-xs text-muted-foreground">
                    {gpsSuccess
                      ? text('address.gps.captured', 'Position capturee')
                      : text('address.gps.outOfZone', 'Position capturee hors zone')}
                    <br />
                    Lat: {form.gps_lat.toFixed(4)}, Lng: {form.gps_lng.toFixed(4)}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">{text('address.gps.required', 'Requise pour validation')}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={captureGps}
              disabled={gpsLoading}
              className="min-w-[6.5rem] shrink-0 px-3 py-2 bg-accent text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {gpsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : gpsSuccess ? <CheckCircle className="w-4 h-4" /> : <Navigation className="w-4 h-4" />}
              {gpsLoading
                ? text('address.gps.loading', 'Acquisition...')
                : gpsSuccess
                  ? text('address.gps.retake', 'Reprendre')
                  : text('address.gps.capture', 'Capturer')}
            </button>
          </div>
          {gpsError && (
            <p className="text-xs text-destructive mt-2 bg-destructive/10 px-2 py-1 rounded">{gpsError}</p>
          )}
        </div>

        {geoMessage && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            <span>{geoMessage}</span>
            <button
              type="button"
              onClick={() => void loadRegions()}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white px-2 py-1 font-bold text-amber-900 shadow-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {text('common.retry', 'Reessayer')}
            </button>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">{text('address.region', 'Region')}</label>
            <select
              aria-label={text('address.region', 'Region')}
              value={form.region}
              onChange={(event) => {
                setCities([]);
                setQuartiers([]);
                setForm({ ...form, region: event.target.value, city: '', quartier: '' });
              }}
              className="w-full mt-1 h-12 px-3 rounded-lg border bg-background"
              disabled={regionsLoading}
            >
              <option value="">
                {regionsLoading ? text('common.loading', 'Chargement...') : `-- ${text('address.region', 'Region')} --`}
              </option>
              {regions.map((region) => <option key={region.code} value={region.code}>{region.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">{text('address.city', 'Ville')}</label>
            <select
              aria-label={text('address.city', 'Ville')}
              value={form.city}
              onChange={(event) => {
                setQuartiers([]);
                setForm({ ...form, city: event.target.value, quartier: '' });
              }}
              className="w-full mt-1 h-12 px-3 rounded-lg border bg-background"
              disabled={!form.region || citiesLoading}
            >
              <option value="">
                {citiesLoading ? text('common.loading', 'Chargement...') : `-- ${text('address.city', 'Ville')} --`}
              </option>
              {(form.region ? cities : []).map((city) => <option key={city.code} value={city.code}>{city.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">{text('address.quartier', 'Quartier')}</label>
            <select
              aria-label={text('address.quartier', 'Quartier')}
              value={form.quartier}
              onChange={(event) => setForm({
                ...form,
                quartier: event.target.value,
                commune: quartiers.find((quartier) => quartier.code === event.target.value)?.commune_name || '',
              })}
              className="w-full mt-1 h-12 px-3 rounded-lg border bg-background"
              disabled={!form.city || quartiersLoading}
            >
              <option value="">
                {quartiersLoading ? text('common.loading', 'Chargement...') : `-- ${text('address.quartier', 'Quartier')} --`}
              </option>
              {(form.city ? quartiers : []).map((quartier) => (
                <option key={quartier.code} value={quartier.code}>
                  {quartier.name} ({quartier.commune_name})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">{text('address.lieuDit', 'Lieu-dit')}</label>
            <input
              type="text"
              value={form.lieu_dit}
              onChange={(event) => setForm({ ...form, lieu_dit: event.target.value })}
              className="w-full mt-1 h-12 px-3 rounded-lg border bg-background"
              placeholder={text('address.lieuDit.placeholder', 'Lieu-dit, rue, numero')}
            />
          </div>
        </div>

        <Button onClick={handleSubmit} disabled={Boolean(blockerReason)} className="w-full mt-4">
          {text('common.continue', 'Continuer')}
        </Button>
        {blockerReason && (
          <p className="text-center text-xs font-medium text-muted-foreground">{blockerReason}</p>
        )}
      </div>
    </ScreenLayoutV2>
  );
}
