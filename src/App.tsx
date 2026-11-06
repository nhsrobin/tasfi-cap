import React, { useState, useRef, useEffect } from 'react';
import { Send, Heart, Sparkles, Menu, Plus, MessageSquare, X, ArrowDown, Search, MoreVertical, Edit2, Trash2, Check, Download, Settings, Moon, Sun, Eye, Smile, Frown, Angry, BookOpen, Clock, Users, HelpCircle, Laugh, Gem, Info, Phone, Mic, Paperclip, PhoneOff, MicOff, Video, VideoOff, Volume2, VolumeX, Minus, Maximize2, Minimize2, Flame, Database, Cloud, Copy, CheckCircle, Brain, Key, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { geminiService } from './services/geminiService';
import { apiKeyPool } from './services/apiKeyPool';
import { supabaseService, TasfiMemory } from './services/supabaseService';
import { ChatMessage } from './components/ChatMessage';
import { ThemeBackground } from './components/ThemeBackground';
import { ExportModal } from './components/ExportModal';
import { MemoryVaultModal } from './components/MemoryVaultModal';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
  reactions?: string[];
  replyTo?: {
    id: string;
    content: string;
    role: 'user' | 'model';
  };
  status?: 'sending' | 'sent' | 'delivered' | 'seen';
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  lastUpdated: Date;
  isTemporary?: boolean;
  expiresAt?: number;
  mood?: string;
  summary?: string;
}

