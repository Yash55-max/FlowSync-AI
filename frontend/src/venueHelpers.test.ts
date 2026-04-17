import { describe, expect, it } from 'vitest';
import { markerColorByDensity, REAL_ZONE_LABELS, STADIUM_CENTER, zoneDisplayName, zoneToLatLng } from './venueHelpers';

describe('venue helpers', () => {
  it('formats zone display names with known and unknown labels', () => {
    expect(zoneDisplayName('zone-1')).toBe('Gate A (zone-1)');
    expect(zoneDisplayName('custom-zone')).toBe('CUSTOM-ZONE (custom-zone)');
    expect(zoneDisplayName('zone-1', { 'zone-1': 'North Gate' })).toBe('North Gate (zone-1)');
  });

  it('maps density to the expected colors', () => {
    expect(markerColorByDensity(10)).toBe('#22c55e');
    expect(markerColorByDensity(45)).toBe('#f59e0b');
    expect(markerColorByDensity(75)).toBe('#ff3b30');
  });

  it('converts row and column into stadium coordinates', () => {
    const position = zoneToLatLng({ zone_id: 'zone-1', row: 4, col: 5, density_score: 10 });

    expect(position.lat).toBeCloseTo(STADIUM_CENTER.lat + 0.0009, 10);
    expect(position.lng).toBeCloseTo(STADIUM_CENTER.lng + 0.00174, 10);
  });

  it('supports custom venue centers', () => {
    const position = zoneToLatLng({ zone_id: 'zone-1', row: 2, col: 2, density_score: 10 }, { lat: 10, lng: 20 });

    expect(position).toEqual({ lat: 10, lng: 20 });
  });

  it('exposes the expected canonical zone labels', () => {
    expect(REAL_ZONE_LABELS['zone-7']).toBe('South Concourse');
    expect(REAL_ZONE_LABELS['zone-25']).toBe('Halftime Hotspot');
  });
});