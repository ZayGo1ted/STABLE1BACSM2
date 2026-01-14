
import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { 
  LayoutDashboard, Calendar, BookOpen, Users, LogOut, Menu, X, Code,
  ShieldAlert, GraduationCap, Heart, MessageCircle, Library
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
    { id: 'overview', label: t('overview'), icon: <LayoutDashboard size={18} /> },
    { id: 'chat', label: t('chat'), icon: <MessageCircle size={18} /> },
    { id: 'calendar', label: t('calendar'), icon: <Calendar size={18} /> },
    { id: 'subjects', label: t('subjects'), icon: <BookOpen size={18} /> },
    { id: 'lessons', label: t('lessons_lib'), icon: <Library size={18} /> },
    { id: 'classlist', label: t('classlist'), icon: <Users size={18} /> },
  ];

  if (isAdmin) navItems.push({ id: 'admin', label: t('management'), icon: <ShieldAlert size={18} /> });
  if (isDev) navItems.push({ id: 'dev', label: t('dev'), icon: <Code size={18} /> });
  
  navItems.push({ id: 'credits', label: t('credits'), icon: <Heart size={18} /> });

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
    <div className={`h-[100dvh] w-full flex flex-col md:flex-row bg-[#f2f6ff] overflow-hidden ${isRtl ? 'font-[Tajawal,sans-serif]' : ''} relative`}>
      {/* Abstract Background Orbs (Fainter) */}
      <div className="absolute top-[-10%] left-[-10%] w-[30%] h-[30%] bg-indigo-200/30 rounded-full blur-[80px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-blue-200/30 rounded-full blur-[80px] pointer-events-none"></div>

      {/* Desktop Sidebar - Compact */}
      <aside className={`hidden md:flex flex-col w-60 glass-panel h-[96%] m-3 rounded-[2rem] shrink-0 z-20 relative transition-all`}>
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200/50">
            <GraduationCap size={20} />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-black tracking-tight text-slate-800 leading-none">{APP_NAME}</span>
            <span className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.2em] mt-1 opacity-80">Hub</span>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1.5 overflow-y-auto hide-scrollbar py-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all duration-200 ${
                currentView === item.id 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                  : 'text-slate-500 hover:bg-white/60 hover:text-indigo-600'
              }`}
            >
              <span className={`shrink-0 ${currentView === item.id ? 'text-white' : 'text-slate-400'} transition-colors rtl-flip`}>
                {item.icon}
              </span>
              <span className="text-xs truncate">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 mt-1 space-y-3">
          <div className="flex bg-slate-100/50 p-1 rounded-xl border border-white/50 backdrop-blur-sm">
            {['en', 'fr', 'ar'].map(l => (
              <button 
                key={l}
                onClick={() => setLang(l as any)}
                className={`flex-1 py-1.5 text-[9px] font-black rounded-lg transition-all ${lang === l ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-white/60 border border-white/60 shadow-sm backdrop-blur-sm">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-xs shrink-0 relative">
              {user?.name.charAt(0)}
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full animate-pulse"></span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black text-slate-800 truncate leading-none">{user?.name}</p>
              <p className="text-[8px] text-slate-400 font-bold mt-0.5 truncate">
               {user?.email}
              </p>
            </div>
            <button onClick={logout} className="text-slate-300 hover:text-rose-500 transition-colors shrink-0 p-1">
              <LogOut size={16} className="rtl-flip" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Header - Compact Glass */}
      <header className="md:hidden glass-panel mx-2 mt-2 rounded-2xl flex items-center justify-between px-4 py-2.5 sticky top-2 z-30 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-tr from-indigo-600 to-indigo-500 rounded-lg flex items-center justify-center text-white shadow-md">
            <GraduationCap size={16} />
          </div>
          <span className="text-base font-black text-slate-800 tracking-tight">{APP_NAME}</span>
        </div>
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="w-9 h-9 flex items-center justify-center text-slate-600 bg-white/50 rounded-full active:scale-90 transition-transform"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-white/95 backdrop-blur-3xl z-50 md:hidden pt-20 px-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="space-y-4 pb-32">
            <div className="flex items-center gap-3 p-4 bg-indigo-50/50 rounded-[1.5rem] border border-indigo-100/50">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-lg">
                {user?.name.charAt(0)}
              </div>
              <div>
                <p className="font-black text-slate-900 text-base leading-none">{user?.name}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-1">{user?.email}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
                {navItems.map((item) => (
                <button
                    key={item.id}
                    onClick={() => { setView(item.id); setMobileMenuOpen(false); }}
                    className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl text-xs font-black transition-all ${
                    currentView === item.id 
                        ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200' 
                        : 'bg-white border border-slate-100 text-slate-500'
                    }`}
                >
                    {React.cloneElement(item.icon as React.ReactElement<any>, { size: 20, className: 'rtl-flip' })}
                    <span>{item.label}</span>
                </button>
                ))}
            </div>

            <button onClick={logout} className="w-full flex items-center justify-center gap-2 p-4 mt-4 rounded-2xl text-xs font-black text-rose-600 bg-rose-50 border border-rose-100">
              <LogOut size={18} className="rtl-flip" /> {t('logout').toUpperCase()}
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area - Fixed behavior for Chat vs Others */}
      <main className={`flex-1 relative z-10 flex flex-col overflow-hidden h-full`}>
        {/* 
           If it's chat, we want NO padding and NO internal scrolling in the wrapper 
           because ChatRoom handles its own scrolling.
           If it's normal view, we want padding and scrolling.
        */}
        <div className={`flex-1 w-full h-full ${isChat ? 'overflow-hidden' : 'overflow-y-auto hide-scrollbar p-3 md:p-6 pb-24 md:pb-6'}`}>
          <div className={`${isChat ? 'h-full w-full' : 'max-w-5xl mx-auto min-h-full'}`}>
            {children}
          </div>
        </div>
      </main>

      {/* Mobile Floating Tab Bar - Liquid Glass */}
      {!isChat && (
        <nav className="md:hidden fixed bottom-4 left-4 right-4 glass-nav h-14 flex justify-around items-center z-40 shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-[1.5rem] animate-in slide-in-from-bottom-20 duration-500">
          {mobileBarItems.map(item => (
            <button 
              key={item.id} 
              onClick={() => setView(item.id)} 
              className={`flex flex-col items-center justify-center w-10 h-10 rounded-xl transition-all duration-300 ${currentView === item.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 -translate-y-2 scale-110' : 'text-slate-400'}`}
            >
              {React.cloneElement(item.icon as React.ReactElement<any>, { size: 18, strokeWidth: 2.5, className: 'rtl-flip' })}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
};

export default DashboardLayout;
