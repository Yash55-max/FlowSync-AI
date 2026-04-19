import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

import { getPageFromHash, isMapPage, PAGE_ITEMS, type AppPage, type UiMode } from './appPages';
import { markerColorByDensity, zoneDisplayName, zoneToLatLng } from './venueHelpers';
import { getPopularLocationById, getSmartPopularLocation, POPULAR_LOCATIONS, popularLocationToLatLng } from './popularLocations';
import { getDefaultVenue, getVenueById, VENUE_GROUPS } from './venues';

type EventPhase = 'arrival' | 'in-venue' | 'halftime' | 'departure';

type Zone = {
  zone_id: string;
  row: number;
  col: number;
  density_level: 'low' | 'medium' | 'high';
  density_score: number;
  timestamp: string;
};

type QueueItem = {
  stall_id: string;
  wait_time_minutes: number;
  alternative: string;
};

type AlertItem = {
  type: string;
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
};

type Snapshot = {
  generated_at: string;
  zones: Zone[];
  queues: QueueItem[];
  high_density_zones: number;
};

type RouteResponse = {
  start: string;
  end: string;
  path: string[];
  steps: number;
  estimated_minutes: number;
  avoidance_score: number;
};

type VenueNode = {
  node_id: string;
  label: string;
  kind: string;
  zone_id: string;
  row: number;
  col: number;
  density_level: 'low' | 'medium' | 'high';
  density_score: number;
  recommendation: string;
};

type VenueMap = {
  phase: EventPhase;
  generated_at: string;
  gates: VenueNode[];
  parking: VenueNode[];
  exits: VenueNode[];
  concourse: VenueNode[];
  notes: string[];
};

type JourneyPlan = {
  phase: EventPhase;
  origin: string;
  destination: string;
  start_point: { row: number; col: number };
  end_point: { row: number; col: number };
  recommended_anchor: string | null;
  alternate_anchor: string | null;
  queue_zone: string;
  queue_wait_minutes: number;
  route: RouteResponse;
  advice: string[];
};

type StaffAction = {
  priority: string;
  area: string;
  instruction: string;
  rationale: string;
};

type StaffPlan = {
  phase: EventPhase;
  generated_at: string;
  actions: StaffAction[];
};

type ResilienceStatus = {
  generated_at: string;
  offline_ready: boolean;
  signal_quality: string;
  signal_score: number;
  cache_window_minutes: number;
  fallback_mode: string;
  last_sync: string;
};

type DataSourceStatus = {
  source: 'simulated' | 'live';
  stale: boolean;
  live_snapshot_age_seconds: number | null;
  live_snapshot_ttl_seconds: number;
  generated_at: string;
};

type DemoScenario = 'normal' | 'surge-zone-1' | 'food-rush' | 'emergency-mode' | 'optimize-crowd';

type DemoControlResponse = {
  mode: DemoScenario;
  generated_at: string;
  title: string;
  message: string;
  affected_zones: string[];
  before: {
    avg_density: number;
    longest_queue: number;
    high_density_zones: number;
    flow_score: number;
  };
  after: {
    avg_density: number;
    longest_queue: number;
    high_density_zones: number;
    flow_score: number;
  };
  alerts: AlertItem[];
  journey: JourneyPlan;
};

type ToastNotice = {
  id: number;
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
};

type OrganizerSummary = {
  generated_at: string;
  avg_density: number;
  highest_density_zones: string[];
  longest_queues: string[];
  interventions: Array<{
    type: string;
    target: string;
    message: string;
  }>;
  high_density_zone_count: number;
};

type MapPoint = { lat: number; lng: number };

type MapOverlayHandle = {
  setMap?: (map: unknown) => void;
  map?: unknown;
};

type MapInstanceHandle = {
  setCenter?: (center: MapPoint) => void;
  center?: MapPoint;
};

type GoogleMapsMarkerApi = {
  AdvancedMarkerElement?: new (options: {
    position: MapPoint;
    map: unknown;
    title: string;
    content: Element;
  }) => MapOverlayHandle;
  PinElement?: new (options: {
    background: string;
    borderColor: string;
    glyphColor: string;
    scale: number;
  }) => { element: Element };
};

type GoogleMapsApi = {
  Map?: new (container: HTMLDivElement, options: Record<string, unknown>) => MapInstanceHandle;
  Circle?: new (options: Record<string, unknown>) => MapOverlayHandle;
  Polyline?: new (options: Record<string, unknown>) => MapOverlayHandle;
  marker?: GoogleMapsMarkerApi;
};

type WindowWithGoogleMaps = Window & {
  google?: { maps?: GoogleMapsApi };
  gm_authFailure?: () => void;
  webkitAudioContext?: typeof AudioContext;
};

