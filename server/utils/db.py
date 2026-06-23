# Not currently used. jobs.py switched to an in-memory store for speed on Render.
# Swap this back in if you need jobs to survive server restarts.

import sqlite3
import json
import os
from typing import Optional

DB_PATH = os.environ.get("JOB_DB_PATH", "jobs.db")


def _connect() -> sqlite3.Connection:
    con = sqlite3.connect(DB_PATH, check_same_thread=False)
    con.execute("PRAGMA journal_mode=WAL")
    con.row_factory = sqlite3.Row
    return con


def init_db() -> None:
    with _connect() as con:
        con.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                id         TEXT PRIMARY KEY,
                status     TEXT NOT NULL DEFAULT 'queued',
                steps      TEXT NOT NULL DEFAULT '[]',
                result     TEXT,
                error      TEXT,
                created_at TEXT NOT NULL
            )
        """)
        # Any job that was mid-flight when the server last stopped cannot be recovered
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
            "INSERT INTO jobs (id, status, steps, created_at) VALUES (?, 'queued', '[]', ?)",
            (job_id, created_at),
        )
        con.commit()


def fetch_job(job_id: str) -> Optional[dict]:
    with _connect() as con:
        row = con.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
    if row is None:
        return None
    return {
        "id": row["id"],
        "status": row["status"],
        "processing_steps": json.loads(row["steps"]),
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
    fields, params = [], []
    if status is not None:
        fields.append("status = ?")
        params.append(status)
    if steps is not None:
        fields.append("steps = ?")
        params.append(json.dumps(steps))
    if result is not None:
        fields.append("result = ?")
        params.append(json.dumps(result))
    if error is not None:
        fields.append("error = ?")
        params.append(error)
    if not fields:
        return
    params.append(job_id)
    with _connect() as con:
        con.execute(f"UPDATE jobs SET {', '.join(fields)} WHERE id = ?", params)
        con.commit()


def delete_job(job_id: str) -> None:
    with _connect() as con:
        con.execute("DELETE FROM jobs WHERE id = ?", (job_id,))
        con.commit()
