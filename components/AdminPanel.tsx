
import React, { useState, useRef, useEffect } from 'react';
import { AcademicItem, Subject, AppState, Resource, Lesson } from '../types';
import { useAuth } from '../App';
import { supabaseService } from '../services/supabaseService';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Calendar as CalendarIcon, 
  Clock, 
  Type, 
  AlertCircle,
  X,
  UploadCloud,
  FileUp,
  MapPin,
  Save,
  BookOpen,
  FileText,
  CheckCircle,
  Clock3,
  Tag
} from 'lucide-react';

interface Props {
  items: AcademicItem[];
  subjects: Subject[];
  onUpdate: (updates: Partial<AppState>) => void;
  initialEditItem?: AcademicItem | null;
  onEditHandled?: () => void;
}

const AdminPanel: React.FC<Props> = ({ items, subjects, onUpdate, initialEditItem, onEditHandled }) => {
  const { t, lang } = useAuth();
  const formRef = useRef<HTMLFormElement>(null);
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'tasks' | 'lessons'>('tasks');

  // --- TASK MANAGEMENT STATE ---
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [taskFormData, setTaskFormData] = useState<Partial<AcademicItem>>({
    title: '', subjectId: subjects[0]?.id || '', type: 'homework',
    date: new Date().toISOString().split('T')[0], time: '08:00', location: '', notes: '', resources: []
  });

  // --- LESSON MANAGEMENT STATE ---
  const [isAddingLesson, setIsAddingLesson] = useState(false);
  const [lessonFormData, setLessonFormData] = useState<Partial<Lesson>>({
    title: '', subjectId: subjects[0]?.id || '', type: 'course',
    description: '', estimatedTime: '45 min', keywords: [], isPublished: true, fileUrl: ''
  });
  const [keywordInput, setKeywordInput] = useState('');
  const [lessonFile, setLessonFile] = useState<File | null>(null);
  const [isUploadingLesson, setIsUploadingLesson] = useState(false);

  // --- EFFECTS ---
  useEffect(() => {
    if (initialEditItem) {
      handleEditTask(initialEditItem);
      if (onEditHandled) onEditHandled();
    }
  }, [initialEditItem]);

  // --- TASK LOGIC ---
  const resetTaskForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setTaskFormData({
      title: '', subjectId: subjects[0]?.id || '', type: 'homework', 
      date: new Date().toISOString().split('T')[0], time: '08:00', location: '', notes: '', resources: []
    });
  };

  const handleEditTask = (item: AcademicItem) => {
    setActiveTab('tasks');
    setTaskFormData({ ...item });
    setEditingId(item.id);
    setIsAdding(true);
    setTimeout(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, 50);
  };

  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const item: AcademicItem = {
      id: editingId || crypto.randomUUID(),
      title: taskFormData.title || 'Untitled',
      subjectId: taskFormData.subjectId || subjects[0]?.id || '',
      type: taskFormData.type as any,
      date: taskFormData.date || '',
      time: taskFormData.time || '08:00',
      location: taskFormData.location || '',
      notes: taskFormData.notes || '',
      resources: taskFormData.resources || []
    };

    try {
      if (editingId) {
        await supabaseService.updateAcademicItem(item);
        onUpdate({ items: items.map(i => i.id === editingId ? item : i) });
      } else {
        await supabaseService.createAcademicItem(item);
        onUpdate({ items: [item, ...items] });
      }
      resetTaskForm();
    } catch (err) {
      alert("Failed to save task.");
    }
  };

  const deleteTask = async (id: string) => {
    if (confirm('Delete permanently?')) {
      try {
        await supabaseService.deleteAcademicItem(id);
        onUpdate({ items: items.filter(i => i.id !== id) });
      } catch (err) {
        alert("Delete failed.");
      }
    }
  };

  // --- LESSON LOGIC ---
  const resetLessonForm = () => {
    setIsAddingLesson(false);
    setLessonFormData({
      title: '', subjectId: subjects[0]?.id || '', type: 'course',
      description: '', estimatedTime: '45 min', keywords: [], isPublished: true, fileUrl: ''
    });
    setKeywordInput('');
    setLessonFile(null);
  };

  const handleAddKeyword = () => {
    if (keywordInput.trim()) {
      setLessonFormData(prev => ({ ...prev, keywords: [...(prev.keywords || []), keywordInput.trim()] }));
      setKeywordInput('');
    }
  };

  const handleLessonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploadingLesson(true);
    
    try {
      let fileUrl = lessonFormData.fileUrl || '';
      if (lessonFile) {
        fileUrl = await supabaseService.uploadFile(lessonFile);
      } else if (!fileUrl) {
        alert("Please upload a document or provide a link.");
        setIsUploadingLesson(false);
        return;
      }

      const lesson: Lesson = {
        id: crypto.randomUUID(),
        title: lessonFormData.title || 'Untitled Lesson',
        subjectId: lessonFormData.subjectId || subjects[0]?.id || '',
        type: lessonFormData.type as any,
        description: lessonFormData.description || '',
        fileUrl,
        estimatedTime: lessonFormData.estimatedTime || '30 min',
        keywords: lessonFormData.keywords || [],
        isPublished: lessonFormData.isPublished || false,
        createdAt: new Date().toISOString()
      };

      await supabaseService.createLesson(lesson);
      // We need to fetch full state again to update the lessons list in App or pass a prop
      // Since props only have items, we trigger a full sync or optimistic update if we had lessons in props
      // For now, assume onUpdate supports lessons via partial AppState if we added it to AppState
      alert("Lesson uploaded successfully! It will appear in searches.");
      resetLessonForm();
    } catch (err) {
      console.error(err);
      alert("Failed to upload lesson.");
    } finally {
      setIsUploadingLesson(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">{t('management')}</h1>
          <p className="text-slate-500 font-bold mt-1">Control center for all classroom data.</p>
        </div>
        
        {/* Tab Switcher */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl">
           <button 
             onClick={() => setActiveTab('tasks')}
             className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'tasks' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
           >
             Tasks
           </button>
           <button 
             onClick={() => setActiveTab('lessons')}
             className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'lessons' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}
           >
             Lessons
           </button>
        </div>
      </div>

      {/* --- TASKS VIEW --- */}
      {activeTab === 'tasks' && (
        <div className="space-y-6">
          <div className="flex justify-end">
             <button 
               onClick={() => { if(isAdding) resetTaskForm(); else setIsAdding(true); }}
               className={`px-8 py-3 rounded-2xl font-black shadow-lg transition-all flex items-center gap-2 ${isAdding ? 'bg-rose-50 text-rose-600' : 'bg-indigo-600 text-white'}`}
             >
               {isAdding ? <><X size={18}/> {t('cancel')}</> : <><Plus size={18}/> {t('add')} Task</>}
             </button>
          </div>

          {isAdding && (
            <form ref={formRef} onSubmit={handleTaskSubmit} className="bg-white p-6 md:p-10 rounded-[3rem] border border-slate-100 shadow-xl space-y-8 animate-in slide-in-from-top-4">
               <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                 {editingId ? <Edit2 size={20} className="text-amber-500"/> : <Plus size={20} className="text-indigo-500"/>} 
                 {editingId ? 'Edit Task' : 'New Task'}
               </h2>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Title</label>
                    <input required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-sm" value={taskFormData.title} onChange={e => setTaskFormData({...taskFormData, title: e.target.value})} placeholder="e.g. Calculus Exam" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Subject</label>
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-sm" value={taskFormData.subjectId} onChange={e => setTaskFormData({...taskFormData, subjectId: e.target.value})}>
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.name[lang]}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('due')}</label>
                    <input type="date" required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-sm" value={taskFormData.date} onChange={e => setTaskFormData({...taskFormData, date: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('time')}</label>
                    <input type="time" required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-sm" value={taskFormData.time} onChange={e => setTaskFormData({...taskFormData, time: e.target.value})} />
                  </div>
               </div>
               
               <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</label>
                 <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                   {['exam', 'homework', 'event'].map(type => (
                     <button key={type} type="button" onClick={() => setTaskFormData({...taskFormData, type: type as any})} className={`flex-1 py-2 rounded-lg font-black text-[10px] uppercase transition-all ${taskFormData.type === type ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>{t(type)}</button>
                   ))}
                 </div>
               </div>

               <button type="submit" className={`w-full py-4 text-white font-black rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 ${editingId ? 'bg-amber-500' : 'bg-indigo-600'}`}>
                 <Save size={18}/> {editingId ? 'Update Task' : 'Create Task'}
               </button>
            </form>
          )}

          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Type</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Title</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Date</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.sort((a,b) => b.date.localeCompare(a.date)).map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 group transition-colors">
                    <td className="px-6 py-4"><span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md ${item.type === 'exam' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'}`}>{item.type}</span></td>
                    <td className="px-6 py-4 font-bold text-sm text-slate-900">{item.title}</td>
                    <td className="px-6 py-4 font-bold text-xs text-slate-500">{item.date}</td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                      <button onClick={() => handleEditTask(item)} className="p-2 text-slate-400 hover:text-amber-500"><Edit2 size={16}/></button>
                      <button onClick={() => deleteTask(item.id)} className="p-2 text-slate-400 hover:text-rose-500"><Trash2 size={16}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- LESSONS VIEW --- */}
      {activeTab === 'lessons' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-emerald-50 p-6 rounded-[2.5rem] border border-emerald-100">
             <div>
                <h3 className="font-black text-emerald-800 text-lg">Teacher's Knowledge Base</h3>
                <p className="text-emerald-600/70 text-xs font-bold mt-1 max-w-md">Upload lessons here. @Zay will read these and provide document-backed answers to students.</p>
             </div>
             <button 
               onClick={() => { if(isAddingLesson) resetLessonForm(); else setIsAddingLesson(true); }}
               className={`px-6 py-3 rounded-2xl font-black shadow-lg transition-all flex items-center gap-2 ${isAddingLesson ? 'bg-white text-slate-500' : 'bg-emerald-600 text-white'}`}
             >
               {isAddingLesson ? <><X size={18}/> Close</> : <><UploadCloud size={18}/> Upload Lesson</>}
             </button>
          </div>

          {isAddingLesson && (
            <form onSubmit={handleLessonSubmit} className="bg-white p-6 md:p-10 rounded-[3rem] border border-slate-100 shadow-xl space-y-8 animate-in slide-in-from-top-4 relative">
               {isUploadingLesson && (
                 <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center rounded-[3rem]">
                    <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
                    <p className="mt-4 font-black text-emerald-800 text-sm animate-pulse">Uploading & Indexing...</p>
                 </div>
               )}

               <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                 <BookOpen size={20} className="text-emerald-500"/> New Lesson Upload
               </h2>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lesson Title</label>
                    <input required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-sm" value={lessonFormData.title} onChange={e => setLessonFormData({...lessonFormData, title: e.target.value})} placeholder="e.g. Limits & Continuity Part 1" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Subject</label>
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-sm" value={lessonFormData.subjectId} onChange={e => setLessonFormData({...lessonFormData, subjectId: e.target.value})}>
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.name[lang]}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Est. Study Time</label>
                    <div className="relative">
                       <Clock3 size={16} className="absolute left-4 top-3.5 text-slate-400"/>
                       <input className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 font-bold text-sm" value={lessonFormData.estimatedTime} onChange={e => setLessonFormData({...lessonFormData, estimatedTime: e.target.value})} placeholder="e.g. 45 min" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</label>
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-sm" value={lessonFormData.type} onChange={e => setLessonFormData({...lessonFormData, type: e.target.value as any})}>
                      <option value="course">Full Course</option>
                      <option value="summary">Summary</option>
                      <option value="exercise">Exercises</option>
                      <option value="exam_prep">Exam Prep</option>
                    </select>
                  </div>
               </div>

               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description (Used by AI)</label>
                  <textarea required rows={3} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-sm resize-none" value={lessonFormData.description} onChange={e => setLessonFormData({...lessonFormData, description: e.target.value})} placeholder="Briefly explain what this lesson covers..." />
               </div>

               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Keywords (Press Enter)</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {lessonFormData.keywords?.map((k, i) => (
                      <span key={i} className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-1">
                        {k} <button type="button" onClick={() => setLessonFormData(prev => ({...prev, keywords: prev.keywords?.filter((_, idx) => idx !== i)}))}><X size={10}/></button>
                      </span>
                    ))}
                  </div>
                  <div className="relative">
                    <Tag size={16} className="absolute left-4 top-3.5 text-slate-400"/>
                    <input 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 font-bold text-sm" 
                      value={keywordInput}
                      onChange={e => setKeywordInput(e.target.value)}
                      onKeyDown={e => { if(e.key === 'Enter') { e.preventDefault(); handleAddKeyword(); }}}
                      placeholder="Add tag..."
                    />
                  </div>
               </div>

               <div className="p-6 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 text-center space-y-3">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm text-indigo-500"><FileUp size={24}/></div>
                  <div>
                    <p className="font-black text-slate-900 text-xs uppercase tracking-widest">Lesson Document</p>
                    <p className="text-[10px] font-bold text-slate-400">PDF, Images, or Slides</p>
                  </div>
                  <input type="file" required onChange={e => e.target.files?.[0] && setLessonFile(e.target.files[0])} className="text-xs font-bold text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/>
               </div>

               <div className="flex items-center gap-3">
                  <input type="checkbox" id="pub" className="w-5 h-5 accent-emerald-500" checked={lessonFormData.isPublished} onChange={e => setLessonFormData({...lessonFormData, isPublished: e.target.checked})} />
                  <label htmlFor="pub" className="text-xs font-black text-slate-700 cursor-pointer select-none">Publish Immediately</label>
               </div>

               <button type="submit" disabled={isUploadingLesson} className="w-full py-4 text-white font-black rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50">
                 <UploadCloud size={18}/> Upload & Index Lesson
               </button>
            </form>
          )}

          <div className="p-10 text-center border border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
             <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Lesson Library is stored in Cloud</p>
             <p className="text-[10px] font-bold text-slate-300 mt-1">To view or edit existing lessons, please use the Supabase Dashboard directly for now.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
