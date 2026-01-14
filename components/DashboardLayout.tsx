
import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { 
  LayoutDashboard, Calendar, BookOpen, Users, LogOut, Menu, X, Code,
  ShieldAlert, GraduationCap, Clock, Activity, Heart, MessageCircle, Library
} from 'lucide-react';
import { APP_NAME } from '../constants';

interface Props {
  children: React.ReactNode;
  currentView: string;
  setView: (view: string) => void;
}

const DashboardLayout: React.FC<Props> = ({ children, currentView, setView }) => {
  const { user, logout, isDev, isAdmin, t, lang, setLang } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'overview', label: t('overview'), icon: <LayoutDashboard size={20} /> },
    { id: 'chat', label: t('chat'), icon: <MessageCircle size={20} /> },
    { id: 'calendar', label: t('calendar'), icon: <Calendar size={20} /> },
    { id: 'subjects', label: t('subjects'), icon: <BookOpen size={20} /> },
    { id: 'lessons', label: 'Lessons', icon: <Library size={20} /> },
    { id: 'classlist', label: t('classlist'), icon: <Users size={20} /> },
  ];

  if (isAdmin) navItems.push({ id: 'admin', label: t('management'), icon: <ShieldAlert size={20} /> });
  if (isDev) navItems.push({ id: 'dev', label: t('dev'), icon: <Code size={20} /> });
  
  navItems.push({ id: 'credits', label: t('credits'), icon: <Heart size={20} /> });

  const isRtl = lang === 'ar';

  const mobileBarItems = [
    navItems.find(i => i.id === 'overview')!,
    navItems.find(i => i.id === 'chat')!,
    navItems.find(i => i.id === 'lessons')!,
    navItems.find(i => i.id === 'calendar')!,
    navItems.find(i => i.id === 'subjects')!,
  ];

  const isChat = currentView === 'chat';

  return (
    <div className={`h-screen flex flex-col md:flex-row bg-[#f2f6ff] overflow-hidden ${isRtl ? 'font-[Tajawal,sans-serif]' : ''} relative`}>
      {/* Abstract Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-200/40 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-200/40 rounded-full blur-[100px] pointer-events-none"></div>

      {/* Desktop Sidebar - Liquid Glass Style */}
      <aside className={`hidden md:flex flex-col w-64 glass-panel h-[96%] m-4 rounded-[2.5rem] shrink-0 z-20 relative`}>
        <div className="p-8 flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200/50">
            <GraduationCap size={24} />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black tracking-tight text-slate-800 leading-none">{APP_NAME}</span>
            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mt-1.5 opacity-80">Dashboard</span>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto hide-scrollbar py-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl font-bold transition-all duration-300 ${
                currentView === item.id 
                  ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200' 
                  : 'text-slate-500 hover:bg-white/50 hover:text-indigo-600'
              }`}
            >
              <span className={`shrink-0 ${currentView === item.id ? 'text-white' : 'text-slate-400'} transition-colors rtl-flip`}>
                {item.icon}
              </span>
              <span className="text-xs truncate">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6 mt-2 space-y-4">
          <div className="flex bg-slate-100/50 p-1.5 rounded-2xl border border-white/50 backdrop-blur-sm">
            {['en', 'fr', 'ar'].map(l => (
              <button 
                key={l}
                onClick={() => setLang(l as any)}
                className={`flex-1 py-2 text-[10px] font-black rounded-xl transition-all ${lang === l ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 p-3.5 rounded-3xl bg-white/60 border border-white/60 shadow-sm backdrop-blur-sm">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-sm shrink-0 relative">
              {user?.name.charAt(0)}
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full animate-pulse shadow-sm"></span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-slate-800 truncate leading-none">{user?.name}</p>
              <p className="text-[9px] text-slate-400 font-bold mt-1 truncate">
               {user?.email}
              </p>
            </div>
            <button onClick={logout} className="text-slate-300 hover:text-rose-500 transition-colors shrink-0 p-1">
              <LogOut size={18} className="rtl-flip" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Header - Glass Style */}
      <header className="md:hidden glass-panel mx-3 mt-3 rounded-[2rem] flex items-center justify-between px-5 py-3 sticky top-3 z-30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-tr from-indigo-600 to-indigo-500 rounded-xl flex items-center justify-center text-white shadow-indigo-200 shadow-lg">
            <GraduationCap size={18} />
          </div>
          <span className="text-lg font-black text-slate-800 tracking-tight">{APP_NAME}</span>
        </div>
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="w-10 h-10 flex items-center justify-center text-slate-600 bg-white/50 rounded-full active:scale-90 transition-transform"
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-white/95 backdrop-blur-3xl z-40 md:hidden pt-24 px-6 overflow-y-auto animate-in fade-in slide-in-from-bottom-10 duration-300">
          <div className="space-y-3 pb-32">
            <div className="flex items-center gap-4 p-6 mb-8 bg-indigo-50/50 rounded-[2.5rem] border border-indigo-100/50">
              <div className="w-14 h-14 rounded-3xl bg-indigo-600 flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-indigo-200">
                {user?.name.charAt(0)}
              </div>
              <div>
                <p className="font-black text-slate-900 text-lg leading-none">{user?.name}</p>
                <p className="text-xs font-bold text-slate-400 mt-1">{user?.email}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
                {navItems.map((item) => (
                <button
                    key={item.id}
                    onClick={() => { setView(item.id); setMobileMenuOpen(false); }}
                    className={`flex flex-col items-center justify-center gap-3 p-5 rounded-[2rem] text-sm font-black transition-all ${
                    currentView === item.id 
                        ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200' 
                        : 'bg-white border border-slate-100 text-slate-500'
                    }`}
                >
                    {React.cloneElement(item.icon as React.ReactElement<any>, { size: 24, className: 'rtl-flip' })}
                    <span>{item.label}</span>
                </button>
                ))}
            </div>

            <button onClick={logout} className="w-full flex items-center justify-center gap-3 p-5 mt-6 rounded-[2rem] text-sm font-black text-rose-600 bg-rose-50 border border-rose-100">
              <LogOut size={20} className="rtl-flip" /> {t('logout').toUpperCase()}
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className={`flex-1 overflow-y-auto ${isChat ? 'p-0' : 'p-4 md:p-6'} relative hide-scrollbar z-10`}>
        <div className={`${isChat ? 'h-full' : 'max-w-6xl mx-auto pb-24 md:pb-0 h-full'}`}>
          {children}
        </div>
      </main>

      {/* Mobile Floating Tab Bar - Liquid Glass */}
      {!isChat && (
        <nav className="md:hidden fixed bottom-6 left-6 right-6 glass-nav h-16 flex justify-around items-center z-50 shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-[2rem] animate-in slide-in-from-bottom-20 duration-500">
          {mobileBarItems.map(item => (
            <button 
              key={item.id} 
              onClick={() => setView(item.id)} 
              className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 ${currentView === item.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 translate-y-[-8px]' : 'text-slate-400'}`}
            >
              {React.cloneElement(item.icon as React.ReactElement<any>, { size: 20, strokeWidth: 2.5, className: 'rtl-flip' })}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
};

export default DashboardLayout;
