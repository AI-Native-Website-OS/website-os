"""AI 服务鉴权（双通道）。

- 浏览器管理端：携带后端签发的 JWT（HS256/384/512，密钥与 Java 端 JWT_SECRET 一致）。
- 服务间调用：Java 后端携带 X-Internal-Token（AI_INTERNAL_TOKEN），或退化为服务端 JWT。

公开接口（聊天、健康检查、只读的 config/prompt-config 等）不经过鉴权。
"""
import base64
import hashlib
import hmac
import json
import logging
import os
import time
from typing import Optional

from fastapi import HTTPException

logger = logging.getLogger("auth")

_ALGS = {
    "HS256": hashlib.sha256,
    "HS384": hashlib.sha384,
    "HS512": hashlib.sha512,
}


def _b64url_decode(seg: str) -> bytes:
    pad = "=" * (-len(seg) % 4)
    return base64.urlsafe_b64decode(seg + pad)


_B64_ALPHABET = frozenset(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
)


def _jaxb_base64_decode(secret: str) -> bytes:
    """复刻 JDK `DatatypeConverter.parseBase64Binary` 的语义（jjwt 0.9.x 对 String 密钥的默认解释）。

    与标准 Base64 解码器的关键差异：
    - 仅接受标准 Base64 字母表字符（`-`/`_` 等 URL-safe 字符被丢弃）；
    - 按 4 字符一组解码，末尾不足 4 字符的残缺分组直接忽略（即使有足够位可解出字节）。
    例如含 `-`/`_` 的密钥，Java 端得到的字节数会比 Python `b64decode` 少，导致 HMAC 验签失败。
    """
    filtered = "".join(ch for ch in secret if ch in _B64_ALPHABET or ch == "=")
    out = bytearray()
    for i in range(0, len(filtered) - len(filtered) % 4, 4):
        chunk = filtered[i:i + 4]
        try:
            out.extend(base64.b64decode(chunk))
        except Exception:
            return bytes(out)
        if "=" in chunk:
            break
    return bytes(out)


def _candidate_keys(secret: str) -> list:
    """HMAC 密钥候选：jjwt 0.9.x 对 JWT_SECRET 字符串先做 Base64 解码再签名，
    而旧版本/其他实现可能直接使用原始 UTF-8 字节或 Base64URL 解码；逐一尝试以兼容 Java 端。"""
    keys = [secret.encode("utf-8")]
    candidates = [
        # jjwt 0.9.x 实际行为（JAXB DatatypeConverter），必须优先匹配
        _jaxb_base64_decode(secret),
    ]
    # 标准 Base64（宽松：忽略非法字符）
    try:
        candidates.append(base64.b64decode(secret + "=" * (-len(secret) % 4), validate=False))
    except Exception:
        pass
    # Base64URL（-/_ 映射为 +/）
    try:
        candidates.append(base64.urlsafe_b64decode(secret + "=" * (-len(secret) % 4)))
    except Exception:
        pass
    for decoded in candidates:
        if decoded and decoded not in keys:
            keys.append(decoded)
    return keys


def verify_jwt(token: str, secret: str) -> dict:
    """校验 HS* 签名的 JWT，返回 payload；失败抛 ValueError。"""
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("malformed token")
    try:
        header = json.loads(_b64url_decode(parts[0]))
    except Exception as e:
        raise ValueError("malformed header") from e
    alg = header.get("alg", "")
    digest = _ALGS.get(alg)
    if digest is None:
        raise ValueError(f"unsupported alg: {alg}")
    signing_input = f"{parts[0]}.{parts[1]}".encode("ascii")
    try:
        actual = _b64url_decode(parts[2])
    except Exception as e:
        raise ValueError("malformed signature") from e
    verified = False
    for key in _candidate_keys(secret):
        expected = hmac.new(key, signing_input, digest).digest()
        if hmac.compare_digest(expected, actual):
            verified = True
            break
    if not verified:
        raise ValueError("bad signature")
    try:
        payload = json.loads(_b64url_decode(parts[1]))
    except Exception as e:
        raise ValueError("malformed payload") from e
    exp = payload.get("exp")
    if exp is not None and time.time() > float(exp):
        raise ValueError("token expired")
    return payload


def _jwt_secret() -> str:
    return (os.getenv("JWT_SECRET") or "").strip()


def _internal_token() -> str:
    return (os.getenv("AI_INTERNAL_TOKEN") or "").strip()


def authenticate(authorization: Optional[str], x_internal_token: Optional[str]) -> dict:
    """校验请求凭据，返回身份信息；无有效凭据时抛 HTTPException(401)。"""
    internal = _internal_token()
    if internal and x_internal_token and hmac.compare_digest(x_internal_token, internal):
        return {"type": "internal", "username": "system", "role": "system"}

    secret = _jwt_secret()
    if secret and authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
        try:
            payload = verify_jwt(token, secret)
        except ValueError as e:
            raise HTTPException(401, f"Invalid token: {e}")
        return {
            "type": "jwt",
            "username": payload.get("username") or payload.get("sub") or "",
            "role": payload.get("role") or "",
        }

    if not secret and not internal:
        logger.error("AI service auth is not configured (JWT_SECRET / AI_INTERNAL_TOKEN both empty)")
        raise HTTPException(503, "AI service authentication is not configured")
    raise HTTPException(401, "Authentication required")


def requires_auth(method: str, path: str) -> bool:
    """判断请求路径是否需要鉴权。"""
    if method.upper() == "OPTIONS":
        return False
    protected_prefixes = (
        "/ai/memory",
        "/ai/forbidden/examples",
        "/ai/forbidden/refresh-embeddings",
        "/ai/forbidden/detect",
        "/ai/rag-config",
        "/ai/knowledge-bases",
        "/ai/documents",
        "/ai/knowledge",
        "/ai/seo/generate",
        "/ai/catalog/reload",
        "/ai/stats",
        "/ai/token/logs",
        "/ai/models",
        "/ai/model-config",
    )
    if any(path == p or path.startswith(p + "/") for p in protected_prefixes):
        return True
    # 配置类接口：读取公开（前台聊天需要），写入需鉴权
    if path in ("/ai/config", "/ai/prompt-config"):
        return method.upper() not in ("GET", "HEAD", "OPTIONS")
    return False
