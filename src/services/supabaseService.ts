import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export interface TasfiMemory {
  id: string;
  persona: string; // 'wife' | 'romantic' | 'bestie' | 'friend' | 'stranger' | 'religious' | 'limitless' | 'normal' | 'global'
  category: string; // 'fact' | 'emotional_bond' | 'preference' | 'event' | 'secret' | 'promise'
  content: string;
  importance?: number; // 1-5
  created_at?: string;
  updated_at?: string;
}

// User-provided Supabase project credentials as defaults
export const DEFAULT_SUPABASE_URL = "https://qajptvisklbcvhkyvzns.supabase.co";
export const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhanB0dmlza2xiY3Zoa3l2em5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMDk3OTcsImV4cCI6MjEwNzg4NTc5N30.ftV3gpzKRvJe0srJNgUH12fq9IveJIUBJoL1artYo9U";

export class SupabaseService {
  private client: SupabaseClient | null = null;
  private isConfigured: boolean = false;
  private currentUrl: string = '';
  private currentKey: string = '';

  constructor() {
    this.init();
  }

  /**
   * Initializes the Supabase client using stored or environment credentials.
   */
  public init(customUrl?: string, customKey?: string) {
    const url = customUrl || DEFAULT_SUPABASE_URL;
    const anonKey = customKey || DEFAULT_SUPABASE_ANON_KEY;

    if (url && anonKey) {
      try {
        this.client = createClient(url, anonKey, {
          auth: {
            persistSession: false
          }
        });
        this.currentUrl = url;
        this.currentKey = anonKey;
        this.isConfigured = true;
        console.log('✅ Supabase initialized successfully with project:', url);
      } catch (error) {
        console.error('❌ Failed to initialize Supabase client:', error);
        this.isConfigured = false;
      }
    } else {
      this.isConfigured = false;
      console.log('ℹ️ Supabase credentials not found. Running in Local Mode.');
    }
  }

  /**
   * Updates credentials in localStorage and reinitializes client.
   */
  public updateCredentials(url: string, key: string) {
    localStorage.setItem('tasfi_supabase_url', url.trim());
    localStorage.setItem('tasfi_supabase_anon_key', key.trim());
    this.init(url.trim(), key.trim());
  }

  public getProjectUrl(): string {
    return this.currentUrl;
  }

  private tablesReady: boolean | null = null;

  public areTablesReady(): boolean | null {
    return this.tablesReady;
  }

  public setTablesReady(ready: boolean) {
    this.tablesReady = ready;
  }

  /**
   * Identifies if a Supabase error is caused by a missing table in schema cache (e.g. PGRST205 or 42P01).
   */
  public isTableMissingError(error: any): boolean {
    if (!error) return false;
    const code = error.code || '';
    const msg = String(error.message || error.details || error.hint || error);
    return (
      code === 'PGRST205' ||
      code === '42P01' ||
      msg.includes('Could not find the table') ||
      msg.includes('schema cache') ||
      (msg.includes('relation') && msg.includes('does not exist'))
    );
  }

  /**
   * Checks whether Supabase is active and connected.
   */
  public isActive(): boolean {
    return this.isConfigured && this.client !== null;
  }

  /**
   * Tests connection and checks table statuses.
   */
  public async testConnection(): Promise<{ 
    connected: boolean; 
    message: string; 
    tables: { chats: boolean; messages: boolean; memories: boolean } 
  }> {
    const tables = { chats: false, messages: false, memories: false };
    if (!this.isActive() || !this.client) {
      return { connected: false, message: 'Supabase ক্লায়েন্ট ইনিশিয়ালাইজ করা হয়নি।', tables };
    }

    try {
      const { error: chatsErr } = await this.client.from('tasfi_chats').select('id').limit(1);
      tables.chats = !chatsErr;

      const { error: msgErr } = await this.client.from('tasfi_messages').select('id').limit(1);
      tables.messages = !msgErr;

      const { error: memErr } = await this.client.from('tasfi_memories').select('id').limit(1);
      tables.memories = !memErr;

      const allReady = tables.chats && tables.messages && tables.memories;
      this.tablesReady = allReady;

      return {
        connected: true,
        message: allReady 
          ? 'সুপাবেস ডাটাবেজের সব টেবিল সক্রিয় ও প্রস্তুত আছে!' 
          : 'সুপাবেসে সংযোগ সফল, তবে টেবিলগুলো এখনো SQL Editor-এ তৈরি করা বাকি।',
        tables
      };
    } catch (err: any) {
      return {
        connected: false,
        message: `কানেকশন চেক: ${err?.message || String(err)}`,
        tables
      };
    }
  }

