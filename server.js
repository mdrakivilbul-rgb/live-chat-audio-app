const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const Database = require('./database');
const Auth = require('./auth');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;
const db = new Database();

// Store online users and their socket connections
const onlineUsers = new Map();
const userSockets = new Map();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueName = uuidv4() + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

// Routes

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// User registration
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Validate input
        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Sanitize input
        const sanitizedUsername = Auth.sanitizeInput(username);
        const sanitizedEmail = Auth.sanitizeInput(email);

        // Validate format
        if (!Auth.isValidUsername(sanitizedUsername)) {
            return res.status(400).json({
                success: false,
                message: 'Username must be 3-20 characters, alphanumeric and underscore only'
            });
        }

        if (!Auth.isValidEmail(sanitizedEmail)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        if (!Auth.isValidPassword(password)) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters with letters and numbers'
            });
        }

        // Check if user already exists
        db.getUserByEmail(sanitizedEmail, async (err, existingUser) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: 'Database error'
                });
            }

            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'User already exists with this email'
                });
            }

            // Hash password and create user
            const hashedPassword = await Auth.hashPassword(password);
            
            db.createUser(sanitizedUsername, sanitizedEmail, hashedPassword, (err, userId) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: 'Failed to create user'
                    });
                }

                const token = Auth.generateToken(userId, sanitizedUsername, sanitizedEmail);

                res.status(201).json({
                    success: true,
                    message: 'User registered successfully',
                    token,
                    user: {
                        id: userId,
                        username: sanitizedUsername,
                        email: sanitizedEmail
                    }
                });
            });
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// User login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        const sanitizedEmail = Auth.sanitizeInput(email);

        db.getUserByEmail(sanitizedEmail, async (err, user) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: 'Database error'
                });
            }

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid email or password'
                });
            }

            const isValidPassword = await Auth.comparePassword(password, user.password);
            
            if (!isValidPassword) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid email or password'
                });
            }

            const token = Auth.generateToken(user.id, user.username, user.email);

            res.json({
                success: true,
                message: 'Login successful',
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    avatar: user.avatar
                }
            });
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get user profile
app.get('/api/profile', Auth.authenticateToken, (req, res) => {
    db.getUserById(req.user.userId, (err, user) => {
        if (err || !user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                avatar: user.avatar,
                status: user.status
            }
        });
    });
});

// Get online users
app.get('/api/users/online', Auth.authenticateToken, (req, res) => {
    db.getOnlineUsers((err, users) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch online users'
            });
        }

        // Filter out current user
        const filteredUsers = users.filter(user => user.id !== req.user.userId);

        res.json({
            success: true,
            users: filteredUsers
        });
    });
});

// Get messages between two users
app.get('/api/messages/:userId', Auth.authenticateToken, (req, res) => {
    const otherUserId = parseInt(req.params.userId);
    
    db.getMessages(req.user.userId, otherUserId, 50, (err, messages) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch messages'
            });
        }

        res.json({
            success: true,
            messages: messages.reverse() // Reverse to show oldest first
        });
    });
});

// File upload endpoint
app.post('/api/upload', Auth.authenticateToken, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: 'No file uploaded'
        });
    }

    res.json({
        success: true,
        fileUrl: `/uploads/${req.file.filename}`,
        fileName: req.file.originalname,
        fileSize: req.file.size
    });
});

// Socket.IO connection handling
io.use(Auth.authenticateSocket);

