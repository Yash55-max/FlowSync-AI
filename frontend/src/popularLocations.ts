import { STADIUM_CENTER, type ZoneLike, zoneToLatLng } from './venueHelpers';

export type PopularLocationType = 'food' | 'restroom' | 'gate' | 'seat' | 'parking' | 'outside';
export type PopularLocationPhase = 'arrival' | 'in-venue' | 'halftime' | 'departure';

export type PopularLocation = {
  id: string;
  name: string;
  type: PopularLocationType;
  waitMinutes: number;
  crowdLabel: 'low' | 'medium' | 'high';
  crowdHint: string;
  zone: ZoneLike;
  emoji: string;
};

export const POPULAR_LOCATIONS: PopularLocation[] = [
  {
    id: 'food-court-a',
    name: 'Food Court A',
    type: 'food',
    waitMinutes: 5,
    crowdLabel: 'medium',
    crowdHint: 'Balanced footfall and fast service.',
    zone: { zone_id: 'zone-6', row: 2, col: 4, density_score: 48 },
    emoji: '🍔',
  },
  {
    id: 'food-court-c',
    name: 'Food Court C',
    type: 'food',
    waitMinutes: 2,
    crowdLabel: 'low',
    crowdHint: 'Best option during food rush.',
    zone: { zone_id: 'zone-18', row: 3, col: 5, density_score: 28 },
    emoji: '🍟',
  },
  {
    id: 'gate-b',
    name: 'Gate B',
    type: 'gate',
    waitMinutes: 3,
    crowdLabel: 'low',
    crowdHint: 'Fast entry/exit with low queue pressure.',
    zone: { zone_id: 'zone-5', row: 1, col: 4, density_score: 22 },
    emoji: '🚪',
  },
  {
    id: 'restroom-2',
    name: 'Restroom 2',
    type: 'restroom',
    waitMinutes: 6,
    crowdLabel: 'high',
    crowdHint: 'Useful, but currently crowded.',
    zone: { zone_id: 'zone-23', row: 4, col: 6, density_score: 82 },
    emoji: '🚻',
  },
  {
    id: 'seat-block-west',
    name: 'Seat Block West',
    type: 'seat',
    waitMinutes: 1,
    crowdLabel: 'low',
    crowdHint: 'Steady access and low movement friction.',
    zone: { zone_id: 'zone-16', row: 5, col: 4, density_score: 18 },
    emoji: '🪑',
  },
  {
    id: 'parking-a',
    name: 'Parking A',
    type: 'parking',
    waitMinutes: 4,
    crowdLabel: 'medium',
    crowdHint: 'Good for arrivals, moderate flow.',
    zone: { zone_id: 'zone-4', row: 0, col: 1, density_score: 41 },
    emoji: '🅿️',
  },
  {
    id: 'metro-entry',
    name: 'Metro Entry',
    type: 'outside',
    waitMinutes: 7,
    crowdLabel: 'medium',
    crowdHint: 'Optional outside access point.',
    zone: { zone_id: 'zone-14', row: 0, col: 6, density_score: 34 },
    emoji: '🚇',
  },
];

export const getPopularLocationById = (locationId: string) =>
  POPULAR_LOCATIONS.find((location) => location.id === locationId) ?? null;

export const getBestPopularLocation = () =>
  [...POPULAR_LOCATIONS].sort((left, right) => left.waitMinutes - right.waitMinutes || left.crowdLabel.localeCompare(right.crowdLabel))[0] ?? null;

export const getSmartPopularLocation = (phase: PopularLocationPhase) => {
  const preferredTypes: Record<PopularLocationPhase, PopularLocationType[]> = {
    arrival: ['parking', 'gate', 'outside'],
    'in-venue': ['food', 'restroom', 'seat'],
    halftime: ['food', 'restroom', 'seat'],
    departure: ['gate', 'parking', 'outside'],
  };

  const preferred = POPULAR_LOCATIONS.filter((location) => preferredTypes[phase].includes(location.type));
  const pool = preferred.length ? preferred : POPULAR_LOCATIONS;

  return [...pool].sort((left, right) => left.waitMinutes - right.waitMinutes || left.crowdLabel.localeCompare(right.crowdLabel))[0] ?? null;
};

export const popularLocationToLatLng = (locationId: string, center = STADIUM_CENTER) => {
  const location = getPopularLocationById(locationId);
  return location ? zoneToLatLng(location.zone, center) : center;
};
