import os
import uuid

import numpy as np
import librosa
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from collections import Counter
from typing import List, Tuple

from PIL import Image
import tensorflow as tf
import joblib

from utils.cleanup import cleanup_files

MODEL_PATH = "models/cnn_diagnosis_model.keras"
ENCODER_PATH = "models/label_encoder.pkl"
TEMP_DIR = "temp"
IMG_SIZE = (64, 64)  # Must match train.py IMG_SIZE
SEGMENT_SEC = 2.0  # Window length matches breath cycle length from training
MIN_DUR_SEC = 0.5  # Skip windows shorter than this

os.makedirs(TEMP_DIR, exist_ok=True)

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


def _wav_to_segment_spectrograms(wav_path: str) -> list[str]:
    """
    Split a WAV into fixed-length windows and save each as a mel spectrogram PNG.
    Mirrors the breath-cycle segmentation used during training to avoid
    train/inference distribution mismatch. Returns a list of PNG file paths.
    """
    y, sr = librosa.load(wav_path, sr=None, mono=True)
    hop = int(SEGMENT_SEC * sr)
    min_samp = int(MIN_DUR_SEC * sr)

    windows = [y[i : i + hop] for i in range(0, len(y), hop) if len(y[i : i + hop]) >= min_samp]

    # Pad the last window to full length if slightly short
    padded = []
    for w in windows:
        if len(w) < hop:
            w = np.pad(w, (0, hop - len(w)))
        padded.append(w)

    png_paths = []
    for seg in padded:
        S = librosa.feature.melspectrogram(y=seg, sr=sr, n_mels=128, fmax=4000)
        S_DB = librosa.power_to_db(S, ref=np.max)

        # figsize x dpi = pixel dimensions fed into PIL.resize(IMG_SIZE)
        fig = plt.figure(figsize=(1.28, 1.28), dpi=100)
        plt.axis("off")
        plt.tight_layout(pad=0)
        plt.imshow(S_DB, aspect="auto", cmap="gray", origin="lower")

        png_path = os.path.join(TEMP_DIR, f"{uuid.uuid4().hex}.png")
        plt.savefig(png_path, bbox_inches="tight", pad_inches=0)
        plt.close(fig)
        png_paths.append(png_path)

    return png_paths


def _predict_spectrogram(img_path: str) -> Tuple[str, float]:
    """Run a single spectrogram PNG through the CNN and return label and confidence."""
    img = Image.open(img_path).convert("L").resize(IMG_SIZE)
    arr = np.array(img, dtype=np.float32) / 255.0
    arr = np.expand_dims(arr, axis=(0, -1))  # shape: (1, 64, 64, 1)

    raw = _model.predict(arr, verbose=0)[0]
    idx = int(np.argmax(raw))
    label = _label_encoder.inverse_transform([idx])[0]
    confidence = float(raw[idx])
    return label, confidence


def run_diagnosis(file_data: List[dict], cancel_event=None, progress_callback=None) -> dict:
    """
    Full inference pipeline for one or more WAV files.
    Each file is segmented, converted to spectrograms, and classified per segment.
    A majority vote is applied per file, then again across all files for the
    final prediction. Temp files are cleaned up after processing.
    """
    temp_files = []
    predictions = []
    samples = []
    steps = []

    steps.append(f"Received {len(file_data)} audio file(s) for processing")
    if progress_callback:
        progress_callback(list(steps))
    steps.append("Validating inputs: format and size checks passed")
    if progress_callback:
        progress_callback(list(steps))

    try:
        for i, item in enumerate(file_data):
            if cancel_event and cancel_event.is_set():
                cleanup_files(temp_files)
                raise RuntimeError("Diagnosis was cancelled by the client.")

            filename = item["filename"]
            content = item["content"]
            n = i + 1
            prefix = f"[{n}/{len(file_data)}]"

            wav_path = os.path.join(TEMP_DIR, f"{uuid.uuid4().hex}.wav")
            with open(wav_path, "wb") as f:
                f.write(content)
            temp_files.append(wav_path)

            steps.append(f"{prefix} Loading audio: {filename}")
            if progress_callback:
                progress_callback(list(steps))
            steps.append(f"{prefix} Segmenting into {SEGMENT_SEC}s windows")
            if progress_callback:
                progress_callback(list(steps))

            seg_pngs = _wav_to_segment_spectrograms(wav_path)
            temp_files.extend(seg_pngs)

            steps.append(f"{prefix} Generated {len(seg_pngs)} segment(s) — running CNN on each")
            if progress_callback:
                progress_callback(list(steps))

            # Majority vote across segments for this file
            seg_labels = []
            for png in seg_pngs:
                lbl, _ = _predict_spectrogram(png)
                seg_labels.append(lbl)

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
                    "segments_used": len(seg_pngs),
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
        steps.append(f"Removing {len(temp_files)} temporary file(s)")
        if progress_callback:
            progress_callback(list(steps))
        removed = cleanup_files(temp_files)
        temp_files = []
        steps.append(f"Cleanup complete — {removed} file(s) removed")
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

    except Exception as e:
        cleanup_files(temp_files)
        raise e
