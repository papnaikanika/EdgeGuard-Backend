import sys
import json
import os
import joblib


# ==========================================
# PATHS
# ==========================================

BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)
    )
)

MODEL_PATH = os.path.join(
    BASE_DIR,
    "ml",
    "anomaly_model.pkl"
)

ENCODER_PATH = os.path.join(
    BASE_DIR,
    "ml",
    "device_encoder.pkl"
)


# ==========================================
# LOAD MODEL
# ==========================================

model = joblib.load(MODEL_PATH)
device_encoder = joblib.load(ENCODER_PATH)


# ==========================================
# PREDICTION
# ==========================================

def predict(device, current, voltage):

    device_encoded = device_encoder.transform(
        [device]
    )[0]

    prediction = model.predict([
        [
            device_encoded,
            current,
            voltage
        ]
    ])[0]

    if prediction == "abnormal":
        return {
            "status": "ANOMALY",
            "risk": "HIGH"
        }

    return {
        "status": "NORMAL",
        "risk": "LOW"
    }


# ==========================================
# RECEIVE DATA FROM NODE.JS
# ==========================================

if __name__ == "__main__":

    input_data = json.loads(
        sys.stdin.read()
    )

    device = str(
        input_data["device"]
    )

    current = float(
        input_data["current"]
    )

    voltage = float(
        input_data["voltage"]
    )

    result = predict(
        device,
        current,
        voltage
    )

    print(
        json.dumps(result)
    )
