// Global state
let currentUser = null;
let token = null;
let ws = null;
let selectedUser = null;
let allUsers = [];
let onlineUsers = new Set();
let messages = {};
let groups = [];
let selectedGroup = null;

// WebRTC variables
let peerConnection = null;
let localStream = null;
let remoteStream = null;
let callType = null;
let callStartTime = null;
let callTimerInterval = null;

const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// DOM Elements
const authContainer = document.getElementById('auth-container');
const chatContainer = document.getElementById('chat-container');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showRegisterLink = document.getElementById('show-register');
const showLoginLink = document.getElementById('show-login');
const authError = document.getElementById('auth-error');

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  // Check for saved token
  token = localStorage.getItem('token');
  if (token) {
    verifyToken();
  }

  // Auth form switching
  showRegisterLink.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('login-form').classList.remove('active');
    document.getElementById('register-form').classList.add('active');
    authError.textContent = '';
  });

  showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('register-form').classList.remove('active');
    document.getElementById('login-form').classList.add('active');
    authError.textContent = '';
  });

  // Login form submit
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    await login(username, password);
  });

  // Register form submit
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    await register(username, email, password);
  });

  // Logout
  document.getElementById('logout-btn').addEventListener('click', logout);

  // Message form
  document.getElementById('message-form').addEventListener('submit', sendMessage);

  // Typing indicator
  let typingTimeout;
  document.getElementById('message-input').addEventListener('input', () => {
    if (selectedUser && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'typing',
        to: selectedUser.userId,
        isTyping: true
      }));

      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        ws.send(JSON.stringify({
          type: 'typing',
          to: selectedUser.userId,
          isTyping: false
        }));
      }, 1000);
    }
  });

  // Search users
  document.getElementById('search-users').addEventListener('input', (e) => {
    filterUsers(e.target.value);
  });

  // Call buttons
  document.getElementById('voice-call-btn').addEventListener('click', () => initiateCall('voice'));
  document.getElementById('video-call-btn').addEventListener('click', () => initiateCall('video'));

  // Call modal buttons
  document.getElementById('accept-call-btn').addEventListener('click', acceptCall);
  document.getElementById('reject-call-btn').addEventListener('click', rejectCall);
  document.getElementById('cancel-call-btn').addEventListener('click', cancelCall);
  document.getElementById('end-call-btn').addEventListener('click', endCall);
  document.getElementById('toggle-audio-btn').addEventListener('click', toggleAudio);
  document.getElementById('toggle-video-btn').addEventListener('click', toggleVideo);

  // Group modal
  const createGroupBtn = document.getElementById('create-group-btn');
  const createGroupModal = document.getElementById('create-group-modal');
  const closeGroupModal = document.getElementById('close-group-modal');
  const createGroupForm = document.getElementById('create-group-form');

  if (createGroupBtn) {
    createGroupBtn.addEventListener('click', () => {
      createGroupModal.classList.remove('hidden');
      populateGroupMembersSelection();
    });
  }

  if (closeGroupModal) {
    closeGroupModal.addEventListener('click', () => {
      createGroupModal.classList.add('hidden');
    });
  }

  if (createGroupForm) {
    createGroupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      createGroup();
    });
  }
});

// Authentication functions
async function register(username, email, password) {
  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });

    const data = await response.json();

    if (data.success) {
      token = data.token;
      currentUser = data.user;
      localStorage.setItem('token', token);
      showChat();
      connectWebSocket();
    } else {
      authError.textContent = data.message;
    }
  } catch (error) {
    console.error('Registration error:', error);
    authError.textContent = 'Registration failed. Please try again.';
  }
}

async function login(username, password) {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (data.success) {
      token = data.token;
      currentUser = data.user;
      localStorage.setItem('token', token);
      showChat();
      connectWebSocket();
    } else {
      authError.textContent = data.message;
    }
  } catch (error) {
    console.error('Login error:', error);
    authError.textContent = 'Login failed. Please try again.';
  }
}

