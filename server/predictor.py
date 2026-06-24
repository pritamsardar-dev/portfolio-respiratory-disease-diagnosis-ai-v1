# predictor.py

import gc
import io
import os

import numpy as np
import librosa
from collections import Counter
from typing import List

from PIL import Image
import tensorflow as tf
import joblib

MODEL_PATH = "models/cnn_diagnosis_model.keras"
ENCODER_PATH = "models/label_encoder.pkl"
IMG_SIZE = (64, 64)
SEGMENT_SEC = 2.0
MIN_DUR_SEC = 0.5

# Default hop length used by librosa.feature.melspectrogram.
# Kept explicit here so frame count math matches what librosa uses internally.
_HOP_LENGTH = 512

# Number of segments per model.predict call.
# A fixed chunk size keeps the tensor shape constant across all files so
# TensorFlow pool allocation stabilizes instead of growing each time a new
# batch shape is seen from a file with a different number of segments.
PREDICT_BATCH_SIZE = 8

_model = None
_label_encoder = None

DISEASE_INFO = {
    "healthy": {
        "description": "No significant respiratory abnormalities detected.",
        "severity": "normal",
        "recommendation": "Continue routine health monitoring. No immediate action required.",
    },
    "copd": {
        "description": "Chronic Obstructive Pulmonary Disease patterns detected.",
        "severity": "high",
        "recommendation": "Consult a pulmonologist for spirometry testing and further evaluation.",
    },
    "asthma": {
        "description": "Asthma indicators detected. Characteristic wheezing patterns present.",
        "severity": "moderate",
        "recommendation": "Bronchodilator therapy may be indicated. Consult a respiratory specialist.",
    },
    "bronchiectasis": {
        "description": "Bronchiectasis patterns detected. Abnormal bronchial dilation indicated.",
        "severity": "high",
        "recommendation": "Follow-up imaging and specialist referral are recommended.",
    },
    "urti": {
        "description": "Upper Respiratory Tract Infection signs detected.",
        "severity": "moderate",
        "recommendation": "Rest and hydration advised. Consult a GP if symptoms persist.",
    },
    "pneumonia": {
        "description": "Pneumonia indicators detected. Significant lung abnormalities present.",
        "severity": "high",
        "recommendation": "Urgent medical evaluation advised. Seek immediate clinical assessment.",
    },
    "bronchiolitis": {
        "description": "Bronchiolitis patterns detected. Small airway inflammation indicated.",
        "severity": "moderate",
        "recommendation": "Monitor oxygen saturation closely. Consult a specialist if applicable.",
    },
    "lrti": {
        "description": "Lower Respiratory Tract Infection patterns detected.",
        "severity": "moderate",
        "recommendation": "Medical evaluation advised. Consult a GP or pulmonologist.",
    },
}


def load_models():
    global _model, _label_encoder

    if not os.path.exists(MODEL_PATH):
        raise RuntimeError(f"Model file not found: {MODEL_PATH}")
    if not os.path.exists(ENCODER_PATH):
        raise RuntimeError(f"Label encoder not found: {ENCODER_PATH}")

    _model = tf.keras.models.load_model(MODEL_PATH)
    _label_encoder = joblib.load(ENCODER_PATH)
    print(f"Model loaded from {MODEL_PATH}")
    print(f"Classes: {list(_label_encoder.classes_)}")


def _wav_to_segment_arrays(wav_bytes: bytes) -> list:
    """
    Decode WAV bytes, compute the mel power spectrogram once for the full
    audio, then slice into fixed length frame windows and process each window.

    Previously melspectrogram was called once per segment, meaning N STFT
    computations per file. Now one STFT runs for the full signal and segments
    are cut from the resulting power matrix. Power to dB conversion still uses
    each segment's own max as the reference, same as before, so the array
    values going into the model are identical to the old per segment approach.
    On Render free tier at 0.1 CPU the STFT is the single largest cost per file.
    """
    y, sr = librosa.load(io.BytesIO(wav_bytes), sr=None, mono=True)

    # One STFT for the full audio instead of one per segment
    S_full = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=128, fmax=4000)
    del y  # free raw audio array before segment loop, no longer needed

    frames_per_seg = int(np.ceil(SEGMENT_SEC * sr / _HOP_LENGTH))
    min_frames = int(np.ceil(MIN_DUR_SEC * sr / _HOP_LENGTH))

    arrays = []
    for start in range(0, S_full.shape[1], frames_per_seg):
        seg = S_full[:, start : start + frames_per_seg]

        if seg.shape[1] < min_frames:
            continue
        if seg.shape[1] < frames_per_seg:
            seg = np.pad(seg, ((0, 0), (0, frames_per_seg - seg.shape[1])))

        # Per segment dB conversion with segment local max, same ref as before
        S_DB = librosa.power_to_db(seg, ref=np.max)

        lo, hi = S_DB.min(), S_DB.max()
        S_norm = (S_DB - lo) / (hi - lo + 1e-8)

        img = Image.fromarray(
            (np.flipud(S_norm) * 255).astype(np.uint8)
        ).resize(IMG_SIZE)
        arrays.append(np.array(img, dtype=np.float32) / 255.0)

    del S_full  # free mel matrix after all segments are sliced
    return arrays


