// Global variables
let socket = null;
let currentUser = null;
let selectedUserId = null;
let selectedUsername = null;
let authToken = null;
let typingTimer = null;
let isTyping = false;

// DOM elements
const loadingScreen = document.getElementById('loading-screen');
const authScreen = document.getElementById('auth-screen');
const chatApp = document.getElementById('chat-app');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const onlineUsersList = document.getElementById('onlineUsersList');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const audioCallBtn = document.getElementById('audioCallBtn');
const currentUsername = document.getElementById('currentUsername');
const chatUsername = document.getElementById('chatUsername');
const chatUserStatus = document.getElementById('chatUserStatus');
const typingIndicator = document.getElementById('typingIndicator');
const typingText = document.getElementById('typingText');
const fileInput = document.getElementById('fileInput');
const emojiPicker = document.getElementById('emojiPicker');

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    // Hide loading screen after a short delay
    setTimeout(() => {
        loadingScreen.style.display = 'none';
        
        // Check for existing token
        const token = localStorage.getItem('chatToken');
        if (token) {
            authToken = token;
            validateTokenAndConnect();
        } else {
            authScreen.classList.remove('hidden');
        }
    }, 1000);

    // Setup event listeners
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Auth forms
    loginForm.addEventListener('submit', handleLogin);
    registerForm.addEventListener('submit', handleRegister);

    // Message input
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    messageInput.addEventListener('input', handleTyping);
    sendBtn.addEventListener('click', sendMessage);

    // File input
    fileInput.addEventListener('change', handleFileUpload);

    // Click outside emoji picker to close
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.emoji-picker') && !e.target.closest('.emoji-btn')) {
            emojiPicker.classList.add('hidden');
        }
    });

    // Theme toggle
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

// Validate token and connect
async function validateTokenAndConnect() {
    try {
        const response = await fetch('/api/profile', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            showChatApp();
            connectSocket();
        } else {
            localStorage.removeItem('chatToken');
            authScreen.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Token validation error:', error);
        localStorage.removeItem('chatToken');
        authScreen.classList.remove('hidden');
    }
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (data.success) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('chatToken', authToken);
            
            showNotification('Login successful!', 'success');
            showChatApp();
            connectSocket();
        } else {
            showNotification(data.message, 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('Login failed. Please try again.', 'error');
    }
}

// Handle registration
async function handleRegister(e) {
    e.preventDefault();
    
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();

        if (data.success) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('chatToken', authToken);
            
            showNotification('Registration successful!', 'success');
            showChatApp();
            connectSocket();
        } else {
            showNotification(data.message, 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showNotification('Registration failed. Please try again.', 'error');
    }
}

// Show chat app
function showChatApp() {
    authScreen.classList.add('hidden');
    chatApp.classList.remove('hidden');
    currentUsername.textContent = currentUser.username;
}

// Connect to Socket.IO
function connectSocket() {
    socket = io({
        auth: {
            token: authToken
        }
    });

    socket.on('connect', () => {
        console.log('Connected to server');
        showNotification('Connected to chat server', 'success');
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        showNotification('Disconnected from server', 'error');
    });

    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        showNotification('Connection failed', 'error');
    });

    // Handle online users
    socket.on('online_users', (users) => {
        updateOnlineUsers(users);
    });

    socket.on('user_online', (user) => {
        addOnlineUser(user);
        showNotification(`${user.username} is now online`, 'info');
    });

    socket.on('user_offline', (user) => {
        removeOnlineUser(user.userId);
        showNotification(`${user.username} went offline`, 'info');
    });

    // Handle messages
    socket.on('new_message', (message) => {
        if (message.senderId === selectedUserId) {
            displayMessage(message, false);
            scrollToBottom();
        } else {
            showNotification(`New message from ${message.senderUsername}`, 'info');
        }
    });

    socket.on('message_sent', (message) => {
        displayMessage(message, true);
        scrollToBottom();
    });

    // Handle typing indicators
    socket.on('user_typing', (data) => {
        if (data.userId === selectedUserId) {
            showTypingIndicator(data.username);
        }
    });

    socket.on('user_stop_typing', (data) => {
        if (data.userId === selectedUserId) {
            hideTypingIndicator();
        }
    });

    // Handle call events
    socket.on('incoming_call', handleIncomingCall);
    socket.on('call_answered', handleCallAnswered);
    socket.on('call_rejected', handleCallRejected);
    socket.on('call_ended', handleCallEnded);
    socket.on('call_failed', (data) => {
        showNotification(data.message, 'error');
    });
}

