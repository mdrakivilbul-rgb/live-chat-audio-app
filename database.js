const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.db = new sqlite3.Database(path.join(__dirname, 'chat_app.db'));
        this.init();
    }

    init() {
        // Create users table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                avatar TEXT DEFAULT NULL,
                status TEXT DEFAULT 'offline',
                last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create messages table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id INTEGER NOT NULL,
                receiver_id INTEGER,
                room_id TEXT,
                message TEXT NOT NULL,
                message_type TEXT DEFAULT 'text',
                file_url TEXT DEFAULT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sender_id) REFERENCES users (id)
            )
        `);

        // Create rooms table for group chats
        this.db.run(`
            CREATE TABLE IF NOT EXISTS rooms (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                created_by INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users (id)
            )
        `);

        // Create room_members table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS room_members (
                room_id TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (room_id, user_id),
                FOREIGN KEY (room_id) REFERENCES rooms (id),
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `);

        // Create call_logs table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS call_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                caller_id INTEGER NOT NULL,
                receiver_id INTEGER NOT NULL,
                call_type TEXT DEFAULT 'audio',
                status TEXT DEFAULT 'missed',
                duration INTEGER DEFAULT 0,
                started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                ended_at DATETIME,
                FOREIGN KEY (caller_id) REFERENCES users (id),
                FOREIGN KEY (receiver_id) REFERENCES users (id)
            )
        `);

        console.log('Database initialized successfully');
    }

    // User methods
    createUser(username, email, hashedPassword, callback) {
        const stmt = this.db.prepare(`
            INSERT INTO users (username, email, password) 
            VALUES (?, ?, ?)
        `);
        stmt.run([username, email, hashedPassword], function(err) {
            callback(err, this ? this.lastID : null);
        });
        stmt.finalize();
    }

    getUserByEmail(email, callback) {
        this.db.get(
            'SELECT * FROM users WHERE email = ?',
            [email],
            callback
        );
    }

    getUserById(id, callback) {
        this.db.get(
            'SELECT id, username, email, avatar, status, last_seen FROM users WHERE id = ?',
            [id],
            callback
        );
    }

    updateUserStatus(userId, status, callback) {
        this.db.run(
            'UPDATE users SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?',
            [status, userId],
            callback
        );
    }

    getOnlineUsers(callback) {
        this.db.all(
            'SELECT id, username, avatar, status FROM users WHERE status = "online"',
            callback
        );
    }

    // Message methods
    saveMessage(senderId, receiverId, roomId, message, messageType, fileUrl, callback) {
        const stmt = this.db.prepare(`
            INSERT INTO messages (sender_id, receiver_id, room_id, message, message_type, file_url) 
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        stmt.run([senderId, receiverId, roomId, message, messageType, fileUrl], function(err) {
            callback(err, this ? this.lastID : null);
        });
        stmt.finalize();
    }

    getMessages(userId1, userId2, limit = 50, callback) {
        this.db.all(`
            SELECT m.*, u.username as sender_username, u.avatar as sender_avatar
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE (m.sender_id = ? AND m.receiver_id = ?) 
               OR (m.sender_id = ? AND m.receiver_id = ?)
            ORDER BY m.created_at DESC
            LIMIT ?
        `, [userId1, userId2, userId2, userId1, limit], callback);
    }

    markMessagesAsRead(senderId, receiverId, callback) {
        this.db.run(
            'UPDATE messages SET is_read = TRUE WHERE sender_id = ? AND receiver_id = ?',
            [senderId, receiverId],
            callback
        );
    }

    // Call log methods
    saveCallLog(callerId, receiverId, callType, status, duration, callback) {
        const stmt = this.db.prepare(`
            INSERT INTO call_logs (caller_id, receiver_id, call_type, status, duration, ended_at) 
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);
        stmt.run([callerId, receiverId, callType, status, duration], function(err) {
            callback(err, this ? this.lastID : null);
        });
        stmt.finalize();
    }

    getCallHistory(userId, callback) {
        this.db.all(`
            SELECT cl.*, 
                   u1.username as caller_username,
                   u2.username as receiver_username
            FROM call_logs cl
            JOIN users u1 ON cl.caller_id = u1.id
            JOIN users u2 ON cl.receiver_id = u2.id
            WHERE cl.caller_id = ? OR cl.receiver_id = ?
            ORDER BY cl.started_at DESC
            LIMIT 20
        `, [userId, userId], callback);
    }

    close() {
        this.db.close();
    }
}

module.exports = Database;

