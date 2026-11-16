from __future__ import annotations

import ctypes
from ctypes import wintypes
import os
from typing import Any

from fastapi import Request

from app.core.errors import AppError

CSRF_HEADER_NAME = "X-Research-Studio-Client"
CSRF_HEADER_VALUE = "local-web"
MUTATING_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})

_CRYPTPROTECT_UI_FORBIDDEN = 0x01


class DpapiUnreadableError(Exception):
    """Raised when DPAPI cannot decrypt a stored ciphertext blob for the current Windows user."""


class _DataBlob(ctypes.Structure):
    _fields_ = [
        ("cbData", wintypes.DWORD),
        ("pbData", ctypes.POINTER(ctypes.c_ubyte)),
    ]


def _get_win32_dpapi_funcs() -> tuple[Any, Any]:
    if os.name != "nt":
        raise RuntimeError("Windows DPAPI is only supported on Windows.")
    crypt32 = ctypes.windll.crypt32
    kernel32 = ctypes.windll.kernel32

    crypt32.CryptProtectData.argtypes = [
        ctypes.POINTER(_DataBlob),
        wintypes.LPCWSTR,
        ctypes.POINTER(_DataBlob),
        ctypes.c_void_p,
        ctypes.c_void_p,
        wintypes.DWORD,
        ctypes.POINTER(_DataBlob),
    ]
    crypt32.CryptProtectData.restype = wintypes.BOOL

    crypt32.CryptUnprotectData.argtypes = [
        ctypes.POINTER(_DataBlob),
        ctypes.POINTER(wintypes.LPWSTR),
        ctypes.POINTER(_DataBlob),
        ctypes.c_void_p,
        ctypes.c_void_p,
        wintypes.DWORD,
        ctypes.POINTER(_DataBlob),
    ]
    crypt32.CryptUnprotectData.restype = wintypes.BOOL

    kernel32.LocalFree.argtypes = [wintypes.HLOCAL]
    kernel32.LocalFree.restype = wintypes.HLOCAL
    return crypt32, kernel32


def _make_input_blob(data: bytes) -> tuple[_DataBlob, ctypes.Array[ctypes.c_ubyte]]:
    buf = (ctypes.c_ubyte * len(data)).from_buffer_copy(data)
    return _DataBlob(len(data), buf), buf


def dpapi_protect(plaintext: bytes) -> bytes:
    """Encrypt bytes for the current Windows user via CryptProtectData and free Win32 heap memory."""
    if not plaintext:
        return b""
    crypt32, kernel32 = _get_win32_dpapi_funcs()
    in_blob, _buf_guard = _make_input_blob(plaintext)
    out_blob = _DataBlob()
    ok = crypt32.CryptProtectData(
        ctypes.byref(in_blob),
        "ResearchStudioSecret",
        None,
        None,
        None,
        _CRYPTPROTECT_UI_FORBIDDEN,
        ctypes.byref(out_blob),
    )
    if not ok:
        raise ctypes.WinError()
    try:
        return ctypes.string_at(out_blob.pbData, out_blob.cbData)
    finally:
        if out_blob.pbData:
            kernel32.LocalFree(out_blob.pbData)


def dpapi_unprotect(ciphertext: bytes) -> bytes:
    """Decrypt bytes protected via DPAPI for the current Windows user, freeing Win32 buffers safely."""
    if not ciphertext:
        raise DpapiUnreadableError("Empty DPAPI payload")
    crypt32, kernel32 = _get_win32_dpapi_funcs()
    in_blob, _buf_guard = _make_input_blob(ciphertext)
    out_blob = _DataBlob()
    descr_ptr = wintypes.LPWSTR()
    ok = crypt32.CryptUnprotectData(
        ctypes.byref(in_blob),
        ctypes.byref(descr_ptr),
        None,
        None,
        None,
        _CRYPTPROTECT_UI_FORBIDDEN,
        ctypes.byref(out_blob),
    )
    if descr_ptr:
        kernel32.LocalFree(descr_ptr)
    if not ok:
        raise DpapiUnreadableError("Failed to decrypt DPAPI blob for current Windows account")
    try:
        return ctypes.string_at(out_blob.pbData, out_blob.cbData)
    finally:
        if out_blob.pbData:
            kernel32.LocalFree(out_blob.pbData)


def mask_api_key(raw_key: str) -> str:
    """Return a redacted preview of an API key (e.g., AIza...9x2A) for UI status responses."""
    cleaned = raw_key.strip()
    if len(cleaned) <= 8:
        return "***"
    return f"{cleaned[:4]}...{cleaned[-4:]}"


def verify_local_csrf_and_origin(request: Request, allowed_origins: set[str]) -> None:
    """Block drive-by localhost CSRF on mutating /api/v1/* requests."""
    if request.method.upper() not in MUTATING_METHODS:
        return
    if not request.url.path.startswith("/api/v1"):
        return

    origin = request.headers.get("origin")
    if origin is not None and origin not in allowed_origins:
        raise AppError(
            code="CSRF_ORIGIN_FORBIDDEN",
            message="Nguồn gọi (Origin) không thuộc địa chỉ localhost cho phép.",
            status_code=403,
            details={"origin": origin},
        )

    client_header = request.headers.get(CSRF_HEADER_NAME)
    if client_header != CSRF_HEADER_VALUE:
        raise AppError(
            code="CSRF_HEADER_MISSING",
            message="Thiếu header xác thực client cục bộ hợp lệ.",
            status_code=403,
            details={"requiredHeader": CSRF_HEADER_NAME},
        )
