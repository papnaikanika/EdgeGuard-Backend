require("dotenv").config();

const DEMO_MODE = process.env.DEMO_MODE === "true";

const {
    createUser,
    loginUser,
    authenticateToken,
    requireAdmin
} = require("./auth");
const nodemailer = require("nodemailer");
const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mqtt = require("mqtt");

const db = require("./database");

const app = express();


// =================================================
//              SECURITY / MIDDLEWARE
// =================================================

app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                baseUri: ["'self'"],
                fontSrc: ["'self'", "https:", "data:"],
                formAction: ["'self'"],
                frameAncestors: ["'self'"],
                imgSrc: ["'self'", "data:"],
                objectSrc: ["'none'"],
                scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
                scriptSrcAttr: ["'unsafe-inline'"],
                styleSrc: ["'self'", "https:", "'unsafe-inline'"],
                connectSrc: ["'self'"],
                upgradeInsecureRequests: null
            }
        }
    })
);

app.use(
    cors({
        origin: true,
        methods: ["GET", "POST", "PATCH"],
        allowedHeaders: ["Content-Type", "Authorization"]
    })
);

app.use(express.json({ limit: "10kb" }));

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false
});

app.use("/api", apiLimiter);

app.use(
    express.static(
        path.join(__dirname, "dashboard")
    )
);


// =================================================
//                       MQTT
// =================================================

const mqttClient = mqtt.connect(
    `mqtt://${process.env.MQTT_HOST}:${process.env.MQTT_PORT}`
);
const emailTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
    }
});

// =================================================
//                LATEST SENSOR DATA
// =================================================

let sensorData = {

    device1: {
        current: null,
        voltage: null,
        power: null,
        status: "NORMAL",
        risk: "LOW"
    },

    device2: {
        current: null,
        voltage: null,
        power: null,
        status: "NORMAL",
        risk: "LOW"
    },

    device3: {
        current: null,
        voltage: null,
        power: null,
        status: "NORMAL",
        risk: "LOW"
    }

};


// =================================================
//                  ML PREDICTION
// =================================================

// =================================================
//                  ML PREDICTION
// =================================================

const { spawnSync } = require("child_process");

function predictRisk(deviceName, current, voltage) {

    if (
        current === null ||
        current === undefined ||
        voltage === null ||
        voltage === undefined
    ) {
        return {
            status: "NORMAL",
            risk: "LOW"
        };
    }

    try {

const pythonPath = process.env.PYTHON_PATH || "python3";
        const modelScript =
            path.join(
                __dirname,
                "ml",
                "model.py"
            );

        const input = JSON.stringify({
            device: deviceName,
            current: Number(current),
            voltage: Number(voltage)
        });

        const result = spawnSync(
            pythonPath,
            [modelScript],
            {
                input: input,
                encoding: "utf8"
            }
        );

        if (result.error) {

            console.error(
                "ML execution error:",
                result.error
            );

            return {
                status: "NORMAL",
                risk: "LOW"
            };
        }

        if (result.status !== 0) {

            console.error(
                "ML process failed:",
                result.stderr
            );

            return {
                status: "NORMAL",
                risk: "LOW"
            };
        }

        const prediction =
            JSON.parse(
                result.stdout.trim()
            );

        return prediction;

    } catch (error) {

        console.error(
            "ML prediction error:",
            error
        );

        return {
            status: "NORMAL",
            risk: "LOW"
        };
    }
}
// =================================================
//              DATABASE STATEMENTS
// =================================================

const insertReading = db.prepare(`
    INSERT INTO sensor_readings
    (device_id, current, voltage, power, status, risk)
    VALUES (?, ?, ?, ?, ?, ?)
`);

const insertAlert = db.prepare(`
    INSERT INTO alerts
    (device_id, severity, message)
    VALUES (?, ?, ?)
`);

const insertAuditLog = db.prepare(`
    INSERT INTO audit_logs
    (user_id, action, details)
    VALUES (?, ?, ?)
`);


