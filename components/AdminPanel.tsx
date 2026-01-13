import React, { useState, useRef, useEffect } from 'react';
import { AcademicItem, Subject, AppState, Lesson, AiLog } from '../types';
import { useAuth } from '../AuthContext';
import { supabaseService } from '../services/supabaseService';
import { Plus, Edit2, X, UploadCloud, Save, CheckCircle, AlertTriangle, Check, RefreshCw, Book, Calendar, Brain } from 'lucide-react';

interface Props {
  items: AcademicItem[];
  subjects: Subject[];
  onUpdate: (updates: Partial<AppState>) => void;
  initialEditItem?: AcademicItem | null;
  onEditHandled?: () => void;
}

const AdminPanel: React.FC<Props> = ({ items, subjects, onUpdate, initialEditItem, onEditHandled }) => {
  const { t, lang } = useAuth();
  const [activeTab, setActiveTab] = useState<'tasks' | 'lessons' | 'logs'>('tasks');
  
  // Task State
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [taskFormData, setTaskFormData] = useState<Partial<AcademicItem>>({
    title: '', subjectId: subjects[0]?.id || '', type: 'homework',
    date: new Date().toISOString().split('T')[0], time: '08:00', location: '', notes: '', resources: []
  });

  // Lesson State
  const [isAddingLesson, setIsAddingLesson] = useState(false);
  const [lessonFormData, setLessonFormData] = useState<Partial<Lesson>>({
    title: '', subjectId: subjects[0]?.id || '', type: 'lesson',
    description: '', aiMetadata: '', keywords: [], isPublished: true, fileUrl: '',
    date: new Date().toISOString().split('T')[0], startTime: '08:00', endTime: '10:00'
  });
  const [lessonFile, setLessonFile] = useState<File | null>(null);
  const [isUploadingLesson, setIsUploadingLesson] = useState(false);

  // Logs State
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
  }, [initialEditItem]);

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
        const fetched = await supabaseService.fetchAiLogs();
        setLogs(fetched);
    } catch(e) {}
    setLoadingLogs(false);
  };

  useEffect(() => {
    if (activeTab === 'logs') fetchLogs();
  }, [activeTab]);

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
    } catch (err) { alert("Failed to save task."); }
  };

  const handleLessonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploadingLesson(true);
    try {
      let fileUrl = lessonFormData.fileUrl || '';
      if (lessonFile) {
        try {
          fileUrl = await supabaseService.uploadFile(lessonFile);
        } catch (uploadError) {
          alert(t('upload_fail'));
          setIsUploadingLesson(false);
          return;
        }
      } else if (!fileUrl) {
        alert("Please upload a document.");
        setIsUploadingLesson(false);
        return;
      }
      
      const lesson: Lesson = {
        id: crypto.randomUUID(),
        title: lessonFormData.title || 'Untitled Lesson',
        subjectId: lessonFormData.subjectId || subjects[0]?.id || '',
        type: lessonFormData.type as any,
        description: lessonFormData.description || '',
        aiMetadata: lessonFormData.aiMetadata || '',
        fileUrl,
        date: lessonFormData.date || '',
        startTime: lessonFormData.startTime || '',
        endTime: lessonFormData.endTime || '',
        keywords: lessonFormData.keywords || [],
        isPublished: lessonFormData.isPublished || false,
        createdAt: new Date().toISOString()
      };
      
      await supabaseService.createLesson(lesson);
      alert(t('upload_success'));
      setIsAddingLesson(false);
      setLessonFormData({ title: '', description: '', aiMetadata: '', startTime: '08:00', endTime: '10:00' });
      setLessonFile(null);
    } catch (err) { alert("Failed to save lesson."); } 
    finally { setIsUploadingLesson(false); }
  };

  const handleResolveLog = async (id: string) => {
    await supabaseService.resolveLog(id);
    setLogs(logs.map(l => l.id === id ? { ...l, status: 'resolved' } : l));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-12">
      <div className="flex justify-between items-center gap-6">
        <h1 className="text-3xl font-black text-slate-900">{t('management')}</h1>
        <div className="flex bg-slate-100 p-1.5 rounded-2xl">
           <button onClick={() => setActiveTab('tasks')} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'tasks' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}><Calendar size={14}/> {t('task')}s</button>
           <button onClick={() => setActiveTab('lessons')} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'lessons' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}><Book size={14}/> Lessons</button>
           <button onClick={() => setActiveTab('logs')} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'logs' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}><Brain size={14}/> {t('logs')}</button>
        </div>
      </div>

      {activeTab === 'tasks' && (
        <div className="space-y-6">
          <div className="flex justify-end">
             <button onClick={() => setIsAdding(!isAdding)} className={`px-8 py-3 rounded-2xl font-black shadow-lg transition-all flex items-center gap-2 ${isAdding ? 'bg-rose-50 text-rose-600' : 'bg-indigo-600 text-white'}`}>
               {isAdding ? <><X size={18}/> {t('cancel')}</> : <><Plus size={18}/> {t('add')} Task</>}
             </button>
          </div>
          {isAdding && (
            <form onSubmit={handleTaskSubmit} className="bg-white p-6 rounded-[3rem] border border-slate-100 shadow-xl space-y-8">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Title</label><input required className="w-full bg-slate-50 border rounded-xl px-4 py-3 font-bold text-sm" value={taskFormData.title} onChange={e => setTaskFormData({...taskFormData, title: e.target.value})} /></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Type</label><select className="w-full bg-slate-50 border rounded-xl px-4 py-3 font-bold text-sm" value={taskFormData.type} onChange={e => setTaskFormData({...taskFormData, type: e.target.value as any})}><option value="homework">Homework</option><option value="exam">Exam</option><option value="event">Event</option><option value="task">General Task</option></select></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Subject</label><select className="w-full bg-slate-50 border rounded-xl px-4 py-3 font-bold text-sm" value={taskFormData.subjectId} onChange={e => setTaskFormData({...taskFormData, subjectId: e.target.value})}>{subjects.map(s => <option key={s.id} value={s.id}>{s.name[lang]}</option>)}</select></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Date</label><input type="date" required className="w-full bg-slate-50 border rounded-xl px-4 py-3 font-bold text-sm" value={taskFormData.date} onChange={e => setTaskFormData({...taskFormData, date: e.target.value})} /></div>
               </div>
               <button type="submit" className="w-full py-4 text-white font-black rounded-2xl shadow-lg bg-indigo-600"><Save size={18} className="inline mr-2"/> Save Task</button>
            </form>
          )}
        </div>
      )}

      {activeTab === 'lessons' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-emerald-50 p-6 rounded-[2.5rem]">
             <h3 className="font-black text-emerald-800 text-lg">Teacher's Knowledge Base</h3>
             <button onClick={() => setIsAddingLesson(!isAddingLesson)} className={`px-6 py-3 rounded-2xl font-black shadow-lg flex items-center gap-2 ${isAddingLesson ? 'bg-white text-slate-500' : 'bg-emerald-600 text-white'}`}>{isAddingLesson ? 'Close' : 'Upload Lesson'}</button>
          </div>
          {isAddingLesson && (
            <form onSubmit={handleLessonSubmit} className="bg-white p-6 rounded-[3rem] border border-slate-100 shadow-xl space-y-8">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Lesson Title</label><input required className="w-full bg-slate-50 border rounded-xl px-4 py-3 font-bold text-sm" value={lessonFormData.title} onChange={e => setLessonFormData({...lessonFormData, title: e.target.value})} /></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Subject</label><select className="w-full bg-slate-50 border rounded-xl px-4 py-3 font-bold text-sm" value={lessonFormData.subjectId} onChange={e => setLessonFormData({...lessonFormData, subjectId: e.target.value})}>{subjects.map(s => <option key={s.id} value={s.id}>{s.name[lang]}</option>)}</select></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Category</label><select className="w-full bg-slate-50 border rounded-xl px-4 py-3 font-bold text-sm" value={lessonFormData.type} onChange={e => setLessonFormData({...lessonFormData, type: e.target.value as any})}><option value="lesson">Lesson (Course)</option><option value="summary">Summary</option><option value="exercise">Exercise</option><option value="exam_prep">Exam Prep</option></select></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">{t('date')}</label><input type="date" required className="w-full bg-slate-50 border rounded-xl px-4 py-3 font-bold text-sm" value={lessonFormData.date} onChange={e => setLessonFormData({...lessonFormData, date: e.target.value})} /></div>
               </div>
               
               <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase">{t('from')}</label>
                    <input type="time" className="w-full bg-white border rounded-xl px-4 py-2 font-bold text-sm" value={lessonFormData.startTime} onChange={e => setLessonFormData({...lessonFormData, startTime: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase">{t('to')}</label>
                    <input type="time" className="w-full bg-white border rounded-xl px-4 py-2 font-bold text-sm" value={lessonFormData.endTime} onChange={e => setLessonFormData({...lessonFormData, endTime: e.target.value})} />
                  </div>
               </div>

               <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Public Description (Students)</label><textarea required className="w-full bg-slate-50 border rounded-2xl px-4 py-3 font-bold text-sm" value={lessonFormData.description} onChange={e => setLessonFormData({...lessonFormData, description: e.target.value})} /></div>
               <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase text-indigo-600">{t('ai_metadata')}</label><textarea className="w-full bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-3 font-bold text-sm text-indigo-800" placeholder="Keywords, topics, context for the AI..." value={lessonFormData.aiMetadata} onChange={e => setLessonFormData({...lessonFormData, aiMetadata: e.target.value})} /></div>
               
               <div className="p-6 border-2 border-dashed rounded-2xl bg-slate-50 text-center hover:bg-slate-100 transition-colors">
                 {lessonFile ? (
                   <div className="flex items-center justify-center gap-2 text-emerald-600 font-bold">
                     <CheckCircle size={20} /> {lessonFile.name}
                     <button type="button" onClick={() => setLessonFile(null)} className="text-rose-500 ml-2"><X size={16}/></button>
                   </div>
                 ) : (
                   <label className="cursor-pointer block">
                     <UploadCloud size={32} className="mx-auto text-slate-400 mb-2"/>
                     <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">Click to upload file (Lessons Bucket)</span>
                     <input type="file" required={!lessonFormData.fileUrl} className="hidden" onChange={e => e.target.files?.[0] && setLessonFile(e.target.files[0])} />
                   </label>
                 )}
               </div>
               
               <button type="submit" disabled={isUploadingLesson} className="w-full py-4 text-white font-black rounded-2xl shadow-lg bg-emerald-600 disabled:opacity-50">{isUploadingLesson ? 'Uploading...' : 'Upload & Index'}</button>
            </form>
          )}
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="space-y-4">
            <div className="flex justify-between items-center px-2">
                <p className="text-slate-500 font-bold text-sm">Failed AI Queries ({logs.filter(l => l.status === 'unresolved').length} unresolved)</p>
                <button onClick={fetchLogs} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200"><RefreshCw size={16} className={loadingLogs ? "animate-spin" : ""} /></button>
            </div>
            {logs.length === 0 ? <p className="text-center text-slate-400 py-10 font-bold">No logs found.</p> : (
                <div className="grid gap-4">
                    {logs.map(log => (
                        <div key={log.id} className={`bg-white p-4 rounded-2xl border flex items-center justify-between ${log.status === 'resolved' ? 'border-slate-100 opacity-60' : 'border-rose-100 bg-rose-50/20'}`}>
                            <div>
                                <p className="font-black text-slate-900 text-sm">{log.query}</p>
                                <p className="text-[10px] font-bold text-slate-400 mt-1">{log.userName} • {new Date(log.createdAt).toLocaleString()}</p>
                            </div>
                            {log.status === 'unresolved' ? (
                                <button onClick={() => handleResolveLog(log.id)} className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase text-indigo-600 shadow-sm hover:bg-indigo-50">Mark Resolved</button>
                            ) : <Check size={16} className="text-emerald-500"/>}
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
