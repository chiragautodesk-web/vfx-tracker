import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function whatsappPlugin(): Plugin {
  return {
    name: 'whatsapp-server-plugin',
    configureServer(server) {
      let whatsappServicePromise: Promise<any> | null = null;
      const getService = async () => {
        if (!whatsappServicePromise) {
          // @ts-ignore
          whatsappServicePromise = import('./server/whatsapp-service.mjs').then((m) => {
            m.whatsappService.init();
            return m.whatsappService;
          });
        }
        return whatsappServicePromise;
      };

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/whatsapp')) {
          return next();
        }

        res.setHeader('Content-Type', 'application/json');

        try {
          const service = await getService();
          const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
          const pathname = parsedUrl.pathname;

          if (pathname === '/api/whatsapp/status' && req.method === 'GET') {
            const status = service.getStatus();
            res.statusCode = 200;
            return res.end(JSON.stringify(status));
          }

          if (pathname === '/api/whatsapp/reconnect' && req.method === 'POST') {
            const status = await service.reconnect();
            res.statusCode = 200;
            return res.end(JSON.stringify(status));
          }

          if (pathname === '/api/whatsapp/logout' && req.method === 'POST') {
            const result = await service.logout();
            res.statusCode = 200;
            return res.end(JSON.stringify(result));
          }

          if (pathname === '/api/whatsapp/send' && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk: Buffer | string) => {
              body += chunk.toString();
            });
            req.on('end', async () => {
              try {
                const { phone, message } = JSON.parse(body || '{}');
                const result = await service.sendMessage(phone, message);
                res.statusCode = 200;
                res.end(JSON.stringify(result));
              } catch (err: any) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: err.message || 'Failed to send message' }));
              }
            });
            return;
          }

          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Endpoint not found' }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), whatsappPlugin()],
});

