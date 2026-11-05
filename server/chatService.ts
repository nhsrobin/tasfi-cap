import { GenerateContentResponse } from '@google/genai';
import { serverKeyPool, isQuotaOrRateLimitError } from './keyPool.js';
import { PERSONA_SYSTEM_PROMPTS, UNIVERSAL_HUMAN_DIRECTIVE, UNRESTRICTED_SAFETY_SETTINGS } from './prompts.js';

export function getTemporalContext(clientTime?: string, lastMessageTime?: string): string {
  const now = clientTime ? new Date(clientTime) : new Date();
  
  const days = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
  const dayName = days[now.getDay()];
  const hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, '0');
  
  let period = 'রাত';
  if (hours >= 5 && hours < 12) period = 'সকাল';
  else if (hours >= 12 && hours < 15) period = 'দুপুর';
  else if (hours >= 15 && hours < 18) period = 'বিকাল';
  else if (hours >= 18 && hours < 21) period = 'সন্ধ্যা';
  else if (hours >= 21 || hours < 1) period = 'রাত';
  else period = `গভীর রাত (রাত ${hours}টা)`;

  const displayHour = hours % 12 || 12;
  const timeStr = `${dayName}, ${period} ${displayHour}:${minutes}`;

  let elapsedSection = '';
  if (lastMessageTime) {
    const lastDate = new Date(lastMessageTime);
    const diffMs = now.getTime() - lastDate.getTime();
    if (!isNaN(diffMs) && diffMs > 0) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays >= 1) {
        elapsedSection = `- পূর্ববর্তী মেসেজ থেকে সময় পার হয়েছে: ${diffDays} দিন (${diffDays === 1 ? 'গতকাল' : `${diffDays} দিন আগে`})। দিন-রাত পার হয়ে সম্পূর্ণ নতুন দিনের আড্ডা শুরু হয়েছে।\n- জরুরি সময়জ্ঞান: আগের আড্ডায় রবিন যদি 'ঘুমাতে যাই' বলে থাকে, তবে সে গত রাতেই ঘুমিয়েছে এবং এখন সম্পূর্ণ নতুন দিন! কখনোই অবান্তরভাবে বলবে না 'তুমি এখনও ঘুমাওনি কেন?' বা 'ঘুমাতে যাওনি?'। বরং নতুন সময়ের বাস্তব কুশল বিনিময় করো ("সারা দিন কেমন কাটলো?", "এখন কী করছো?").`;
      } else if (diffHours >= 5) {
        elapsedSection = `- পূর্ববর্তী মেসেজ থেকে সময় পার হয়েছে: প্রায় ${diffHours} ঘণ্টা (একটি বড় সময় পার হয়েছে, দিন/রাতের পরিবর্তন ঘটেছে)।\n- জরুরি সময়জ্ঞান: যদি আগের রাতে সে ঘুমাতে যাওয়ার কথা বলে থাকে এবং এখন সকাল/দুপুর/সন্ধ্যা, তবে সে ইতিমধ্যে ঘুমিয়ে উঠে দিন কাটাচ্ছে। কখনোই বলবে না 'তুমি এখনও ঘুমাওনি?'। নতুন সময় অনুযায়ী কথা বলো।`;
      } else if (diffHours >= 1) {
        elapsedSection = `- পূর্ববর্তী মেসেজ থেকে সময় পার হয়েছে: প্রায় ${diffHours} ঘণ্টা।`;
      } else if (diffMins >= 10) {
        elapsedSection = `- পূর্ববর্তী মেসেজ থেকে সময় পার হয়েছে: প্রায় ${diffMins} মিনিট।`;
      } else {
        elapsedSection = `- পূর্ববর্তী মেসেজ থেকে সময় পার হয়েছে: কিছু মুহূর্ত আগে (চলমান আড্ডা)।`;
      }
    }
  }

  let nightAdvice = '';
  if (hours >= 23 || hours < 5) {
    nightAdvice = `\n- রাত অনেক হয়েছে (${period})। রবিনের অভ্যাস হলো রাতে বেশি রাত না জাগা। তাই বেশি কথা টেনে বড় না করে তাকে মিষ্টি ও স্নেহের সাথে সময়মতো ঘুমানোর তাগিদ বা রিমাইন্ডার দাও।`;
  }

  return `[বাস্তব সময়জ্ঞান ও টাইম-সেন্স]:
- বর্তমান রিয়েল সময়: ${timeStr}
${elapsedSection}
- সময়ের নিয়ম: সকাল হলে সকালের কুশল, দুপুর হলে দুপুরের খাওয়া, সন্ধ্যা হলে সন্ধ্যার আড্ডা এবং গভীর রাতে ঘুমানোর পরামর্শ দাও।${nightAdvice}`;
}

