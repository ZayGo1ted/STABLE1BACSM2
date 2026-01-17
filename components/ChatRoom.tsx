// components/ChatRoom.tsx
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
  ChevronRight, CornerUpLeft, Terminal, Globe, ExternalLink,
  Zap, AlertCircle, Camera, Upload
} from 'lucide-react';
import { ZAY_USER_ID } from '../constants';

const AI_PREFIX = ":::AI_RESPONSE:::";
const DIAGNOSTIC_FLAG = "[DIAGNOSTIC ALERT]";

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
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
      setShowImageUpload(true);
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!selectedImage) return null;
    
    setIsUploadingImage(true);
    try {
      // Upload to Supabase storage
      const { url } = await supabaseService.uploadFile(selectedImage);
      setIsUploadingImage(false);
      return url;
    } catch (error) {
      console.error('Image upload failed:', error);
      setIsUploadingImage(false);
      return null;
    }
  };

  const handleSendMessage = async () => {
    if ((!inputText.trim() && !selectedImage) || !user) return;
    
    setIsSending(true);
    
    try {
      // If there's an image, upload it first
      let imageUrl: string | null = null;
      if (selectedImage) {
        imageUrl = await uploadImage();
        if (!imageUrl) {
          alert("Failed to upload image. Please try again.");
          setIsSending(false);
          return;
        }
      }
      
      // Send user message
      const content = inputText.trim() || (imageUrl ? "Image analysis request" : "");
      if (content) {
        await supabaseService.sendMessage({ 
          userId: user.id, 
          content,
          mediaUrl: imageUrl || undefined,
          fileName: selectedImage?.name
        });
      }
      
      // If it's an image or mentions Zay, get AI response
      if (imageUrl || content.toLowerCase().includes('@zay') || content.toLowerCase().includes('zay')) {
        let aiRes;
        if (imageUrl) {
          // Use image analysis
          aiRes = await aiService.analyzeImage(imageUrl, content || "Analyze this image", user);
        } else {
          // Regular text query
          aiRes = await aiService.askZay(content, user, messages);
        }
        
        // Send AI response
        await supabaseService.sendMessage({ 
          userId: ZAY_USER_ID, 
          content: AI_PREFIX + aiRes.text,
          type: aiRes.type,
          mediaUrl: JSON.stringify({ 
            res: aiRes.resources || [], 
            grounding: aiRes.grounding || [],
            isError: aiRes.isErrorDetection
          })
        });
      }
      
      // Reset form
      setInputText('');
      setSelectedImage(null);
      setImagePreview(null);
      setShowImageUpload(false);
      
    } catch (e) {
      console.error("Send message error:", e);
    }
    
    setIsSending(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete message?")) {
        try { await supabaseService.deleteMessage(id); } catch(e) {}
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f2f6ff] relative overflow-hidden">
      {/* Header */}
      <div className="px-6 py-3 bg-white border-b border-slate-100 flex justify-between items-center z-20 shadow-sm shrink-0 h-14">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
             <Zap size={16} />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900 tracking-tight">Zay Diagnostic Hub</h2>
            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1.5 leading-none">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              {onlineUserIds.size} Active
            </p>
          </div>
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
          let isDiagnosticError = false;

          if (isProxyAI
