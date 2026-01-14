
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AppState, Lesson } from '../types';
import { useAuth } from '../AuthContext';
import { supabaseService } from '../services/supabaseService';
import { SUBJECT_ICONS } from '../constants';
import { 
  BookOpen, Calendar, Clock, Search, FileText, Image as ImageIcon, 
  Filter, ChevronLeft, ChevronRight, MoreVertical, Edit2, Trash2, 
  Download, PlayCircle, Maximize2, X, Share2, CornerUpLeft, HardDrive,
  Loader2, ZoomIn
} from 'lucide-react';

interface Props {
  state: AppState;
  onUpdate: (updates: Partial<AppState>) => void;
}

const LessonsView: React.FC<Props> = ({ state, onUpdate }) => {
  const { t, lang, isAdmin, isDev } = useAuth();
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{url: string, name: string} | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleDelete = async (id: string) => {
    if (confirm(t('delete_confirm'))) {
        try {
            const { error } = await supabaseService.deleteLesson(id);
            if (error) throw error;
            onUpdate({ lessons: state.lessons.filter(l => l.id !== id) });
            setSelectedLesson(null);
        } catch (e: any) { alert("Delete Failed"); }
    }
  };

  const handleEdit = (lesson: Lesson) => {
    window.dispatchEvent(new CustomEvent('editLesson', { detail: lesson }));
    setActiveMenu(null);
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

  const filteredLessons = useMemo(() => {
    return state.lessons
      .filter(l => l.isPublished)
      .filter(l => {
        const matchesSubject = selectedSubjectId === 'all' || l.subjectId === selectedSubjectId;
        const searchLower = searchTerm.toLowerCase();
        return matchesSubject && (l.title.toLowerCase().includes(searchLower) || (l.description && l.description.toLowerCase().includes(searchLower)));
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [state.lessons, selectedSubjectId, searchTerm]);

  const groupedLessons = useMemo(() => {
    if (selectedSubjectId !== 'all') return { [selectedSubjectId]: filteredLessons };
    const groups: Record<string, Lesson[]> = {};
    filteredLessons.forEach(l => {
      if (!groups[l.subjectId]) groups[l.subjectId] = [];
      groups[l.subjectId].push(l);
    });
    return groups;
  }, [filteredLessons, selectedSubjectId]);

  const scroll = (offset: number) => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  const LessonDetailView = ({ lesson, onClose }: { lesson: Lesson, onClose: () => void }) => {
    const attachments = lesson.attachments || [];
    const images = attachments.filter(a => a.type === 'image' || a.url.match(/\.(jpeg|jpg|gif|png|webp)$/i)) || [];
    const videos = attachments.filter(a => a.type === 'video' || a.url.match(/\.(mp4|webm|mov)$/i)) || [];
    const docs = attachments.filter(a => !images.includes(a) && !videos.includes(a)) || [];
    const subject = state.subjects.find(s => s.id === lesson.subjectId);

    const [isDownloadingAll, setIsDownloadingAll] = useState(false);

    const handleDownloadAll = async () => {
        setIsDownloadingAll(true);
        for (let i = 0; i < attachments.length; i++) {
            await forceDownload(attachments[i].url, attachments[i].name);
            await new Promise(r => setTimeout(r, 600));
        }
        setIsDownloadingAll(false);
    };

    return (
        <div className="min-h-full space-y-6 animate-in slide-in-from-right duration-300 max-w-full overflow-hidden pb-20">
            {/* Nav Header */}
            <div className="flex items-center justify-between gap-4 sticky top-0 z-[40] py-4 bg-[#f2f6ff]/95 backdrop-blur-md px-2 border-b border-slate-200/50 shadow-sm">
                 <button onClick={onClose} className="flex items-center gap-2 text-slate-700 hover:text-indigo-600 font-black uppercase tracking-widest text-[10px] transition-all bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-md active:scale-95 shrink-0">
                    <CornerUpLeft size={16} /> <span className="hidden sm:inline">{t('back_subjects')}</span>
                 </button>
                 
                 <div className="flex items-center gap-2 sm:gap-4">
                    {attachments.length > 1 && (
                        <button 
                            onClick={handleDownloadAll} 
                            disabled={isDownloadingAll}
                            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 shrink-0 ${isDownloadingAll ? 'bg-slate-200 text-slate-400' : 'bg-emerald-600 text-white shadow-emerald-100 hover:bg-emerald-700'}`}
                        >
                            {isDownloadingAll ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                            {isDownloadingAll ? 'Saving...' : `Download All (${attachments.length})`}
                        </button>
                    )}
                    {(isAdmin || isDev) && (
                        <div className="flex items-center gap-2 border-l border-slate-300 pl-4">
                            <button onClick={() => handleEdit(lesson)} className="w-10 h-10 flex items-center justify-center bg-white text-indigo-600 rounded-2xl border border-slate-200 shadow-sm hover:bg-indigo-50 active:scale-90 transition-all"><Edit2 size={18}/></button>
                            <button onClick={() => handleDelete(lesson.id)} className="w-10 h-10 flex items-center justify-center bg-white text-rose-600 rounded-2xl border border-slate-200 shadow-sm hover:bg-rose-50 active:scale-90 transition-all"><Trash2 size={18}/></button>
                        </div>
                    )}
                 </div>
            </div>

            <div className="space-y-6 px-1">
                {/* Hero */}
                <div className={`relative rounded-[3rem] p-10 md:p-14 overflow-hidden shadow-2xl ${subject?.color || 'bg-slate-800'} text-white`}>
                    <div className="relative z-10 space-y-6">
                        <div className="flex flex-wrap items-center gap-3 opacity-90">
                            <span className="px-3 py-1.5 bg-white/20 backdrop-blur-md rounded-xl text-[9px] font-black uppercase tracking-widest border border-white/20">{subject?.name[lang]}</span>
                            <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest bg-black/10 px-3 py-1.5 rounded-xl"><Calendar size={14}/> {lesson.date || new Date(lesson.createdAt).toLocaleDateString()}</span>
                        </div>
                        <h1 className="text-3xl md:text-5xl lg:text-6xl font-black tracking-tight leading-tight">{lesson.title}</h1>
                        {lesson.startTime && (
                            <div className="flex items-center gap-2 bg-black/20 w-fit px-5 py-2.5 rounded-2xl text-xs font-black backdrop-blur-md border border-white/10">
                                <Clock size={16}/> {lesson.startTime} — {lesson.endTime}
                            </div>
                        )}
                    </div>
                    <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-10">
                         {/* Description */}
                         <div className="bg-white p-8 md:p-12 rounded-[3rem] border border-slate-100 shadow-sm">
                            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8 flex items-center gap-2"><FileText size={18} className="text-indigo-500" /> {t('description')}</h2>
                            <p className="whitespace-pre-wrap text-slate-700 font-medium leading-[2] text-sm md:text-lg">
                                {lesson.description || "No description provided."}
                            </p>
                         </div>

                         {/* Image Materials */}
                         {images.length > 0 && (
                            <div className="space-y-6">
                                <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] px-4 flex items-center gap-2"><ImageIcon size={18} className="text-emerald-500" /> Lesson Materials</h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    {images.map((img, idx) => (
                                        <div 
                                            key={idx} 
                                            className="relative group rounded-[3rem] overflow-hidden shadow-md bg-white border border-slate-100 aspect-[4/5] cursor-zoom-in"
                                            onClick={() => setLightboxImage({url: img.url, name: img.name})}
                                        >
                                            <img src={img.url} alt={img.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
                                            <div className="absolute inset-0 bg-indigo-950/40 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-3">
                                                <div className="p-4 bg-white/20 backdrop-blur-md rounded-full border border-white/30 text-white"><Maximize2 size={24} /></div>
                                                <p className="text-[10px] font-black text-white uppercase tracking-widest">In-App View</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                         )}

                         {/* Videos */}
                         {videos.length > 0 && (
                            <div className="space-y-6">
                                <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] px-4 flex items-center gap-2"><PlayCircle size={18} className="text-rose-500" /> Recorded Content</h2>
                                <div className="grid gap-8">
                                    {videos.map((vid, idx) => (
                                        <div key={idx} className="bg-white rounded-[3rem] overflow-hidden shadow-xl border border-slate-100">
                                            <video controls className="w-full aspect-video bg-black shadow-inner" src={vid.url} />
                                            <div className="p-6 flex justify-between items-center bg-slate-50">
                                                <div className="min-w-0 pr-4">
                                                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-1">Video File</span>
                                                    <p className="text-xs font-black text-slate-800 truncate">{vid.name}</p>
                                                </div>
                                                <button onClick={() => forceDownload(vid.url, vid.name)} className="w-12 h-12 flex items-center justify-center bg-white text-slate-500 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm border border-slate-100"><Download size={20} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                         )}
                    </div>

                    <div className="space-y-6">
                        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm sticky top-28">
                            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-2"><HardDrive size={18} className="text-indigo-500" /> Resource Files</h2>
                            {docs.length === 0 ? (
                                <div className="p-10 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 text-center">
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">No extra files</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {docs.map((doc, idx) => (
                                        <div key={idx} className="flex items-center gap-4 p-5 bg-slate-50 border border-slate-100 rounded-[2rem] transition-all hover:bg-white hover:border-indigo-200 hover:shadow-lg group">
                                            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 shadow-sm shrink-0 transition-colors"><FileText size={24} /></div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-black text-slate-700 truncate mb-1">{doc.name}</p>
                                                <button onClick={() => forceDownload(doc.url, doc.name)} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2 hover:text-indigo-800 transition-colors"><Download size={14} /> Download</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* LIGHTBOX Overlay */}
            {lightboxImage && (
                <div className="fixed inset-0 z-[500] bg-slate-950/98 backdrop-blur-3xl flex flex-col animate-in fade-in duration-300">
                    {/* Shifted header down for mobile to avoid clash with main app menu */}
                    <div className="flex justify-between items-center px-6 pb-6 text-white border-b border-white/5 pt-20 md:pt-10">
                        <div className="flex items-center gap-4">
                            <div className="hidden sm:flex p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20"><Maximize2 size={24}/></div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Viewing Attachment</span>
                                <span className="text-sm md:text-base font-bold truncate max-w-[160px] md:max-w-md">{lightboxImage.name}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 md:gap-3">
                            <button 
                                onClick={() => forceDownload(lightboxImage.url, lightboxImage.name)} 
                                className="px-5 md:px-6 py-3 bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl md:rounded-2xl transition-all border border-white/10 flex items-center gap-2 text-[10px] md:text-xs font-black uppercase tracking-widest shadow-xl active:scale-95"
                            >
                                <Download size={18}/> Save
                            </button>
                            <button 
                                onClick={() => setLightboxImage(null)} 
                                className="p-3 bg-white/10 hover:bg-rose-600 text-white rounded-xl md:rounded-2xl transition-all border border-white/10 shadow-xl active:scale-95"
                                title="Close"
                            >
                                <X size={24} />
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 flex items-center justify-center p-4 md:p-10 overflow-hidden cursor-zoom-out" onClick={() => setLightboxImage(null)}>
                        <img 
                            src={lightboxImage.url} 
                            alt="Full Size" 
                            className="max-w-full max-h-[70vh] md:max-h-[85vh] object-contain rounded-2xl shadow-[0_0_100px_rgba(99,102,241,0.25)] animate-in zoom-in-95 duration-500 border border-white/10" 
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
            )}
        </div>
    );
  };

  if (selectedLesson) {
    return <LessonDetailView lesson={selectedLesson} onClose={() => setSelectedLesson(null)} />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-20" onClick={() => setActiveMenu(null)}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">{t('lesson_library')}</h1>
          <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest">{t('access_materials')}</p>
        </div>
        <div className="relative w-full md:w-64">
          <Search size={16} className="absolute left-4 top-3.5 text-slate-400" />
          <input 
            type="text" 
            placeholder={t('search_lessons')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-2xl pl-10 pr-4 py-3.5 font-bold text-xs outline-none focus:border-indigo-500 shadow-sm"
          />
        </div>
      </div>

      <div className="relative group">
        <div ref={scrollRef} className="flex gap-2 overflow-x-auto hide-scrollbar py-2 px-1">
            <button onClick={() => setSelectedSubjectId('all')} className={`flex-shrink-0 flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border ${selectedSubjectId === 'all' ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300 shadow-sm'}`}><Filter size={12} /> {t('all')}</button>
            {state.subjects.map(subj => (
            <button key={subj.id} onClick={() => setSelectedSubjectId(subj.id)} className={`flex-shrink-0 flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border ${selectedSubjectId === subj.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-xl' : 'bg-white text-slate-400 border-slate-100 hover:border-indigo-200 shadow-sm'}`}>{subj.name[lang]}</button>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredLessons.map(lesson => (
            <div key={lesson.id} onClick={() => setSelectedLesson(lesson)} className="group bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all flex flex-col justify-between h-full relative cursor-pointer">
                {(isAdmin || isDev) && (
                    <div className="absolute top-4 right-4 z-20">
                        <button onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === lesson.id ? null : lesson.id); }} className="p-2 text-slate-300 hover:text-indigo-600 active:scale-90 transition-all"><MoreVertical size={16} /></button>
                        {activeMenu === lesson.id && (
                            <div className="absolute right-0 mt-2 w-32 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-30">
                                <button onClick={(e) => { e.stopPropagation(); handleEdit(lesson); }} className="w-full text-left px-4 py-2 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50 flex items-center gap-2"><Edit2 size={12}/> {t('edit')}</button>
                                <button onClick={(e) => { e.stopPropagation(); handleDelete(lesson.id); }} className="w-full text-left px-4 py-2 text-[10px] font-black uppercase text-rose-500 hover:bg-rose-50 flex items-center gap-2"><Trash2 size={12}/> {t('delete')}</button>
                            </div>
                        )}
                    </div>
                )}
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <span className="px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-600">{lesson.type}</span>
                        <span className="text-[9px] font-bold text-slate-400 pr-8 truncate">{lesson.date || new Date(lesson.createdAt).toLocaleDateString()}</span>
                    </div>
                    <h3 className="text-base font-black text-slate-900 leading-tight mb-3 group-hover:text-indigo-600 transition-colors">{lesson.title}</h3>
                    <p className="text-[11px] text-slate-500 line-clamp-3 mb-6 font-medium leading-relaxed">{lesson.description}</p>
                </div>
                <div className="pt-4 border-t border-slate-50 flex justify-between items-center">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><HardDrive size={12}/> {lesson.attachments?.length || 0} Files</span>
                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition-colors"><ChevronRight size={18}/></div>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
};

export default LessonsView;