async function verifyToken() {
  try {
    const response = await fetch('/api/auth/verify', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();

    if (data.success) {
      currentUser = data.user;
      showChat();
      connectWebSocket();
    } else {
      localStorage.removeItem('token');
      token = null;
    }
  } catch (error) {
    console.error('Token verification error:', error);
    localStorage.removeItem('token');
    token = null;
  }
}

function logout() {
  if (ws) {
    ws.close();
  }
  localStorage.removeItem('token');
  token = null;
  currentUser = null;
  authContainer.classList.remove('hidden');
  chatContainer.classList.add('hidden');
  loginForm.reset();
  registerForm.reset();
}

function populateGroupMembersSelection() {
  const container = document.getElementById('group-members-selection');
  container.innerHTML = '';
  
  allUsers.forEach(user => {
    if (user.userId !== currentUser.userId) {
      const div = document.createElement('div');
      div.style.marginBottom = '5px';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = user.userId;
      checkbox.id = `user-${user.userId}`;
      
      const label = document.createElement('label');
      label.htmlFor = `user-${user.userId}`;
      label.textContent = user.username;
      label.style.marginLeft = '5px';
      
      div.appendChild(checkbox);
      div.appendChild(label);
      container.appendChild(div);
    }
  });
}

function createGroup() {
  const name = document.getElementById('group-name').value;
  const checkboxes = document.querySelectorAll('#group-members-selection input[type="checkbox"]:checked');
  const members = Array.from(checkboxes).map(cb => cb.value);
  
  if (name && members.length > 0) {
    ws.send(JSON.stringify({
      type: 'create_group',
      name: name,
      members: members
    }));
    
    document.getElementById('create-group-modal').classList.add('hidden');
    document.getElementById('group-name').value = '';
  }
}

function showChat() {
  authContainer.classList.add('hidden');
  chatContainer.classList.remove('hidden');
  document.getElementById('current-username').textContent = currentUser.username;
  loadUsers();
}

// WebSocket connection
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;
  
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('WebSocket connected');
    // Authenticate WebSocket connection
    ws.send(JSON.stringify({
      type: 'auth',
      token: token
    }));
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleWebSocketMessage(data);
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');
    // Attempt to reconnect after 3 seconds
    setTimeout(() => {
      if (token && currentUser) {
        connectWebSocket();
      }
    }, 3000);
  };
}

function handleWebSocketMessage(data) {
  switch (data.type) {
    case 'auth_success':
      console.log('WebSocket authenticated');
      break;

    case 'online_users':
      data.users.forEach(user => {
        if (user.userId !== currentUser.userId) {
          onlineUsers.add(user.userId);
        }
      });
      updateUsersList();
      break;

    case 'user_status':
      if (data.status === 'online') {
        onlineUsers.add(data.userId);
      } else {
        onlineUsers.delete(data.userId);
      }
      updateUserStatus(data.userId, data.status);
      break;

    case 'message':
      receiveMessage(data.message);
      break;

    case 'message_sent':
      receiveMessage(data.message);
      break;

    case 'group_list':
      groups = data.groups;
      updateGroupsList();
      break;

    case 'group_created':
      groups.push(data.group);
      updateGroupsList();
      break;

    case 'group_message':
      receiveGroupMessage(data.message, data.groupName);
      break;

    case 'group_message_history':
      if (selectedGroup && selectedGroup.groupId === data.groupId) {
        loadMessageHistory(data.messages, null, true);
      }
      break;

    case 'message_history':
      loadMessageHistory(data.messages, data.otherUserId);
      break;

    case 'typing':
      showTypingIndicator(data.from, data.isTyping);
      break;

    case 'incoming_call':
      handleIncomingCall(data);
      break;

    case 'call_response':
      handleCallResponse(data);
      break;

    case 'webrtc_offer':
      handleWebRTCOffer(data);
      break;

    case 'webrtc_answer':
      handleWebRTCAnswer(data);
      break;

    case 'webrtc_ice_candidate':
      handleICECandidate(data);
      break;

    case 'call_ended':
      handleCallEnded();
      break;

    case 'call_error':
      alert(data.message);
      hideCallModal();
      break;
  }
}