// =================================================
//                  CREATE ALERT
// =================================================
async function sendEmailAlert(deviceId, severity, message, current) {
    try {
        await emailTransporter.sendMail({
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_TO,
            subject: `🚨 EdgeGuard ${severity} Alert`,
            text: `EdgeGuard-μGrid Security Alert

Device: ${deviceId}
Severity: ${severity}
Current: ${current} A

Message:
${message}

Please check the device immediately.`
        });

        console.log("📧 Alert email sent successfully");
    } catch (error) {
        console.error("📧 Email sending failed:", error.message);
    }
}
function createAlert(
    deviceId,
    status,
    risk,
    current
) {

    if (status === "NORMAL") {
        return;
    }

    let severity;
    let message;

    if (status === "WARNING") {

        severity = "MEDIUM";

        message =
            `Unusual current detected: ${current}`;
    }

    else if (status === "ANOMALY") {

        severity = "HIGH";

        message =
            `Abnormal current detected: ${current}`;
    }

    insertAlert.run(
        deviceId,
        severity,
        message
    );
sendEmailAlert(deviceId, severity, message, current);
    console.log("");
    console.log("========== ALERT CREATED ==========");
    console.log("Device   :", deviceId);
    console.log("Severity :", severity);
    console.log("Message  :", message);
    console.log("===================================");
}


// =================================================
//                  SAVE READING
// =================================================

function saveReading(deviceId) {

    const device =
        sensorData[`device${deviceId}`];

    if (
        device.current === null ||
        device.voltage === null
    ) {
        return;
    }

    // Prevent duplicate readings
    if (
        device.lastSavedCurrent === device.current &&
        device.lastSavedVoltage === device.voltage
    ) {
        return;
    }

const deviceName =
    deviceId === 1 ? "Motor" : "Fan";
// Device is OFF
if (device.voltage === 0) {
    device.status = "OFF";
    device.risk = "LOW";
    device.power = 0;

    device.lastSavedCurrent = device.current;
    device.lastSavedVoltage = device.voltage;

    return;
}

const previousCurrent = device.lastSavedCurrent;

const prediction =
    predictRisk(
        deviceName,
        device.current,
        device.voltage
    );

// Detect sudden current increase
if (
    previousCurrent !== null &&
    previousCurrent !== undefined &&
    previousCurrent > 0 &&
    device.current > previousCurrent * 1.5 &&
    prediction.status === "NORMAL"
) {
    prediction.status = "WARNING";
    prediction.risk = "MEDIUM";

    console.log("⚠️ SUDDEN CURRENT INCREASE DETECTED");
    console.log("Previous Current:", previousCurrent);
    console.log("Current:", device.current);
}
    device.status =
        prediction.status;

    device.risk =
        prediction.risk;

    const power =
        device.current * device.voltage;

    device.power = power;

    insertReading.run(
        deviceId,
        device.current,
        device.voltage,
        power,
        prediction.status,
        prediction.risk
    );

    device.lastSavedCurrent =
        device.current;

    device.lastSavedVoltage =
        device.voltage;

    createAlert(
        deviceId,
        prediction.status,
        prediction.risk,
        device.current
    );

    console.log("");
    console.log("========== READING SAVED ==========");
    console.log("Device  :", deviceId);
    console.log("Current :", device.current);
    console.log("Voltage :", device.voltage);
    console.log("Power   :", power);
    console.log("Status  :", prediction.status);
    console.log("Risk    :", prediction.risk);
    console.log("===================================");
}


// =================================================
//                  DEMO MODE
// =================================================

function generateDemoReading(deviceId) {

    if (!DEMO_MODE) {
        return;
    }

    const device =
        sensorData[`device${deviceId}`];

    const demoValues = {

        1: {
            current: 10,
            voltage: 230
        },

        2: {
            current: 14,
            voltage: 230
        },

        3: {
            current: 18,
            voltage: 230
        }

    };

    const reading =
        demoValues[deviceId];

    if (!reading) {
        return;
    }

    device.current =
        reading.current;

    device.voltage =
        reading.voltage;

    saveReading(deviceId);
}


if (DEMO_MODE) {

    setInterval(() => {

        for (
            let deviceId = 1;
            deviceId <= 3;
            deviceId++
        ) {
            generateDemoReading(deviceId);
        }

    }, 10000);
}


// =================================================
//                  MQTT CONNECTION
// =================================================

mqttClient.on("connect", () => {

    console.log(
        "MQTT connected successfully"
    );

    mqttClient.subscribe(
        "prototype/#",
        (error) => {

            if (error) {

                console.log(
                    "MQTT subscription error:",
                    error.message
                );

            } else {

                console.log(
                    "Subscribed to prototype/#"
                );

            }

        }
    );
});


// =================================================
//                  MQTT MESSAGE
// =================================================

