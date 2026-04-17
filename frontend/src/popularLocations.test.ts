import { describe, expect, it } from 'vitest';
import { getBestPopularLocation, getPopularLocationById, getSmartPopularLocation, POPULAR_LOCATIONS, popularLocationToLatLng } from './popularLocations';

describe('popular locations', () => {
  it('limits the location set to a small curated list', () => {
    expect(POPULAR_LOCATIONS).toHaveLength(7);
  });

  it('finds locations by id', () => {
    expect(getPopularLocationById('gate-b')?.name).toBe('Gate B');
    expect(getPopularLocationById('missing')).toBeNull();
  });

  it('picks the fastest general option as the best location', () => {
    expect(getBestPopularLocation()?.name).toBe('Seat Block West');
  });

  it('chooses phase-aware smart suggestions', () => {
    expect(getSmartPopularLocation('arrival')?.type).toMatch(/parking|gate|outside/);
    expect(getSmartPopularLocation('in-venue')?.name).toBe('Seat Block West');
    expect(getSmartPopularLocation('halftime')?.name).toBe('Seat Block West');
    expect(getSmartPopularLocation('departure')?.type).toMatch(/gate|parking|outside/);
  });

  it('maps locations to stadium coordinates', () => {
    expect(popularLocationToLatLng('gate-b')).toEqual({ lat: expect.any(Number), lng: expect.any(Number) });
    expect(popularLocationToLatLng('missing')).toEqual(expect.objectContaining({ lat: expect.any(Number), lng: expect.any(Number) }));
  });
});