// Update online users list
function updateOnlineUsers(users) {
    onlineUsersList.innerHTML = '';
    users.forEach(user => {
        addOnlineUser(user);
    });
}

// Add online user to list
function addOnlineUser(user) {
    const existingUser = document.querySelector(`[data-user-id="${user.id}"]`);
    if (existingUser) return;

    const userElement = document.createElement('div');
    userElement.className = 'user-item';
    userElement.setAttribute('data-user-id', user.id);
    userElement.onclick = () => selectUser(user.id, user.username);

    userElement.innerHTML = `
        <div class="user-avatar">
            <i class="fas fa-user"></i>
        </div>
        <div class="user-info">
            <h4>${user.username}</h4>
            <span class="status online">Online</span>
        </div>
    `;

    onlineUsersList.appendChild(userElement);
}

// Remove online user from list
function removeOnlineUser(userId) {
    const userElement = document.querySelector(`[data-user-id="${userId}"]`);
    if (userElement) {
        userElement.remove();
    }

    // Update status if this is the selected user
    if (userId === selectedUserId) {
        chatUserStatus.textContent = 'Offline';
        chatUserStatus.className = 'status offline';
        audioCallBtn.disabled = true;
    }
}

// Select user for chat
async function selectUser(userId, username) {
    selectedUserId = userId;
    selectedUsername = username;

    // Update UI
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-user-id="${userId}"]`).classList.add('active');

    chatUsername.textContent = username;
    chatUserStatus.textContent = 'Online';
    chatUserStatus.className = 'status online';

    // Enable controls
    messageInput.disabled = false;
    sendBtn.disabled = false;
    audioCallBtn.disabled = false;

    // Load message history
    await loadMessageHistory(userId);
}

// Load message history
async function loadMessageHistory(userId) {
    try {
        const response = await fetch(`/api/messages/${userId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            messagesContainer.innerHTML = '';
            
            data.messages.forEach(message => {
                const isSent = message.sender_id === currentUser.id;
                displayMessage({
                    id: message.id,
                    senderId: message.sender_id,
                    senderUsername: message.sender_username,
                    message: message.message,
                    messageType: message.message_type,
                    fileUrl: message.file_url,
                    timestamp: message.created_at
                }, isSent);
            });

            scrollToBottom();
        }
    } catch (error) {
        console.error('Error loading message history:', error);
    }
}

