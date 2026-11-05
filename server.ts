/**
 * Tasfi AI - Universal Server Entry Point
 * The backend server logic is fully modularized inside the /server directory.
 * This entry file delegates execution to /server/index.js for compatibility with
 * Node, Docker, Cloud Run, Render, and Vercel/Capacitor setups.
 */

import './server/index.js';

export * from './server/keyPool.js';
export * from './server/prompts.js';
export * from './server/chatService.js';
export * from './server/voiceService.js';
export * from './server/memoryService.js';
export * from './server/websocket.js';
export * from './server/routes.js';
export * from './server/index.js';
