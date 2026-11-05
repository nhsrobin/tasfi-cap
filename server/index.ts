import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { apiRouter } from './routes.js';
import { setupLiveWebSocket } from './websocket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Root directory is one level up from server/
const rootDir = path.resolve(__dirname, '..');

export async function createTasfiServer() {
  const app = express();
  const args = process.argv.slice(2);
  const portIndex = args.indexOf('--port');
  const port = (portIndex !== -1 && args[portIndex + 1])
    ? parseInt(args[portIndex + 1], 10)
    : (process.env.PORT ? parseInt(process.env.PORT, 10) : 3000);

  // Universal CORS Configuration:
  // Allows requests from Vercel (https://*.vercel.app), Render, Capacitor mobile apps
  // (capacitor://localhost, http://localhost), and custom domains without blocks.
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile native apps, curl, Capacitor, server-to-server)
      if (!origin) return callback(null, true);
      // Allow all origins for universal multi-frontend compatibility
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  }));

  // JSON Body Parser with 10MB limit for image attachments or audio inputs
  app.use(express.json({ limit: '10mb' }));

  // Register All Modular API Routes under /api
  app.use('/api', apiRouter);

  // Optional Headless Mode: If process.env.API_ONLY === 'true', skip serving frontend
  const isApiOnly = process.env.API_ONLY === 'true';

  if (!isApiOnly) {
    if (process.env.NODE_ENV !== 'production') {
      try {
        const { createServer } = await import('vite');
        const vite = await createServer({
          root: rootDir,
          server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
          appType: 'spa',
        });
        app.use(vite.middlewares);
      } catch (viteErr) {
        console.warn('[Vite Middleware Notice]:', viteErr);
      }
    } else {
      const distPath = path.resolve(rootDir, 'dist');
      if (fs.existsSync(distPath)) {
        app.use(express.static(distPath));
        app.use((_req, res) => {
          res.sendFile(path.resolve(distPath, 'index.html'));
        });
      }
    }
  }

  // Create HTTP server to attach both Express and Live WebSocket server
  const httpServer = http.createServer(app);
  setupLiveWebSocket(httpServer);

  return { app, httpServer, port };
}

// Start Server automatically if executed as the main entry point
async function run() {
  const { httpServer, port } = await createTasfiServer();
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`[Tasfi Universal Backend] Running on http://0.0.0.0:${port} (mode: ${process.env.NODE_ENV || 'development'})`);
  });
}

run().catch((err) => {
  console.error('[Tasfi Server Failed to Start]:', err);
  process.exit(1);
});
