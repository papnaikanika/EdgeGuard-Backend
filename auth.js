const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./database");

// In a production deployment, keep this in .env
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
}
// ==========================================
// CREATE USER
// ==========================================

function createUser(username, password, role = "VIEWER") {

    if (!username || !password) {
        throw new Error("Username and password are required");
    }

    if (!["ADMIN", "VIEWER"].includes(role)) {
        throw new Error("Invalid role");
    }

    const existingUser = db.prepare(`
        SELECT id
        FROM users
        WHERE username = ?
    `).get(username);

    if (existingUser) {
        throw new Error("Username already exists");
    }

    const hashedPassword =
        bcrypt.hashSync(password, 12);

    const result = db.prepare(`
        INSERT INTO users
        (username, password, role)
        VALUES (?, ?, ?)
    `).run(
        username,
        hashedPassword,
        role
    );

    return result.lastInsertRowid;
}


// ==========================================
// LOGIN
// ==========================================

function loginUser(username, password) {

    const user = db.prepare(`
        SELECT *
        FROM users
        WHERE username = ?
    `).get(username);

    if (!user) {
        return null;
    }

    const passwordValid =
        bcrypt.compareSync(
            password,
            user.password
        );

    if (!passwordValid) {
        return null;
    }

    const token = jwt.sign(
        {
            userId: user.id,
            username: user.username,
            role: user.role
        },
        JWT_SECRET,
        {
            expiresIn: "2h"
        }
    );

    return {
        token,
        user: {
            id: user.id,
            username: user.username,
            role: user.role
        }
    };
}


// ==========================================
// VERIFY TOKEN
// ==========================================

function authenticateToken(req, res, next) {

    const authHeader =
        req.headers.authorization;

    if (!authHeader) {

        return res.status(401).json({
            error: "Authentication required"
        });

    }

    const token =
        authHeader.split(" ")[1];

    if (!token) {

        return res.status(401).json({
            error: "Invalid authorization header"
        });

    }

    try {

        const decoded =
            jwt.verify(
                token,
                JWT_SECRET
            );

        req.user = decoded;

        next();

    } catch (error) {

        return res.status(401).json({
            error: "Invalid or expired token"
        });

    }

}


// ==========================================
// ADMIN ONLY
// ==========================================

function requireAdmin(req, res, next) {

    if (!req.user) {

        return res.status(401).json({
            error: "Authentication required"
        });

    }

    if (req.user.role !== "ADMIN") {

        return res.status(403).json({
            error: "Admin access required"
        });

    }

    next();

}


module.exports = {
    createUser,
    loginUser,
    authenticateToken,
    requireAdmin
};
