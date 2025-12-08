# Messaging Application

A real-time messaging application with text chat and voice/video calling capabilities.

## Features

- User authentication (JWT-based)
- Real-time text messaging
- Voice and video calling (WebRTC)
- Online/offline status
- Message history
- File-based data storage

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open your browser and navigate to `http://localhost:3000`

## Usage

1. Register a new account or login
2. Select a user to start chatting
3. Send text messages in real-time
4. Initiate voice or video calls

## Technology Stack

- **Backend**: Node.js, Express, WebSocket (ws)
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Authentication**: JWT
- **Real-time Communication**: WebSockets, WebRTC
- **Database**: File-based JSON storage
