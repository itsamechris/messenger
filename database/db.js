const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

// Initialize database files
async function initializeDatabase() {
  try {
    // Create data directory if it doesn't exist
    await fs.mkdir(DATA_DIR, { recursive: true });

    // Initialize users file
    try {
      await fs.access(USERS_FILE);
    } catch {
      await fs.writeFile(USERS_FILE, JSON.stringify([], null, 2));
      console.log('Created users.json');
    }

    // Initialize messages file
    try {
      await fs.access(MESSAGES_FILE);
    } catch {
      await fs.writeFile(MESSAGES_FILE, JSON.stringify([], null, 2));
      console.log('Created messages.json');
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// Read users
async function readUsers() {
  try {
    const data = await fs.readFile(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading users:', error);
    return [];
  }
}

// Write users
async function writeUsers(users) {
  try {
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (error) {
    console.error('Error writing users:', error);
    throw error;
  }
}

// Read messages
async function readMessages() {
  try {
    const data = await fs.readFile(MESSAGES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading messages:', error);
    return [];
  }
}

// Write messages
async function writeMessages(messages) {
  try {
    await fs.writeFile(MESSAGES_FILE, JSON.stringify(messages, null, 2));
  } catch (error) {
    console.error('Error writing messages:', error);
    throw error;
  }
}

// Get messages between two users
async function getMessagesBetweenUsers(userId1, userId2) {
  try {
    const allMessages = await readMessages();
    return allMessages.filter(msg => 
      (msg.from === userId1 && msg.to === userId2) ||
      (msg.from === userId2 && msg.to === userId1)
    ).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  } catch (error) {
    console.error('Error getting messages between users:', error);
    return [];
  }
}

// Add a new message
async function addMessage(messageData) {
  try {
    const messages = await readMessages();
    messages.push(messageData);
    await writeMessages(messages);
    return messageData;
  } catch (error) {
    console.error('Error adding message:', error);
    throw error;
  }
}

module.exports = {
  initializeDatabase,
  readUsers,
  writeUsers,
  readMessages,
  writeMessages,
  getMessagesBetweenUsers,
  addMessage
};
