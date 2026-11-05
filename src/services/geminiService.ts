import { TasfiMemory } from "./supabaseService";
import { getApiUrl, getWebSocketUrl } from "../config/api";

export interface LiveSessionOptions {
  mood?: string;
  onTextChunk?: (text: string) => void;
  onAudioData?: (base64Audio: string) => void;
  onError?: (err: string) => void;
  onClose?: () => void;
}

export class GeminiService {
  /**
   * Main Chat Dispatcher:
   * Dispatches request to the server-side `/api/chat` endpoint.
   * Server executes Gemini with server-side API key failover, model cascading,
   * and full persona adherence.
   */
  async chat(
    message: string,
    history: { role: "user" | "model"; parts: { text: string }[] }[],
    mood: string = "normal",
    memories: TasfiMemory[] = [],
    replyTo?: { id?: string; content?: string; role?: 'user' | 'model' },
    clientTime?: string,
    lastMessageTime?: string,
    workingSummary?: string
  ): Promise<string> {
    try {
      const res = await fetch(getApiUrl("/api/chat"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          history,
          mood,
          memories,
          replyTo,
          clientTime,
          lastMessageTime,
          workingSummary,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.text && typeof data.text === "string" && data.text.trim().length > 0) {
          return data.text.trim();
        }
      }

      const errData = await res.json().catch(() => ({}));
      console.warn("[GeminiService] Server chat error:", errData?.error || res.status);
    } catch (err: any) {
      console.warn("[GeminiService] Server network notice:", err?.message || err);
    }

    if (mood === "normal") {
      return "দুঃখিত, সংযোগে সাময়িক বিঘ্ন ঘটেছে। অনুগ্রহ করে আবার একটু চেষ্টা করুন।";
    }
    if (mood === "stranger") {
      return "দুঃখিত, ইন্টারনেটে কিছুটা সমস্যা হচ্ছে। কিছুক্ষণ পর আবার মেসেজ দিন।";
    }
    if (mood === "bestie") {
      return "ধুরর নেটওয়ার্কটা মনে হয় ঝামেলা করতেছে রে... ১ মিনিট পর আবার মেসেজ দে তো! 😂";
    }
    if (mood === "religious") {
      return "দুঃখিত রবিন, সংযোগে কিছুটা বিঘ্ন ঘটেছে। একটু পর আবার মেসেজ দাও ইনশাআল্লাহ।";
    }
    if (mood === "friend") {
      return "একটু নেটওয়ার্ক সমস্যা হয়েছে মনে হয়। একটু পর আবার মেসেজ দাও তো?";
    }
    return "নেটওয়ার্কে একটু সমস্যা হচ্ছে মনে হয়... একটু পর আবার মেসেজ দাও তো প্লিজ? ❤️";
  }

  /**
   * Streaming Chat Dispatcher:
   * Consumes real-time token stream from server-side `/api/chat/stream` SSE endpoint.
   * Calls `onChunk` as tokens arrive from the model.
   */
  async chatStream(
    message: string,
    history: { role: "user" | "model"; parts: { text: string }[] }[],
    mood: string = "normal",
    memories: TasfiMemory[] = [],
    onChunk?: (textChunk: string) => void,
    replyTo?: { id?: string; content?: string; role?: 'user' | 'model' },
    clientTime?: string,
    lastMessageTime?: string,
    workingSummary?: string
  ): Promise<string> {
    try {
      const res = await fetch(getApiUrl("/api/chat/stream"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          history,
          mood,
          memories,
          replyTo,
          clientTime,
          lastMessageTime,
          workingSummary,
        }),
      });

