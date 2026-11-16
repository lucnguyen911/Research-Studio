from __future__ import annotations

from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
import os

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.core.config import (
    DEFAULT_BIND_HOST,
    ensure_runtime_dirs,
    get_allowed_origins,
    validate_loopback_bind_host,
)
from app.core.errors import AppError, error_json_response, register_error_handlers
from app.core.logging_setup import close_logging_handlers, configure_logging
from app.core.security import CSRF_HEADER_NAME, verify_local_csrf_and_origin
from app.db.migrator import run_migrations
from app.routers import global_research as global_research_router
from app.routers import ideas as ideas_router
from app.routers import project_competitors as project_competitors_router
from app.routers import project_keywords as project_keywords_router
from app.routers import projects as projects_router
from app.routers import rss as rss_router
from app.routers import system as system_router
from app.services import scheduler_service


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    ensure_runtime_dirs()
    configure_logging()
    run_migrations()
    await scheduler_service.scheduler.start()
    try:
        yield
    finally:
        await scheduler_service.scheduler.stop()
        close_logging_handlers()


def create_app() -> FastAPI:
    application = FastAPI(
        title="Research Studio API",
        version="0.1.0",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    register_error_handlers(application)

    application.add_middleware(
        CORSMiddleware,
        allow_origins=get_allowed_origins(),
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Accept", CSRF_HEADER_NAME],
    )

    def _apply_security_headers(request: Request, response: Response) -> Response:
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("Cross-Origin-Resource-Policy", "same-site")
        if request.url.path.startswith("/api/v1"):
            response.headers.setdefault("Cache-Control", "no-store")
            response.headers.setdefault("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
        return response

    @application.middleware("http")
    async def csrf_and_origin_middleware(
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        allowed = set(get_allowed_origins())
        try:
            verify_local_csrf_and_origin(request, allowed)
        except AppError as exc:
            resp = error_json_response(
                code=exc.code,
                message=exc.message,
                status_code=exc.status_code,
                details=exc.details,
            )
            return _apply_security_headers(request, resp)
        response = await call_next(request)
        return _apply_security_headers(request, response)

    application.include_router(system_router.router)
    application.include_router(projects_router.router)
    application.include_router(project_competitors_router.router)
    application.include_router(project_keywords_router.router)
    application.include_router(global_research_router.router)
    application.include_router(rss_router.router)
    application.include_router(ideas_router.router)

    @application.get("/api/health")
    async def health_check() -> dict[str, str]:
        return {
            "status": "ok",
            "service": "research-studio-api",
            "environment": "local",
        }

    return application


app = create_app()


async def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "research-studio-api",
        "environment": "local",
    }


if __name__ == "__main__":
    bind_host = validate_loopback_bind_host(os.getenv("RESEARCH_STUDIO_HOST", DEFAULT_BIND_HOST))
    bind_port = int(os.getenv("RESEARCH_STUDIO_PORT", "8000"))
    uvicorn.run("app.main:app", host=bind_host, port=bind_port, log_level="warning")

