from __future__ import annotations

from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import ensure_runtime_dirs, get_allowed_origins
from app.core.errors import AppError, error_json_response, register_error_handlers
from app.core.logging_setup import close_logging_handlers, configure_logging
from app.core.security import CSRF_HEADER_NAME, verify_local_csrf_and_origin
from app.db.migrator import run_migrations
from app.routers import global_research as global_research_router
from app.routers import projects as projects_router
from app.routers import rss as rss_router
from app.routers import system as system_router


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    ensure_runtime_dirs()
    configure_logging()
    run_migrations()
    try:
        yield
    finally:
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
        allow_headers=["Content-Type", CSRF_HEADER_NAME],
    )

    @application.middleware("http")
    async def csrf_and_origin_middleware(
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        allowed = set(get_allowed_origins())
        try:
            verify_local_csrf_and_origin(request, allowed)
        except AppError as exc:
            return error_json_response(
                code=exc.code,
                message=exc.message,
                status_code=exc.status_code,
                details=exc.details,
            )
        return await call_next(request)

    application.include_router(system_router.router)
    application.include_router(projects_router.router)
    application.include_router(global_research_router.router)
    application.include_router(rss_router.router)

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

