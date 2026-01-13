import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../AuthContext';
import { supabaseService, getSupabase } from '../services/supabaseService';
import { aiService } from '../services/aiService';
import { ChatMessage, Reaction, UserRole } from '../types';
import { 
  Send, Mic, Image as ImageIcon, Paperclip, X, 
  Smile, Play, Pause, File as FileIcon, Trash2,
  Plus, ShieldAlert, ShieldCheck, Maximize2,
  Bell, BellOff, Sparkles, Bot, Bug, Reply,
  ChevronDown, Copy, MoreVertical, ArrowDown, Eraser
} from 'lucide-react';
import { ZAY_USER_ID } from '../constants';

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🔥', '🎉'];
const AI_PREFIX = ":::AI_RESPONSE:::";

const formatDateLabel = (dateStr: string) => {
  const date = new Date(dateStr);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Today';
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};

const renderContentWithMentions = (text: string) => {
  const parts = text.split(/(@\S+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@') && part.length > 1) {
      return <span key={i} className="font-bold text-indigo-600 bg-indigo-50 px-1 rounded">{part}</span>;
    }
    return part;
  });
};

const ChatRoom: React.FC = () => {
  const { user, t, onlineUserIds, lang, isDev, isAdmin } = useAuth();
  
  // Data State
  const [userCache, setUserCache] = useState<any[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  // Input State
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messagesEndRef] = [useRef<HTMLDivElement>(null)];

  // Load user cache from local storage for quick lookup
  useEffect(() => {
    try {
      const state = JSON.parse(localStorage.getItem('1bacsm2_state') || '{}');
      if (state.users) setUserCache(state.users);
    } catch (e) {}
  }, []);

  useEffect(() => {
    const loadMessages = async () => {
      try {
        const msgs = await supabaseService.fetchMessages(100);
        setMessages(msgs);
      } catch (e) {}
    };
    loadMessages();

    const supabase = getSupabase();
    const channel = supabase.channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const newMsg = payload.new as any;
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          const formatted: ChatMessage = {
            id: newMsg.id,
            userId: newMsg.user_id,
            content: newMsg.content,
            type: newMsg.type,
            mediaUrl: newMsg.media_url,
            fileName: newMsg.file_name,
            createdAt: newMsg.created_at,
            reactions: newMsg.reactions || [],
            readBy: newMsg.read_by || []
          };
          return [...prev, formatted];
        });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, payload => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(scrollToBottom, [messages.length]);

  const getUserInfo = (userId: string, content: string) => {
    // If message starts with AI Prefix, treat as Zay
    if (content.startsWith(AI_PREFIX)) {
        return { name: 'Zay', role: 'ASSISTANT', isBot: true };
    }
    // Legacy support
    if (userId === ZAY_USER_ID) return { name: 'Zay', role: 'ASSISTANT', isBot: true };
    
    const u = userCache.find((u: any) => u.id === userId);
    return u || { name: 'Student', role: 'STUDENT' };
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !user) return;
    setIsSending(true);
    const content = inputText;
    setInputText('');
    
    try {
      await supabaseService.sendMessage({ userId: user.id, content });
      if (content.toLowerCase().includes('@zay')) {
        const aiResponse = await aiService.askZay(content, user);
        // Proxy pattern: Send as current user but mark with prefix so everyone sees it as bot
        await supabaseService.sendMessage({ 
            userId: user.id, 
            content: AI_PREFIX + aiResponse.text,
            type: aiResponse.type,
            mediaUrl: aiResponse.mediaUrl 
        });
      }
    } catch (e) { alert("Failed to send"); }
    setIsSending(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete message?")) {
        try { await supabaseService.deleteMessage(id); } catch(e) { alert("Delete failed"); }
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f0f2f5] relative">
      {/* Header */}
      <div className="px-4 py-3 bg-white/90 backdrop-blur-xl border-b border-slate-200 flex justify-between items-center sticky top-0 z-20 shadow-sm">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight">{t('chat')}</h2>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{onlineUserIds.size} Online</p>
          </div>
        </div>
        {isAdmin && (
             <button onClick={async () => { if(confirm("Clear ALL chat?")) await supabaseService.clearChat(); }} className="p-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all" title="Clear Chat">
                  <Trash2 size={18} />
             </button>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f0f2f5]">
        {messages.map((msg, idx) => {
          const isProxyAI = msg.content.startsWith(AI_PREFIX);
          const cleanContent = isProxyAI ? msg.content.replace(AI_PREFIX, '') : msg.content;
          const userInfo = getUserInfo(msg.userId, msg.content);
          
          // It is ME if: ID matches AND it's NOT a Proxy AI message.
          const isMe = user && msg.userId === user.id && !isProxyAI;
          const isBot = userInfo.isBot;
          const canDelete = (user && msg.userId === user.id) || isAdmin;

          // Grouping logic
          const prevMsg = messages[idx - 1];
          const isSequence = prevMsg && prevMsg.userId === msg.userId && !isProxyAI && !(prevMsg.content.startsWith(AI_PREFIX));

          return (
            <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''} ${isSequence ? 'mt-1' : 'mt-4'} animate-in slide-in-from-bottom-2`}>
               {/* Avatar */}
               <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-black text-white shadow-sm transition-all ${!isSequence ? (isMe ? 'bg-indigo-600' : isBot ? 'bg-violet-600' : 'bg-slate-400') : 'opacity-0'}`}>
                  {!isSequence && (isBot ? <Bot size={16} /> : userInfo.name.charAt(0))}
               </div>

               {/* Bubble */}
               <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%]`}>
                  {!isSequence && !isMe && <span className="text-[10px] font-bold text-slate-500 ml-1 mb-1">{userInfo.name}</span>}
                  
                  <div className={`relative px-4 py-2.5 shadow-sm text-sm font-medium
                    ${isMe 
                      ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm' 
                      : isBot 
                        ? 'bg-white text-slate-800 border border-violet-100 rounded-2xl rounded-tl-sm'
                        : 'bg-white text-slate-800 rounded-2xl rounded-tl-sm'
                    }
                  `}>
                    <p className="whitespace-pre-wrap break-words">{renderContentWithMentions(cleanContent)}</p>
                    
                    {msg.mediaUrl && (
                        <div className="mt-2">
                            {msg.type === 'image' ? (
                                <img src={msg.mediaUrl} className="rounded-lg max-h-60 object-cover" alt="attachment" />
                            ) : (
                                <a href={msg.mediaUrl} target="_blank" className="flex items-center gap-2 bg-black/10 p-2 rounded-lg text-xs underline">
                                    <FileIcon size={14}/> Open Attachment
                                </a>
                            )}
                        </div>
                    )}
                    
                    {/* Time & Delete */}
                    <div className="flex items-center justify-end gap-2 mt-1 opacity-70">
                        <span className="text-[9px] font-bold uppercase">{new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        {canDelete && <button onClick={() => handleDelete(msg.id)}><Trash2 size={10} /></button>}
                    </div>
                  </div>
               </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-white border-t border-slate-100 relative z-30 pb-safe">
         <div className="flex items-end gap-2">
            <input 
                className="flex-1 bg-slate-100 border-transparent focus:bg-white focus:border-indigo-200 border rounded-2xl px-4 py-3 outline-none text-sm font-medium transition-all"
                placeholder={t('chat_placeholder')}
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
            />
            <button onClick={handleSendMessage} disabled={isSending} className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50">
                <Send size={18} className={lang === 'ar' ? 'rtl-flip' : ''} />
            </button>
         </div>
      </div>
    </div>
  );
};

export default ChatRoom;
