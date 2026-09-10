import base64
import hashlib
import hmac
import json
import os
import time

import pytest
from fastapi import HTTPException

from auth import authenticate, requires_auth, verify_jwt


def _b64u(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _make_token(secret: str, key: bytes, username: str = "admin", exp_delta: int = 3600) -> str:
    header = {"alg": "HS512", "typ": "JWT"}
    payload = {
        "userId": 1, "username": username, "role": "ADMIN", "tokenVersion": 0,
        "sub": username, "iat": int(time.time()), "exp": int(time.time()) + exp_delta,
    }
    signing_input = _b64u(json.dumps(header, separators=(",", ":")).encode("ascii")) + "." + \
        _b64u(json.dumps(payload, separators=(",", ":")).encode("ascii"))
    sig = _b64u(hmac.new(key, signing_input.encode("ascii"), hashlib.sha512).digest())
    return signing_input + "." + sig


def test_verify_jwt_base64_key(monkeypatch):
    secret = base64.b64encode(b"k" * 32).decode("ascii")
    token = _make_token(secret, base64.b64decode(secret))
    payload = verify_jwt(token, secret)
    assert payload["username"] == "admin"


def test_verify_jwt_raw_key(monkeypatch):
    token = _make_token("raw-secret", b"raw-secret")
    payload = verify_jwt(token, "raw-secret")
    assert payload["role"] == "ADMIN"


def test_verify_jwt_bad_signature():
    token = _make_token("secret-a", b"secret-a")
    with pytest.raises(ValueError):
        verify_jwt(token, "secret-b")


def test_verify_jwt_expired():
    secret = base64.b64encode(b"k" * 32).decode("ascii")
    token = _make_token(secret, base64.b64decode(secret), exp_delta=-10)
    with pytest.raises(ValueError):
        verify_jwt(token, secret)


def test_authenticate_internal_token(monkeypatch):
    monkeypatch.setenv("AI_INTERNAL_TOKEN", "tok-123")
    monkeypatch.delenv("JWT_SECRET", raising=False)
    identity = authenticate(None, "tok-123")
    assert identity["type"] == "internal"
    with pytest.raises(HTTPException) as ei:
        authenticate(None, "wrong")
    assert ei.value.status_code == 401


def test_authenticate_jwt(monkeypatch):
    secret = "raw-secret"
    monkeypatch.setenv("JWT_SECRET", secret)
    monkeypatch.delenv("AI_INTERNAL_TOKEN", raising=False)
    token = _make_token(secret, secret.encode("utf-8"))
    identity = authenticate(f"Bearer {token}", None)
    assert identity["type"] == "jwt"
    assert identity["username"] == "admin"


def test_authenticate_no_credentials():
    with pytest.raises(HTTPException) as ei:
        authenticate(None, None)
    assert ei.value.status_code in (401, 503)


def test_requires_auth_rules():
    assert requires_auth("GET", "/ai/memory/search") is True
    assert requires_auth("DELETE", "/ai/memory") is True
    assert requires_auth("GET", "/ai/knowledge-bases") is True
    assert requires_auth("POST", "/ai/knowledge/sync-document") is True
    assert requires_auth("POST", "/ai/seo/generate") is True
    assert requires_auth("POST", "/ai/config") is True
    assert requires_auth("GET", "/ai/config") is False
    assert requires_auth("POST", "/ai/prompt-config") is True
    assert requires_auth("GET", "/ai/prompt-config") is False
    assert requires_auth("POST", "/ai/chat") is False
    assert requires_auth("GET", "/ai/health") is False
    assert requires_auth("OPTIONS", "/ai/knowledge-bases") is False