import unittest

from fastapi.testclient import TestClient

from app.main import app


class ApiBehaviorTests(unittest.TestCase):
    def test_health_and_security_headers(self) -> None:
        with TestClient(app) as client:
            response = client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})
        self.assertEqual(response.headers.get("x-content-type-options"), "nosniff")
        self.assertEqual(response.headers.get("x-frame-options"), "DENY")
        self.assertEqual(response.headers.get("cache-control"), "no-store")

    def test_route_rejects_invalid_locations(self) -> None:
        with TestClient(app) as client:
            response = client.get("/route", params={"start": "../../etc", "end": "seat"})

        self.assertEqual(response.status_code, 422)

    def test_journey_rejects_invalid_phase(self) -> None:
        with TestClient(app) as client:
            response = client.get("/journey", params={"phase": "night", "origin": "entrance", "destination": "seat"})

        self.assertEqual(response.status_code, 422)

    def test_demo_control_rejects_unknown_action(self) -> None:
        with TestClient(app) as client:
            response = client.post("/demo-control", params={"action": "explode-mode"})

        self.assertEqual(response.status_code, 422)

    def test_queue_time_rejects_invalid_stall_id(self) -> None:
        with TestClient(app) as client:
            response = client.get("/queue-time", params={"stall_id": "../bad"})

        self.assertEqual(response.status_code, 422)

    def test_rejects_oversized_payload_by_content_length(self) -> None:
        with TestClient(app) as client:
            response = client.post(
                "/ingest/live-snapshot",
                headers={"content-length": "1000001", "content-type": "application/json"},
                content=b"{}",
            )

        self.assertEqual(response.status_code, 413)

    def test_live_snapshot_payload_validation(self) -> None:
        invalid_payload = {
            "generated_at": "2026-04-19T12:00:00Z",
            "zones": [
                {
                    "zone_id": "zone-1",
                    "row": 0,
                    "col": 0,
                    "density_score": 170,
                }
            ],
        }

        with TestClient(app) as client:
            response = client.post("/ingest/live-snapshot", json=invalid_payload)

        self.assertEqual(response.status_code, 422)

    def test_data_source_switches_to_live_after_ingest(self) -> None:
        valid_payload = {
            "generated_at": "2026-04-19T12:00:00Z",
            "zones": [
                {
                    "zone_id": "zone-1",
                    "row": 0,
                    "col": 0,
                    "density_score": 62,
                },
                {
                    "zone_id": "zone-2",
                    "row": 0,
                    "col": 1,
                    "density_score": 44,
                },
            ],
            "queues": [
                {
                    "stall_id": "stall-1",
                    "wait_time_minutes": 7,
                    "alternative": "stall-2",
                }
            ],
        }

        with TestClient(app) as client:
            ingest_response = client.post("/ingest/live-snapshot", json=valid_payload)
            status_response = client.get("/data-source")

        self.assertEqual(ingest_response.status_code, 200)
        self.assertEqual(status_response.status_code, 200)
        status_payload = status_response.json()
        self.assertEqual(status_payload["source"], "live")
        self.assertEqual(status_payload["stale"], False)


if __name__ == "__main__":
    unittest.main()
