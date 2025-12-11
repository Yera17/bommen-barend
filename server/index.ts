import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'colyseus';

import { BomberRoom } from './rooms/BomberRoom.js'; // tsx resolves .ts

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Serve static files from dist (after build)
app.use(express.static(path.join(__dirname, '..', 'dist')));

// Fallback for SPA routing
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

const gameServer = new Server({ server });

gameServer.define('bomber', BomberRoom);

const PORT = process.env.PORT || 2567;
server.listen(PORT, () => {
  console.log(`🎮 Bommen Barend Server listening on http://localhost:${PORT}`);
});

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await gameServer.gracefullyShutdown(true);
  process.exit(0);
});