// User management
async function loadUsers() {
  try {
    const response = await fetch('/api/auth/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();

    if (data.success) {
      allUsers = data.users;
      updateUsersList();
    }
  } catch (error) {
    console.error('Error loading users:', error);
  }
}

function updateUsersList() {
  const usersList = document.getElementById('users-list');
  usersList.innerHTML = '';

  allUsers.forEach(user => {
    const userItem = document.createElement('div');
    userItem.className = 'user-item';
    if (selectedUser && selectedUser.userId === user.userId) {
      userItem.classList.add('active');
    }

    const isOnline = onlineUsers.has(user.userId);
    const initial = user.username.charAt(0).toUpperCase();

    userItem.innerHTML = `
      <div class="user-avatar">
        <span>${initial}</span>
      </div>
      <div class="user-details">
        <div class="user-name">${user.username}</div>
        <div class="status ${isOnline ? 'online' : ''}">${isOnline ? 'Online' : 'Offline'}</div>
      </div>
    `;

    userItem.addEventListener('click', () => selectUser(user));
    usersList.appendChild(userItem);
  });
}

function selectUser(user) {
  selectedUser = user;
  selectedGroup = null;
  updateUsersList();
  updateGroupsList();
  showChatWindow(user);
  
  // Show call buttons
  const chatActions = document.querySelector('.chat-actions');
  if (chatActions) chatActions.style.display = 'flex';
  
  loadChatMessages(user.userId);
}

function updateGroupsList() {
  const groupsList = document.getElementById('groups-list');
  if (!groupsList) return;
  groupsList.innerHTML = '';

  groups.forEach(group => {
    const groupItem = document.createElement('div');
    groupItem.className = 'user-item';
    if (selectedGroup && selectedGroup.groupId === group.groupId) {
      groupItem.classList.add('active');
    }

    const initial = group.name.charAt(0).toUpperCase();

    groupItem.innerHTML = `
      <div class="user-avatar" style="background-color: #764ba2;">
        <span>${initial}</span>
      </div>
      <div class="user-details">
        <div class="user-name">${group.name}</div>
        <div class="status">${group.members.length} members</div>
      </div>
    `;

    groupItem.addEventListener('click', () => selectGroup(group));
    groupsList.appendChild(groupItem);
  });
}

function selectGroup(group) {
  selectedGroup = group;
  selectedUser = null;
  
  updateUsersList();
  updateGroupsList();
  
  document.getElementById('no-chat-selected').classList.add('hidden');
  document.getElementById('chat-window').classList.remove('hidden');
  
  document.getElementById('chat-username').textContent = group.name;
  document.getElementById('chat-user-status').textContent = `${group.members.length} members`;
  document.getElementById('chat-username-initial').textContent = group.name.charAt(0).toUpperCase();
  
  // Hide call buttons for groups
  const chatActions = document.querySelector('.chat-actions');
  if (chatActions) chatActions.style.display = 'none';
  
  // Clear messages
  document.getElementById('messages-area').innerHTML = '';
  
  // Request message history
  ws.send(JSON.stringify({
    type: 'get_group_messages',
    groupId: group.groupId
  }));
}

function showChatWindow(user) {
  document.getElementById('no-chat-selected').classList.add('hidden');
  document.getElementById('chat-window').classList.remove('hidden');

  const initial = user.username.charAt(0).toUpperCase();
  const isOnline = onlineUsers.has(user.userId);

  document.getElementById('chat-username-initial').textContent = initial;
  document.getElementById('chat-username').textContent = user.username;
  
  const statusEl = document.getElementById('chat-user-status');
  statusEl.textContent = isOnline ? 'Online' : 'Offline';
  statusEl.className = isOnline ? 'status online' : 'status';
}

function updateUserStatus(userId, status) {
  if (selectedUser && selectedUser.userId === userId) {
    const statusEl = document.getElementById('chat-user-status');
    statusEl.textContent = status === 'online' ? 'Online' : 'Offline';
    statusEl.className = status === 'online' ? 'status online' : 'status';
  }
  updateUsersList();
}

function filterUsers(searchTerm) {
  const userItems = document.querySelectorAll('.user-item');
  userItems.forEach(item => {
    const username = item.querySelector('.user-name').textContent.toLowerCase();
    if (username.includes(searchTerm.toLowerCase())) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
}

// Messaging functions
function loadChatMessages(userId) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'get_messages',
      otherUserId: userId
    }));
  }
}

function loadMessageHistory(msgs, otherUserId, isGroup = false) {
  if (isGroup) {
    const messagesArea = document.getElementById('messages-area');
    messagesArea.innerHTML = '';
    msgs.forEach(msg => displayMessage(msg));
  } else {
    if (!messages[otherUserId]) {
      messages[otherUserId] = [];
    }
    messages[otherUserId] = msgs;
    displayMessages();
  }
}

function sendMessage(e) {
  e.preventDefault();
  
  if (!selectedUser && !selectedGroup) return;

  const input = document.getElementById('message-input');
  const content = input.value.trim();

  if (!content) return;

  if (ws && ws.readyState === WebSocket.OPEN) {
    if (selectedGroup) {
      ws.send(JSON.stringify({
        type: 'group_message',
        groupId: selectedGroup.groupId,
        content: content
      }));
    } else {
      ws.send(JSON.stringify({
        type: 'message',
        to: selectedUser.userId,
        content: content
      }));
    }

    input.value = '';
  }
}

