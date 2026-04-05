import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { ScreenLayout } from '../../components/ScreenLayout';
import { MapPin } from 'lucide-react';

interface GeoItem { code: string; name: string; commune_name?: string; }

export default function AddressScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [regions, setRegions] = useState<GeoItem[]>([]);
  const [cities, setCities] = useState<GeoItem[]>([]);
  const [quartiers, setQuartiers] = useState<GeoItem[]>([]);
  const [form, setForm] = useState({ region: '', city: '', commune: '', quartier: '', lieu_dit: '' });

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    fetch('/api/v1/kyc/geo/regions', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setRegions).catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.region) return;
    const token = localStorage.getItem('access_token');
    fetch(`/api/v1/kyc/geo/cities/${form.region}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setCities).catch(() => {});
  }, [form.region]);

  useEffect(() => {
    if (!form.city) return;
    const token = localStorage.getItem('access_token');
    fetch(`/api/v1/kyc/geo/quartiers/${form.city}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setQuartiers).catch(() => {});
  }, [form.city]);

  const handleSubmit = async () => {
    try {
      const token = localStorage.getItem('access_token');
      await fetch('/api/v1/kyc/address/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      navigate('/kyc/niu');
    } catch {
      navigate('/kyc/niu');
    }
  };

  return (
    <ScreenLayout title={t('address.title')} showBack>
      <div className="flex flex-col gap-4 py-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="w-4 h-4" />
          <span>{t('address.gps.notice')}</span>
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
              placeholder={t('address.lieuDit')}
            />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!form.region || !form.city || !form.quartier}
          className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium disabled:opacity-50 mt-4"
        >
          {t('common.continue')}
        </button>
      </div>
    </ScreenLayout>
  );
}