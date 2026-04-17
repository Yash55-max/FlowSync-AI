export const STADIUM_CENTER = { lat: 23.0917, lng: 72.5977 };

export const REAL_ZONE_LABELS: Record<string, string> = {
  'zone-1': 'Gate A',
  'zone-2': 'Food Court North',
  'zone-3': 'West Stand',
  'zone-4': 'Parking A',
  'zone-5': 'Gate B',
  'zone-6': 'Food Court East',
  'zone-7': 'South Concourse',
  'zone-8': 'Parking B',
  'zone-9': 'Gate C',
  'zone-10': 'Retail Plaza',
  'zone-11': 'North Ramp',
  'zone-12': 'East Stand Entry',
  'zone-13': 'Upper Concourse',
  'zone-14': 'Transit Bay',
  'zone-15': 'Gate D',
  'zone-16': 'Family Block',
  'zone-17': 'Hospitality Deck',
  'zone-18': 'Food Court West',
  'zone-19': 'South Gate Corridor',
  'zone-20': 'Central Spine',
  'zone-21': 'Exit A',
  'zone-22': 'Exit B',
  'zone-23': 'Medical Bay',
  'zone-24': 'Security Checkpoint',
  'zone-25': 'Halftime Hotspot',
};

export type ZoneLike = {
  zone_id: string;
  row: number;
  col: number;
  density_score: number;
};

export const zoneDisplayName = (zoneId: string, zoneLabels: Record<string, string> = REAL_ZONE_LABELS) =>
  `${zoneLabels[zoneId] ?? zoneId.toUpperCase()} (${zoneId})`;

export const markerColorByDensity = (density: number) => {
  if (density >= 75) return '#ff3b30';
  if (density >= 45) return '#f59e0b';
  return '#22c55e';
};

export const zoneToLatLng = (zone: ZoneLike, center = STADIUM_CENTER) => ({
  lat: center.lat + (zone.row - 2) * 0.00045,
  lng: center.lng + (zone.col - 2) * 0.00058,
});
