export type VenueId =
  | 'narendra-modi-stadium'
  | 'wembley-stadium'
  | 'metlife-stadium'
  | 'melbourne-cricket-ground'
  | 'camp-nou'
  | 'times-square'
  | 'burj-khalifa'
  | 'eiffel-tower'
  | 'tirupati-temple'
  | 'kumbh-mela-grounds';

export type VenueCategory = 'stadium' | 'public-space';

export type VenueProfile = {
  id: VenueId;
  name: string;
  category: VenueCategory;
  layoutMessage: string;
  center: { lat: number; lng: number };
  zoneLabels: Record<string, string>;
};

const ZONE_IDS = Array.from({ length: 25 }, (_, index) => `zone-${index + 1}`);

const buildZoneLabels = (labels: string[]) =>
  Object.fromEntries(ZONE_IDS.map((zoneId, index) => [zoneId, labels[index] ?? zoneId]));

const BASE_STADIUM_LABELS = [
  'Gate A',
  'Food Court North',
  'West Stand',
  'Parking A',
  'Gate B',
  'Food Court East',
  'South Concourse',
  'Parking B',
  'Gate C',
  'Retail Plaza',
  'North Ramp',
  'East Stand Entry',
  'Upper Concourse',
  'Transit Bay',
  'Gate D',
  'Family Block',
  'Hospitality Deck',
  'Food Court West',
  'South Gate Corridor',
  'Central Spine',
  'Exit A',
  'Exit B',
  'Medical Bay',
  'Security Checkpoint',
  'Halftime Hotspot',
];

const BASE_PUBLIC_LABELS = [
  'North Entry',
  'Food Plaza',
  'West Walkway',
  'Parking Hub',
  'East Entry',
  'Retail Strip',
  'South Concourse',
  'Transit Access',
  'Center Plaza',
  'Photo Point',
  'Upper Ramp',
  'East Crossing',
  'Upper Walkway',
  'Transit Bay',
  'West Crossing',
  'Family Zone',
  'Hospitality Lane',
  'Food Court East',
  'South Corridor',
  'Central Spine',
  'Exit North',
  'Exit East',
  'Medical Aid',
  'Security Checkpoint',
  'Crowd Watchpoint',
];

const withOverrides = (baseLabels: string[], overrides: Record<number, string>) =>
  baseLabels.map((label, index) => overrides[index + 1] ?? label);

