
import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { TimetableEntry, Subject, AppState } from '../types';
import { Plus, Trash2, Edit2, MapPin, X } from 'lucide-react';

interface Props {
  entries: TimetableEntry[];
  subjects: Subject[];
  onUpdate: (updates: Partial<AppState>) => void;
}

const Timetable: React.FC<Props> = ({ entries, subjects, onUpdate }) => {
  const { t, lang, isAdmin } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [newEntry, setNewEntry] = useState<Partial<TimetableEntry>>({
    day: 1, startHour: 8, endHour: 10, subjectId: subjects[0]?.id || '', color: 'bg-indigo-600', room: ''
  });

  const days = [1, 2, 3, 4, 5, 6];
  const hours = Array.from({ length: 11 }, (_, i) => i + 8);

  const handleAdd = () => {
    onUpdate({ timetable: [...entries, { id: Math.random().toString(36).substr(2, 9), day: newEntry.day!, startHour: newEntry.startHour!, endHour: newEntry.endHour!, subjectId: newEntry.subjectId!, color: newEntry.color!, room: newEntry.room || '' }] });
    setIsEditing(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700 h-full max-h-[calc(100vh-140px)] flex flex-col">
      <div className="flex justify-between items-end px-1">
        <h1 className="text-3xl font-black text-slate-900">{t('timetable')}</h1>
        {isAdmin && <button onClick={() => setIsEditing(!isEditing)} className="px-6 py-3 rounded-2xl font-black bg-indigo-600 text-white">{isEditing ? <X size={20}/> : <Edit2 size={20}/>}</button>}
      </div>
      {isEditing && (
        <div className="bg-white p-6 rounded-[2.5rem] border-2 border-indigo-50 shadow-2xl space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <select className="bg-slate-50 border rounded-xl p-2" value={newEntry.day} onChange={e => setNewEntry({...newEntry, day: parseInt(e.target.value)})}>{days.map(d => <option key={d} value={d}>Day {d}</option>)}</select>
            <button onClick={handleAdd} className="bg-indigo-600 text-white py-2 rounded-xl font-black"><Plus size={20} className="mx-auto" /></button>
          </div>
        </div>
      )}
      <div className="flex-1 bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto hide-scrollbar">
          <div className="min-w-[1200px] h-full flex flex-col">
            <div className="grid grid-cols-[100px_repeat(11,1fr)] bg-slate-900 sticky top-0 z-20 text-white/50 text-[10px] font-black"><div className="p-4">TIME</div>{hours.map(h => <div key={h} className="p-4 border-l border-white/10">{h}:00</div>)}</div>
            <div className="flex-1 bg-slate-50/30">{days.map(day => (
                <div key={day} className="grid grid-cols-[100px_repeat(11,1fr)] min-h-[90px] border-b border-slate-100"><div className="flex items-center justify-center font-black text-slate-400 bg-white sticky left-0 z-10">DAY {day}</div>
                {hours.map(h => {
                    const entry = entries.find(e => e.day === day && e.startHour === h);
                    if (entry) return <div key={h} className={`relative ${entry.color} m-1.5 p-4 rounded-[1.25rem] text-white shadow-xl`} style={{ gridColumnEnd: `span ${entry.endHour - entry.startHour}` }}>
                        <p className="font-black text-sm">{subjects.find(s => s.id === entry.subjectId)?.name[lang]}</p>
                        <p className="text-[10px] opacity-80 mt-1 flex items-center gap-1"><MapPin size={10}/> {entry.room}</p>
                        {isEditing && <button onClick={() => onUpdate({timetable: entries.filter(e => e.id !== entry.id)})} className="absolute top-2 right-2 opacity-50 hover:opacity-100"><Trash2 size={12}/></button>}
                    </div>;
                    return <div key={h} className="border-l border-slate-100/50"></div>;
                })}</div>
            ))}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Timetable;
