from contextlib import asynccontextmanager
from typing import List

import asyncio
import threading
import time

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from predictor import load_models, run_diagnosis
from jobs import create_job, get_job, update_job

MAX_FILES = 10
MAX_FILE_SIZE_MB = 10
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024


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
    job = get_job(job_id)
    start_ts = time.time()

    try:
        update_job(job_id, status="running")

        def progress_callback(steps):
            update_job(job_id, processing_steps=steps)

        result = await asyncio.to_thread(
            run_diagnosis,
            file_data,
            job["cancel_event"],
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
        update_job(job_id, status="completed", result=result)

    except Exception as exc:
        update_job(job_id, status="failed", error=str(exc))


@app.get("/job/{job_id}")
def get_job_status(job_id: str):
    job = get_job(job_id)
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
        from utils.db import delete_job

        delete_job(job_id)

    return response


@app.post("/job/{job_id}/cancel")
def cancel_job(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job["cancel_event"].set()
    update_job(job_id, status="cancelled")
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

    job_id = create_job()
    asyncio.create_task(run_job(job_id, file_data))
    return {"job_id": job_id, "status": "queued"}
