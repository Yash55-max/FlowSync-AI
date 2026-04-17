import { describe, expect, it } from 'vitest';
import { getPageFromHash, isAppPage, isMapPage, PAGE_ITEMS } from './appPages';

describe('appPages helpers', () => {
  it('keeps a unique, ordered page list', () => {
    expect(PAGE_ITEMS).toHaveLength(5);
    expect(PAGE_ITEMS.map((item) => item.id)).toEqual([
      'overview',
      'live-map',
      'journey',
      'operations',
      'settings',
    ]);
    expect(new Set(PAGE_ITEMS.map((item) => item.id)).size).toBe(PAGE_ITEMS.length);
  });

  it('defaults unknown hashes to overview', () => {
    expect(getPageFromHash('')).toBe('overview');
    expect(getPageFromHash('#not-a-page')).toBe('overview');
  });

  it('reads valid hashes', () => {
    expect(getPageFromHash('#live-map')).toBe('live-map');
    expect(getPageFromHash('journey')).toBe('journey');
  });

  it('recognizes only configured pages', () => {
    const pageIds = PAGE_ITEMS.map((item) => item.id);

    pageIds.forEach((pageId) => {
      expect(isAppPage(pageId)).toBe(true);
    });

    expect(isAppPage('unknown')).toBe(false);
  });

  it('keeps the map visible only on map-friendly pages', () => {
    expect(isMapPage('overview')).toBe(true);
    expect(isMapPage('live-map')).toBe(true);
    expect(isMapPage('journey')).toBe(false);
    expect(isMapPage('operations')).toBe(false);
    expect(isMapPage('settings')).toBe(false);
  });
});