import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Markdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Heart, Smile, ThumbsUp, Reply, MoreHorizontal, Volume2, VolumeX, Loader2, Trash2, Edit3, X, Check, Clock, Copy } from 'lucide-react';
import { geminiService } from '../services/geminiService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ChatMessageProps {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
  reactions?: string[];
  expiresAt?: Date;
  replyTo?: {
    id: string;
    content: string;
    role: 'user' | 'model';
  };
  subMode?: string;
  status?: 'sending' | 'sent' | 'delivered' | 'seen';
  profilePic?: string;
  onReact?: (id: string, emoji: string) => void;
  onReply?: (id: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string, newContent: string) => void;
}

const EMOJIS = ['❤️', '😂', '👍', '😮', '🙏'];

const highlightCode = (code: string) => {
  const escapeHtml = (text: string) => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  };

  const tokens: string[] = [];
  const tokenRegex = /([A-Za-z0-9_]+)|(\/\/.*|\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`[\s\S]*?`)|([+\-*/%&=<>!|&^~?:]+)|(\s+)|(.)/g;

  let match;
  while ((match = tokenRegex.exec(code)) !== null) {
    const word = match[1];
    const comment = match[2];
    const str = match[3];
    const op = match[4];
    const ws = match[5];
    const other = match[6];

    const tokenText = match[0];

    if (comment) {
      tokens.push(`<span class="text-neutral-500 italic font-mono">${escapeHtml(tokenText)}</span>`);
    } else if (str) {
      tokens.push(`<span class="text-emerald-400 font-medium font-mono">${escapeHtml(tokenText)}</span>`);
    } else if (word) {
      const keywords = [
        'const', 'let', 'var', 'function', 'return', 'import', 'export', 'from', 'default',
        'class', 'extends', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break',
        'continue', 'new', 'try', 'catch', 'finally', 'throw', 'async', 'await', 'yield',
        'type', 'interface', 'enum', 'public', 'private', 'protected', 'readonly', 'static',
        'get', 'set', 'as', 'of', 'in', 'instanceof', 'typeof', 'void', 'true', 'false',
        'null', 'undefined', 'NaN', 'def', 'elif', 'print', 'import', 'as', 'with', 'lambda',
        'struct', 'union', 'typedef', 'volatile', 'register', 'sizeof', 'signed', 'unsigned'
      ];
      const builtins = [
        'React', 'useState', 'useEffect', 'useRef', 'useMemo', 'useCallback', 'console',
        'window', 'document', 'process', 'global', 'require', 'module', 'exports', 'JSON',
        'Math', 'Date', 'String', 'Number', 'Boolean', 'Array', 'Object', 'Map', 'Set',
        'Promise', 'Error', 'self', 'args', 'kwargs', 'list', 'dict', 'tuple', 'set', 'len'
      ];
      
      if (keywords.includes(word)) {
        tokens.push(`<span class="text-rose-400 font-bold font-mono">${escapeHtml(tokenText)}</span>`);
      } else if (builtins.includes(word)) {
        tokens.push(`<span class="text-violet-400 font-medium font-mono">${escapeHtml(tokenText)}</span>`);
      } else if (/^\d+$/.test(word)) {
        tokens.push(`<span class="text-amber-400 font-bold font-mono">${escapeHtml(tokenText)}</span>`);
      } else {
        // Peek to check for function call
        const nextCharIndex = tokenRegex.lastIndex;
        const nextChar = code.substring(nextCharIndex, nextCharIndex + 10).trim();
        if (nextChar.startsWith('(')) {
          tokens.push(`<span class="text-cyan-400 font-medium font-mono">${escapeHtml(tokenText)}</span>`);
        } else {
          tokens.push(escapeHtml(tokenText));
        }
      }
    } else if (op) {
      tokens.push(`<span class="text-amber-200 opacity-90 font-mono">${escapeHtml(tokenText)}</span>`);
    } else {
      tokens.push(escapeHtml(tokenText));
    }
  }

  return tokens.join('');
};

