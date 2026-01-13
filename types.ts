
export enum UserRole {
  DEV = 'DEV',
  ADMIN = 'ADMIN',
  STUDENT = 'STUDENT'
}

export type Language = 'en' | 'fr' | 'ar';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  studentNumber?: string;
  createdAt: string;
  isOnline?: boolean;
}

export interface Resource {
  id: string;
  title: string;
  type: 'pdf' | 'video' | 'link' | 'note' | 'exercise';
  url: string;
}

export interface LessonAttachment {
  name: string;
  url: string;
  type: 'file' | 'image' | 'video';
  size?: number;
}

export interface Lesson {
  id: string;
  title: string;
  subjectId: string;
  type: 'lesson' | 'summary' | 'exercise' | 'exam_prep';
  description: string; // Visible to students (can contain parts info)
  aiMetadata: string; // Hidden context
  fileUrl?: string; // Legacy main file
  attachments: LessonAttachment[]; // Multiple files
  date: string;       
  startTime: string;  
  endTime: string;    
  keywords: string[];
  isPublished: boolean;
  createdAt: string;
}

export interface AcademicItem {
  id: string;
  title: string;
  subjectId: string;
  type: 'exam' | 'homework' | 'event' | 'task';
  date: string;
  time?: string;
  location?: string;
  notes: string;
  resources: Resource[];
}

export interface Subject {
  id: string;
  name: Record<Language, string>;
  description: Record<Language, string>;
  color: string;
  coefficient: number;
}

export interface Reaction {
  userId: string;
  emoji: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'audio';
  mediaUrl?: string;
  fileName?: string;
  createdAt: string;
  reactions: Reaction[];
  readBy: string[];
}

export interface AiLog {
  id: string;
  userId: string;
  userName?: string; 
  query: string;
  createdAt: string;
  status: 'unresolved' | 'resolved';
}

export interface TimetableEntry {
  id: string;
  day: number;
  startHour: number;
  endHour: number;
  subjectId: string;
  color: string;
  room: string;
}

export interface AppState {
  users: User[];
  subjects: Subject[];
  items: AcademicItem[];
  lessons: Lesson[];
  timetable: TimetableEntry[];
  language: Language;
}
