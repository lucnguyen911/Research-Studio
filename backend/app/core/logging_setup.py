from __future__ import annotations

import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
import re

from app.core.config import ensure_runtime_dirs

LOGGER_NAME = "research_studio"
LOG_MAX_BYTES = 5 * 1024 * 1024
LOG_BACKUP_COUNT = 3

_SENSITIVE_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"(key=)[^&\s\"']+", re.IGNORECASE), r"\1[REDACTED]"),
    (re.compile(r"(Bearer\s+)[A-Za-z0-9._\-~+/=]+", re.IGNORECASE), r"\1[REDACTED]"),
    (re.compile(r"\bAIza[0-9A-Za-z\-_]{8,}"), "AIza[REDACTED]"),
    (
        re.compile(
            r"([\"']?(?:api_key|apiKey|authorization|x-goog-api-key)[\"']?\s*[:=]\s*[\"']?)([^\"'\s,}]+)",
            re.IGNORECASE,
        ),
        r"\1[REDACTED]",
    ),
)


def redact_sensitive_text(text: str) -> str:
    """Scrub API keys, query key parameters, and bearer tokens from log messages."""
    redacted = text
    for pattern, replacement in _SENSITIVE_PATTERNS:
        redacted = pattern.sub(replacement, redacted)
    return redacted


class LogRedactionFilter(logging.Filter):
    """Logging filter that formats and redacts secrets before handlers emit records."""

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            rendered = record.getMessage()
        except Exception:
            rendered = str(record.msg)
        record.msg = redact_sensitive_text(rendered)
        record.args = ()
        if record.exc_text:
            record.exc_text = redact_sensitive_text(record.exc_text)
        return True


class RedactingFormatter(logging.Formatter):
    """Formatter that scrubs secrets from both rendered messages and exception tracebacks."""

    def format(self, record: logging.LogRecord) -> str:
        return redact_sensitive_text(super().format(record))


def close_logging_handlers() -> None:
    """Flush and close all handlers attached to the application logger cleanly."""
    logger = logging.getLogger(LOGGER_NAME)
    for handler in list(logger.handlers):
        logger.removeHandler(handler)
        try:
            handler.flush()
        finally:
            handler.close()


def _attach_filter_once(handler: logging.Handler, redaction_filter: LogRedactionFilter) -> None:
    if not any(isinstance(existing, LogRedactionFilter) for existing in handler.filters):
        handler.addFilter(redaction_filter)


def _attach_logger_filter_once(target_logger: logging.Logger, redaction_filter: LogRedactionFilter) -> None:
    if not any(isinstance(existing, LogRedactionFilter) for existing in target_logger.filters):
        target_logger.addFilter(redaction_filter)


def configure_logging(data_dir: Path | None = None) -> logging.Logger:
    """Configure rotating file + console logging with mandatory secret redaction."""
    dirs = ensure_runtime_dirs(data_dir)
    close_logging_handlers()

    logger = logging.getLogger(LOGGER_NAME)
    logger.setLevel(logging.INFO)
    logger.propagate = False

    formatter = RedactingFormatter(
        fmt="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%SZ",
    )
    redaction_filter = LogRedactionFilter()

    file_handler = RotatingFileHandler(
        filename=dirs["logs"] / "research_studio.log",
        maxBytes=LOG_MAX_BYTES,
        backupCount=LOG_BACKUP_COUNT,
        encoding="utf-8",
    )
    file_handler.setFormatter(formatter)
    file_handler.addFilter(redaction_filter)

    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)
    stream_handler.addFilter(redaction_filter)

    logger.addHandler(file_handler)
    logger.addHandler(stream_handler)

    for third_party_name in ("httpx", "httpcore"):
        third_party_logger = logging.getLogger(third_party_name)
        third_party_logger.setLevel(logging.WARNING)
        _attach_logger_filter_once(third_party_logger, redaction_filter)

    for infra_logger in (logging.getLogger(), logging.getLogger("uvicorn"), logging.getLogger("uvicorn.error")):
        for handler in infra_logger.handlers:
            _attach_filter_once(handler, redaction_filter)

    return logger