// Display message
function displayMessage(messageData, isSent) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isSent ? 'sent' : 'received'}`;

    const time = new Date(messageData.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });

    let messageContent = '';
    
    if (messageData.messageType === 'file' && messageData.fileUrl) {
        const fileName = messageData.message;
        const fileExtension = fileName.split('.').pop().toLowerCase();
        let fileIcon = 'fas fa-file';
        
        if (['jpg', 'jpeg', 'png', 'gif'].includes(fileExtension)) {
            fileIcon = 'fas fa-image';
        } else if (['pdf'].includes(fileExtension)) {
            fileIcon = 'fas fa-file-pdf';
        } else if (['doc', 'docx'].includes(fileExtension)) {
            fileIcon = 'fas fa-file-word';
        }

        messageContent = `
            <div class="message-content">
                <div class="file-message">
                    <div class="file-icon">
                        <i class="${fileIcon}"></i>
                    </div>
                    <div class="file-info">
                        <h4>${fileName}</h4>
                        <p><a href="${messageData.fileUrl}" target="_blank" style="color: inherit;">Download</a></p>
                    </div>
                </div>
            </div>
        `;
    } else {
        messageContent = `
            <div class="message-content">${escapeHtml(messageData.message)}</div>
        `;
    }

    messageElement.innerHTML = `
        <div class="message-bubble">
            ${messageContent}
            <div class="message-time">${time}</div>
        </div>
    `;

    messagesContainer.appendChild(messageElement);
}

// Send message
function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || !selectedUserId) return;

    socket.emit('private_message', {
        receiverId: selectedUserId,
        message: message,
        messageType: 'text'
    });

    messageInput.value = '';
    stopTyping();
}

// Handle typing
function handleTyping() {
    if (!selectedUserId) return;

    if (!isTyping) {
        isTyping = true;
        socket.emit('typing_start', { receiverId: selectedUserId });
    }

    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
        stopTyping();
    }, 1000);
}

// Stop typing
function stopTyping() {
    if (isTyping && selectedUserId) {
        isTyping = false;
        socket.emit('typing_stop', { receiverId: selectedUserId });
    }
}

// Show typing indicator
function showTypingIndicator(username) {
    typingText.textContent = `${username} is typing...`;
    typingIndicator.classList.remove('hidden');
}

// Hide typing indicator
function hideTypingIndicator() {
    typingIndicator.classList.add('hidden');
}

// Handle file upload
async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file || !selectedUserId) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            
            socket.emit('private_message', {
                receiverId: selectedUserId,
                message: data.fileName,
                messageType: 'file',
                fileUrl: data.fileUrl
            });

            showNotification('File uploaded successfully', 'success');
        } else {
            showNotification('File upload failed', 'error');
        }
    } catch (error) {
        console.error('File upload error:', error);
        showNotification('File upload failed', 'error');
    }

    // Reset file input
    fileInput.value = '';
}

// Utility functions
function switchToRegister() {
    document.getElementById('login-form').classList.remove('active');
    document.getElementById('register-form').classList.add('active');
}

function switchToLogin() {
    document.getElementById('register-form').classList.remove('active');
    document.getElementById('login-form').classList.add('active');
}

function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const button = input.nextElementSibling;
    const icon = button.querySelector('i');

    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    const themeIcon = document.querySelector('.sidebar-actions .action-btn i');
    themeIcon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

function openFileUpload() {
    fileInput.click();
}

function toggleEmojiPicker() {
    emojiPicker.classList.toggle('hidden');
}

function insertEmoji(emoji) {
    messageInput.value += emoji;
    messageInput.focus();
    emojiPicker.classList.add('hidden');
}

function clearChat() {
    if (confirm('Are you sure you want to clear this chat?')) {
        messagesContainer.innerHTML = `
            <div class="welcome-message">
                <i class="fas fa-comments"></i>
                <h3>Chat Cleared</h3>
                <p>Start a new conversation with ${selectedUsername}</p>
            </div>
        `;
    }
}

function showSettings() {
    showNotification('Settings feature coming soon!', 'info');
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('chatToken');
        if (socket) {
            socket.disconnect();
        }
        location.reload();
    }
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    notification.innerHTML = `
        <h4>${type.charAt(0).toUpperCase() + type.slice(1)}</h4>
        <p>${message}</p>
    `;

    document.getElementById('notificationContainer').appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Audio call functions (will be implemented in webrtc.js)
function startAudioCall() {
    if (selectedUserId && window.webRTC) {
        window.webRTC.startCall(selectedUserId, selectedUsername);
    }
}

function handleIncomingCall(data) {
    if (window.webRTC) {
        window.webRTC.handleIncomingCall(data);
    }
}

function handleCallAnswered(data) {
    if (window.webRTC) {
        window.webRTC.handleCallAnswered(data);
    }
}

function handleCallRejected(data) {
    if (window.webRTC) {
        window.webRTC.handleCallRejected(data);
    }
}

function handleCallEnded(data) {
    if (window.webRTC) {
        window.webRTC.handleCallEnded(data);
    }
}

function acceptCall() {
    if (window.webRTC) {
        window.webRTC.acceptCall();
    }
}

function rejectCall() {
    if (window.webRTC) {
        window.webRTC.rejectCall();
    }
}

function endCall() {
    if (window.webRTC) {
        window.webRTC.endCall();
    }
}

function toggleMute() {
    if (window.webRTC) {
        window.webRTC.toggleMute();
    }
}

function toggleSpeaker() {
    if (window.webRTC) {
        window.webRTC.toggleSpeaker();
    }
}

