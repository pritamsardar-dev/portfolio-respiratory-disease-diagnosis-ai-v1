from contextlib import asynccontextmanager
from typing import List

import asyncio
import gc
import threading
import time

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from predictor import load_models, run_diagnosis
import uuid
from datetime import datetime, timezone
from jobs import insert_job, fetch_job, save_job, delete_job, get_cancel_event, set_cancelled

MAX_FILES = 10
MAX_FILE_SIZE_MB = 10
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

# Render's free tier gives this app 512MB RAM. Running more than one
# diagnosis job at a time can exceed that, so jobs are processed strictly
# one at a time. New jobs still get a job_id immediately and report
# status "queued" until this semaphore is free.
_processing_semaphore = asyncio.Semaphore(1)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the CNN model once when the server starts
    load_models()
    yield


app = FastAPI(
    title="Pulmo AI API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://pulmoai.pritamsardar.dev",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "ok", "model": "loaded"}


async def run_job(job_id: str, file_data: list) -> None:
    async with _processing_semaphore:
        # The job may have been cancelled while it was waiting in the
        # queue behind another job -- don't overwrite that status.
        cancel_event = get_cancel_event(job_id)
        if cancel_event and cancel_event.is_set():
            return

        start_ts = time.time()

        try:
            save_job(job_id, status="running")

            def progress_callback(steps):
                save_job(job_id, steps=steps)

            result = await asyncio.to_thread(
                run_diagnosis,
                file_data,
                cancel_event,
                progress_callback,
            )

            processing_ms = (time.time() - start_ts) * 1000
            if processing_ms < 60_000:
                processing_time = f"{processing_ms / 1000:.1f}s"
            else:
                mins = int(processing_ms // 60_000)
                secs = int((processing_ms % 60_000) / 1000)
                processing_time = f"{mins}m {secs}s"

            result["processing_time_server"] = processing_time
            save_job(job_id, status="completed", result=result)

        except Exception as exc:
            save_job(job_id, status="failed", error=str(exc))

        finally:
            file_data.clear()
            gc.collect()


@app.get("/job/{job_id}")
def get_job_status(job_id: str):
    job = fetch_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    response = {
        "job_id": job_id,
        "status": job["status"],
        "created_at": job["created_at"],
        "processing_steps": job.get("processing_steps", []),
        "result": job["result"],
        "error": job["error"],
    }

    if job["status"] == "completed":
        delete_job(job_id)

    return response


@app.post("/job/{job_id}/cancel")
def cancel_job(job_id: str):
    job = fetch_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    set_cancelled(job_id)
    save_job(job_id, status="cancelled")
    return {"success": True}


@app.post("/predict")
async def predict(files: List[UploadFile] = File(...)):
    if len(files) == 0:
        raise HTTPException(status_code=400, detail="No files provided.")

    if len(files) > MAX_FILES:
        raise HTTPException(
            status_code=400, detail=f"Too many files. Maximum allowed is {MAX_FILES}."
        )

    # Read and validate every file before any processing starts
    file_data = []

    for upload in files:
        if not upload.filename.lower().endswith(".wav"):
            raise HTTPException(
                status_code=400,
                detail=f"'{upload.filename}' is not a WAV file. Only .wav format is accepted.",
            )

        content = await upload.read()

        if len(content) > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"'{upload.filename}' exceeds the {MAX_FILE_SIZE_MB}MB size limit.",
            )

        if len(content) == 0:
            raise HTTPException(status_code=400, detail=f"'{upload.filename}' is empty.")

        file_data.append(
            {
                "filename": upload.filename,
                "content": content,
            }
        )

    job_id = str(uuid.uuid4())
    insert_job(job_id, datetime.now(timezone.utc).isoformat())
    asyncio.create_task(run_job(job_id, file_data))
    return {"job_id": job_id, "status": "queued"}
