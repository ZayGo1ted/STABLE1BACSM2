
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppState, User, AcademicItem, TimetableEntry, Resource, UserRole, ChatMessage, Reaction, Lesson } from '../types';

const getEnvVar = (key: string): string => {
  const metaEnv = (import.meta as any).env;
  if (metaEnv && metaEnv[key]) return metaEnv[key];
  if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key];
  if (typeof window !== 'undefined' && (window as any)[key]) return (window as any)[key];
  return '';
};

const SUPABASE_URL = getEnvVar('VITE_SUPABASE_URL') || 'https://lbfdweyzaqmlkcfgixmn.supabase.co';
const API_KEY = getEnvVar('VITE_SUPABASE_ANON_KEY') || getEnvVar('API_KEY') || getEnvVar('VITE_API_KEY');

let supabaseInstance: SupabaseClient | null = null;

export const getSupabase = () => {
  if (!supabaseInstance) supabaseInstance = createClient(SUPABASE_URL, API_KEY);
  return supabaseInstance;
};

export const supabaseService = {
  isConfigured: () => API_KEY.length > 0 && SUPABASE_URL.length > 0,

  fetchFullState: async () => {
    const client = getSupabase();
    const [ { data: users }, { data: items }, { data: timetable }, { data: resources }, { data: lessons } ] = await Promise.all([
      client.from('users').select('*'),
      client.from('academic_items').select('*'),
      client.from('timetable').select('*'),
      client.from('resources').select('*'),
      client.from('lessons').select('*')
    ]);

    const mappedItems = (items || []).map(item => ({
      id: item.id,
      title: item.title,
      subjectId: item.subject_id,
      type: item.type,
      date: item.date,
      time: item.time || '08:00',
      location: item.location,
      notes: item.notes,
      resources: (resources || []).filter(r => r.item_id === item.id).map(r => ({ id: r.id, title: r.title, type: r.type, url: r.url }))
    }));

    const mappedLessons = (lessons || []).map(l => ({
      id: l.id,
      title: l.title,
      subjectId: l.subject_id,
      type: l.type,
      description: l.description,
      fileUrl: l.file_url,
      estimatedTime: l.estimated_time,
      keywords: l.keywords || [],
      isPublished: l.is_published,
      createdAt: l.created_at
    }));

    return {
      users: (users || []).map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role as UserRole, studentNumber: u.student_number, createdAt: u.created_at })),
      items: mappedItems,
      timetable: (timetable || []).map(entry => ({ id: entry.id, day: entry.day, startHour: entry.start_hour, endHour: entry.end_hour, subjectId: entry.subject_id, color: entry.color, room: entry.room })),
      lessons: mappedLessons
    };
  },

  registerUser: async (user: User) => getSupabase().from('users').insert([{ id: user.id, email: user.email.toLowerCase(), name: user.name, role: user.role, student_number: user.studentNumber, created_at: user.createdAt }]),
  updateUser: async (user: User) => getSupabase().from('users').update({ name: user.name, role: user.role, student_number: user.studentNumber }).eq('id', user.id),
  deleteUser: async (id: string) => getSupabase().from('users').delete().eq('id', id),
  getUserByEmail: async (email: string) => getSupabase().from('users').select('*').eq('email', email.toLowerCase()).maybeSingle(),
  
  createAcademicItem: async (item: AcademicItem) => {
    const client = getSupabase();
    const { data, error } = await client.from('academic_items').insert([{ id: item.id, title: item.title, subject_id: item.subjectId, type: item.type, date: item.date, time: item.time, location: item.location, notes: item.notes }]).select().single();
    if (error) throw error;
    if (item.resources.length > 0) await client.from('resources').insert(item.resources.map(r => ({ id: r.id, item_id: data.id, title: r.title, type: r.type, url: r.url })));
    return data;
  },

  updateAcademicItem: async (item: AcademicItem) => {
    const client = getSupabase();
    const { error } = await client.from('academic_items').update({ title: item.title, subject_id: item.subjectId, type: item.type, date: item.date, time: item.time, location: item.location, notes: item.notes }).eq('id', item.id);
    if (error) throw error;
    await client.from('resources').delete().eq('item_id', item.id);
    if (item.resources.length > 0) await client.from('resources').insert(item.resources.map(r => ({ id: r.id, item_id: item.id, title: r.title, type: r.type, url: r.url })));
  },

  deleteAcademicItem: async (id: string) => getSupabase().from('academic_items').delete().eq('id', id),
  updateTimetable: async (entries: TimetableEntry[]) => {
    const client = getSupabase();
    await client.from('timetable').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (entries.length > 0) await client.from('timetable').insert(entries.map(e => ({ id: e.id, day: e.day, start_hour: e.startHour, end_hour: e.endHour, subject_id: e.subjectId, color: e.color, room: e.room })));
  },

  createLesson: async (lesson: Lesson) => getSupabase().from('lessons').insert([{ id: lesson.id, title: lesson.title, subject_id: lesson.subjectId, type: lesson.type, description: lesson.description, file_url: lesson.fileUrl, estimated_time: lesson.estimatedTime, keywords: lesson.keywords, is_published: lesson.isPublished, created_at: lesson.createdAt }]),
  deleteLesson: async (id: string) => getSupabase().from('lessons').delete().eq('id', id),
  uploadFile: async (file: File) => {
    const fileName = `${crypto.randomUUID()}.${file.name.split('.').pop()}`;
    const { error } = await getSupabase().storage.from('resources').upload(`uploads/${fileName}`, file);
    if (error) throw error;
    return getSupabase().storage.from('resources').getPublicUrl(`uploads/${fileName}`).data.publicUrl;
  },

  fetchMessages: async (limit = 50) => {
    const { data, error } = await getSupabase().from('messages').select('*').order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return (data || []).reverse().map((m: any) => ({ id: m.id, userId: m.user_id, content: m.content, type: m.type, mediaUrl: m.media_url, fileName: m.file_name, createdAt: m.created_at, reactions: m.reactions || [], readBy: m.read_by || [] }));
  },

  sendMessage: async (msg: Partial<ChatMessage>) => {
    const { data, error } = await getSupabase().from('messages').insert([{ content: msg.content, user_id: msg.userId, type: msg.type || 'text', media_url: msg.mediaUrl, file_name: msg.fileName, reactions: [] }]).select();
    if (error) throw error;
    return data?.[0];
  },

  deleteMessage: async (id: string) => {
    const { error } = await getSupabase().from('messages').delete().eq('id', id);
    if (error) throw error;
  },

  clearChat: async () => {
    const { error } = await getSupabase().from('messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
  },

  uploadChatMedia: async (file: Blob | File, bucket = 'chat-attachments') => {
    const isFile = file instanceof File;
    const fileName = `${crypto.randomUUID()}.${isFile ? (file as File).name.split('.').pop() : 'webm'}`;
    const { error } = await getSupabase().storage.from(bucket).upload(fileName, file, { upsert: false, contentType: isFile ? file.type : 'audio/webm' });
    if (error) throw error;
    return getSupabase().storage.from(bucket).getPublicUrl(fileName).data.publicUrl;
  },

  updateReactions: async (messageId: string, reactions: Reaction[]) => {
    await getSupabase().from('messages').update({ reactions: reactions }).eq('id', messageId);
  }
};
