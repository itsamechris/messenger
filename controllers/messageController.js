const { v4: uuidv4 } = require('uuid');
const { addMessage, getMessagesBetweenUsers } = require('../database/db');
const WebSocket = require('ws');

// Handle incoming chat message
async function handleMessage(data, userId, username, clients) {
  try {
    const { to, content } = data;

    if (!to || !content) {
      return;
    }

    // Create message object
    const message = {
      messageId: uuidv4(),
      from: userId,
      fromUsername: username,
      to: to,
      content: content,
      timestamp: new Date().toISOString(),
      read: false
    };

    // Save message to database
    await addMessage(message);

    // Send message to recipient if online
    const recipient = clients.get(to);
    if (recipient && recipient.ws.readyState === WebSocket.OPEN) {
      recipient.ws.send(JSON.stringify({
        type: 'message',
        message: message
      }));
    }

    // Send confirmation back to sender
    const sender = clients.get(userId);
    if (sender && sender.ws.readyState === WebSocket.OPEN) {
      sender.ws.send(JSON.stringify({
        type: 'message_sent',
        message: message
      }));
    }

  } catch (error) {
    console.error('Error handling message:', error);
  }
}

// Get message history between users
async function getMessages(data, userId, ws) {
  try {
    const { otherUserId } = data;

    if (!otherUserId) {
      return;
    }

    // Retrieve messages from database
    const messages = await getMessagesBetweenUsers(userId, otherUserId);

    // Send messages to requesting client
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'message_history',
        messages: messages,
        otherUserId: otherUserId
      }));
    }

  } catch (error) {
    console.error('Error getting messages:', error);
  }
}

module.exports = {
  handleMessage,
  getMessages
};
