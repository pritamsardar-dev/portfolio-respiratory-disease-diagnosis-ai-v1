import os
import random

import numpy as np
import pandas as pd
import librosa
import librosa.effects
import soundfile as sf
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from collections import Counter, defaultdict

DIAGNOSIS_FILE = "diagnosis/ICBHI_Challenge_diagnosis.txt"
DATA_FOLDER = "data"
SEGMENT_FOLDER = "segments"
SPECTRO_FOLDER = "spectrograms"

TARGET_SAMPLES_PER_CLASS = 500
COPD_CAP = 500

os.makedirs(SEGMENT_FOLDER, exist_ok=True)
os.makedirs(SPECTRO_FOLDER, exist_ok=True)


def load_diagnosis(filepath):
    """Load patient ID to diagnosis label mapping from the ICBHI diagnosis file."""
    mapping = {}
    with open(filepath, "r") as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) >= 2:
                mapping[parts[0]] = parts[1].lower()
    return mapping


def extract_segments(wav_filename, diagnosis_map):
    """
    Extract annotated breath cycle segments from a WAV and its paired .txt file.
    Each row in the annotation file defines a start/end time for one breath cycle.
    Segments shorter than 0.5s are skipped as too short to be informative.
    """
    base = os.path.splitext(wav_filename)[0]
    wav_p = os.path.join(DATA_FOLDER, wav_filename)
    txt_p = os.path.join(DATA_FOLDER, base + ".txt")

    if not os.path.exists(txt_p):
        return

    patient_id = base.split("_")[0]
    label = diagnosis_map.get(patient_id)

    if label is None:
        return

    y, sr = librosa.load(wav_p, sr=None)

    with open(txt_p, "r") as f:
        for idx, line in enumerate(f):
            parts = line.strip().split()
            if len(parts) < 4:
                continue

            start = float(parts[0])
            end = float(parts[1])
            s_samp = int(start * sr)
            e_samp = int(end * sr)
            seg = y[s_samp:e_samp]

            if len(seg) < sr * 0.5:
                continue

            seg_name = f"{base}_seg{idx}.wav"
            seg_path = os.path.join(SEGMENT_FOLDER, seg_name)
            sf.write(seg_path, seg, sr)


def save_spectrogram(seg_file, out_name=None):
    """Convert a WAV segment to a 128x128 grayscale mel spectrogram PNG."""
    file_path = os.path.join(SEGMENT_FOLDER, seg_file)
    y, sr = librosa.load(file_path, sr=None)

    S = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=128, fmax=4000)
    S_DB = librosa.power_to_db(S, ref=np.max)

    fig = plt.figure(figsize=(1.28, 1.28), dpi=100)
    plt.axis("off")
    plt.tight_layout(pad=0)
    plt.imshow(S_DB, aspect="auto", cmap="gray", origin="lower")

    out_name = out_name or (os.path.splitext(seg_file)[0] + ".png")
    out_path = os.path.join(SPECTRO_FOLDER, out_name)
    plt.savefig(out_path, bbox_inches="tight", pad_inches=0)
    plt.close(fig)
    return out_name


def augment_segment(seg_file, aug_idx):
    """
    Apply a deterministic augmentation based on aug_idx mod 3:
      0 = pitch shift up, 1 = pitch shift down, 2 = time stretch.
    """
    file_path = os.path.join(SEGMENT_FOLDER, seg_file)
    y, sr = librosa.load(file_path, sr=None)

    choice = aug_idx % 3

    if choice == 0:
        y_aug = librosa.effects.pitch_shift(y, sr=sr, n_steps=1)
    elif choice == 1:
        y_aug = librosa.effects.pitch_shift(y, sr=sr, n_steps=-1)
    else:
        rate = random.choice([0.9, 1.1])
        y_aug = librosa.effects.time_stretch(y, rate=rate)

    aug_name = os.path.splitext(seg_file)[0] + f"_aug{aug_idx}.wav"
    aug_path = os.path.join(SEGMENT_FOLDER, aug_name)
    sf.write(aug_path, y_aug, sr)
    return aug_name


def augment_to_target(seg_list, label, split_name, target):
    """
    Augment a class within one split until it reaches the target sample count.
    Cycles through the existing segments to generate synthetic variants.
    Returns new rows to be appended to the dataset.
    """
    current = len(seg_list)
    if current >= target:
        return []

    needed = target - current
    rows = []
    aug_idx = 0

    while aug_idx < needed:
        src_file = seg_list[aug_idx % len(seg_list)]
        patient_id = src_file.split("_")[0]
        aug_name = augment_segment(src_file, aug_idx)
        rows.append(
            {
                "seg_file": aug_name,
                "patient_id": patient_id,
                "label": label,
                "split": split_name,
            }
        )
        aug_idx += 1

    return rows


print("Loading diagnosis labels...")
diagnosis_map = load_diagnosis(DIAGNOSIS_FILE)

print("Extracting breath cycle segments...")
for fname in os.listdir(DATA_FOLDER):
    if fname.endswith(".wav"):
        extract_segments(fname, diagnosis_map)
print("Segments extracted.")