const getGoogleMapsApi = (): GoogleMapsApi | null => {
  const maps = (window as WindowWithGoogleMaps).google?.maps;
  return maps ?? null;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';
const GOOGLE_MAPS_MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID?.trim() ?? '';
const PHASE_OPTIONS: Array<{ label: string; value: EventPhase }> = [
  { label: 'Arrival', value: 'arrival' },
  { label: 'In Venue', value: 'in-venue' },
  { label: 'Halftime', value: 'halftime' },
  { label: 'Departure', value: 'departure' },
];

const LOCATION_OPTIONS = [
  { label: 'Parking A', value: 'parking-a' },
  { label: 'North Gate', value: 'gate-1' },
  { label: 'East Gate', value: 'gate-2' },
  { label: 'Main Concourse', value: 'concourse-a' },
  { label: 'Food Hall', value: 'concourse-b' },
  { label: 'Restroom', value: 'restroom-1' },
  { label: 'Seat Block', value: 'seat-block' },
  { label: 'Exit Plaza', value: 'exit-a' },
];

const DEMO_CONTROLS: Array<{ label: string; action: DemoScenario }> = [
  { label: '🔥 Surge Zone 1', action: 'surge-zone-1' },
  { label: '🍔 Food Rush', action: 'food-rush' },
  { label: '🚨 Emergency Mode', action: 'emergency-mode' },
  { label: '✨ Optimize Crowd', action: 'optimize-crowd' },
];

const LOCATION_LABELS: Record<string, string> = {
  'parking-a': 'Parking A',
  'gate-1': 'Gate A',
  'gate-2': 'Gate B',
  'concourse-a': 'North Concourse',
  'concourse-b': 'Food Court Corridor',
  'restroom-1': 'Restroom Cluster 1',
  'seat-block': 'West Stand Seating',
  'exit-a': 'Exit A',
};

const HERO_COPY: Record<AppPage, { title: string; subtitle: string }> = {
  overview: {
    title: 'Real-time crowd intelligence for live stadium operations',
    subtitle:
      'Managing 100,000 people in real time with predictive flow control, density-aware routing, and high-speed operator decisions.',
  },
  'live-map': {
    title: 'Live venue command map',
    subtitle: 'Track density, hotspots, and safe movement corridors as conditions evolve across the stadium.',
  },
  journey: {
    title: 'Journey optimization engine',
    subtitle: 'Route attendees around congestion and queues before pressure peaks hit critical zones.',
  },
  operations: {
    title: 'Operations control center',
    subtitle: 'Coordinate interventions, monitor resilience, and respond to alerts with AI-supported precision.',
  },
  settings: {
    title: 'System preferences and controls',
    subtitle: 'Tune theme, data source expectations, and deployment behavior for demo or live operations.',
  },
};

// Canvas-based heatmap visualization component
interface HeatmapCanvasProps {
  zones: Zone[];
  routePathSet: Set<string>;
  routePath: string[];
  topZones: Zone[];
  optimizeMode: boolean;
  flashZoneId: string | null;
  flashPulse: boolean;
}

const HeatmapCanvas: React.FC<HeatmapCanvasProps> = ({
  zones,
  routePathSet,
  routePath,
  topZones,
  optimizeMode,
  flashZoneId,
  flashPulse,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Interpolate color based on density value (0-100)
  const getColorForDensity = (density: number): string => {
    // Blue (low) -> Yellow (medium) -> Red (high)
    if (density < 33) {
      const t = density / 33;
      const r = Math.floor(30 + (200 * t));
      const g = Math.floor(144 + (120 * t));
      const b = Math.floor(255 - (100 * t));
      return `rgb(${r},${g},${b})`;
    } else if (density < 66) {
      const t = (density - 33) / 33;
      const r = Math.floor(230 + (25 * t));
      const g = Math.floor(175 - (100 * t));
      const b = Math.floor(155 - (155 * t));
      return `rgb(${r},${g},${b})`;
    } else {
      const r = 255;
      const g = Math.floor(76 - (41 * (density - 66) / 34));
      const b = 0;
      return `rgb(${r},${g},${b})`;
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Find grid dimensions
    const rows = Math.max(...zones.map(z => z.row || 0)) + 1 || 8;
    const cols = Math.max(...zones.map(z => z.col || 0)) + 1 || 8;
    const cellWidth = canvas.width / cols;
    const cellHeight = canvas.height / rows;

    // Clear canvas
    ctx.fillStyle = 'rgba(8, 17, 31, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const zoneByCoord = new Map(zones.map((zone) => [`${zone.row}-${zone.col}`, zone]));
    const hotspotIds = new Set(topZones.map((zone) => zone.zone_id));

    const routeIndex = new Map(routePath.map((zoneId, index) => [zoneId, index + 1]));

    // Draw heat cells with smooth gradients
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * cellWidth;
        const y = row * cellHeight;
        const key = `${row}-${col}`;
        const zone = zoneByCoord.get(key);
        const rawDensity = zone?.density_score ?? 0;
        const density = optimizeMode ? Math.max(8, rawDensity - 18) : rawDensity;

        // Draw cell background
        ctx.fillStyle = getColorForDensity(density);
        ctx.globalAlpha = 0.7 + (density / 100) * 0.3; // Opacity based on density
        ctx.fillRect(x, y, cellWidth, cellHeight);
        ctx.globalAlpha = 1;

        // Draw cell border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, cellWidth, cellHeight);

        // Highlight route path with visible blue glow + sequence number.
        if (zone && routePathSet.has(zone.zone_id)) {
          ctx.shadowColor = 'rgba(87, 199, 255, 0.9)';
          ctx.shadowBlur = 12;
          ctx.strokeStyle = '#57c7ff';
          ctx.lineWidth = 3;
          ctx.strokeRect(x + 2, y + 2, cellWidth - 4, cellHeight - 4);
          ctx.shadowBlur = 0;

          const idx = routeIndex.get(zone.zone_id);
          if (idx) {
            ctx.fillStyle = 'rgba(8, 17, 31, 0.92)';
            ctx.beginPath();
            ctx.arc(x + cellWidth - 12, y + 12, 9, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#7dd3fc';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(idx), x + cellWidth - 12, y + 12);
          }
        }

        // Highlight top zones (hotspots) with pulsing effect
        if (zone && hotspotIds.has(zone.zone_id)) {
          ctx.strokeStyle = '#ff6b6b';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(x + 1, y + 1, cellWidth - 2, cellHeight - 2);
          ctx.setLineDash([]);
        }

        if (zone && flashZoneId === zone.zone_id && flashPulse) {
          ctx.strokeStyle = '#ff2d55';
          ctx.lineWidth = 4;
          ctx.shadowColor = 'rgba(255, 45, 85, 0.95)';
          ctx.shadowBlur = 14;
          ctx.strokeRect(x + 1, y + 1, cellWidth - 2, cellHeight - 2);
          ctx.shadowBlur = 0;
        }

        // Draw zone ID text
        if (zone && density > 0) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(zone.zone_id, x + cellWidth / 2, y + cellHeight / 2 - 8);

          // Draw density score
          ctx.font = '13px sans-serif';
          ctx.fillStyle = density > 70 ? '#ffffff' : 'rgba(255, 255, 255, 0.7)';
          ctx.fillText(Math.round(density).toString(), x + cellWidth / 2, y + cellHeight / 2 + 10);
        }
      }
    }

    // Draw grid lines for reference
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 0.5;
    for (let row = 0; row <= rows; row++) {
      ctx.beginPath();
      ctx.moveTo(0, row * cellHeight);
      ctx.lineTo(canvas.width, row * cellHeight);
      ctx.stroke();
    }
    for (let col = 0; col <= cols; col++) {
      ctx.beginPath();
      ctx.moveTo(col * cellWidth, 0);
      ctx.lineTo(col * cellWidth, canvas.height);
      ctx.stroke();
    }
  }, [zones, routePathSet, routePath, topZones, optimizeMode, flashZoneId, flashPulse]);

  return (
    <canvas
      ref={canvasRef}
      width={640}
      height={320}
      className="heatmap-canvas"
      role="img"
      aria-label="Live crowd density heatmap with route and hotspot highlights"
    />
  );
};

