import { serverKeyPool } from './keyPool.js';

export async function handleServerMemoryExtraction(
  userMessage: string,
  _botReply: string,
  currentMood: string
): Promise<{ category: string; content: string; importance: number; isGlobal: boolean } | null> {
  const cleanMsg = userMessage.trim();
  const trivialPattern = /^(হুম|হুমম|হু|আচ্ছা|ওকে|ok|hmm|hi|hello|বাই|bye|হাহাহা|হেহে|হ্যাঁ|না|বলো|কেমন আছো|কী অবস্থা|শুভ সকাল|শুভ রাত্রি|থ্যাংকস|ধন্যবাদ)$/i;
  if (cleanMsg.length < 4 || trivialPattern.test(cleanMsg)) {
    return null;
  }

  const nameMatch = cleanMsg.match(/আমার নাম\s+([^\s,।.]+)/i);
  if (nameMatch) {
    return { category: 'fact', content: `রবিনের নাম ${nameMatch[1]}`, importance: 5, isGlobal: true };
  }

  const likeMatch = cleanMsg.match(/(?:আমি|আমার)\s+([^,।.!]+?)\s+(?:খুব\s+)?(?:ভালোবাসি|পছন্দ করি|পছন্দ)/i);
  if (likeMatch && likeMatch[1].length < 30) {
    return { category: 'preference', content: `রবিন ${likeMatch[1].trim()} পছন্দ করে`, importance: 4, isGlobal: false };
  }

  const dislikeMatch = cleanMsg.match(/(?:আমি|আমার)\s+([^,।.!]+?)\s+(?:অপছন্দ করি|ঘৃণা করি|পছন্দ না)/i);
  if (dislikeMatch && dislikeMatch[1].length < 30) {
    return { category: 'preference', content: `রবিন ${dislikeMatch[1].trim()} অপছন্দ করে`, importance: 4, isGlobal: false };
  }

  const sickMatch = cleanMsg.match(/আমার\s+(মাথা\s*ব্যথা|জ্বর|শরীর\s*খারাপ|অসুস্থ|ঠাণ্ডা\s*লেগেছে)/i);
  if (sickMatch) {
    return { category: 'fact', content: `রবিনের ${sickMatch[1]} করছে / অসুস্থ`, importance: 4, isGlobal: false };
  }

  const habitMatch = cleanMsg.match(/(?:রাতে\s*দেরি\s*করে\s*ঘুমাই|সকালে\s*দেরি\s*করে\s*উঠি|চা\s*খাই|কফি\s*খাই)/i);
  if (habitMatch) {
    return { category: 'fact', content: `রবিনের অভ্যাস: ${habitMatch[0]}`, importance: 3, isGlobal: true };
  }

  const sleepMatch = cleanMsg.match(/(?:বেশি\s*রাত|রাত\s*না\s*জাগ|তাড়াতাড়ি\s*ঘুমা|ঘুমাইতে\s*যাইতে\s*মানা|তাড়াতাড়ি\s*ঘুমাব|রাত\s*জেগে\s*কথা|ঘুমের\s*কথা|ঘুমের\s*রিমাইন্ডার)/i);
  if (sleepMatch) {
    return { category: 'preference', content: 'রবিন বেশি রাত না জেগে সময়মতো তাড়াতাড়ি ঘুমাতে চায়। রাত গভীর হলে তাকে ঘুমানোর রিমাইন্ডার দেওয়া আবশ্যক।', importance: 5, isGlobal: true };
  }

  const promiseMatch = cleanMsg.match(/(?:কথা\s*দিলাম|প্রতিশ্রুতি\s*দিলাম)\s*([^,।.!]+)/i);
  if (promiseMatch) {
    return { category: 'promise', content: `রবিনের প্রতিশ্রুতি: ${promiseMatch[1].trim()}`, importance: 5, isGlobal: false };
  }

  const personalPattern = /(আমি|আমার|আমাকে|আমারে|আমারও|ভালোবাসি|পছন্দ|অপছন্দ|ঘৃণা|খাই|যাব|ঘুমাব|রাত|চা|কফি|অফিস|কাজ|মা|বাবা|ভাই|বোন|বন্ধু|নাম|বয়স|জ্বর|অসুস্থ|মাথা|কবিতা|গান|শখ|শাড়ি|গিফট|উপহার|কথা দিলাম|প্রতিশ্রুতি|মনে রেখো|মনে রাখিস|ভুলো না|কাল|আজ|গতকাল|টাকা|বাড়ি)/;
  if (!personalPattern.test(cleanMsg) || cleanMsg.length < 15) {
    return null;
  }

  try {
    const prompt = `তুমি স্মৃতি বিশ্লেষক AI এজেন্ট। রবিন (ইউজার) ও তাসফির (সঙ্গিনী) কথপোকথন:
ইউজার: "${userMessage}"
মোড: "${currentMood}"

যদি ইউজারের বার্তায় রবিনের কোনো ব্যক্তিগত পছন্দ, অভ্যাস, শারীরিক অবস্থা, ঘটনা, অনুভূতি, প্রতিশ্রুতি বা তথ্য থাকে যা মনে রাখা জরুরি, তবে একটি মাত্র JSON রিটার্ন করো:
{"shouldSave":true,"category":"preference"|"fact"|"event"|"promise"|"emotion","content":"বাংলায় এক লাইনে সংক্ষেপে স্মৃতিটি লিখবে","importance":3,"isGlobal":true|false}

যদি কোনো স্থায়ী স্মৃতি রাখার মতো কিছু না থাকে, তবে রিটার্ন করো:
{"shouldSave":false}

শুধুমাত্র ভ্যালিড JSON রিটার্ন করবে।`;

    return await serverKeyPool.executeWithFailover(async (ai) => {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.1,
          maxOutputTokens: 120
        }
      });

      const text = response.text?.trim();
      if (!text) return null;

      const parsed = JSON.parse(text);
      if (parsed && parsed.shouldSave && parsed.content) {
        return {
          category: parsed.category || 'fact',
          content: parsed.content.trim(),
          importance: Math.min(5, Math.max(1, parsed.importance || 3)),
          isGlobal: Boolean(parsed.isGlobal)
        };
      }
      return null;
    });
  } catch (e) {
    console.warn("[Server Memory] Extraction skipped:", e);
    return null;
  }
}