function receiveGroupMessage(message, groupName) {
  if (selectedGroup && selectedGroup.groupId === message.groupId) {
    displayMessage(message);
  }
}

function receiveMessage(message) {
  const otherUserId = message.from === currentUser.userId ? message.to : message.from;
  
  if (!messages[otherUserId]) {
    messages[otherUserId] = [];
  }
  
  messages[otherUserId].push(message);

  if (selectedUser && selectedUser.userId === otherUserId) {
    displayMessages();
  }
}

function displayMessages() {
  if (!selectedUser) return;

  const messagesArea = document.getElementById('messages-area');
  messagesArea.innerHTML = '';

  const userMessages = messages[selectedUser.userId] || [];

  userMessages.forEach(msg => {
    displayMessage(msg);
  });
}

function displayMessage(msg) {
  const messagesArea = document.getElementById('messages-area');
  const messageDiv = document.createElement('div');
  messageDiv.className = msg.from === currentUser.userId ? 'message sent' : 'message received';

  const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  let senderInfo = '';
  if (selectedGroup && msg.from !== currentUser.userId) {
    senderInfo = `<div class="message-sender" style="font-size: 0.8em; color: #666; margin-bottom: 2px;">${msg.fromUsername || 'Unknown'}</div>`;
  }

  messageDiv.innerHTML = `
    <div class="message-content">
      ${senderInfo}
      <div>${msg.content}</div>
      <div class="message-time">${time}</div>
    </div>
  `;
  
  messagesArea.appendChild(messageDiv);
  messagesArea.scrollTop = messagesArea.scrollHeight;
}

function showTypingIndicator(userId, isTyping) {
  if (selectedUser && selectedUser.userId === userId) {
    const indicator = document.getElementById('typing-indicator');
    const username = selectedUser.username;
    
    if (isTyping) {
      indicator.querySelector('span').textContent = username;
      indicator.classList.remove('hidden');
    } else {
      indicator.classList.add('hidden');
    }
  }
}

// WebRTC Call functions
async function initiateCall(type) {
  if (!selectedUser) {
    alert('Please select a user to call');
    return;
  }

  callType = type;

  try {
    // Get user media
    const constraints = {
      audio: true,
      video: type === 'video'
    };

    localStream = await navigator.mediaDevices.getUserMedia(constraints);

    // Show outgoing call screen
    showOutgoingCall(selectedUser, type);

    // Send call request
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'call_request',
        to: selectedUser.userId,
        callType: type
      }));
    }

  } catch (error) {
    console.error('Error accessing media devices:', error);
    alert('Could not access camera/microphone');
  }
}

function showOutgoingCall(user, type) {
  const modal = document.getElementById('call-modal');
  const outgoingCall = document.getElementById('outgoing-call');
  const initial = user.username.charAt(0).toUpperCase();

  document.getElementById('outgoing-caller-initial').textContent = initial;
  document.getElementById('outgoing-caller-name').textContent = user.username;
  document.getElementById('outgoing-call-type-label').textContent = type === 'video' ? 'Video Call' : 'Voice Call';

  modal.classList.remove('hidden');
  outgoingCall.classList.remove('hidden');
  document.getElementById('incoming-call').classList.add('hidden');
  document.getElementById('active-call').classList.add('hidden');
}

function handleIncomingCall(data) {
  const modal = document.getElementById('call-modal');
  const incomingCall = document.getElementById('incoming-call');
  const caller = allUsers.find(u => u.userId === data.from);

  if (caller) {
    callType = data.callType;
    selectedUser = caller;

    const initial = caller.username.charAt(0).toUpperCase();
    document.getElementById('caller-initial').textContent = initial;
    document.getElementById('caller-name').textContent = caller.username;
    document.getElementById('call-type-label').textContent = data.callType === 'video' ? 'Video Call' : 'Voice Call';

    modal.classList.remove('hidden');
    incomingCall.classList.remove('hidden');
    document.getElementById('outgoing-call').classList.add('hidden');
    document.getElementById('active-call').classList.add('hidden');
  }
}

async function acceptCall() {
  try {
    // Get user media
    const constraints = {
      audio: true,
      video: callType === 'video'
    };

    localStream = await navigator.mediaDevices.getUserMedia(constraints);

    // Send acceptance
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'call_response',
        to: selectedUser.userId,
        accepted: true
      }));
    }

    // Setup peer connection
    await setupPeerConnection();

    // Show active call screen
    showActiveCall();

  } catch (error) {
    console.error('Error accepting call:', error);
    alert('Could not access camera/microphone');
    rejectCall();
  }
}

