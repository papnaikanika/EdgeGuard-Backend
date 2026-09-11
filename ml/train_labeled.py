import pandas as pd
import joblib
import os

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score
from sklearn.preprocessing import LabelEncoder


# ==========================================
# LOAD DATASET
# ==========================================

CSV_PATH = "ml/sensor_data_ml_cleaned.csv"

df = pd.read_csv(CSV_PATH)

print("Total CSV records:", len(df))


# ==========================================
# CLEAN LABELS
# ==========================================

df["device"] = (
    df["device"]
    .astype(str)
    .str.strip()
)

df["normal_or_abnormal"] = (
    df["normal_or_abnormal"]
    .astype(str)
    .str.strip()
    .str.lower()
)

# Keep only valid labels
df = df[
    df["normal_or_abnormal"].isin(
        ["normal", "abnormal"]
    )
].copy()


print("Records used for training:", len(df))

print("\nDevice distribution:")
print(df["device"].value_counts())

print("\nLabel distribution:")
print(df["normal_or_abnormal"].value_counts())


# ==========================================
# ENCODE DEVICE
# ==========================================

device_encoder = LabelEncoder()

df["device_encoded"] = device_encoder.fit_transform(
    df["device"]
)

print("\nDevice mapping:")

for device, encoded in zip(
    device_encoder.classes_,
    range(len(device_encoder.classes_))
):
    print(device, "=", encoded)


# ==========================================
# FEATURES
# ==========================================

X = df[
    [
        "device_encoded",
        "current",
        "voltage"
    ]
]

y = df["normal_or_abnormal"]


# ==========================================
# TRAIN / TEST SPLIT
# ==========================================

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y
)


# ==========================================
# TRAIN RANDOM FOREST
# ==========================================

model = RandomForestClassifier(
    n_estimators=150,
    random_state=42,
    class_weight="balanced"
)

model.fit(
    X_train,
    y_train
)


# ==========================================
# TEST MODEL
# ==========================================

predictions = model.predict(X_test)

accuracy = accuracy_score(
    y_test,
    predictions
)

print("\n======================================")
print("MODEL EVALUATION")
print("======================================")

print(
    "Accuracy:",
    round(accuracy * 100, 2),
    "%"
)

print("\nClassification report:")

print(
    classification_report(
        y_test,
        predictions
    )
)


# ==========================================
# SAVE MODEL + ENCODER
# ==========================================

os.makedirs("ml", exist_ok=True)

joblib.dump(
    model,
    "ml/anomaly_model.pkl"
)

joblib.dump(
    device_encoder,
    "ml/device_encoder.pkl"
)


# ==========================================
# SUCCESS
# ==========================================

print("======================================")
print("ML MODEL TRAINED SUCCESSFULLY")
print("======================================")

print("Algorithm: Random Forest")
print("Features: device, current, voltage")

print("Model saved:")
print("ml/anomaly_model.pkl")

print("Device encoder saved:")
print("ml/device_encoder.pkl")
