"""AI 顾问限流器

限流参数（登录用户每分钟请求数 / 游客每日免费次数）从 system_configs
表读取（管理后台「系统配置」页维护），未配置时回退环境变量，再回退默认值。

计数存储优先 Redis（跨 uvicorn 多 worker 共享），Redis 不可用时降级为
进程内内存计数（尽力而为）。
"""

import logging
import os
import threading
import time
import uuid
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple

from sqlalchemy import select

from db import get_db, get_redis
from models import SystemConfig

logger = logging.getLogger(__name__)

# ── 默认值 ──────────────────────────────────────────────────────────
DEFAULT_USER_RATE_LIMIT = 30
DEFAULT_USER_RATE_WINDOW = 60
DEFAULT_GUEST_DAILY_LIMIT = 5

# ── system_configs 中的 key ────────────────────────────────────────
CONFIG_KEY_USER_LIMIT = "ai_user_rate_limit"
CONFIG_KEY_GUEST_LIMIT = "ai_guest_daily_limit"

# ── 环境变量回退 ────────────────────────────────────────────────────
ENV_USER_LIMIT = "AI_USER_RATE_LIMIT"
ENV_GUEST_LIMIT = "AI_GUEST_DAILY_LIMIT"


class RateLimiter:
    def __init__(self):
        self._limits_cache: Optional[Dict[str, int]] = None
        self._limits_cache_time: float = 0.0
        self._limits_cache_ttl: float = 30.0

        self._mem_lock = threading.Lock()
        # 内存回退状态
        self._mem_user: Dict[str, list] = {}
        self._mem_guest: Dict[str, int] = {}
        self._mem_guest_day: Dict[str, str] = {}

    # ── 限流参数读取 ─────────────────────────────────────────────
    @staticmethod
    def _env_positive_int(name: str) -> Optional[int]:
        raw = os.getenv(name)
        if raw and raw.strip().isdigit() and int(raw) > 0:
            return int(raw)
        return None

    def _load_db_limits(self) -> Tuple[int, int, bool, bool]:
        user_limit = DEFAULT_USER_RATE_LIMIT
        guest_limit = DEFAULT_GUEST_DAILY_LIMIT
        db_user = False
        db_guest = False
        try:
            with get_db() as db:
                rows = db.execute(
                    select(SystemConfig).where(
                        SystemConfig.config_key.in_([CONFIG_KEY_USER_LIMIT, CONFIG_KEY_GUEST_LIMIT])
                    )
                ).scalars().all()
                for r in rows:
                    try:
                        val = int(r.config_value)
                    except (TypeError, ValueError):
                        continue
                    if r.config_key == CONFIG_KEY_USER_LIMIT and val > 0:
                        user_limit = val
                        db_user = True
                    elif r.config_key == CONFIG_KEY_GUEST_LIMIT and val > 0:
                        guest_limit = val
                        db_guest = True
        except Exception as e:
            logger.warning("读取限流配置失败，使用回退值: %s", e)
        return user_limit, guest_limit, db_user, db_guest

    def get_limits(self) -> Dict[str, int]:
        """返回 {user_limit, guest_limit}。优先级：DB > 环境变量 > 默认值。"""
        now = time.time()
        if self._limits_cache and (now - self._limits_cache_time) < self._limits_cache_ttl:
            return self._limits_cache

        user_limit, guest_limit, db_user, db_guest = self._load_db_limits()
        if not db_user:
            env_user = self._env_positive_int(ENV_USER_LIMIT)
            if env_user is not None:
                user_limit = env_user
        if not db_guest:
            env_guest = self._env_positive_int(ENV_GUEST_LIMIT)
            if env_guest is not None:
                guest_limit = env_guest

        self._limits_cache = {"user_limit": user_limit, "guest_limit": guest_limit}
        self._limits_cache_time = now
        return self._limits_cache

    def invalidate_cache(self):
        """配置变更后调用，强制下次重新读取。"""
        self._limits_cache = None

    # ── 登录用户：滑动窗口限流 ──────────────────────────────────
    def check_user(self, username: str) -> Tuple[bool, int]:
        """返回 (是否允许, 剩余可用次数)。滑动窗口 window 秒内最多 user_limit 次。"""
        limits = self.get_limits()
        limit = limits["user_limit"]
        window = DEFAULT_USER_RATE_WINDOW
        now = time.time()

        r = get_redis()
        if r is not None:
            key = f"ai:rl:user:{username}"
            try:
                with r.pipeline() as pipe:
                    pipe.zremrangebyscore(key, 0, now - window)
                    pipe.zcard(key)
                    results = pipe.execute()
                count = int(results[1])
                if count >= limit:
                    return False, 0
                with r.pipeline() as pipe:
                    pipe.zadd(key, {f"{now}:{uuid.uuid4()}": now})
                    pipe.expire(key, window + 60)
                    pipe.execute()
                return True, max(0, limit - count - 1)
            except Exception as e:
                logger.warning("Redis 限流检查失败，降级内存: %s", e)

        with self._mem_lock:
            ts_list = [t for t in self._mem_user.get(username, []) if t > now - window]
            if len(ts_list) >= limit:
                self._mem_user[username] = ts_list
                return False, 0
            ts_list.append(now)
            self._mem_user[username] = ts_list
            return True, max(0, limit - len(ts_list))

    # ── 游客：每日次数限流 ──────────────────────────────────────
    def check_guest(self, visitor_id: str) -> Tuple[bool, int]:
        """返回 (是否允许, 剩余可用次数)。每日最多 guest_limit 次，当日午夜清零。"""
        limits = self.get_limits()
        limit = limits["guest_limit"]
        day = datetime.now().strftime("%Y%m%d")
        key = f"ai:rl:guest:{visitor_id}:{day}"

        r = get_redis()
        if r is not None:
            try:
                count = r.incr(key)
                if count == 1:
                    now = datetime.now()
                    midnight = (now + timedelta(days=1)).replace(
                        hour=0, minute=0, second=0, microsecond=0
                    )
                    ttl = int((midnight - now).total_seconds()) + 60
                    r.expire(key, ttl)
                if count > limit:
                    return False, 0
                return True, max(0, limit - count)
            except Exception as e:
                logger.warning("Redis 游客限流检查失败，降级内存: %s", e)

        with self._mem_lock:
            if self._mem_guest_day.get(visitor_id) != day:
                self._mem_guest[visitor_id] = 0
                self._mem_guest_day[visitor_id] = day
            count = self._mem_guest.get(visitor_id, 0) + 1
            self._mem_guest[visitor_id] = count
            if count > limit:
                return False, 0
            return True, max(0, limit - count)


_limiter: Optional[RateLimiter] = None


def get_rate_limiter() -> RateLimiter:
    global _limiter
    if _limiter is None:
        _limiter = RateLimiter()
    return _limiter
