from fastapi import Body, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .simulator import CrowdSimulator

app = FastAPI(title="FlowSync AI API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

simulator = CrowdSimulator()


@app.on_event("startup")
async def on_startup() -> None:
    simulator.start()


@app.on_event("shutdown")
async def on_shutdown() -> None:
    simulator.stop()


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/snapshot")
def snapshot() -> dict:
    return simulator.snapshot()


@app.get("/heatmap")
def heatmap() -> dict:
    return {"generated_at": simulator.snapshot()["generated_at"], "zones": simulator.heatmap()}


@app.get("/route")
def route(start: str = Query("entrance"), end: str = Query("seat")) -> dict:
    return simulator.route(start, end)


@app.get("/venue-map")
def venue_map(phase: str = Query("in-venue")) -> dict:
    return simulator.venue_map(phase)


@app.get("/journey")
def journey(
    phase: str = Query("in-venue"),
    origin: str = Query("entrance"),
    destination: str = Query("seat"),
) -> dict:
    return simulator.journey(phase, origin, destination)


@app.get("/staff-actions")
def staff_actions(phase: str = Query("in-venue")) -> dict:
    return simulator.staff_actions(phase)


@app.get("/resilience")
def resilience() -> dict:
    return simulator.resilience_status()


@app.post("/demo-control")
def demo_control(action: str = Query("normal")) -> dict:
    return simulator.demo_control(action)


@app.get("/queue-time")
def queue_time(stall_id: str = Query("stall-1")) -> dict:
    return simulator.queue_time(stall_id)


@app.get("/alerts")
def alerts() -> dict:
    return {"alerts": simulator.alerts()}


@app.get("/organizer-summary")
def organizer_summary() -> dict:
    return simulator.organizer_summary()


@app.post("/ingest/live-snapshot")
def ingest_live_snapshot(payload: dict = Body(...)) -> dict:
    try:
        snapshot_payload = simulator.ingest_live_snapshot(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "status": "accepted",
        "data_source": "live",
        "snapshot": snapshot_payload,
    }


@app.get("/data-source")
def data_source() -> dict:
    return simulator.data_source_status()
