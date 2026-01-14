
import React, { useState, useMemo, useRef } from 'react';
import { AppState, Lesson } from '../types';
import { useAuth } from '../AuthContext';
import { supabaseService } from '../services/supabaseService';
import { SUBJECT_ICONS } from '../constants';
import { 
  BookOpen, Calendar, Clock, Search, FileText, Image as ImageIcon, 
  Filter, ChevronLeft, ChevronRight, MoreVertical, Edit2, Trash2, 
  Download, PlayCircle, Maximize2, X, Share2, CornerUpLeft
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
  
  // Detail View State
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleDelete = async (id: string) => {
    if (confirm(t('delete_confirm'))) {
        try {
            const { error } = await supabaseService.deleteLesson(id);
            if (error) throw error;

            // Optimistic update
            const newLessons = state.lessons.filter(l => l.id !== id);
            onUpdate({ lessons: newLessons });
            setActiveMenu(null);
            setSelectedLesson(null); // Close detail view if deleted
        } catch (e: any) {
            alert("Delete Failed: " + (e.message || "Unknown error"));
            window.location.reload();
        }
    }
  };

  const handleEdit = (lesson: Lesson) => {
    const event = new CustomEvent('editLesson', { detail: lesson });
    window.dispatchEvent(event);
    setActiveMenu(null);
  };

  const filteredLessons = useMemo(() => {
    return state.lessons
      .filter(l => l.isPublished)
      .filter(l => {
        const matchesSubject = selectedSubjectId === 'all' || l.subjectId === selectedSubjectId;
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = l.title.toLowerCase().includes(searchLower) || 
                              l.description.toLowerCase().includes(searchLower) ||
                              l.keywords.some(k => k.toLowerCase().includes(searchLower));
        return matchesSubject && matchesSearch;
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

  // --- DETAIL VIEW COMPONENT ---
  const LessonDetailView = ({ lesson, onClose }: { lesson: Lesson, onClose: () => void }) => {
    // Categorizing resources
    const images = lesson.attachments?.filter(a => a.type === 'image' || a.url.match(/\.(jpeg|jpg|gif|png|webp)$/i)) || [];
    const videos = lesson.attachments?.filter(a => a.type === 'video' || a.url.match(/\.(mp4|webm|mov)$/i)) || [];
    const docs = lesson.attachments?.filter(a => !images.includes(a) && !videos.includes(a)) || [];
    
    // Include legacy fileUrl if not in attachments
    if (lesson.fileUrl && !lesson.attachments?.find(a => a.url === lesson.fileUrl)) {
        const isImg = lesson.fileUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i);
        const isVid = lesson.fileUrl.match(/\.(mp4|webm|mov)$/i);
        if (isImg) images.push({ name: 'Main Image', url: lesson.fileUrl, type: 'image' });
        else if (isVid) videos.push({ name: 'Main Video', url: lesson.fileUrl, type: 'video' });
        else docs.push({ name: 'Main Document', url: lesson.fileUrl, type: 'file' });
    }

    const subject = state.subjects.find(s => s.id === lesson.subjectId);

    return (
        <div className="fixed inset-0 z-[60] bg-[#f2f6ff] overflow-y-auto animate-in slide-in-from-right duration-300">
            {/* Header/Nav */}
            <div className="sticky top-0 z-50 glass-nav px-4 py-3 flex justify-between items-center pb-safe">
                 <button onClick={onClose} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-black uppercase tracking-widest text-xs transition-colors bg-white/50 px-4 py-2 rounded-xl border border-white hover:bg-white shadow-sm">
                    <CornerUpLeft size={16} /> Back to Library
                 </button>
                 <div className="flex gap-2">
                    {(isAdmin || isDev) && (
                        <>
                        <button onClick={() => handleEdit(lesson)} className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 border border-indigo-100"><Edit2 size={18}/></button>
                        <button onClick={() => handleDelete(lesson.id)} className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 border border-rose-100"><Trash2 size={18}/></button>
                        </>
                    )}
                 </div>
            </div>

            <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6 pb-32">
                {/* Hero */}
                <div className={`relative rounded-[2.5rem] p-8 md:p-12 overflow-hidden shadow-2xl ${subject?.color || 'bg-slate-800'} text-white`}>
                    <div className="relative z-10 space-y-4">
                        <div className="flex items-center gap-3 opacity-90">
                            <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-lg text-[10px] font-black uppercase tracking-widest border border-white/10">{subject?.name[lang]}</span>
                            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest"><Calendar size={12}/> {lesson.date || new Date(lesson.createdAt).toLocaleDateString()}</span>
                        </div>
                        <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">{lesson.title}</h1>
                        <div className="flex items-center gap-2 pt-2">
                            {lesson.startTime && <div className="flex items-center gap-1.5 bg-black/20 px-3 py-1.5 rounded-lg text-xs font-bold backdrop-blur-sm"><Clock size={14}/> {lesson.startTime} - {lesson.endTime}</div>}
                            <div className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide bg-white/20 text-white backdrop-blur-sm border border-white/10`}>
                                 {lesson.type.replace('_', ' ')}
                            </div>
                        </div>
                    </div>
                    {/* Abstract Shapes */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
                </div>

                {/* Content Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Content Column */}
                    <div className="lg:col-span-2 space-y-6">
                         {/* Description */}
                         <div className="glass-card p-6 md:p-8 rounded-[2.5rem]">
                            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><FileText size={14}/> Lesson Content</h2>
                            <div className="prose prose-slate max-w-none">
                                <p className="whitespace-pre-wrap text-slate-700 font-medium leading-loose text-sm md:text-base">
                                    {lesson.description || "No text description provided."}
                                </p>
                            </div>
                         </div>

                         {/* Videos Section */}
                         {videos.length > 0 && (
                            <div className="space-y-4">
                                <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 flex items-center gap-2"><PlayCircle size={14}/> Video Resources</h2>
                                <div className="grid gap-6">
                                    {videos.map((vid, idx) => (
                                        <div key={idx} className="bg-black rounded-[2rem] overflow-hidden shadow-xl border border-slate-800 relative group">
                                            <video controls className="w-full aspect-video" src={vid.url} preload="metadata">
                                                Your browser does not support the video tag.
                                            </video>
                                            <div className="p-4 bg-slate-900 text-white flex justify-between items-center border-t border-white/10">
                                                <span className="text-xs font-bold truncate pr-4">{vid.name}</span>
                                                <button onClick={() => window.open(vid.url, '_blank')} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                                                    <Download size={16} className="text-white" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                         )}

                         {/* Images Gallery */}
                         {images.length > 0 && (
                            <div className="space-y-4">
                                <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 flex items-center gap-2"><ImageIcon size={14}/> Gallery</h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {images.map((img, idx) => (
                                        <div key={idx} className="relative group rounded-[2rem] overflow-hidden shadow-sm bg-white border border-slate-100 aspect-square cursor-pointer" onClick={() => window.open(img.url, '_blank')}>
                                            <img src={img.url} alt={img.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                                <Maximize2 className="text-white opacity-0 group-hover:opacity-100 transition-opacity scale-90 group-hover:scale-100 duration-300 drop-shadow-md" size={32} />
                                            </div>
                                            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                                <p className="text-white text-[10px] font-bold truncate">{img.name}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                         )}
                    </div>

                    {/* Sidebar / Attachments Column */}
                    <div className="space-y-6">
                        <div className="glass-card p-6 rounded-[2.5rem] sticky top-24">
                            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Download size={14}/> Files & Docs</h2>
                            {docs.length === 0 ? (
                                <div className="p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-center">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">No documents</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {docs.map((doc, idx) => (
                                        <a key={idx} href={doc.url} target="_blank" download className="flex items-center gap-3 p-4 bg-white hover:bg-indigo-50 border border-slate-100 hover:border-indigo-200 rounded-2xl transition-all group shadow-sm hover:shadow-md">
                                            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 shadow-sm shrink-0">
                                                <FileText size={20} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-black text-slate-700 truncate group-hover:text-indigo-700">{doc.name}</p>
                                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Download</p>
                                            </div>
                                            <Download size={14} className="text-slate-300 group-hover:text-indigo-400" />
                                        </a>
                                    ))}
                                </div>
                            )}
                            
                            <div className="mt-8 pt-6 border-t border-slate-100/50">
                                <h3 className="text-[10px] font-black text-slate-900 mb-3 uppercase tracking-wide">Metadata</h3>
                                <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-400 font-bold">Type</span>
                                        <span className="font-black text-slate-700 uppercase bg-white px-2 py-0.5 rounded border border-slate-100 shadow-sm">{lesson.type}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-400 font-bold">Posted</span>
                                        <span className="font-black text-slate-700">{new Date(lesson.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    {lesson.keywords && lesson.keywords.length > 0 && (
                                        <div className="pt-2 flex flex-wrap gap-1.5">
                                            {lesson.keywords.map(k => (
                                                <span key={k} className="px-2 py-1 bg-white border border-slate-200 text-slate-500 rounded-lg text-[8px] font-black uppercase shadow-sm">{k}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
  };

  // --- MAIN RENDER ---

  if (selectedLesson) {
    return <LessonDetailView lesson={selectedLesson} onClose={() => setSelectedLesson(null)} />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-20" onClick={() => setActiveMenu(null)}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">{t('lesson_library')}</h1>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-wide">{t('access_materials')}</p>
        </div>
        <div className="relative w-full md:w-64">
          <Search size={16} className="absolute left-4 top-3.5 text-slate-400" />
          <input 
            type="text" 
            placeholder={t('search_lessons')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-2xl pl-10 pr-4 py-3 font-bold text-xs outline-none focus:border-indigo-500 transition-colors shadow-sm"
          />
        </div>
      </div>

      <div className="relative group">
        <button onClick={() => scroll(-200)} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-lg border border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex"><ChevronLeft size={20}/></button>
        <button onClick={() => scroll(200)} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-lg border border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex"><ChevronRight size={20}/></button>
        
        <div ref={scrollRef} className="flex gap-2 overflow-x-auto hide-scrollbar py-2 px-1 snap-x snap-mandatory">
            <button onClick={() => setSelectedSubjectId('all')} className={`snap-start flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap border ${selectedSubjectId === 'all' ? 'bg-slate-900 text-white border-slate-900 shadow-md scale-105' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300 shadow-sm'}`}><Filter size={12} /> {t('all')}</button>
            {state.subjects.map(subj => (
            <button key={subj.id} onClick={() => setSelectedSubjectId(subj.id)} className={`snap-start flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap border ${selectedSubjectId === subj.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-105' : 'bg-white text-slate-400 border-slate-100 hover:border-indigo-200 shadow-sm'}`}>{subj.name[lang]}</button>
            ))}
        </div>
      </div>

      {Object.keys(groupedLessons).length === 0 ? (
        <div className="text-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
           <BookOpen size={48} className="mx-auto text-slate-300 mb-4" />
           <h3 className="text-slate-400 font-black uppercase tracking-widest text-xs">{t('no_results')}</h3>
           <p className="text-slate-400 text-[10px] mt-1">Try adjusting your search filters</p>
        </div>
      ) : (
        <div className="space-y-8">
          {(Object.entries(groupedLessons) as [string, Lesson[]][]).map(([subjId, lessons]) => {
            const subject = state.subjects.find(s => s.id === subjId);
            if (!subject) return null;

            return (
              <div key={subjId} className="space-y-4">
                 {selectedSubjectId === 'all' && (
                   <div className="flex items-center gap-3 px-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white ${subject.color}`}>
                        {SUBJECT_ICONS[subjId] || <BookOpen size={14}/>}
                      </div>
                      <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">{subject.name[lang]}</h2>
                      <span className="bg-slate-100 text-slate-500 text-[9px] font-black px-2 py-0.5 rounded-md">{lessons.length}</span>
                   </div>
                 )}

                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {lessons.map(lesson => (
                      <div key={lesson.id} onClick={() => setSelectedLesson(lesson)} className="group bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col justify-between h-full relative cursor-pointer">
                         
                         {/* Admin Menu */}
                         {(isAdmin || isDev) && (
                            <div className="absolute top-4 right-4 z-20">
                                <button onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === lesson.id ? null : lesson.id); }} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
                                    <MoreVertical size={16} />
                                </button>
                                {activeMenu === lesson.id && (
                                    <div className="absolute right-0 mt-2 w-32 bg-white rounded-xl shadow-xl border border-slate-100 py-2 animate-in fade-in zoom-in-95 z-30">
                                        <button onClick={(e) => { e.stopPropagation(); handleEdit(lesson); }} className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 flex items-center gap-2">
                                            <Edit2 size={12}/> {t('edit')}
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(lesson.id); }} className="w-full text-left px-4 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 flex items-center gap-2">
                                            <Trash2 size={12}/> {t('delete')}
                                        </button>
                                    </div>
                                )}
                            </div>
                         )}

                         <div>
                            <div className="flex justify-between items-start mb-3">
                               <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wide ${
                                 lesson.type === 'lesson' ? 'bg-indigo-50 text-indigo-600' :
                                 lesson.type === 'exercise' ? 'bg-emerald-50 text-emerald-600' :
                                 lesson.type === 'summary' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
                               }`}>
                                 {lesson.type.replace('_', ' ')}
                               </span>
                               <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1 pr-8">
                                 <Calendar size={10} /> {lesson.date || new Date(lesson.createdAt).toLocaleDateString()}
                               </span>
                            </div>
                            
                            <h3 className="text-sm font-black text-slate-900 leading-tight mb-2 line-clamp-2" title={lesson.title}>
                              {lesson.title}
                            </h3>
                            
                            <p className="text-[10px] text-slate-500 font-medium line-clamp-3 mb-4 leading-relaxed whitespace-pre-wrap">
                              {lesson.description || "Click to view details..."}
                            </p>
                         </div>

                         <div className="pt-3 border-t border-slate-50 mt-auto flex justify-between items-center">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                {(lesson.attachments?.length || 0) + (lesson.fileUrl ? 1 : 0)} resources
                            </span>
                            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                <ChevronRight size={16} />
                            </div>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LessonsView;