mqttClient.on(
    "message",
    (topic, message) => {

const messageValue =
    message.toString().trim();


// =========================================
// IGNORE CONTROL MESSAGES
// =========================================
if (topic === "prototype/bulb/state") {
    sensorData.device3.status = messageValue === "ON" ? "ON" : "OFF";
    sensorData.device3.risk = "LOW";
    console.log("💡 Bulb state:", messageValue);
    return;
}
if (
    messageValue === "ON" ||
    messageValue === "OFF"
) {

    console.log(
        "Control message received:",
        messageValue
    );

    return;
}


// =========================================
// CONVERT SENSOR VALUE TO NUMBER
// =========================================

const value =
    Number(messageValue);

if (!Number.isFinite(value)) {

    console.log(
        "Invalid MQTT value received:",
        messageValue
    );

    return;
}
        if (value < 0) {

            console.log(
                "Invalid negative MQTT value received:",
                value
            );

            return;
        }

        console.log("");
        console.log(
            "========== MQTT MESSAGE =========="
        );
        console.log("Topic :", topic);
        console.log("Value :", value);


        // =========================================
        // MOTOR → DEVICE 1
        // =========================================

        if (
            topic ===
            "prototype/motor/current"
        ) {

            sensorData.device1.current =
                value;

            saveReading(1);

        }

        else if (
            topic ===
            "prototype/motor/voltage"
        ) {

            sensorData.device1.voltage =
                value;

            saveReading(1);
        }


        // =========================================
        // FAN → DEVICE 2
        // =========================================

        else if (
            topic ===
            "prototype/fan/current"
        ) {

            sensorData.device2.current =
                value;

            saveReading(2);

        }

        else if (
            topic ===
            "prototype/fan/voltage"
        ) {

            sensorData.device2.voltage =
                value;

            saveReading(2);
        }


        // =========================================
        // DEVICE 3
        // =========================================

        else if (
            topic ===
            "prototype/bulb/current"
        ) {

            sensorData.device3.current =
                value;

            saveReading(3);

        }

        else if (
            topic ===
            "prototype/bulb/voltage"
        ) {

            sensorData.device3.voltage =
                value;

            saveReading(3);
        }


        console.log(
            "--------------------------------------"
        );

        console.log(
            "Device 1:",
            sensorData.device1
        );

        console.log(
            "Device 2:",
            sensorData.device2
        );

        console.log(
            "Device 3:",
            sensorData.device3
        );


        console.log(
            "======================================"
        );
}
);


// =================================================
//                    MQTT ERROR
// =================================================

mqttClient.on(
    "error",
    (error) => {

        console.log(
            "MQTT Error:",
            error.message
        );

    }
);


// =================================================
//                    DASHBOARD
// =================================================

app.get(
    "/dashboard",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "dashboard",
                "index.html"
            )
        );

    }
);


// =================================================
//                      HOME
// =================================================

app.get(
    "/",
    (req, res) => {

        res.json({

            project:
                "EdgeGuard-μGrid",

            status:
                "Backend running",

            mqtt:
                "Enabled",

            database:
                "Connected"

        });

    }
);


// =================================================
//                  AUTHENTICATION
// =================================================

// LOGIN

app.post(
    "/api/login",
    (req, res) => {

        const {
            username,
            password
        } = req.body;

        if (
            !username ||
            !password
        ) {

            return res.status(400).json({
                error:
                    "Username and password are required"
            });

        }

        const result =
            loginUser(
                username,
                password
            );

        if (!result) {

            return res.status(401).json({
                error:
                    "Invalid username or password"
            });

        }

        res.json(result);

    }
);


// =================================================
//                  CREATE USER
// =================================================

app.post(
    "/api/users",
    authenticateToken,
    requireAdmin,
    (req, res) => {

        const {
            username,
            password,
            role
        } = req.body;

        try {

            const userId = createUser(
                username,
                password,
                role || "VIEWER"
            );

            res.status(201).json({
                message: "User created successfully",
                userId
            });

        } catch (error) {

            res.status(400).json({
                error: error.message
            });

        }

    }
);


// =================================================
//                  ALL DEVICES API
// =================================================

app.get(
    "/api/devices",
    authenticateToken,
    (req, res) => {
        res.json(sensorData);
    }
);

// =================================================
//                 DEVICE CONTROL
// =================================================

