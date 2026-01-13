
import React, { useState, useRef, useEffect } from 'react';
import { AcademicItem, Subject, AppState, Lesson, AiLog, LessonAttachment } from '../types';
import { useAuth } from '../AuthContext';
import { supabaseService } from '../services/supabaseService';
import { Plus, Edit2, X, UploadCloud, Save, CheckCircle, RefreshCw, Book, Calendar, Brain, Trash2, File as FileIcon, AlertCircle } from 'lucide-react';

interface Props {
  items: AcademicItem[];
  subjects: Subject[];
  onUpdate: (updates: Partial<AppState>) => void;
  initialEditItem?: AcademicItem | null;
  initialEditLesson?: Lesson | null;
  onEditHandled?: () => void;
}

const AdminPanel: React.FC<Props> = ({ items, subjects, onUpdate, initialEditItem, initialEditLesson, onEditHandled }) => {
  const { t, lang } = useAuth();
  const [activeTab, setActiveTab] = useState<'tasks' | 'lessons' | 'logs'>('tasks');
  
  // Tasks
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [taskFormData, setTaskFormData] = useState<Partial<AcademicItem>>({
    title: '', subjectId: subjects[0]?.id || '', type: 'homework',
    date: new Date().toISOString().split('T')[0], time: '08:00', location: '', notes: '', resources: []
  });

  // Lessons
  const [isAddingLesson, setIsAddingLesson] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [lessonFormData, setLessonFormData] = useState<Partial<Lesson>>({
    title: '', subjectId: subjects[0]?.id || '', type: 'lesson',
    description: '', aiMetadata: '', keywords: [], isPublished: true, attachments: [],
    date: new Date().toISOString().split('T')[0], startTime: '08:00', endTime: '10:00'
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploadingLesson, setIsUploadingLesson] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Logs
  const [logs, setLogs] = useState<AiLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    if (initialEditItem) {
      setActiveTab('tasks');
      setTaskFormData({ ...initialEditItem });
      setEditingId(initialEditItem.id);
      setIsAdding(true);
      if (onEditHandled) onEditHandled();
    }
    if (initialEditLesson) {
      setActiveTab('lessons');
      setLessonFormData({ ...initialEditLesson });
      setEditingLessonId(initialEditLesson.id);
      setIsAddingLesson(true);
      if (onEditHandled) onEditHandled();
    }
  }, [initialEditItem, initialEditLesson]);

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
        const fetched = await supabaseService.fetchAiLogs();
        setLogs(fetched);
    } catch(e) {}
    setLoadingLogs(false);
  };

  useEffect(() => { if (activeTab === 'logs') fetchLogs(); }, [activeTab]);

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
      setIsAdding(false);
      setEditingId(null);
    } catch (err) { alert("Error saving task."); }
  };

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(prev => [...prev, ...Array.from(e.target.files || [])]);
      setUploadError(null);
    }
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingAttachment = (index: number) => {
    setLessonFormData(prev => ({
      ...prev,
      attachments: prev.attachments?.filter((_, i) => i !== index)
    }));
  };

  const handleLessonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploadingLesson(true);
    setUploadError(null);
    try {
      const newAttachments: LessonAttachment[] = [];
      for (const file of selectedFiles) {
        try {
          const url = await supabaseService.uploadFile(file);
          const type = file.type.startsWith('image') ? 'image' : file.type.startsWith('video') ? 'video' : 'file';
          newAttachments.push({ name: file.name, url, type });
        } catch (uploadErr: any) {
          setUploadError(`Failed to upload "${file.name}": ${uploadErr.message}`);
          setIsUploadingLesson(false);
          return;
        }
      }

      const finalAttachments = [...(lessonFormData.attachments || []), ...newAttachments];
      
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
      } else {
        await supabaseService.createLesson(lesson);
      }
      
      alert(t('upload_success'));
      window.location.reload(); 
    } catch (err: any) { 
        setUploadError("Action Failed: " + err.message); 
    } finally { setIsUploadingLesson(false); }
  };

  const handleResolveLog = async (id: string) => {
    await supabaseService.resolveLog(id);
    setLogs(logs.map(l => l.id === id ? { ...l, status: 'resolved' } : l));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-12">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <h1 className="text-3xl font-black text-slate-900">{t('management')}</h1>
        <div className="flex bg-slate-100 p-1.5 rounded-2xl overflow-x-auto">
           <button onClick={() => setActiveTab('tasks')} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'tasks' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}><Calendar size={14}/> Tasks</button>
           <button onClick={() => setActiveTab('lessons')} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'lessons' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}><Book size={14}/> Lessons</button>
           <button onClick={() => setActiveTab('logs')} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'logs' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}><Brain size={14}/> Logs</button>
        </div>
      </div>

      {activeTab === 'tasks' && (
        <div className="space-y-6">
          <div className="flex justify-end">
             <button onClick={() => { setIsAdding(!isAdding); setEditingId(null); setTaskFormData({ title: '', subjectId: subjects[0]?.id || '', type: 'homework', date: new Date().toISOString().split('T')[0], time: '08:00', location: '', notes: '', resources: [] }); }} className={`px-8 py-3 rounded-2xl font-black shadow-lg transition-all flex items-center gap-2 ${isAdding ? 'bg-rose-50 text-rose-600' : 'bg-indigo-600 text-white'}`}>
               {isAdding ? <><X size={18}/> {t('cancel')}</> : <><Plus size={18}/> {t('add')} Task</>}
             </button>
          </div>
          {isAdding && (
            <form onSubmit={handleTaskSubmit} className="bg-white p-6 rounded-[3rem] border border-slate-100 shadow-xl space-y-8">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Title</label><input required className="w-full bg-slate-50 border rounded-xl px-4 py-3 font-bold text-sm" value={taskFormData.title} onChange={e => setTaskFormData({...taskFormData, title: e.target.value})} /></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Type</label><select className="w-full bg-slate-50 border rounded-xl px-4 py-3 font-bold text-sm" value={taskFormData.type} onChange={e => setTaskFormData({...taskFormData, type: e.target.value as any})}><option value="homework">Homework</option><option value="exam">Exam</option><option value="event">Event</option><option value="task">Task</option></select></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Subject</label><select className="w-full bg-slate-50 border rounded-xl px-4 py-3 font-bold text-sm" value={taskFormData.subjectId} onChange={e => setTaskFormData({...taskFormData, subjectId: e.target.value})}>{subjects.map(s => <option key={s.id} value={s.id}>{s.name[lang]}</option>)}</select></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Date</label><input type="date" required className="w-full bg-slate-50 border rounded-xl px-4 py-3 font-bold text-sm" value={taskFormData.date} onChange={e => setTaskFormData({...taskFormData, date: e.target.value})} /></div>
               </div>
               <button type="submit" className="w-full py-4 text-white font-black rounded-2xl shadow-lg bg-indigo-600"><Save size={18} className="inline mr-2"/> {editingId ? 'Update' : 'Save'}</button>
            </form>
          )}
        </div>
      )}

      {activeTab === 'lessons' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-emerald-50 p-6 rounded-[2.5rem]">
             <h3 className="font-black text-emerald-800 text-lg">Class Library Management</h3>
             <button onClick={() => { setIsAddingLesson(!isAddingLesson); setEditingLessonId(null); setLessonFormData({ title: '', subjectId: subjects[0]?.id || '', type: 'lesson', description: '', aiMetadata: '', keywords: [], isPublished: true, attachments: [], date: new Date().toISOString().split('T')[0], startTime: '08:00', endTime: '10:00' }); setSelectedFiles([]); setUploadError(null); }} className={`px-6 py-3 rounded-2xl font-black shadow-lg flex items-center gap-2 ${isAddingLesson ? 'bg-white text-slate-500' : 'bg-emerald-600 text-white'}`}>{isAddingLesson ? 'Close Form' : 'New Lesson Entry'}</button>
          </div>
          {isAddingLesson && (
            <form onSubmit={handleLessonSubmit} className="bg-white p-6 rounded-[3rem] border border-slate-100 shadow-xl space-y-8">
               <div className="flex justify-between items-center border-b pb-4">
                  <h4 className="text-xl font-black text-slate-900">{editingLessonId ? 'Modify Existing Lesson' : 'Add New Resource'}</h4>
               </div>

               {uploadError && (
                 <div className="p-4 bg-rose-50 border-2 border-rose-100 rounded-2xl flex items-start gap-3">
                   <AlertCircle className="text-rose-600 shrink-0" size={20} />
                   <div className="space-y-1">
                     <p className="text-rose-900 font-black text-xs uppercase tracking-tight">Upload Failed</p>
                     <p className="text-rose-700 text-xs font-bold leading-relaxed">{uploadError}</p>
                     <p className="text-rose-500 text-[9px] font-black uppercase mt-2">Check your Supabase Storage RLS policies for the 'lessons' bucket.</p>
                   </div>
                 </div>
               )}

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Lesson Title</label><input required className="w-full bg-slate-50 border rounded-xl px-4 py-3 font-bold text-sm" value={lessonFormData.title} onChange={e => setLessonFormData({...lessonFormData, title: e.target.value})} /></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Subject</label><select className="w-full bg-slate-50 border rounded-xl px-4 py-3 font-bold text-sm" value={lessonFormData.subjectId} onChange={e => setLessonFormData({...lessonFormData, subjectId: e.target.value})}>{subjects.map(s => <option key={s.id} value={s.id}>{s.name[lang]}</option>)}</select></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Category</label><select className="w-full bg-slate-50 border rounded-xl px-4 py-3 font-bold text-sm" value={lessonFormData.type} onChange={e => setLessonFormData({...lessonFormData, type: e.target.value as any})}><option value="lesson">Lesson</option><option value="summary">Summary</option><option value="exercise">Exercise</option><option value="exam_prep">Exam Prep</option></select></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Date Written</label><input type="date" required className="w-full bg-slate-50 border rounded-xl px-4 py-3 font-bold text-sm" value={lessonFormData.date} onChange={e => setLessonFormData({...lessonFormData, date: e.target.value})} /></div>
               </div>
               
               <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">From</label><input type="time" className="w-full bg-white border rounded-xl px-4 py-2 font-bold text-sm" value={lessonFormData.startTime} onChange={e => setLessonFormData({...lessonFormData, startTime: e.target.value})} /></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">To</label><input type="time" className="w-full bg-white border rounded-xl px-4 py-2 font-bold text-sm" value={lessonFormData.endTime} onChange={e => setLessonFormData({...lessonFormData, endTime: e.target.value})} /></div>
               </div>

               <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Public Description (Schedule/Parts)</label><textarea required className="w-full bg-slate-50 border rounded-2xl px-4 py-3 font-bold text-sm min-h-[100px]" value={lessonFormData.description} onChange={e => setLessonFormData({...lessonFormData, description: e.target.value})} placeholder="What was covered? Any missing parts to be finished later?" /></div>
               <div className="space-y-2"><label className="text-[10px] font-black text-indigo-400 uppercase">AI Hidden Metadata (Not shown to students)</label><textarea className="w-full bg-indigo-50/50 border-indigo-100 border rounded-2xl px-4 py-3 font-bold text-sm text-indigo-900" value={lessonFormData.aiMetadata} onChange={e => setLessonFormData({...lessonFormData, aiMetadata: e.target.value})} placeholder="Secret keywords or context for Zay AI..." /></div>
               
               <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Current & New Files</label>
                  <div className="grid gap-2">
                    {/* Existing Files */}
                    {(lessonFormData.attachments || []).map((att, i) => (
                      <div key={`exist-${i}`} className="flex items-center justify-between p-3 bg-white rounded-xl border-2 border-slate-100 shadow-sm">
                        <div className="flex items-center gap-3 truncate">
                          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><FileIcon size={14}/></div>
                          <span className="text-xs font-bold text-slate-700 truncate">{att.name}</span>
                        </div>
                        <button type="button" onClick={() => removeExistingAttachment(i)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 size={16}/></button>
                      </div>
                    ))}
                    
                    {/* Selected Files to Upload */}
                    {selectedFiles.map((f, i) => (
                      <div key={`new-${i}`} className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border-2 border-emerald-100 shadow-sm">
                        <div className="flex items-center gap-3 truncate">
                          <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><UploadCloud size={14}/></div>
                          <span className="text-xs font-bold text-emerald-700 truncate">{f.name} (Waiting)</span>
                        </div>
                        <button type="button" onClick={() => removeSelectedFile(i)} className="p-2 text-emerald-500"><X size={16}/></button>
                      </div>
                    ))}
                  </div>

                  <div className="p-8 border-4 border-dashed rounded-[2rem] bg-slate-50 text-center hover:bg-slate-100 transition-all cursor-pointer">
                    <label className="cursor-pointer block">
                        <UploadCloud size={40} className="mx-auto text-slate-400 mb-3"/>
                        <p className="text-slate-500 font-black text-xs uppercase tracking-[0.2em]">Select Multi-Files</p>
                        <input type="file" multiple className="hidden" onChange={handleFileSelection} />
                    </label>
                  </div>
               </div>

               <button type="submit" disabled={isUploadingLesson} className="w-full py-5 text-white font-black rounded-[1.5rem] shadow-xl bg-emerald-600 hover:bg-emerald-700 transition-all disabled:opacity-50 text-lg">
                  {isUploadingLesson ? <span className="flex items-center justify-center gap-3"><RefreshCw size={20} className="animate-spin"/> Syncing Cloud...</span> : (editingLessonId ? 'Update Lesson Library' : 'Publish to Library')}
               </button>
            </form>
          )}
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="space-y-4">
            <div className="flex justify-between items-center px-4 bg-white py-3 rounded-2xl border">
                <p className="text-slate-500 font-black text-sm uppercase tracking-widest">Unresolved AI Failures ({logs.filter(l => l.status === 'unresolved').length})</p>
                <button onClick={fetchLogs} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"><RefreshCw size={16} className={loadingLogs ? "animate-spin" : ""} /></button>
            </div>
            {logs.length === 0 ? <div className="p-20 text-center bg-white rounded-[3rem] border border-dashed"><Brain size={48} className="mx-auto text-slate-100 mb-4"/><p className="text-slate-300 font-black uppercase tracking-widest">All AI requests satisfied.</p></div> : (
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
                                <button onClick={() => handleResolveLog(log.id)} className="shrink-0 px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all">Mark as Uploaded</button>
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
