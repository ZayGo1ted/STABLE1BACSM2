
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../AuthContext';
import { supabaseService, getSupabase } from '../services/supabaseService';
import { aiService } from '../services/aiService';
import { ChatMessage, Reaction, UserRole } from '../types';
import { 
  Send, Mic, Image as ImageIcon, Paperclip, X, 
  Smile, Play, Pause, File as FileIcon, Trash2,
  Plus, ShieldAlert, ShieldCheck, Maximize2,
  Bot, AlertTriangle, Download, Loader2,
  ChevronRight, CornerUpLeft, Terminal, Globe, ExternalLink
} from 'lucide-react';
import { ZAY_USER_ID } from '../constants';

const AI_PREFIX = ":::AI_RESPONSE:::";

const formatMessageContent = (text: string) => {
  const codeBlockRegex = /```([\s\S]*?)```/g;
  const parts = text.split(codeBlockRegex);
  
  return parts.map((part, idx) => {
    if (idx % 2 === 1) {
      return (
        <div key={idx} className="my-3 bg-slate-900 rounded-2xl p-4 font-mono text-[11px] text-indigo-300 overflow-x-auto shadow-xl border border-white/5 relative group">
          <div className="flex items-center gap-2 mb-2 opacity-50 text-[9px] uppercase font-black tracking-[0.2em] text-white">
            <Terminal size={12} /> Code / LaTeX
          </div>
          <pre className="whitespace-pre-wrap leading-relaxed">{part.trim()}</pre>
        </div>
      );
    }

    const complexSplitRegex = /(\*\*.*?\*\*|`.*?`|https?:\/\/\S+|[Δ∑∫√αβγθλμπφψΩωσερτξζ→←↔∀∃∈∉⊂⊃⊆⊇∩∪∞≈≠≤≥±×÷°])/g;
    
    return (
      <div key={idx} className="whitespace-pre-wrap leading-relaxed">
        {part.split(complexSplitRegex).map((subPart, subIdx) => {
          if (subPart.startsWith('**') && subPart.endsWith('**')) {
            return <strong key={subIdx} className="font-black text-slate-950 px-0.5 rounded bg-black/5">{subPart.slice(2, -2)}</strong>;
          }
          if (subPart.startsWith('`') && subPart.endsWith('`')) {
            return <code key={subIdx} className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-lg font-mono text-[11px] font-bold mx-0.5 border border-indigo-100">{subPart.slice(1, -1)}</code>;
          }
          if (subPart.match(/^https?:\/\//)) {
            return <a key={subIdx} href={subPart} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline font-black break-all hover:text-indigo-800">{subPart}</a>;
          }
          if (subPart.length === 1 && /[Δ∑∫√αβγθλμπφψΩωσερτξζ→←↔∀∃∈∉⊂⊃⊆⊇∩∪∞≈≠≤≥±×÷°]/.test(subPart)) {
              return <span key={subIdx} className="font-serif font-black text-indigo-700 text-[1.1em] mx-[1px] inline-block">{subPart}</span>;
          }
          return <span key={subIdx}>{subPart}</span>;
        })}
      </div>
    );
  });
};

const ChatRoom: React.FC = () => {
  const { user, t, onlineUserIds, lang, isAdmin } = useAuth();
  const [userCache, setUserCache] = useState<any[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{url: string, name: string} | null>(null);
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
          return [...prev, {
            id: newMsg.id, userId: newMsg.user_id, content: newMsg.content, type: newMsg.type,
            mediaUrl: newMsg.media_url, fileName: newMsg.file_name, createdAt: newMsg.created_at,
            reactions: newMsg.reactions || [], readBy: newMsg.read_by || []
          }];
        });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, payload => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const getUserInfo = (userId: string, content: string) => {
    if (content.startsWith(AI_PREFIX)) return { name: 'Zay', role: 'ASSISTANT', isBot: true };
    if (userId === ZAY_USER_ID) return { name: 'Zay', role: 'ASSISTANT', isBot: true };
    return userCache.find((u: any) => u.id === userId) || { name: 'Student', role: 'STUDENT' };
  };

  const forceDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) { 
      window.open(url, '_blank'); 
    }
  };

  const handleDownloadAll = (resources: any[]) => {
    resources.forEach((res, i) => {
      setTimeout(() => forceDownload(res.url, res.name), i * 600);
    });
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !user) return;
    setIsSending(true);
    const content = inputText;
    setInputText('');
    try {
      await supabaseService.sendMessage({ userId: user.id, content });
      if (content.toLowerCase().includes('@zay')) {
        const aiRes = await aiService.askZay(content, user, messages);
        await supabaseService.sendMessage({ 
            userId: user.id, content: AI_PREFIX + aiRes.text,
            type: (aiRes.resources?.length || aiRes.grounding?.length) ? 'file' : 'text',
            mediaUrl: JSON.stringify({ 
                res: aiRes.resources || [], 
                grounding: aiRes.grounding || [] 
            })
        });
      }
    } catch (e) {}
    setIsSending(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete message?")) {
        try { await supabaseService.deleteMessage(id); } catch(e) {}
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f2f6ff] relative overflow-hidden">
      {/* Header */}
      <div className="px-6 py-3 bg-white border-b border-slate-100 flex justify-between items-center z-20 shadow-sm shrink-0 h-14">
        <div>
          <h2 className="text-sm font-black text-slate-900 tracking-tight">{t('chat')}</h2>
          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1.5 leading-none">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
            {onlineUserIds.size} Online
          </p>
        </div>
        {isAdmin && (
             <button onClick={async () => { if(confirm("Clear chat history?")) await supabaseService.clearChat(); }} className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm">
                  <Trash2 size={16} />
             </button>
        )}
      </div>

      {/* Messages Area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-8 bg-[#f2f6ff] scroll-smooth hide-scrollbar">
        {messages.map((msg, idx) => {
          const isProxyAI = msg.content.startsWith(AI_PREFIX);
          const cleanContent = isProxyAI ? msg.content.replace(AI_PREFIX, '') : msg.content;
          const userInfo = getUserInfo(msg.userId, msg.content);
          const isMe = user && msg.userId === user.id && !isProxyAI;
          const isBot = userInfo.isBot;
          
          let resources: any[] = [];
          let grounding: any[] = [];
          if (isProxyAI && msg.mediaUrl) {
            try { 
                const meta = JSON.parse(msg.mediaUrl); 
                resources = meta.res || [];
                grounding = meta.grounding || [];
            } catch(e) {}
          }

          return (
            <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''} animate-in slide-in-from-bottom-2 duration-300`}>
               <div className={`w-8 h-8 rounded-2xl flex-shrink-0 flex items-center justify-center text-[10px] font-black text-white shadow-md ${isMe ? 'bg-indigo-600 shadow-indigo-200/50' : isBot ? 'bg-indigo-950 shadow-indigo-900/20' : 'bg-slate-400'}`}>
                  {isBot ? <Bot size={16} /> : userInfo.name.charAt(0)}
               </div>

               <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%]`}>
                  <div className={`relative px-5 py-4 shadow-sm text-xs font-medium leading-relaxed rounded-[1.8rem]
                    ${isMe ? 'bg-indigo-600 text-white rounded-tr-none shadow-indigo-200' : isBot ? 'bg-white text-slate-800 border-2 border-indigo-100 rounded-tl-none' : 'bg-white text-slate-800 rounded-tl-none shadow-indigo-100/30'}`}>
                    
                    <div className="font-sans antialiased text-[13px]">{formatMessageContent(cleanContent)}</div>
                    
                    {grounding.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                            <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                <Globe size={12} className="text-indigo-500" /> Sources
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {grounding.map((chunk, i) => chunk.web && (
                                    <a key={i} href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[9px] font-black text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-all shadow-sm active:scale-95">
                                        <ExternalLink size={11} />
                                        <span className="truncate max-w-[140px]">{chunk.web.title || "Reference Link"}</span>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {resources.length > 0 && (
                        <div className="mt-4 space-y-3 pt-2 border-t border-slate-50/50">
                            <div className="grid grid-cols-2 gap-2">
                                {resources.filter(r => r.type === 'image').map((img, i) => (
                                    <div key={i} className="relative rounded-2xl overflow-hidden border border-slate-100 cursor-zoom-in group/img shadow-sm" onClick={() => setLightboxImage({url: img.url, name: img.name})}>
                                        <img src={img.url} className="w-full aspect-square object-cover" alt={img.name} />
                                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                            <div className="p-2 bg-white/20 backdrop-blur-md rounded-lg text-white"><Maximize2 size={20} /></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            <div className="space-y-2">
                                {resources.filter(r => r.type !== 'image').map((file, i) => (
                                    <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-white hover:shadow-md transition-all group/file w-full">
                                        <div className="w-10 h-10 shrink-0 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shadow-sm">
                                            <FileIcon size={18} />
                                        </div>
                                        <div className="flex-1 min-w-0 flex flex-col items-start overflow-hidden">
                                            <span className="text-xs font-black text-slate-800 truncate w-full block text-left">{file.name || "Untitled Document"}</span>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">PDF / DOC</span>
                                        </div>
                                        <button onClick={() => forceDownload(file.url, file.name || 'document')} className="p-2 bg-white hover:bg-indigo-600 hover:text-white border border-slate-100 rounded-xl transition-all shadow-sm shrink-0">
                                            <Download size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            
                            {resources.length > 1 && (
                                <button onClick={() => handleDownloadAll(resources)} className="w-full py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all flex items-center justify-center gap-2 mt-2 border border-indigo-100 shadow-sm active:scale-95">
                                    <Download size={14} /> Download Package ({resources.length})
                                </button>
                            )}
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-2 mt-3 opacity-30">
                        <span className="text-[7px] font-black uppercase tracking-widest">{new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        {(isMe || isAdmin) && <button onClick={() => handleDelete(msg.id)} className="hover:text-rose-500 transition-colors"><Trash2 size={10} /></button>}
                    </div>
                  </div>
               </div>
            </div>
          );
        })}
      </div>

      {lightboxImage && (
        <div className="fixed inset-0 z-[500] bg-slate-950/98 backdrop-blur-3xl flex flex-col animate-in fade-in duration-300">
            <div className="flex justify-between items-center px-6 pb-6 text-white border-b border-white/5 pt-24 md:pt-14">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400">File Analysis Mode</span>
                    <span className="text-sm md:text-base font-bold truncate max-w-[180px] md:max-w-md">{lightboxImage.name}</span>
                </div>
                <div className="flex items-center gap-2 md:gap-3">
                    <button 
                        onClick={() => forceDownload(lightboxImage.url, lightboxImage.name)} 
                        className="px-6 py-3.5 bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-2xl border border-white/10 flex items-center gap-2 text-[10px] md:text-xs font-black uppercase tracking-widest transition-all shadow-xl active:scale-95"
                    >
                        <Download size={18}/> Save to device
                    </button>
                    <button 
                        onClick={() => setLightboxImage(null)} 
                        className="p-3.5 bg-white/10 hover:bg-rose-600 text-white rounded-2xl border border-white/10 transition-all shadow-xl active:scale-95"
                        title="Close"
                    >
                        <X size={24} />
                    </button>
                </div>
            </div>
            <div className="flex-1 flex items-center justify-center p-4 md:p-12 overflow-hidden cursor-zoom-out" onClick={() => setLightboxImage(null)}>
                <img 
                    src={lightboxImage.url} 
                    className="max-w-full max-h-[60vh] md:max-h-[80vh] object-contain rounded-[2.5rem] shadow-[0_0_120px_rgba(99,102,241,0.35)] animate-in zoom-in-95 duration-500 border border-white/10" 
                    onClick={e => e.stopPropagation()} 
                    alt="Resource Viewer"
                />
            </div>
        </div>
      )}

      {/* Chat Input Bar */}
      <div className="p-3 bg-white border-t border-slate-100 z-30 pb-safe shrink-0">
         <div className="flex items-end gap-3 max-w-4xl mx-auto">
            <input 
                className="flex-1 bg-slate-50 border-transparent focus:bg-white focus:border-indigo-200 border rounded-2xl px-6 py-4 outline-none text-[13px] font-bold transition-all h-14 shadow-inner"
                placeholder={t('chat_placeholder')}
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !isSending && handleSendMessage()}
            />
            <button onClick={handleSendMessage} disabled={isSending} className="w-14 h-14 flex items-center justify-center bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-90 disabled:opacity-50">
                {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
            </button>
         </div>
      </div>
    </div>
  );
};

export default ChatRoom;