export function filterSemanticBrainMemories(
  memories: Array<{ content: string; importance?: number; category?: string }>,
  currentMessage: string,
  _mood: string
): string[] {
  if (!memories || memories.length === 0) return [];

  const lowerMsg = currentMessage.toLowerCase();

  const topicKeywords: Record<string, RegExp> = {
    sleep: /(?:রাত|ঘুম|দেরি|জেগে|সকাল|বিশ্রাম|ক্লান্ত|ঘুমাব|ঘুমাই|রিমাইন্ডার)/i,
    food: /(?:খাওয়া|খেয়ে|ভাত|চা|কফি|ক্ষুধা|খিদে|নাস্তা|খাবো|খাই|খেয়েছো)/i,
    health: /(?:শরীর|মাথা|ব্যথা|জ্বর|অসুস্থ|মন\s*খারাপ|কষ্ট|টেনশন|চিন্তা|প্রেসার|বিষণ্ণ)/i,
    work: /(?:অফিস|কাজ|ব্যস্ত|দেরি|প্রজেক্ট|মিটিং|বস|চাকরি|পড়া|পড়াশোনা)/i,
    poetry: /(?:কবিতা|গান|ছন্দ|বই|সাহিত্য|লিখতে|লেখক|ভাবুক)/i,
    promise: /(?:কথা|প্রতিশ্রুতি|ওয়াদা|মনে\s*রেখো|ভুলবে\s*না)/i,
    love: /(?:ভালোবাস|ভালোবাসি|প্রেম|বিয়ে|বউ|অর্ধাঙ্গিনী|আদর|মায়া|অভিমান|রাগ)/i,
  };

  const scored = memories.map(m => {
    let score = m.importance || 3;
    const content = m.content.toLowerCase();

    if ((m.importance || 0) >= 5) {
      score += 5;
    }

    for (const [, regex] of Object.entries(topicKeywords)) {
      if (regex.test(lowerMsg) && regex.test(content)) {
        score += 10;
      }
    }

    const words = lowerMsg.split(/[\s,।!?]+/).filter(w => w.length >= 3);
    for (const w of words) {
      if (content.includes(w)) {
        score += 3;
      }
    }

    return { content: m.content, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 6).map(s => s.content);
}

export function getEpisodicThreadContext(
  history: { role: "user" | "model"; parts: { text: string }[] }[],
  workingSummary?: string
): string {
  if (workingSummary && workingSummary.trim()) {
    return `\n[চলমান আলাপের পূর্বসূত্র ও ধারাবাহিক প্রেক্ষাপট]: ${workingSummary.trim()}`;
  }

  if (history && history.length > 6) {
    const earlierMsgs = history.slice(0, -6);
    const earlierUserPoints = earlierMsgs
      .filter(m => m.role === 'user')
      .map(m => m.parts[0]?.text?.slice(0, 40))
      .filter(Boolean)
      .slice(-3);

    if (earlierUserPoints.length > 0) {
      return `\n[চলমান আলাপের পূর্বপ্রসঙ্গ]: এই আলাপে রবিন ইতিপূর্বে বলেছিল: "${earlierUserPoints.join(' ➔ ')}"`;
    }
  }

  return '';
}

export async function handleServerChat(
  message: string,
  history: { role: "user" | "model"; parts: { text: string }[] }[],
  mood: string = 'normal',
  memories: Array<{ content: string; importance?: number; category?: string }> = [],
  replyTo?: { id?: string; content?: string; role?: 'user' | 'model' },
  clientTime?: string,
  lastMessageTime?: string,
  workingSummary?: string
): Promise<string> {
  const baseInstruction = PERSONA_SYSTEM_PROMPTS[mood] || PERSONA_SYSTEM_PROMPTS['normal'];
  const temporalInstruction = getTemporalContext(clientTime, lastMessageTime);
  
  const semanticMemories = filterSemanticBrainMemories(memories, message, mood);
  let memoryDirective = '';
  if (semanticMemories.length > 0) {
    memoryDirective = `\n[সরাসরি মেমোরি ব্রেইন থেকে প্রাসঙ্গিক স্মৃতি ও অভ্যাস]:\n` + semanticMemories.map(m => `- ${m}`).join('\n');
  }

  const episodicDirective = getEpisodicThreadContext(history, workingSummary);

  const finalInstruction = baseInstruction + "\n" + UNIVERSAL_HUMAN_DIRECTIVE + "\n" + temporalInstruction + memoryDirective + episodicDirective;

  const isPlayfulMood = ['limitless', 'romantic', 'wife', 'bestie'].includes(mood);

  const chatConfig: any = {
    systemInstruction: finalInstruction,
    temperature: isPlayfulMood ? 1.0 : 0.85,
    topP: 0.95,
    safetySettings: UNRESTRICTED_SAFETY_SETTINGS,
  };

  let effectiveMessage = message;
  if (replyTo && replyTo.content) {
    const quotedSender = replyTo.role === 'user' ? 'রবিনের আগের কথা' : 'তোমার (তাসফির) আগের কথা';
    effectiveMessage = `[রিপ্লাই করা মেসেজ (${quotedSender}): "${replyTo.content.slice(0, 160)}"]\n${message}`;
  }

  const optimizedHistory = (history || []).slice(-6);
  const candidateModels = ["gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.8-flash"];
  const totalKeys = serverKeyPool.getTotalKeysCount();
  const maxKeyAttempts = Math.max(1, Math.min(totalKeys, 4));

  for (let keyAttempt = 0; keyAttempt < maxKeyAttempts; keyAttempt++) {
    const { ai, alias, markSuccess, markFailure } = serverKeyPool.getActiveClient();
    let keyQuotaExceeded = false;

    for (let m = 0; m < candidateModels.length; m++) {
      const model = candidateModels[m];
      try {
        const chat = ai.chats.create({
          model,
          config: chatConfig,
          history: optimizedHistory,
        });

        const response: GenerateContentResponse = await chat.sendMessage({ message: effectiveMessage });
        if (response.text && response.text.trim().length > 0) {
          markSuccess();
          return response.text;
        }
      } catch (err: any) {
        if (isQuotaOrRateLimitError(err)) {
          console.warn(`[Server Failover] ${alias} quota hit on model ${model}. Rotating...`);
          markFailure(true, err?.message || "Quota exceeded");
          keyQuotaExceeded = true;
          break;
        } else {
          console.warn(`[Server Chat] ${alias} notice on model ${model}:`, err?.message || err);
        }
      }
    }

    markFailure(keyQuotaExceeded, "Model attempts failed on key");
    serverKeyPool.rotateToNext(keyQuotaExceeded);
  }

  if (mood === 'bestie') {
    return "ধুরর নেটওয়ার্কটা মনে হয় ঝামেলা করতেছে রে... ১ মিনিট পর আবার মেসেজ দে তো! 😂";
  }
  return "উফ জান, নেটওয়ার্কটা একটু ঝামেলা করছে মনে হয়... ১-২ মিনিট পর আবার একটু মেসেজ দাও না প্লিজ? আমি তোমার মেসেজের অপেক্ষায় আছি! ❤️";
}

export async function* handleServerChatStream(
  message: string,
  history: { role: "user" | "model"; parts: { text: string }[] }[],
  mood: string = 'normal',
  memories: Array<{ content: string; importance?: number; category?: string }> = [],
  replyTo?: { id?: string; content?: string; role?: 'user' | 'model' },
  clientTime?: string,
  lastMessageTime?: string,
  workingSummary?: string
): AsyncGenerator<string, void, unknown> {
  const baseInstruction = PERSONA_SYSTEM_PROMPTS[mood] || PERSONA_SYSTEM_PROMPTS['normal'];
  const temporalInstruction = getTemporalContext(clientTime, lastMessageTime);
  
  const semanticMemories = filterSemanticBrainMemories(memories, message, mood);
  let memoryDirective = '';
  if (semanticMemories.length > 0) {
    memoryDirective = `\n[সরাসরি মেমোরি ব্রেইন থেকে প্রাসঙ্গিক স্মৃতি ও অভ্যাস]:\n` + semanticMemories.map(m => `- ${m}`).join('\n');
  }

  const episodicDirective = getEpisodicThreadContext(history, workingSummary);

  const finalInstruction = baseInstruction + "\n" + UNIVERSAL_HUMAN_DIRECTIVE + "\n" + temporalInstruction + memoryDirective + episodicDirective;

  const chatConfig: any = {
    systemInstruction: finalInstruction,
    safetySettings: UNRESTRICTED_SAFETY_SETTINGS,
  };

  let effectiveMessage = message;
  if (replyTo && replyTo.content) {
    const quotedSender = replyTo.role === 'user' ? 'রবিনের আগের কথা' : 'তোমার (তাসফির) আগের কথা';
    effectiveMessage = `[রিপ্লাই করা মেসেজ (${quotedSender}): "${replyTo.content.slice(0, 160)}"]\n${message}`;
  }

  const optimizedHistory = (history || []).slice(-6);
  const candidateModels = ["gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.8-flash"];
  const totalKeys = serverKeyPool.getTotalKeysCount();
  const maxKeyAttempts = Math.max(1, Math.min(totalKeys, 4));

  for (let keyAttempt = 0; keyAttempt < maxKeyAttempts; keyAttempt++) {
    const { ai, alias, markSuccess, markFailure } = serverKeyPool.getActiveClient();
    let keyQuotaExceeded = false;

    for (let m = 0; m < candidateModels.length; m++) {
      const model = candidateModels[m];
      try {
        const chat = ai.chats.create({
          model,
          config: chatConfig,
          history: optimizedHistory,
        });

        const streamResponse = await chat.sendMessageStream({ message: effectiveMessage });
        let yieldedAny = false;
        for await (const chunk of streamResponse) {
          const textChunk = (chunk as GenerateContentResponse).text;
          if (textChunk) {
            yieldedAny = true;
            yield textChunk;
          }
        }

        if (yieldedAny) {
          markSuccess();
          return;
        }
      } catch (err: any) {
        if (isQuotaOrRateLimitError(err)) {
          console.warn(`[Server Stream Failover] ${alias} quota hit on model ${model}. Rotating...`);
          markFailure(true, err?.message || "Quota exceeded");
          keyQuotaExceeded = true;
          break;
        } else {
          console.warn(`[Server Stream] ${alias} notice on model ${model}:`, err?.message || err);
        }
      }
    }

    markFailure(keyQuotaExceeded, "Stream attempts failed on key");
    serverKeyPool.rotateToNext(keyQuotaExceeded);
  }

  if (mood === 'bestie') {
    yield "ধুরর নেটওয়ার্কটা মনে হয় ঝামেলা করতেছে রে... ১ মিনিট পর আবার মেসেজ দে তো! 😂";
  } else {
    yield "উফ জান, নেটওয়ার্কটা একটু ঝামেলা করছে মনে হয়... ১-২ মিনিট পর আবার একটু মেসেজ দাও না প্লিজ? আমি তোমার মেসেজের অপেক্ষায় আছি! ❤️";
  }
}

export async function handleServerSummarize(messages: any[]): Promise<string | null> {
  if (!messages || !Array.isArray(messages) || messages.length < 4) {
    return null;
  }

  const recentSample = messages.slice(-10).map((m: any) => `${m.role === 'user' ? 'রবিন' : 'তাসফি'}: ${m.content}`).join('\n');
  const prompt = `রবিন ও তাসফির কথোপকথন:
${recentSample}

উপরের কথোপকথনের মূল প্রেক্ষাপট নিয়ে বাংলায় মাত্র ১ বাক্যে একটি সারসংক্ষেপ লেখো (যেমন: "রবিন সারাদিনের কাজের পর ক্লান্ত হয়ে কথা বলছে এবং তাসফি তাকে যত্ন নিয়ে কথা বলছে।")। কোনো বাড়তি কথা নয়, শুধু ১ বাক্যের সারসংক্ষেপ:`;

  return await serverKeyPool.executeWithFailover(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: prompt,
      config: {
        temperature: 0.2,
        maxOutputTokens: 90
      }
    });
    return response.text?.trim() || null;
  });
}