      if (!res.ok || !res.body) {
        // Fall back to standard server chat
        return await this.chat(message, history, mood, memories, replyTo, clientTime, lastMessageTime, workingSummary);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data: ")) {
            const dataStr = trimmed.slice(6);
            if (dataStr === "[DONE]") {
              break;
            }
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) {
                fullText += parsed.text;
                if (onChunk) onChunk(parsed.text);
              }
            } catch {
              // ignore invalid json chunk
            }
          }
        }
      }

      if (fullText.trim().length > 0) {
        return fullText.trim();
      }
    } catch (streamErr: any) {
      console.warn("[GeminiService] Stream notice:", streamErr?.message || streamErr);
    }

    // Fallback to non-streaming chat endpoint
    return await this.chat(message, history, mood, memories);
  }

  /**
   * Autonomous Agentic Memory Extraction:
   * Priority 1: Instant local smart regex pattern recognition (0 ms, 0 token cost).
   * Priority 2: Server-side Gemini model extraction at `/api/memory`.
   */
  async extractAgenticMemory(
    userMessage: string,
    botReply: string,
    currentMood: string
  ): Promise<{ category: string; content: string; importance: number; isGlobal: boolean } | null> {
    const cleanMsg = userMessage.trim();

    // Skip trivial phrases and pure greetings
    const trivialPattern = /^(হুম|হুমম|হু|আচ্ছা|ওকে|ok|hmm|hi|hello|বাই|bye|হাহাহা|হেহে|হ্যাঁ|না|বলো|কেমন আছো|কী অবস্থা|শুভ সকাল|শুভ রাত্রি|থ্যাংকস|ধন্যবাদ)$/i;
    if (cleanMsg.length < 4 || trivialPattern.test(cleanMsg)) {
      return null;
    }

    // Priority 1: Instant smart extraction for frequent personal facts
    const nameMatch = cleanMsg.match(/আমার নাম\s+([^\s,।.]+)/i);
    if (nameMatch) {
      return { category: "fact", content: `রবিনের নাম ${nameMatch[1]}`, importance: 5, isGlobal: true };
    }

    const likeMatch = cleanMsg.match(/(?:আমি|আমার)\s+([^,।.!]+?)\s+(?:খুব\s+)?(?:ভালোবাসি|পছন্দ করি|পছন্দ)/i);
    if (likeMatch && likeMatch[1].length < 30) {
      return { category: "preference", content: `রবিন ${likeMatch[1].trim()} পছন্দ করে`, importance: 4, isGlobal: false };
    }

    const dislikeMatch = cleanMsg.match(/(?:আমি|আমার)\s+([^,।.!]+?)\s+(?:অপছন্দ করি|ঘৃণা করি|পছন্দ না)/i);
    if (dislikeMatch && dislikeMatch[1].length < 30) {
      return { category: "preference", content: `রবিন ${dislikeMatch[1].trim()} অপছন্দ করে`, importance: 4, isGlobal: false };
    }

    const sickMatch = cleanMsg.match(/আমার\s+(মাথা\s*ব্যথা|জ্বর|শরীর\s*খারাপ|অসুস্থ|ঠাণ্ডা\s*লেগেছে)/i);
    if (sickMatch) {
      return { category: "fact", content: `রবিনের ${sickMatch[1]} করছে / অসুস্থ`, importance: 4, isGlobal: false };
    }

    const habitMatch = cleanMsg.match(/(?:রাতে\s*দেরি\s*করে\s*ঘুমাই|সকালে\s*দেরি\s*করে\s*উঠি|চা\s*খাই|কফি\s*খাই)/i);
    if (habitMatch) {
      return { category: "fact", content: `রবিনের অভ্যাস: ${habitMatch[0]}`, importance: 3, isGlobal: true };
    }

    const promiseMatch = cleanMsg.match(/(?:কথা\s*দিলাম|প্রতিশ্রুতি\s*দিলাম)\s*([^,।.!]+)/i);
    if (promiseMatch) {
      return { category: "promise", content: `রবিনের প্রতিশ্রুতি: ${promiseMatch[1].trim()}`, importance: 5, isGlobal: false };
    }

    // Priority 2: Server-side Gemini model extraction
    const personalPattern = /(আমি|আমার|আমাকে|আমারে|আমারও|ভালোবাসি|পছন্দ|অপছন্দ|ঘৃণা|খাই|যাব|ঘুমাব|রাত|চা|কফি|অফিস|কাজ|মা|বাবা|ভাই|বোন|বন্ধু|নাম|বয়স|জ্বর|অসুস্থ|মাথা|কবিতা|গান|শখ|শাড়ি|গিফট|উপহার|কথা দিলাম|প্রতিশ্রুতি|মনে রেখো|মনে রাখিস|ভুলো না|কাল|আজ|গতকাল|টাকা|বাড়ি)/;
    if (!personalPattern.test(cleanMsg) || cleanMsg.length < 15) {
      return null;
    }

    try {
      const res = await fetch(getApiUrl("/api/memory"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage,
          botReply,
          currentMood,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.memory && data.memory.content) {
          return data.memory;
        }
      }
    } catch (e) {
      console.warn("[GeminiService] Server memory extraction skipped:", e);
    }

    return null;
  }

  /**
   * Fast, zero-token chat title generator based on initial message context
   */
  async generateChatTitle(firstMessage: string, _replyMessage?: string): Promise<string> {
    try {
      const clean = firstMessage.trim().replace(/[?!.,।()"'`~]/g, "");
      const words = clean.split(/\s+/).filter((w) => w.length > 0).slice(0, 4);
      if (words.length > 0 && words.join(" ").length <= 25) {
        return words.join(" ");
      }
      return clean.slice(0, 20) || "আলাপ";
    } catch {
      return "আলাপ";
    }
  }

  /**
   * Generates a 1-sentence rolling episodic summary of ongoing dialogue to keep API tokens minimal
   */
  async generateChatSummary(messages: any[]): Promise<string | null> {
    if (!messages || messages.length < 4) return null;
    try {
      const res = await fetch(getApiUrl("/api/summarize"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.summary || null;
      }
    } catch (e) {
      console.warn("Summary generation notice:", e);
    }
    return null;
  }

  /**
   * Voice Generation:
   * Requests server-side TTS audio via `/api/voice`.
   * Server executes with Gemini audio modality and returns a high-fidelity WAV data URL.
   */
  async generateVoice(text: string, role: "user" | "model", mood: string = "normal"): Promise<string | null> {
    try {
      const res = await fetch(getApiUrl("/api/voice"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          role,
          mood,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.audioUrl) {
          return data.audioUrl;
        }
      }
    } catch (err) {
      console.warn("[GeminiService] Server voice generation error:", err);
    }
    return null;
  }

  /**
   * Live API WebSocket Connection:
   * Connects to `/api/live` on the server for real-time bidirectional audio/text interaction.
   */
  connectLive(options: LiveSessionOptions = {}) {
    const wsUrl = getWebSocketUrl("/api/live");

    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.info("[Live API] Connected to server WebSocket");
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "live_start",
            mood: options.mood || "normal",
          }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "chunk" && payload.text && options.onTextChunk) {
            options.onTextChunk(payload.text);
          } else if (payload.type === "audio" && payload.data && options.onAudioData) {
            options.onAudioData(payload.data);
          } else if (payload.type === "error" && options.onError) {
            options.onError(payload.error || "Live session error");
          }
        } catch {
          // ignore non-json frames
        }
      };

      ws.onerror = (err) => {
        console.warn("[Live API] WebSocket error:", err);
        options.onError?.("WebSocket error occurred");
      };

      ws.onclose = () => {
        console.info("[Live API] Disconnected from server WebSocket");
        options.onClose?.();
      };
    } catch (err: any) {
      console.warn("[Live API] Failed to initialize WebSocket:", err?.message || err);
      options.onError?.(err?.message || "Connection failed");
    }

    return {
      sendAudio: (base64AudioChunk: string) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "audio_input", audio: base64AudioChunk }));
        }
      },
      sendText: (message: string, history: any[] = [], memories: any[] = []) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "chat_stream",
            message,
            history,
            mood: options.mood || "normal",
            memories,
          }));
        }
      },
      close: () => {
        if (ws) {
          try {
            ws.close();
          } catch {
            // ignore
          }
        }
      },
    };
  }
}

export const geminiService = new GeminiService();
