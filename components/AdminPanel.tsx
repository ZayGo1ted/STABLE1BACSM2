
import React, { useState, useEffect, useMemo } from 'react';
import { AcademicItem, Subject, AppState, Lesson, AiLog, LessonAttachment } from '../types';
import { useAuth } from '../AuthContext';
import { supabaseService } from '../services/supabaseService';
import { 
  Plus, Edit2, X, UploadCloud, Save, CheckCircle, RefreshCw, 
  Book, Calendar, Brain, Trash2, AlertCircle, Search, 
  ArrowUp, ArrowDown, File as FileIcon, Image as ImageIcon, Video
} from 'lucide-react';
import { SUBJECT_ICONS } from '../constants';

interface Props {
  items: AcademicItem[];
  subjects: Subject[];
  onUpdate: (updates: Partial<AppState>) => void;
  initialEditItem?: AcademicItem | null;
  initialEditLesson?: Lesson | null;
  onEditHandled?: () => void;
}

// Helper type for managing files before they are uploaded
interface StagedAttachment {
  id: string; // Temp ID for React keys
  file?: File; // Present if it's a new upload
  url: string; // Blob URL for preview (new) or Remote URL (existing)
  name: string;
  type: 'image' | 'video' | 'file';
  isExisting: boolean;
}