const CodeBlock: React.FC<{ language: string; value: string }> = ({ language, value }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-2xl overflow-hidden border border-border-custom/40 shadow-sm bg-neutral-900 border-neutral-800 text-neutral-100 font-mono text-xs md:text-sm max-w-full select-text" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between px-4 py-2 bg-neutral-850 border-b border-neutral-800/60 text-neutral-400 font-sans font-bold select-none text-[10px] sm:text-xs">
        <span className="tracking-widest uppercase text-romantic-pink/80">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-xl border border-white/5 active:scale-95"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-400" />
              <span className="text-green-400">কপি হয়েছে!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>কপি করুন</span>
            </>
          )}
        </button>
      </div>
      <div className="p-4 w-full overflow-hidden">
        <pre className="font-mono text-[11px] sm:text-xs md:text-sm leading-normal text-neutral-200 whitespace-pre-wrap break-words overflow-wrap-anywhere scrollbar-none">
          <code dangerouslySetInnerHTML={{ __html: highlightCode(value) }} />
        </pre>
      </div>
    </div>
  );
};
 
// Global voice manager to eliminate sound conflicts and ensure only one message speaks at a time
let activeGlobalAudio: HTMLAudioElement | null = null;
let stopActiveGlobalCallback: (() => void) | null = null;

