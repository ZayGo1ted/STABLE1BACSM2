
import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { 
  LogIn, Code, UserPlus, GraduationCap, Mail, Lock, User as UserIcon,
  ChevronRight, AlertTriangle, CheckSquare, Square
} from 'lucide-react';
import { APP_NAME } from '../constants';

const Login: React.FC = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [secret, setSecret] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const { login, register, t, lang, setLang } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegistering) {
        const success = await register(name, email, remember, secret);
        if (!success) setError('Registration failed.');
      } else {
        const success = await login(email, remember);
        if (!success) setError('User not found.');
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred');
    }
  };

  const isRtl = lang === 'ar';

  return (
    <div className={`h-screen w-full flex flex-col items-center justify-center relative overflow-hidden ${isRtl ? 'font-[Tajawal]' : ''}`}>
      {/* Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-300/30 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-300/30 rounded-full blur-[120px] animate-pulse delay-1000"></div>

      <div className="fixed top-4 right-4 flex gap-1 glass-panel p-1.5 rounded-2xl z-50">
        {['en', 'fr', 'ar'].map((l) => (
          <button
            key={l}
            onClick={() => setLang(l as any)}
            className={`px-3 py-1 rounded-xl text-[10px] font-black transition-all ${
              lang === l ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-indigo-600'
            }`}
          >
            {l.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="w-full max-w-[380px] glass-card rounded-[3rem] p-8 md:p-10 flex flex-col relative z-10 animate-in zoom-in-95 duration-500">
        <div className="text-center mb-8 shrink-0">
          <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-[1.5rem] flex items-center justify-center mx-auto mb-4 shadow-xl shadow-indigo-200">
            <GraduationCap className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight leading-none">{APP_NAME}</h1>
          <p className="text-indigo-500 font-bold mt-2 uppercase tracking-[0.2em] text-[10px]">Student Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegistering && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">{t('name')}</label>
              <div className="relative group">
                <div className={`absolute inset-y-0 ${isRtl ? 'right-4' : 'left-4'} flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors`}>
                  <UserIcon size={18} />
                </div>
                <input
                  type="text"
                  value={name}
                  placeholder="John Doe"
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full bg-white/50 border border-white/60 focus:bg-white rounded-2xl py-3.5 focus:border-indigo-500 transition-all outline-none font-bold text-sm text-slate-700 placeholder:text-slate-300 shadow-sm ${isRtl ? 'pr-11 pl-4' : 'pl-11 pr-4'}`}
                  required
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">{t('email')}</label>
            <div className="relative group">
              <div className={`absolute inset-y-0 ${isRtl ? 'right-4' : 'left-4'} flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors`}>
                <Mail size={18} />
              </div>
              <input
                type="email"
                value={email}
                placeholder="student@example.com"
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full bg-white/50 border border-white/60 focus:bg-white rounded-2xl py-3.5 focus:border-indigo-500 transition-all outline-none font-bold text-sm text-slate-700 placeholder:text-slate-300 shadow-sm ${isRtl ? 'pr-11 pl-4' : 'pl-11 pr-4'}`}
                required
              />
            </div>
          </div>

          {isRegistering && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">{t('secret')}</label>
              <div className="relative group">
                <div className={`absolute inset-y-0 ${isRtl ? 'right-4' : 'left-4'} flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors`}>
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  value={secret}
                  placeholder="Invite Code (Optional)"
                  onChange={(e) => setSecret(e.target.value)}
                  className={`w-full bg-white/50 border border-white/60 focus:bg-white rounded-2xl py-3.5 focus:border-indigo-500 transition-all outline-none font-bold text-sm text-slate-700 placeholder:text-slate-300 shadow-sm ${isRtl ? 'pr-11 pl-4' : 'pl-11 pr-4'}`}
                />
              </div>
            </div>
          )}

          <button 
            type="button"
            onClick={() => setRemember(!remember)}
            className="flex items-center gap-2 px-2 py-1 group transition-all"
          >
            {remember ? (
              <CheckSquare size={16} className="text-indigo-600" />
            ) : (
              <Square size={16} className="text-slate-300 group-hover:text-slate-400" />
            )}
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Keep me signed in</span>
          </button>
          
          {error && (
            <div className="flex items-start gap-3 p-3 bg-rose-50/80 border border-rose-100 rounded-2xl backdrop-blur-sm">
              <AlertTriangle className="text-rose-500 shrink-0 mt-0.5" size={16} />
              <p className="text-rose-600 text-xs font-bold leading-tight">{error}</p>
            </div>
          )}
          
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl shadow-lg shadow-indigo-200 transition-all active:scale-[0.98] flex items-center justify-center gap-3 text-sm mt-2"
          >
            {isRegistering ? <UserPlus size={18}/> : <LogIn size={18} className="rtl-flip"/>}
            <span>{isRegistering ? t('register') : t('login')}</span>
            <ChevronRight size={16} className={`opacity-60 ${isRtl ? 'rotate-180' : ''}`} />
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-100 text-center">
          <button 
            onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
            className="text-indigo-600 font-black hover:text-indigo-800 text-xs transition-colors uppercase tracking-wide"
          >
            {isRegistering ? "Existing account? Login" : "New student? Create Account"}
          </button>
        </div>
      </div>
      
      <div className="mt-8 flex items-center gap-2 text-slate-400 font-black text-[9px] uppercase tracking-[0.3em] opacity-40">
        <Code size={12} className="text-indigo-400" /> Secure Hub V2
      </div>
    </div>
  );
};

export default Login;
