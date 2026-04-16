# FlowSync AI

[![CI](https://github.com/Yash55-max/FlowSync-AI/actions/workflows/ci.yml/badge.svg)](https://github.com/Yash55-max/FlowSync-AI/actions/workflows/ci.yml)

FlowSync AI is a real-time crowd intelligence platform for large events. It combines live crowd simulation, density-aware routing, queue prediction, and operator-focused dashboards so attendees and staff can make faster, safer movement decisions.

## Core Capabilities

- Live crowd heatmap with zone-level density updates
- Smart routing that avoids high-density areas
- Queue-time prediction for key service points
- Event-phase aware journey guidance (arrival, in-venue, halftime, departure)
- Operations dashboard with alerts, top risk zones, and intervention recommendations
- Demo controls for surge, food rush, emergency mode, and optimization scenarios

## Tech Stack

- Frontend: React + TypeScript + Vite
- Backend: FastAPI + Python
- Algorithms: Grid-based pathfinding with density-weighted costs
- Data Mode: Hybrid (simulated by default, live snapshot ingest supported)

## Project Structure

```text
FlowSync AI/
├─ backend/
│  ├─ app/
│  │  ├─ main.py
│  │  └─ simulator.py
│  └─ requirements.txt
├─ frontend/
│  ├─ src/
│  │  ├─ App.tsx
│  │  └─ App.css
│  └─ package.json
├─ PRD.txt
├─ TRD.txt
└─ README.md
```

## Quick Start

### 1. Backend

```powershell
cd "d:\FlowSync AI"
python -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
backend\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --app-dir backend --port 8000
```

### 2. Frontend

```powershell
cd "d:\FlowSync AI\frontend"
npm install
npm run dev
```

### 3. Open the app

- Frontend: http://localhost:5173
- Backend docs: http://localhost:8000/docs

## Main API Endpoints

- `GET /health` - Service health
- `GET /snapshot` - Current crowd/queue snapshot
- `GET /organizer-summary` - Operator-focused summary metrics
- `GET /journey?phase=...&origin=...&destination=...` - Route and journey guidance
- `GET /venue-map?phase=...` - Venue node data by phase
- `GET /staff-actions?phase=...` - Suggested interventions
- `POST /demo-control?action=...` - Trigger scenario modes
- `POST /ingest/live-snapshot` - Push a real telemetry snapshot into the API
- `GET /data-source` - Current source status (`live` or `simulated`)

## Demo Controls

- `surge-zone-1`
- `food-rush`
- `emergency-mode`
- `optimize-crowd`

These controls are designed for live demos and stress-case walkthroughs.

## Configuration Notes

- The MVP runs with simulated data out of the box.
- To change API host in frontend, set `VITE_API_BASE_URL` in `frontend/.env`.
- Live snapshot TTL fallback can be tuned with `FLOWSYNC_LIVE_SNAPSHOT_TTL_SECONDS` (default: `20`).
- For production deployment, feed snapshots from telemetry adapters (turnstile/CCTV/Wi-Fi/beacons) via `POST /ingest/live-snapshot`.

## Live Snapshot Ingest Example

```json
{
	"generated_at": "2026-04-15T12:30:00Z",
	"zones": [
		{ "zone_id": "zone-1", "row": 0, "col": 0, "density_score": 88 },
		{ "zone_id": "zone-2", "row": 0, "col": 1, "density_score": 64 }
	],
	"queues": [
		{ "stall_id": "stall-1", "wait_time_minutes": 12, "alternative": "stall-2" }
	]
}
```

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:8000/ingest/live-snapshot" -ContentType "application/json" -Body (Get-Content .\sample-live.json -Raw)
```

## Development Workflow

```powershell
# check frontend compile
cd "d:\FlowSync AI\frontend"
npm run build

# check backend import/runtime quickly
cd "d:\FlowSync AI"
backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --port 8000
```

## Continuous Integration

GitHub Actions runs CI on every push and pull request to `main`:

- Backend: dependency install, syntax compile, FastAPI app import check
- Frontend: clean dependency install and production build

Workflow file: `.github/workflows/ci.yml`

## License

This project is provided under the MIT License. See `LICENSE`.
