
// Store active calls (in-memory, for development)
// For production, use Redis or a database
export const activeCalls = new Map();

// Store WebSocket connections
let connectedAgents = new Set();

// WebSocket server instance (will be initialized in websocket route)
let wss = null;

export function setWebSocketServer(server) {
  wss = server;
}

export function addAgent(ws) {
  connectedAgents.add(ws);
  console.log(`✅ Agent connected. Total: ${connectedAgents.size}`);
}

export function removeAgent(ws) {
  connectedAgents.delete(ws);
  console.log(`❌ Agent disconnected. Total: ${connectedAgents.size}`);
}

export function notifyAgents(contactId) {
  const message = JSON.stringify({
    type: 'newCall',
    contactId,
    timestamp: new Date().toISOString(),
  });

  console.log(`📢 Broadcasting to ${connectedAgents.size} agents`);

  connectedAgents.forEach((ws) => {
    if (ws.readyState === 1) { // WebSocket.OPEN
      try {
        ws.send(message);
      } catch (err) {
        console.error('Error sending to agent:', err);
        connectedAgents.delete(ws);
      }
    }
  });
}

// Cleanup old calls periodically
setInterval(() => {
  const now = Date.now();
  const timeout = 5 * 60 * 1000; // 5 minutes

  for (const [contactId, callData] of activeCalls.entries()) {
    const age = now - new Date(callData.createdAt).getTime();
    if (age > timeout) {
      console.log(`🗑️ Removing expired call: ${contactId}`);
      activeCalls.delete(contactId);
    }
  }
}, 60000);