const getInitialMessage = (moodStr: string = 'normal'): Message => {
  let content = 'রবিন, কীভাবে সাহায্য করতে পারি? বলো।';
  if (moodStr === 'romantic') {
    content = 'রবিন, কেমন আছো? তোমার জন্য অপেক্ষা করছিলাম... ❤️';
  } else if (moodStr === 'husband' || moodStr === 'wife') {
    content = 'বাসায় ফিরতে এত দেরি হলো? ফ্রেশ হয়ে নাও আগে... ❤️';
  } else if (moodStr === 'bestie') {
    content = 'কিরে বান্দর! কী খবর তোর? বল কী অকাজ করলি সারা দিন? 😂';
  } else if (moodStr === 'friend') {
    content = 'হাই রবিন! কেমন আছো বলো? অনেকক্ষণ পর চ্যাটে পেলাম।';
  } else if (moodStr === 'stranger') {
    content = 'আসসালামু আলাইকুম। দুঃখিত, আপনাকে ঠিক চিনতে পারলাম না... আপনার পরিচয় কি জানতে পারি?';
  } else if (moodStr === 'religious') {
    content = 'আসসালামু আলাইকুম ওয়া রাহমাতুল্লাহ। রবিন, দিনটা কেমন কাটলো? মন শান্ত আছে তো?';
  } else if (moodStr === 'limitless') {
    content = 'অবশেষে এলে? বলো, তোমার মনে কী চলছে? ❤️';
  }
  return {
    id: `initial-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    role: 'model',
    content,
    timestamp: new Date(),
  };
};

const PROFILE_PIC = "/profile.png";

const SplashScreen = ({ onFinish }: { onFinish: () => void }) => {
  useEffect(() => {
    // Fallback timer
    const timer = setTimeout(onFinish, 4500);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      className="fixed inset-0 z-[99999] bg-black flex items-center justify-center overflow-hidden w-screen h-screen"
    >
      <motion.img 
        src="/splash.jpg?v=1.1"
        initial={{ scale: 1.1, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="w-full h-full object-cover select-none pointer-events-none"
        onAnimationComplete={() => {
          setTimeout(onFinish, 1800);
        }}
        onError={() => {
          console.warn("Splash image failed to load, skipping...");
          onFinish();
        }}
      />
    </motion.div>
  );
};

export default function App() {
  const [chats, setChats] = useState<Chat[]>(() => {
    const saved = localStorage.getItem('tasfi_chats');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((c: any) => ({
          ...c,
          mood: c.mood || 'normal',
          lastUpdated: new Date(c.lastUpdated),
          messages: c.messages.map((m: any) => ({ 
            ...m, 
            timestamp: new Date(m.timestamp),
            status: m.status || (m.role === 'user' ? 'seen' : undefined)
          })),
          expiresAt: c.expiresAt ? Number(c.expiresAt) : undefined
        }));
      } catch (e) {
        console.error("Failed to parse saved chats", e);
      }
    }
    return [{
      id: 'default',
      title: 'প্রথম আলাপ',
      messages: [getInitialMessage('normal')],
      lastUpdated: new Date(),
      mood: 'normal'
    }];
  });

  const [activeChatId, setActiveChatId] = useState<string>(chats[0].id);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [mood, setMood] = useState(() => localStorage.getItem('tasfi_mood') || 'normal');
  const [theme, setTheme] = useState(() => localStorage.getItem('tasfi_theme') || 'love');
  const [displayMode, setDisplayMode] = useState(() => localStorage.getItem('tasfi_displayMode') || 'light');
  const [nickname, setNickname] = useState(() => localStorage.getItem('tasfi_nickname') || 'তাসফি');
  
  const [profilePic, setProfilePic] = useState(() => {
    const saved = localStorage.getItem('tasfi_profilePic');
    // Force reset if it's an old placeholder or specifically a path that we want to override
    if (!saved || 
        saved.includes('picsum.photos') || 
        saved.includes('profile.png') ||
        saved === "/public/profile.png" ||
        (saved.startsWith('http') && !saved.includes(window.location.host) && !saved.includes('drive.google.com'))) {
      return PROFILE_PIC;
    }
    return saved;
  });
  
  const [showSplash, setShowSplash] = useState(true);
  
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [chatToExport, setChatToExport] = useState<Chat | null>(null);
  const [isMoodMenuOpen, setIsMoodMenuOpen] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [menuOpenChatId, setMenuOpenChatId] = useState<string | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);

  const [isCallActive, setIsCallActive] = useState(false);
  const [isCallMinimized, setIsCallMinimized] = useState(false);
  const [callStatus, setCallStatus] = useState<'calling' | 'connected'>('calling');
  const [callSeconds, setCallSeconds] = useState(0);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);

  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordedPrefixRef = useRef<string>('');
  const voiceTranscriptRef = useRef<string>('');
  const isRecordingCommittedRef = useRef<boolean>(false);
  const [showTextareaScrollbar, setShowTextareaScrollbar] = useState(false);
  
  const [isDbLoading, setIsDbLoading] = useState(false);
  const [supabaseActive, setSupabaseActive] = useState(() => supabaseService.isActive());
  const [tablesNeedSetup, setTablesNeedSetup] = useState(false);
  const [hasLoadedFromDb, setHasLoadedFromDb] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [copiedSql, setCopiedSql] = useState(false);
  const [, setKeyPoolVersion] = useState(0);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  useEffect(() => {
    const unsubscribe = apiKeyPool.subscribe(() => {
      setKeyPoolVersion(v => v + 1);
    });
    return unsubscribe;
  }, []);

  // Visual viewport height handler for mobile virtual keyboard
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const updateViewport = () => {
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, 100);
      }
    };

    updateViewport();
    window.visualViewport.addEventListener('resize', updateViewport);
    window.visualViewport.addEventListener('scroll', updateViewport);

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateViewport);
        window.visualViewport.removeEventListener('scroll', updateViewport);
      }
    };
  }, []);

  // Agentic Memory States
  const [memories, setMemories] = useState<TasfiMemory[]>([]);
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);

  // Load chats & memories on mount
  useEffect(() => {
    // 1. Load memories
    supabaseService.loadMemories().then(mems => {
      if (mems && mems.length > 0) {
        setMemories(mems);
      }
    }).catch(err => {
      console.warn("Notice: Local memory fallback active:", err?.message || err);
    });

    // 2. Load chats from Supabase if active
    if (supabaseService.isActive()) {
      setIsDbLoading(true);

      // Probe schema status in background
      supabaseService.testConnection().then(res => {
        if (!res.tables.chats || !res.tables.memories) {
          setTablesNeedSetup(true);
        } else {
          setTablesNeedSetup(false);
        }
      }).catch(() => {});

      supabaseService.loadChats()
        .then(dbChats => {
          if (dbChats && dbChats.length > 0) {
            setChats(dbChats);
            const savedActiveId = localStorage.getItem('tasfi_activeChatId') || dbChats[0].id;
            if (dbChats.some(c => c.id === savedActiveId)) {
              setActiveChatId(savedActiveId);
            } else {
              setActiveChatId(dbChats[0].id);
            }
          }
          setHasLoadedFromDb(true);
        })
        .catch(err => {
          console.warn("Supabase initial load notice (using localStorage fallback):", err?.message || err);
          setHasLoadedFromDb(true); // fall back to local storage
        })
        .finally(() => {
          setIsDbLoading(false);
        });
    } else {
      setHasLoadedFromDb(true);
    }
  }, []);

  // Active temporary chat expiration checker: runs every 30s to purge expired chats locally & in Supabase
  useEffect(() => {
    const checkExpiration = () => {
      const now = Date.now();
      setChats(prev => {
        const expiredIds: string[] = [];
        const filtered = prev.filter(c => {
          if (c.isTemporary && c.expiresAt && c.expiresAt <= now) {
            expiredIds.push(c.id);
            return false;
          }
          return true;
        });

        if (expiredIds.length > 0) {
          if (expiredIds.includes(activeChatId)) {
            const nextChat = filtered.find(c => (c.mood || 'normal') === mood) || filtered[0];
            if (nextChat) {
              setActiveChatId(nextChat.id);
            }
          }
          if (supabaseService.isActive()) {
            expiredIds.forEach(id => supabaseService.deleteChat(id).catch(() => {}));
          }
          return filtered;
        }
        return prev;
      });
    };

    checkExpiration();
    const interval = setInterval(checkExpiration, 30000);
    return () => clearInterval(interval);
  }, [activeChatId, mood]);

  const handleAddMemory = async (newMemory: Omit<TasfiMemory, 'id'>) => {
    const saved = await supabaseService.saveMemory(newMemory);
    setMemories(prev => [saved, ...prev.filter(m => m.id !== saved.id)]);
  };

  const handleDeleteMemory = async (memoryId: string) => {
    await supabaseService.deleteMemory(memoryId);
    setMemories(prev => prev.filter(m => m.id !== memoryId));
  };

  const scrollbarTimeoutRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    let timer: any;
    if (isCallActive) {
      setCallStatus('calling');
      setCallSeconds(0);
      setIsCallMinimized(false);
      timer = setTimeout(() => {
        setCallStatus('connected');
      }, 3000);
    }
    return () => clearTimeout(timer);
  }, [isCallActive]);

  useEffect(() => {
    let interval: any;
    if (isCallActive && callStatus === 'connected') {
      interval = setInterval(() => {
        setCallSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isCallActive, callStatus]);

  const formatCallTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    let interval: any;
    if (isListening) {
      interval = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isListening]);

  const cleanAndDeduplicateBengaliSpeech = (raw: string): string => {
    if (!raw) return '';
    const text = raw.replace(/\s+/g, ' ').trim();
    if (!text) return '';

    const words = text.split(' ').filter(Boolean);
    if (words.length <= 1) return text;

    // 1. Remove immediate consecutive duplicate words: e.g. "আমি আমি ভাত ভাত খাব খাব" -> "আমি ভাত খাব"
    const singleDeduped: string[] = [];
    for (let i = 0; i < words.length; i++) {
      if (i === 0 || words[i] !== words[i - 1]) {
        singleDeduped.push(words[i]);
      }
    }

    // 2. Remove consecutive duplicate multi-word phrases (from 10 words down to 2 words)
    let currentWords = [...singleDeduped];
    for (let len = 10; len >= 2; len--) {
      let changed = true;
      while (changed) {
        changed = false;
        if (currentWords.length < len * 2) break;
        for (let i = 0; i <= currentWords.length - len * 2; i++) {
          const p1 = currentWords.slice(i, i + len).join(' ');
          const p2 = currentWords.slice(i + len, i + len * 2).join(' ');
          if (p1.toLowerCase() === p2.toLowerCase()) {
            currentWords.splice(i + len, len);
            changed = true;
            break;
          }
        }
      }
    }

    return currentWords.join(' ').trim();
  };

  const commitSpokenText = () => {
    if (isRecordingCommittedRef.current) return;
    isRecordingCommittedRef.current = true;

    const spoken = cleanAndDeduplicateBengaliSpeech(voiceTranscriptRef.current);
    const prefix = recordedPrefixRef.current.trim();
    
    if (spoken) {
      const combined = prefix ? `${prefix} ${spoken}` : spoken;
      setInput(combined.replace(/\s+/g, ' ').trim());
    }
    
    voiceTranscriptRef.current = '';
    setLiveTranscript('');
    setInterimTranscript('');
    setIsListening(false);
  };

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'bn-BD';
      
      rec.onstart = () => {
        setIsListening(true);
        setRecordingSeconds(0);
        isRecordingCommittedRef.current = false;
        voiceTranscriptRef.current = '';
        setLiveTranscript('');
        setInterimTranscript('');
      };
      
      rec.onresult = (event: any) => {
        let accumulatedFinal = '';
        let currentInterim = '';
        for (let i = 0; i < event.results.length; ++i) {
          const item = event.results[i];
          const textChunk = item[0]?.transcript || '';
          if (item.isFinal) {
            accumulatedFinal += (accumulatedFinal ? ' ' : '') + textChunk.trim();
          } else {
            currentInterim += (currentInterim ? ' ' : '') + textChunk.trim();
          }
        }
        
        const rawSpoken = [accumulatedFinal, currentInterim].filter(Boolean).join(' ').trim();
        const cleanSpoken = cleanAndDeduplicateBengaliSpeech(rawSpoken);
        voiceTranscriptRef.current = cleanSpoken;
        setLiveTranscript(cleanSpoken);
        setInterimTranscript(currentInterim);
      };
      
      rec.onerror = (event: any) => {
        console.warn("Speech recognition notice:", event.error);
        if (event.error === 'not-allowed') {
          alert('ভয়েস রিকগনেশন ব্যবহারের জন্য মাইক্রোফোন পারমিশন প্রয়োজন।');
        }
        setIsListening(false);
      };
      
      rec.onend = () => {
        commitSpokenText();
      };
      
      recognitionRef.current = rec;
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("দুঃখিত, আপনার ব্রাউজারে বা ডিভাইসে ভয়েস রিকগনেশন সাপোর্ট করছে না। গুগল ক্রোম ব্রাউজার ব্যবহার করুন।");
      return;
    }
    
    if (isListening) {
      handleDoneRecording();
    } else {
      try {
        isRecordingCommittedRef.current = false;
        recordedPrefixRef.current = input;
        voiceTranscriptRef.current = '';
        setLiveTranscript('');
        setInterimTranscript('');
        setRecordingSeconds(0);
        recognitionRef.current.start();
      } catch (e) {
        console.warn("Speech recognition start notice:", e);
      }
    }
  };

  const handleCancelRecording = () => {
    isRecordingCommittedRef.current = true;
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsListening(false);
    setInput(recordedPrefixRef.current);
    voiceTranscriptRef.current = '';
    setLiveTranscript('');
    setInterimTranscript('');
  };

  const handleDoneRecording = () => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    commitSpokenText();
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = textareaRef.current.value.length;
        textareaRef.current.selectionEnd = textareaRef.current.value.length;
      }
    }, 60);
  };

  const handleSendFromRecording = () => {
    isRecordingCommittedRef.current = true;
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsListening(false);
    const spoken = cleanAndDeduplicateBengaliSpeech(voiceTranscriptRef.current);
    const prefix = recordedPrefixRef.current.trim();
    const combined = prefix && spoken ? `${prefix} ${spoken}` : (spoken || prefix);
    setInput('');
    voiceTranscriptRef.current = '';
    setLiveTranscript('');
    setInterimTranscript('');
    if (combined.trim()) {
      handleSend(combined.trim());
    }
  };

  const triggerScrollbarVisibility = () => {
    if (textareaRef.current) {
      const isOverflowing = textareaRef.current.scrollHeight > textareaRef.current.clientHeight;
      if (!isOverflowing) {
        setShowTextareaScrollbar(false);
        return;
      }
    }
    setShowTextareaScrollbar(true);
    if (scrollbarTimeoutRef.current) {
      clearTimeout(scrollbarTimeoutRef.current);
    }
    scrollbarTimeoutRef.current = setTimeout(() => {
      setShowTextareaScrollbar(false);
    }, 1500);
  };

  useEffect(() => {
    return () => {
      if (scrollbarTimeoutRef.current) {
        clearTimeout(scrollbarTimeoutRef.current);
      }
    };
  }, []);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePic(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const activeChat = chats.find(c => c.id === activeChatId) || chats[0];

  useEffect(() => {
    localStorage.setItem('tasfi_activeChatId', activeChatId);
  }, [activeChatId]);

  useEffect(() => {
    localStorage.setItem('tasfi_chats', JSON.stringify(chats));

    if (supabaseService.isActive() && hasLoadedFromDb) {
      // Don't attempt network sync if tables are known to not exist yet
      if (supabaseService.areTablesReady() === false) {
        return;
      }

      const handler = setTimeout(() => {
        const activeChatToSync = chats.find(c => c.id === activeChatId);
        if (activeChatToSync) {
          supabaseService.saveChat(activeChatToSync).then(success => {
            if (!success && supabaseService.areTablesReady() === false) {
              setTablesNeedSetup(true);
            }
          }).catch(err => {
            console.warn("Supabase chat sync pending table setup:", err?.message || err);
          });
        }
      }, 1000); // 1 sec debounce

      return () => clearTimeout(handler);
    }
  }, [chats, activeChatId, hasLoadedFromDb]);

  useEffect(() => {
    localStorage.setItem('tasfi_mood', mood);
    
    // Switch or create chat matching the new mood
    const moodChats = chats.filter(c => (c.mood || 'normal') === mood);
    if (moodChats.length > 0) {
      const currentActiveChat = chats.find(c => c.id === activeChatId);
      if (!currentActiveChat || (currentActiveChat.mood || 'normal') !== mood) {
        setActiveChatId(moodChats[0].id);
      }
    } else {
      const newChatId = `chat-${mood}-${Date.now()}`;
      const newChat: Chat = {
        id: newChatId,
        title: 'প্রথম আলাপ',
        messages: [getInitialMessage(mood)],
        lastUpdated: new Date(),
        mood: mood
      };
      setChats(prev => [newChat, ...prev]);
      setActiveChatId(newChatId);
    }
  }, [mood]);

  useEffect(() => {
    localStorage.setItem('tasfi_theme', theme);
  }, [theme]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('mode-light', 'mode-dark', 'mode-eye-comfort', 'dark');
    root.classList.add(`mode-${displayMode}`);
    if (displayMode === 'dark') {
      root.classList.add('dark');
    }
    localStorage.setItem('tasfi_displayMode', displayMode);
  }, [displayMode]);

  useEffect(() => {
    localStorage.setItem('tasfi_nickname', nickname);
  }, [nickname]);

  useEffect(() => {
    localStorage.setItem('tasfi_profilePic', profilePic);
  }, [profilePic]);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeChat.messages, isLoading]);

  useEffect(() => {
    const handleScroll = () => {
      if (chatContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        setShowScrollButton(!isNearBottom);
      }
    };

    const container = chatContainerRef.current;
    container?.addEventListener('scroll', handleScroll);
    return () => container?.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const checkExpiry = () => {
      const now = Date.now();
      const expiredChats = chats.filter(c => c.isTemporary && c.expiresAt && now > c.expiresAt);
      
      if (expiredChats.length > 0) {
        setChats(prev => {
          const filtered = prev.filter(c => !c.isTemporary || !c.expiresAt || now <= c.expiresAt);
          // If active chat was expired, switch to the first available chat
          if (expiredChats.some(ec => ec.id === activeChatId)) {
            const moodChats = filtered.filter(c => (c.mood || 'normal') === mood);
            if (moodChats.length > 0) {
              setActiveChatId(moodChats[0].id);
            } else if (filtered.length > 0) {
              setActiveChatId(filtered[0].id);
            } else {
              // Should not happen as we always have at least one chat, but for safety:
              const defaultChat: Chat = {
                id: 'default',
                title: 'প্রথম আলাপ',
                messages: [getInitialMessage(mood)],
                lastUpdated: new Date(),
                mood: mood
              };
              setActiveChatId(defaultChat.id);
              return [defaultChat];
            }
          }
          return filtered;
        });
      }
    };

    const interval = setInterval(checkExpiry, 60000); // Check every minute
    checkExpiry(); // Initial check
    return () => clearInterval(interval);
  }, [chats, activeChatId, mood]);

  const createNewChat = () => {
    const moodChats = chats.filter(c => (c.mood || 'normal') === mood);
    const newChat: Chat = {
      id: Date.now().toString(),
      title: `নতুন আলাপ ${moodChats.length + 1}`,
      messages: [getInitialMessage(mood)],
      lastUpdated: new Date(),
      mood: mood
    };
    setChats([newChat, ...chats]);
    setActiveChatId(newChat.id);
    setIsSidebarOpen(false);
  };

  const getRemainingTimeText = (expiresAt?: number) => {
    if (!expiresAt) return '৫ ঘণ্টা বাকি';
    const diff = expiresAt - Date.now();
    if (diff <= 0) return 'মেয়াদ শেষ';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) {
      return `${hours}ঘ. ${mins}মি.`;
    }
    return `${mins} মি.`;
  };

  const createTemporaryChat = () => {
    const expiresAt = Date.now() + 5 * 60 * 60 * 1000; // exactly 5 hours from now
    const newChat: Chat = {
      id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      title: `টেম্পোরারি আলাপ`,
      messages: [getInitialMessage(mood)],
      lastUpdated: new Date(),
      isTemporary: true,
      expiresAt: expiresAt,
      mood: mood
    };
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setIsSidebarOpen(false);

    // Save directly to Supabase database immediately
    if (supabaseService.isActive()) {
      supabaseService.saveChat(newChat).catch(err => {
        console.warn("Immediate temp chat sync notice:", err);
      });
    }
  };

  const renameChat = (id: string) => {
    if (!editingTitle.trim()) {
      setEditingChatId(null);
      return;
    }
    setChats(prev => prev.map(c => 
      c.id === id ? { ...c, title: editingTitle.trim() } : c
    ));
    setEditingChatId(null);
  };

  const deleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpenChatId(null);
    
    if (supabaseService.isActive()) {
      supabaseService.deleteChat(id).catch(err => {
        console.error("Failed to delete chat from Supabase:", err);
      });
    }
    
    const moodChats = chats.filter(c => (c.mood || 'normal') === mood);
    if (moodChats.length === 1 && moodChats[0].id === id) {
      // If deleting the only chat in this mood, replace it with a fresh one for this mood
      const newChatId = `chat-${mood}-${Date.now()}`;
      const freshChat: Chat = {
        id: newChatId,
        title: 'প্রথম আলাপ',
        messages: [getInitialMessage(mood)],
        lastUpdated: new Date(),
        mood: mood
      };
      setChats(prev => prev.filter(c => c.id !== id).concat(freshChat));
      setActiveChatId(newChatId);
      return;
    }
    
    const newChats = chats.filter(c => c.id !== id);
    setChats(newChats);
    if (activeChatId === id) {
      const remainingMoodChats = newChats.filter(c => (c.mood || 'normal') === mood);
      if (remainingMoodChats.length > 0) {
        setActiveChatId(remainingMoodChats[0].id);
      } else {
        setActiveChatId(newChats[0].id);
      }
    }
  };

  const exportChat = (chat: Chat) => {
    setChatToExport(chat);
    setIsExportModalOpen(true);
    setMenuOpenChatId(null);
  };

  const handleReact = (messageId: string, emoji: string) => {
    setChats(prev => prev.map(c => 
      c.id === activeChatId 
        ? { 
            ...c, 
            messages: c.messages.map(m => {
              if (m.id !== messageId) return m;
              const currentReactions = m.reactions || [];
              const hasReaction = currentReactions.includes(emoji);
              // If it already has THIS reaction, remove it (toggle off)
              // Otherwise, replace all reactions with just this one
              const newReactions = hasReaction ? [] : [emoji];
              return { ...m, reactions: newReactions };
            }),
            lastUpdated: new Date()
          } 
        : c
    ));
  };

  const handleReply = (messageId: string) => {
    const message = activeChat.messages.find(m => m.id === messageId);
    if (message) {
      setReplyingTo(message);
    }
  };

  const handleDeleteMessage = (messageId: string) => {
    setChats(prev => prev.map(c => 
      c.id === activeChatId 
        ? { ...c, messages: c.messages.filter(m => m.id !== messageId), lastUpdated: new Date() } 
        : c
    ));
    setTimeout(() => scrollToBottom(), 100);
  };

  const handleEditMessage = (messageId: string, newContent: string) => {
    setChats(prev => prev.map(c => 
      c.id === activeChatId 
        ? { 
            ...c, 
            messages: c.messages.map(m => 
              m.id === messageId ? { ...m, content: newContent } : m
            ),
            lastUpdated: new Date()
          } 
        : c
    ));
    setTimeout(() => scrollToBottom(), 100);
  };

  const replyToName = (role: 'user' | 'model') => {
    return role === 'user' ? 'নিজেকে' : 'তাসফি';
  };

  const isMobileClient = () => {
    if (typeof window === 'undefined') return false;
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.innerWidth < 768 ||
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      const isMobile = isMobileClient();
      if (isMobile) {
        // Mobile: Enter button creates a new line (does NOT send)
        // Sending is handled exclusively by clicking the send button
        return;
      }

      // Desktop: Shift + Enter creates a new line, pure Enter sends
      if (!e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    }
  };

  const handleSend = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText.trim() || isLoading) return;

    const replyingContext = replyingTo ? {
      id: replyingTo.id,
      content: replyingTo.content,
      role: replyingTo.role
    } : undefined;

    const userMessage: Message = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      content: messageText,
      timestamp: new Date(),
      status: 'sending',
      replyTo: replyingContext
    };

    const updatedMessages = [...activeChat.messages, userMessage];
    
    setChats(prev => prev.map(c => 
      c.id === activeChatId 
        ? { ...c, messages: updatedMessages, lastUpdated: new Date() } 
        : c
    ));

    setInput('');
    setReplyingTo(null);
    setIsLoading(true);

    const msgId = userMessage.id;

    // Transition: sending -> sent after 450ms
    setTimeout(() => {
      setChats(prev => prev.map(c => 
        c.id === activeChatId 
          ? { 
              ...c, 
              messages: c.messages.map(m => m.id === msgId && m.status === 'sending' ? { ...m, status: 'sent' as const } : m)
            } 
          : c
      ));
    }, 450);

    // Transition: sent -> delivered after 950ms
    setTimeout(() => {
      setChats(prev => prev.map(c => 
        c.id === activeChatId 
          ? { 
              ...c, 
              messages: c.messages.map(m => m.id === msgId && m.status === 'sent' ? { ...m, status: 'delivered' as const } : m)
            } 
          : c
      ));
    }, 950);

    // Transition: delivered -> seen after 1800ms
    setTimeout(() => {
      setChats(prev => prev.map(c => 
        c.id === activeChatId 
          ? { 
              ...c, 
              messages: c.messages.map(m => m.id === msgId ? { ...m, status: 'seen' as const } : m)
            } 
          : c
      ));
    }, 1800);

    try {
      const history = activeChat.messages.map((m) => ({
        role: m.role,
        parts: [{ text: m.content }],
      }));

      // Retrieve persona-specific memories + global memories for Robin
      const relevantMemories = memories.filter(m => m.persona === mood || m.persona === 'global');

      const previousMsg = activeChat.messages.length > 0 
        ? activeChat.messages[activeChat.messages.length - 1] 
        : undefined;
      const lastMessageTime = previousMsg 
        ? (previousMsg.timestamp instanceof Date ? previousMsg.timestamp.toISOString() : new Date(previousMsg.timestamp).toISOString()) 
        : undefined;
      const clientTime = new Date().toISOString();

      const aiResponse = await geminiService.chat(
        messageText, 
        history, 
        mood, 
        relevantMemories, 
        replyingContext,
        clientTime,
        lastMessageTime,
        activeChat.summary
      );
      
      const modelMessage: Message = {
        id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'model',
        content: aiResponse,
        timestamp: new Date(),
      };

      const finalMessages = activeChat.messages.map(m => m.role === 'user' ? { ...m, status: 'seen' as const } : m).concat(modelMessage);

      setChats(prev => prev.map(c => 
        c.id === activeChatId 
          ? { 
              ...c, 
              messages: finalMessages, 
              lastUpdated: new Date() 
            } 
          : c
      ));

      // Autonomous Agentic Memory Reflection (Background, Non-blocking, Silent)
      geminiService.extractAgenticMemory(messageText, aiResponse, mood).then(async (newMem) => {
        if (newMem) {
          const targetPersona = newMem.isGlobal ? 'global' : mood;
          const saved = await supabaseService.saveMemory({
            persona: targetPersona,
            category: newMem.category,
            content: newMem.content,
            importance: newMem.importance
          });
          setMemories(prev => [saved, ...prev.filter(m => m.id !== saved.id)]);
        }
      }).catch(err => {
        console.warn("Autonomous memory reflection skipped:", err);
      });

      // Rolling Episodic Memory Summary (Non-blocking background update to keep token quota flat)
      if (finalMessages.length >= 6 && finalMessages.length % 4 === 0) {
        geminiService.generateChatSummary(finalMessages).then(newSummary => {
          if (newSummary && newSummary.trim()) {
            setChats(prev => prev.map(c => 
              c.id === activeChatId ? { ...c, summary: newSummary.trim() } : c
            ));
          }
        }).catch(err => {
          console.warn("Episodic summary background notice:", err);
        });
      }

      // Auto-rename chat from Gemini if it currently has a generic/default title
      const isDefaultTitle = activeChat && (
        activeChat.title === 'প্রথম আলাপ' || 
        activeChat.title.startsWith('নতুন আলাপ') || 
        activeChat.title.startsWith('টেম্পোরারি আলাপ')
      );

      if (isDefaultTitle) {
        geminiService.generateChatTitle(messageText, aiResponse).then(newTitle => {
          if (newTitle && newTitle.trim()) {
            setChats(prev => prev.map(c => 
              c.id === activeChatId ? { ...c, title: newTitle.trim() } : c
            ));
          }
        }).catch(err => {
          console.warn("Auto-rename notice:", err);
        });
      }
    } catch (error: any) {
      console.warn('Chat notice:', error);
      const errStr = String(error?.message || error || "");
      let content = 'একটু সমস্যা হয়েছে... আরেকবার একটু বলবে?';
      if (mood === 'normal') {
        content = 'দুঃখিত, সংযোগে সাময়িক ত্রুটি দেখা দিয়েছে। অনুগ্রহ করে আবার একটু চেষ্টা করুন।';
      } else if (mood === 'stranger') {
        content = 'দুঃখিত, ইন্টারনেটে কিছুটা সমস্যা হচ্ছে। কিছুক্ষণ পর আবার মেসেজ দিন।';
      } else if (mood === 'bestie') {
        content = 'ধুরর নেটওয়ার্কটা ঝামেলা করতেছে রে... ১ মিনিট পর আবার মেসেজ দে তো! 😂';
      } else if (mood === 'religious') {
        content = 'দুঃখিত রবিন, সংযোগে কিছুটা বিঘ্ন ঘটেছে। একটু পর আবার মেসেজ দাও ইনশাআল্লাহ।';
      } else if (mood === 'friend') {
        content = 'একটু নেটওয়ার্ক সমস্যা হয়েছে মনে হয়। একটু পর আবার বলো তো?';
      } else {
        content = 'নেটওয়ার্কে একটু সমস্যা হচ্ছে মনে হয়... একটু পর আবার মেসেজ দাও তো প্লিজ? ❤️';
      }
      const errorMessage: Message = {
        id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'model',
        content: content,
        timestamp: new Date(),
      };
      setChats(prev => prev.map(c => 
        c.id === activeChatId 
          ? { 
              ...c, 
              messages: c.messages.map(m => m.role === 'user' ? { ...m, status: 'seen' as const } : m).concat(errorMessage), 
              lastUpdated: new Date() 
            } 
          : c
      ));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
      </AnimatePresence>

      <div 
        style={{ height: viewportHeight ? `${viewportHeight}px` : '100dvh' }}
        className={`flex h-[100dvh] max-h-[100dvh] w-full max-w-4xl mx-auto shadow-2xl overflow-hidden relative font-sans theme-${theme} bg-romantic-pink text-text-main transition-all duration-300`}
      >
      <ThemeBackground theme={theme} />
      
      {/* Sidebar / Chat List */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            key="sidebar-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="absolute inset-0 bg-black/40 z-40 md:hidden"
          />
        )}
        {isSidebarOpen && (
          <motion.aside
            key="sidebar-aside"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            className="absolute md:relative inset-y-0 left-0 w-72 bg-card-bg border-r border-border-custom z-50 flex flex-col shadow-xl"
          >
            <div className="p-4 border-b border-border-custom flex items-center justify-between bg-card-bg/50 backdrop-blur-sm shadow-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-romantic-deep flex items-center gap-2 text-sm md:text-base">
                  <MessageSquare className="w-5 h-5 animate-pulse" /> আলাপসমূহ
                </h2>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMoodMenuOpen(true);
                  }}
                  className="text-[10px] font-bold px-2 py-0.5 bg-romantic-deep/15 text-romantic-deep rounded-full border border-romantic-deep/20 hover:bg-romantic-deep hover:text-white transition-all cursor-pointer flex items-center gap-1 hover:scale-105 active:scale-95"
                  title="মুড পরিবর্তন করুন"
                >
                  <span>
                    {mood === 'romantic' ? '❤️ প্রিয়তমা' : 
                     mood === 'wife' ? '💎 অর্ধাঙ্গিনী' : 
                     mood === 'bestie' ? '😎 বেষ্টি' : 
                     mood === 'friend' ? '😊 বান্ধবী' : 
                     mood === 'stranger' ? '😶 অপরিচিতা' : 
                     mood === 'religious' ? '📖 ধার্মিক' : 
                     mood === 'limitless' ? '🔥 লিমিটলেস' : '✨ স্বাভাবিক'}
                  </span>
                  <span className="text-[8px] opacity-75">▼</span>
                </button>
              </div>
              <button 
                onClick={() => setIsSidebarOpen(false)} 
                className="md:hidden p-1 hover:bg-romantic-pink rounded"
                aria-label="Close sidebar"
              >
                <X className="w-5 h-5 text-text-muted" />
              </button>
            </div>
            
            <div className="p-3 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="text"
                  placeholder="আলাপ খুঁজুন..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-input-bg border border-border-custom rounded-xl py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-romantic-deep/20 outline-none transition-all text-text-main"
                />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={createNewChat}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-romantic-deep text-white rounded-xl hover:bg-romantic-hover transition-colors shadow-md font-medium text-sm"
                >
                  <Plus className="w-4 h-4" /> নতুন আলাপ
                </button>
                <button 
                  onClick={createTemporaryChat}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-romantic-pink border border-romantic-deep/30 text-romantic-deep rounded-xl hover:bg-romantic-pink/80 transition-colors shadow-sm font-medium text-sm"
                >
                  <Clock className="w-4 h-4" /> টেম্পোরারি
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {chats.filter(chat => {
                const isMatchingMood = (chat.mood || 'normal') === mood;
                const isMatchingSearch = chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  chat.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()));
                return isMatchingMood && isMatchingSearch;
              }).map(chat => (
                <div
                  key={chat.id}
                  onClick={() => {
                    setActiveChatId(chat.id);
                    setIsSidebarOpen(false);
                    setMenuOpenChatId(null);
                  }}
                  className={`group p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between relative ${
                    activeChatId === chat.id 
                      ? "bg-romantic-pink border border-border-custom" 
                      : "hover:bg-input-bg"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    {editingChatId === chat.id ? (
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <input
                          autoFocus
                          type="text"
                          value={editingTitle}
                          onChange={e => setEditingTitle(e.target.value)}
                          onBlur={() => renameChat(chat.id)}
                          onKeyPress={e => e.key === 'Enter' && renameChat(chat.id)}
                          className="w-full bg-card-bg border border-border-custom rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-romantic-deep/20 text-text-main"
                        />
                        <button onClick={() => renameChat(chat.id)} className="p-1 text-green-500 hover:bg-green-50 rounded">
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className={`text-sm font-medium truncate flex items-center gap-1.5 ${activeChatId === chat.id ? "text-romantic-deep" : "text-text-main"}`}>
                          {chat.isTemporary && <Clock className="w-3 h-3 opacity-70" />}
                          <span className="truncate">{chat.title}</span>
                          {chat.isTemporary && (
                            <span className="text-[8px] bg-orange-100/70 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded-full ml-auto font-bold flex items-center gap-0.5 shrink-0 shadow-xs">
                              <Clock className="w-2.5 h-2.5" />
                              {getRemainingTimeText(chat.expiresAt)}
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-text-muted mt-0.5">
                          {chat.lastUpdated.toLocaleDateString()}
                        </p>
                      </>
                    )}
                  </div>
                  
                  <div className="relative" onClick={e => e.stopPropagation()}>
                    <button 
                      onClick={() => setMenuOpenChatId(menuOpenChatId === chat.id ? null : chat.id)}
                      className="p-1.5 hover:bg-romantic-pink text-text-muted hover:text-romantic-deep rounded-lg transition-all"
                      aria-label="Chat options"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    
                    <AnimatePresence>
                      {menuOpenChatId === chat.id && (
                        <motion.div
                          key={`menu-${chat.id}`}
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          className="absolute right-0 mt-1 w-32 bg-card-bg border border-border-custom rounded-xl shadow-xl z-[60] py-1 overflow-hidden"
                        >
                          <button
                            onClick={() => {
                              setEditingChatId(chat.id);
                              setEditingTitle(chat.title);
                              setMenuOpenChatId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-main hover:bg-romantic-pink transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" /> রিনেইম
                          </button>
                          <button
                            onClick={() => exportChat(chat)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-main hover:bg-romantic-pink transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" /> এক্সপোর্ট
                          </button>
                          <button
                            onClick={(e) => deleteChat(chat.id, e)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> ডিলিট
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-border-custom bg-romantic-pink/5 space-y-3">
              <div className="flex items-center justify-around bg-input-bg rounded-2xl p-1.5 border border-border-custom shadow-inner">
                {[
                  { id: 'light', icon: Sun, label: 'লাইট' },
                  { id: 'dark', icon: Moon, label: 'ডার্ক' },
                  { id: 'eye-comfort', icon: Eye, label: 'আই' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setDisplayMode(m.id)}
                    className={`flex-1 flex flex-col items-center justify-center py-2 rounded-xl transition-all gap-1 ${
                      displayMode === m.id 
                        ? "bg-romantic-deep text-white shadow-md scale-105" 
                        : "text-text-muted hover:bg-romantic-pink/20 hover:text-romantic-deep"
                    }`}
                    title={m.label}
                  >
                    <m.icon className="w-5 h-5" />
                    <span className="text-[9px] font-bold uppercase tracking-tighter">{m.label}</span>
                  </button>
                ))}
              </div>
              <div className="text-center text-[10px] text-text-muted font-mono tracking-wide opacity-70">
                Tasfi • তোমার প্রিয় সঙ্গিনী
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        {/* Header */}
        {/* Premium Head-turner Header */}
        <header className="shrink-0 bg-gradient-to-r from-card-bg/95 via-card-bg/90 to-card-bg/95 backdrop-blur-lg border-b border-romantic-pink/20 px-4 md:px-6 py-3 md:py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-[0_4px_20px_0_rgba(253,164,186,0.08)]">
          <div 
            className="flex items-center gap-3 md:gap-4 cursor-pointer group"
            onClick={() => setIsProfileModalOpen(true)}
          >
            <div className="relative">
              <div className="absolute -inset-0.5 rounded-full bg-gradient-to-tr from-romantic-hover via-romantic-pink to-romantic-deep opacity-75 group-hover:opacity-100 transition-opacity blur-[1px] animate-pulse"></div>
              <img 
                src={profilePic} 
                alt={nickname} 
                referrerPolicy="no-referrer"
                className="w-11 h-11 md:w-13 md:h-13 rounded-full object-cover relative z-10 border-2 border-white dark:border-slate-800 shadow-md group-hover:scale-102 transition-transform duration-300"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (target.src !== window.location.origin + PROFILE_PIC) {
                    target.src = PROFILE_PIC;
                  }
                }}
              />
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-card-bg rounded-full shadow-sm z-20 flex items-center justify-center">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping opacity-75 absolute"></span>
                <span className="w-1 h-1 bg-white rounded-full"></span>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-extrabold text-text-main text-base md:text-lg flex items-center gap-2 truncate group-hover:text-romantic-deep transition-colors tracking-tight">
                <span className="truncate">{nickname}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMoodMenuOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-romantic-deep text-white text-[9px] md:text-[10px] font-bold rounded-full hover:shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0 border border-white/5 shadow-sm"
                  title="মুড পরিবর্তন করুন"
                >
                  <span>
                    {mood === 'romantic' ? '❤️ প্রিয়তমা' : 
                     mood === 'wife' ? '💎 অর্ধাঙ্গিনী' : 
                     mood === 'bestie' ? '😎 বেষ্টি' : 
                     mood === 'friend' ? '😊 বান্ধবী' : 
                     mood === 'stranger' ? '😶 অপরিচিতা' : 
                     mood === 'religious' ? '📖 ধার্মিক' : 
                     mood === 'limitless' ? '🔥 লিমিটলেস' : '✨ স্বাভাবিক'}
                  </span>
                  <span className="text-[7px] opacity-85">▼</span>
                </button>
              </h1>
              <p className="text-[10px] md:text-xs font-semibold opacity-75 mt-0.5">
                {activeChat.isTemporary ? (
                  <span className="flex items-center gap-1 text-orange-500 font-mono">
                    <Clock className="w-3 h-3 animate-pulse" /> টেম্পোরারি চ্যাট ({getRemainingTimeText(activeChat.expiresAt)} পর মুছে যাবে)
                  </span>
                ) : (
                  <span className="text-romantic-deep font-sans flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-romantic-hover animate-pulse" /> তোমার প্রিয় সঙ্গিনী
                  </span>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsCallActive(true)}
              className="p-2 bg-romantic-pink/35 text-romantic-deep hover:bg-romantic-deep hover:text-white hover:scale-105 active:scale-95 transition-all rounded-full flex items-center justify-center border border-romantic-pink/25 shadow-sm cursor-pointer"
              title="কল করুন"
            >
              <Phone className="w-5 h-5 md:w-5.5 md:h-5.5" strokeWidth={2.4} />
            </button>
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 bg-romantic-pink/35 text-romantic-deep hover:bg-romantic-deep hover:text-white hover:scale-105 active:scale-95 transition-all rounded-full flex items-center justify-center border border-romantic-pink/25 shadow-sm cursor-pointer"
              aria-label="Open sidebar"
              title="আর্কাইভ"
            >
              <Menu className="w-5 h-5 md:w-5.5 md:h-5.5" strokeWidth={2.4} />
            </button>
          </div>
        </header>

        {/* Chat Area */}
        <main 
          ref={chatContainerRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2.5 py-2 sm:px-6 sm:py-3 space-y-1 sm:space-y-1.5 relative scroll-smooth z-10"
        >
          <div className="flex flex-col min-h-full">
            {(() => {
              const lastUserMessageIndex = [...activeChat.messages].reverse().findIndex(m => m.role === 'user');
              const lastUserMessageId = lastUserMessageIndex !== -1 
                ? activeChat.messages[activeChat.messages.length - 1 - lastUserMessageIndex].id 
                : null;
              
              return activeChat.messages.map((msg) => (
                <ChatMessage 
                  key={msg.id} 
                  id={msg.id}
                  role={msg.role} 
                  content={msg.content} 
                  timestamp={msg.timestamp} 
                  reactions={msg.reactions}
                  replyTo={msg.replyTo}
                  subMode={mood}
                  status={msg.id === lastUserMessageId ? msg.status : undefined}
                  profilePic={profilePic}
                  onReact={handleReact}
                  onReply={handleReply}
                  onDelete={handleDeleteMessage}
                  onEdit={handleEditMessage}
                />
              ));
            })()}
            {isLoading && (
              <motion.div 
                key="ai-loading-indicator"
                initial={{ opacity: 0, y: 5 }} 
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start mb-2"
              >
                <div className="bg-card-bg border border-border-custom px-3 py-1.5 rounded-2xl rounded-tl-none shadow-xs flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-romantic-deep rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-romantic-deep rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-1.5 h-1.5 bg-romantic-deep rounded-full animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                  <span className="text-[11px] text-romantic-deep font-medium italic">তাসফি লিখছে...</span>
                </div>
              </motion.div>
            )}
            <div key="messages-end-anchor" ref={messagesEndRef} />
          </div>

          {/* Scroll to bottom button */}
          <AnimatePresence>
            {showScrollButton && (
              <motion.button
                key="scroll-to-bottom"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                onClick={() => scrollToBottom()}
                className="fixed bottom-16 right-4 sm:right-8 p-2 bg-card-bg border border-border-custom rounded-full shadow-lg text-romantic-deep hover:bg-romantic-pink z-20"
              >
                <ArrowDown className="w-4 h-4" />
              </motion.button>
            )}
          </AnimatePresence>
        </main>

        {/* Input Area (Compact Messenger-Style) */}
        <footer className="shrink-0 sticky bottom-0 bg-card-bg/98 backdrop-blur-md border-t border-border-custom/80 z-30 shadow-[0_-3px_10px_rgba(0,0,0,0.03)] relative px-2 py-1.5 sm:px-4 sm:py-2 pb-[max(0.4rem,env(safe-area-inset-bottom))]">
          <AnimatePresence>
            {replyingTo && (
              <motion.div
                key="reply-context-bar"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="mb-1.5 p-2 bg-romantic-pink/35 border-l-3 border-romantic-deep rounded-r-xl flex items-center justify-between shadow-xs"
              >
                <div className="flex-1 truncate mr-2">
                  <p className="text-[9px] font-bold text-romantic-deep uppercase tracking-wider">রিপ্লাই দিচ্ছো {replyToName(replyingTo.role)} কে</p>
                  <p className="text-[11px] text-text-main truncate opacity-90">{replyingTo.content}</p>
                </div>
                <button 
                  onClick={() => setReplyingTo(null)}
                  className="p-1 hover:bg-romantic-deep/10 rounded-full text-text-muted transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex items-center gap-1.5 max-w-full relative">
            <div className="relative shrink-0">
              <button
                onClick={() => setIsPlusMenuOpen(!isPlusMenuOpen)}
                className="w-8 h-8 p-0 flex items-center justify-center bg-romantic-pink hover:bg-romantic-deep text-romantic-deep hover:text-white rounded-full transition-all active:scale-95 shadow-xs"
                title="ফিচার অপশনস"
              >
                <Plus className="w-4.5 h-4.5" />
              </button>
              
              <AnimatePresence>
                {isPlusMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40 cursor-default"
                      onClick={() => setIsPlusMenuOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute bottom-11 left-0 bg-card-bg border border-border-custom rounded-2xl shadow-xl p-2 z-50 min-w-[150px] flex flex-col gap-1 shadow-[0_8px_20px_rgba(0,0,0,0.12)]"
                    >
                      <button 
                        onClick={() => {
                          setIsPlusMenuOpen(false);
                          toggleListening();
                        }}
                        className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-text-main hover:bg-romantic-pink/40 rounded-xl transition-all font-medium text-left w-full"
                      >
                        <Mic className="w-4 h-4 text-romantic-deep" />
                        ভয়েস মেসেজ
                      </button>
                      <button 
                        onClick={() => setIsPlusMenuOpen(false)}
                        className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-text-main hover:bg-romantic-pink/40 rounded-xl transition-all font-medium text-left w-full"
                      >
                        <Paperclip className="w-4 h-4 text-blue-500" />
                        ফাইল আপলোড
                      </button>
                      <button 
                        onClick={() => setIsPlusMenuOpen(false)}
                        className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-text-main hover:bg-romantic-pink/40 rounded-xl transition-all font-medium text-left w-full"
                      >
                        <Heart className="w-4 h-4 text-red-500 fill-current" />
                        উপহার পাঠান
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Input Container: Seamless morph between Text and Gemini In-Bar Sound Wave */}
            <div className="flex-1 min-w-0 bg-input-bg border border-border-custom/40 rounded-[1.3rem] flex items-center relative py-0.5 px-1 shadow-inner focus-within:ring-1.5 focus-within:ring-romantic-deep/20 transition-all">
              {isListening ? (
                <div className="flex-1 flex items-center justify-between px-2 py-0.5 gap-2 min-h-[34px] animate-fade-in">
                  {/* Left: Recording pulse indicator and timer */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                    </span>
                    <span className="text-[11px] font-mono text-red-500 font-bold">
                      {formatCallTime(recordingSeconds)}
                    </span>
                  </div>

                  {/* Center: Gemini/ChatGPT Official Style Dynamic Sound Wave + Live Text */}
                  <div className="flex-1 min-w-0 flex flex-col items-center justify-center overflow-hidden px-1">
                    <div className="flex items-center gap-1 h-5 justify-center">
                      {[4, 8, 14, 18, 12, 16, 20, 15, 10, 16, 12, 6].map((height, idx) => (
                        <span
                          key={idx}
                          className="w-1 bg-gradient-to-t from-romantic-deep to-pink-400 rounded-full animate-audio-bar"
                          style={{
                            height: `${height}px`,
                            animationDelay: `${(idx % 4) * 0.15}s`,
                            animationDuration: `${0.6 + (idx % 3) * 0.2}s`
                          }}
                        />
                      ))}
                    </div>
                    <p className="text-[11px] text-romantic-deep/90 truncate font-medium max-w-full text-center mt-0.5">
                      {liveTranscript ? liveTranscript : "শুনছি... কথা বলুন"}
                    </p>
                  </div>

                  {/* Right Controls: Cancel (X), Done/Check (✓), and Direct Send */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={handleCancelRecording}
                      className="p-1.5 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-full transition-all active:scale-90"
                      title="বাতিল করুন"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={handleDoneRecording}
                      className="p-1.5 bg-romantic-deep text-white rounded-full hover:bg-romantic-hover shadow-xs transition-all active:scale-95 flex items-center justify-center"
                      title="রেকর্ডিং সমাপ্ত ও চ্যাট বক্সে লেখা নিন"
                    >
                      <Check className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={handleSendFromRecording}
                      disabled={!liveTranscript.trim() && !input.trim()}
                      className="w-7 h-7 bg-romantic-deep text-white rounded-full hover:bg-romantic-hover transition-all disabled:opacity-40 disabled:scale-100 active:scale-95 shadow-xs flex items-center justify-center ml-0.5"
                      title="সরাসরি পাঠিয়ে দিন"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={toggleListening}
                    className="p-1.5 rounded-full transition-all active:scale-90 flex items-center justify-center shrink-0 text-text-muted hover:bg-romantic-pink/40 hover:text-romantic-deep"
                    title="ভয়েস দিয়ে টাইপ করুন"
                  >
                    <Mic className="w-4 h-4" />
                  </button>

                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      triggerScrollbarVisibility();
                    }}
                    onFocus={() => {
                      setTimeout(() => {
                        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
                      }, 250);
                    }}
                    onScroll={triggerScrollbarVisibility}
                    onKeyDown={handleKeyDown}
                    placeholder="মেসেজ লিখুন..."
                    className={`flex-1 bg-transparent border-none outline-none py-1 px-2 text-[13.5px] leading-[1.22] text-text-main resize-none max-h-28 min-h-[32px] focus:ring-0 ${
                      showTextareaScrollbar ? 'textarea-scroll-active' : 'textarea-scroll-inactive'
                    }`}
                    style={{ lineHeight: '1.22' }}
                  />

                  <div className="flex items-center justify-center p-0.5 shrink-0">
                    <button
                      onClick={() => {
                        handleSend();
                        setTimeout(() => {
                          if (textareaRef.current) textareaRef.current.focus();
                        }, 50);
                      }}
                      disabled={!input.trim() || isLoading}
                      className="w-8 h-8 bg-romantic-deep text-white rounded-full hover:bg-romantic-hover transition-all disabled:opacity-40 disabled:scale-100 active:scale-95 shadow-sm flex items-center justify-center"
                      aria-label="Send message"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </footer>

        {/* Profile & Settings Modal */}
        <AnimatePresence>
          {isProfileModalOpen && (
            <div key="profile-modal-root" className="fixed inset-0 z-[100] bg-card-bg flex flex-col h-full w-full overflow-y-auto animate-fade-in">
              <div className="max-w-2xl w-full mx-auto flex-1 flex flex-col p-6 sm:p-10 relative">
                {/* Profile Header close button */}
                <button 
                  onClick={() => setIsProfileModalOpen(false)}
                  className="absolute top-6 right-6 p-2.5 bg-romantic-pink hover:bg-romantic-deep text-romantic-deep hover:text-white rounded-full transition-all shadow-md flex items-center justify-center z-10"
                  title="বন্ধ করুন"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Profile Header */}
                <div className="relative p-6 flex flex-col items-center bg-gradient-to-b from-romantic-pink/30 to-transparent rounded-3xl mb-8">
                  <div className="relative group cursor-pointer mb-4" onClick={() => fileInputRef.current?.click()}>
                    <img 
                      src={profilePic} 
                      alt={nickname} 
                      className="w-28 h-28 rounded-full object-cover border-4 border-white dark:border-slate-800 shadow-xl"
                    />
                    <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                      <Edit2 className="text-white w-6 h-6" />
                    </div>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleProfilePicChange} 
                      className="hidden" 
                      accept="image/*"
                    />
                  </div>

                  <div className="flex items-center gap-2 mb-1 group">
                    <input
                      type="text"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      className="text-2xl font-bold text-center bg-transparent border-none outline-none focus:ring-0 text-text-main w-full max-w-[200px]"
                    />
                    <Edit2 className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-xs text-romantic-deep font-medium px-3 py-1 bg-romantic-pink/50 rounded-full">তোমার প্রিয় সঙ্গিনী</p>
                </div>

                {/* Settings Content */}
                <div className="flex-1 space-y-8">
                  {/* Mood Quick Select */}
                  <section>
                    <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4 px-2">বর্তমান মুড</h4>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { id: 'normal', label: 'স্বাভাবিক', icon: Sparkles },
                        { id: 'romantic', label: 'প্রিয়তমা', icon: Heart },
                        { id: 'wife', label: 'অর্ধাঙ্গিনী', icon: Gem },
                        { id: 'bestie', label: 'বেষ্টি', icon: Laugh },
                        { id: 'friend', label: 'বান্ধবী', icon: Users },
                        { id: 'stranger', label: 'অপরিচিতা', icon: HelpCircle },
                        { id: 'religious', label: 'ধার্মিক', icon: BookOpen },
                        { id: 'limitless', label: 'লিমিটলেস', icon: Flame },
                      ].map(m => (
                        <button
                          key={m.id}
                          onClick={() => setMood(m.id)}
                          className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all border-2 ${
                            mood === m.id ? "border-romantic-deep bg-romantic-pink/20 text-romantic-deep shadow-sm font-semibold" : "border-transparent bg-input-bg text-text-muted hover:bg-romantic-pink/10"
                          }`}
                        >
                          <m.icon className={`w-4 h-4 ${mood === m.id && (m.id === 'romantic' || m.id === 'wife' || m.id === 'limitless') ? 'fill-current' : ''}`} />
                          <span className="text-[10px] sm:text-xs font-bold">{m.label}</span>
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* Display Modes */}
                  <section>
                    <div className="flex items-center justify-between mb-4 px-2">
                      <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">ডিসপ্লে মোড</h4>
                    </div>
                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        { id: 'light', label: 'লাইট মোড', icon: Sun },
                        { id: 'dark', label: 'ডার্ক মোড', icon: Moon },
                        { id: 'eye-comfort', label: 'আই কমফোর্ট', icon: Eye },
                      ].map(m => (
                        <button
                          key={m.id}
                          onClick={() => setDisplayMode(m.id)}
                          className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all text-center gap-2 ${
                            displayMode === m.id ? "border-romantic-deep bg-romantic-pink/30 text-romantic-deep font-bold shadow-sm" : "border-border-custom hover:border-romantic-deep/30 bg-input-bg text-text-muted"
                          }`}
                        >
                          <m.icon className="w-5 h-5" />
                          <p className="font-bold text-[11px] sm:text-xs">{m.label}</p>
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* Gemini Multi-API Key Cluster (4 Active Keys) */}
                  <section className="bg-input-bg border border-border-custom rounded-2xl p-4.5 space-y-3.5">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <Key className="w-5 h-5 text-romantic-deep" />
                        <div>
                          <h4 className="text-xs font-black text-text-main uppercase tracking-wider">Gemini এপিআই কি ক্লাস্টার</h4>
                          <p className="text-[10px] text-text-muted">অটো-ব্যালেন্সিং ও ৪-কি ফেইলওভার</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 font-bold border border-green-500/20">
                        {apiKeyPool.getTotalKeysCount()} টি কি সংযুক্ত
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {apiKeyPool.getKeyStatusList().map((item, idx) => {
                        const isCurrent = apiKeyPool.getActiveIndex() === idx;
                        const inCooldown = item.cooldownUntil > Date.now();
                        return (
                          <div
                            key={idx}
                            className={`p-2.5 rounded-xl border transition-all text-xs flex flex-col justify-between gap-1.5 ${
                              isCurrent
                                ? "border-romantic-deep bg-romantic-pink/15 shadow-sm"
                                : "border-border-custom bg-card-bg opacity-85"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[11px] flex items-center gap-1.5 text-text-main">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${inCooldown ? 'bg-amber-500' : isCurrent ? 'bg-green-500 animate-pulse' : 'bg-neutral-400'}`} />
                                কি #{idx + 1}
                              </span>
                              <span className="text-[9px] font-mono font-bold text-text-muted">
                                {isCurrent ? 'এক্টিভ' : inCooldown ? 'কুলডাউন' : 'স্ট্যান্ডবাই'}
                              </span>
                            </div>
                            <div className="font-mono text-[10px] text-text-muted truncate">
                              {item.key.slice(0, 8)}...{item.key.slice(-4)}
                            </div>
                            <div className="text-[9px] text-text-muted flex justify-between pt-1 border-t border-border-custom/50">
                              <span>সফল: {item.successCount}</span>
                              {item.failureCount > 0 ? (
                                <span className="text-amber-500">লিমিট: {item.failureCount}</span>
                              ) : (
                                <span className="text-green-600 dark:text-green-400 font-bold">রেডি</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between pt-1 text-[11px] text-text-muted px-1">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        <span>একটি কি লিমিট হলে অটো অন্যটিতে শিফট হবে।</span>
                      </span>
                      <button
                        onClick={() => {
                          apiKeyPool.rotateToNext(false);
                          setKeyPoolVersion(t => t + 1);
                        }}
                        className="px-2.5 py-1 bg-card-bg hover:bg-romantic-pink/20 text-romantic-deep rounded-lg border border-border-custom text-[10px] font-bold flex items-center gap-1.5 cursor-pointer transition-all shrink-0 ml-2"
                        title="ম্যানুয়ালি পরবর্তী কি-তে সুইচ করুন"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>সুইচ কি</span>
                      </button>
                    </div>
                  </section>

                  {/* Supabase & Agentic Memory Integration */}
                  <section className="bg-input-bg border border-border-custom rounded-2xl p-4.5 space-y-4">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <Database className="w-5 h-5 text-romantic-deep" />
                        <h4 className="text-xs font-black text-text-main uppercase tracking-wider">সুপাবেস ও এজেন্টিক মেমোরি</h4>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-romantic-pink/20 text-romantic-deep font-bold">
                        {supabaseActive ? 'অনলাইন সিঙ্ক' : 'অফলাইন'}
                      </span>
                    </div>

                    <div className="space-y-3.5">
                      <div className="flex items-center gap-2 bg-green-500/10 text-green-600 dark:text-green-400 p-3 rounded-xl text-xs font-semibold border border-green-500/20">
                        <CheckCircle className="w-4 h-4 shrink-0 animate-bounce" />
                        <span>সুপাবেস ডাটাবেজের সাথে সরাসরি কানেক্টেড ({memories.length} টি স্মৃতি সক্রিয়)</span>
                      </div>
                      
                      {tablesNeedSetup && (
                        <div className="flex items-center justify-between gap-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 p-2.5 rounded-xl text-xs font-semibold border border-amber-500/20">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Database className="w-4 h-4 shrink-0 text-amber-500" />
                            <span className="truncate">সুপাবেস টেবিল তৈরি বাকি (SQL কোড রান করুন)</span>
                          </div>
                          <button
                            onClick={() => {
                              setIsProfileModalOpen(false);
                              setIsMemoryModalOpen(true);
                            }}
                            className="px-2 py-0.5 bg-amber-500 text-black rounded text-[10px] font-bold shrink-0 cursor-pointer"
                          >
                            SQL দেখুন
                          </button>
                        </div>
                      )}

                      <div className="text-[11px] text-text-muted leading-relaxed">
                        প্রজেক্ট ইউআরএল: <code className="bg-card-bg px-1.5 py-0.5 rounded font-mono text-romantic-deep">https://qajptvisklbcvhkyvzns.supabase.co</code>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            setIsProfileModalOpen(false);
                            setIsMemoryModalOpen(true);
                          }}
                          className="py-2.5 px-3 bg-purple-600/15 hover:bg-purple-600 text-purple-700 dark:text-purple-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-purple-500/30 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <Brain className="w-4 h-4" />
                          <span>মেমোরি ভল্ট খুলুন</span>
                        </button>

                        <button
                          onClick={async () => {
                            setSyncStatus('syncing');
                            try {
                              const result = await supabaseService.syncAllChats(chats);
                              setSyncStatus('success');
                              setTimeout(() => setSyncStatus('idle'), 3000);
                              const dbChats = await supabaseService.loadChats();
                              if (dbChats && dbChats.length > 0) {
                                setChats(dbChats);
                              }
                            } catch (err) {
                              console.error(err);
                              setSyncStatus('error');
                              setTimeout(() => setSyncStatus('idle'), 3000);
                            }
                          }}
                          disabled={syncStatus === 'syncing'}
                          className="py-2.5 px-3 bg-romantic-deep text-white hover:bg-romantic-hover rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Cloud className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-ping' : ''}`} />
                          <span>{syncStatus === 'syncing' ? 'সিঙ্ক হচ্ছে...' : syncStatus === 'success' ? 'সিঙ্ক সফল!' : 'সব চ্যাট ব্যাকআপ'}</span>
                        </button>
                      </div>

                      <div className="bg-card-bg border border-border-custom rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-bold text-romantic-deep flex items-center gap-1">
                            <Database className="w-3.5 h-3.5" />
                            <span>সুপাবেস SQL সেটআপ স্ক্রিপ্ট</span>
                          </p>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(supabaseService.getSQLSetupSchema());
                              setCopiedSql(true);
                              setTimeout(() => setCopiedSql(false), 2000);
                            }}
                            className="p-1 px-2.5 bg-input-bg hover:bg-romantic-pink/20 text-romantic-deep rounded-md transition-all border border-border-custom flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                          >
                            {copiedSql ? (
                              <>
                                <CheckCircle className="w-3 h-3 text-green-500" />
                                <span>কপি হয়েছে!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>SQL কপি করুন</span>
                              </>
                            )}
                          </button>
                        </div>
                        <p className="text-[10px] text-text-muted leading-relaxed">
                          Supabase ড্যাশবোর্ডের <strong>SQL Editor</strong>-এ গিয়ে স্ক্রিপ্টটি পেস্ট করে <strong>Run</strong> করুন।
                        </p>
                      </div>
                    </div>
                  </section>

                  {/* Reset Settings */}
                  <div className="pt-6 border-t border-border-custom flex flex-col items-center gap-4">
                    <button
                      onClick={() => {
                        setTheme('love');
                        setDisplayMode('light');
                        setMood('normal');
                        setNickname('তাসফি');
                        setProfilePic("/profile.png");
                      }}
                      className="w-full py-3 px-4 bg-input-bg text-text-muted hover:text-romantic-deep hover:bg-romantic-pink/20 rounded-2xl transition-all text-xs font-bold border border-border-custom flex items-center justify-center gap-2"
                    >
                      ডিফল্ট সেটিংস এ ফিরে যান
                    </button>
                    
                    <div className="text-center text-xs text-text-muted mt-2 font-mono tracking-wide opacity-80">
                      © Tasfi by Tasfiwn Labs
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* Floating Quick Mood Selector Dropdown bottom-sheet overlay */}
        <AnimatePresence>
          {isMoodMenuOpen && (
            <>
              <motion.div 
                key="mood-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" 
                onClick={() => setIsMoodMenuOpen(false)} 
              />
              <motion.div
                key="mood-picker-popup"
                initial={{ opacity: 0, scale: 0.95, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 30 }}
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-sm w-[90%] bg-card-bg border border-border-custom rounded-[2rem] shadow-2xl p-6 z-50 flex flex-col gap-4"
              >
                <div className="flex items-center justify-between border-b border-border-custom pb-3">
                  <h3 className="font-bold text-base text-romantic-deep flex items-center gap-2">
                    <Heart className="w-5 h-5 fill-current text-romantic-deep animate-pulse" /> মুড পরিবর্তন করুন
                  </h3>
                  <button 
                    onClick={() => setIsMoodMenuOpen(false)}
                    className="p-1.5 hover:bg-romantic-pink hover:text-romantic-hover rounded-full text-text-muted transition-colors"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  {[
                    { id: 'normal', label: 'স্বাভাবিক', icon: Sparkles, color: 'text-sky-500 bg-sky-50 dark:bg-sky-950/20' },
                    { id: 'romantic', label: 'প্রিয়তমা', icon: Heart, color: 'text-romantic-deep bg-pink-50 dark:bg-pink-950/20' },
                    { id: 'wife', label: 'অর্ধাঙ্গিনী', icon: Gem, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/20' },
                    { id: 'bestie', label: 'বেষ্টি', icon: Laugh, color: 'text-green-500 bg-emerald-50 dark:bg-emerald-950/20' },
                    { id: 'friend', label: 'বান্ধবী', icon: Users, color: 'text-violet-500 bg-violet-50 dark:bg-violet-950/20' },
                    { id: 'stranger', label: 'অপরিচিতা', icon: HelpCircle, color: 'text-zinc-500 bg-zinc-50 dark:bg-zinc-950/20' },
                    { id: 'religious', label: 'ধার্মিক', icon: BookOpen, color: 'text-teal-500 bg-teal-50 dark:bg-teal-950/20' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setMood(m.id);
                        setIsMoodMenuOpen(false);
                      }}
                      className={`flex items-center gap-2.5 p-3 rounded-2xl border transition-all text-left font-bold text-xs ${
                        mood === m.id 
                          ? "border-romantic-deep bg-romantic-pink/35 text-romantic-deep shadow-md scale-[1.03]" 
                          : "border-border-custom/40 bg-input-bg text-text-muted hover:bg-romantic-pink/15 hover:text-romantic-deep"
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg ${m.color}`}>
                        <m.icon className={`w-4 h-4 ${mood === m.id && (m.id === 'romantic' || m.id === 'wife' || m.id === 'limitless') ? 'fill-current' : ''}`} />
                      </div>
                      <span className="truncate">{m.label}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {chatToExport && (
          <ExportModal
            key="export-modal"
            isOpen={isExportModalOpen}
            onClose={() => {
              setIsExportModalOpen(false);
              setChatToExport(null);
            }}
            chat={chatToExport}
            nickname={nickname}
            profilePic={profilePic}
          />
        )}

        {/* Call UI Overlay */}
        <AnimatePresence>
          {isCallActive && !isCallMinimized && (
            <motion.div
              key="calling-screen-overlay"
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
              className="absolute inset-0 z-[1000] bg-black/95 flex flex-col justify-between items-center text-white font-sans overflow-hidden"
            >
              {/* Background splash image visible containing soft overlay */}
              <img 
                src="/splash.jpg?v=1.1" 
                alt="Call Background" 
                className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none z-0"
              />
              <div className="absolute inset-0 bg-black/35 z-0 pointer-events-none" />

              {/* Header inside Call */}
              <div className="w-full p-6 flex items-center justify-between z-10 relative">
                <button 
                  onClick={() => setIsCallMinimized(true)}
                  className="p-2.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-full transition-all flex items-center justify-center border border-white/10 shadow-lg"
                  title="কল মিনিমাইজ করুন"
                >
                  <Minimize2 className="w-4.5 h-4.5" />
                </button>
                <div className="flex items-center gap-2 bg-black/45 px-3 py-1.5 rounded-full border border-white/5 backdrop-blur-md">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] font-mono font-bold tracking-widest text-[#f8d2d2] uppercase">Tasfi Link</span>
                </div>
                <div className="text-[10px] sm:text-xs bg-white/10 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-md font-medium">
                  {callStatus === 'calling' ? 'ডায়াল হচ্ছে...' : 'কল সংযুক্ত'}
                </div>
              </div>

              {/* Profile & Info inside Call */}
              <div className="flex-1 flex flex-col items-center justify-center z-10 relative px-4 text-center w-full">
                <div className="relative mb-6">
                  {callStatus === 'calling' ? (
                    <>
                      <div className="absolute -inset-4 rounded-full bg-romantic-deep/30 animate-pulse" />
                      <div className="absolute -inset-8 rounded-full bg-romantic-deep/15 animate-ping [animation-duration:2.5s]" />
                    </>
                  ) : (
                    <div className="absolute -inset-3 rounded-full bg-green-500/15 animate-pulse" />
                  )}
                  <img 
                    src={profilePic} 
                    alt={nickname} 
                    className={`w-28 h-28 md:w-36 md:h-36 rounded-full border-4 ${callStatus === 'connected' ? 'border-green-400 animate-pulse-subtle' : 'border-romantic-pink'} object-cover border-none relative z-10 shadow-2xl transition-all duration-300`}
                  />
                  <div className="absolute right-0 bottom-1 w-8 h-8 rounded-full bg-romantic-deep text-white flex items-center justify-center border-2 border-white z-20 shadow-md">
                    <Heart className="w-4 h-4 fill-current text-white animate-pulse" />
                  </div>
                </div>

                <h2 className="text-2xl md:text-3xl font-black mt-2 tracking-wide font-sans text-white drop-shadow-md">
                  {nickname}
                </h2>
                <p className="text-xs font-semibold tracking-wider text-white/70 uppercase mt-1 font-sans">
                  {callStatus === 'calling' ? 'তাসফিকে রিং করা হচ্ছে...' : 'তাসফি কথা বলছে'}
                </p>

                {callStatus === 'connected' && (
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="mt-6 flex flex-col items-center gap-2"
                  >
                    <p className="font-mono text-xl font-bold tracking-widest text-[#f8d2d2] bg-black/40 px-4 py-1.5 rounded-full border border-white/5 shadow-inner">
                      {formatCallTime(callSeconds)}
                    </p>
                    
                    {/* Simulated visualizer voice waves */}
                    <div className="flex items-center gap-1.5 h-6 mt-3">
                      {[1, 2, 3, 4, 5, 4, 3, 2, 1].map((x, idx) => (
                        <div 
                          key={idx} 
                          className="w-1 bg-[#f8d2d2] rounded-full animate-audio-bar"
                          style={{ 
                            height: '100%',
                            animationDelay: `${idx * 0.12}s`,
                            animationDuration: `${0.6 + (idx % 3) * 0.2}s`
                          }} 
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Call Control Center */}
              <div className="w-full max-w-xs md:max-w-md mx-auto p-4 sm:p-5 mb-10 bg-black/55 rounded-[2.5rem] border border-white/15 backdrop-blur-lg z-10 flex items-center justify-around shadow-2xl">
                {/* Speaker Toggle */}
                <button 
                  onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                  className={`p-3.5 sm:p-4 rounded-full transition-all active:scale-95 flex items-center justify-center border border-white/10 ${isSpeakerOn ? 'bg-[#f8d2d2] text-romantic-deep shadow-lg scale-105 border-transparent' : 'bg-white/10 text-white hover:bg-white/20'}`}
                  title="স্পিকার"
                >
                  {isSpeakerOn ? <Volume2 className="w-5.5 h-5.5 sm:w-6 h-6" /> : <VolumeX className="w-5.5 h-5.5 sm:w-6 h-6" />}
                </button>

                {/* Microphone Mute */}
                <button 
                  onClick={() => setIsMicMuted(!isMicMuted)}
                  className={`p-3.5 sm:p-4 rounded-full transition-all active:scale-95 flex items-center justify-center border border-white/10 ${isMicMuted ? 'bg-orange-500 text-white shadow-lg scale-105 border-transparent' : 'bg-white/10 text-white hover:bg-white/20'}`}
                  title="মাইক্রোফোন"
                >
                  {isMicMuted ? <MicOff className="w-5.5 h-5.5 sm:w-6 h-6" /> : <Mic className="w-5.5 h-5.5 sm:w-6 h-6" />}
                </button>

                {/* Minimize Toggle in controls */}
                <button 
                  onClick={() => setIsCallMinimized(true)}
                  className="p-3.5 sm:p-4 rounded-full bg-white/10 text-white border border-white/10 hover:bg-white/20 transition-all active:scale-95 flex items-center justify-center"
                  title="কল মিনিমাইজ করুন"
                >
                  <Minimize2 className="w-5.5 h-5.5 sm:w-6 h-6" />
                </button>

                {/* End Call Button */}
                <button 
                  onClick={() => {
                    setIsCallActive(false);
                    setIsCallMinimized(false);
                  }}
                  className="p-3.5 sm:p-4 bg-red-600 hover:bg-red-700 text-white rounded-full transition-all hover:scale-110 active:scale-95 flex items-center justify-center shadow-lg shadow-red-600/30 ring-4 ring-red-600/10"
                  title="কল কেটে দিন"
                >
                  <PhoneOff className="w-5.5 h-5.5 sm:w-6 h-6" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Minimized Draggable Floating Call Bubble */}
        <AnimatePresence>
          {isCallActive && isCallMinimized && (
            <motion.div
              key="minimized-call-bubble"
              initial={{ opacity: 0, scale: 0.6, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.6, y: 50 }}
              drag
              dragMomentum={false}
              dragElastic={0.08}
              className="fixed bottom-24 right-5 z-[500] cursor-grab active:cursor-grabbing select-none"
              title="কল বড় করতে ক্লিক করুন"
            >
              <div className="absolute -inset-1.5 rounded-2xl bg-romantic-deep/20 animate-ping [animation-duration:1.8s] pointer-events-none" />
              
              <div 
                onClick={() => setIsCallMinimized(false)}
                className="relative bg-card-bg/95 backdrop-blur-md border border-romantic-deep/30 rounded-2xl p-2.5 shadow-[0_15px_30px_rgba(0,0,0,0.22)] flex items-center gap-3 w-40 hover:scale-105 active:scale-95 transition-all duration-300"
              >
                <div className="relative flex-shrink-0">
                  <img 
                    src={profilePic} 
                    alt={nickname} 
                    className="w-9 h-9 rounded-full object-cover border border-romantic-deep"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-card-bg animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-text-main truncate">{nickname}</p>
                  <p className="text-[9px] font-mono text-romantic-deep mt-0.5 tracking-wider font-bold">
                    {callStatus === 'calling' ? 'রিং হচ্ছে...' : formatCallTime(callSeconds)}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>



      {/* Memory Vault Modal */}
      <MemoryVaultModal
        isOpen={isMemoryModalOpen}
        onClose={() => setIsMemoryModalOpen(false)}
        memories={memories}
        onAddMemory={handleAddMemory}
        onDeleteMemory={handleDeleteMemory}
        activeMood={mood}
        supabaseActive={supabaseActive}
        onTablesVerified={() => {
          setTablesNeedSetup(false);
          supabaseService.loadMemories().then(m => {
            if (m && m.length > 0) setMemories(m);
          });
          supabaseService.syncAllChats(chats);
        }}
      />
    </div>
    </>
  );
}