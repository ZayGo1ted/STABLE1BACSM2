
import React from 'react';
import { useAuth } from '../AuthContext';
import { AcademicItem, Subject } from '../types';
import { Calendar, Clock, BookOpen, AlertCircle, FileText, ChevronRight, Activity } from 'lucide-react';
import { SUBJECT_ICONS } from '../constants';

interface Props {
  items: AcademicItem[];
  subjects: Subject[];
  onSubjectClick: (id: string) => void;
}

const Overview: React.FC<Props> = ({ items, subjects, onSubjectClick }) => {
  const { lang, t, onlineUserIds } = useAuth();
  const upcoming = items
    .filter(i => new Date(i.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Welcome Header */}
      <section className="flex flex-col gap-1 px-1">
          <h1 className="text-3xl font-black text-slate-800 tracking-tight leading-tight">{t('welcome')}</h1>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
               {onlineUserIds.size} {t('in_hub')}
            </span>
          </div>
      </section>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { id: 'exam', icon: <AlertCircle size={18}/>, color: 'text-rose-500', bg: 'bg-rose-50', label: 'Exams', count: items.filter(i => i.type === 'exam').length },
          { id: 'homework', icon: <FileText size={18}/>, color: 'text-indigo-500', bg: 'bg-indigo-50', label: 'Homework', count: items.filter(i => i.type === 'homework').length },
          { id: 'subjects', icon: <BookOpen size={18}/>, color: 'text-violet-500', bg: 'bg-violet-50', label: 'Subjects', count: subjects.length },
          { id: 'active', icon: <Activity size={18}/>, color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Active', count: onlineUserIds.size }
        ].map((stat, i) => (
          <div key={i} className="glass-card p-4 rounded-[1.5rem] flex flex-col items-center justify-center text-center gap-2 transition-all">
            <div className={`w-10 h-10 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center shadow-sm`}>
              {stat.icon}
            </div>
            <div>
                <p className="text-2xl font-black text-slate-800 leading-none">{stat.count}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Subjects Grid */}
        <div className="lg:col-span-12 space-y-3">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] px-1">{t('curriculum_shortcut')}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {subjects.slice(0, 10).map((subject) => (
              <button 
                key={subject.id}
                onClick={() => onSubjectClick(subject.id)}
                className="glass-card p-4 rounded-[1.5rem] flex flex-col items-center gap-3 transition-all group hover:bg-white"
              >
                <div className={`w-12 h-12 rounded-2xl ${subject.color} text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform`}>
                  {React.cloneElement(SUBJECT_ICONS[subject.id] as React.ReactElement<any>, { size: 20 })}
                </div>
                <span className="text-[10px] font-bold text-slate-700 uppercase truncate w-full text-center tracking-wide">{subject.name[lang]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Upcoming Tasks */}
        <div className="lg:col-span-12 space-y-3">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] px-1">{t('upcoming_priority')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {upcoming.length > 0 ? (
              upcoming.map((item) => {
                const subj = subjects.find(s => s.id === item.subjectId);
                return (
                  <button 
                    key={item.id} 
                    onClick={() => onSubjectClick(item.subjectId)}
                    className="glass-card p-4 rounded-[2rem] flex items-center gap-4 transition-all hover:bg-white text-left w-full group"
                  >
                    <div className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center text-white shadow-md ${subj?.color || 'bg-slate-400'}`}>
                      {React.cloneElement(SUBJECT_ICONS[item.subjectId] as React.ReactElement<any>, { size: 24 })}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg tracking-wide ${
                          item.type === 'exam' ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'
                        }`}>
                          {item.type}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 truncate uppercase tracking-widest">{subj?.name[lang]}</span>
                      </div>
                      <h3 className="text-sm font-black text-slate-800 truncate leading-tight group-hover:text-indigo-600 transition-colors">{item.title}</h3>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                        <ChevronRight size={16} />
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="col-span-full py-12 text-center glass-card rounded-[2rem] border-dashed border-2 border-slate-200">
                <p className="text-slate-400 text-xs font-black uppercase tracking-widest">{t('all_clear')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Overview;