export const VENUES: VenueProfile[] = [
  {
    id: 'narendra-modi-stadium',
    name: 'Narendra Modi Stadium',
    category: 'stadium',
    layoutMessage: 'Loaded real-world layout for Narendra Modi Stadium.',
    center: { lat: 23.0917, lng: 72.5977 },
    zoneLabels: buildZoneLabels(BASE_STADIUM_LABELS),
  },
  {
    id: 'wembley-stadium',
    name: 'Wembley Stadium',
    category: 'stadium',
    layoutMessage: 'Loaded real-world layout for Wembley Stadium.',
    center: { lat: 51.556, lng: -0.2796 },
    zoneLabels: buildZoneLabels(
      withOverrides(BASE_STADIUM_LABELS, {
        1: 'North Gate',
        2: 'Champions Food Hall',
        4: 'Coach Parking',
        9: 'Boulevard Gate',
        25: 'Halftime Plaza',
      }),
    ),
  },
  {
    id: 'metlife-stadium',
    name: 'MetLife Stadium',
    category: 'stadium',
    layoutMessage: 'Loaded real-world layout for MetLife Stadium.',
    center: { lat: 40.8135, lng: -74.0745 },
    zoneLabels: buildZoneLabels(
      withOverrides(BASE_STADIUM_LABELS, {
        1: 'MetLife North Gate',
        2: 'Garden State Food Hall',
        4: 'Lot A Parking',
        10: 'Meadowlands Retail Row',
        25: 'Halftime Fan Square',
      }),
    ),
  },
  {
    id: 'melbourne-cricket-ground',
    name: 'Melbourne Cricket Ground',
    category: 'stadium',
    layoutMessage: 'Loaded real-world layout for Melbourne Cricket Ground.',
    center: { lat: -37.8199, lng: 144.9834 },
    zoneLabels: buildZoneLabels(
      withOverrides(BASE_STADIUM_LABELS, {
        1: 'Members Gate',
        2: 'Yarra Food Court',
        4: 'Eastern Parking',
        15: 'Ponsford Gate',
        25: 'Innings Break Hub',
      }),
    ),
  },
  {
    id: 'camp-nou',
    name: 'Camp Nou',
    category: 'stadium',
    layoutMessage: 'Loaded real-world layout for Camp Nou.',
    center: { lat: 41.3809, lng: 2.1228 },
    zoneLabels: buildZoneLabels(
      withOverrides(BASE_STADIUM_LABELS, {
        1: 'North Access Gate',
        2: 'Catalan Food Plaza',
        4: 'West Parking Deck',
        17: 'VIP Hospitality Terrace',
        25: 'Halftime Culer Hub',
      }),
    ),
  },
  {
    id: 'times-square',
    name: 'Times Square',
    category: 'public-space',
    layoutMessage: 'Loaded real-world layout for Times Square.',
    center: { lat: 40.758, lng: -73.9855 },
    zoneLabels: buildZoneLabels(
      withOverrides(BASE_PUBLIC_LABELS, {
        1: 'Broadway North',
        3: '7th Ave Walkway',
        8: 'Subway Entrance',
        10: 'Billboard Photo Plaza',
        21: 'Exit Broadway',
      }),
    ),
  },
  {
    id: 'burj-khalifa',
    name: 'Burj Khalifa',
    category: 'public-space',
    layoutMessage: 'Loaded real-world layout for Burj Khalifa.',
    center: { lat: 25.1972, lng: 55.2744 },
    zoneLabels: buildZoneLabels(
      withOverrides(BASE_PUBLIC_LABELS, {
        1: 'Dubai Mall Entry',
        2: 'Fountain Food Deck',
        9: 'Tower Entry Plaza',
        14: 'Metro Link Bay',
        25: 'Observation Queue Zone',
      }),
    ),
  },
  {
    id: 'eiffel-tower',
    name: 'Eiffel Tower',
    category: 'public-space',
    layoutMessage: 'Loaded real-world layout for Eiffel Tower.',
    center: { lat: 48.8584, lng: 2.2945 },
    zoneLabels: buildZoneLabels(
      withOverrides(BASE_PUBLIC_LABELS, {
        1: 'Champ de Mars North',
        2: 'Food Kiosk Row',
        9: 'Tower Access Gate',
        20: 'Central Promenade',
        25: 'Tourist Rush Watchpoint',
      }),
    ),
  },
  {
    id: 'tirupati-temple',
    name: 'Tirupati Temple',
    category: 'public-space',
    layoutMessage: 'Loaded real-world layout for Tirupati Temple.',
    center: { lat: 13.6833, lng: 79.3478 },
    zoneLabels: buildZoneLabels(
      withOverrides(BASE_PUBLIC_LABELS, {
        1: 'North Darshan Entry',
        2: 'Prasadam Court',
        4: 'Pilgrim Parking',
        15: 'Temple West Access',
        25: 'Festival Crowd Hub',
      }),
    ),
  },
  {
    id: 'kumbh-mela-grounds',
    name: 'Kumbh Mela Grounds',
    category: 'public-space',
    layoutMessage: 'Loaded real-world layout for Kumbh Mela Grounds.',
    center: { lat: 25.4299, lng: 81.8858 },
    zoneLabels: buildZoneLabels(
      withOverrides(BASE_PUBLIC_LABELS, {
        1: 'Pilgrim North Entry',
        2: 'Food Camp Sector',
        8: 'Transit Camp Access',
        16: 'Family Camp Zone',
        25: 'Procession Watchpoint',
      }),
    ),
  },
];

export const VENUE_OPTIONS = VENUES.map((venue) => ({
  value: venue.id,
  label: venue.name,
  category: venue.category,
  description: venue.layoutMessage,
}));

export const VENUE_GROUPS = [
  {
    label: 'Stadiums',
    options: VENUE_OPTIONS.filter((venue) => venue.category === 'stadium'),
  },
  {
    label: 'Public Spaces',
    options: VENUE_OPTIONS.filter((venue) => venue.category === 'public-space'),
  },
] as const;

export const getVenueById = (venueId: string) => VENUES.find((venue) => venue.id === venueId) ?? null;

export const getDefaultVenue = (): VenueProfile => VENUES[0]!;