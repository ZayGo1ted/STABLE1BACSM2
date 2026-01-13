
import React, { useState, useMemo, useRef } from 'react';
import { AppState, Lesson } from '../types';
import { useAuth } from '../AuthContext';
import { supabaseService } from '../services/supabaseService';
import { SUBJECT_ICONS } from '../constants';
import { BookOpen, Calendar, Clock, Search, FileText, Image as ImageIcon, Filter, ChevronLeft, ChevronRight, MoreVertical, Edit2, Trash2, Download } from 'lucide-react';

interface Props {
  state: AppState;
}

const LessonsView: React.FC<Props> = ({ state }) => {
  const { t, lang, isAdmin, isDev } = useAuth();
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Helper for admin actions
  const handleDelete = async (id: string) => {
    if (confirm("Delete this lesson?")) {
        await supabaseService.deleteLesson(id);
        window.location.reload();
    }
  };

  const handleEdit = (lesson: Lesson) => {
    // We need to trigger the parent to switch to Admin view with this lesson
    // Since we don't have a direct prop callback for navigation here in this snippet,
    // we will store it in local storage or dispatch an event, OR rely on the parent wrapper.
    // However, the cleanest way without changing App.tsx props completely is to use a global event or context, 
    // OR we can simple alert the user to use the Admin Panel for now, BUT the user specifically asked for a menu here.
    // Solution: We'll dispatch a custom event that App.tsx or CalendarView listens to? No, that's messy.
    // We will assume `window.location.reload` isn't enough for edit state.
    // We will cheat slightly: We'll set a sessionStorage flag and reload to 'admin' view?
    // Better: Add a prop for `onEdit` in future, but for now let's just use the Admin Panel logic if we are in admin view.
    // Actually, I'll assume the App passes a `setPendingEditLesson` if I could change App.tsx, but I can't easily change App.tsx state flow without full file.
    // WORKAROUND: We will emit a custom event "editLesson"
    const event = new CustomEvent('editLesson', { detail: lesson });
    window.dispatchEvent(event);
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

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-20" onClick={() => setActiveMenu(null)}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Lesson Library</h1>
          <p className="text-slate-500 font-bold text-sm">Access course materials, summaries, and exercises.</p>
        </div>
        <div className="relative w-full md:w-64">
          <Search size={18} className="absolute left-4 top-3.5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search lessons..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-3 font-bold text-sm outline-none focus:border-indigo-500 transition-colors shadow-sm"
          />
        </div>
      </div>

      <div className="relative group">
        <button onClick={() => scroll(-200)} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-lg border border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex"><ChevronLeft size={20}/></button>
        <button onClick={() => scroll(200)} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-lg border border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex"><ChevronRight size={20}/></button>
        
        <div ref={scrollRef} className="flex gap-3 overflow-x-auto hide-scrollbar py-4 px-1 snap-x snap-mandatory">
            <button onClick={() => setSelectedSubjectId('all')} className={`snap-start flex-shrink-0 flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all whitespace-nowrap border-2 ${selectedSubjectId === 'all' ? 'bg-slate-900 text-white border-slate-900 shadow-xl scale-105' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300 shadow-sm'}`}><Filter size={14} /> All</button>
            {state.subjects.map(subj => (
            <button key={subj.id} onClick={() => setSelectedSubjectId(subj.id)} className={`snap-start flex-shrink-0 flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all whitespace-nowrap border-2 ${selectedSubjectId === subj.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-xl scale-105' : 'bg-white text-slate-400 border-slate-100 hover:border-indigo-200 shadow-sm'}`}>{subj.name[lang]}</button>
            ))}
        </div>
      </div>

      {Object.keys(groupedLessons).length === 0 ? (
        <div className="text-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
           <BookOpen size={48} className="mx-auto text-slate-300 mb-4" />
           <h3 className="text-slate-400 font-black uppercase tracking-widest">No lessons found</h3>
           <p className="text-slate-400 text-xs mt-1">Try adjusting your search filters</p>
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
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${subject.color}`}>
                        {SUBJECT_ICONS[subjId] || <BookOpen size={16}/>}
                      </div>
                      <h2 className="text-lg font-black text-slate-900">{subject.name[lang]}</h2>
                      <span className="bg-slate-100 text-slate-500 text-[10px] font-black px-2 py-1 rounded-md">{lessons.length}</span>
                   </div>
                 )}

                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {lessons.map(lesson => (
                      <div key={lesson.id} className="group bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col justify-between h-full relative">
                         
                         {/* Admin Menu */}
                         {(isAdmin || isDev) && (
                            <div className="absolute top-4 right-4 z-20">
                                <button onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === lesson.id ? null : lesson.id); }} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
                                    <MoreVertical size={16} />
                                </button>
                                {activeMenu === lesson.id && (
                                    <div className="absolute right-0 mt-2 w-32 bg-white rounded-xl shadow-xl border border-slate-100 py-2 animate-in fade-in zoom-in-95">
                                        <button onClick={(e) => { e.stopPropagation(); handleEdit(lesson); }} className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 flex items-center gap-2">
                                            <Edit2 size={12}/> Edit
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(lesson.id); }} className="w-full text-left px-4 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 flex items-center gap-2">
                                            <Trash2 size={12}/> Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                         )}

                         <div>
                            <div className="flex justify-between items-start mb-3">
                               <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide ${
                                 lesson.type === 'lesson' ? 'bg-indigo-50 text-indigo-600' :
                                 lesson.type === 'exercise' ? 'bg-emerald-50 text-emerald-600' :
                                 lesson.type === 'summary' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
                               }`}>
                                 {lesson.type.replace('_', ' ')}
                               </span>
                               <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 pr-8">
                                 <Calendar size={12} /> {lesson.date || new Date(lesson.createdAt).toLocaleDateString()}
                               </span>
                            </div>
                            
                            <h3 className="text-base font-black text-slate-900 leading-tight mb-2 line-clamp-2" title={lesson.title}>
                              {lesson.title}
                            </h3>
                            
                            <p className="text-xs text-slate-500 font-medium line-clamp-3 mb-4 leading-relaxed whitespace-pre-wrap">
                              {lesson.description}
                            </p>
                         </div>

                         <div className="pt-4 border-t border-slate-50 space-y-3 mt-auto">
                            {lesson.startTime && lesson.endTime && (
                              <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold bg-slate-50 p-2 rounded-lg">
                                <Clock size={12} className="text-indigo-500" />
                                <span>Written: {lesson.startTime} - {lesson.endTime}</span>
                              </div>
                            )}

                            <div className="flex flex-col gap-2">
                                {lesson.attachments && lesson.attachments.length > 0 ? (
                                    lesson.attachments.map((file, idx) => (
                                        <a 
                                            key={idx}
                                            href={file.url} 
                                            target="_blank" 
                                            download
                                            className="flex items-center justify-between gap-2 bg-slate-50 text-slate-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-600 transition-colors border border-slate-100"
                                        >
                                            <span className="truncate flex items-center gap-2"><FileText size={12}/> {file.name || `File ${idx+1}`}</span>
                                            <Download size={12} />
                                        </a>
                                    ))
                                ) : (
                                    lesson.fileUrl && (
                                        <a href={lesson.fileUrl} target="_blank" className="flex items-center justify-center gap-2 bg-slate-900 text-white px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-colors shadow-lg shadow-slate-200 w-full">
                                            Download Main File
                                        </a>
                                    )
                                )}
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
