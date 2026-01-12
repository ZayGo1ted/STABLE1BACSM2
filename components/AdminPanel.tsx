
import React, { useState, useRef, useEffect } from 'react';
import { AcademicItem, Subject, AppState, Lesson } from '../types';
import { useAuth } from '../AuthContext';
import { supabaseService } from '../services/supabaseService';
import { Plus, Edit2, X, UploadCloud, FileUp, Save, BookOpen, Clock, Tag } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'tasks' | 'lessons'>('tasks');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [taskFormData, setTaskFormData] = useState<Partial<AcademicItem>>({
    title: '', subjectId: subjects[0]?.id || '', type: 'homework',
    date: new Date().toISOString().split('T')[0], time: '08:00', location: '', notes: '', resources: []
  });
  const [isAddingLesson, setIsAddingLesson] = useState(false);
  const [lessonFormData, setLessonFormData] = useState<Partial<Lesson>>({
    title: '', subjectId: subjects[0]?.id || '', type: 'course',
    description: '', estimatedTime: '45 min', keywords: [], isPublished: true, fileUrl: ''
  });
  const [keywordInput, setKeywordInput] = useState('');
  const [lessonFile, setLessonFile] = useState<File | null>(null);
  const [isUploadingLesson, setIsUploadingLesson] = useState(false);

  useEffect(() => {
    if (initialEditItem) {
      setActiveTab('tasks');
      setTaskFormData({ ...initialEditItem });
      setEditingId(initialEditItem.id);
      setIsAdding(true);
      if (onEditHandled) onEditHandled();
    }
  }, [initialEditItem]);

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
      alert("Lesson uploaded!");
      setIsAddingLesson(false);
    } catch (err) { alert("Failed to upload lesson."); } 
    finally { setIsUploadingLesson(false); }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-12">
      <div className="flex justify-between items-center gap-6">
        <h1 className="text-3xl font-black text-slate-900">{t('management')}</h1>
        <div className="flex bg-slate-100 p-1.5 rounded-2xl">
           <button onClick={() => setActiveTab('tasks')} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'tasks' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Tasks</button>
           <button onClick={() => setActiveTab('lessons')} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'lessons' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>Lessons</button>
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
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Title</label><input required className="w-full bg-slate-50 border rounded-xl px-4 py-3 font-bold text-sm" value={lessonFormData.title} onChange={e => setLessonFormData({...lessonFormData, title: e.target.value})} /></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Subject</label><select className="w-full bg-slate-50 border rounded-xl px-4 py-3 font-bold text-sm" value={lessonFormData.subjectId} onChange={e => setLessonFormData({...lessonFormData, subjectId: e.target.value})}>{subjects.map(s => <option key={s.id} value={s.id}>{s.name[lang]}</option>)}</select></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Est. Time</label><input className="w-full bg-slate-50 border rounded-xl px-4 py-3 font-bold text-sm" value={lessonFormData.estimatedTime} onChange={e => setLessonFormData({...lessonFormData, estimatedTime: e.target.value})} /></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Type</label><select className="w-full bg-slate-50 border rounded-xl px-4 py-3 font-bold text-sm" value={lessonFormData.type} onChange={e => setLessonFormData({...lessonFormData, type: e.target.value as any})}><option value="course">Course</option><option value="summary">Summary</option><option value="exercise">Exercise</option></select></div>
               </div>
               <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Description</label><textarea required className="w-full bg-slate-50 border rounded-2xl px-4 py-3 font-bold text-sm" value={lessonFormData.description} onChange={e => setLessonFormData({...lessonFormData, description: e.target.value})} /></div>
               <div className="p-6 border-2 border-dashed rounded-2xl bg-slate-50 text-center"><input type="file" required onChange={e => e.target.files?.[0] && setLessonFile(e.target.files[0])} /></div>
               <button type="submit" disabled={isUploadingLesson} className="w-full py-4 text-white font-black rounded-2xl shadow-lg bg-emerald-600">{isUploadingLesson ? 'Uploading...' : 'Upload & Index'}</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
