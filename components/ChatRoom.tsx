
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
  ChevronDown, Copy, MoreVertical, ArrowDown, Eraser, AlertTriangle,
  Download, ExternalLink
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
  const [userCache, setUserCache] = useState<any[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
    if (scrollContainerRef.current) {
      const { scrollHeight, clientHeight } = scrollContainerRef.current;
      scrollContainerRef.current.scrollTop = scrollHeight - clientHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const getUserInfo = (userId: string, content: string) => {
    if (content.startsWith(AI_PREFIX)) return { name: 'Zay', role: 'ASSISTANT', isBot: true };
    if (userId === ZAY_USER_ID) return { name: 'Zay', role: 'ASSISTANT', isBot: true };
    const u = userCache.find((u: any) => u.id === userId);
    return u || { name: 'Student', role: 'STUDENT' };
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !user) return;
    setIsSending(true);
    const content = inputText;
    setInputText('');
    scrollToBottom();
    
    try {
      await supabaseService.sendMessage({ userId: user.id, content });
      if (content.toLowerCase().includes('@zay')) {
        const aiRes = await aiService.askZay(content, user);
        // AI responses with multiple files are packaged as JSON in mediaUrl for ChatRoom to render
        await supabaseService.sendMessage({ 
            userId: user.id, 
            content: AI_PREFIX + aiRes.text,
            type: aiRes.resources && aiRes.resources.length > 0 ? 'file' : 'text',
            mediaUrl: aiRes.resources && aiRes.resources.length > 0 ? JSON.stringify(aiRes.resources) : undefined
        });
      }
    } catch (e) { alert("Failed to send"); }
    setIsSending(false);
  };

  const handleDownload = (url: string, name: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAll = (resources: any[]) => {
    resources.forEach((res, i) => {
      setTimeout(() => handleDownload(res.url, res.name), i * 300);
    });
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
      <div className="px-4 py-2 bg-white/80 backdrop-blur-md border-b border-white/50 flex justify-between items-center z-20 shadow-sm shrink-0 h-12">
        <div>
          <h2 className="text-xs font-black text-slate-900 tracking-tight">{t('chat')}</h2>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{onlineUserIds.size} Online</p>
          </div>
        </div>
        {isAdmin && (
             <button onClick={async () => { if(confirm("Clear ALL chat?")) await supabaseService.clearChat(); }} className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all">
                  <Trash2 size={12} />
             </button>
        )}
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-[#f2f6ff] scroll-smooth">
        {messages.map((msg, idx) => {
          const isProxyAI = msg.content.startsWith(AI_PREFIX);
          const cleanContent = isProxyAI ? msg.content.replace(AI_PREFIX, '') : msg.content;
          const userInfo = getUserInfo(msg.userId, msg.content);
          const isMe = user && msg.userId === user.id && !isProxyAI;
          const isBot = userInfo.isBot;
          const canDelete = (user && msg.userId === user.id) || isAdmin;
          const prevMsg = messages[idx - 1];
          const isSequence = prevMsg && prevMsg.userId === msg.userId && !isProxyAI && !(prevMsg.content.startsWith(AI_PREFIX));

          // Multi-resource handling from AI
          let resources: any[] = [];
          if (isProxyAI && msg.mediaUrl) {
            try { resources = JSON.parse(msg.mediaUrl); } catch(e) {}
          }

          return (
            <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''} ${isSequence ? 'mt-0.5' : 'mt-2'} animate-in slide-in-from-bottom-1 group`}>
               <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[8px] font-black text-white shadow-sm transition-all ${!isSequence ? (isMe ? 'bg-indigo-600' : isBot ? 'bg-violet-600' : 'bg-slate-400') : 'opacity-0'}`}>
                  {!isSequence && (isBot ? <Bot size={12} /> : userInfo.name.charAt(0))}
               </div>

               <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%]`}>
                  {!isSequence && !isMe && <span className="text-[8px] font-bold text-slate-400 ml-1 mb-0.5">{userInfo.name}</span>}
                  <div className={`relative px-3 py-1.5 shadow-sm text-[11px] font-medium leading-relaxed
                    ${isMe ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm' : isBot ? 'bg-white text-slate-800 border border-violet-100 rounded-2xl rounded-tl-sm' : 'bg-white text-slate-800 rounded-2xl rounded-tl-sm'}`}>
                    <div className="whitespace-pre-wrap break-words">{formatMessageContent(cleanContent)}</div>
                    
                    {/* Media Display */}
                    {resources.length > 0 && (
                        <div className="mt-3 space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                                {resources.filter(r => r.type === 'image').map((img, i) => (
                                    <div key={i} className="relative rounded-lg overflow-hidden border border-slate-100 group/img">
                                        <img src={img.url} className="w-full aspect-square object-cover" alt={img.name} />
                                        <button onClick={() => handleDownload(img.url, img.name)} className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                            <Download className="text-white" size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="space-y-1.5">
                                {resources.filter(r => r.type !== 'image').map((file, i) => (
                                    <div key={i} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded-xl">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <FileIcon size={12} className="text-slate-400 shrink-0" />
                                            <span className="text-[9px] font-bold truncate text-slate-600">{file.name}</span>
                                        </div>
                                        <button onClick={() => handleDownload(file.url, file.name)} className="p-1 hover:text-indigo-600 transition-colors">
                                            <Download size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            {resources.length > 1 && (
                                <button onClick={() => handleDownloadAll(resources)} className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-[9px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-2">
                                    <Download size={12} /> Download All ({resources.length})
                                </button>
                            )}
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-2 mt-0.5 opacity-60">
                        <span className="text-[7px] font-bold uppercase">{new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleReport(msg)} title="Report" className="hover:text-amber-400"><AlertTriangle size={8} /></button>
                            {canDelete && <button onClick={() => handleDelete(msg.id)}><Trash2 size={8} /></button>}
                        </div>
                    </div>
                  </div>
               </div>
            </div>
          );
        })}
      </div>

      <div className="p-2 bg-white border-t border-slate-100 relative z-30 pb-safe shrink-0">
         <div className="flex items-end gap-2">
            <input 
                className="flex-1 bg-slate-50 border-transparent focus:bg-white focus:border-indigo-200 border rounded-2xl px-4 py-2 outline-none text-xs font-medium transition-all h-10"
                placeholder={t('chat_placeholder')}
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
            />
            <button onClick={handleSendMessage} disabled={isSending} className="w-10 h-10 flex items-center justify-center bg-indigo-600 text-white rounded-xl shadow-md hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50">
                <Send size={14} className={lang === 'ar' ? 'rtl-flip' : ''} />
            </button>
         </div>
      </div>
    </div>
  );
};

export default ChatRoom;
