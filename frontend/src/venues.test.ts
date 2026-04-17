import { describe, expect, it } from 'vitest';
import { getDefaultVenue, getVenueById, VENUE_GROUPS, VENUE_OPTIONS, VENUES } from './venues';

describe('venues', () => {
  it('exposes the full 10-location venue list', () => {
    expect(VENUES).toHaveLength(10);
    expect(VENUE_OPTIONS).toHaveLength(10);
    expect(VENUES.filter((venue) => venue.category === 'stadium')).toHaveLength(5);
    expect(VENUES.filter((venue) => venue.category === 'public-space')).toHaveLength(5);
  });

  it('provides grouped venue options for dropdown rendering', () => {
    expect(VENUE_GROUPS).toHaveLength(2);
    expect(VENUE_GROUPS[0].label).toBe('Stadiums');
    expect(VENUE_GROUPS[1].label).toBe('Public Spaces');
    expect(VENUE_GROUPS[0].options).toHaveLength(5);
    expect(VENUE_GROUPS[1].options).toHaveLength(5);
  });

  it('finds venues by id', () => {
    expect(getVenueById('wembley-stadium')?.name).toBe('Wembley Stadium');
    expect(getVenueById('kumbh-mela-grounds')?.name).toBe('Kumbh Mela Grounds');
    expect(getVenueById('missing')).toBeNull();
  });

  it('has a stable default venue', () => {
    expect(getDefaultVenue()?.name).toBe('Narendra Modi Stadium');
  });
});