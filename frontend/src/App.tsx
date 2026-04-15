import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

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

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
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

const DEMO_CONTROLS: Array<{ label: string; action: DemoScenario; tone: 'low' | 'medium' | 'high' }> = [
  { label: '🔥 Surge Zone 1', action: 'surge-zone-1', tone: 'medium' },
  { label: '🍔 Food Rush', action: 'food-rush', tone: 'medium' },
  { label: '🚨 Emergency Mode', action: 'emergency-mode', tone: 'high' },
  { label: '✨ Optimize Crowd', action: 'optimize-crowd', tone: 'low' },
];

// Canvas-based heatmap visualization component
interface HeatmapCanvasProps {
  zones: Zone[];
  routePathSet: Set<string>;
  topZones: Zone[];
}

const HeatmapCanvas: React.FC<HeatmapCanvasProps> = ({ zones, routePathSet, topZones }) => {
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

    // Create a density map
    const densityMap: Map<string, number> = new Map();
    zones.forEach(zone => {
      const key = `${zone.row}-${zone.col}`;
      densityMap.set(key, zone.density_score);
    });

    // Draw heat cells with smooth gradients
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * cellWidth;
        const y = row * cellHeight;
        const key = `${row}-${col}`;
        const density = densityMap.get(key) || 0;

        // Draw cell background
        ctx.fillStyle = getColorForDensity(density);
        ctx.globalAlpha = 0.7 + (density / 100) * 0.3; // Opacity based on density
        ctx.fillRect(x, y, cellWidth, cellHeight);
        ctx.globalAlpha = 1;

        // Draw cell border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, cellWidth, cellHeight);

        // Highlight route path in green
        const zone = zones.find(z => z.row === row && z.col === col);
        if (zone && routePathSet.has(zone.zone_id)) {
          ctx.strokeStyle = '#4ade80';
          ctx.lineWidth = 3;
          ctx.strokeRect(x + 2, y + 2, cellWidth - 4, cellHeight - 4);
        }

        // Highlight top zones (hotspots) with pulsing effect
        if (zone && topZones.some(tz => tz.zone_id === zone.zone_id)) {
          ctx.strokeStyle = '#ff6b6b';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(x + 1, y + 1, cellWidth - 2, cellHeight - 2);
          ctx.setLineDash([]);
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
  }, [zones, routePathSet, topZones]);

  return (
    <canvas
      ref={canvasRef}
      width={640}
      height={320}
      className="heatmap-canvas"
    />
  );
};

