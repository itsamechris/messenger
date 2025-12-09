const express = require('express');
const http = require('http');
const  WebSocket = require('ws');
const path = require('path');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, PORT } = require('./config');
const authRoutes = require('./routes/auth');
const { initializeDatabase } = require('./database/db');


const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server })    ;
// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth', authRoutes);

// Store active WebSocket connections
const clients = new Map(); // userId -> { ws, username, status }

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection');
  
  let userId = null;
  let username = null;

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      // Handle different message types
      switch (data.type) {
        case 'auth':
          // Authenticate WebSocket connection
          try {
            const decoded = jwt.verify(data.token, JWT_SECRET);
            userId = decoded.userId;
            username = decoded.username;
            
            // Store client connection
            clients.set(userId, { ws, username, status: 'online' });
            
            // Send authentication success
            ws.send(JSON.stringify({
              type: 'auth_success',
              userId,
              username
            }));
            
            // Broadcast user online status to all clients
            broadcastUserStatus(userId, username, 'online');
            
            // Send list of online users
            sendOnlineUsers(ws);

            // Send list of groups
            const groupController = require('./controllers/groupController');
            await groupController.handleGetGroups(userId, ws);
            
          } catch (error) {
            ws.send(JSON.stringify({
              type: 'auth_error',
              message: 'Invalid token'
            }));
            ws.close();
          }
          break;

        case 'message':
          // Handle text message
          if (userId) {
            const messageController = require('./controllers/messageController');
            await messageController.handleMessage(data, userId, username, clients);
          }
          break;

        case 'create_group':
          // Handle group creation
          if (userId) {
            const groupController = require('./controllers/groupController');
            await groupController.handleCreateGroup(data, userId, username, clients);
          }
          break;

        case 'group_message':
          // Handle group message
          if (userId) {
            const groupController = require('./controllers/groupController');
            await groupController.handleGroupMessage(data, userId, username, clients);
          }
          break;

        case 'get_group_messages':
          // Handle getting group messages
          if (userId) {
            const groupController = require('./controllers/groupController');
            await groupController.handleGetGroupMessages(data, userId, ws);
          }
          break;

        case 'typing':
          // Handle typing indicator
          if (userId && data.to) {
            const recipient = clients.get(data.to);
            if (recipient && recipient.ws.readyState === WebSocket.OPEN) {
              recipient.ws.send(JSON.stringify({
                type: 'typing',
                from: userId,
                username: username,
                isTyping: data.isTyping
              }));
            }
          }
          break;

        case 'get_messages':
          // Retrieve message history
          if (userId) {
            const messageController = require('./controllers/messageController');
            await messageController.getMessages(data, userId, ws);
          }
          break;

        case 'webrtc_offer':
        case 'webrtc_answer':
        case 'webrtc_ice_candidate':
        case 'call_request':
        case 'call_response':
        case 'call_end':
          // Handle WebRTC signaling
          if (userId) {
            const callController = require('./controllers/callController');
            callController.handleSignaling(data, userId, username, clients);
          }
          break;

        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Error processing message'
      }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    if (userId) {
      clients.delete(userId);
      broadcastUserStatus(userId, username, 'offline');
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Broadcast user status to all connected clients
function broadcastUserStatus(userId, username, status) {
  const statusMessage = JSON.stringify({
    type: 'user_status',
    userId,
    username,
    status
  });

  clients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(statusMessage);
    }
  });
}

// Send list of online users to a specific client
function sendOnlineUsers(ws) {
  const onlineUsers = [];
  clients.forEach((client, userId) => {
    onlineUsers.push({
      userId,
      username: client.username,
      status: client.status
    });
  });

  ws.send(JSON.stringify({
    type: 'online_users',
    users: onlineUsers
  }));
}

// Initialize database
initializeDatabase();

// Start server
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Export for use in controllers
module.exports = { clients };