function rejectCall() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'call_response',
      to: selectedUser.userId,
      accepted: false
    }));
  }
  hideCallModal();
}

function cancelCall() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'call_end',
      to: selectedUser.userId
    }));
  }
  cleanupCall();
  hideCallModal();
}

async function handleCallResponse(data) {
  if (data.accepted) {
    await setupPeerConnection();
    
    // Create and send offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'webrtc_offer',
        to: selectedUser.userId,
        offer: offer
      }));
    }

    showActiveCall();
  } else {
    alert('Call was rejected');
    cleanupCall();
    hideCallModal();
  }
}

async function setupPeerConnection() {
  peerConnection = new RTCPeerConnection(configuration);

  // Add local stream tracks
  if (localStream) {
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
  }

  // Handle incoming tracks
  peerConnection.ontrack = (event) => {
    if (!remoteStream) {
      remoteStream = new MediaStream();
      document.getElementById('remote-video').srcObject = remoteStream;
    }
    remoteStream.addTrack(event.track);
  };

  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'webrtc_ice_candidate',
        to: selectedUser.userId,
        candidate: event.candidate
      }));
    }
  };

  peerConnection.onconnectionstatechange = () => {
    console.log('Connection state:', peerConnection.connectionState);
    if (peerConnection.connectionState === 'disconnected' || 
        peerConnection.connectionState === 'failed') {
      endCall();
    }
  };
}

async function handleWebRTCOffer(data) {
  if (!peerConnection) {
    await setupPeerConnection();
  }

  await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
  
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'webrtc_answer',
      to: data.from,
      answer: answer
    }));
  }
}

async function handleWebRTCAnswer(data) {
  if (peerConnection) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
  }
}

async function handleICECandidate(data) {
  if (peerConnection && data.candidate) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }
}

function showActiveCall() {
  document.getElementById('incoming-call').classList.add('hidden');
  document.getElementById('outgoing-call').classList.add('hidden');
  document.getElementById('active-call').classList.remove('hidden');

  document.getElementById('active-caller-name').textContent = selectedUser.username;
  document.getElementById('active-call-title').textContent = callType === 'video' ? 'Video Call' : 'Voice Call';

  // Set video sources
  const localVideo = document.getElementById('local-video');
  const remoteVideo = document.getElementById('remote-video');
  
  localVideo.srcObject = localStream;
  
  if (callType === 'voice') {
    localVideo.style.display = 'none';
    remoteVideo.style.display = 'none';
  } else {
    localVideo.style.display = 'block';
    remoteVideo.style.display = 'block';
  }

  // Start call timer
  callStartTime = Date.now();
  updateCallDuration();
  callTimerInterval = setInterval(updateCallDuration, 1000);
}

function updateCallDuration() {
  if (callStartTime) {
    const duration = Math.floor((Date.now() - callStartTime) / 1000);
    const minutes = Math.floor(duration / 60).toString().padStart(2, '0');
    const seconds = (duration % 60).toString().padStart(2, '0');
    document.getElementById('call-duration').textContent = `${minutes}:${seconds}`;
  }
}

function toggleAudio() {
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      const btn = document.getElementById('toggle-audio-btn');
      btn.classList.toggle('muted');
    }
  }
}

function toggleVideo() {
  if (localStream && callType === 'video') {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      const btn = document.getElementById('toggle-video-btn');
      btn.classList.toggle('video-off');
    }
  }
}

function endCall() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'call_end',
      to: selectedUser.userId
    }));
  }
  cleanupCall();
  hideCallModal();
}

function handleCallEnded() {
  cleanupCall();
  hideCallModal();
}

function cleanupCall() {
  // Stop all tracks
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }

  if (remoteStream) {
    remoteStream.getTracks().forEach(track => track.stop());
    remoteStream = null;
  }

  // Close peer connection
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  // Clear timer
  if (callTimerInterval) {
    clearInterval(callTimerInterval);
    callTimerInterval = null;
  }

  callStartTime = null;
  callType = null;

  // Reset video elements
  document.getElementById('local-video').srcObject = null;
  document.getElementById('remote-video').srcObject = null;
}

function hideCallModal() {
  document.getElementById('call-modal').classList.add('hidden');
  document.getElementById('incoming-call').classList.add('hidden');
  document.getElementById('outgoing-call').classList.add('hidden');
  document.getElementById('active-call').classList.add('hidden');
}