export const stopAllVoicePlayback = () => {
  if (activeGlobalAudio) {
    try {
      activeGlobalAudio.pause();
      activeGlobalAudio.currentTime = 0;
    } catch {}
    activeGlobalAudio = null;
  }
  if (stopActiveGlobalCallback) {
    try {
      stopActiveGlobalCallback();
    } catch {}
    stopActiveGlobalCallback = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
};

export const ChatMessage: React.FC<ChatMessageProps> = ({ 
  id, 
  role, 
  content, 
  timestamp, 
  reactions = [], 
  expiresAt,
  replyTo,
  subMode = 'normal',
  status,
  profilePic,
  onReact,
  onReply,
  onDelete,
  onEdit
}) => {
  const isUser = role === 'user';
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(content);
  
  const [isCopied, setIsCopied] = useState(false);
  const [showStatusText, setShowStatusText] = useState(false);
  const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tapCountRef = useRef(0);
  const lastTapTimeRef = useRef(0);
  const tripleTapTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setEditValue(content);
  }, [content]);

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
      if (tripleTapTimerRef.current) {
        clearTimeout(tripleTapTimerRef.current);
      }
    };
  }, []);

  const handleToggleStatusText = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isEditing) return;
    setShowStatusText(prev => !prev);
    
    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
    }
    
    statusTimeoutRef.current = setTimeout(() => {
      setShowStatusText(false);
    }, 4500);
  };

  const handleBubbleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEditing) return;

    const now = Date.now();
    const timeDiff = now - lastTapTimeRef.current;
    lastTapTimeRef.current = now;

    if (timeDiff < 450) {
      tapCountRef.current += 1;
    } else {
      tapCountRef.current = 1;
    }

    if (tripleTapTimerRef.current) {
      clearTimeout(tripleTapTimerRef.current);
    }

    // 3 Taps reached -> Trigger message editing!
    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0;
      setEditValue(content);
      setIsEditing(true);
      if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        try { window.navigator.vibrate([40, 30, 60]); } catch {}
      }
      return;
    }

    // Delay single-tap status toggle slightly so 3 rapid taps don't glitch status text
    tripleTapTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0;
      handleToggleStatusText();
    }, 280);
  };
  
  // Swipe to Reply State: Left for user message, Right for model message
  const dragX = useMotionValue(0);
  const replyIconOpacity = useTransform(
    dragX, 
    isUser ? [0, -50] : [0, 50], 
    [0, 1]
  );
  const replyIconScale = useTransform(
    dragX, 
    isUser ? [0, -50] : [0, 50], 
    [0.6, 1.15]
  );
  const replyIconX = useTransform(
    dragX, 
    isUser ? [0, -50] : [0, 50], 
    isUser ? [15, 0] : [-15, 0]
  );

  // TTS State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStartPos = useRef<{ x: number, y: number } | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleToggleVoice = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // If currently playing this message, pause it
    if (isPlaying) {
      stopAllVoicePlayback();
      setIsPlaying(false);
      return;
    }

    // Immediately stop any other voice playing across the entire app (no conflict)
    stopAllVoicePlayback();

    // If audio is already cached for this message, play it immediately
    if (audioRef.current) {
      try {
        activeGlobalAudio = audioRef.current;
        stopActiveGlobalCallback = () => setIsPlaying(false);
        await audioRef.current.play();
        setIsPlaying(true);
        return;
      } catch {
        audioRef.current = null;
      }
    }

    setIsBuffering(true);
    try {
      // Clean stage directions, markdown, and emojis before sending to TTS
      const cleanVoiceText = content
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\(\s*(?:মুচকি\s*হেসে|হেসে|আবেগভরে|মায়াবী\s*কণ্ঠে|লাজুক\s*মুখে|দীর্ঘশ্বাস\s*ফেলে|একটু\s*থেমে|ফিসফিস\s*করে)[^)]*\)/gu, '')
        .replace(/[*_#~>`]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      const audioUrl = await geminiService.generateVoice(cleanVoiceText || content, role, subMode);
      if (audioUrl) {
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.onended = () => {
          setIsPlaying(false);
          if (activeGlobalAudio === audio) {
            activeGlobalAudio = null;
            stopActiveGlobalCallback = null;
          }
        };
        audio.onpause = () => {
          setIsPlaying(false);
        };
        audio.onerror = () => {
          setIsPlaying(false);
          audioRef.current = null;
        };

        activeGlobalAudio = audio;
        stopActiveGlobalCallback = () => setIsPlaying(false);
        await audio.play();
        setIsPlaying(true);
      } else {
        setIsPlaying(false);
      }
    } catch (error) {
      console.warn("Voice playback notice:", error);
      setIsPlaying(false);
    } finally {
      setIsBuffering(false);
    }
  };

  const handleLongPressStart = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e) {
      touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    longPressTimer.current = setTimeout(() => {
      setIsMenuOpen(true);
      if (window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
    }, 500); 
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current) return;
    const dx = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
    const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
    if (dx > 10 || dy > 10) {
      handleLongPressEnd();
    }
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    touchStartPos.current = null;
  };

  const handleSaveEdit = () => {
    if (editValue.trim() && editValue !== content) {
      onEdit?.(id, editValue);
    }
    setIsEditing(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    setIsMenuOpen(false);
  };

  const handleDragEnd = (_: any, info: any) => {
    const triggered = isUser ? info.offset.x < -55 : info.offset.x > 55;
    if (triggered) {
      onReply?.(id);
      if (window.navigator.vibrate) {
        window.navigator.vibrate(30);
      }
    }
    dragX.set(0);
  };

  const scrollToOriginal = (messageId: string) => {
    const element = document.getElementById(`msg-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('highlight-message');
      setTimeout(() => {
        element.classList.remove('highlight-message');
      }, 2000);
    }
  };

  const menuContent = (
    <AnimatePresence>
      {isMenuOpen && (
        <div key="message-menu-container" className="fixed inset-0 z-[99999] flex items-end justify-center sm:p-4">
          <motion.div
            key="message-menu-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMenuOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
          />
          <motion.div
            key="message-menu-content"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            className="relative w-full sm:max-w-sm bg-card-bg rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden border-t border-x sm:border border-border-custom pb-10 sm:pb-0"
          >
            {/* Reactions Bar */}
            <div className="p-6 border-b border-border-custom flex justify-around items-center bg-romantic-pink/5">
              {EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => {
                    onReact?.(id, emoji);
                    setIsMenuOpen(false);
                  }}
                  className="text-3xl hover:scale-125 transition-transform p-2 active:scale-90"
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Actions List */}
            <div className="p-3">
              <button
                onClick={() => {
                  onReply?.(id);
                  setIsMenuOpen(false);
                }}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-romantic-pink/10 rounded-2xl transition-colors text-text-main"
              >
                <Reply className="w-5 h-5 text-blue-500" />
                <span className="font-semibold">রিপ্লাই</span>
              </button>
              
              <button
                onClick={handleCopy}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-romantic-pink/10 rounded-2xl transition-colors text-text-main"
              >
                <Copy className="w-5 h-5 text-indigo-500" />
                <span className="font-semibold">কপি করুন</span>
              </button>

              {isUser && (
                <button
                  onClick={() => {
                    setEditValue(content);
                    setIsEditing(true);
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-romantic-pink/10 rounded-2xl transition-colors text-text-main"
                >
                  <Edit3 className="w-5 h-5 text-emerald-500" />
                  <span className="font-semibold">এডিট করুন</span>
                </button>
              )}

              <button
                onClick={() => {
                  onDelete?.(id);
                  setIsMenuOpen(false);
                }}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-red-50 rounded-2xl transition-colors text-red-500"
              >
                <Trash2 className="w-5 h-5" />
                <span className="font-semibold">ডিলিট</span>
              </button>
            </div>

            <div className="p-5 pt-0">
              <button
                onClick={() => setIsMenuOpen(false)}
                className="w-full py-4 bg-input-bg text-text-muted rounded-2xl font-bold text-sm shadow-inner"
              >
                বাতিল
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <div 
        id={`msg-${id}`}
        className={cn(
          "flex w-full mb-0.5 sm:mb-1 group relative transition-colors duration-200 rounded-2xl",
          isUser ? "justify-end" : "justify-start"
        )}
      >
        {/* Swipe Reply Indicator: Right side for user message (swiping left), Left side for model message (swiping right) */}
        <motion.div 
          style={{ opacity: replyIconOpacity, scale: replyIconScale, x: replyIconX }}
          className={cn(
            "absolute top-1/2 -translate-y-1/2 p-1 text-romantic-deep pointer-events-none z-0",
            isUser ? "right-2" : "left-2"
          )}
        >
          <Reply className={cn("w-4 h-4", isUser && "scale-x-[-1]")} />
        </motion.div>

        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={isUser ? { left: 0.45, right: 0 } : { left: 0, right: 0.45 }}
          onDragEnd={handleDragEnd}
          style={{ x: dragX }}
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ 
            type: "spring", 
            stiffness: 320, 
            damping: 25, 
            mass: 0.8,
            opacity: { duration: 0.15 }
          }}
          onMouseDown={handleLongPressStart}
          onMouseUp={handleLongPressEnd}
          onMouseLeave={handleLongPressEnd}
          onTouchStart={handleLongPressStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleLongPressEnd}
          className={cn(
            "flex flex-col max-w-[88%] md:max-w-[74%] cursor-grab active:cursor-grabbing z-10",
            isUser ? "items-end" : "items-start"
          )}
        >
          {/* Reply Context */}
          {replyTo && (
            <button 
              onClick={() => scrollToOriginal(replyTo.id)}
              className={cn(
                "text-[9.5px] mb-0.5 px-2 py-0.5 bg-black/5 rounded-t-lg border-l-2 border-romantic-deep max-w-full truncate opacity-75 text-left hover:bg-black/10 transition-colors",
                isUser ? "mr-1" : "ml-1"
              )}
            >
              <span className="font-bold">{replyTo.role === 'user' ? 'তুমি' : 'তাসফি'}:</span> {replyTo.content}
            </button>
          )}

          {/* Compact Bubble Container (Zero Fat Padding, No Scrollbars, Triple-Tap to Edit) */}
          <div
            onClick={handleBubbleClick}
            title="৩-বার দ্রুত ট্যাপ করে এডিট করুন"
            className={cn(
              "chat-bubble relative px-2.5 py-1.5 rounded-2xl shadow-xs transition-all duration-150 select-text cursor-pointer overflow-visible [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
              isUser 
                ? "bg-romantic-deep text-white rounded-tr-none shadow-romantic-deep/10" 
                : "bg-card-bg text-text-main rounded-tl-none border border-border-custom shadow-black/5",
              isMenuOpen && "scale-[0.98] opacity-80"
            )}
          >
            {isEditing ? (
              <div className="flex flex-col gap-1.5 min-w-[200px] w-full" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between text-[10px] font-bold opacity-80 mb-0.5">
                  <span className={cn(isUser ? "text-white/90" : "text-romantic-deep")}>
                    {isUser ? '✏️ নিজের মেসেজ এডিট' : '✏️ তাসফির মেসেজ এডিট'}
                  </span>
                  <span className="text-[9px] opacity-60">৩-ট্যাপ এডিটর</span>
                </div>
                <textarea
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className={cn(
                    "w-full rounded-lg p-1.5 text-xs sm:text-[13px] resize-none focus:outline-none leading-tight border transition-colors",
                    isUser 
                      ? "bg-black/20 text-white border-white/20 placeholder-white/60 focus:border-white/40" 
                      : "bg-input-bg text-text-main border-border-custom placeholder-text-muted focus:border-romantic-deep/50"
                  )}
                  rows={Math.min(6, Math.max(2, editValue.split('\n').length))}
                />
                <div className={cn(
                  "flex justify-end gap-1.5 border-t pt-1.5",
                  isUser ? "border-white/20" : "border-border-custom"
                )}>
                  <button 
                    onClick={() => {
                      setEditValue(content);
                      setIsEditing(false);
                    }} 
                    className={cn(
                      "p-1 px-2 rounded-md flex items-center gap-1 text-[10px] font-medium transition-colors",
                      isUser ? "hover:bg-white/10 text-white/80" : "hover:bg-black/5 text-text-muted"
                    )}
                  >
                    <X className="w-3 h-3" /> বাতিল
                  </button>
                  <button 
                    onClick={handleSaveEdit} 
                    className={cn(
                      "p-1 px-2.5 rounded-md flex items-center gap-1 text-[10px] font-bold shadow-xs transition-transform active:scale-95",
                      isUser ? "bg-white/20 hover:bg-white/30 text-white" : "bg-romantic-deep text-white hover:bg-romantic-hover"
                    )}
                  >
                    <Check className="w-3 h-3" /> সেভ করুন
                  </button>
                </div>
              </div>
            ) : (
              <div className="markdown-body text-[13px] sm:text-[13.5px] leading-[1.22] break-words overflow-wrap-anywhere overflow-visible [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden [&>p:not(:first-child)]:mt-0.5 [&>p]:m-0 [&>p]:p-0 [&>p]:leading-[1.22]">
                <Markdown
                  remarkPlugins={[remarkBreaks]}
                  components={{
                    p({ children }) {
                      return <p className="m-0 p-0 leading-[1.22] block">{children}</p>;
                    },
                    code({ className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '');
                      const codeString = String(children).replace(/\n$/, '');
                      const isInline = !match && !codeString.includes('\n');
                      
                      if (isInline) {
                        return (
                          <code 
                            className="px-1 py-0.5 rounded font-mono text-[11px] font-bold bg-romantic-pink/15 text-romantic-deep border border-romantic-pink/15" 
                            {...props}
                          >
                            {children}
                          </code>
                        );
                      }

                      const language = match ? match[1] : 'code';
                      return <CodeBlock language={language} value={codeString} />;
                    }
                  }}
                >
                  {content}
                </Markdown>
              </div>
            )}
            
            {/* Super Compact Info Bar: Tiny Time + Micro Voice Controller Model */}
            <div 
              className={cn(
                "text-[9.5px] mt-0.5 opacity-65 flex items-center justify-between gap-2 select-none",
                isUser ? "text-white/80" : "text-text-muted"
              )}
            >
              <div className="flex items-center gap-1 animate-fade-in">
                <span>{timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                {expiresAt && <Clock className="w-2.5 h-2.5" />}
              </div>
              
              {/* Micro Voice Controller Model (Minimal Padding) */}
              <button 
                type="button"
                onClick={handleToggleVoice}
                disabled={isBuffering}
                title={isPlaying ? "ভয়েস থামান" : "ভয়েস শুনুন"}
                className={cn(
                  "p-0.5 rounded transition-all active:scale-90 flex items-center justify-center shrink-0",
                  isUser ? "hover:bg-white/20 text-white/90" : "hover:bg-romantic-pink/30 text-text-muted hover:text-romantic-deep",
                  isPlaying && "text-romantic-deep"
                )}
              >
                {isBuffering ? (
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                ) : isPlaying ? (
                  <div className="flex items-center gap-0.5 h-2.5 px-0.5">
                    <span className="w-0.5 h-2 bg-romantic-deep rounded-full animate-audio-bar"></span>
                    <span className="w-0.5 h-2.5 bg-romantic-deep rounded-full animate-audio-bar [animation-delay:0.15s]"></span>
                    <span className="w-0.5 h-1.5 bg-romantic-deep rounded-full animate-audio-bar [animation-delay:0.3s]"></span>
                  </div>
                ) : (
                  <Volume2 className="w-3 h-3" />
                )}
              </button>
            </div>

            {/* Reactions Display */}
            {reactions.length > 0 && (
              <div className={cn(
                "absolute -bottom-3 flex flex-wrap gap-1 z-20",
                isUser ? "right-0" : "left-0"
              )}>
                {Array.from(new Set(reactions)).map((emoji) => (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    key={emoji}
                    className="bg-white dark:bg-slate-800 rounded-full px-1.5 py-0.5 text-xs shadow-sm border border-border-custom flex items-center gap-1"
                  >
                    <span>{emoji}</span>
                    <span className="text-[10px] font-bold opacity-70">
                      {reactions.filter(r => r === emoji).length}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Temporary Messenger-style text status */}
          <AnimatePresence>
            {showStatusText && (
              <motion.div
                initial={{ opacity: 0, height: 0, scale: 0.95 }}
                animate={{ opacity: 0.8, height: "auto", scale: 1 }}
                exit={{ opacity: 0, height: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  "text-[10px] select-none text-text-muted font-medium mt-1 flex items-center gap-1 px-1",
                  isUser ? "justify-end text-right" : "justify-start text-left"
                )}
              >
                <span>{timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span>•</span>
                <span>
                  {isUser ? (
                    status === 'sending' ? 'পাঠানো হচ্ছে...' :
                    status === 'sent' ? 'পাঠানো হয়েছে' :
                    status === 'delivered' ? 'ডেলিভারড' :
                    status === 'seen' ? 'দেখেছে' : 'পাঠানো হয়েছে'
                  ) : (
                    'পঠিত'
                  )}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Messenger-style Quick Status Icon Bubble */}
          {isUser && status && (
            <div className="flex justify-end w-full mt-1 pr-1 select-none h-4">
              {status === 'sending' && (
                <div className="w-3.5 h-3.5 rounded-full border border-romantic-deep/40 border-t-transparent animate-spin" title="পাঠানো হচ্ছে..." />
              )}
              {status === 'sent' && (
                <div className="w-3.5 h-3.5 rounded-full border border-romantic-deep/30 flex items-center justify-center bg-transparent" title="পাঠানো হয়েছে">
                  <Check className="w-2.5 h-2.5 text-romantic-deep/60" />
                </div>
              )}
              {status === 'delivered' && (
                <div className="w-3.5 h-3.5 rounded-full bg-romantic-deep/50 flex items-center justify-center shadow-sm" title="ডেলিভারড">
                  <Check className="w-2.5 h-2.5 text-white scale-[0.8]" />
                </div>
              )}
              {status === 'seen' && (
                <img 
                  src={profilePic || "/icon.png"} 
                  alt="seen" 
                  referrerPolicy="no-referrer"
                  className="w-4.5 h-4.5 rounded-full object-cover border border-romantic-pink/30 shadow-sm hover:scale-110 transition-transform duration-250 cursor-pointer" 
                  title="দেখেছে"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/icon.png";
                  }}
                />
              )}
            </div>
          )}
          
          <AnimatePresence>
            {isCopied && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute -top-8 bg-green-500 text-white text-[10px] px-2 py-1 rounded-full font-bold shadow-lg flex items-center gap-1 z-30"
              >
                <Check className="w-2.5 h-2.5" /> কপি হয়েছে
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Messenger-style Bottom Sheet Menu */}
      {createPortal(menuContent, document.body)}
    </>
  );
};
