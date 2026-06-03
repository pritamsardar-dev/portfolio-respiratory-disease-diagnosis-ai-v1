import os
import uuid

import numpy as np
import librosa
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt


def generate_mel_spectrogram(wav_path: str, out_dir: str) -> str:
    # Load at native sample rate to preserve original audio fidelity
    y, sr = librosa.load(wav_path, sr=None)

    # Match training preprocess.py params exactly
    S = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=128, fmax=4000)
    S_DB = librosa.power_to_db(S, ref=np.max)

    # 128x128 grayscale to match training input dimensions
    fig = plt.figure(figsize=(1.28, 1.28), dpi=100)
    plt.axis("off")
    plt.tight_layout(pad=0)
    plt.imshow(S_DB, aspect="auto", cmap="gray", origin="lower")

    out_path = os.path.join(out_dir, f"{uuid.uuid4().hex}.png")
    plt.savefig(out_path, bbox_inches="tight", pad_inches=0)
    plt.close(fig)

    return out_path
