# Live Chat & Audio Call Application

A comprehensive real-time messaging and audio calling application built with Node.js, Socket.IO, and WebRTC. Features modern UI/UX design, user authentication, persistent sessions, and advanced chat functionality.

## 🚀 Features

### Core Features
- **User Authentication**: Secure registration and login with JWT tokens
- **Persistent Sessions**: Stay logged in across browser sessions
- **Real-time Messaging**: Instant messaging with Socket.IO
- **Audio Calling**: WebRTC-powered voice calls between users
- **Online Status**: See who's online in real-time
- **Message History**: Persistent message storage with SQLite

### Advanced Features
- **File Sharing**: Upload and share images, documents, and files
- **Typing Indicators**: See when someone is typing
- **Emoji Support**: Built-in emoji picker for expressive messaging
- **Theme Toggle**: Dark/Light mode support
- **Responsive Design**: Mobile-friendly interface
- **Notifications**: Real-time notifications for messages and calls
- **Search Functionality**: Search for users
- **Modern UI**: Beautiful gradient design with smooth animations

### Security Features
- **Password Hashing**: Secure bcrypt password hashing
- **Input Validation**: Comprehensive input sanitization
- **JWT Authentication**: Secure token-based authentication
- **CORS Protection**: Proper cross-origin request handling

## 🛠️ Technology Stack

### Backend
- **Node.js**: Runtime environment
- **Express.js**: Web framework
- **Socket.IO**: Real-time communication
- **SQLite**: Database for data persistence
- **bcryptjs**: Password hashing
- **jsonwebtoken**: JWT authentication
- **multer**: File upload handling
- **uuid**: Unique identifier generation

### Frontend
- **HTML5**: Modern semantic markup
- **CSS3**: Advanced styling with CSS Grid/Flexbox
- **JavaScript (ES6+)**: Modern JavaScript features
- **WebRTC**: Peer-to-peer audio calling
- **Font Awesome**: Icon library
- **Google Fonts**: Typography (Inter font family)

## 📦 Installation

### Prerequisites
- Node.js (v14 or higher)
- npm (Node Package Manager)

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd live-chat-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the application**
   ```bash
   npm start
   ```

4. **Access the application**
   Open your browser and navigate to `http://localhost:3000`

## 🚀 Usage

### Getting Started
1. **Register**: Create a new account with username, email, and password
2. **Login**: Sign in with your credentials
3. **Chat**: Select online users from the sidebar to start messaging
4. **Call**: Click the phone icon to initiate audio calls
5. **Share**: Use the attachment button to share files
6. **Customize**: Toggle between light and dark themes

### User Interface
- **Sidebar**: Shows your profile, online users, and search functionality
- **Chat Area**: Main messaging interface with typing indicators
- **Message Input**: Send text messages, emojis, and files
- **Call Interface**: Audio call controls with mute and speaker options

## 🔧 Configuration

### Environment Variables
Create a `.env` file in the root directory:
```env
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-change-in-production
```

### Database
The application uses SQLite for data storage. The database file (`chat_app.db`) is automatically created on first run.

## 📱 API Endpoints

### Authentication
- `POST /api/register` - User registration
- `POST /api/login` - User login
- `GET /api/profile` - Get user profile (authenticated)

### Users
- `GET /api/users/online` - Get online users (authenticated)

### Messages
- `GET /api/messages/:userId` - Get message history (authenticated)

### File Upload
- `POST /api/upload` - Upload files (authenticated)

## 🔌 Socket.IO Events

### Client to Server
- `private_message` - Send private message
- `typing_start` - Start typing indicator
- `typing_stop` - Stop typing indicator
- `call_user` - Initiate audio call
- `answer_call` - Answer incoming call
- `reject_call` - Reject incoming call
- `end_call` - End active call
- `ice_candidate` - WebRTC ICE candidate exchange

### Server to Client
- `online_users` - List of online users
- `user_online` - User came online
- `user_offline` - User went offline
- `new_message` - Receive new message
- `message_sent` - Message sent confirmation
- `user_typing` - User typing indicator
- `user_stop_typing` - User stopped typing
- `incoming_call` - Incoming call notification
- `call_answered` - Call answered
- `call_rejected` - Call rejected
- `call_ended` - Call ended
- `call_failed` - Call failed

## 🎨 UI/UX Features

### Design Elements
- **Modern Gradient Backgrounds**: Beautiful purple-blue gradients
- **Smooth Animations**: CSS transitions and keyframe animations
- **Responsive Layout**: Mobile-first design approach
- **Accessibility**: Proper focus states and ARIA labels
- **Dark/Light Theme**: Complete theme switching capability

### Interactive Elements
- **Hover Effects**: Smooth button and element interactions
- **Loading States**: Visual feedback for user actions
- **Notifications**: Toast-style notifications for events
- **Modal Dialogs**: Call interfaces and confirmations

## 🔒 Security Considerations

### Authentication
- Passwords are hashed using bcrypt with salt rounds
- JWT tokens have expiration times
- Input validation and sanitization on all endpoints

### Data Protection
- SQL injection prevention with parameterized queries
- XSS protection through input sanitization
- CORS configuration for secure cross-origin requests

## 🚀 Deployment

### Production Setup
1. Set environment variables for production
2. Use a process manager like PM2
3. Configure reverse proxy (nginx)
4. Set up SSL certificates
5. Use production database (PostgreSQL/MySQL)

### Docker Deployment
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Socket.IO for real-time communication
- WebRTC for peer-to-peer audio calling
- Font Awesome for beautiful icons
- Google Fonts for typography
- The Node.js and Express.js communities

## 📞 Support

For support, email support@example.com or create an issue in the GitHub repository.

## 🔮 Future Enhancements

- Video calling support
- Group chat functionality
- Message reactions and replies
- File preview capabilities
- Push notifications
- Mobile app development
- End-to-end encryption
- Screen sharing
- Chat rooms and channels
- User presence indicators
- Message search functionality
- Voice messages
- Stickers and GIFs support

---

**Built with ❤️ using Node.js, Socket.IO, and WebRTC**

