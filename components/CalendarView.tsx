
import React, { useState, useMemo } from 'react';
import { AcademicItem, Subject, AppState } from '../types';
import { useAuth } from '../AuthContext';
import { supabaseService } from '../services/supabaseService';
import { 
  ChevronLeft, ChevronRight, Clock, MapPin, X, Calendar as CalendarIcon, 
  Edit2, AlertCircle, Trash2
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
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedItem, setSelectedItem] = useState<AcademicItem | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'exam' | 'homework' | 'event'>('all');

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
    return { days, firstDay };
  };

  const getUpcomingItems = () => {
    const now = new Date();
    now.setHours(0,0,0,0);
    return items
      .filter(i => new Date(i.date) >= now)
      .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 10);
  };

  const filteredItems = useMemo(() => {
    return items.filter(i => {
      if (filterType === 'all') return true;
      return i.type === filterType;
    });
  }, [items, filterType]);

  const monthData = useMemo(() => {
    const { days, firstDay } = getDaysInMonth(currentDate);
    const blanks = Array(firstDay).fill(null);
    const daysArray = Array.from({ length: days }, (_, i) => i + 1);
    return { blanks, daysArray };
  }, [currentDate]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(currentDate);
        d.setDate(currentDate.getDate() + i);
        return d;
    });
  }, [currentDate]);

  const agendaGroups = useMemo(() => {
    const now = new Date();
    now.setHours(0,0,0,0);
    const upcoming = filteredItems
        .filter(i => new Date(i.date) >= now)
        .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const groups: Record<string, AcademicItem[]> = {};
    upcoming.forEach(item => {
        if (!groups[item.date]) groups[item.date] = [];
        groups[item.date].push(item);
    });
    return groups;
  }, [filteredItems]);

  const navigate = (dir: 1 | -1) => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(currentDate.getMonth() + dir);
    } else {
      newDate.setDate(currentDate.getDate() + (dir * 7));
    }
    setCurrentDate(newDate);
  };

  const jumpToToday = () => setCurrentDate(new Date());

  const getItemsForDate = (dayStr: string) => {
    return filteredItems.filter(i => i.date === dayStr).sort((a,b) => (a.time || '00:00').localeCompare(b.time || '00:00'));
  };

  const handleDeleteItem = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm(t('delete_confirm'))) {
        try {
            await supabaseService.deleteAcademicItem(id);
            onUpdate({ items: items.filter(i => i.id !== id) });
            setSelectedItem(null);
        } catch (e) {
            alert("Delete failed. Please check your connection.");
        }
    }
  };

  const UpcomingCarousel = () => {
    const upcoming = getUpcomingItems();
    if (upcoming.length === 0) return null;

    return (
        <div className="space-y-2 mb-6">
            <h2 className="px-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('next_up')}</h2>
            <div className="flex gap-3 overflow-x-auto hide-scrollbar snap-x snap-mandatory px-1 pb-4">
                {upcoming.map(item => {
                     const subj = subjects.find(s => s.id === item.subjectId);
                     const daysLeft = Math.ceil((new Date(item.date).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                     const isExam = item.type === 'exam';
                     
                     return (
                        <div 
                            key={item.id}
                            onClick={() => setSelectedItem(item)}
                            className={`snap-center flex-shrink-0 w-[80%] md:w-[300px] p-5 rounded-[2rem] border transition-transform active:scale-95 cursor-pointer relative overflow-hidden group ${isExam ? 'bg-gradient-to-br from-rose-500 to-rose-600 border-rose-400 text-white shadow-lg' : 'bg-white border-white shadow-md text-slate-900'}`}
                        >
                            {!isExam && <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-[100%] opacity-10 ${subj?.color}`}></div>}
                            
                            <div className="flex justify-between items-start mb-4">
                                <span className={`inline-block text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${isExam ? 'bg-white/20 text-white backdrop-blur-md' : 'bg-slate-100 text-slate-500'}`}>
                                    {daysLeft <= 0 ? t('today') : `${t('due')} ${daysLeft}d`}
                                </span>
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-md ${isExam ? 'bg-white/20 text-white backdrop-blur-md' : `${subj?.color} text-white`}`}>
                                    {React.cloneElement(SUBJECT_ICONS[item.subjectId] as React.ReactElement<any>, { size: 16 })}
                                </div>
                            </div>
                            
                            <h3 className={`text-lg font-black mb-1 line-clamp-2 leading-tight ${isExam ? 'text-white' : 'text-slate-800'}`}>{item.title}</h3>
                            <p className={`text-[10px] font-bold uppercase tracking-wide flex items-center gap-2 ${isExam ? 'text-white/80' : 'text-slate-400'}`}>
                                <span>{subj?.name[lang]}</span>
                                <span>•</span>
                                <span>{item.time}</span>
                            </p>
                        </div>
                     );
                })}
            </div>
        </div>
    );
  };

  return (
    <div className="space-y-5 pb-20 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-start">
           <div>
               <h1 className="text-2xl font-black text-slate-800 tracking-tight">{t('calendar')}</h1>
               <p className="text-slate-400 font-bold text-xs">
                 {currentDate.toLocaleDateString(lang, { month: 'long', year: 'numeric' })}
               </p>
           </div>
           
           <div className="flex items-center gap-1 glass-panel p-1 rounded-xl">
                <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-white rounded-lg text-slate-400 transition-colors"><ChevronLeft size={18}/></button>
                <button onClick={jumpToToday} className="px-2.5 py-1 text-[9px] font-black uppercase text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors">{t('today')}</button>
                <button onClick={() => navigate(1)} className="p-1.5 hover:bg-white rounded-lg text-slate-400 transition-colors"><ChevronRight size={18}/></button>
           </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3 justify-between items-center">
             <div className="flex glass-panel p-1 rounded-xl w-full md:w-auto">
                 {['day', 'week', 'month'].map((m) => (
                    <button
                        key={m}
                        onClick={() => setViewMode(m as any)}
                        className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all ${viewMode === m ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        {m === 'day' ? t('agenda') : t(m)}
                    </button>
                 ))}
             </div>

             <div className="flex gap-2 overflow-x-auto hide-scrollbar w-full md:w-auto pb-1">
                {['all', 'exam', 'homework', 'event'].map(f => (
                    <button 
                        key={f}
                        onClick={() => setFilterType(f as any)}
                        className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all border whitespace-nowrap backdrop-blur-md ${filterType === f 
                            ? (f === 'exam' ? 'bg-rose-500 text-white shadow-md border-transparent' : 'bg-indigo-600 text-white shadow-md border-transparent') 
                            : 'bg-white/60 border-white text-slate-500 hover:bg-white'}`}
                    >
                        {t(f)}
                    </button>
                ))}
            </div>
        </div>
      </div>

      <UpcomingCarousel />

      <div className="animate-in slide-in-from-bottom-4 duration-500">
          {viewMode === 'month' && (
             <div className="glass-card rounded-[2rem] overflow-hidden p-4">
                <div className="grid grid-cols-7 mb-4">
                    {['S','M','T','W','T','F','S'].map(d => (
                        <div key={d} className="text-center text-[10px] font-black text-slate-300">{d}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-1 md:gap-3">
                    {monthData.blanks.map((_, i) => <div key={`blank-${i}`} className="aspect-square"></div>)}
                    {monthData.daysArray.map(day => {
                        const dStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toISOString().split('T')[0];
                        const itemsForDay = filteredItems.filter(i => i.date === dStr);
                        const isToday = day === new Date().getDate() && currentDate.getMonth() === new Date().getMonth();
                        
                        return (
                            <div 
                                key={day} 
                                onClick={() => { if(itemsForDay.length) setSelectedItem(itemsForDay[0]); }}
                                className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all relative
                                    ${isToday ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-50 text-slate-500'}
                                    ${itemsForDay.length > 0 && !isToday ? 'bg-white border border-indigo-100 text-indigo-600 shadow-sm cursor-pointer' : ''}
                                `}
                            >
                                <span className="text-xs font-bold">{day}</span>
                                {itemsForDay.length > 0 && (
                                    <div className="flex gap-0.5">
                                        {itemsForDay.slice(0,3).map((_,i) => <div key={i} className={`w-1 h-1 rounded-full ${isToday ? 'bg-white' : 'bg-indigo-500'}`}></div>)}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
             </div>
          )}

          {viewMode === 'week' && (
             <div className="space-y-4">
                 <div className="grid grid-cols-7 gap-1.5">
                    {weekDays.map((date, i) => {
                        const isToday = date.toDateString() === new Date().toDateString();
                        return (
                            <div key={i} className={`flex flex-col items-center p-2 rounded-xl border transition-all ${isToday ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'glass-card border-white text-slate-400'}`}>
                                <span className="text-[8px] font-black uppercase opacity-80">{date.toLocaleDateString(lang, { weekday: 'narrow' })}</span>
                                <span className="text-sm font-black">{date.getDate()}</span>
                            </div>
                        )
                    })}
                 </div>
                 <div className="space-y-2 pt-2">
                     {weekDays.map((date) => {
                         const dItems = getItemsForDate(date.toISOString().split('T')[0]);
                         if (dItems.length === 0) return null;
                         return (
                             <div key={date.toISOString()} className="space-y-2">
                                <h3 className="px-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">{date.toLocaleDateString(lang, { weekday: 'long' })}</h3>
                                {dItems.map(item => {
                                    const subj = subjects.find(s => s.id === item.subjectId);
                                    return (
                                        <div key={item.id} onClick={() => setSelectedItem(item)} className="glass-card p-3 rounded-2xl flex items-center gap-3 cursor-pointer hover:bg-white transition-colors">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md ${subj?.color}`}>
                                                {React.cloneElement(SUBJECT_ICONS[item.subjectId] as React.ReactElement<any>, { size: 18 })}
                                            </div>
                                            <div>
                                                <h4 className="font-black text-slate-800 text-xs">{item.title}</h4>
                                                <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase mt-0.5">
                                                    <span className={`px-1.5 py-0.5 rounded-md ${item.type === 'exam' ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>{t(item.type)}</span>
                                                    <span>•</span>
                                                    <span>{item.time}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                             </div>
                         )
                     })}
                 </div>
             </div>
          )}

          {viewMode === 'day' && (
             <div className="space-y-4">
                {Object.keys(agendaGroups).length === 0 ? (
                    <div className="py-16 text-center glass-card rounded-[2rem] border-dashed border-2 border-slate-200">
                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300">
                            <CalendarIcon size={24} />
                        </div>
                        <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">{t('no_items')}</p>
                    </div>
                ) : (
                    Object.entries(agendaGroups).sort((a,b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()).map(([dateStr, dayItems]) => {
                        const date = new Date(dateStr);
                        const isToday = date.toDateString() === new Date().toDateString();

                        return (
                            <div key={dateStr} className="flex gap-3">
                                <div className="flex flex-col items-center w-10 pt-1 shrink-0">
                                    <span className={`text-[9px] font-black uppercase ${isToday ? 'text-indigo-600' : 'text-slate-400'}`}>{date.toLocaleDateString(lang, { weekday: 'short' })}</span>
                                    <span className={`text-lg font-black ${isToday ? 'text-slate-900' : 'text-slate-500'}`}>{date.getDate()}</span>
                                    <div className="w-0.5 h-full bg-slate-100 my-1 rounded-full"></div>
                                </div>
                                <div className="flex-1 space-y-2 pb-6">
                                    {dayItems.map(item => {
                                        const subj = subjects.find(s => s.id === item.subjectId);
                                        return (
                                            <div key={item.id} onClick={() => setSelectedItem(item)} className="group glass-card p-4 rounded-2xl hover:bg-white transition-all cursor-pointer relative overflow-hidden">
                                                <div className={`absolute top-0 left-0 w-1 h-full ${item.type === 'exam' ? 'bg-rose-500' : 'bg-indigo-500'}`}></div>
                                                <div className="flex justify-between items-center pl-2">
                                                    <div>
                                                        <h3 className="font-black text-slate-800 text-sm">{item.title}</h3>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md uppercase tracking-wide">{subj?.name[lang]}</span>
                                                            <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1"><Clock size={10}/> {item.time}</span>
                                                        </div>
                                                    </div>
                                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-md ${subj?.color}`}>
                                                        {React.cloneElement(SUBJECT_ICONS[item.subjectId] as React.ReactElement<any>, { size: 16 })}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        );
                    })
                )}
             </div>
          )}
      </div>

      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className={`relative p-6 pb-12 ${selectedItem.type === 'exam' ? 'bg-gradient-to-br from-rose-500 to-rose-600' : 'bg-gradient-to-br from-indigo-500 to-violet-600'}`}>
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                <div className="absolute top-4 right-4 flex gap-2 z-10">
                    {isAdmin && (
                        <>
                            <button onClick={(e) => handleDeleteItem(e, selectedItem.id)} className="p-2 bg-white/20 hover:bg-rose-500 text-white rounded-xl transition-colors backdrop-blur-md"><Trash2 size={16}/></button>
                            <button onClick={(e) => { e.stopPropagation(); if(onEditRequest) onEditRequest(selectedItem); setSelectedItem(null); }} className="p-2 bg-white/20 hover:bg-white/40 text-white rounded-xl transition-colors backdrop-blur-md"><Edit2 size={16}/></button>
                        </>
                    )}
                    <button onClick={() => setSelectedItem(null)} className="p-2 bg-white/20 hover:bg-white/40 text-white rounded-xl transition-colors backdrop-blur-md"><X size={16}/></button>
                </div>
                
                <div className="relative z-10 space-y-3 pt-2">
                    <span className="inline-block px-3 py-1 rounded-lg bg-black/20 text-white text-[9px] font-black uppercase tracking-widest backdrop-blur-md border border-white/10 shadow-lg">{t(selectedItem.type)}</span>
                    <h2 className="text-2xl font-black text-white leading-tight">{selectedItem.title}</h2>
                    <div className="flex items-center gap-2 text-white/90 font-medium">
                        <CalendarIcon size={14}/>
                        <span className="text-xs">{new Date(selectedItem.date).toLocaleDateString(lang, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
                    </div>
                </div>
            </div>
            
            <div className="p-6 -mt-8 bg-white rounded-t-[2.5rem] relative space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-0.5">
                        <div className="flex items-center gap-1.5 text-slate-400 mb-0.5"><Clock size={14} /><span className="text-[8px] font-black uppercase">{t('time')}</span></div>
                        <p className="font-black text-slate-800 text-sm">{selectedItem.time || '08:00'}</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-0.5">
                        <div className="flex items-center gap-1.5 text-slate-400 mb-0.5"><MapPin size={14} /><span className="text-[8px] font-black uppercase">{t('room')}</span></div>
                        <p className="font-black text-slate-800 text-sm">{selectedItem.location || 'Class 2'}</p>
                    </div>
                </div>

                <div className="space-y-2">
                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t('notes')}</h4>
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-medium text-slate-600 leading-relaxed">
                        {selectedItem.notes || t('no_items')}
                    </div>
                </div>

                <div className="flex items-center gap-3 pt-2 border-t border-slate-100 mt-2">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md ${subjects.find(s => s.id === selectedItem.subjectId)?.color}`}>
                        {React.cloneElement(SUBJECT_ICONS[selectedItem.subjectId] as React.ReactElement<any>, { size: 20 })}
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wide">{t('subject')}</p>
                        <p className="font-black text-slate-900 text-sm">{subjects.find(s => s.id === selectedItem.subjectId)?.name[lang]}</p>
                    </div>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarView;
