
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, UserRole, AppState, AcademicItem, Language, Lesson } from './types';
import { supabaseService, getSupabase } from './services/supabaseService';
import { storageService } from './services/storageService'; 
import { TRANSLATIONS, INITIAL_SUBJECTS } from './constants';
import { AuthContext, AuthContextType } from './AuthContext';
import Login from './components/Login';
import DashboardLayout from './components/DashboardLayout';
import Overview from './components/Overview';
import CalendarView from './components/CalendarView';
import SubjectsView from './components/SubjectsView';
import LessonsView from './components/LessonsView';
import ClassList from './components/ClassList';
import AdminPanel from './components/AdminPanel';
import DevTools from './components/DevTools';
import Credits from './components/Credits';
import ChatRoom from './components/ChatRoom';
import { CloudOff, AlertTriangle, WifiOff } from 'lucide-react';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(() => {
    const local = storageService.loadState();
    return {
      ...local,
      subjects: INITIAL_SUBJECTS 
    };
  });

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState('overview');
  const [configError, setConfigError] = useState<string | null>(null);
  const [syncWarning, setSyncWarning] = useState<boolean>(false);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [isBrowserOffline, setIsBrowserOffline] = useState(!navigator.onLine);
  
  // Edit States
  const [pendingEditItem, setPendingEditItem] = useState<AcademicItem | null>(null);
  const [pendingEditLesson, setPendingEditLesson] = useState<Lesson | null>(null);
  
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  const currentUserRef = useRef<User | null>(null);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  // Event Listener for Edit Requests from deeply nested components
  useEffect(() => {
    const handleEditLesson = (e: any) => {
        setPendingEditLesson(e.detail);
        setCurrentView('admin');
    };
    window.addEventListener('editLesson', handleEditLesson);
    return () => window.removeEventListener('editLesson', handleEditLesson);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('hub_user_session');
    setCurrentUser(null);
    setCurrentView('overview');
  }, []);

  const syncFromCloud = async () => {
    if (!navigator.onLine) {
      setIsBrowserOffline(true);
      return;
    }

    if (!supabaseService.isConfigured()) {
      setConfigError("Missing Supabase Configuration.");
      return;
    }

    try {
      const cloudData = await supabaseService.fetchFullState();
      
      const newState = {
        users: cloudData.users,
        items: cloudData.items,
        lessons: cloudData.lessons,
        subjects: INITIAL_SUBJECTS,
        timetable: cloudData.timetable || [],
        language: appState.language
      };

      setAppState(newState);
      storageService.saveState(newState);

      if (currentUserRef.current) {
        const dbMe = cloudData.users.find(u => u.id === currentUserRef.current?.id);
        if (!dbMe) {
          logout();
          return;
        }
        if (dbMe.role !== currentUserRef.current?.role) {
          const updated = { ...currentUserRef.current, role: dbMe.role };
          setCurrentUser(updated);
          localStorage.setItem('hub_user_session', JSON.stringify(updated));
        }
      }
      setConfigError(null);
      setSyncWarning(false);
    } catch (e: any) {
      if (e.message?.includes("key") || e.message?.includes("URL")) {
        setConfigError(e.message);
      } else {
        setSyncWarning(true);
      }
    }
  };

  useEffect(() => {
    const remembered = localStorage.getItem('hub_user_session');
    if (remembered) {
      try {
        const user = JSON.parse(remembered);
        setCurrentUser(user);
      } catch (e) {
        localStorage.removeItem('hub_user_session');
      }
    }
    syncFromCloud();
    const handleOnline = () => { setIsBrowserOffline(false); syncFromCloud(); };
    const handleOffline = () => setIsBrowserOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!currentUser || isBrowserOffline) return;
    try {
      const supabase = getSupabase();
      const presenceChannel = supabase.channel('classroom_presence', {
        config: { presence: { key: currentUser.id } },
      });
      presenceChannel
        .on('presence', { event: 'sync' }, () => {
          const state = presenceChannel.presenceState();
          setOnlineUserIds(new Set(Object.keys(state)));
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await presenceChannel.track({ user_id: currentUser.id, online_at: new Date().toISOString() });
          }
        });
      return () => { presenceChannel.unsubscribe(); };
    } catch (e) {}
  }, [currentUser?.id, isBrowserOffline]);

  useEffect(() => {
    document.documentElement.dir = appState.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = appState.language;
  }, [appState.language]);

  const t = (key: string) => TRANSLATIONS[appState.language][key] || key;

  const login = async (email: string, remember: boolean) => {
    if (isBrowserOffline) {
      const localUser = appState.users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (localUser) {
        setCurrentUser(localUser);
        if (remember) localStorage.setItem('hub_user_session', JSON.stringify(localUser));
        return true;
      }
      return false;
    }
    try {
      const { data, error } = await supabaseService.getUserByEmail(email);
      if (data && !error) {
        setCurrentUser(data);
        if (remember) localStorage.setItem('hub_user_session', JSON.stringify(data));
        return true;
      }
    } catch (e) {}
    return false;
  };

  const register = async (name: string, email: string, remember: boolean, secret?: string) => {
    if (isBrowserOffline) return false;
    const role = (secret === 'otmane55') ? UserRole.DEV : UserRole.STUDENT;
    const newUser: User = {
      id: crypto.randomUUID(),
      name,
      email: email.toLowerCase(),
      role,
      createdAt: new Date().toISOString(),
      studentNumber: `STU-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`
    };
    try {
      const { error } = await supabaseService.registerUser(newUser);
      if (error) throw error;
      const newUsers = [...appState.users, newUser];
      setAppState(prev => ({ ...prev, users: newUsers }));
      storageService.saveState({ ...appState, users: newUsers });
      setCurrentUser(newUser);
      if (remember) localStorage.setItem('hub_user_session', JSON.stringify(newUser));
      return true;
    } catch (e) {
      return false;
    }
  };

  const isDev = currentUser?.role === UserRole.DEV;
  const isAdmin = currentUser?.role === UserRole.ADMIN || isDev;

  const setLang = (l: Language) => {
    setAppState(prev => {
      const next = { ...prev, language: l };
      storageService.saveState(next); 
      return next;
    });
  };

  const updateAppState = async (updates: Partial<AppState>) => {
    setAppState(prev => {
      const next = { ...prev, ...updates };
      storageService.saveState(next);
      return next;
    });
  };

  const authValue: AuthContextType = { 
    user: currentUser, login, register, logout, isDev, isAdmin, t, lang: appState.language, setLang, onlineUserIds 
  };

  if (configError && !isBrowserOffline) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white p-10 rounded-[2.5rem] shadow-2xl border border-rose-100 text-center space-y-6">
          <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <CloudOff size={40} />
          </div>
          <h1 className="text-2xl font-black text-slate-900">Cloud Connection Error</h1>
          <p className="text-slate-500 font-bold text-sm leading-relaxed">{configError}</p>
          <button onClick={() => window.location.reload()} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-lg">Retry Connection</button>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={authValue}>
      <div className="h-screen w-screen overflow-hidden bg-slate-50 relative select-none">
        {isBrowserOffline && (
          <div className="fixed top-0 left-0 right-0 bg-slate-800 text-white p-2 text-center text-[10px] font-black z-[100] flex items-center justify-center gap-2 shadow-xl">
            <WifiOff size={12} className="text-rose-400" /> OFFLINE MODE - VIEWING SAVED DATA
          </div>
        )}
        {!currentUser ? (
          <>
            {syncWarning && !isBrowserOffline && (
              <div className="fixed top-0 left-0 right-0 bg-amber-500 text-white p-2 text-center text-[10px] font-black z-[100] flex items-center justify-center gap-2">
                <AlertTriangle size={12} /> SYNC ISSUE: DATA MAY BE STALE
              </div>
            )}
            <Login />
          </>
        ) : (
          <DashboardLayout currentView={currentView} setView={setCurrentView}>
            {(() => {
              switch (currentView) {
                case 'overview': return <Overview items={appState.items} subjects={appState.subjects} onSubjectClick={(id) => { setSelectedSubjectId(id); setCurrentView('subjects'); }} />;
                case 'chat': return <ChatRoom />;
                case 'calendar': return <CalendarView items={appState.items} subjects={appState.subjects} onUpdate={updateAppState} onEditRequest={(item) => { setPendingEditItem(item); setCurrentView('admin'); }} />;
                case 'subjects': return <SubjectsView items={appState.items} subjects={appState.subjects} onUpdate={updateAppState} initialSubjectId={selectedSubjectId} clearInitialSubject={() => setSelectedSubjectId(null)} />;
                case 'lessons': return <LessonsView state={appState} onUpdate={updateAppState} />;
                case 'classlist': return <ClassList users={appState.users} onUpdate={updateAppState} />;
                case 'credits': return <Credits />;
                case 'admin': return isAdmin ? <AdminPanel items={appState.items} subjects={appState.subjects} onUpdate={updateAppState} initialEditItem={pendingEditItem} initialEditLesson={pendingEditLesson} onEditHandled={() => { setPendingEditItem(null); setPendingEditLesson(null); }} /> : <Overview items={appState.items} subjects={appState.subjects} onSubjectClick={() => {}} />;
                case 'dev': return isDev ? <DevTools state={appState} onUpdate={updateAppState} /> : <Overview items={appState.items} subjects={appState.subjects} onSubjectClick={() => {}} />;
                default: return <Overview items={appState.items} subjects={appState.subjects} onSubjectClick={() => {}} />;
              }
            })()}
          </DashboardLayout>
        )}
      </div>
    </AuthContext.Provider>
  );
};

export default App;