function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [journey, setJourney] = useState<JourneyPlan | null>(null);
  const [comparison, setComparison] = useState<DemoControlResponse | null>(null);
  const [toasts, setToasts] = useState<ToastNotice[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [venueMap, setVenueMap] = useState<VenueMap | null>(null);
  const [staffPlan, setStaffPlan] = useState<StaffPlan | null>(null);
  const [organizerSummary, setOrganizerSummary] = useState<OrganizerSummary | null>(null);
  const [resilience, setResilience] = useState<ResilienceStatus | null>(null);
  const [phase, setPhase] = useState<EventPhase>('in-venue');
  const [origin, setOrigin] = useState('concourse-a');
  const [destination, setDestination] = useState('seat-block');
  const [status, setStatus] = useState('Connecting to live crowd feed...');
  const [error, setError] = useState<string | null>(null);

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
    let mounted = true;

    const load = async () => {
      try {
        const [snapshotResponse, alertsResponse, journeyResponse, venueMapResponse, staffResponse, organizerResponse, resilienceResponse] =
          await Promise.all([
          fetch(`${API_BASE}/snapshot`),
          fetch(`${API_BASE}/alerts`),
          fetch(
            `${API_BASE}/journey?phase=${encodeURIComponent(phase)}&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`,
          ),
          fetch(`${API_BASE}/venue-map?phase=${encodeURIComponent(phase)}`),
          fetch(`${API_BASE}/staff-actions?phase=${encodeURIComponent(phase)}`),
          fetch(`${API_BASE}/organizer-summary`),
          fetch(`${API_BASE}/resilience`),
        ]);

        if (
          !snapshotResponse.ok ||
          !alertsResponse.ok ||
          !journeyResponse.ok ||
          !venueMapResponse.ok ||
          !staffResponse.ok ||
          !organizerResponse.ok ||
          !resilienceResponse.ok
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
        setStatus('Live updates active');
        setError(null);
      } catch (loadError) {
        if (!mounted) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : 'Unable to reach the backend');
        setStatus('Waiting for API connection');
      }
    };

    load();
    const interval = window.setInterval(load, 1000);

    return () => {
      mounted = false;
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
  const topZones = [...heatmap].sort((left, right) => right.density_score - left.density_score).slice(0, 3);
  const shortestQueue = [...liveQueues].sort((left, right) => left.wait_time_minutes - right.wait_time_minutes)[0] ?? null;
  const routePathSet = new Set(journey?.route.path ?? []);
      <div className="toast-stack">
        {toasts.map((toast) => (
          <article key={toast.id} className={`toast ${toast.severity}`}>
            <strong>{toast.title}</strong>
            <span>{toast.message}</span>
          </article>
        ))}
      </div>


  const pushToast = (notice: Omit<ToastNotice, 'id'>) => {
    setToasts((current) => [
      { id: Date.now() + Math.floor(Math.random() * 1000), ...notice },
      ...current.slice(0, 2),
    ]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== current[0]?.id));
    }, 2600);
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
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
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

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">FlowSync AI</p>
          <h1>Real-time crowd intelligence for dense event environments.</h1>
          <p className="lede">
            Coordinate arrivals, in-venue movement, halftime surges, and departure flows with one live operating
            surface.
          </p>
        </div>
        <div className="hero-card">
          <span className="status-pill">{status}</span>
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
                onClick={() => triggerDemoControl(control.action)}
                title={`Trigger ${control.label}`}
              >
                {control.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="decision-strip">
        <article className="decision-card emphasis">
          <span>AI recommends rerouting via {journey?.recommended_anchor ?? 'the lowest-density gate'}</span>
          <strong>{journey?.route.path.join(' → ') ?? 'Waiting for route data'}</strong>
          <p>Predicted congestion in 2 minutes. Avoid the red path cells and keep the green path open.</p>
        </article>
        <article className="decision-card">
          <span>Top problem zones</span>
          <strong>{topZones.map((zone) => zone.zone_id).join(', ') || '--'}</strong>
          <p>Only the three most critical hotspots are surfaced here.</p>
        </article>
        <article className="decision-card">
          <span>Shortest queue</span>
          <strong>{shortestQueue ? `${shortestQueue.stall_id} · ${shortestQueue.wait_time_minutes} min` : '--'}</strong>
          <p>Best immediate queue option for attendees.
          </p>
        </article>
        <article className="decision-card compare">
          <span>Before vs After</span>
          <strong>{comparison?.mode === 'optimize-crowd' ? 'Crowd optimized' : 'Live mode'}</strong>
          <p>
            Wait time {comparison ? `${comparison.before.longest_queue} → ${comparison.after.longest_queue} min` : '--'}
          </p>
          <p>
            Density {comparison ? `${comparison.before.avg_density} → ${comparison.after.avg_density}` : '--'}
          </p>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel heatmap-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Crowd Heatmap</p>
              <h2>Live density visualization</h2>
            </div>
            <span className="timestamp">{snapshot?.generated_at ?? 'Awaiting live data'}</span>
          </div>
          <div className="heatmap-container">
            <HeatmapCanvas zones={heatmap} routePathSet={routePathSet} topZones={topZones} />
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
                <div style={{ border: '2px solid #4ade80' }}></div>
                <span>Route</span>
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

      <section className="decision-strip">
        <article className="decision-card emphasis">
          <span>🤖 AI recommends rerouting via {journey?.recommended_anchor ?? 'the lowest-density gate'}</span>
          <strong>{journey?.route.path.join(' → ') ?? 'Waiting for route data'}</strong>
          <p>Predicted congestion in 2 minutes. Green path = optimal route. Red zones = areas to avoid.</p>
        </article>
        <article className="decision-card">
          <span>🔥 Top problem zones</span>
          <strong>{topZones.map((zone) => zone.zone_id).join(', ') || '--'}</strong>
          <p>Only the three most critical hotspots are surfaced. Real-time updates every second.</p>
        </article>
        <article className="decision-card">
          <span>⏱️ Shortest queue</span>
          <strong>{shortestQueue ? `${shortestQueue.stall_id} · ${shortestQueue.wait_time_minutes} min` : '--'}</strong>
          <p>Best immediate queue option for attendees. Avoids future congestion.</p>
        </article>
        <article className="decision-card compare">
          <span>📊 Before vs After</span>
          <strong>{comparison?.mode === 'optimize-crowd' ? '✓ Crowd Optimized' : '🟢 Live Mode'}</strong>
          <p>
            Wait time {comparison ? `${comparison.before.longest_queue} → ${comparison.after.longest_queue} min` : '--'} 
            <br/>
            Density {comparison ? `${comparison.before.avg_density} → ${comparison.after.avg_density}` : '--'}
          </p>
        </article>
      </section>

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
            <p className="path-line">{journey?.route.path.join(' → ') ?? 'Route will appear after connection is ready.'}</p>
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

      <section className="panel venue-panel">
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

      <section className="panel organizer-panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Organizer Dashboard</p>
            <h2>Operational summary</h2>
          </div>
          <span className="timestamp">{organizerSummary?.generated_at ?? 'Awaiting live data'}</span>
        </div>
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
      </section>

      <section className="panel staff-panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Staff Control</p>
            <h2>Recommended actions</h2>
          </div>
          <span className="timestamp">{staffPlan?.generated_at ?? 'Awaiting live data'}</span>
        </div>
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
      </section>

      <section className="panel resilience-panel">
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

      <section className="panel alerts-panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Alerts System</p>
            <h2>Operational notifications</h2>
          </div>
        </div>
        <div className="alerts-grid">
          {alerts.map((alert) => (
            <article key={`${alert.type}-${alert.title}`} className={`alert-card ${alert.severity}`}>
              <span>{alert.severity.toUpperCase()}</span>
              <h3>{alert.title}</h3>
              <p>{alert.message}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default App;