app.post(
    "/api/control/:device",
    authenticateToken,
    (req, res) => {

        const device = req.params.device.toLowerCase();
        const command = String(req.body.command || "").toUpperCase();

        const topics = {
            motor: "prototype/control/motor",
            fan: "prototype/control/fan",
            bulb: "prototype/control/bulb"
        };

        if (!topics[device]) {
            return res.status(400).json({
                error: "Invalid device"
            });
        }

        if (command !== "ON" && command !== "OFF") {
            return res.status(400).json({
                error: "Command must be ON or OFF"
            });
        }

        if (!mqttClient.connected) {
            return res.status(503).json({
                error: "MQTT broker is not connected"
            });
        }

        mqttClient.publish(
            topics[device],
            command,
            (error) => {

                if (error) {
                    console.error(
                        "MQTT publish error:",
                        error.message
                    );

                    return res.status(500).json({
                        error: "Failed to send command"
                    });
                }

                console.log(
                    `CONTROL: ${device.toUpperCase()} -> ${command}`
                );

                res.json({
                    success: true,
                    device: device,
                    command: command
                });

            }
        );

    }
);
// =================================================
//                    POWER API
// =================================================

app.get(
    "/api/power",
    authenticateToken,
    (req, res) => {

        res.json({
            device1: sensorData.device1.power,
            device2: sensorData.device2.power,
            device3: sensorData.device3.power
        });

    }
);


// =================================================
//                  CURRENT API
// =================================================

app.get(
    "/api/current",
    authenticateToken,
    (req, res) => {

        res.json({
            device1: sensorData.device1.current,
            device2: sensorData.device2.current,
            device3: sensorData.device3.current
        });

    }
);


// =================================================
//                  VOLTAGE API
// =================================================

app.get(
    "/api/voltage",
    authenticateToken,
    (req, res) => {

        res.json({
            device1: sensorData.device1.voltage,
            device2: sensorData.device2.voltage,
            device3: sensorData.device3.voltage
        });

    }
);


// =================================================
//                DATABASE HISTORY
// =================================================

app.get(
    "/api/history",
    authenticateToken,
    (req, res) => {

        const rows = db.prepare(`
            SELECT *
            FROM sensor_readings
            ORDER BY timestamp DESC
            LIMIT 100
        `).all();

        res.json(rows);

    }
);


// =================================================
//                    ALERTS API
// =================================================

app.get(
    "/api/alerts",
    authenticateToken,
    (req, res) => {

        const alerts = db.prepare(`
            SELECT *
            FROM alerts
            ORDER BY timestamp DESC
            LIMIT 100
        `).all();

        res.json(alerts);

    }
);


// =================================================
//                RESOLVE ALERT API
// =================================================

app.patch(
    "/api/alerts/:id/resolve",
    authenticateToken,
    requireAdmin,
    (req, res) => {

        const alertId = Number(req.params.id);

        if (!Number.isInteger(alertId)) {

            return res.status(400).json({
                error: "Invalid alert ID"
            });

        }

        const result = db.prepare(`
            UPDATE alerts
            SET status = 'ACKNOWLEDGED'
            WHERE id = ?
        `).run(alertId);

        if (result.changes === 0) {

            return res.status(404).json({
                error: "Alert not found"
            });

        }

        insertAuditLog.run(
            req.user.userId,
            "ACKNOWLEDGE_ALERT",
            `Acknowledged alert ${alertId}`
        );

        res.json({
            message: "Alert acknowledged successfully",
            alertId
        });

    }
);


// =================================================
//                 AUDIT LOGS API
// =================================================

app.get(
    "/api/audit-logs",
    authenticateToken,
    requireAdmin,
    (req, res) => {

        const logs = db.prepare(`
            SELECT *
            FROM audit_logs
            ORDER BY timestamp DESC
            LIMIT 100
        `).all();

        res.json(logs);

    }
);


// =================================================
//                  ERROR HANDLER
// =================================================

app.use(
    (err, req, res, next) => {

        console.error(
            "Server error:",
            err.message
        );

        res.status(500).json({
            error: "Internal server error"
        });

    }
);


// =================================================
//                  START SERVER
// =================================================

const PORT = 3000;

app.listen(
    PORT,
    () => {

        console.log("");

        console.log(
            "======================================"
        );

        console.log(
            "        EdgeGuard-μGrid Backend"
        );

        console.log(
            "======================================"
        );

        console.log(
            "Server running on port 3000"
        );

        console.log(
            "Dashboard: /dashboard"
        );

        console.log(
            "Database: Connected"
        );

        console.log(
            "MQTT: Configured"
        );

        console.log(
            "Demo Mode:",
            DEMO_MODE
        );

        console.log(
            "======================================"
        );

    }
);
