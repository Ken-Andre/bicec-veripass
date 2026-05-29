import { fetchWithCorrelation } from './apiClient';

export interface GeoItem {
  code: string;
  name: string;
  commune_name?: string;
}

export type GeoSource = 'network' | 'cache' | 'fallback';

export interface GeoLookupResult<T extends GeoItem> {
  items: T[];
  source: GeoSource;
  unavailable: boolean;
}

const CACHE_PREFIX = 'vp_geo_';

const FALLBACK_REGIONS: GeoItem[] = [
  { code: 'CE', name: 'Centre' },
  { code: 'LT', name: 'Littoral' },
  { code: 'OU', name: 'Ouest' },
  { code: 'SU', name: 'Sud' },
  { code: 'NO', name: 'Nord' },
  { code: 'EN', name: 'Extreme-Nord' },
  { code: 'AD', name: 'Adamaoua' },
  { code: 'ES', name: 'Est' },
  { code: 'NW', name: 'Nord-Ouest' },
  { code: 'SW', name: 'Sud-Ouest' },
];

const FALLBACK_CITIES: Record<string, GeoItem[]> = {
  CE: [
    { code: 'YDE', name: 'Yaounde' },
    { code: 'MBA', name: 'Mbalmayo' },
    { code: 'BFA', name: 'Bafia' },
  ],
  LT: [
    { code: 'DLA', name: 'Douala' },
    { code: 'EDA', name: 'Edea' },
    { code: 'NKG', name: 'Nkongsamba' },
  ],
  OU: [
    { code: 'BFM', name: 'Bafoussam' },
    { code: 'DSG', name: 'Dschang' },
    { code: 'FBN', name: 'Foumban' },
  ],
};

const FALLBACK_QUARTIERS: Record<string, GeoItem[]> = {
  YDE: [
    { code: 'BAS', name: 'Bastos', commune_name: 'Yaounde 1er' },
    { code: 'NLG', name: 'Nlongkak', commune_name: 'Yaounde 1er' },
    { code: 'MVG', name: 'Mvog-Mbi', commune_name: 'Yaounde 2e' },
    { code: 'BYA', name: 'Biyem-Assi', commune_name: 'Yaounde 6e' },
  ],
  DLA: [
    { code: 'AKW', name: 'Akwa', commune_name: 'Douala 1er' },
    { code: 'BPR', name: 'Bonapriso', commune_name: 'Douala 1er' },
    { code: 'BMS', name: 'Bonamoussadi', commune_name: 'Douala 5e' },
    { code: 'NDK', name: 'Ndokoti', commune_name: 'Douala 3e' },
  ],
  BFM: [
    { code: 'TGI', name: 'Tamdja', commune_name: 'Bafoussam 1er' },
    { code: 'KAM', name: 'Kamkop', commune_name: 'Bafoussam 2e' },
  ],
};

const memoryCache = new Map<string, GeoItem[]>();

function readCache<T extends GeoItem>(key: string): T[] | null {
  const memory = memoryCache.get(key);
  if (memory) return memory as T[];
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T[];
    if (Array.isArray(parsed)) {
      memoryCache.set(key, parsed);
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

function writeCache(key: string, items: GeoItem[]) {
  memoryCache.set(key, items);
  try {
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(items));
  } catch {
    // Cache is opportunistic; never block the form for storage failures.
  }
}

async function fetchGeo<T extends GeoItem>(
  key: string,
  url: string,
  fallback: T[],
): Promise<GeoLookupResult<T>> {
  const cached = readCache<T>(key);
  if (cached?.length) {
    return { items: cached, source: 'cache', unavailable: false };
  }

  try {
    const response = await fetchWithCorrelation(url);
    if (!response.ok) throw new Error(`geo_${response.status}`);
    const items = await response.json() as T[];
    if (Array.isArray(items) && items.length > 0) {
      writeCache(key, items);
      return { items, source: 'network', unavailable: false };
    }
  } catch {
    // Fall through to local reference data.
  }

  return { items: fallback, source: 'fallback', unavailable: true };
}

export function preloadGeoRegions() {
  void getGeoRegions();
}

export function getGeoRegions() {
  return fetchGeo('regions', '/api/v1/kyc/geo/regions', FALLBACK_REGIONS);
}

export function getGeoCities(regionCode: string) {
  return fetchGeo(
    `cities_${regionCode}`,
    `/api/v1/kyc/geo/cities/${regionCode}`,
    FALLBACK_CITIES[regionCode] ?? [],
  );
}

export function getGeoQuartiers(cityCode: string) {
  return fetchGeo(
    `quartiers_${cityCode}`,
    `/api/v1/kyc/geo/quartiers/${cityCode}`,
    FALLBACK_QUARTIERS[cityCode] ?? [],
  );
}