def _batch_predict(arrays: list) -> list:
    """
    Run model inference in fixed size mini batches.

    Splitting into chunks of PREDICT_BATCH_SIZE instead of one large call per
    file keeps the tensor shape passed to model.predict constant regardless of
    how many segments each file produces. TensorFlow pool allocation stabilizes
    at the fixed chunk size and is reused on every call rather than growing
    each time a different batch shape is seen across files.
    Returns a list of (label, confidence) tuples in segment order.
    """
    results = []
    for i in range(0, len(arrays), PREDICT_BATCH_SIZE):
        chunk = arrays[i : i + PREDICT_BATCH_SIZE]
        batch = np.stack([np.expand_dims(a, axis=-1) for a in chunk])
        raw = _model.predict(batch, verbose=0)
        for pred in raw:
            idx = int(np.argmax(pred))
            label = _label_encoder.inverse_transform([idx])[0]
            results.append((label, float(pred[idx])))
        del batch, raw
    return results


def run_diagnosis(file_data: List[dict], cancel_event=None, progress_callback=None) -> dict:
    """
    Full inference pipeline for one or more WAV files.
    Each file is segmented, converted to spectrograms, and classified per segment.
    A majority vote is applied per file, then again across all files for the
    final prediction. Everything runs in memory, no temp files are written to disk.
    """
    predictions = []
    samples = []
    steps = []

    steps.append(f"Received {len(file_data)} audio file(s) for processing")
    if progress_callback:
        progress_callback(list(steps))
    steps.append("Validating inputs: format and size checks passed")
    if progress_callback:
        progress_callback(list(steps))

    for i, item in enumerate(file_data):
        if cancel_event and cancel_event.is_set():
            raise RuntimeError("Diagnosis was cancelled by the client.")

        filename = item["filename"]
        content = item["content"]

        # Release the raw bytes reference after reading so the GC can reclaim
        # that memory before the next file is processed. On the 512MB Render
        # free tier this matters when several large files are in the same job.
        item["content"] = None

        n = i + 1
        prefix = f"[{n}/{len(file_data)}]"

        steps.append(f"{prefix} Loading and segmenting: {filename}")
        if progress_callback:
            progress_callback(list(steps))

        seg_arrays = _wav_to_segment_arrays(content)

        # Allow GC to free the decoded audio bytes now that arrays are built
        content = None

        if not seg_arrays:
            raise RuntimeError(
                f"'{filename}' is too short to analyze (minimum {MIN_DUR_SEC}s)."
            )

        seg_preds = _batch_predict(seg_arrays)
        del seg_arrays  # free segment arrays once predictions are complete
        seg_labels = [label for label, _ in seg_preds]

        steps.append(f"{prefix} {len(seg_labels)} segment(s) classified")
        if progress_callback:
            progress_callback(list(steps))

        file_label = Counter(seg_labels).most_common(1)[0][0]
        file_confidence = seg_labels.count(file_label) / len(seg_labels)
        predictions.append(file_label)

        steps.append(
            f"{prefix} File prediction: {file_label} "
            f"({seg_labels.count(file_label)}/{len(seg_labels)} segments agree)"
        )
        if progress_callback:
            progress_callback(list(steps))
        samples.append(
            {
                "filename": filename,
                "prediction": file_label,
                "confidence": round(file_confidence, 4),
                "segments_used": len(seg_labels),
            }
        )

        gc.collect()  # reclaim memory from this file before loading the next

    steps.append("Aggregating across all files via majority voting")
    if progress_callback:
        progress_callback(list(steps))
    final_prediction = Counter(predictions).most_common(1)[0][0]

    info = DISEASE_INFO.get(
        final_prediction.lower(),
        {
            "description": "Condition not in knowledge base.",
            "severity": "unknown",
            "recommendation": "Consult a qualified medical professional.",
        },
    )

    steps.append(f"Final diagnosis: {final_prediction}")
    if progress_callback:
        progress_callback(list(steps))
    steps.append("Processing finished successfully")
    if progress_callback:
        progress_callback(list(steps))

    return {
        "success": True,
        "final_prediction": final_prediction,
        "description": info["description"],
        "severity": info["severity"],
        "recommendation": info["recommendation"],
        "samples": samples,
        "total_samples": len(file_data),
        "processing_steps": steps,
    }