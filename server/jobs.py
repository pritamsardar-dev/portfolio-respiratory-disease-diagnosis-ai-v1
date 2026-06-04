import threading
import uuid
from datetime import datetime

jobs: dict = {}
jobs_lock = threading.Lock()


def create_job() -> str:
    job_id = uuid.uuid4().hex
    with jobs_lock:
        jobs[job_id] = {
            "id": job_id,
            "status": "queued",
            "created_at": datetime.utcnow().isoformat(),
            "processing_steps": [],
            "result": None,
            "error": None,
            "cancel_event": threading.Event(),
        }
    return job_id


def get_job(job_id: str) -> dict | None:
    return jobs.get(job_id)


def update_job(job_id: str, **updates) -> None:
    with jobs_lock:
        if job_id in jobs:
            jobs[job_id].update(updates)
