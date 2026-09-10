"""
Migration script:
1. Create all tables (DDL)
2. Migrate data from JSON files to PostgreSQL
"""

import json
import time
import os
from pathlib import Path
from datetime import datetime, timezone

from db import _engine, get_db
from models import Base, auto_upgrade, AiSession, AiMessage, AiTokenUsage, AiLongTermMemory


def create_tables():
    """Run DDL — create all tables."""
    eng = _engine()
    Base.metadata.create_all(eng)
    auto_upgrade(eng)
    print("[OK] Tables created / already exist.")


def drop_tables():
    """Drop all tables (for clean re-migration)."""
    Base.metadata.drop_all(_engine())
    print("[OK] Tables dropped.")


def migrate_sessions(session_dir: str = "sessions"):
    """Migrate sessions/*.json files to ai_session + ai_message tables."""
    path = Path(session_dir)
    if not path.exists():
        print(f"[SKIP] {session_dir}/ not found")
        return
    files = sorted(path.glob("*.json"))
    if not files:
        print(f"[SKIP] no JSON files in {session_dir}/")
        return

    count_s = 0
    count_m = 0
    for f in files:
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"[ERR] reading {f}: {e}")
            continue

        with get_db() as db:
            existing = db.get(AiSession, data["session_id"])
            if existing:
                print(f"[SKIP] session {data['session_id']} already exists")
                continue

            db.add(AiSession(
                session_id=data["session_id"],
                title=data.get("title", ""),
                system_prompt=data.get("system_prompt", ""),
                model=data.get("model", ""),
                created_at=data.get("created_at", time.time()),
                updated_at=data.get("updated_at", time.time()),
            ))
            for msg in data.get("messages", []):
                db.add(AiMessage(
                    session_id=data["session_id"],
                    role=msg.get("role", "user"),
                    content=msg.get("content", ""),
                    reasoning=msg.get("reasoning"),
                    timestamp=msg.get("timestamp", time.time()),
                ))
                count_m += 1
            count_s += 1
        print(f"  session {data['session_id'][:20]}... ({len(data.get('messages', []))} messages)")

    print(f"[OK] Migrated {count_s} sessions, {count_m} messages.")


def migrate_token_usage(token_file: str = "logs/token_usage.json"):
    """Migrate logs/token_usage.json to ai_token_usage table."""
    path = Path(token_file)
    if not path.exists():
        print(f"[SKIP] {token_file} not found")
        return

    try:
        entries = json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"[ERR] reading {token_file}: {e}")
        return

    if not entries:
        print(f"[SKIP] {token_file} is empty")
        return

    count = 0
    with get_db() as db:
        for e in entries:
            try:
                ts = datetime.fromisoformat(e["timestamp"]) if isinstance(e.get("timestamp"), str) else datetime.now(timezone.utc).replace(tzinfo=None)
            except Exception:
                ts = datetime.now(timezone.utc).replace(tzinfo=None)
            db.add(AiTokenUsage(
                session_id=e.get("session_id"),
                model=e.get("model", ""),
                prompt_tokens=e.get("prompt_tokens", 0),
                completion_tokens=e.get("completion_tokens", 0),
                total_tokens=e.get("total_tokens", 0),
                cost_usd=e.get("cost_usd", 0.0),
                timestamp=ts,
            ))
            count += 1
    print(f"[OK] Migrated {count} token usage records.")


def migrate_long_term_memory(memory_file: str = "memory/long_term_memory.json"):
    """Migrate memory/long_term_memory.json to ai_long_term_memory table."""
    path = Path(memory_file)
    if not path.exists():
        print(f"[SKIP] {memory_file} not found")
        return

    try:
        entries = json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"[ERR] reading {memory_file}: {e}")
        return

    if not entries:
        print(f"[SKIP] {memory_file} is empty")
        return

    count = 0
    with get_db() as db:
        for e in entries:
            db.add(AiLongTermMemory(
                session_id=e.get("session_id"),
                type=e.get("type", "summary"),
                content=e.get("content", ""),
                timestamp=e.get("timestamp", time.time()),
            ))
            count += 1
    print(f"[OK] Migrated {count} long-term memory records.")


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(description="AI Consultant DB migration")
    ap.add_argument("--drop", action="store_true", help="Drop existing tables first")
    ap.add_argument("--no-seed", action="store_true", help="Skip data migration from JSON files")
    args = ap.parse_args()

    if args.drop:
        drop_tables()
    create_tables()

    if not args.no_seed:
        migrate_sessions()
        migrate_token_usage()
        migrate_long_term_memory()

    print("\nDone.")
