import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Modality, LiveServerMessage } from '@google/genai';
import { serverKeyPool } from './keyPool.js';
import { PERSONA_SYSTEM_PROMPTS, UNIVERSAL_HUMAN_DIRECTIVE } from './prompts.js';
import { handleServerChatStream } from './chatService.js';
import { handleServerVoice } from './voiceService.js';

export function setupLiveWebSocket(httpServer: http.Server) {
  const wss = new WebSocketServer({ server: httpServer, path: '/api/live' });

  wss.on('connection', (ws: WebSocket) => {
    console.info('[Live WebSocket] Client connected to real-time session');

    let liveSession: any = null;

    ws.send(JSON.stringify({
      type: 'connected',
      message: 'Connected to Tasfi Real-time Live Server'
    }));

    ws.on('message', async (data: Buffer | string) => {
      try {
        const payload = JSON.parse(data.toString());

        // 1. Live API real-time audio connection
        if (payload.type === 'live_start') {
          const mood = payload.mood || 'normal';
          const baseInstruction = PERSONA_SYSTEM_PROMPTS[mood] || PERSONA_SYSTEM_PROMPTS['normal'];
          const { ai } = serverKeyPool.getActiveClient();

          try {
            liveSession = await ai.live.connect({
              model: "gemini-3.8-live",
              config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
                },
                systemInstruction: baseInstruction + "\n" + UNIVERSAL_HUMAN_DIRECTIVE,
              },
              callbacks: {
                onmessage: (message: LiveServerMessage) => {
                  for (const part of message.serverContent?.modelTurn?.parts ?? []) {
                    if (part.inlineData?.data && ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({ type: 'audio', audio: part.inlineData.data }));
                    }
                  }
                  if (message.serverContent?.interrupted && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'interrupted', interrupted: true }));
                  }
                },
              },
            });

            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'live_ready' }));
            }
          } catch (liveErr: any) {
            console.warn('[Live API Error]:', liveErr?.message || liveErr);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'live_fallback', message: 'Standard voice ready' }));
            }
          }
        } else if (payload.type === 'audio_input' && liveSession) {
          // Stream 16kHz audio from client mic to Gemini Live
          if (payload.audio) {
            liveSession.sendRealtimeInput({
              audio: { data: payload.audio, mimeType: "audio/pcm;rate=16000" },
            });
          }
        } else if (payload.type === 'chat_stream') {
          const { message, history, mood, memories, replyTo, clientTime, lastMessageTime } = payload;
          try {
            for await (const chunk of handleServerChatStream(message, history || [], mood || 'normal', memories || [], replyTo, clientTime, lastMessageTime)) {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'chunk', text: chunk }));
              }
            }
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'done' }));
            }
          } catch (err: any) {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'error', error: err?.message || 'Stream error' }));
            }
          }
        } else if (payload.type === 'voice') {
          const { text, role, mood } = payload;
          try {
            const audioUrl = await handleServerVoice(text, role || 'model', mood || 'normal');
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'voice_result', audioUrl }));
            }
          } catch (err: any) {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'voice_error', error: err?.message || 'Voice error' }));
            }
          }
        } else if (payload.type === 'ping') {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'pong' }));
          }
        }
      } catch (err) {
        console.warn('[Live WebSocket] Message parse error:', err);
      }
    });

    ws.on('close', () => {
      if (liveSession && typeof liveSession.close === 'function') {
        try {
          liveSession.close();
        } catch {
          // ignore
        }
      }
      console.info('[Live WebSocket] Client disconnected');
    });

    ws.on('error', (err) => {
      console.warn('[Live WebSocket] Socket error:', err.message);
    });
  });

  return wss;
}
