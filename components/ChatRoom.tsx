
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
  ChevronDown, Copy, MoreVertical, ArrowDown, Eraser, AlertTriangle
} from 'lucide-react';
import { ZAY_USER_ID } from '../constants';

const AI_PREFIX = ":::AI_RESPONSE:::";

const formatMessageContent = (text: string) => {
  return text.split('\n').map((line, lineIdx) => (
    <div key={lineIdx} className="min-h-[1.2em]">
      {line.split(/(\*\*.*?\*\*|\[.*?\]\(.*?\)|@\S+|https?:\/\/\S+)/g).map((part, partIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={partIdx} className="font-black text-slate-900">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('@')) {
          return <span key={partIdx} className="font-bold text-indigo-600 bg-indigo-50 px-1 rounded mx-0.5 text-[10px]">{part}</span>;
        }
        if (part.match(/^\[.*?\]\(.*?\)$/)) {
            const match = part.match(/^\[(.*?)\]\((.*?)\)$/);
            if (match) {
                return <a key={partIdx} href={match[2]} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline font-bold hover:text-indigo-800 break-all">{match[1]}</a>;
            }
        }
        if (part.match(/^https?:\/\//)) {
             return <a key={partIdx} href={part} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline truncate block">{part}</a>;
        }
        return <span key={partIdx}>{part}</span>;
      })}
    </div>
  ));
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
    if (content.startsWith(AI_PREFIX)) {
        return { name: 'Zay', role: 'ASSISTANT', isBot: true };
    }
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

  const handleReport = async (msg: ChatMessage) => {
    if (!user) return;
    const confirmed = confirm("Report this message as a bug/issue?");
    if (confirmed) {
        const reportContent = `[REPORTED by ${user.name}] Content: ${msg.content}`;
        await supabaseService.createAiLog(user.id, reportContent);
        alert("Report submitted.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f2f6ff] relative overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 bg-white/80 backdrop-blur-md border-b border-white/50 flex justify-between items-center z-20 shadow-sm shrink-0">
        <div>
          <h2 className="text-sm font-black text-slate-900 tracking-tight">{t('chat')}</h2>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{onlineUserIds.size} Online</p>
          </div>
        </div>
        {isAdmin && (
             <button onClick={async () => { if(confirm("Clear ALL chat?")) await supabaseService.clearChat(); }} className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all">
                  <Trash2 size={14} />
             </button>
        )}
      </div>

      {/* Messages Area - Smaller text, fitting size */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-[#f2f6ff]">
        {messages.map((msg, idx) => {
          const isProxyAI = msg.content.startsWith(AI_PREFIX);
          const cleanContent = isProxyAI ? msg.content.replace(AI_PREFIX, '') : msg.content;
          const userInfo = getUserInfo(msg.userId, msg.content);
          
          const isMe = user && msg.userId === user.id && !isProxyAI;
          const isBot = userInfo.isBot;
          const canDelete = (user && msg.userId === user.id) || isAdmin;

          const prevMsg = messages[idx - 1];
          const isSequence = prevMsg && prevMsg.userId === msg.userId && !isProxyAI && !(prevMsg.content.startsWith(AI_PREFIX));

          return (
            <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''} ${isSequence ? 'mt-0.5' : 'mt-3'} animate-in slide-in-from-bottom-2 group`}>
               {/* Avatar */}
               <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-black text-white shadow-sm transition-all ${!isSequence ? (isMe ? 'bg-indigo-600' : isBot ? 'bg-violet-600' : 'bg-slate-400') : 'opacity-0'}`}>
                  {!isSequence && (isBot ? <Bot size={14} /> : userInfo.name.charAt(0))}
               </div>

               {/* Bubble */}
               <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%]`}>
                  {!isSequence && !isMe && <span className="text-[9px] font-bold text-slate-400 ml-1 mb-0.5">{userInfo.name}</span>}
                  
                  <div className={`relative px-3 py-2 shadow-sm text-[13px] font-medium leading-relaxed
                    ${isMe 
                      ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm' 
                      : isBot 
                        ? 'bg-white text-slate-800 border border-violet-100 rounded-2xl rounded-tl-sm'
                        : 'bg-white text-slate-800 rounded-2xl rounded-tl-sm'
                    }
                  `}>
                    <div className="whitespace-pre-wrap break-words">
                        {formatMessageContent(cleanContent)}
                    </div>
                    
                    {msg.mediaUrl && (
                        <div className="mt-2">
                            {msg.type === 'image' ? (
                                <img src={msg.mediaUrl} className="rounded-lg max-h-48 object-cover" alt="attachment" />
                            ) : (
                                <a href={msg.mediaUrl} target="_blank" className="flex items-center gap-2 bg-black/10 p-2 rounded-lg text-[10px] underline">
                                    <FileIcon size={12}/> Attachment
                                </a>
                            )}
                        </div>
                    )}
                    
                    {/* Time & Actions */}
                    <div className="flex items-center justify-end gap-2 mt-0.5 opacity-60">
                        <span className="text-[8px] font-bold uppercase">{new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleReport(msg)} title="Report" className="hover:text-amber-400"><AlertTriangle size={10} /></button>
                            {canDelete && <button onClick={() => handleDelete(msg.id)}><Trash2 size={10} /></button>}
                        </div>
                    </div>
                  </div>
               </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-2 bg-white border-t border-slate-100 relative z-30 pb-safe shrink-0">
         <div className="flex items-end gap-2">
            <input 
                className="flex-1 bg-slate-50 border-transparent focus:bg-white focus:border-indigo-200 border rounded-2xl px-4 py-2.5 outline-none text-sm font-medium transition-all"
                placeholder={t('chat_placeholder')}
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
            />
            <button onClick={handleSendMessage} disabled={isSending} className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50">
                <Send size={16} className={lang === 'ar' ? 'rtl-flip' : ''} />
            </button>
         </div>
      </div>
    </div>
  );
};

export default ChatRoom;
