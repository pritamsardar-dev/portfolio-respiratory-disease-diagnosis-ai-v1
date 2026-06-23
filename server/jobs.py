# Hybrid job store: SQLite for durable state, memory for live progress steps.
# SQLite writes only on status transitions, roughly 4 writes per job total.
# Steps are in-memory only so progress callbacks never touch disk.
# Cancel events are in-memory only, cancellation does not need to survive restarts.

import sqlite3
import json
import os
import threading
from datetime import datetime, timedelta
from typing import Optional

DB_PATH = os.environ.get("JOB_DB_PATH", "jobs.db")

_lock = threading.Lock()
_steps: dict = {}   # job_id -> list[str], in-memory only, never written to disk
_events: dict = {}  # job_id -> threading.Event, cancel signal, in-memory only


def _connect() -> sqlite3.Connection:
    con = sqlite3.connect(DB_PATH, check_same_thread=False)
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA synchronous=NORMAL")  # safe with WAL, faster than FULL
    con.row_factory = sqlite3.Row
    return con


def init_db() -> None:
    with _connect() as con:
        con.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                id         TEXT PRIMARY KEY,
                status     TEXT NOT NULL DEFAULT 'queued',
                result     TEXT,
                error      TEXT,
                created_at TEXT NOT NULL
            )
        """)
        # Any job mid-flight when the server stopped cannot be recovered
        con.execute(
            "UPDATE jobs SET status = 'failed', error = 'Server restarted during processing' "
            "WHERE status IN ('queued', 'running')"
        )
        con.commit()


def purge_old_jobs(keep_hours: int = 24) -> None:
    with _connect() as con:
        con.execute(
            "DELETE FROM jobs WHERE created_at < datetime('now', ?)",
            (f"-{keep_hours} hours",),
        )
        con.commit()


def insert_job(job_id: str, created_at: str) -> None:
    with _connect() as con:
        con.execute(
            "INSERT INTO jobs (id, status, created_at) VALUES (?, 'queued', ?)",
            (job_id, created_at),
        )
        con.commit()
    with _lock:
        _steps[job_id] = []
        _events[job_id] = threading.Event()


def fetch_job(job_id: str) -> Optional[dict]:
    with _connect() as con:
        row = con.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
    if row is None:
        return None
    with _lock:
        steps = list(_steps.get(job_id, []))
    return {
        "id": row["id"],
        "status": row["status"],
        "processing_steps": steps,
        "result": json.loads(row["result"]) if row["result"] else None,
        "error": row["error"],
        "created_at": row["created_at"],
    }


def save_job(
    job_id: str,
    status: Optional[str] = None,
    steps: Optional[list] = None,
    result: Optional[dict] = None,
    error: Optional[str] = None,
) -> None:
    # Steps go to memory only, no disk write ever
    if steps is not None:
        with _lock:
            if job_id in _steps:
                _steps[job_id] = list(steps)

    # Status, result, error go to SQLite on state transitions only
    db_fields, db_params = [], []
    if status is not None:
        db_fields.append("status = ?")
        db_params.append(status)
    if result is not None:
        db_fields.append("result = ?")
        db_params.append(json.dumps(result))
    if error is not None:
        db_fields.append("error = ?")
        db_params.append(error)
    if db_fields:
        db_params.append(job_id)
        with _connect() as con:
            con.execute(
                f"UPDATE jobs SET {', '.join(db_fields)} WHERE id = ?", db_params
            )
            con.commit()


def delete_job(job_id: str) -> None:
    with _connect() as con:
        con.execute("DELETE FROM jobs WHERE id = ?", (job_id,))
        con.commit()
    with _lock:
        _steps.pop(job_id, None)
        _events.pop(job_id, None)


def get_cancel_event(job_id: str) -> Optional[threading.Event]:
    with _lock:
        return _events.get(job_id)


def set_cancelled(job_id: str) -> bool:
    with _lock:
        event = _events.get(job_id)
        if event is None:
            return False
        event.set()
        return True