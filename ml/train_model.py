import sqlite3
import pandas as pd
from sklearn.ensemble import IsolationForest
import joblib
import os


# ==========================================
# DATABASE
# ==========================================

DB_PATH = "edgeguard.db"

conn = sqlite3.connect(DB_PATH)

query = """
SELECT device_id, current, voltage
FROM sensor_readings
WHERE current IS NOT NULL
AND voltage IS NOT NULL
"""

df = pd.read_sql_query(query, conn)

conn.close()


# ==========================================
# CHECK DATA
# ==========================================

print("Total training records:", len(df))

if len(df) < 20:
    print("Not enough real sensor data yet.")
    print("Collect at least 20 readings before training.")
    exit()


# ==========================================
# FEATURES
# ==========================================

X = df[["current", "voltage"]]


# ==========================================
# TRAIN ANOMALY MODEL
# ==========================================

model = IsolationForest(
    contamination=0.05,
    random_state=42
)

model.fit(X)


# ==========================================
# SAVE MODEL
# ==========================================

os.makedirs("ml", exist_ok=True)

joblib.dump(model, "ml/anomaly_model.pkl")


print("======================================")
print("ML MODEL TRAINED SUCCESSFULLY")
print("======================================")
print("Features: current, voltage")
print("Algorithm: Isolation Forest")
print("Model saved: ml/anomaly_model.pkl")
