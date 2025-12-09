const { v4: uuidv4 } = require('uuid');
const { createGroup, addMessage, readGroups, getGroupMessages, getGroupsForUser } = require('../database/db');
const WebSocket = require('ws');

// Handle creating a new group
async function handleCreateGroup(data, userId, username, clients) {
  try {
    const { name, members } = data;

    if (!name || !members || !Array.isArray(members)) {
      return;
    }

    // Add creator to members if not already included
    if (!members.includes(userId)) {
      members.push(userId);
    }

    const group = {
      groupId: uuidv4(),
      name: name,
      members: members,
      createdBy: userId,
      createdAt: new Date().toISOString()
    };

    await createGroup(group);

    // Notify all members about the new group
    members.forEach(memberId => {
      const client = clients.get(memberId);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify({
          type: 'group_created',
          group: group
        }));
      }
    });

  } catch (error) {
    console.error('Error creating group:', error);
  }
}

// Handle incoming group message
async function handleGroupMessage(data, userId, username, clients) {
  try {
    const { groupId, content } = data;

    if (!groupId || !content) {
      return;
    }

    // Verify user is member of group
    const groups = await readGroups();
    const group = groups.find(g => g.groupId === groupId);
    
    if (!group || !group.members.includes(userId)) {
      return;
    }

    // Create message object
    const message = {
      messageId: uuidv4(),
      groupId: groupId,
      from: userId,
      fromUsername: username,
      content: content,
      timestamp: new Date().toISOString(),
      read: false // Maybe track read status per user later
    };

    // Save message to database
    await addMessage(message);

    // Send message to all group members
    group.members.forEach(memberId => {
      // Don't send back to sender (optional, but usually we want to confirm or just append locally)
      // But here we send to everyone including sender for simplicity/consistency
      const client = clients.get(memberId);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify({
          type: 'group_message',
          message: message,
          groupName: group.name
        }));
      }
    });

  } catch (error) {
    console.error('Error handling group message:', error);
  }
}

// Get group message history
async function handleGetGroupMessages(data, userId, ws) {
  try {
    const { groupId } = data;

    if (!groupId) {
      return;
    }

    // Verify user is member of group
    const groups = await readGroups();
    const group = groups.find(g => g.groupId === groupId);
    
    if (!group || !group.members.includes(userId)) {
      return;
    }

    // Retrieve messages from database
    const messages = await getGroupMessages(groupId);

    // Send messages to requesting client
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'group_message_history',
        messages: messages,
        groupId: groupId
      }));
    }

  } catch (error) {
    console.error('Error getting group messages:', error);
  }
}

// Get groups for user
async function handleGetGroups(userId, ws) {
  try {
    const groups = await getGroupsForUser(userId);
    
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'group_list',
        groups: groups
      }));
    }
  } catch (error) {
    console.error('Error getting groups:', error);
  }
}

module.exports = {
  handleCreateGroup,
  handleGroupMessage,
  handleGetGroupMessages,
  handleGetGroups
};
