# server/utils/jobs.py
"""
In-memory, thread-safe job store.

Drop-in replacement for utils/db.py -- zero disk I/O, zero SQLite overhead.
On Render free tier (slow overlay FS) every save_job() call was a blocking
disk sync; here it is a dict write under a Lock, which takes microseconds.

Trade-off: jobs disappear on server restart.
The client already handles this gracefully via the 404-recovery fix:
  "handle job 404 gracefully when server restarts during active polling"
so no client changes are needed.
"""

import threading
from datetime import datetime, timedelta
from typing import Optional

_lock = threading.Lock()
_jobs: dict = {}    # job_id -> job dict
_events: dict = {}  # job_id -> threading.Event  (cancel signal)


# Startup / maintenance  (keep signatures identical to utils/db.py)


def init_db() -> None:
    """No-op: on restart the dict is empty, which is correct.
    Any in-flight jobs will 404 and the client recovers automatically."""
    pass


def purge_old_jobs(keep_hours: int = 24) -> None:
    """Evict jobs older than keep_hours from the in-memory store."""
    cutoff = datetime.utcnow() - timedelta(hours=keep_hours)
    with _lock:
        stale = [
            jid for jid, job in _jobs.items()
            if datetime.fromisoformat(job["created_at"]) < cutoff
        ]
        for jid in stale:
            _jobs.pop(jid, None)
            _events.pop(jid, None)


# CRUD  (identical signatures to utils/db.py)

def insert_job(job_id: str, created_at: str) -> None:
    with _lock:
        _jobs[job_id] = {
            "id": job_id,
            "status": "queued",
            "steps": [],
            "result": None,
            "error": None,
            "created_at": created_at,
        }
        _events[job_id] = threading.Event()


def fetch_job(job_id: str) -> Optional[dict]:
    with _lock:
        job = _jobs.get(job_id)
        if job is None:
            return None
        return {
            "id": job["id"],
            "status": job["status"],
            "processing_steps": list(job["steps"]),
            "result": job["result"],
            "error": job["error"],
            "created_at": job["created_at"],
        }


def save_job(
    job_id: str,
    status: Optional[str] = None,
    steps: Optional[list] = None,
    result: Optional[dict] = None,
    error: Optional[str] = None,
) -> None:
    with _lock:
        job = _jobs.get(job_id)
        if job is None:
            return
        if status is not None:
            job["status"] = status
        if steps is not None:
            job["steps"] = list(steps)
        if result is not None:
            job["result"] = result
        if error is not None:
            job["error"] = error


def delete_job(job_id: str) -> None:
    with _lock:
        _jobs.pop(job_id, None)
        _events.pop(job_id, None) 


# Cancel-event helpers
# Replaces any ad-hoc _cancel_events = {} dict that lives in main.py.
# Call get_cancel_event() where you previously did _cancel_events.get(job_id)
# Call set_cancelled()    where you previously did _cancel_events[job_id].set()

def get_cancel_event(job_id: str) -> Optional[threading.Event]:
    """Return the cancel Event for job_id, or None if the job is unknown."""
    with _lock:
        return _events.get(job_id)


def set_cancelled(job_id: str) -> bool:
    """Signal cancellation. Returns True if the job existed."""
    with _lock:
        event = _events.get(job_id)
        if event is None:
            return False
        event.set()
        return True