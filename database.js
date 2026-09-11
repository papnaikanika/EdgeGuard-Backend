const Database = require("better-sqlite3");

const db = new Database("edgeguard.db");

// =================================================
//              SENSOR READINGS TABLE
// =================================================

db.exec(`
    CREATE TABLE IF NOT EXISTS sensor_readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id INTEGER NOT NULL,
        current REAL,
        voltage REAL,
        power REAL,
        status TEXT DEFAULT 'NORMAL',
        risk TEXT DEFAULT 'LOW',
timestamp DATETIME DEFAULT (datetime('now', '+5 hours', '+30 minutes'))    )
`);


// =================================================
//                  ALERTS TABLE
// =================================================

db.exec(`
    CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id INTEGER NOT NULL,
        severity TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'UNRESOLVED',
timestamp DATETIME DEFAULT (datetime('now', '+5 hours', '+30 minutes'))
    )
`);


// =================================================
//                  USERS TABLE
// =================================================

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'VIEWER',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);


// =================================================
//                AUDIT LOGS TABLE
// =================================================

db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
timestamp DATETIME DEFAULT (datetime('now', '+5 hours', '+30 minutes'))
    )
`);


// =================================================
//                  DATABASE READY
// =================================================

console.log("Database initialized successfully");

// Bootstrap first admin user
const bcrypt = require("bcryptjs");

if (process.env.BOOTSTRAP_USERNAME && process.env.BOOTSTRAP_PASSWORD) {
    const existingUser = db.prepare(
        "SELECT id FROM users WHERE username = ?"
    ).get(process.env.BOOTSTRAP_USERNAME);

    if (!existingUser) {
        const hashedPassword = bcrypt.hashSync(
            process.env.BOOTSTRAP_PASSWORD,
            12
        );

        db.prepare(
            "INSERT INTO users (username, password, role) VALUES (?, ?, ?)"
        ).run(
            process.env.BOOTSTRAP_USERNAME,
            hashedPassword,
            "ADMIN"
        );

        console.log("Bootstrap admin user created");
    }
}

module.exports = db;
