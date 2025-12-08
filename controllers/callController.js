const WebSocket = require('ws');

// Handle WebRTC signaling for voice/video calls
function handleSignaling(data, userId, username, clients) {
  try {
    const { type, to } = data;

    if (!to) {
      return;
    }

    // Get recipient connection
    const recipient = clients.get(to);
    if (!recipient || recipient.ws.readyState !== WebSocket.OPEN) {
      // Recipient is not online
      const sender = clients.get(userId);
      if (sender && sender.ws.readyState === WebSocket.OPEN) {
        sender.ws.send(JSON.stringify({
          type: 'call_error',
          message: 'User is not available'
        }));
      }
      return;
    }

    // Forward signaling message to recipient
    switch (type) {
      case 'call_request':
        // Incoming call request
        recipient.ws.send(JSON.stringify({
          type: 'incoming_call',
          from: userId,
          fromUsername: username,
          callType: data.callType // 'voice' or 'video'
        }));
        break;

      case 'call_response':
        // Call accepted or rejected
        recipient.ws.send(JSON.stringify({
          type: 'call_response',
          from: userId,
          accepted: data.accepted
        }));
        break;

      case 'webrtc_offer':
        // WebRTC offer (SDP)
        recipient.ws.send(JSON.stringify({
          type: 'webrtc_offer',
          from: userId,
          offer: data.offer
        }));
        break;

      case 'webrtc_answer':
        // WebRTC answer (SDP)
        recipient.ws.send(JSON.stringify({
          type: 'webrtc_answer',
          from: userId,
          answer: data.answer
        }));
        break;

      case 'webrtc_ice_candidate':
        // ICE candidate for NAT traversal
        recipient.ws.send(JSON.stringify({
          type: 'webrtc_ice_candidate',
          from: userId,
          candidate: data.candidate
        }));
        break;

      case 'call_end':
        // Call ended
        recipient.ws.send(JSON.stringify({
          type: 'call_ended',
          from: userId
        }));
        break;

      default:
        console.log('Unknown signaling type:', type);
    }

  } catch (error) {
    console.error('Error handling signaling:', error);
  }
}

module.exports = {
  handleSignaling
};
