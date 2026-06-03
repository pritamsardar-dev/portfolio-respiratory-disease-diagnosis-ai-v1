import os

os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

import numpy as np
import pandas as pd
import tensorflow as tf
import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import confusion_matrix, ConfusionMatrixDisplay, classification_report

# i5-1135G7: 4 cores / 8 threads — leave headroom for OS and other apps
tf.config.threading.set_intra_op_parallelism_threads(4)
tf.config.threading.set_inter_op_parallelism_threads(2)

CSV_PATH = "data_split.csv"
IMG_DIR = "spectrograms"
IMG_SIZE = (64, 64)  # 4x more detail than 32x32, still safe on 8 GB RAM
BATCH_SIZE = 8
MODEL_SAVE = "models/cnn_diagnosis_model.keras"
ENCODER_SAVE = "models/label_encoder.pkl"

os.makedirs("models", exist_ok=True)
os.makedirs("results", exist_ok=True)


def make_dataset(df_subset, num_classes, augment=False):
    """
    Build a tf.data pipeline that loads spectrogram images on-the-fly.
    Augmentation is applied only during training to improve generalization.
    Images are never all loaded into RAM simultaneously.
    """
    filenames = [os.path.join(IMG_DIR, f) for f in df_subset["filename"]]
    labels = list(df_subset["label_encoded"])

    def load_and_preprocess(path, label):
        img = tf.io.read_file(path)
        img = tf.image.decode_png(img, channels=1)
        img = tf.image.resize(img, IMG_SIZE)
        img = tf.cast(img, tf.float32) / 255.0
        return img, tf.one_hot(label, num_classes)

    def augment_fn(img, label):
        img = tf.image.random_flip_left_right(img)
        img = tf.image.random_flip_up_down(img)
        img = tf.image.random_brightness(img, max_delta=0.15)
        img = tf.image.random_contrast(img, 0.85, 1.15)
        img = tf.clip_by_value(img, 0.0, 1.0)
        return img, label

    ds = tf.data.Dataset.from_tensor_slices((filenames, labels))
    ds = ds.map(load_and_preprocess, num_parallel_calls=2)

    if augment:
        ds = ds.shuffle(1000, seed=42)
        ds = ds.map(augment_fn, num_parallel_calls=2)

    ds = ds.batch(BATCH_SIZE).prefetch(2)
    return ds


print("Loading dataset...")
df = pd.read_csv(CSV_PATH)
df["is_aug"] = df["filename"].str.contains("_aug")

label_encoder = LabelEncoder()
df["label_encoded"] = label_encoder.fit_transform(df["label"])
num_classes = len(label_encoder.classes_)
joblib.dump(label_encoder, ENCODER_SAVE)
print(f"Classes ({num_classes}): {list(label_encoder.classes_)}")

# Exclude augmented samples from val and test to evaluate on real data only
train_df = df[df["split"] == "train"]
val_real_df = df[(df["split"] == "val") & (~df["is_aug"])]
test_df = df[(df["split"] == "test") & (~df["is_aug"])]

print(f"Train: {len(train_df)} | Val (real): {len(val_real_df)} | Test: {len(test_df)}")
print("\nClass distribution — train:")
print(train_df["label"].value_counts().to_string())
print("\nClass distribution — val (real):")
print(val_real_df["label"].value_counts().to_string())

train_ds = make_dataset(train_df, num_classes, augment=True)
val_ds = make_dataset(val_real_df, num_classes, augment=False)
test_ds = make_dataset(test_df, num_classes, augment=False)


