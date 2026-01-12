
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../AuthContext';
import { supabaseService, getSupabase } from '../services/supabaseService';
import { aiService } from '../services/aiService';
import { ChatMessage, UserRole } from '../types';
import { 
  Send, Mic, Image as ImageIcon, Paperclip, X, 
  Smile, Play, Pause, File as FileIcon, Trash2,
  ShieldAlert, Sparkles, Bot, Reply, ArrowDown
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
  return parts.map((part, i) => part.startsWith('@') ? <span key={i} className="font-bold text-indigo-600 bg-indigo-50 px-1 rounded">{part}</span> : part);
};

const ChatRoom: React.FC = () => {
  const { user, t, onlineUserIds, lang, isAdmin } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [userCache, setUserCache] = useState<any[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    try {
      const state = JSON.parse(localStorage.getItem('1bacsm2_state') || '{}');
      if (state.users) setUserCache(state.users);
    } catch (e) {}
    supabaseService.fetchMessages(100).then(setMessages);
    
    const channel = getSupabase().channel('public:messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, payload => {
        if (payload.eventType === 'INSERT') {
            setMessages(prev => [...prev, { ...payload.new, reactions: payload.new.reactions || [] } as any]);
        } else if (payload.eventType === 'DELETE') {
            setMessages(prev => prev.filter(m => m.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => { getSupabase().removeChannel(channel); };
  }, []);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(scrollToBottom, [messages.length]);

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
        try { await supabaseService.deleteMessage(id); } catch(e) { alert("Delete failed: Permission denied"); }
    }
  };

  const handleClear = async () => {
    if (confirm("Delete ALL messages?")) {
        try { await supabaseService.clearChat(); setMessages([]); } catch(e) { alert("Clear failed"); }
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f0f2f5]">
      <div className="p-3 bg-white border-b flex justify-between items-center shadow-sm">
        <h2 className="font-black text-slate-900">{t('chat')} <span className="text-emerald-500 text-xs">{onlineUserIds.size} online</span></h2>
        {isAdmin && <button onClick={handleClear} className="text-rose-600 bg-rose-50 p-2 rounded-lg"><Trash2 size={16}/></button>}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => {
          const isProxyAI = msg.content.startsWith(AI_PREFIX);
          const cleanContent = isProxyAI ? msg.content.replace(AI_PREFIX, '') : msg.content;
          const isMe = user && msg.userId === user.id && !isProxyAI;
          const isBot = isProxyAI || msg.userId === ZAY_USER_ID;
          const senderName = isBot ? "Zay" : (userCache.find(u => u.id === msg.userId)?.name || "Student");
          const canDelete = (user && msg.userId === user.id) || isAdmin;

          return (
            <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white ${isBot ? 'bg-violet-600' : 'bg-slate-400'}`}>
                {isBot ? <Bot size={16}/> : senderName[0]}
              </div>
              <div className={`max-w-[80%] p-3 rounded-2xl ${isMe ? 'bg-indigo-600 text-white' : 'bg-white border text-slate-800'} relative group`}>
                {!isMe && <p className="text-[10px] font-black opacity-50 mb-1">{senderName}</p>}
                <p className="whitespace-pre-wrap text-sm">{renderContentWithMentions(cleanContent)}</p>
                {msg.mediaUrl && (msg.type === 'image' ? <img src={msg.mediaUrl} className="mt-2 rounded-lg max-h-48"/> : <a href={msg.mediaUrl} target="_blank" className="block mt-2 underline text-xs">Attachment</a>)}
                {canDelete && <button onClick={() => handleDelete(msg.id)} className="absolute -top-2 -right-2 bg-white text-rose-500 p-1 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12}/></button>}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-3 bg-white border-t flex gap-2">
        <input 
            className="flex-1 bg-slate-100 rounded-full px-4 py-2 outline-none text-sm font-medium"
            placeholder={t('chat_placeholder')}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
        />
        <button onClick={handleSendMessage} disabled={isSending} className="bg-indigo-600 text-white p-2 rounded-full"><Send size={18}/></button>
      </div>
    </div>
  );
};

export default ChatRoom;
