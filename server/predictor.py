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
IMG_SIZE = (64, 64)  # Must match train.py IMG_SIZE
SEGMENT_SEC = 2.0  # Window length matches breath cycle length from training
MIN_DUR_SEC = 0.5  # Skip windows shorter than this

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
    Decode WAV bytes, split into fixed-length windows, and return a list of
    normalised float32 numpy arrays ready for model inference.

    Replaces the matplotlib figure and savefig path entirely. Each spectrogram
    is built with a direct numpy normalisation and a PIL resize, which takes
    roughly 1-3ms per segment on 0.1 CPU vs 100-300ms for a matplotlib PNG
    encode and decode cycle. np.flipud replicates matplotlib origin='lower'
    so the array layout is identical to what the model was trained on.
    """
    y, sr = librosa.load(io.BytesIO(wav_bytes), sr=None, mono=True)
    hop = int(SEGMENT_SEC * sr)
    min_samp = int(MIN_DUR_SEC * sr)

    arrays = []
    for i in range(0, len(y), hop):
        w = y[i : i + hop]
        if len(w) < min_samp:
            continue
        if len(w) < hop:
            w = np.pad(w, (0, hop - len(w)))

        S = librosa.feature.melspectrogram(y=w, sr=sr, n_mels=128, fmax=4000)
        S_DB = librosa.power_to_db(S, ref=np.max)

        lo, hi = S_DB.min(), S_DB.max()
        S_norm = (S_DB - lo) / (hi - lo + 1e-8)

        img = Image.fromarray(
            (np.flipud(S_norm) * 255).astype(np.uint8)
        ).resize(IMG_SIZE)
        arrays.append(np.array(img, dtype=np.float32) / 255.0)

    return arrays


def _batch_predict(arrays: list) -> list:
    """
    Run a single model.predict call for all segments of one file.

    Replaces N individual model.predict(batch_size=1) calls with one call
    of batch size N. TensorFlow session overhead is paid once per file
    instead of once per segment, which is the second largest time sink on
    the Render free tier after matplotlib rendering.
    Returns a list of (label, confidence) tuples in segment order.
    """
    batch = np.stack(
        [np.expand_dims(a, axis=-1) for a in arrays]
    )  # (N, H, W, 1)
    raw = _model.predict(batch, verbose=0)  # (N, n_classes)
    results = []
    for pred in raw:
        idx = int(np.argmax(pred))
        label = _label_encoder.inverse_transform([idx])[0]
        results.append((label, float(pred[idx])))
    return results


def run_diagnosis(file_data: List[dict], cancel_event=None, progress_callback=None) -> dict:
    """
    Full inference pipeline for one or more WAV files.
    Each file is segmented, converted to spectrograms, and classified per segment.
    A majority vote is applied per file, then again across all files for the
    final prediction. Everything runs in memory -- no temp files are written
    to disk, so there's nothing to clean up and no dependency on a writable
    "/tmp"-style directory existing on the host.
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
        n = i + 1
        prefix = f"[{n}/{len(file_data)}]"

        steps.append(f"{prefix} Loading and segmenting: {filename}")
        if progress_callback:
            progress_callback(list(steps))

        seg_arrays = _wav_to_segment_arrays(content)

        if not seg_arrays:
            raise RuntimeError(
                f"'{filename}' is too short to analyze (minimum {MIN_DUR_SEC}s)."
            )

        seg_preds = _batch_predict(seg_arrays)
        seg_labels = [label for label, _ in seg_preds]

        steps.append(f"{prefix} {len(seg_labels)} segment(s) classified in one batch")
        if progress_callback:
            progress_callback(list(steps))

        # Majority vote across segments for this file
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

    # Majority vote across all uploaded files for the final diagnosis
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
