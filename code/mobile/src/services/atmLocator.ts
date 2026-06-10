import type { AccessTier } from '../types';

export type AtmAccess = 'basic' | 'full';

export interface OfflineAtm {
  id: string;
  name: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  services: string[];
  available24h: boolean;
  access: AtmAccess;
  lastVerified: string;
}

export interface RankedAtm extends OfflineAtm {
  distanceKm: number | null;
}

export const ATM_CATALOG_VERSION = '2026.05.23';

export const OFFLINE_ATMS: OfflineAtm[] = [
  {
    id: 'dla-siege',
    name: 'BICEC Siege Bonanjo',
    city: 'Douala',
    address: 'Avenue du General de Gaulle, Bonanjo',
    latitude: 4.0419,
    longitude: 9.6877,
    services: ['Retrait', 'Consultation solde', 'Mini releve'],
    available24h: true,
    access: 'basic',
    lastVerified: '2026-05-20',
  },
  {
    id: 'yde-hilton',
    name: 'BICEC Yaounde Centre',
    city: 'Yaounde',
    address: 'Boulevard du 20 Mai, Centre-ville',
    latitude: 3.8667,
    longitude: 11.5167,
    services: ['Retrait', 'Consultation solde'],
    available24h: true,
    access: 'basic',
    lastVerified: '2026-05-20',
  },
  {
    id: 'bfm-centre',
    name: 'BICEC Bafoussam Centre',
    city: 'Bafoussam',
    address: 'Avenue de la Republique',
    latitude: 5.4781,
    longitude: 10.4176,
    services: ['Retrait', 'Consultation solde'],
    available24h: false,
    access: 'basic',
    lastVerified: '2026-05-19',
  },
  {
    id: 'gra-centre',
    name: 'BICEC Garoua Centre',
    city: 'Garoua',
    address: 'Avenue Ahmadou Ahidjo',
    latitude: 9.3014,
    longitude: 13.3977,
    services: ['Retrait'],
    available24h: false,
    access: 'basic',
    lastVerified: '2026-05-18',
  },
  {
    id: 'mra-centre',
    name: 'BICEC Maroua Centre',
    city: 'Maroua',
    address: 'Quartier Domayo',
    latitude: 10.5909,
    longitude: 14.3159,
    services: ['Retrait', 'Consultation solde'],
    available24h: false,
    access: 'basic',
    lastVerified: '2026-05-18',
  },
  {
    id: 'bue-molyko',
    name: 'BICEC Buea Molyko',
    city: 'Buea',
    address: 'Molyko, pres de l universite',
    latitude: 4.1534,
    longitude: 9.2423,
    services: ['Retrait'],
    available24h: false,
    access: 'basic',
    lastVerified: '2026-05-18',
  },
  {
    id: 'dla-akwa',
    name: 'BICEC Akwa',
    city: 'Douala',
    address: 'Boulevard de la Liberte, Akwa',
    latitude: 4.0533,
    longitude: 9.6996,
    services: ['Retrait', 'Depot cheque', 'Consultation solde'],
    available24h: true,
    access: 'full',
    lastVerified: '2026-05-21',
  },
  {
    id: 'dla-bonamoussadi',
    name: 'BICEC Bonamoussadi',
    city: 'Douala',
    address: 'Rond-point Maetur Bonamoussadi',
    latitude: 4.0953,
    longitude: 9.7414,
    services: ['Retrait', 'Consultation solde'],
    available24h: true,
    access: 'full',
    lastVerified: '2026-05-21',
  },
  {
    id: 'yde-bastos',
    name: 'BICEC Bastos',
    city: 'Yaounde',
    address: 'Quartier Bastos',
    latitude: 3.8954,
    longitude: 11.5158,
    services: ['Retrait', 'Depot cheque'],
    available24h: true,
    access: 'full',
    lastVerified: '2026-05-21',
  },
  {
    id: 'yde-mvan',
    name: 'BICEC Mvan',
    city: 'Yaounde',
    address: 'Carrefour Mvan',
    latitude: 3.8087,
    longitude: 11.5224,
    services: ['Retrait'],
    available24h: false,
    access: 'full',
    lastVerified: '2026-05-20',
  },
  {
    id: 'kri-centre',
    name: 'BICEC Kribi',
    city: 'Kribi',
    address: 'Centre-ville, axe port',
    latitude: 2.9406,
    longitude: 9.9102,
    services: ['Retrait', 'Consultation solde'],
    available24h: false,
    access: 'full',
    lastVerified: '2026-05-19',
  },
  {
    id: 'ngd-centre',
    name: 'BICEC Ngaoundere',
    city: 'Ngaoundere',
    address: 'Avenue de la Gare',
    latitude: 7.3277,
    longitude: 13.5847,
    services: ['Retrait'],
    available24h: false,
    access: 'full',
    lastVerified: '2026-05-19',
  },
];

export function canSeeFullAtmCatalog(accessLevel: AccessTier): boolean {
  return accessLevel !== 'GUEST';
}

export function filterAtmsForAccess(accessLevel: AccessTier, atms = OFFLINE_ATMS): OfflineAtm[] {
  if (canSeeFullAtmCatalog(accessLevel)) return atms;
  return atms.filter((atm) => atm.access === 'basic');
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

export function distanceKm(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
): number {
  const earthRadiusKm = 6371;
  const dLat = toRad(destination.latitude - origin.latitude);
  const dLon = toRad(destination.longitude - origin.longitude);
  const lat1 = toRad(origin.latitude);
  const lat2 = toRad(destination.latitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function rankAtms(
  atms: OfflineAtm[],
  origin?: { latitude: number; longitude: number } | null,
): RankedAtm[] {
  return atms
    .map((atm) => ({
      ...atm,
      distanceKm: origin ? distanceKm(origin, atm) : null,
    }))
    .sort((a, b) => {
      if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
      return a.city.localeCompare(b.city) || a.name.localeCompare(b.name);
    });
}
