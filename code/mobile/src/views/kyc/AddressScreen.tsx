import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { Button } from '../../components/ui/button';
import { MapPin, Navigation, Loader2, CheckCircle } from 'lucide-react';
import { useKyc } from '../../contexts/KycContext';
import { fetchWithCorrelation } from '../../services/apiClient';
import { enqueueOfflineAddress } from '../../services/kycSyncService';

interface GeoItem { code: string; name: string; commune_name?: string; }

export default function AddressScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { setAddress, completeStep, sessionId, setSessionId } = useKyc();
  const [regions, setRegions] = useState<GeoItem[]>([]);
  const [cities, setCities] = useState<GeoItem[]>([]);
  const [quartiers, setQuartiers] = useState<GeoItem[]>([]);
  const [form, setForm] = useState({ region: '', city: '', commune: '', quartier: '', lieu_dit: '', gps_lat: undefined as number | undefined, gps_lng: undefined as number | undefined });
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [gpsSuccess, setGpsSuccess] = useState(false);

  useEffect(() => {
    fetchWithCorrelation('/api/v1/kyc/geo/regions')
      .then(r => r.json()).then(setRegions).catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.region) return;
    fetchWithCorrelation(`/api/v1/kyc/geo/cities/${form.region}`)
      .then(r => r.json()).then(setCities).catch(() => {});
  }, [form.region]);

  useEffect(() => {
    if (!form.city) return;
    fetchWithCorrelation(`/api/v1/kyc/geo/quartiers/${form.city}`)
      .then(r => r.json()).then(setQuartiers).catch(() => {});
  }, [form.city]);

  const captureGps = () => {
    if (!navigator.geolocation) {
      setGpsError('La géolocalisation n\'est pas disponible sur cet appareil.');
      return;
    }
    setGpsLoading(true);
    setGpsError('');
    setGpsSuccess(false);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setForm(prev => ({ ...prev, gps_lat: latitude, gps_lng: longitude }));
        setGpsLoading(false);
        setGpsSuccess(true);
        // Cameroon bounds validation (~2°N-13°N, 8°E-17°E)
        if (!(2.0 <= latitude && latitude <= 13.0) || !(8.0 <= longitude && longitude <= 17.0)) {
          setGpsError('Position hors du Cameroun. Vérifiez que vous êtes bien au Cameroun.');
          setGpsSuccess(false);
        }
      },
      (err) => {
        setGpsLoading(false);
        setGpsError('Impossible d\'obtenir la position. Vérifiez les permissions GPS.');
        console.error('GPS error:', err);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };

  const handleSubmit = async () => {
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
        // Online request failed — queue for later sync
        await enqueueOfflineAddress({ sessionId: sid, address: addressData });
      }
    } else {
      // Offline — enqueue for sync on reconnect
      await enqueueOfflineAddress({ sessionId: sid, address: addressData });
    }
    completeStep('address');
    navigate('/kyc/niu');
  };

  return (
    <ScreenLayoutV2 title={t('address.title')} showBack>
      <div className="flex flex-col gap-4 py-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="w-4 h-4" />
          <span>{t('address.gps.notice') || 'Veuillez indiquer votre adresse actuelle'}</span>
        </div>

        {/* GPS Capture Section */}
        <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Navigation className="w-5 h-5 text-accent" />
              <div>
                <p className="text-sm font-medium text-accent">Localisation GPS</p>
                {form.gps_lat && form.gps_lng ? (
                  <p className="text-xs text-accent">
                    {gpsSuccess ? '✓ Position capturée' : 'Position capturée (hors zone)'}
                    <br />
                    Lat: {form.gps_lat.toFixed(4)}, Lng: {form.gps_lng.toFixed(4)}
                  </p>
                ) : (
                  <p className="text-xs text-accent">Requise pour validation</p>
                )}
              </div>
            </div>
            <button
              onClick={captureGps}
              disabled={gpsLoading}
              className="px-3 py-2 bg-accent text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {gpsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : gpsSuccess ? <CheckCircle className="w-4 h-4" /> : <Navigation className="w-4 h-4" />}
              {gpsLoading ? 'Acquisition...' : gpsSuccess ? 'Reprendre' : 'Capturer'}
            </button>
          </div>
          {gpsError && (
            <p className="text-xs text-destructive mt-2 bg-destructive/10 px-2 py-1 rounded">{gpsError}</p>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">{t('address.region')}</label>
            <select
              value={form.region}
              onChange={e => setForm({ ...form, region: e.target.value, city: '', quartier: '' })}
              className="w-full mt-1 px-3 py-2 rounded-lg border bg-background"
            >
              <option value="">-- {t('address.region')} --</option>
              {regions.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">{t('address.city')}</label>
            <select
              value={form.city}
              onChange={e => setForm({ ...form, city: e.target.value, quartier: '' })}
              className="w-full mt-1 px-3 py-2 rounded-lg border bg-background"
              disabled={!form.region}
            >
              <option value="">-- {t('address.city')} --</option>
              {cities.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">{t('address.quartier')}</label>
            <select
              value={form.quartier}
              onChange={e => setForm({ ...form, quartier: e.target.value, commune: quartiers.find(q => q.code === e.target.value)?.commune_name || '' })}
              className="w-full mt-1 px-3 py-2 rounded-lg border bg-background"
              disabled={!form.city}
            >
              <option value="">-- {t('address.quartier')} --</option>
              {quartiers.map(q => <option key={q.code} value={q.code}>{q.name} ({q.commune_name})</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">{t('address.lieuDit')}</label>
            <input
              type="text"
              value={form.lieu_dit}
              onChange={e => setForm({ ...form, lieu_dit: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-lg border bg-background"
              placeholder={t('address.lieuDit') || 'Lieu-dit, rue, N°'}
            />
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!form.region || !form.city || !form.quartier || !form.gps_lat}
          className="w-full mt-4"
        >
          {t('common.continue')}
        </Button>
      </div>
    </ScreenLayoutV2>
  );
}
