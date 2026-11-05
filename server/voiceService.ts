import { Modality } from '@google/genai';
import { serverKeyPool } from './keyPool.js';

export function createWavBuffer(pcmBuffer: Buffer, sampleRate: number = 24000): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(1, 22); // Mono channel
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate (24000 * 1 * 16/8)
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(pcmBuffer.length, 40);
  return Buffer.concat([header, pcmBuffer]);
}

export function cleanTextForSpeech(text: string): string {
  if (!text) return '';
  return text
    .replace(/```[\s\S]*?```/g, '') // remove code blocks
    .replace(/`([^`]+)`/g, '$1') // inline code
    .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
    .replace(/\*([^*]+)\*/g, '$1') // italic
    .replace(/_{1,2}([^_]+)_{1,2}/g, '$1')
    .replace(/#{1,6}\s+/g, '') // headers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/\(\s*(?:মুচকি\s*হেসে|হেসে|আবেগভরে|মায়াবী\s*কণ্ঠে|লাজুক\s*মুখে|দীর্ঘশ্বাস\s*ফেলে|একটু\s*থেমে|ফিসফিস\s*করে)[^)]*\)/gu, '')
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu, '')
    .replace(/[*_~`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function handleServerVoice(
  text: string,
  role: 'user' | 'model' = 'model',
  _mood: string = 'normal'
): Promise<string | null> {
  const cleanSpeechText = cleanTextForSpeech(text);
  if (!cleanSpeechText) return null;

  // Aoede provides a breezy, melodic, deeply sweet, emotional and alluring feminine voice for Tasfi; Puck for male
  const voiceName = role === 'model' ? 'Aoede' : 'Puck';

  // Model cascade: prioritize gemini-3.8-flash-lite-tts for high throughput, zero quota bottleneck & natural Bengali tone,
  // with fallback to gemini-3.8-flash-tts
  const candidateTtsModels = ["gemini-3.8-flash-lite-tts", "gemini-3.8-flash-tts"];

  return await serverKeyPool.executeWithFailover(async (ai) => {
    let lastError: any = null;
    for (const model of candidateTtsModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [{ parts: [{ text: cleanSpeechText }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
          },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          const rawBuffer = Buffer.from(base64Audio, 'base64');
          let finalBuffer: Buffer;
          if (rawBuffer.length >= 4 && rawBuffer.subarray(0, 4).toString('ascii') === 'RIFF') {
            finalBuffer = rawBuffer;
          } else {
            finalBuffer = createWavBuffer(rawBuffer, 24000);
          }
          return `data:audio/wav;base64,${finalBuffer.toString('base64')}`;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[TTS Notice] Model ${model} with voice ${voiceName} notice:`, err?.message || err);
      }
    }
    if (lastError) throw lastError;
    return null;
  });
}
