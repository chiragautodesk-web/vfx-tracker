import http from 'http';
import { whatsappService } from '../server/whatsapp-service.mjs';

const PORT = process.env.WHATSAPP_PORT || 3001;

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  res.setHeader('Content-Type', 'application/json');

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  try {
    if (pathname === '/api/whatsapp/status' && req.method === 'GET') {
      return res.end(JSON.stringify(whatsappService.getStatus()));
    }

    if (pathname === '/api/whatsapp/reconnect' && req.method === 'POST') {
      const status = await whatsappService.reconnect();
      return res.end(JSON.stringify(status));
    }

    if (pathname === '/api/whatsapp/logout' && req.method === 'POST') {
      const result = await whatsappService.logout();
      return res.end(JSON.stringify(result));
    }

    if (pathname === '/api/whatsapp/send' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          const { phone, message } = JSON.parse(body || '{}');
          const result = await whatsappService.sendMessage(phone, message);
          res.statusCode = 200;
          res.end(JSON.stringify(result));
        } catch (err) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: err.message || 'Failed to send message' }));
        }
      });
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  } catch (err) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err.message || 'Server error' }));
  }
});

server.listen(PORT, async () => {
  console.log(`[WhatsApp Server] Running on http://localhost:${PORT}`);
  console.log('[WhatsApp Server] Initializing WhatsApp multi-device connection...');
  await whatsappService.init();
});
