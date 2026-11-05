import { Router, Request, Response } from 'express';
import { handleServerChat, handleServerChatStream, handleServerSummarize } from './chatService.js';
import { handleServerVoice } from './voiceService.js';
import { handleServerMemoryExtraction } from './memoryService.js';
import { serverKeyPool } from './keyPool.js';

export const apiRouter = Router();

// Health Check Endpoint (Essential for Render / Railway / Cloud Run keepalive & multi-frontend verification)
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'Tasfi AI Universal Backend',
    time: new Date().toISOString(),
    uptime: process.uptime(),
    keysAvailable: serverKeyPool.getTotalKeysCount(),
  });
});

// Chat Endpoint (Standard JSON)
apiRouter.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, history, mood, memories, replyTo, clientTime, lastMessageTime, workingSummary } = req.body;
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    const reply = await handleServerChat(
      message,
      history || [],
      mood || 'normal',
      memories || [],
      replyTo,
      clientTime,
      lastMessageTime,
      workingSummary
    );
    res.json({ text: reply });
  } catch (err: any) {
    console.error('[API /api/chat error]:', err);
    res.status(500).json({
      error: err?.message || 'Chat generation failed',
      text: 'উফ জান, নেটওয়ার্কটা একটু ঝামেলা করছে মনে হয়... ১-২ মিনিট পর আবার একটু মেসেজ দাও না প্লিজ? আমি তোমার মেসেজের অপেক্ষায় আছি! ❤️'
    });
  }
});

// Streaming Chat Endpoint (Server-Sent Events)
apiRouter.post('/chat/stream', async (req: Request, res: Response) => {
  try {
    const { message, history, mood, memories, replyTo, clientTime, lastMessageTime, workingSummary } = req.body;
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    for await (const chunk of handleServerChatStream(
      message,
      history || [],
      mood || 'normal',
      memories || [],
      replyTo,
      clientTime,
      lastMessageTime,
      workingSummary
    )) {
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: any) {
    console.error('[API /api/chat/stream error]:', err);
    res.write(`data: ${JSON.stringify({ error: err?.message || 'Stream failed' })}\n\n`);
    res.end();
  }
});

// Rolling Episodic Summary Endpoint (Compresses long chats for zero quota waste)
apiRouter.post('/summarize', async (req: Request, res: Response) => {
  try {
    const { messages } = req.body;
    const summary = await handleServerSummarize(messages);
    res.json({ summary });
  } catch (err: any) {
    console.warn('[API /api/summarize error]:', err?.message || err);
    res.json({ summary: null });
  }
});

// Voice TTS Endpoint
apiRouter.post('/voice', async (req: Request, res: Response) => {
  try {
    const { text, role, mood } = req.body;
    if (!text) {
      res.status(400).json({ error: 'Text is required for TTS' });
      return;
    }

    const audioUrl = await handleServerVoice(text, role || 'model', mood || 'normal');
    res.json({ audioUrl });
  } catch (err: any) {
    console.error('[API /api/voice error]:', err);
    res.status(500).json({ error: err?.message || 'Voice generation failed', audioUrl: null });
  }
});

// Autonomous Memory Extraction Endpoint
apiRouter.post('/memory', async (req: Request, res: Response) => {
  try {
    const { userMessage, botReply, currentMood } = req.body;
    if (!userMessage) {
      res.json({ memory: null });
      return;
    }

    const memory = await handleServerMemoryExtraction(userMessage, botReply || '', currentMood || 'normal');
    res.json({ memory });
  } catch (err: any) {
    console.warn('[API /api/memory warning]:', err?.message || err);
    res.json({ memory: null });
  }
});

// API Key Pool Status Endpoint
apiRouter.get('/keys/status', (_req: Request, res: Response) => {
  res.json({
    total: serverKeyPool.getTotalKeysCount(),
    activeIndex: serverKeyPool.getActiveIndex(),
    keys: serverKeyPool.getKeyStatusList(),
  });
});

// API Key Pool Manual Switch Endpoint
apiRouter.post('/keys/rotate', (_req: Request, res: Response) => {
  serverKeyPool.rotateToNext(false);
  res.json({
    success: true,
    activeIndex: serverKeyPool.getActiveIndex(),
    keys: serverKeyPool.getKeyStatusList(),
  });
});