def build_model(num_classes):
    """
    3-block CNN with ~180K params, sized for 8 GB CPU training.
    BatchNorm + Dropout after each block for regularization.
    GlobalAveragePooling replaces Flatten to reduce param count.
    """
    inp = tf.keras.Input(shape=(IMG_SIZE[0], IMG_SIZE[1], 1))

    # Block 1: 64x64 to 32x32
    x = tf.keras.layers.Conv2D(32, 3, padding="same")(inp)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.Activation("relu")(x)
    x = tf.keras.layers.Conv2D(32, 3, padding="same")(x)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.Activation("relu")(x)
    x = tf.keras.layers.MaxPooling2D(2)(x)
    x = tf.keras.layers.Dropout(0.25)(x)

    # Block 2: 32x32 to 16x16
    x = tf.keras.layers.Conv2D(64, 3, padding="same")(x)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.Activation("relu")(x)
    x = tf.keras.layers.Conv2D(64, 3, padding="same")(x)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.Activation("relu")(x)
    x = tf.keras.layers.MaxPooling2D(2)(x)
    x = tf.keras.layers.Dropout(0.3)(x)

    # Block 3: 16x16 to 8x8
    x = tf.keras.layers.Conv2D(128, 3, padding="same")(x)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.Activation("relu")(x)
    x = tf.keras.layers.MaxPooling2D(2)(x)
    x = tf.keras.layers.Dropout(0.35)(x)

    # Classification head
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.Dense(128, activation="relu")(x)
    x = tf.keras.layers.Dropout(0.5)(x)
    out = tf.keras.layers.Dense(num_classes, activation="softmax")(x)

    return tf.keras.Model(inp, out)


print("\nBuilding model...")
model = build_model(num_classes)
model.summary()

model.compile(
    optimizer=tf.keras.optimizers.Adam(1e-3),
    loss=tf.keras.losses.CategoricalCrossentropy(label_smoothing=0.1),
    metrics=["accuracy"],
)

callbacks = [
    tf.keras.callbacks.EarlyStopping(
        monitor="val_accuracy",
        patience=15,
        restore_best_weights=True,
        mode="max",
    ),
    tf.keras.callbacks.ReduceLROnPlateau(
        monitor="val_accuracy",
        factor=0.5,
        patience=6,
        min_lr=1e-6,
        verbose=1,
        mode="max",
    ),
    tf.keras.callbacks.ModelCheckpoint(
        MODEL_SAVE,
        monitor="val_accuracy",
        save_best_only=True,
        mode="max",
        verbose=1,
    ),
]

print("\n--- Training ---")
history = model.fit(
    train_ds,
    validation_data=val_ds,
    epochs=80,
    callbacks=callbacks,
)

_, val_acc = model.evaluate(val_ds, verbose=0)
_, test_acc = model.evaluate(test_ds, verbose=0)
print(f"\nVal  Accuracy : {val_acc:.4f}")
print(f"Test Accuracy : {test_acc:.4f}")

# Classification report and confusion matrix saved to results/
pred_probs = model.predict(test_ds)
pred_labels = np.argmax(pred_probs, axis=1)
true_labels = test_df["label_encoded"].values[: len(pred_labels)]

report = classification_report(true_labels, pred_labels, target_names=label_encoder.classes_)
print("\nClassification Report:\n")
print(report)

with open("results/classification_report.txt", "w") as f:
    f.write(report)

cm = confusion_matrix(true_labels, pred_labels)
disp = ConfusionMatrixDisplay(cm, display_labels=label_encoder.classes_)
disp.plot(cmap="Blues", xticks_rotation=45)
plt.title("Confusion Matrix")
plt.tight_layout()
plt.savefig("results/confusion_matrix.png")
plt.close()

for metric, label_text in [("accuracy", "Accuracy"), ("loss", "Loss")]:
    plt.figure()
    plt.plot(history.history[metric], label=f"Train {label_text}")
    plt.plot(history.history[f"val_{metric}"], label=f"Val {label_text}")
    plt.title(label_text)
    plt.xlabel("Epoch")
    plt.legend()
    plt.grid(True)
    plt.savefig(f"results/{metric}_plot.png")
    plt.close()

print("\nResults saved to results/")
print("Training complete.")