function App() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<MapInstanceHandle | null>(null);
  const mapMarkersRef = useRef<MapOverlayHandle[]>([]);
  const routeLineRef = useRef<MapOverlayHandle | null>(null);
  const hotspotCirclesRef = useRef<MapOverlayHandle[]>([]);
  const popularLocationHighlightRef = useRef<MapOverlayHandle | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [journey, setJourney] = useState<JourneyPlan | null>(null);
  const [comparison, setComparison] = useState<DemoControlResponse | null>(null);
  const [toasts, setToasts] = useState<ToastNotice[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [flashPulse, setFlashPulse] = useState(false);
  const [lastCriticalZone, setLastCriticalZone] = useState<string | null>(null);
  const [venueMap, setVenueMap] = useState<VenueMap | null>(null);
  const [staffPlan, setStaffPlan] = useState<StaffPlan | null>(null);
  const [organizerSummary, setOrganizerSummary] = useState<OrganizerSummary | null>(null);
  const [resilience, setResilience] = useState<ResilienceStatus | null>(null);
  const [dataSource, setDataSource] = useState<DataSourceStatus | null>(null);
  const [mapApiReady, setMapApiReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pulsePhase, setPulsePhase] = useState(0);
  const [showRebalance, setShowRebalance] = useState(false);
  const [phase, setPhase] = useState<EventPhase>('in-venue');
  const [origin, setOrigin] = useState('concourse-a');
  const [destination, setDestination] = useState('seat-block');
  const [status, setStatus] = useState('Connecting to live crowd feed...');
  const [error, setError] = useState<string | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const surfacedHighAlertRef = useRef<Set<string>>(new Set());
  const [collapsedPanels, setCollapsedPanels] = useState({
    organizer: true,
    staff: true,
    alerts: true,
  });
  const [uiMode, setUiMode] = useState<UiMode>(() => {
    const stored = window.localStorage.getItem('flowsync-ui-mode');
    return stored === 'light' ? 'light' : 'dark';
  });
  const [activePage, setActivePage] = useState<AppPage>(() => {
    return getPageFromHash(window.location.hash);
  });
  const [selectedVenueId, setSelectedVenueId] = useState(() => getDefaultVenue().id);
  const selectedVenue = getVenueById(selectedVenueId) ?? getDefaultVenue();
  const venueZoneLabels = selectedVenue.zoneLabels;
  const [selectedPopularLocationId, setSelectedPopularLocationId] = useState(() =>
    getSmartPopularLocation('in-venue')?.id ?? POPULAR_LOCATIONS[0]?.id ?? '',
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', uiMode);
    window.localStorage.setItem('flowsync-ui-mode', uiMode);
  }, [uiMode]);

  useEffect(() => {
    const handleHashChange = () => {
      setActivePage(getPageFromHash(window.location.hash));
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (window.location.hash.replace('#', '') !== activePage) {
      window.history.replaceState(null, '', `#${activePage}`);
    }
  }, [activePage]);

  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)');

    const refreshInstalledState = () => {
      const standaloneNavigator = (window.navigator as Navigator & { standalone?: boolean }).standalone;
      setIsInstalled(media.matches || standaloneNavigator === true);
    };

    refreshInstalledState();
    media.addEventListener('change', refreshInstalledState);

    return () => {
      media.removeEventListener('change', refreshInstalledState);
    };
  }, []);

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      setMapApiReady(false);
      setMapError('Google Maps API key missing');
      return;
    }

    let pollTimer: number | null = null;
    let mounted = true;

    const hasUsableMaps = () => {
      const maps = (window as unknown as { google?: { maps?: { Map?: unknown } } }).google?.maps;
      return typeof maps?.Map === 'function';
    };

    const startPollingForMaps = () => {
      pollTimer = window.setInterval(() => {
        if (hasUsableMaps()) {
          if (!mounted) {
            return;
          }
          setMapApiReady(true);
          setMapError(null);
          if (pollTimer !== null) {
            window.clearInterval(pollTimer);
            pollTimer = null;
          }
        }
      }, 120);
    };

    (window as WindowWithGoogleMaps).gm_authFailure = () => {
      if (!mounted) {
        return;
      }
      setMapApiReady(false);
      setMapError('Google Maps authentication failed. Check API key restrictions and billing.');
    };

    if (hasUsableMaps()) {
      setMapApiReady(true);
      setMapError(null);
      return;
    }

    setMapApiReady(false);
    setMapError('Connecting to Google Maps...');

    const existing = document.getElementById('flowsync-google-maps') as HTMLScriptElement | null;
    if (existing) {
      startPollingForMaps();
      return () => {
        if (pollTimer !== null) {
          window.clearInterval(pollTimer);
        }
      };
    }

    const script = document.createElement('script');
    script.id = 'flowsync-google-maps';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&v=weekly&loading=async&libraries=marker`;
    script.async = true;
    script.defer = true;
    script.onload = () => startPollingForMaps();
    script.onerror = () => {
      if (!mounted) {
        return;
      }
      setMapApiReady(false);
      setMapError('Unable to load Google Maps script.');
    };
    document.head.appendChild(script);

    return () => {
      mounted = false;
      if (pollTimer !== null) {
        window.clearInterval(pollTimer);
      }
    };
  }, []);

  useEffect(() => {
    const pulseTimer = window.setInterval(() => {
      setPulsePhase((current) => (current + 1) % 1000);
    }, 420);

    return () => window.clearInterval(pulseTimer);
  }, []);

  useEffect(() => {
    if (phase === 'arrival') {
      setOrigin('parking-a');
      setDestination('gate-1');
      return;
    }

    if (phase === 'in-venue') {
      setOrigin('concourse-a');
      setDestination('seat-block');
      return;
    }

    if (phase === 'halftime') {
      setOrigin('seat-block');
      setDestination('concourse-b');
      return;
    }

    setOrigin('seat-block');
    setDestination('exit-a');
  }, [phase]);

  useEffect(() => {
    const mapVisible = isMapPage(activePage);

    if (!mapVisible) {
      mapMarkersRef.current.forEach((marker) => {
        if (marker && 'map' in marker) {
          marker.map = null;
          return;
        }
        if (marker && typeof marker.setMap === 'function') {
          marker.setMap(null);
        }
      });
      mapMarkersRef.current = [];

      hotspotCirclesRef.current.forEach((circle) => {
        if (typeof circle.setMap === 'function') {
          circle.setMap(null);
        }
      });
      hotspotCirclesRef.current = [];

      if (popularLocationHighlightRef.current) {
        if (typeof popularLocationHighlightRef.current.setMap === 'function') {
          popularLocationHighlightRef.current.setMap(null);
        }
        popularLocationHighlightRef.current = null;
      }

      if (routeLineRef.current) {
        if (typeof routeLineRef.current.setMap === 'function') {
          routeLineRef.current.setMap(null);
        }
        routeLineRef.current = null;
      }

      mapInstanceRef.current = null;
      return;
    }

    if (mapContainerRef.current && mapApiReady) {
      setMapError(null);
    }
  }, [activePage, mapApiReady]);

  useEffect(() => {
    const mapVisible = isMapPage(activePage);

    if (!mapVisible) {
      return;
    }

    if (!mapApiReady || !mapContainerRef.current) {
      return;
    }

    const googleMaps = getGoogleMapsApi();
    if (!googleMaps || typeof googleMaps.Map !== 'function') {
      return;
    }

    if (!mapInstanceRef.current) {
      try {
        mapInstanceRef.current = new googleMaps.Map(mapContainerRef.current, {
          center: selectedVenue.center,
          zoom: 16,
          mapTypeId: 'hybrid',
          streetViewControl: false,
          fullscreenControl: false,
          ...(GOOGLE_MAPS_MAP_ID ? { mapId: GOOGLE_MAPS_MAP_ID } : {}),
        });
      } catch {
        setMapApiReady(false);
        setMapError('Google Maps initialization failed.');
      }
    }
  }, [activePage, mapApiReady, selectedVenue.center]);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const fetchWithTimeout = async (url: string, timeoutMs = 6000) => {
      const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(url, { signal: controller.signal });
      } finally {
        window.clearTimeout(timeoutId);
      }
    };

    const load = async () => {
      try {
        setIsRefreshing(true);
        const [snapshotResponse, alertsResponse, journeyResponse, venueMapResponse, staffResponse, organizerResponse, resilienceResponse, dataSourceResponse] =
          await Promise.all([
          fetchWithTimeout(`${API_BASE}/snapshot`),
          fetchWithTimeout(`${API_BASE}/alerts`),
          fetchWithTimeout(
            `${API_BASE}/journey?phase=${encodeURIComponent(phase)}&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`,
          ),
          fetchWithTimeout(`${API_BASE}/venue-map?phase=${encodeURIComponent(phase)}`),
          fetchWithTimeout(`${API_BASE}/staff-actions?phase=${encodeURIComponent(phase)}`),
          fetchWithTimeout(`${API_BASE}/organizer-summary`),
          fetchWithTimeout(`${API_BASE}/resilience`),
          fetchWithTimeout(`${API_BASE}/data-source`),
        ]);

        if (
          !snapshotResponse.ok ||
          !alertsResponse.ok ||
          !journeyResponse.ok ||
          !venueMapResponse.ok ||
          !staffResponse.ok ||
          !organizerResponse.ok ||
          !resilienceResponse.ok ||
          !dataSourceResponse.ok
        ) {
          throw new Error('API returned an unexpected response');
        }

        const snapshotData = (await snapshotResponse.json()) as Snapshot;
        const alertsData = (await alertsResponse.json()) as { alerts: AlertItem[] };
        const journeyData = (await journeyResponse.json()) as JourneyPlan;
        const venueMapData = (await venueMapResponse.json()) as VenueMap;
        const staffData = (await staffResponse.json()) as StaffPlan;
        const organizerData = (await organizerResponse.json()) as OrganizerSummary;
        const resilienceData = (await resilienceResponse.json()) as ResilienceStatus;
        const dataSourceData = (await dataSourceResponse.json()) as DataSourceStatus;

        // Small processing delay makes updates feel intentional instead of abrupt.
        await new Promise((resolve) => window.setTimeout(resolve, 300));

        if (!mounted) {
          return;
        }

        setSnapshot(snapshotData);
        setAlerts(alertsData.alerts);
        setJourney(journeyData);
        setVenueMap(venueMapData);
        setStaffPlan(staffData);
        setOrganizerSummary(organizerData);
        setResilience(resilienceData);
        setDataSource(dataSourceData);
        setStatus(dataSourceData.source === 'live' ? 'Live feed active' : 'Simulation feed active');
        setError(null);
        setIsRefreshing(false);
      } catch (loadError) {
        if (!mounted) {
          return;
        }
        if (loadError instanceof DOMException && loadError.name === 'AbortError') {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : 'Unable to reach the backend');
        setStatus('Waiting for API connection');
        setIsRefreshing(false);
      }
    };

    load();
    const interval = window.setInterval(load, 1000);

    return () => {
      mounted = false;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [destination, origin, phase, refreshKey]);

  const heatmap = useMemo(() => snapshot?.zones ?? [], [snapshot]);
  const liveQueues = snapshot?.queues ?? [];
  const crowdedZones = heatmap.filter((zone) => zone.density_level === 'high').length;
  const averageDensity = heatmap.length
    ? Math.round(heatmap.reduce((sum, zone) => sum + zone.density_score, 0) / heatmap.length)
    : 0;
  const heatIndex = venueMap?.gates.length
    ? Math.round(venueMap.gates.reduce((sum, gate) => sum + gate.density_score, 0) / venueMap.gates.length)
    : averageDensity;
  const topZones = useMemo(
    () => [...heatmap].sort((left, right) => right.density_score - left.density_score).slice(0, 3),
    [heatmap],
  );
  const shortestQueue = useMemo(
    () => [...liveQueues].sort((left, right) => left.wait_time_minutes - right.wait_time_minutes)[0] ?? null,
    [liveQueues],
  );
  const routePath = journey?.route.path ?? [];
  const routePathSet = useMemo(() => new Set(routePath), [routePath]);
  const focusZone = topZones[0] ?? null;
  const predictedZone = topZones[1]?.zone_id ?? 'zone-7';
  const optimizeMode = comparison?.mode === 'optimize-crowd';
  const impactMinutes = comparison
    ? Math.max(0, comparison.before.longest_queue - comparison.after.longest_queue)
    : 3;
  const activePageMeta = PAGE_ITEMS.find((item) => item.id === activePage) ?? PAGE_ITEMS[0];
  const heroCopy = HERO_COPY[activePageMeta.id];
  const smartPopularLocation = getSmartPopularLocation(phase) ?? POPULAR_LOCATIONS[0] ?? null;
  const selectedPopularLocation = getPopularLocationById(selectedPopularLocationId) ?? smartPopularLocation;
  const popularLocationsToShow = useMemo(() => POPULAR_LOCATIONS.slice(0, 7), []);

  useEffect(() => {
    if (!mapApiReady || !mapInstanceRef.current || !heatmap.length) {
      return;
    }

    const googleMaps = getGoogleMapsApi();
    if (!googleMaps || typeof googleMaps.Circle !== 'function' || typeof googleMaps.Polyline !== 'function') {
      return;
    }
    const CircleCtor = googleMaps.Circle;
    const PolylineCtor = googleMaps.Polyline;

    mapMarkersRef.current.forEach((marker) => {
      if (marker && 'map' in marker) {
        marker.map = null;
        return;
      }
      if (marker && typeof marker.setMap === 'function') {
        marker.setMap(null);
      }
    });
    mapMarkersRef.current = [];

    heatmap.forEach((zone) => {
      const isOnRoute = routePathSet.has(zone.zone_id);
      const pulseFactor = 1 + 0.14 * Math.sin(pulsePhase / 2 + zone.row + zone.col);
      const density = optimizeMode ? Math.max(5, zone.density_score - 18) : zone.density_score;
      const position = zoneToLatLng(zone, selectedVenue.center);
      const title = `${zoneDisplayName(zone.zone_id, venueZoneLabels)} • Density ${zone.density_score}%`;
      const advancedMarkerCtor = googleMaps.marker?.AdvancedMarkerElement;
      const pinCtor = googleMaps.marker?.PinElement;
      const canUseAdvancedMarkers = Boolean(advancedMarkerCtor && pinCtor);

      if (canUseAdvancedMarkers) {
        if (!advancedMarkerCtor || !pinCtor) {
          return;
        }
        const pin = new pinCtor({
          background: markerColorByDensity(density),
          borderColor: isOnRoute ? '#57c7ff' : '#0b1220',
          glyphColor: '#0b1220',
          scale: (isOnRoute ? 1.22 : 1) * pulseFactor,
        });

        const marker = new advancedMarkerCtor({
          position,
          map: mapInstanceRef.current,
          title,
          content: pin.element,
        });

        mapMarkersRef.current.push(marker);
      } else {
        const marker = new CircleCtor({
          strokeColor: isOnRoute ? '#57c7ff' : '#0b1220',
          strokeOpacity: 0.65,
          strokeWeight: isOnRoute ? 2 : 1,
          fillColor: markerColorByDensity(density),
          fillOpacity: optimizeMode ? 0.78 : 0.88,
          map: mapInstanceRef.current,
          center: position,
          radius: 10 + pulseFactor * (isOnRoute ? 9 : 6),
        });

        mapMarkersRef.current.push(marker);
      }
    });

    hotspotCirclesRef.current.forEach((circle) => {
      if (typeof circle.setMap === 'function') {
        circle.setMap(null);
      }
    });
    hotspotCirclesRef.current = [];

    topZones.slice(0, 2).forEach((zone, idx) => {
      const circle = new CircleCtor({
        strokeColor: idx === 0 ? '#ff2d55' : '#f59e0b',
        strokeOpacity: 0.8,
        strokeWeight: idx === 0 ? 3 : 2,
        fillColor: idx === 0 ? '#ff2d55' : '#f59e0b',
        fillOpacity: 0.14 + Math.abs(Math.sin(pulsePhase / 8)) * 0.12,
        map: mapInstanceRef.current,
        center: zoneToLatLng(zone, selectedVenue.center),
        radius: 28 + zone.density_score * 0.9 + Math.abs(Math.sin(pulsePhase / 9)) * 16,
      });
      hotspotCirclesRef.current.push(circle);
    });

    if (routeLineRef.current) {
      if (typeof routeLineRef.current.setMap === 'function') {
        routeLineRef.current.setMap(null);
      }
      routeLineRef.current = null;
    }

    const routeZones = routePath
      .map((zoneId) => heatmap.find((zone) => zone.zone_id === zoneId))
      .filter((zone): zone is Zone => Boolean(zone))
      .map((zone) => zoneToLatLng(zone, selectedVenue.center));

    if (routeZones.length >= 2) {
      routeLineRef.current = new PolylineCtor({
        path: routeZones,
        geodesic: false,
        strokeColor: '#57c7ff',
        strokeOpacity: 0.9,
        strokeWeight: 4,
      });
      if (typeof routeLineRef.current.setMap === 'function') {
        routeLineRef.current.setMap(mapInstanceRef.current);
      }
    }
  }, [heatmap, mapApiReady, optimizeMode, pulsePhase, routePath, routePathSet, selectedVenue.center, topZones, venueZoneLabels]);

  useEffect(() => {
    if (!isMapPage(activePage) || !mapApiReady || !mapInstanceRef.current || !selectedPopularLocation) {
      return;
    }

    const googleMaps = getGoogleMapsApi();
    if (!googleMaps || typeof googleMaps.Circle !== 'function') {
      return;
    }
    const CircleCtor = googleMaps.Circle;

    if (popularLocationHighlightRef.current) {
      if (typeof popularLocationHighlightRef.current.setMap === 'function') {
        popularLocationHighlightRef.current.setMap(null);
      }
      popularLocationHighlightRef.current = null;
    }

    const position = popularLocationToLatLng(selectedPopularLocation.id, selectedVenue.center);
    popularLocationHighlightRef.current = new CircleCtor({
      strokeColor: '#7dd3fc',
      strokeOpacity: 0.95,
      strokeWeight: 3,
      fillColor: '#7dd3fc',
      fillOpacity: 0.2,
      map: mapInstanceRef.current,
      center: position,
      radius: 48 + selectedPopularLocation.waitMinutes * 2,
    });

    return () => {
      if (popularLocationHighlightRef.current) {
        if (typeof popularLocationHighlightRef.current.setMap === 'function') {
          popularLocationHighlightRef.current.setMap(null);
        }
        popularLocationHighlightRef.current = null;
      }
    };
  }, [activePage, mapApiReady, selectedPopularLocation, selectedVenue.center]);

  useEffect(() => {
    if (!mapApiReady || !mapInstanceRef.current) {
      return;
    }

    const map = mapInstanceRef.current;
    if (typeof map.setCenter === 'function') {
      map.setCenter(selectedVenue.center);
    } else {
      map.center = selectedVenue.center;
    }
  }, [mapApiReady, selectedVenue.center]);

  useEffect(() => {
    const pulseTimer = window.setInterval(() => {
      setFlashPulse((current) => !current);
    }, 340);

    return () => window.clearInterval(pulseTimer);
  }, []);

  useEffect(() => {
    if (!focusZone || focusZone.density_score < 75 || lastCriticalZone === focusZone.zone_id) {
      return;
    }

    pushToast({
      title: `🚨 ${focusZone.zone_id.toUpperCase()} critical congestion`,
      message: `Density at ${focusZone.density_score}%. AI rerouting now active.`,
      severity: 'high',
    });
    setLastCriticalZone(focusZone.zone_id);
  }, [focusZone, lastCriticalZone]);

  useEffect(() => {
    const highAlerts = alerts.filter((item) => item.severity === 'high');

    highAlerts.forEach((item) => {
      const key = `${item.type}:${item.title}`;
      if (surfacedHighAlertRef.current.has(key)) {
        return;
      }

      surfacedHighAlertRef.current.add(key);
      pushToast({
        title: `🚨 ${item.title}`,
        message: item.message,
        severity: 'high',
      });
    });
  }, [alerts]);


  const pushToast = (notice: Omit<ToastNotice, 'id'>) => {
    const toastId = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [
      { id: toastId, ...notice },
      ...current.slice(0, 2),
    ]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== toastId));
    }, 3000);
  };

  const triggerDemoControl = async (action: DemoScenario) => {
    try {
      const response = await fetch(`${API_BASE}/demo-control?action=${encodeURIComponent(action)}`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Demo control request failed');
      }
      const payload = (await response.json()) as DemoControlResponse;
      setComparison(payload);
      setJourney(payload.journey);
      setAlerts(payload.alerts);
      setRefreshKey((current) => current + 1);

      if (action === 'optimize-crowd') {
        setShowRebalance(true);
        window.setTimeout(() => setShowRebalance(false), 1400);
      }
      
      // Enhanced toast with more dramatic messaging
      const toastMessages: Record<DemoScenario, { title: string; emoji: string }> = {
        'normal': { title: 'Normal mode resumed', emoji: '✓' },
        'surge-zone-1': { title: '🔥 Surge detected! Zone 1 flooding', emoji: '⚠️' },
        'food-rush': { title: '🍔 Food hall rush incoming!', emoji: '⚠️' },
        'emergency-mode': { title: '🚨 EMERGENCY MODE ACTIVATED', emoji: '🔴' },
        'optimize-crowd': { title: '✨ AI Optimization active', emoji: '🎯' },
      };
      
      const msg = toastMessages[action];
      pushToast({
        title: msg.title,
        message: `${payload.message}`,
        severity: action === 'emergency-mode' ? 'high' : action === 'optimize-crowd' ? 'low' : 'medium',
      });
      
      // Play sound for emergency mode
      if (action === 'emergency-mode') {
        try {
          const AudioContextCtor = window.AudioContext || (window as WindowWithGoogleMaps).webkitAudioContext;
          if (!AudioContextCtor) {
            return;
          }
          const audioContext = new AudioContextCtor();
          const oscillator = audioContext.createOscillator();
          const gain = audioContext.createGain();
          oscillator.type = 'triangle';
          oscillator.frequency.value = 880;
          oscillator.connect(gain);
          gain.connect(audioContext.destination);
          gain.gain.value = 0.05;
          gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.2);
        } catch {
          // Audio context not supported
        }
      }
    } catch (demoError) {
      pushToast({
        title: 'Demo control failed',
        message: demoError instanceof Error ? demoError.message : 'Unable to trigger scenario',
        severity: 'high',
      });
    }
  };

  const handleInstallApp = () => {
    if (isInstalled) {
      pushToast({
        title: 'App already installed',
        message: 'FlowSync AI is already installed on this device.',
        severity: 'low',
      });
      return;
    }

    const isChromiumLike = /Chrome|Chromium|Edg/.test(window.navigator.userAgent);
    pushToast({
      title: 'Install from browser menu',
      message: isChromiumLike
        ? 'Open your browser menu and choose Install App. In development, the native install banner may be unavailable.'
        : 'Open your browser share/menu and choose Add to Home Screen (browser-dependent).',
      severity: 'medium',
    });
  };

  return (
    <main className="app-shell">
      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <article key={toast.id} className={`toast ${toast.severity}`} role={toast.severity === 'high' ? 'alert' : 'status'}>
            <strong>{toast.title}</strong>
            <span>{toast.message}</span>
          </article>
        ))}
      </div>

      <nav className="page-nav" aria-label="Application pages">
        {PAGE_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`page-nav-button ${activePage === item.id ? 'active' : ''}`}
            onClick={() => setActivePage(item.id)}
            aria-current={activePage === item.id ? 'page' : undefined}
          >
            <span>{item.label}</span>
            <small>{item.description}</small>
          </button>
        ))}
      </nav>

      <section className="hero">
        <div>
          <p className="eyebrow">FlowSync AI</p>
          <h1>{heroCopy.title}</h1>
          <p className="lede">
            {heroCopy.subtitle}
          </p>
        </div>
        <div className="hero-card">
          <div className="status-row">
            <span className="status-pill">{status}</span>
            <span className={`map-pill ${mapApiReady ? 'ready' : 'pending'}`}>
              {GOOGLE_MAPS_API_KEY ? (mapApiReady ? 'Maps API connected' : 'Maps API loading...') : 'Maps API key missing'}
            </span>
            <span className={`map-pill ${dataSource?.source === 'live' ? 'ready' : 'pending'}`}>
              {dataSource?.source === 'live'
                ? `Data source: Live${dataSource.live_snapshot_age_seconds !== null ? ` (${dataSource.live_snapshot_age_seconds}s)` : ''}`
                : 'Data source: Simulated'}
            </span>
          </div>
          <label className="venue-switch">
            <span>Select Venue</span>
            <select value={selectedVenueId} onChange={(event) => setSelectedVenueId(event.target.value as typeof selectedVenueId)}>
              {VENUE_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((venue) => (
                    <option key={venue.value} value={venue.value} title={venue.description}>
                      {venue.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <small className="venue-note">{selectedVenue.layoutMessage}</small>
          {!isInstalled ? (
            <>
              <button type="button" className="install-app-button" onClick={handleInstallApp}>
                Install App Guide
              </button>
              <small className="install-app-hint">
                Use your browser menu to install FlowSync AI as an app.
              </small>
            </>
          ) : null}
          <div className="mode-switch" role="group" aria-label="UI mode switch">
            <button
              type="button"
              className={`mode-button ${uiMode === 'dark' ? 'active' : ''}`}
              onClick={() => setUiMode('dark')}
              aria-pressed={uiMode === 'dark'}
            >
              Command mode
            </button>
            <button
              type="button"
              className={`mode-button ${uiMode === 'light' ? 'active' : ''}`}
              onClick={() => setUiMode('light')}
              aria-pressed={uiMode === 'light'}
            >
              Day mode
            </button>
          </div>
          <div className="hero-metrics">
            <div>
              <strong>{averageDensity}</strong>
              <span>Average density</span>
            </div>
            <div>
              <strong>{heatIndex}</strong>
              <span>Heat index</span>
            </div>
            <div>
              <strong>{crowdedZones}</strong>
              <span>Crowded zones</span>
            </div>
            <div>
              <strong>{liveQueues.length}</strong>
              <span>Live queues</span>
            </div>
          </div>
          <div className="demo-controls">
            {DEMO_CONTROLS.map((control) => (
              <button
                key={control.action}
                type="button"
                onClick={() => triggerDemoControl(control.action)}
                title={`Trigger ${control.label}`}
                aria-label={`Trigger scenario ${control.action}`}
              >
                {control.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {(activePage === 'overview' || activePage === 'live-map') ? (
      <section className="panel popular-locations-panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Popular Locations</p>
            <h2>Food courts, gates, restrooms, seating, and parking</h2>
          </div>
          <span className="timestamp">
            Best option: {smartPopularLocation ? `${smartPopularLocation.emoji} ${smartPopularLocation.name}` : 'Loading'}
          </span>
        </div>
        <div className="popular-locations-summary">
          <article className="popular-suggestion-card">
            <span>Smart suggestion</span>
            <strong>
              {smartPopularLocation ? `${smartPopularLocation.emoji} ${smartPopularLocation.name}` : 'Best option pending'}
            </strong>
            <p>
              {smartPopularLocation
                ? `${smartPopularLocation.waitMinutes} min wait · ${smartPopularLocation.crowdHint}`
                : 'Waiting for live data'}
            </p>
          </article>
          <article className="popular-suggestion-card accent">
            <span>Selected location</span>
            <strong>
              {selectedPopularLocation ? `${selectedPopularLocation.emoji} ${selectedPopularLocation.name}` : 'Select a location'}
            </strong>
            <p>
              {selectedPopularLocation
                ? `${selectedPopularLocation.crowdLabel.toUpperCase()} crowd · ${selectedPopularLocation.waitMinutes} min wait`
                : 'Click a location to highlight it on the map.'}
            </p>
          </article>
        </div>
        <div className="popular-locations-grid">
          {popularLocationsToShow.map((location) => (
            <button
              key={location.id}
              type="button"
              className={`popular-location-card ${selectedPopularLocation?.id === location.id ? 'active' : ''}`}
              onClick={() => setSelectedPopularLocationId(location.id)}
              title={`Highlight ${location.name} on the map`}
              aria-pressed={selectedPopularLocation?.id === location.id}
            >
              <span className="popular-location-emoji">{location.emoji}</span>
              <strong>{location.name}</strong>
              <small>
                {location.waitMinutes} min wait · {location.crowdLabel} crowd
              </small>
            </button>
          ))}
        </div>
      </section>
      ) : null}

      {activePage === 'settings' ? (
        <section className="panel settings-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Preferences</p>
              <h2>Page and theme controls</h2>
            </div>
            <span className="timestamp">Current page: {activePageMeta.label}</span>
          </div>
          <div className="settings-grid">
            <article className="settings-card">
              <strong>Theme</strong>
              <p>Switch between command mode and day mode for operational or presentation use.</p>
              <div className="mode-switch" role="group" aria-label="UI mode switch">
                <button
                  type="button"
                  className={`mode-button ${uiMode === 'dark' ? 'active' : ''}`}
                  onClick={() => setUiMode('dark')}
                  aria-pressed={uiMode === 'dark'}
                >
                  Command mode
                </button>
                <button
                  type="button"
                  className={`mode-button ${uiMode === 'light' ? 'active' : ''}`}
                  onClick={() => setUiMode('light')}
                  aria-pressed={uiMode === 'light'}
                >
                  Day mode
                </button>
              </div>
            </article>
            <article className="settings-card">
              <strong>Data source</strong>
              <p>{dataSource?.source === 'live' ? 'Live telemetry is active.' : 'Simulation mode is active.'}</p>
              <small>{dataSource?.generated_at ?? 'Waiting for backend data'}</small>
            </article>
            <article className="settings-card">
              <strong>Backend</strong>
              <p>{API_BASE}</p>
              <small>{GOOGLE_MAPS_API_KEY ? 'Maps API key configured' : 'Maps API key missing'}</small>
            </article>
          </div>
        </section>
      ) : null}

      {(activePage === 'overview' || activePage === 'journey' || activePage === 'operations') ? (
      <section className="focus-panel">
        <article className="focus-card">
          <span className="focus-label">Current problem</span>
          <strong className="focus-value">
            {focusZone ? `${zoneDisplayName(focusZone.zone_id, venueZoneLabels)} congestion (${focusZone.density_score}%)` : 'Waiting for zone data'}
          </strong>
        </article>
        <article className="focus-card">
          <span className="focus-label">AI action</span>
          <strong className="focus-value">
            AI is actively redirecting traffic to {LOCATION_LABELS[journey?.recommended_anchor ?? ''] ?? 'South Gate Corridor'} to prevent overload.
          </strong>
        </article>
        <article className="focus-card impact">
          <span className="focus-label">Impact</span>
          <strong className="focus-value">Wait time reduced by {impactMinutes} mins</strong>
        </article>
      </section>
      ) : null}

      {(activePage === 'overview' || activePage === 'live-map') ? (
      <section className="panel stadium-panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Real Venue Layer</p>
            <h2>{selectedVenue.name}</h2>
          </div>
          <span className="timestamp">
            {selectedVenue.layoutMessage} • {dataSource?.source === 'live' ? 'live telemetry' : 'simulated crowd events'}
          </span>
        </div>
        <div className="stadium-map-shell">
          <div
            ref={mapContainerRef}
            className="stadium-map"
            role="img"
            aria-label={`Interactive map for ${selectedVenue.name} with live crowd overlays`}
          />
          {!mapApiReady || mapError ? (
            <div className="map-overlay" role="status" aria-live="polite">
              {mapError ?? 'Map API loading. Heat simulation and routing are still active.'}
            </div>
          ) : null}
          {showRebalance ? <div className="rebalance-overlay">Rebalancing traffic...</div> : null}
        </div>
        <div className="zone-meaning-strip">
          <span className="zone-chip">Zone 1 → {venueZoneLabels['zone-1'] ?? 'Zone 1'}</span>
          <span className="zone-chip">Zone 2 → {venueZoneLabels['zone-2'] ?? 'Zone 2'}</span>
          <span className="zone-chip">Zone 3 → {venueZoneLabels['zone-3'] ?? 'Zone 3'}</span>
          <span className="zone-chip">Zone 4 → {venueZoneLabels['zone-4'] ?? 'Zone 4'}</span>
        </div>
      </section>
      ) : null}

      {(activePage === 'overview' || activePage === 'live-map') ? (
      <section className="dashboard-grid">
        <article className={`panel heatmap-panel ${isRefreshing ? 'panel-loading' : ''}`}>
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Crowd Heatmap</p>
              <h2>{optimizeMode ? 'After optimization view' : 'Live density visualization'}</h2>
            </div>
            <span className="timestamp">{snapshot?.generated_at ?? 'Awaiting live data'}</span>
          </div>
          <div className="heatmap-container">
            <HeatmapCanvas
              zones={heatmap}
              routePathSet={routePathSet}
              routePath={routePath}
              topZones={topZones}
              optimizeMode={optimizeMode}
              flashZoneId={focusZone?.zone_id ?? null}
              flashPulse={flashPulse}
            />
            <div className="heatmap-legend">
              <div className="legend-item">
                <div style={{ background: 'rgb(30, 144, 255)' }}></div>
                <span>Low</span>
              </div>
              <div className="legend-item">
                <div style={{ background: 'rgb(230, 175, 0)' }}></div>
                <span>Medium</span>
              </div>
              <div className="legend-item">
                <div style={{ background: 'rgb(255, 0, 0)' }}></div>
                <span>High</span>
              </div>
              <div className="legend-item">
                <div style={{ border: '2px solid #57c7ff' }}></div>
                <span>Route glow</span>
              </div>
              <div className="legend-item">
                <div style={{ border: '2px dashed #ff6b6b' }}></div>
                <span>Hotspot</span>
              </div>
            </div>
          </div>
          {error ? <p className="error-banner">{error}</p> : null}
        </article>
      </section>
      ) : null}

      {(activePage === 'overview' || activePage === 'journey') ? (
      <section className="panel control-panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Journey Control</p>
            <h2>Attendee flow</h2>
          </div>
          <span className="timestamp">Phase: {phase}</span>
        </div>
        <div className="control-grid">
          <label>
            Event phase
            <select value={phase} onChange={(event) => setPhase(event.target.value as EventPhase)}>
              {PHASE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Origin
            <select value={origin} onChange={(event) => setOrigin(event.target.value)}>
              {LOCATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Destination
            <select value={destination} onChange={(event) => setDestination(event.target.value)}>
              {LOCATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="signal-card">
            <span>Fallback readiness</span>
            <strong>{resilience?.offline_ready ? 'Ready' : '--'}</strong>
            <small>{resilience?.fallback_mode ?? 'Waiting for data'}</small>
          </div>
        </div>
      </section>
      ) : null}

      {(activePage === 'overview' || activePage === 'journey') ? (
      <section className="decision-strip">
        <article className="decision-card emphasis">
          <span>🧠 Predicted congestion in 2 mins</span>
          <strong>Predicted congestion in {venueZoneLabels[predictedZone] ?? 'Gate B'} in 2 mins</strong>
          <p>Model forecasts pressure build-up here next. Rerouting is pre-emptive.</p>
        </article>
        <article className="decision-card compare">
          <span>📉 Before vs After</span>
          <strong>{optimizeMode ? 'Optimization active' : 'Baseline live mode'}</strong>
          <p>
            Queue wait {comparison ? `${comparison.before.longest_queue} → ${comparison.after.longest_queue} min` : '--'}
            <br />
            Avg density {comparison ? `${comparison.before.avg_density} → ${comparison.after.avg_density}` : '--'}
          </p>
        </article>
        <article className="decision-card">
          <span>⏱ Best current queue</span>
          <strong>{shortestQueue ? `${shortestQueue.stall_id} · ${shortestQueue.wait_time_minutes} min` : '--'}</strong>
          <p>Operationally safest immediate diversion from congested route.</p>
        </article>
      </section>
      ) : null}

      {(activePage === 'overview' || activePage === 'journey' || activePage === 'operations') ? (
      <section className="dashboard-grid">
        <aside className="stack">
          <article className="panel journey-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Smart Routing</p>
                <h2>Live journey plan</h2>
              </div>
            </div>
            <div className="journey-summary">
              <div>
                <span>Recommended anchor</span>
                <strong>{journey?.recommended_anchor ?? '--'}</strong>
              </div>
              <div>
                <span>Queue wait</span>
                <strong>{journey?.queue_wait_minutes ?? '--'} min</strong>
              </div>
              <div>
                <span>Avoidance score</span>
                <strong>{journey ? `${journey.route.avoidance_score}%` : '--'}</strong>
              </div>
            </div>
            <div className="route-chip-list">
              {routePath.length ? (
                routePath.map((zoneId) => (
                  <span key={zoneId} className="route-chip">
                    {venueZoneLabels[zoneId] ?? zoneId}
                  </span>
                ))
              ) : (
                <span className="route-chip muted">Route will appear after connection is ready.</span>
              )}
            </div>
            <div className="advice-list">
              {journey?.advice.map((item) => (
                <div key={item} className="advice-item">
                  {item}
                </div>
              )) ?? null}
            </div>
          </article>

          <article className="panel queue-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Queue Prediction</p>
                <h2>Wait-time estimates</h2>
              </div>
            </div>
            <div className="queue-summary">
              <div>
                <span>Heat index</span>
                <strong>{heatIndex}</strong>
              </div>
              <div>
                <span>Tracked queues</span>
                <strong>{liveQueues.length}</strong>
              </div>
            </div>
            <div className="queue-list">
              {liveQueues.map((queue) => (
                <div key={queue.stall_id} className="queue-item">
                  <div>
                    <strong>{queue.stall_id}</strong>
                    <span>Alternative: {queue.alternative}</span>
                  </div>
                  <b>{queue.wait_time_minutes} min</b>
                </div>
              ))}
            </div>
          </article>
        </aside>
      </section>
      ) : null}

      {(activePage === 'overview' || activePage === 'live-map') ? (
      <section className="panel venue-panel subdued-panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Venue Map</p>
            <h2>Gates, exits, and parking</h2>
          </div>
          <span className="timestamp">{venueMap?.generated_at ?? 'Awaiting live data'}</span>
        </div>
        <div className="venue-grid">
          <div>
            <h3>Gates</h3>
            <div className="node-list">
              {venueMap?.gates.map((node) => (
                <div key={node.node_id} className={`node-card ${node.density_level}`}>
                  <strong>{node.label}</strong>
                  <span>{node.recommendation}</span>
                </div>
              )) ?? null}
            </div>
          </div>
          <div>
            <h3>Parking</h3>
            <div className="node-list">
              {venueMap?.parking.map((node) => (
                <div key={node.node_id} className={`node-card ${node.density_level}`}>
                  <strong>{node.label}</strong>
                  <span>{node.recommendation}</span>
                </div>
              )) ?? null}
            </div>
          </div>
          <div>
            <h3>Exits</h3>
            <div className="node-list">
              {venueMap?.exits.map((node) => (
                <div key={node.node_id} className={`node-card ${node.density_level}`}>
                  <strong>{node.label}</strong>
                  <span>{node.recommendation}</span>
                </div>
              )) ?? null}
            </div>
          </div>
          <div>
            <h3>Concourse</h3>
            <div className="node-list">
              {venueMap?.concourse.map((node) => (
                <div key={node.node_id} className={`node-card ${node.density_level}`}>
                  <strong>{node.label}</strong>
                  <span>{node.recommendation}</span>
                </div>
              )) ?? null}
            </div>
          </div>
        </div>
        <div className="note-list">
          {venueMap?.notes.map((note) => (
            <div key={note} className="note-pill">
              {note}
            </div>
          )) ?? null}
        </div>
      </section>
      ) : null}

      {(activePage === 'overview' || activePage === 'operations') ? (
      <section className="panel organizer-panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Organizer Dashboard</p>
            <h2>Operational summary</h2>
          </div>
          <span className="timestamp">{organizerSummary?.generated_at ?? 'Awaiting live data'}</span>
          {activePage === 'overview' ? (
            <button
              type="button"
              className="panel-collapse-toggle"
              onClick={() =>
                setCollapsedPanels((prev) => ({
                  ...prev,
                  organizer: !prev.organizer,
                }))
              }
              aria-expanded={!collapsedPanels.organizer}
            >
              {collapsedPanels.organizer ? 'Expand' : 'Collapse'}
            </button>
          ) : null}
        </div>
        {activePage === 'overview' && collapsedPanels.organizer ? null : (
        <>
        <div className="organizer-grid">
          <div className="organizer-stat">
            <span>Average density</span>
            <strong>{organizerSummary?.avg_density ?? '--'}</strong>
          </div>
          <div className="organizer-stat">
            <span>Hot zones</span>
            <strong>{organizerSummary?.high_density_zone_count ?? '--'}</strong>
          </div>
          <div className="organizer-stat">
            <span>Priority queues</span>
            <strong>{organizerSummary?.longest_queues.length ?? '--'}</strong>
          </div>
        </div>
        <div className="organizer-columns">
          <div>
            <h3>Top zones</h3>
            <div className="tag-list">
              {organizerSummary?.highest_density_zones.map((zone) => (
                <span key={zone} className="tag-chip">
                  {zone}
                </span>
              )) ?? null}
            </div>
          </div>
          <div>
            <h3>Interventions</h3>
            <div className="intervention-list">
              {organizerSummary?.interventions.map((item) => (
                <article key={`${item.type}-${item.target}`} className="intervention-item">
                  <strong>{item.target}</strong>
                  <span>{item.message}</span>
                </article>
              )) ?? null}
            </div>
          </div>
        </div>
        </>
        )}
      </section>
      ) : null}

      {(activePage === 'overview' || activePage === 'operations') ? (
      <section className="panel staff-panel subdued-panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Staff Control</p>
            <h2>Recommended actions</h2>
          </div>
          <span className="timestamp">{staffPlan?.generated_at ?? 'Awaiting live data'}</span>
          {activePage === 'overview' ? (
            <button
              type="button"
              className="panel-collapse-toggle"
              onClick={() =>
                setCollapsedPanels((prev) => ({
                  ...prev,
                  staff: !prev.staff,
                }))
              }
              aria-expanded={!collapsedPanels.staff}
            >
              {collapsedPanels.staff ? 'Expand' : 'Collapse'}
            </button>
          ) : null}
        </div>
        {activePage === 'overview' && collapsedPanels.staff ? null : (
        <div className="staff-list">
          {staffPlan?.actions.map((action) => (
            <article key={`${action.area}-${action.instruction}`} className={`staff-card ${action.priority}`}>
              <span>{action.priority.toUpperCase()}</span>
              <strong>{action.area}</strong>
              <p>{action.instruction}</p>
              <small>{action.rationale}</small>
            </article>
          )) ?? null}
        </div>
        )}
      </section>
      ) : null}

      {(activePage === 'overview' || activePage === 'operations') ? (
      <section className="panel resilience-panel subdued-panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Continuity</p>
            <h2>Fallback and connectivity</h2>
          </div>
          <span className="timestamp">{resilience?.generated_at ?? 'Awaiting live data'}</span>
        </div>
        <div className="resilience-grid">
          <div className="resilience-stat">
            <span>Signal</span>
            <strong>{resilience?.signal_quality ?? '--'}</strong>
          </div>
          <div className="resilience-stat">
            <span>Cache window</span>
            <strong>{resilience?.cache_window_minutes ?? '--'} min</strong>
          </div>
          <div className="resilience-stat">
            <span>Offline ready</span>
            <strong>{resilience?.offline_ready ? 'Yes' : '--'}</strong>
          </div>
          <div className="resilience-stat">
            <span>Fallback mode</span>
            <strong>{resilience?.fallback_mode ?? '--'}</strong>
          </div>
        </div>
      </section>
      ) : null}

      {(activePage === 'overview' || activePage === 'operations') ? (
      <section className="panel alerts-panel subdued-panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Alerts System</p>
            <h2>Operational notifications</h2>
          </div>
          {activePage === 'overview' ? (
            <button
              type="button"
              className="panel-collapse-toggle"
              onClick={() =>
                setCollapsedPanels((prev) => ({
                  ...prev,
                  alerts: !prev.alerts,
                }))
              }
              aria-expanded={!collapsedPanels.alerts}
            >
              {collapsedPanels.alerts ? 'Expand' : 'Collapse'}
            </button>
          ) : null}
        </div>
        {activePage === 'overview' && collapsedPanels.alerts ? null : (
        <div className="alerts-grid">
          {alerts.map((alert) => (
            <article key={`${alert.type}-${alert.title}`} className={`alert-card ${alert.severity}`}>
              <span>{alert.severity.toUpperCase()}</span>
              <h3>{alert.title}</h3>
              <p>{alert.message}</p>
            </article>
          ))}
        </div>
        )}
      </section>
      ) : null}
    </main>
  );
}

export default App;
