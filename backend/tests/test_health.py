import unittest
from app.main import app, health_check


class HealthEndpointTests(unittest.IsolatedAsyncioTestCase):
    async def test_health_check_payload(self) -> None:
        payload = await health_check()
        self.assertEqual(payload["status"], "ok")
        self.assertEqual(payload["service"], "research-studio-api")
        self.assertEqual(payload["environment"], "local")

    def test_health_route_registered(self) -> None:
        paths = {route.path for route in app.routes if hasattr(route, "path")}
        self.assertIn("/api/health", paths)


if __name__ == "__main__":
    unittest.main()