io.on('connection', (socket) => {
    console.log(`User ${socket.username} connected with socket ${socket.id}`);

    // Store user connection
    onlineUsers.set(socket.userId, {
        username: socket.username,
        socketId: socket.id,
        status: 'online'
    });
    userSockets.set(socket.id, socket.userId);

    // Update user status in database
    db.updateUserStatus(socket.userId, 'online', (err) => {
        if (err) console.error('Failed to update user status:', err);
    });

    // Broadcast updated online users list
    socket.broadcast.emit('user_online', {
        userId: socket.userId,
        username: socket.username
    });

    // Send current online users to the newly connected user
    const onlineUsersList = Array.from(onlineUsers.entries())
        .filter(([userId]) => userId !== socket.userId)
        .map(([userId, userData]) => ({
            id: userId,
            username: userData.username,
            status: userData.status
        }));

    socket.emit('online_users', onlineUsersList);

    // Handle private messages
    socket.on('private_message', (data) => {
        const { receiverId, message, messageType = 'text', fileUrl = null } = data;

        // Save message to database
        db.saveMessage(socket.userId, receiverId, null, message, messageType, fileUrl, (err, messageId) => {
            if (err) {
                console.error('Failed to save message:', err);
                return;
            }

            const messageData = {
                id: messageId,
                senderId: socket.userId,
                senderUsername: socket.username,
                receiverId,
                message,
                messageType,
                fileUrl,
                timestamp: new Date().toISOString()
            };

            // Send to receiver if online
            const receiverData = onlineUsers.get(receiverId);
            if (receiverData) {
                io.to(receiverData.socketId).emit('new_message', messageData);
            }

            // Send confirmation to sender
            socket.emit('message_sent', messageData);
        });
    });

    // Handle typing indicators
    socket.on('typing_start', (data) => {
        const { receiverId } = data;
        const receiverData = onlineUsers.get(receiverId);
        if (receiverData) {
            io.to(receiverData.socketId).emit('user_typing', {
                userId: socket.userId,
                username: socket.username
            });
        }
    });

    socket.on('typing_stop', (data) => {
        const { receiverId } = data;
        const receiverData = onlineUsers.get(receiverId);
        if (receiverData) {
            io.to(receiverData.socketId).emit('user_stop_typing', {
                userId: socket.userId,
                username: socket.username
            });
        }
    });

    // Handle audio call signaling
    socket.on('call_user', (data) => {
        const { receiverId, offer } = data;
        const receiverData = onlineUsers.get(receiverId);
        
        if (receiverData) {
            io.to(receiverData.socketId).emit('incoming_call', {
                callerId: socket.userId,
                callerUsername: socket.username,
                offer
            });
        } else {
            socket.emit('call_failed', { message: 'User is offline' });
        }
    });

    socket.on('answer_call', (data) => {
        const { callerId, answer } = data;
        const callerData = onlineUsers.get(callerId);
        
        if (callerData) {
            io.to(callerData.socketId).emit('call_answered', {
                answer,
                receiverId: socket.userId
            });
        }
    });

    socket.on('reject_call', (data) => {
        const { callerId } = data;
        const callerData = onlineUsers.get(callerId);
        
        if (callerData) {
            io.to(callerData.socketId).emit('call_rejected', {
                receiverId: socket.userId
            });
        }
    });

    socket.on('end_call', (data) => {
        const { otherUserId } = data;
        const otherUserData = onlineUsers.get(otherUserId);
        
        if (otherUserData) {
            io.to(otherUserData.socketId).emit('call_ended', {
                userId: socket.userId
            });
        }
    });

    socket.on('ice_candidate', (data) => {
        const { receiverId, candidate } = data;
        const receiverData = onlineUsers.get(receiverId);
        
        if (receiverData) {
            io.to(receiverData.socketId).emit('ice_candidate', {
                senderId: socket.userId,
                candidate
            });
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`User ${socket.username} disconnected`);

        // Update user status in database
        db.updateUserStatus(socket.userId, 'offline', (err) => {
            if (err) console.error('Failed to update user status:', err);
        });

        // Remove from online users
        onlineUsers.delete(socket.userId);
        userSockets.delete(socket.id);

        // Broadcast user offline
        socket.broadcast.emit('user_offline', {
            userId: socket.userId,
            username: socket.username
        });
    });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down server...');
    db.close();
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