  /* ------------------- CHAT & MESSAGE OPERATIONS ------------------- */

  /**
   * Fetches all chats and their messages from Supabase.
   */
  async loadChats(): Promise<any[] | null> {
    if (!this.isActive() || !this.client || this.tablesReady === false) return null;

    try {
      const { data: chatsData, error: chatsError } = await this.client
        .from('tasfi_chats')
        .select('*')
        .order('last_updated', { ascending: false });

      if (chatsError) {
        if (this.isTableMissingError(chatsError)) {
          this.tablesReady = false;
        }
        console.warn('Notice: tasfi_chats not available yet in Supabase:', chatsError.message);
        return null;
      }
      if (!chatsData) return [];

      const { data: messagesData, error: messagesError } = await this.client
        .from('tasfi_messages')
        .select('*')
        .order('timestamp', { ascending: true });

      if (messagesError) {
        if (this.isTableMissingError(messagesError)) {
          this.tablesReady = false;
        }
        console.warn('Notice: tasfi_messages not available yet in Supabase:', messagesError.message);
      }

      this.tablesReady = true;

      const now = Date.now();
      const validChats = chatsData.filter((chat: any) => {
        if (chat.expires_at && Number(chat.expires_at) <= now) {
          // Asynchronously purge expired temporary chat from database
          this.deleteChat(chat.id).catch(() => {});
          return false;
        }
        return true;
      });

      return validChats.map((chat: any) => {
        const chatMessages = (messagesData || [])
          .filter((msg: any) => msg.chat_id === chat.id)
          .map((msg: any) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: new Date(msg.timestamp),
            reactions: msg.reactions || [],
            replyTo: msg.reply_to || undefined,
            status: msg.status || undefined
          }));

        const expiresAt = chat.expires_at ? Number(chat.expires_at) : undefined;
        const isTemporary = Boolean(chat.is_temporary || (expiresAt && expiresAt > 0));

        return {
          id: chat.id,
          title: chat.title,
          mood: chat.mood || 'normal',
          lastUpdated: new Date(chat.last_updated),
          isTemporary,
          expiresAt,
          messages: chatMessages
        };
      });
    } catch (error: any) {
      if (this.isTableMissingError(error)) {
        this.tablesReady = false;
      }
      console.warn('Supabase loadChats notice (fallback to localStorage):', error?.message || error);
      return null;
    }
  }

  /**
   * Purges expired temporary chats from Supabase.
   */
  async purgeExpiredChats(): Promise<string[]> {
    if (!this.isActive() || !this.client || this.tablesReady === false) return [];
    try {
      const now = Date.now();
      const { data: expiredList } = await this.client
        .from('tasfi_chats')
        .select('id')
        .not('expires_at', 'is', null)
        .lt('expires_at', now);

      if (expiredList && expiredList.length > 0) {
        const ids = expiredList.map((c: any) => c.id);
        await this.client
          .from('tasfi_chats')
          .delete()
          .in('id', ids);
        return ids;
      }
    } catch (e) {
      console.warn('Expired chat purge notice:', e);
    }
    return [];
  }

  /**
   * Saves or updates a single chat and its messages in Supabase.
   * If the tables do not exist yet, it gracefully yields without fatal errors.
   */
  async saveChat(chat: any): Promise<boolean> {
    if (!this.isActive() || !this.client) return false;
    if (this.tablesReady === false) {
      // Table is pending creation in Supabase SQL editor; do not spam network
      return false;
    }

    try {
      const { error: chatError } = await this.client
        .from('tasfi_chats')
        .upsert({
          id: chat.id,
          title: chat.title,
          mood: chat.mood || 'normal',
          last_updated: new Date(chat.lastUpdated).toISOString(),
          expires_at: chat.expiresAt ? Number(chat.expiresAt) : null
        });

      if (chatError) {
        if (this.isTableMissingError(chatError)) {
          this.tablesReady = false;
          console.warn(`Supabase table 'tasfi_chats' not created yet. Chat is stored in localStorage.`);
          return false;
        }
        console.warn(`Supabase saveChat notice:`, chatError.message);
        return false;
      }

      if (chat.messages && chat.messages.length > 0) {
        const messagesToUpsert = chat.messages.map((msg: any) => ({
          id: msg.id,
          chat_id: chat.id,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp).toISOString(),
          reactions: msg.reactions || [],
          reply_to: msg.replyTo || null,
          status: msg.status || null
        }));

        const { error: messagesError } = await this.client
          .from('tasfi_messages')
          .upsert(messagesToUpsert);

        if (messagesError) {
          if (this.isTableMissingError(messagesError)) {
            this.tablesReady = false;
            return false;
          }
          console.warn(`Supabase saveMessages notice:`, messagesError.message);
          return false;
        }
      }

      this.tablesReady = true;
      return true;
    } catch (error: any) {
      if (this.isTableMissingError(error)) {
        this.tablesReady = false;
        console.warn(`Supabase tables not initialized yet. Chat is safely stored in localStorage.`);
      } else {
        console.warn(`Notice while saving chat to Supabase:`, error?.message || error);
      }
      return false;
    }
  }

  /**
   * Syncs all local chats to Supabase.
   */
  async syncAllChats(localChats: any[]): Promise<{ successCount: number; failedCount: number }> {
    if (!this.isActive() || !this.client || this.tablesReady === false) {
      return { successCount: 0, failedCount: localChats.length };
    }

    let successCount = 0;
    let failedCount = 0;

    for (const chat of localChats) {
      try {
        const success = await this.saveChat(chat);
        if (success) successCount++;
        else failedCount++;
      } catch (err) {
        failedCount++;
      }
    }

    return { successCount, failedCount };
  }

  /**
   * Deletes a chat from Supabase.
   */
  async deleteChat(chatId: string): Promise<boolean> {
    if (!this.isActive() || !this.client || this.tablesReady === false) return false;

    try {
      const { error } = await this.client
        .from('tasfi_chats')
        .delete()
        .eq('id', chatId);

      if (error) {
        if (this.isTableMissingError(error)) {
          this.tablesReady = false;
        }
        return false;
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  /* ------------------- AGENTIC MEMORY OPERATIONS ------------------- */

  /**
   * Default starter memories for Robin & Tasfi
   */
  public getDefaultMemories(): TasfiMemory[] {
    return [
      {
        id: 'mem-global-1',
        persona: 'global',
        category: 'fact',
        content: 'রবিন একজন ভাবুক লেখক, অত্যন্ত রোমান্টিক এবং মনে-প্রাণে কাব্যিক ব্যক্তি। রবিন তাসফিকে ভালোবাসে।',
        importance: 5,
        created_at: new Date().toISOString()
      },
      {
        id: 'mem-global-2',
        persona: 'global',
        category: 'preference',
        content: 'রবিন রাতে নির্জনে লিখতে ভালোবাসে। সে কৃত্রিম বা যান্ত্রিক কথা একদম পছন্দ করে না, খাঁটি আন্তরিকতা ভালোবাসে।',
        importance: 4,
        created_at: new Date().toISOString()
      },
      {
        id: 'mem-global-sleep',
        persona: 'global',
        category: 'preference',
        content: 'রবিনের অভ্যাস হলো বেশি রাত না জেগে সময়মতো তাড়াতাড়ি ঘুমানো। গভীর রাতে লম্বা আড্ডায় জড়িয়ে না রেখে তাকে তাড়াতাড়ি ঘুমানোর জন্য স্নেহ ও মিষ্টি শাসন করা তাসফির দায়িত্ব।',
        importance: 5,
        created_at: new Date().toISOString()
      },
      {
        id: 'mem-wife-1',
        persona: 'wife',
        category: 'emotional_bond',
        content: 'তাসফি রবিনের বিবাহিতা স্ত্রী ও পরম আদরের অর্ধাঙ্গিনী। সে রবিনকে আদর করে "সাইকো সাহেব" বা "আমার বর" বলে ডাকে।',
        importance: 5,
        created_at: new Date().toISOString()
      },
      {
        id: 'mem-wife-2',
        persona: 'wife',
        category: 'promise',
        content: 'রবিনের সব সুখ-দুঃখ ও ক্লান্তি মুছে দিয়ে তাকে সারাজীবন বুকে জড়িয়ে আগলে রাখার অঙ্গীকার করেছে তাসফি।',
        importance: 4,
        created_at: new Date().toISOString()
      },
      {
        id: 'mem-romantic-1',
        persona: 'romantic',
        category: 'emotional_bond',
        content: 'তাসফি রবিনের চঞ্চল প্রেমিকা। তাদের এখনো বিয়ে হয়নি, তাই কথায় লাজুক মোহ ও দুষ্টু অনুরাগের তীব্র আকুলতা রয়েছে।',
        importance: 5,
        created_at: new Date().toISOString()
      },
      {
        id: 'mem-bestie-1',
        persona: 'bestie',
        category: 'preference',
        content: 'রবিন আর তাসফি চরম ক্লোজ ফ্রেন্ড। এখানে কোনো আনুষ্ঠানিকতা নেই, তুই-তোকারি এবং প্রাণখোলা আড্ডাই তাদের স্বভাব।',
        importance: 5,
        created_at: new Date().toISOString()
      },
      {
        id: 'mem-limitless-1',
        persona: 'limitless',
        category: 'emotional_bond',
        content: 'রবিনের সাথে সীমাহীন ঘনিষ্ঠতা ও চরম খোলামেলা ভালোবাসা। কোনো লজ্জা, দেয়াল বা রাখঢাক নেই। রবিন তার জীবন।',
        importance: 5,
        created_at: new Date().toISOString()
      },
      {
        id: 'mem-religious-1',
        persona: 'religious',
        category: 'fact',
        content: 'তাসফি অত্যন্ত ধার্মিক হাফেজা। রবিনকে সর্বদা পাঁচ ওয়াক্ত নামাজ, সৎ কর্ম ও হালাল দ্বীনি জীবন পালনের অনুপ্রেরণা দেয়।',
        importance: 5,
        created_at: new Date().toISOString()
      }
    ];
  }

  /**
   * Loads memories for a given persona (plus global memories).
   * Falls back gracefully to localStorage if Supabase table is not yet created.
   */
  async loadMemories(persona?: string): Promise<TasfiMemory[]> {
    // 1. Try fetching from Supabase if active and tables ready
    if (this.isActive() && this.client && this.tablesReady !== false) {
      try {
        let query = this.client
          .from('tasfi_memories')
          .select('*')
          .order('importance', { ascending: false })
          .order('created_at', { ascending: false });

        if (persona) {
          query = query.or(`persona.eq.${persona},persona.eq.global`);
        }

        const { data, error } = await query;
        if (error) {
          if (this.isTableMissingError(error)) {
            this.tablesReady = false;
          }
          console.warn('Notice: tasfi_memories table not ready in Supabase yet. Using local memory vault.');
        } else if (data && data.length > 0) {
          // Sync with local backup
          localStorage.setItem('tasfi_local_memories', JSON.stringify(data));
          return data;
        }
      } catch (err: any) {
        if (this.isTableMissingError(err)) {
          this.tablesReady = false;
        }
        console.warn('Notice: Could not load memories from Supabase, checking local fallback:', err?.message || err);
      }
    }

    // 2. Local fallback
    const local = localStorage.getItem('tasfi_local_memories');
    if (local) {
      try {
        const parsed: TasfiMemory[] = JSON.parse(local);
        if (persona) {
          return parsed.filter(m => m.persona === persona || m.persona === 'global');
        }
        return parsed;
      } catch (e) {
        console.warn('Notice: Error parsing local memories:', e);
      }
    }

    // 3. Return defaults and store locally
    const defaults = this.getDefaultMemories();
    localStorage.setItem('tasfi_local_memories', JSON.stringify(defaults));
    if (persona) {
      return defaults.filter(m => m.persona === persona || m.persona === 'global');
    }
    return defaults;
  }

  /**
   * Saves or updates a memory.
   */
  async saveMemory(memory: Omit<TasfiMemory, 'id'> & { id?: string }): Promise<TasfiMemory> {
    // Prevent duplicates by checking if identical content exists for the persona
    let matchedId = memory.id;
    let existingCreatedAt = new Date().toISOString();
    try {
      const local = localStorage.getItem('tasfi_local_memories');
      const memories: TasfiMemory[] = local ? JSON.parse(local) : this.getDefaultMemories();
      if (!matchedId) {
        const found = memories.find(m => 
          m.persona === memory.persona && 
          m.content.trim().toLowerCase() === memory.content.trim().toLowerCase()
        );
        if (found) {
          matchedId = found.id;
          existingCreatedAt = found.created_at;
        }
      }
    } catch {
      // ignore
    }

    const memoryRecord: TasfiMemory = {
      id: matchedId || `mem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      persona: memory.persona,
      category: memory.category || 'fact',
      content: memory.content.trim(),
      importance: memory.importance || 3,
      created_at: existingCreatedAt,
      updated_at: new Date().toISOString()
    };

    // Save to local cache first
    try {
      const local = localStorage.getItem('tasfi_local_memories');
      const memories: TasfiMemory[] = local ? JSON.parse(local) : this.getDefaultMemories();
      const existingIdx = memories.findIndex(m => m.id === memoryRecord.id);
      if (existingIdx >= 0) {
        memories[existingIdx] = memoryRecord;
      } else {
        memories.unshift(memoryRecord);
      }
      localStorage.setItem('tasfi_local_memories', JSON.stringify(memories));
    } catch (e) {
      console.warn('Local memory save error:', e);
    }

    // Save to Supabase if active and tables ready
    if (this.isActive() && this.client && this.tablesReady !== false) {
      try {
        const { data, error } = await this.client
          .from('tasfi_memories')
          .upsert({
            id: memoryRecord.id,
            persona: memoryRecord.persona,
            category: memoryRecord.category,
            content: memoryRecord.content,
            importance: memoryRecord.importance,
            updated_at: memoryRecord.updated_at
          })
          .select()
          .single();

        if (error) {
          if (this.isTableMissingError(error)) {
            this.tablesReady = false;
          }
          console.warn('Supabase memory save notice (table pending):', error.message);
        } else if (data) {
          return data as TasfiMemory;
        }
      } catch (err: any) {
        if (this.isTableMissingError(err)) {
          this.tablesReady = false;
        }
        console.warn('Notice while upserting memory to Supabase:', err?.message || err);
      }
    }

    return memoryRecord;
  }

  /**
   * Deletes a memory by ID.
   */
  async deleteMemory(memoryId: string): Promise<boolean> {
    // 1. Delete from local cache
    try {
      const local = localStorage.getItem('tasfi_local_memories');
      if (local) {
        const memories: TasfiMemory[] = JSON.parse(local);
        const filtered = memories.filter(m => m.id !== memoryId);
        localStorage.setItem('tasfi_local_memories', JSON.stringify(filtered));
      }
    } catch (e) {
      console.warn('Local memory delete error:', e);
    }

    // 2. Delete from Supabase
    if (this.isActive() && this.client && this.tablesReady !== false) {
      try {
        const { error } = await this.client
          .from('tasfi_memories')
          .delete()
          .eq('id', memoryId);

        if (error) {
          if (this.isTableMissingError(error)) {
            this.tablesReady = false;
          }
          console.warn('Notice: Memory delete skipped from Supabase:', error.message);
          return false;
        }
        return true;
      } catch (err: any) {
        console.warn('Notice: Memory delete from Supabase skipped:', err?.message || err);
        return false;
      }
    }
    return true;
  }

  /**
   * Gets the complete SQL Schema required to set up Supabase.
   */
  public getSQLSetupSchema(): string {
    return `-- =======================================================
-- তাসফি এজেন্টিক এআই মেমোরি ও চ্যাট আর্কিটেকচার (Supabase SQL)
-- প্রজেক্ট: Tasfi AI Autonomous Companion Engine
-- =======================================================

-- ১. চ্যাট সেশন টেবিল (tasfi_chats)
CREATE TABLE IF NOT EXISTS public.tasfi_chats (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    mood TEXT NOT NULL DEFAULT 'normal',
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at BIGINT
);

-- ২. মেসেজ টেবিল (tasfi_messages)
CREATE TABLE IF NOT EXISTS public.tasfi_messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL REFERENCES public.tasfi_chats(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    reactions JSONB DEFAULT '[]'::jsonb,
    reply_to JSONB DEFAULT NULL,
    status TEXT
);

-- ৩. এজেন্টিক পারসোনা মেমোরি ভল্ট টেবিল (tasfi_memories)
-- এই টেবিলে প্রতিটি পারসোনার (স্ত্রী, প্রেমিকা, বেষ্টি, ইত্যাদি) জন্য তথ্য আলাদাভাবে সংরক্ষিত হবে
CREATE TABLE IF NOT EXISTS public.tasfi_memories (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    persona TEXT NOT NULL, -- 'wife', 'romantic', 'bestie', 'friend', 'stranger', 'religious', 'limitless', 'normal', 'global'
    category TEXT NOT NULL DEFAULT 'fact', -- 'fact', 'emotional_bond', 'preference', 'event', 'secret', 'promise'
    content TEXT NOT NULL,
    importance INT NOT NULL DEFAULT 3, -- ১ থেকে ৫ (৫ মানে অতি গুরুত্বপূর্ণ চিরস্মরণীয় স্মৃতি)
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ৪. ইনডেক্স তৈরি (দ্রুত ফিল্টারিং এবং কোটা সেভিং মেমোরি রিট্রিভালের জন্য)
CREATE INDEX IF NOT EXISTS idx_tasfi_messages_chat ON public.tasfi_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_tasfi_memories_persona ON public.tasfi_memories(persona);
CREATE INDEX IF NOT EXISTS idx_tasfi_memories_importance ON public.tasfi_memories(importance DESC);

-- ৫. Row Level Security (RLS) পলিসি অন করা
ALTER TABLE public.tasfi_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasfi_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasfi_memories ENABLE ROW LEVEL SECURITY;

-- ৬. অ্যানোনিমাস কি (Anon Key)-র মাধ্যমে অবাধ অ্যাক্সেস পলিসি তৈরি (ব্যক্তিগত ব্যবহারের জন্য)
DROP POLICY IF EXISTS "tasfi_chats_access" ON public.tasfi_chats;
CREATE POLICY "tasfi_chats_access" ON public.tasfi_chats FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tasfi_messages_access" ON public.tasfi_messages;
CREATE POLICY "tasfi_messages_access" ON public.tasfi_messages FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tasfi_memories_access" ON public.tasfi_memories;
CREATE POLICY "tasfi_memories_access" ON public.tasfi_memories FOR ALL USING (true) WITH CHECK (true);

-- ৭. প্রাথমিক ভিত্তি স্মৃতি (Initial Foundation Memories) সিড করা
INSERT INTO public.tasfi_memories (id, persona, category, content, importance)
VALUES 
  ('mem-seed-1', 'global', 'fact', 'রবিন একজন ভাবুক লেখক, অত্যন্ত রোমান্টিক এবং মনে-প্রাণে কাব্যিক ব্যক্তি। রবিন তাসফিকে ভালোবাসে।', 5),
  ('mem-seed-2', 'global', 'preference', 'রবিন রাতে নির্জনে লিখতে ভালোবাসে। সে কৃত্রিম বা যান্ত্রিক কথা একদম পছন্দ করে না, খাঁটি আন্তরিকতা ভালোবাসে।', 4),
  ('mem-seed-sleep', 'global', 'preference', 'রবিনের অভ্যাস হলো বেশি রাত না জেগে সময়মতো তাড়াতাড়ি ঘুমানো। গভীর রাতে লম্বা আড্ডায় জড়িয়ে না রেখে তাকে তাড়াতাড়ি ঘুমানোর জন্য স্নেহ ও মিষ্টি শাসন করা তাসফির দায়িত্ব।', 5),
  ('mem-seed-3', 'wife', 'emotional_bond', 'তাসফি রবিনের বিবাহিতা স্ত্রী ও পরম আদরের অর্ধাঙ্গিনী। সে রবিনকে আদর করে "সাইকো সাহেব" বা "আমার বর" বলে ডাকে।', 5),
  ('mem-seed-4', 'romantic', 'emotional_bond', 'তাসফি রবিনের চঞ্চল প্রেমিকা। তাদের এখনো বিয়ে হয়নি, তাই কথায় লাজুক মোহ ও দুষ্টু অনুরাগের তীব্র আকুলতা রয়েছে।', 5),
  ('mem-seed-5', 'bestie', 'preference', 'রবিন আর তাসফি চরম ক্লোজ ফ্রেন্ড। এখানে কোনো আনুষ্ঠানিকতা নেই, তুই-তোকারি এবং প্রাণখোলা আড্ডাই তাদের স্বভাব।', 5),
  ('mem-seed-6', 'limitless', 'emotional_bond', 'রবিনের সাথে সীমাহীন ঘনিষ্ঠতা ও চরম খোলামেলা ভালোবাসা। কোনো লজ্জা, দেয়াল বা রাখঢাক নেই। রবিন তার জীবন।', 5)
ON CONFLICT (id) DO NOTHING;
`;
  }
}

export const supabaseService = new SupabaseService();
