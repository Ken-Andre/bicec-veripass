import { describe, expect, it } from 'vitest';
import { filterAtmsForAccess, rankAtms, OFFLINE_ATMS } from './atmLocator';

describe('atmLocator', () => {
  it('keeps pre-submission users on the basic offline catalogue', () => {
    const atms = filterAtmsForAccess('GUEST');

    expect(atms.length).toBeGreaterThan(0);
    expect(atms.length).toBeLessThan(OFFLINE_ATMS.length);
    expect(atms.every((atm) => atm.access === 'basic')).toBe(true);
  });

  it('shows the complete offline catalogue after the dossier is submitted', () => {
    expect(filterAtmsForAccess('RESTRICTED')).toHaveLength(OFFLINE_ATMS.length);
    expect(filterAtmsForAccess('LIMITED_ACCESS')).toHaveLength(OFFLINE_ATMS.length);
    expect(filterAtmsForAccess('FULL_ACCESS')).toHaveLength(OFFLINE_ATMS.length);
  });

  it('ranks DABs by proximity in O(n log n) sort after one O(n) distance pass', () => {
    const ranked = rankAtms(OFFLINE_ATMS, { latitude: 4.05, longitude: 9.7 });

    expect(ranked[0].city).toBe('Douala');
    expect(ranked[0].distanceKm).not.toBeNull();
    for (let index = 1; index < ranked.length; index += 1) {
      expect(ranked[index].distanceKm!).toBeGreaterThanOrEqual(ranked[index - 1].distanceKm!);
    }
  });
});