const AdminPanel: React.FC<Props> = ({ items, subjects, onUpdate, initialEditItem, initialEditLesson, onEditHandled }) => {
  const { t, lang } = useAuth();
  const [activeTab, setActiveTab] = useState<'tasks' | 'lessons' | 'logs'>('tasks');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Tasks State
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [taskFormData, setTaskFormData] = useState<Partial<AcademicItem>>({
    title: '', subjectId: subjects[0]?.id || '', type: 'homework',
    date: new Date().toISOString().split('T')[0], time: '08:00', location: '', notes: '', resources: []
  });

  // Lessons State
  const [isLessonFormOpen, setIsLessonFormOpen] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [lessonFormData, setLessonFormData] = useState<Partial<Lesson>>({
    title: '', subjectId: subjects[0]?.id || '', type: 'lesson',
    description: '', aiMetadata: '', keywords: [], isPublished: true,
    date: new Date().toISOString().split('T')[0], startTime: '08:00', endTime: '10:00'
  });
  
  // New Staging State for Files
  const [stagedAttachments, setStagedAttachments] = useState<StagedAttachment[]>([]);
  const [isUploadingLesson, setIsUploadingLesson] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Logs State
  const [logs, setLogs] = useState<AiLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Initialize from Props (Deep Linking)
  useEffect(() => {
    if (initialEditItem) {
      setActiveTab('tasks');
      setTaskFormData({ ...initialEditItem });
      setEditingId(initialEditItem.id);
      setIsTaskFormOpen(true);
      if (onEditHandled) onEditHandled();
    }
    if (initialEditLesson) {
      setActiveTab('lessons');
      loadLessonForEdit(initialEditLesson);
      if (onEditHandled) onEditHandled();
    }
  }, [initialEditItem, initialEditLesson]);

  // --- Helpers ---

  const filteredTasks = useMemo(() => {
    return items
        .filter(i => i.title.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [items, searchTerm]);

  const resetTaskForm = () => {
    setEditingId(null);
    setTaskFormData({ title: '', subjectId: subjects[0]?.id || '', type: 'homework', date: new Date().toISOString().split('T')[0], time: '08:00', location: '', notes: '', resources: [] });
    setIsTaskFormOpen(false);
  };

  const resetLessonForm = () => {
    setEditingLessonId(null);
    setLessonFormData({ title: '', subjectId: subjects[0]?.id || '', type: 'lesson', description: '', aiMetadata: '', keywords: [], isPublished: true, date: new Date().toISOString().split('T')[0], startTime: '08:00', endTime: '10:00' });
    setStagedAttachments([]);
    setUploadError(null);
    setUploadProgress('');
    setIsLessonFormOpen(false);
  };

  const loadLessonForEdit = (lesson: Lesson) => {
    setEditingLessonId(lesson.id);
    setLessonFormData({ ...lesson });
    
    // Convert existing attachments to staged format
    const existing = (lesson.attachments || []).map((att, idx) => ({
        id: `existing-${idx}`,
        url: att.url,
        name: att.name,
        type: att.type,
        isExisting: true
    }));
    setStagedAttachments(existing);
    setIsLessonFormOpen(true);
  };

  // --- Handlers ---

  const handleTaskDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm(t('delete_confirm'))) return;
    try {
        await supabaseService.deleteAcademicItem(id);
        onUpdate({ items: items.filter(i => i.id !== id) });
    } catch(e) { alert("Delete failed"); }
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
    } catch (err) { alert("Error saving task."); }
  };

  // --- Lesson File Handling ---

  const handleFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        const newFiles = Array.from(e.target.files).map(file => ({
            id: `new-${crypto.randomUUID()}`,
            file: file,
            url: URL.createObjectURL(file), // Create local preview URL
            name: file.name,
            type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file',
            isExisting: false
        } as StagedAttachment));
        
        setStagedAttachments(prev => [...prev, ...newFiles]);
    }
  };

  const removeAttachment = (id: string) => {
    setStagedAttachments(prev => prev.filter(a => a.id !== id));
  };

  const moveAttachment = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= stagedAttachments.length) return;
    
    setStagedAttachments(prev => {
        const copy = [...prev];
        const [removed] = copy.splice(index, 1);
        copy.splice(newIndex, 0, removed);
        return copy;
    });
  };

  const handleLessonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonFormData.title) return;
    
    setIsUploadingLesson(true);
    setUploadError(null);
    setUploadProgress(t('upload_start') || 'Preparing...');

    try {
        const finalAttachments: LessonAttachment[] = [];
        
        // Process attachments sequentially to prevent memory crash on mobile
        for (let i = 0; i < stagedAttachments.length; i++) {
            const item = stagedAttachments[i];
            
            if (item.isExisting) {
                // Keep existing attachment
                finalAttachments.push({ name: item.name, url: item.url, type: item.type });
            } else if (item.file) {
                // Upload new file
                setUploadProgress(`${t('uploading') || 'Uploading'} ${i + 1}/${stagedAttachments.length}: ${item.name}...`);
                const publicUrl = await supabaseService.uploadFile(item.file);
                finalAttachments.push({ name: item.name, url: publicUrl, type: item.type });
            }
        }

        setUploadProgress('Finalizing...');

        const lesson: Lesson = {
            id: editingLessonId || crypto.randomUUID(),
            title: lessonFormData.title || 'Untitled',
            subjectId: lessonFormData.subjectId || subjects[0]?.id || '',
            type: lessonFormData.type as any,
            description: lessonFormData.description || '',
            aiMetadata: lessonFormData.aiMetadata || '',
            attachments: finalAttachments,
            date: lessonFormData.date || '',
            startTime: lessonFormData.startTime || '',
            endTime: lessonFormData.endTime || '',
            keywords: lessonFormData.keywords || [],
            isPublished: lessonFormData.isPublished !== false,
            createdAt: editingLessonId ? (lessonFormData.createdAt || new Date().toISOString()) : new Date().toISOString()
        };

        if (editingLessonId) {
            await supabaseService.updateLesson(lesson);
            // Optimistic update without reload
            // But we need to update the parent state properly
            // Ideally fetchFullState or manual merge
            const { lessons } = await supabaseService.fetchFullState(); // Fetch fresh to be safe or just local merge
            onUpdate({ lessons: lessons });
        } else {
            await supabaseService.createLesson(lesson);
            const { lessons } = await supabaseService.fetchFullState();
            onUpdate({ lessons: lessons });
        }

        resetLessonForm();
        alert(t('upload_success'));
        
    } catch (err: any) {
        console.error(err);
        setUploadError(err.message || "Upload Failed");
    } finally {
        setIsUploadingLesson(false);
        setUploadProgress('');
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
        const fetched = await supabaseService.fetchAiLogs();
        setLogs(fetched);
    } catch(e) {}
    setLoadingLogs(false);
  };
  useEffect(() => { if (activeTab === 'logs') fetchLogs(); }, [activeTab]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* Header Tabs */}
      <div className="bg-white p-2 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between sticky top-0 z-20">
        <div className="flex gap-1 overflow-x-auto hide-scrollbar w-full">
            {[
                { id: 'tasks', label: t('tasks_homework'), icon: <Calendar size={16}/>, color: 'indigo' },
                { id: 'lessons', label: t('lessons_lib'), icon: <Book size={16}/>, color: 'emerald' },
                { id: 'logs', label: t('ai_reports'), icon: <Brain size={16}/>, color: 'rose' }
            ].map(tab => (
                <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 min-w-[120px] px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === tab.id 
                        ? `bg-${tab.color}-600 text-white shadow-md` 
                        : 'text-slate-400 hover:bg-slate-50'}`}
                >
                    {tab.icon} {tab.label}
                </button>
            ))}
        </div>
      </div>

      {/* --- TASKS TAB --- */}
      {activeTab === 'tasks' && (
        <div className="space-y-6">
            {!isTaskFormOpen ? (
                <>
                    {/* Toolbar */}
                    <div className="flex gap-3">
                        <div className="relative flex-1">
                            <Search size={18} className="absolute left-4 top-3.5 text-slate-400" />
                            <input 
                                className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-3 font-bold text-sm outline-none focus:border-indigo-500 transition-all"
                                placeholder={t('search_tasks')}
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button onClick={() => { resetTaskForm(); setIsTaskFormOpen(true); }} className="bg-indigo-600 text-white px-5 rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center">
                            <Plus size={24} />
                        </button>
                    </div>

                    {/* List */}
                    <div className="space-y-3">
                        {filteredTasks.length === 0 ? (
                            <div className="text-center py-20 opacity-50">
                                <p className="font-black text-slate-300 text-xs uppercase tracking-widest">{t('no_results')}</p>
                            </div>
                        ) : (
                            filteredTasks.map(item => {
                                const subj = subjects.find(s => s.id === item.subjectId);
                                const isExam = item.type === 'exam';
                                return (
                                    <div key={item.id} className="bg-white p-4 rounded-[1.5rem] border border-slate-100 shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-all">
                                        <div className="flex items-center gap-4 overflow-hidden">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0 ${subj?.color}`}>
                                                {SUBJECT_ICONS[item.subjectId]}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md ${isExam ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>{t(item.type)}</span>
                                                    <span className="text-[10px] font-bold text-slate-400">{item.date}</span>
                                                </div>
                                                <h3 className="font-black text-slate-900 text-sm truncate">{item.title}</h3>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => { setTaskFormData({...item}); setEditingId(item.id); setIsTaskFormOpen(true); }} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={(e) => handleTaskDelete(e, item.id)} className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </>
            ) : (
                /* Edit/Create Form */
                <div className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-xl animate-in slide-in-from-bottom-10">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-black text-slate-900">{editingId ? t('edit_item') : t('new_item')}</h2>
                        <button onClick={resetTaskForm} className="p-2 bg-slate-50 rounded-full hover:bg-slate-100 transition-colors"><X size={20}/></button>
                    </div>
                    <form onSubmit={handleTaskSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{t('title')}</label>
                                <input required className="w-full bg-slate-50 border-slate-200 border rounded-xl px-4 py-3 font-bold text-sm outline-none focus:border-indigo-500" value={taskFormData.title} onChange={e => setTaskFormData({...taskFormData, title: e.target.value})} placeholder={t('placeholder_title')}/>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{t('type')}</label>
                                <select className="w-full bg-slate-50 border-slate-200 border rounded-xl px-4 py-3 font-bold text-sm outline-none focus:border-indigo-500" value={taskFormData.type} onChange={e => setTaskFormData({...taskFormData, type: e.target.value as any})}>
                                    {['homework', 'exam', 'event', 'task'].map(type => <option key={type} value={type}>{t(type).toUpperCase()}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{t('subject')}</label>
                                <select className="w-full bg-slate-50 border-slate-200 border rounded-xl px-4 py-3 font-bold text-sm outline-none focus:border-indigo-500" value={taskFormData.subjectId} onChange={e => setTaskFormData({...taskFormData, subjectId: e.target.value})}>
                                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name[lang]}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{t('date')}</label>
                                <input type="date" required className="w-full bg-slate-50 border-slate-200 border rounded-xl px-4 py-3 font-bold text-sm outline-none focus:border-indigo-500" value={taskFormData.date} onChange={e => setTaskFormData({...taskFormData, date: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{t('time')}</label>
                                <input type="time" className="w-full bg-slate-50 border-slate-200 border rounded-xl px-4 py-3 font-bold text-sm outline-none focus:border-indigo-500" value={taskFormData.time} onChange={e => setTaskFormData({...taskFormData, time: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{t('location')}</label>
                                <input className="w-full bg-slate-50 border-slate-200 border rounded-xl px-4 py-3 font-bold text-sm outline-none focus:border-indigo-500" value={taskFormData.location} onChange={e => setTaskFormData({...taskFormData, location: e.target.value})} placeholder={t('room')}/>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{t('notes')}</label>
                            <textarea className="w-full bg-slate-50 border-slate-200 border rounded-xl px-4 py-3 font-bold text-sm outline-none focus:border-indigo-500 min-h-[100px]" value={taskFormData.notes} onChange={e => setTaskFormData({...taskFormData, notes: e.target.value})} placeholder={t('placeholder_notes')}/>
                        </div>
                        
                        <div className="pt-2">
                             <button type="submit" className="w-full py-4 text-white font-black rounded-2xl shadow-lg bg-indigo-600 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                                <Save size={20} />
                                {editingId ? t('save') : t('add')}
                             </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
      )}

      {/* --- LESSONS TAB --- */}
      {activeTab === 'lessons' && (
        <div className="space-y-6">
            {!isLessonFormOpen ? (
                 <button onClick={() => { resetLessonForm(); setIsLessonFormOpen(true); }} className="w-full py-8 border-2 border-dashed border-emerald-300 bg-emerald-50 rounded-[2rem] text-emerald-600 font-black uppercase tracking-widest hover:bg-emerald-100 transition-all flex flex-col items-center gap-2">
                    <UploadCloud size={32} />
                    {t('upload_new')}
                 </button>
            ) : (
                <div className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-xl animate-in slide-in-from-bottom-10">
                   <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-black text-slate-900">{editingLessonId ? t('edit_item') : t('upload_new')}</h2>
                        <button onClick={resetLessonForm} className="p-2 bg-slate-50 rounded-full hover:bg-slate-100 transition-colors"><X size={20}/></button>
                   </div>
                   {uploadError && (
                     <div className="p-4 bg-rose-50 border-2 border-rose-100 rounded-2xl flex items-start gap-3 mb-6 animate-in fade-in">
                       <AlertCircle className="text-rose-600 shrink-0" size={20} />
                       <div className="space-y-1">
                         <p className="text-rose-900 font-black text-xs uppercase tracking-tight">{t('upload_fail')}</p>
                         <p className="text-rose-700 text-xs font-bold leading-relaxed">{uploadError}</p>
                       </div>
                     </div>
                   )}

                   <form onSubmit={handleLessonSubmit} className="space-y-6">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                             <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{t('title')}</label>
                             <input required className="w-full bg-slate-50 border-slate-200 border rounded-xl px-4 py-3 font-bold text-sm outline-none focus:border-emerald-500" value={lessonFormData.title} onChange={e => setLessonFormData({...lessonFormData, title: e.target.value})} />
                          </div>
                          <div className="space-y-1">
                             <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{t('subject')}</label>
                             <select className="w-full bg-slate-50 border-slate-200 border rounded-xl px-4 py-3 font-bold text-sm outline-none focus:border-emerald-500" value={lessonFormData.subjectId} onChange={e => setLessonFormData({...lessonFormData, subjectId: e.target.value})}>
                                 {subjects.map(s => <option key={s.id} value={s.id}>{s.name[lang]}</option>)}
                             </select>
                          </div>
                          <div className="space-y-1">
                             <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{t('type')}</label>
                             <select className="w-full bg-slate-50 border-slate-200 border rounded-xl px-4 py-3 font-bold text-sm outline-none focus:border-emerald-500" value={lessonFormData.type} onChange={e => setLessonFormData({...lessonFormData, type: e.target.value as any})}>
                                 <option value="lesson">Lesson</option><option value="summary">Summary</option><option value="exercise">Exercise</option><option value="exam_prep">Exam Prep</option>
                             </select>
                          </div>
                          <div className="space-y-1">
                             <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{t('date')}</label>
                             <input type="date" className="w-full bg-slate-50 border-slate-200 border rounded-xl px-4 py-3 font-bold text-sm outline-none focus:border-emerald-500" value={lessonFormData.date} onChange={e => setLessonFormData({...lessonFormData, date: e.target.value})} />
                          </div>
                       </div>
                       
                       <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{t('description')}</label>
                          <textarea className="w-full bg-slate-50 border-slate-200 border rounded-xl px-4 py-3 font-bold text-sm outline-none focus:border-emerald-500 min-h-[100px]" value={lessonFormData.description} onChange={e => setLessonFormData({...lessonFormData, description: e.target.value})} />
                       </div>

                       {/* File Staging & Reordering */}
                       <div className="space-y-2">
                          <div className="flex justify-between items-end">
                              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{t('attachments')}</label>
                              <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">{stagedAttachments.length} files</span>
                          </div>
                          
                          <div className="space-y-2">
                             {stagedAttachments.map((att, i) => (
                                <div key={att.id} className="flex items-center gap-3 p-2 bg-slate-50 rounded-xl border border-slate-200 group animate-in slide-in-from-left-2">
                                   {/* Order Controls */}
                                   <div className="flex flex-col gap-1">
                                       <button type="button" onClick={() => moveAttachment(i, 'up')} disabled={i === 0} className="p-1 rounded bg-white hover:bg-slate-200 text-slate-400 hover:text-slate-600 disabled:opacity-20"><ArrowUp size={10} /></button>
                                       <button type="button" onClick={() => moveAttachment(i, 'down')} disabled={i === stagedAttachments.length - 1} className="p-1 rounded bg-white hover:bg-slate-200 text-slate-400 hover:text-slate-600 disabled:opacity-20"><ArrowDown size={10} /></button>
                                   </div>
                                   
                                   {/* Preview */}
                                   <div className="w-12 h-12 shrink-0 bg-white rounded-lg border border-slate-100 flex items-center justify-center overflow-hidden">
                                       {att.type === 'image' ? (
                                           <img src={att.url} alt="preview" className="w-full h-full object-cover" />
                                       ) : att.type === 'video' ? (
                                           <Video size={20} className="text-slate-400"/>
                                       ) : (
                                           <FileIcon size={20} className="text-slate-400"/>
                                       )}
                                   </div>

                                   {/* Info */}
                                   <div className="min-w-0 flex-1">
                                       <p className="text-xs font-black text-slate-700 truncate">{att.name}</p>
                                       <div className="flex gap-2">
                                           <span className={`text-[8px] uppercase font-bold px-1 rounded ${att.isExisting ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                               {att.isExisting ? 'Saved' : 'New'}
                                           </span>
                                           <span className="text-[8px] uppercase font-bold text-slate-400">{att.type}</span>
                                       </div>
                                   </div>

                                   {/* Remove */}
                                   <button type="button" onClick={() => removeAttachment(att.id)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                </div>
                             ))}

                             {/* Add Button */}
                             <div className="p-6 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 text-center hover:bg-slate-100 transition-colors cursor-pointer relative">
                                <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFilesSelect} />
                                <div className="pointer-events-none">
                                    <UploadCloud className="mx-auto text-slate-400 mb-2" />
                                    <p className="text-[10px] font-black text-slate-400 uppercase">{t('click_upload')}</p>
                                </div>
                             </div>
                          </div>
                       </div>

                       {/* Upload Status / Button */}
                       <div className="space-y-2">
                           {isUploadingLesson && (
                               <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center gap-3 animate-pulse">
                                   <RefreshCw className="animate-spin text-emerald-600" size={16} />
                                   <span className="text-xs font-bold text-emerald-700">{uploadProgress}</span>
                               </div>
                           )}
                           
                           <button type="submit" disabled={isUploadingLesson} className="w-full py-4 text-white font-black rounded-2xl shadow-lg bg-emerald-600 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                              {isUploadingLesson ? <RefreshCw className="animate-spin" size={20}/> : <Save size={20} />}
                              {isUploadingLesson ? 'Processing...' : t('save')}
                           </button>
                       </div>
                   </form>
                </div>
            )}
            
            <div className="bg-emerald-50 p-6 rounded-[2rem] border border-emerald-100">
                <h3 className="text-emerald-800 font-black text-sm uppercase tracking-widest mb-4">{t('recent_uploads')}</h3>
                <div className="space-y-2">
                    <p className="text-emerald-600/70 text-xs italic">{t('access_materials')}</p>
                </div>
            </div>
        </div>
      )}

      {/* --- LOGS TAB --- */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
             <div className="flex justify-between items-center px-4 bg-white py-3 rounded-2xl border">
                <p className="text-slate-500 font-black text-sm uppercase tracking-widest">{t('unresolved_failures')} ({logs.filter(l => l.status === 'unresolved').length})</p>
                <button onClick={fetchLogs} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"><RefreshCw size={16} className={loadingLogs ? "animate-spin" : ""} /></button>
            </div>
            {logs.length === 0 ? <div className="p-20 text-center bg-white rounded-[3rem] border border-dashed"><Brain size={48} className="mx-auto text-slate-100 mb-4"/><p className="text-slate-300 font-black uppercase tracking-widest">{t('all_resolved')}</p></div> : (
                <div className="grid gap-3">
                    {logs.map(log => (
                        <div key={log.id} className={`bg-white p-5 rounded-[2rem] border-2 flex items-center justify-between transition-all ${log.status === 'resolved' ? 'opacity-40 grayscale' : 'border-rose-100 hover:border-rose-300 shadow-sm'}`}>
                            <div className="min-w-0 flex-1 pr-4">
                                <h5 className="font-black text-slate-900 text-sm mb-1 leading-tight">"{log.query}"</h5>
                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                                  <span className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-600">{log.userName}</span>
                                  <span>•</span>
                                  <span>{new Date(log.createdAt).toLocaleString()}</span>
                                </div>
                            </div>
                            {log.status === 'unresolved' ? (
                                <button onClick={() => { supabaseService.resolveLog(log.id); setLogs(logs.map(l => l.id === log.id ? {...l, status: 'resolved'} : l)); }} className="shrink-0 px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all">{t('mark_done')}</button>
                            ) : <CheckCircle size={24} className="text-emerald-500 shrink-0" />}
                        </div>
                    ))}
                </div>
            )}
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
