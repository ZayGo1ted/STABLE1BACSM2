
import React, { useState } from 'react';
import { AcademicItem, Subject, AppState } from '../types';
import { useAuth } from '../AuthContext';
import { 
  ChevronLeft, ChevronRight, Clock, MapPin, X, Calendar as CalendarIcon, Edit2
} from 'lucide-react';
import { SUBJECT_ICONS } from '../constants';

interface Props {
  items: AcademicItem[];
  subjects: Subject[];
  onUpdate: (updates: Partial<AppState>) => void;
  onEditRequest?: (item: AcademicItem) => void;
}

const CalendarView: React.FC<Props> = ({ items, subjects, onUpdate, onEditRequest }) => {
  const { t, lang, isAdmin } = useAuth();
  const isRtl = lang === 'ar';

  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); 
    const d = new Date(today.setDate(diff));
    d.setHours(0,0,0,0);
    return d;
  });

  const [selectedItem, setSelectedItem] = useState<AcademicItem | null>(null);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentWeekStart);
    d.setDate(currentWeekStart.getDate() + i);
    return d;
  });

  const getItemsForDay = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dStr = `${y}-${m}-${day}`;
    
    return items
      .filter(i => i.date === dStr)
      .sort((a,b) => (a.time || '00:00').localeCompare(b.time || '00:00'));
  };

  const navigateWeek = (weeks: number) => {
    const next = new Date(currentWeekStart);
    next.setDate(currentWeekStart.getDate() + (weeks * 7));
    setCurrentWeekStart(next);
  };

  const jumpToToday = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); 
    const d = new Date(today.setDate(diff));
    d.setHours(0,0,0,0);
    setCurrentWeekStart(d);
  };

  const isToday = (date: Date) => new Date().toDateString() === date.toDateString();

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-white p-6 md:p-8 rounded-[2.5rem] border-2 border-slate-50 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">{t('calendar')}</h1>
          <div className="flex items-center gap-2 mt-2 text-slate-400 font-bold">
            <CalendarIcon size={18} className="text-indigo-500" />
            <span className="text-sm">
              {weekDays[0].toLocaleDateString(lang, { month: 'short', day: 'numeric' })} — {weekDays[6].toLocaleDateString(lang, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button onClick={jumpToToday} className="px-6 py-3 bg-indigo-50 text-indigo-700 text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-600 hover:text-white transition-all active:scale-95 border-2 border-indigo-100/50">{t('today')}</button>
          <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
            <button onClick={() => navigateWeek(isRtl ? 1 : -1)} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all"><ChevronLeft size={24} className="text-slate-600" /></button>
            <button onClick={() => navigateWeek(isRtl ? -1 : 1)} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all"><ChevronRight size={24} className="text-slate-600" /></button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-6">
        {weekDays.map((day, idx) => {
          const dayItems = getItemsForDay(day);
          const activeDay = isToday(day);
          return (
            <div key={idx} className="flex flex-col space-y-4">
              <div className={`text-center p-5 rounded-[2rem] border-2 transition-all flex flex-col items-center justify-center ${activeDay ? 'bg-indigo-600 text-white shadow-2xl border-indigo-600 ring-4 ring-indigo-50' : 'bg-white text-slate-400 border-slate-100 shadow-sm'}`}>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">{day.toLocaleDateString(lang, { weekday: 'short' })}</p>
                <p className="text-3xl font-black">{day.getDate()}</p>
              </div>
              <div className="flex-1 space-y-3 min-h-[120px]">
                {dayItems.length > 0 ? dayItems.map(item => {
                  const subj = subjects.find(s => s.id === item.subjectId);
                  return (
                    <button key={item.id} onClick={() => setSelectedItem(item)} className={`w-full text-start p-4 rounded-[1.5rem] border-2 transition-all hover:-translate-y-2 shadow-sm group ${item.type === 'exam' ? 'bg-red-50/50 border-red-100' : 'bg-blue-50/50 border-blue-100'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${subj?.color || 'bg-slate-400'}`}></div>
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 truncate">{subj?.name[lang]}</span>
                      </div>
                      <h4 className={`text-xs font-black leading-tight ${item.type === 'exam' ? 'text-red-900' : 'text-blue-900'}`}>{item.title}</h4>
                      <div className="flex items-center gap-1.5 mt-2 opacity-60"><Clock size={10} /><span className="text-[9px] font-bold">{item.time || '08:00'}</span></div>
                    </button>
                  );
                }) : (
                  <div className="h-full min-h-[100px] border-2 border-dashed border-slate-200/50 rounded-[2rem] flex items-center justify-center opacity-40"><span className="text-[9px] font-black uppercase tracking-widest text-slate-300">{t('no_items')}</span></div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-12 max-h-[90vh] overflow-y-auto">
            <div className={`relative min-h-[160px] flex items-end p-8 ${selectedItem.type === 'exam' ? 'bg-gradient-to-br from-red-600 to-rose-700' : 'bg-gradient-to-br from-indigo-600 to-blue-700'}`}>
              <div className="absolute top-8 right-8 flex gap-2">
                {isAdmin && <button onClick={() => { if(onEditRequest) onEditRequest(selectedItem); setSelectedItem(null); }} className="p-3 bg-white/10 hover:bg-white/30 text-white rounded-2xl transition-all border border-white/20 backdrop-blur-md flex items-center gap-2 font-black text-xs uppercase"><Edit2 size={18}/> {t('edit')}</button>}
                <button onClick={() => setSelectedItem(null)} className="p-3 bg-white/10 hover:bg-white/30 text-white rounded-2xl transition-all border border-white/20 backdrop-blur-md"><X size={24} /></button>
              </div>
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-[1.75rem] bg-white flex items-center justify-center text-indigo-600 shadow-2xl shrink-0">{React.cloneElement(SUBJECT_ICONS[selectedItem.subjectId] as React.ReactElement<any>, { size: 36 })}</div>
                <div className="space-y-1">
                  <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase text-white">{t(selectedItem.type)}</span>
                  <h2 className="text-3xl font-black text-white">{selectedItem.title}</h2>
                  <p className="text-white/70 font-bold text-sm">{subjects.find(s => s.id === selectedItem.subjectId)?.name[lang]}</p>
                </div>
              </div>
            </div>
            <div className="p-8 space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="flex items-center gap-4 p-5 bg-slate-50 rounded-[1.5rem] border-2 border-slate-100"><div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl"><Clock size={22} /></div><div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('time_info')}</p><p className="text-sm font-black text-slate-800">{selectedItem.date} | {selectedItem.time || '08:00'}</p></div></div>
                <div className="flex items-center gap-4 p-5 bg-slate-50 rounded-[1.5rem] border-2 border-slate-100"><div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl"><MapPin size={22} /></div><div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('location')}</p><p className="text-sm font-black text-slate-800">{selectedItem.location || 'Classroom 2'}</p></div></div>
              </div>
              <div className="space-y-4"><h4 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">{t('notes')}</h4><div className="p-6 bg-slate-50 rounded-[2rem] border-2 border-slate-100 text-slate-700 leading-relaxed font-bold italic shadow-inner">{selectedItem.notes || "No notes."}</div></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarView;
