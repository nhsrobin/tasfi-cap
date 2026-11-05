import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Brain, Plus, Trash2, Sparkles, Database, Check, Copy, CheckCircle, Shield, Heart, Bookmark, Layers, AlertCircle } from 'lucide-react';
import { TasfiMemory, supabaseService } from '../services/supabaseService';

interface MemoryVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  memories: TasfiMemory[];
  onAddMemory: (memory: Omit<TasfiMemory, 'id'>) => Promise<void>;
  onDeleteMemory: (id: string) => Promise<void>;
  activeMood: string;
  supabaseActive: boolean;
  onTablesVerified?: () => void;
}

const PERSONA_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  all: { label: 'সকল স্মৃতি', icon: '🧠', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
  global: { label: 'সার্বজনীন (রবিনের তথ্য)', icon: '🌍', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  wife: { label: 'অর্ধাঙ্গিনী (স্ত্রী)', icon: '💍', color: 'bg-rose-500/10 text-rose-600 border-rose-500/20' },
  romantic: { label: 'প্রিয়তমা (প্রেমিকা)', icon: '❤️', color: 'bg-pink-500/10 text-pink-600 border-pink-500/20' },
  limitless: { label: 'লিমিটলেস (ঘনিষ্ঠ)', icon: '🔥', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  bestie: { label: 'বেষ্টি (বন্ধু)', icon: '😎', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  religious: { label: 'ধার্মিক (হাফেজা)', icon: '📖', color: 'bg-teal-500/10 text-teal-600 border-teal-500/20' },
  friend: { label: 'বান্ধবী', icon: '🌸', color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' },
  stranger: { label: 'অপরিচিতা', icon: '😶', color: 'bg-slate-500/10 text-slate-600 border-slate-500/20' },
  normal: { label: 'স্বাভাবিক', icon: '✨', color: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20' },
};

const CATEGORY_NAMES: Record<string, string> = {
  fact: 'তথ্য / সত্য',
  preference: 'পছন্দ / অপছন্দ',
  emotional_bond: 'আবেগের টান',
  event: 'জীবনের ঘটনা',
  promise: 'অঙ্গীকার / প্রতিজ্ঞা',
  secret: 'গোপনীয় বিষয়',
};

export const MemoryVaultModal: React.FC<MemoryVaultModalProps> = ({
  isOpen,
  onClose,
  memories,
  onAddMemory,
  onDeleteMemory,
  activeMood,
  supabaseActive,
  onTablesVerified,
}) => {
  const [selectedPersonaTab, setSelectedPersonaTab] = useState<string>('all');
  const [isAdding, setIsAdding] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newPersona, setNewPersona] = useState(activeMood || 'wife');
  const [newCategory, setNewCategory] = useState('fact');
  const [newImportance, setNewImportance] = useState(4);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSqlGuide, setShowSqlGuide] = useState(() => supabaseService.areTablesReady() === false);
  const [testResult, setTestResult] = useState<{ checked: boolean; msg: string; success: boolean } | null>(null);

  if (!isOpen) return null;

  const filteredMemories = selectedPersonaTab === 'all'
    ? memories
    : memories.filter(m => m.persona === selectedPersonaTab);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim() || isSaving) return;

    setIsSaving(true);
    try {
      await onAddMemory({
        content: newContent.trim(),
        persona: newPersona,
        category: newCategory,
        importance: newImportance,
      });
      setNewContent('');
      setIsAdding(false);
    } catch (err) {
      console.warn('Notice while adding memory:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestDatabase = async () => {
    setTestResult(null);
    const result = await supabaseService.testConnection();
    const allGood = result.connected && result.tables.chats && result.tables.memories;
    setTestResult({
      checked: true,
      msg: result.message,
      success: allGood,
    });
    if (allGood && onTablesVerified) {
      onTablesVerified();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-card-bg border border-border-custom w-full max-w-2xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden text-text-main"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-border-custom flex items-center justify-between bg-header-bg/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 text-romantic-deep flex items-center justify-center border border-romantic-pink/30 shadow-inner">
                <Brain className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <span>তাসফির মেমোরি ভল্ট</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-romantic-pink/20 text-romantic-deep font-semibold">
                    Agentic Brain
                  </span>
                </h3>
                <p className="text-xs text-text-muted">
                  পারসোনা ভিত্তিক দীর্ঘমেয়াদী স্মৃতি সংরক্ষণাগার • টোকেন অপ্টিমাইজড
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-input-bg rounded-xl text-text-muted hover:text-text-main transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cloud Sync & Action Bar */}
          <div className="px-4 py-2.5 bg-input-bg/70 border-b border-border-custom flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="font-semibold text-text-main">
                {supabaseActive ? 'সুপাবেস ক্লাউড কানেক্টেড' : 'লোকাল মেমোরি মোড'}
              </span>
              <span className="text-text-muted text-[11px]">
                ({memories.length} টি স্মৃতি সংরক্ষিত)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSqlGuide(!showSqlGuide)}
                className="px-2.5 py-1 text-[11px] font-semibold text-romantic-deep hover:bg-romantic-pink/20 rounded-lg transition-colors flex items-center gap-1 cursor-pointer border border-border-custom"
              >
                <Database className="w-3.5 h-3.5" />
                <span>SQL সেটআপ কোড</span>
              </button>

              <button
                onClick={() => setIsAdding(!isAdding)}
                className="px-3 py-1 text-[11px] font-bold bg-romantic-deep text-white hover:bg-romantic-hover rounded-lg transition-colors shadow-sm flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>নতুন স্মৃতি যুক্ত করুন</span>
              </button>
            </div>
          </div>

          {/* SQL Guide Dropdown Banner */}
          {showSqlGuide && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="p-4 bg-purple-950/20 border-b border-border-custom space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-romantic-deep flex items-center gap-1.5">
                    <Database className="w-4 h-4" />
                    <span>সুপাবেস SQL Editor-এ রান করার পূর্ণাঙ্গ স্ক্রিপ্ট</span>
                  </h4>
                  <p className="text-[11px] text-text-muted">
                    এটি আপনার সুপাবেস প্রজেক্টে <code className="text-romantic-deep font-mono">tasfi_memories</code> সহ সব টেবিল ও RLS পলিসি তৈরি করে দেবে:
                  </p>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(supabaseService.getSQLSetupSchema());
                    setCopiedSql(true);
                    setTimeout(() => setCopiedSql(false), 2000);
                  }}
                  className="px-3 py-1.5 bg-romantic-deep text-white rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-romantic-hover cursor-pointer shadow-md shrink-0"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSql ? 'কপি হয়েছে!' : 'SQL কপি করুন'}</span>
                </button>
              </div>

              <div className="relative">
                <pre className="text-[10px] bg-input-bg text-text-main p-3 rounded-xl overflow-x-auto font-mono max-h-36 border border-border-custom select-all leading-normal">
                  {supabaseService.getSQLSetupSchema()}
                </pre>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={handleTestDatabase}
                  className="text-[11px] font-semibold text-romantic-deep hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>কানেকশন ও টেবিল স্ট্যাটাস চেক করুন</span>
                </button>
                {testResult && (
                  <span className={`text-[11px] font-semibold ${testResult.success ? 'text-green-500' : 'text-amber-500'}`}>
                    {testResult.msg}
                  </span>
                )}
              </div>
            </motion.div>
          )}

          {/* Add Memory Form */}
          {isAdding && (
            <motion.form
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              onSubmit={handleCreate}
              className="p-4 bg-input-bg/50 border-b border-border-custom space-y-3"
            >
              <div className="text-xs font-bold text-text-main flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-romantic-deep" />
                <span>নতুন স্থায়ী স্মৃতি লিপিবদ্ধ করুন</span>
              </div>

              <textarea
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                placeholder="যেমন: রবিন লাল গোলাপের চেয়ে বকুল ফুল বেশি ভালোবাসে, অথবা রবিন গভীর রাতে কফি খেয়ে লিখতে বসে..."
                rows={2}
                className="w-full bg-card-bg border border-border-custom rounded-xl p-2.5 text-xs text-text-main focus:outline-none focus:border-romantic-deep focus:ring-1 focus:ring-romantic-deep resize-none"
                autoFocus
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-text-muted block mb-1">পারসোনা (চরিত্র):</label>
                  <select
                    value={newPersona}
                    onChange={e => setNewPersona(e.target.value)}
                    className="w-full bg-card-bg border border-border-custom rounded-lg p-1.5 text-xs text-text-main focus:outline-none"
                  >
                    <option value="global">🌍 সার্বজনীন (রবিনের তথ্য)</option>
                    <option value="wife">💍 অর্ধাঙ্গিনী (স্ত্রী)</option>
                    <option value="romantic">❤️ প্রিয়তমা (প্রেমিকা)</option>
                    <option value="limitless">🔥 লিমিটলেস (ঘনিষ্ঠ)</option>
                    <option value="bestie">😎 বেষ্টি (বন্ধু)</option>
                    <option value="religious">📖 ধার্মিক (হাফেজা)</option>
                    <option value="friend">🌸 বান্ধবী</option>
                    <option value="stranger">😶 অপরিচিতা</option>
                    <option value="normal">✨ স্বাভাবিক</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-text-muted block mb-1">ক্যাটাগরি:</label>
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    className="w-full bg-card-bg border border-border-custom rounded-lg p-1.5 text-xs text-text-main focus:outline-none"
                  >
                    <option value="fact">তথ্য / বৈশিষ্ট্য</option>
                    <option value="preference">পছন্দ / অপছন্দ</option>
                    <option value="emotional_bond">আবেগীয় টান</option>
                    <option value="event">জীবনের ঘটনা</option>
                    <option value="promise">অঙ্গীকার / প্রতিজ্ঞা</option>
                    <option value="secret">গোপনীয় কথা</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-text-muted block mb-1">গুরুত্ব (১-৫):</label>
                  <select
                    value={newImportance}
                    onChange={e => setNewImportance(Number(e.target.value))}
                    className="w-full bg-card-bg border border-border-custom rounded-lg p-1.5 text-xs text-text-main focus:outline-none"
                  >
                    <option value={5}>⭐⭐⭐⭐⭐ (অপরিহার্য চিরন্তন)</option>
                    <option value={4}>⭐⭐⭐⭐ (খুব গুরুত্বপূর্ণ)</option>
                    <option value={3}>⭐⭐⭐ (মাঝারি স্মৃতি)</option>
                    <option value={2}>⭐⭐ (স্বাভাবিক)</option>
                    <option value={1}>⭐ (ছোট বিষয়)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-1.5 text-xs text-text-muted hover:text-text-main rounded-lg cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={!newContent.trim() || isSaving}
                  className="px-4 py-1.5 bg-romantic-deep text-white hover:bg-romantic-hover rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'সংরক্ষণ হচ্ছে...' : 'স্মৃতি সেভ করুন'}
                </button>
              </div>
            </motion.form>
          )}

          {/* Persona Filter Pills */}
          <div className="p-3 border-b border-border-custom overflow-x-auto flex items-center gap-1.5 no-scrollbar bg-card-bg">
            {Object.entries(PERSONA_LABELS).map(([key, config]) => {
              const count = key === 'all' 
                ? memories.length 
                : memories.filter(m => m.persona === key).length;

              const isSelected = selectedPersonaTab === key;

              return (
                <button
                  key={key}
                  onClick={() => setSelectedPersonaTab(key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-romantic-deep text-white shadow-sm font-bold scale-[1.02]'
                      : 'bg-input-bg text-text-muted hover:text-text-main hover:bg-romantic-pink/15'
                  }`}
                >
                  <span>{config.icon}</span>
                  <span>{config.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-white/25 text-white' : 'bg-card-bg text-text-muted'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Memory Cards List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {filteredMemories.length === 0 ? (
              <div className="text-center py-12 px-4 space-y-3">
                <div className="w-14 h-14 mx-auto rounded-full bg-input-bg flex items-center justify-center text-text-muted">
                  <Brain className="w-7 h-7 stroke-1" />
                </div>
                <h4 className="text-sm font-bold text-text-main">
                  এই পারসোনার জন্য এখনো কোনো স্মৃতি লিপিবদ্ধ নেই
                </h4>
                <p className="text-xs text-text-muted max-w-sm mx-auto">
                  আপনি যখন তাসফির সাথে কথা বলবেন, তাসফি স্বয়ংক্রিয়ভাবে গুরুত্বপূর্ণ মুহূর্তগুলো মনে রাখবে। অথবা উপরের <strong>'নতুন স্মৃতি যুক্ত করুন'</strong> বাটনে ক্লিক করে নিজেই স্মৃতি যোগ করতে পারেন।
                </p>
              </div>
            ) : (
              filteredMemories.map((mem) => {
                const personaConfig = PERSONA_LABELS[mem.persona] || PERSONA_LABELS.wife;
                const catName = CATEGORY_NAMES[mem.category] || mem.category;

                return (
                  <motion.div
                    key={mem.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="p-3.5 bg-input-bg/70 hover:bg-input-bg border border-border-custom rounded-2xl transition-all shadow-sm group space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[11px] px-2 py-0.5 rounded-md font-bold border ${personaConfig.color} flex items-center gap-1`}>
                          <span>{personaConfig.icon}</span>
                          <span>{personaConfig.label}</span>
                        </span>

                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-card-bg text-text-muted border border-border-custom font-medium">
                          {catName}
                        </span>

                        <span className="text-[10px] text-amber-500 font-mono font-bold tracking-tighter">
                          {'★'.repeat(mem.importance || 3)}
                        </span>
                      </div>

                      <button
                        onClick={() => onDeleteMemory(mem.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                        title="স্মৃতি মুছুন"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-xs sm:text-sm text-text-main font-medium leading-relaxed">
                      {mem.content}
                    </p>

                    <div className="text-[10px] text-text-muted flex items-center justify-between pt-1">
                      <span>আইডি: <code className="font-mono">{mem.id.slice(0, 14)}</code></span>
                      {mem.created_at && (
                        <span>{new Date(mem.created_at).toLocaleDateString('bn-BD')}</span>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Footer Info */}
          <div className="p-3 bg-header-bg/60 border-t border-border-custom text-[11px] text-text-muted flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-romantic-deep" />
              <span>প্রতিটি চ্যাটে এই স্মৃতিগুলো স্বয়ংক্রিয়ভাবে ইনপুট হিসেবে যাবে।</span>
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-card-bg hover:bg-input-bg border border-border-custom text-text-main rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              বন্ধ করুন
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
