
import { createContext, useContext } from 'react';
import { User, Language } from './types';

export interface AuthContextType {
  user: User | null;
  login: (email: string, remember: boolean) => Promise<boolean>;
  register: (name: string, email: string, remember: boolean, secret?: string) => Promise<boolean>;
  logout: () => void;
  isDev: boolean;
  isAdmin: boolean;
  t: (key: string) => string;
  lang: Language;
  setLang: (l: Language) => void;
  onlineUserIds: Set<string>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
