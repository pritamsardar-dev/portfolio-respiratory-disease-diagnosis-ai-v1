import threading
import uuid
from datetime import datetime

from utils.db import init_db, purge_old_jobs, insert_job, fetch_job, save_job

# cancel_event is a runtime object and cannot be serialised to the DB.
# It lives here in memory, keyed by job_id.
_cancel_events: dict[str, threading.Event] = {}
_lock = threading.Lock()

init_db()
purge_old_jobs(keep_hours=24)


def create_job() -> str:
    job_id = uuid.uuid4().hex
    insert_job(job_id, datetime.utcnow().isoformat())
    with _lock:
        _cancel_events[job_id] = threading.Event()
    return job_id


def get_job(job_id: str) -> dict | None:
    job = fetch_job(job_id)
    if job is None:
        return None
    with _lock:
        event = _cancel_events.get(job_id)
        if event is None:
            # Job was found in DB but server restarted attach a fresh event.
            # The job will already be marked failed by init_db, so this path
            # is only hit by the cancel endpoint on a stale job.
            event = threading.Event()
            _cancel_events[job_id] = event
    job["cancel_event"] = event
    return job


def update_job(job_id: str, **updates) -> None:
    save_job(
        job_id,
        status=updates.get("status"),
        steps=updates.get("processing_steps"),
        result=updates.get("result"),
        error=updates.get("error"),
    )
