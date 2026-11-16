from __future__ import annotations

from collections.abc import Sequence
import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging_setup import LOGGER_NAME, redact_sensitive_text


class AppError(Exception):
    """Domain or HTTP-boundary exception serialized cleanly to JSON without tracebacks."""

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        details: Any = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details


def error_json_response(
    code: str,
    message: str,
    status_code: int = 400,
    details: Any = None,
) -> JSONResponse:
    """Build the standardized JSON error envelope specified in CONSTRAINTS.md."""
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "code": code,
                "message": message,
                "details": details,
            }
        },
    )


def _sanitize_validation_errors(raw_errors: Sequence[Any]) -> list[dict[str, Any]]:
    """Strip raw client inputs from 422 details so invalid API key payloads are never echoed back."""
    sanitized: list[dict[str, Any]] = []
    for err in raw_errors:
        if not isinstance(err, dict):
            continue
        sanitized.append(
            {
                "loc": list(err.get("loc", ())),
                "type": str(err.get("type", "validation_error")),
                "msg": redact_sensitive_text(str(err.get("msg", "Invalid value"))),
            }
        )
    return sanitized


def register_error_handlers(app: FastAPI) -> None:
    """Attach standardized JSON error handlers covering AppError, validation, HTTP, and 500s."""
    logger = logging.getLogger(LOGGER_NAME)

    @app.exception_handler(AppError)
    async def handle_app_error(_request: Request, exc: AppError) -> JSONResponse:
        return error_json_response(
            code=exc.code,
            message=exc.message,
            status_code=exc.status_code,
            details=exc.details,
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_request: Request, exc: RequestValidationError) -> JSONResponse:
        return error_json_response(
            code="VALIDATION_ERROR",
            message="Dữ liệu đầu vào không hợp lệ.",
            status_code=422,
            details=_sanitize_validation_errors(exc.errors()),
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
        return error_json_response(
            code=f"HTTP_{exc.status_code}",
            message=str(exc.detail) if exc.detail else "Yêu cầu không hợp lệ.",
            status_code=exc.status_code,
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error on %s %s: %s", request.method, request.url.path, exc)
        return error_json_response(
            code="INTERNAL_ERROR",
            message="Đã xảy ra lỗi nội bộ trong máy chủ cục bộ. Vui lòng kiểm tra log và thử lại.",
            status_code=500,
        )