# Build initial rows from original segments only (exclude augmented files)
all_data = []
for seg_file in os.listdir(SEGMENT_FOLDER):
    if not seg_file.endswith(".wav"):
        continue
    if "_aug" in seg_file:
        continue

    patient_id = seg_file.split("_")[0]
    label = diagnosis_map.get(patient_id)

    if label is None:
        continue

    all_data.append(
        {
            "seg_file": seg_file,
            "patient_id": patient_id,
            "label": label,
        }
    )

print(f"Total original segments: {len(all_data)}")

# Cap COPD to prevent majority class from dominating the dataset
copd_rows = [r for r in all_data if r["label"] == "copd"]
other_rows = [r for r in all_data if r["label"] != "copd"]
random.seed(42)
random.shuffle(copd_rows)
all_data = other_rows + copd_rows[:COPD_CAP]
print(f"COPD capped to {COPD_CAP} from {len(copd_rows)} real segments")

class_counts = Counter(row["label"] for row in all_data)
print("Class distribution before split:")
for cls, cnt in sorted(class_counts.items()):
    print(f"  {cls}: {cnt}")


# Stratified patient-level split done before augmentation so
# every class appears in every split without data leakage
label_to_patients = defaultdict(set)
for row in all_data:
    label_to_patients[row["label"]].add(row["patient_id"])

train_patients = set()
val_patients = set()
test_patients = set()

random.seed(42)

for label, pids in label_to_patients.items():
    pids = sorted(list(pids))
    random.shuffle(pids)
    total = len(pids)

    if total == 1:
        # Only one patient — must appear in all splits
        train_patients.add(pids[0])
        val_patients.add(pids[0])
        test_patients.add(pids[0])
        print(f"  WARNING: {label} has 1 patient — shared across all splits")
        continue

    if total == 2:
        # First to train, second shared between val and test
        train_patients.add(pids[0])
        val_patients.add(pids[1])
        test_patients.add(pids[1])
        print(f"  WARNING: {label} has 2 patients — val and test share one patient")
        continue

    if total == 3:
        train_patients.add(pids[0])
        val_patients.add(pids[1])
        test_patients.add(pids[2])
        continue

    # Standard 60/20/20 patient-level split
    train_cut = max(1, int(0.60 * total))
    val_cut = max(train_cut + 1, int(0.80 * total))

    train_patients.update(pids[:train_cut])
    val_patients.update(pids[train_cut:val_cut])
    test_patients.update(pids[val_cut:])

# Assign splits — patients shared across splits get a row in each
new_all_data = []
for row in all_data:
    pid = row["patient_id"]
    in_train = pid in train_patients
    in_val = pid in val_patients
    in_test = pid in test_patients

    if in_train:
        r = row.copy()
        r["split"] = "train"
        new_all_data.append(r)
    if in_val:
        r = row.copy()
        r["split"] = "val"
        new_all_data.append(r)
    if in_test:
        r = row.copy()
        r["split"] = "test"
        new_all_data.append(r)

all_data = new_all_data


# Augment each class independently per split to reach TARGET_SAMPLES_PER_CLASS
# This ensures balanced class counts in train, val, and test separately
print(f"\nAugmenting all splits to {TARGET_SAMPLES_PER_CLASS} per class...")

augmented_rows = []

for split_name in ["train", "val", "test"]:
    print(f"\n  [{split_name}]")
    split_rows = [r for r in all_data if r["split"] == split_name]
    labels_in_split = set(r["label"] for r in split_rows)

    for label in sorted(labels_in_split):
        seg_list = [r["seg_file"] for r in split_rows if r["label"] == label]
        new_rows = augment_to_target(seg_list, label, split_name, TARGET_SAMPLES_PER_CLASS)
        augmented_rows.extend(new_rows)
        total_after = len(seg_list) + len(new_rows)
        print(f"    {label}: {len(seg_list)} real + {len(new_rows)} aug = {total_after}")

all_data.extend(augmented_rows)

print("\nFinal distribution per split:")
for split_name in ["train", "val", "test"]:
    counts = Counter(r["label"] for r in all_data if r["split"] == split_name)
    print(f"  {split_name}:")
    for cls, cnt in sorted(counts.items()):
        print(f"    {cls}: {cnt}")


# Generate spectrograms only for rows that don't already have a PNG
print("\nGenerating spectrogram images...")
existing_spectros = set(os.listdir(SPECTRO_FOLDER))

for row in all_data:
    png_name = os.path.splitext(row["seg_file"])[0] + ".png"
    if png_name not in existing_spectros:
        save_spectrogram(row["seg_file"], out_name=png_name)
        existing_spectros.add(png_name)
    row["filename"] = png_name

print("Spectrograms generated.")

df = pd.DataFrame(all_data)[["filename", "patient_id", "label", "split"]]
df.to_csv("data_split.csv", index=False)

print(f"\ndata_split.csv saved.")
print(f"Train patients: {len(train_patients)}")
print(f"Val patients: {len(val_patients)}")
print(f"Test patients: {len(test_patients)}")
print(f"Total rows: {len(df)}")
print("\nPreprocessing complete.")
