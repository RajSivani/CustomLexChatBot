// server.js - WebSocket Server

const { WebSocketServer } = require('ws');
const http = require('http');

const server = http.createServer();
const wss = new WebSocketServer({ server });

const connectedAgents = new Set();

wss.on('connection', (ws) => {
  console.log('✅ Agent connected via WebSocket');
  connectedAgents.add(ws);

  ws.send(JSON.stringify({
    type: 'connected',
    message: 'WebSocket connected successfully',
  }));

  ws.on('close', () => {
    console.log('❌ Agent disconnected');
    connectedAgents.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    connectedAgents.delete(ws);
  });
});

// Expose global function for Next.js API routes
global.notifyAgentsViaWebSocket = (contactId) => {
  const message = JSON.stringify({
    type: 'newCall',
    contactId,
    timestamp: new Date().toISOString(),
  });

  console.log(`📢 Broadcasting to ${connectedAgents.size} agents`);

  connectedAgents.forEach((ws) => {
    if (ws.readyState === 1) {
      try {
        ws.send(message);
      } catch (err) {
        console.error('Error sending to agent:', err);
        connectedAgents.delete(ws);
      }
    }
  });
};

const PORT = 3001;
server.listen(PORT, () => {
  console.log('\n' + '='.repeat(50));
  console.log('🔌 WebSocket Server Started');
  console.log('='.repeat(50));
  console.log(`📍 Running on: ws://localhost:${PORT}`);
  console.log(`👥 Connected agents: ${connectedAgents.size}`);
  console.log('='.repeat(50) + '\n');
});