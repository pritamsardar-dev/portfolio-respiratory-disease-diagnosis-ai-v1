from contextlib import asynccontextmanager
from typing import List

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from predictor import load_models, run_diagnosis

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

    # Run the full spectrogram + CNN diagnosis pipeline
    try:
        result = run_diagnosis(file_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Diagnosis failed during processing: {str(e)}")

    return result
