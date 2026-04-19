import os
from typing import Annotated

from fastapi import Body, FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, ConfigDict, Field
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .simulator import CrowdSimulator


def _allowed_origins() -> list[str]:
    raw_origins = os.getenv(
        "FLOWSYNC_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    )
    parsed = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    return parsed or ["http://localhost:5173"]


def _allowed_hosts() -> list[str]:
    raw_hosts = os.getenv(
        "FLOWSYNC_ALLOWED_HOSTS",
        "localhost,127.0.0.1,testserver",
    )
    parsed = [host.strip() for host in raw_hosts.split(",") if host.strip()]
    return parsed or ["localhost", "127.0.0.1", "testserver"]


class LiveZonePayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    zone_id: str = Field(min_length=1, max_length=32, pattern=r"^zone-\d+$")
    row: int | None = Field(default=None, ge=0, le=200)
    col: int | None = Field(default=None, ge=0, le=200)
    density_score: float | int = Field(ge=0, le=100)


class LiveQueuePayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    stall_id: str = Field(min_length=1, max_length=64, pattern=r"^[a-z0-9-]+$")
    wait_time_minutes: float | int = Field(ge=0, le=300)
    alternative: str | None = Field(default=None, max_length=64)


class LiveSnapshotPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    generated_at: str | None = Field(default=None, max_length=64)
    zones: list[LiveZonePayload] = Field(min_length=1, max_length=800)
    queues: list[LiveQueuePayload] | None = None


PHASE_QUERY = Annotated[str, Query(pattern=r"^(arrival|in-venue|halftime|departure)$")]
LOCATION_QUERY = Annotated[str, Query(min_length=1, max_length=50, pattern=r"^[a-z0-9,-]+$")]
DEMO_ACTION_QUERY = Annotated[str, Query(pattern=r"^(normal|surge-zone-1|food-rush|emergency-mode|optimize-crowd)$")]
STALL_QUERY = Annotated[str, Query(min_length=3, max_length=64, pattern=r"^[a-z0-9-]+$")]

app = FastAPI(title="FlowSync AI API", version="0.1.0")
cors_origins = _allowed_origins()
allowed_hosts = _allowed_hosts()
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials="*" not in cors_origins,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts)
app.add_middleware(GZipMiddleware, minimum_size=1024)

simulator = CrowdSimulator()


@app.middleware("http")
async def add_security_headers(request: Request, call_next) -> Response:
    content_length_raw = request.headers.get("content-length")
    if content_length_raw:
        try:
            content_length = int(content_length_raw)
            if content_length > 1_000_000:
                return Response(status_code=413, content="Payload too large")
        except ValueError:
            return Response(status_code=400, content="Invalid Content-Length header")

    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "geolocation=(), camera=(), microphone=()")
    if request.url.scheme == "https":
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    if request.method != "OPTIONS":
        response.headers.setdefault("Cache-Control", "no-store")
    return response


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
def route(start: LOCATION_QUERY = "entrance", end: LOCATION_QUERY = "seat") -> dict:
    return simulator.route(start, end)


@app.get("/venue-map")
def venue_map(phase: PHASE_QUERY = "in-venue") -> dict:
    return simulator.venue_map(phase)


@app.get("/journey")
def journey(
    phase: PHASE_QUERY = "in-venue",
    origin: LOCATION_QUERY = "entrance",
    destination: LOCATION_QUERY = "seat",
) -> dict:
    return simulator.journey(phase, origin, destination)


@app.get("/staff-actions")
def staff_actions(phase: PHASE_QUERY = "in-venue") -> dict:
    return simulator.staff_actions(phase)


@app.get("/resilience")
def resilience() -> dict:
    return simulator.resilience_status()


@app.post("/demo-control")
def demo_control(action: DEMO_ACTION_QUERY = "normal") -> dict:
    return simulator.demo_control(action)


@app.get("/queue-time")
def queue_time(stall_id: STALL_QUERY = "stall-1") -> dict:
    return simulator.queue_time(stall_id)


@app.get("/alerts")
def alerts() -> dict:
    return {"alerts": simulator.alerts()}


@app.get("/organizer-summary")
def organizer_summary() -> dict:
    return simulator.organizer_summary()


@app.post("/ingest/live-snapshot")
def ingest_live_snapshot(payload: LiveSnapshotPayload = Body(...)) -> dict:
    try:
        snapshot_payload = simulator.ingest_live_snapshot(payload.model_dump(mode="python", exclude_none=True))
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
