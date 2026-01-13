import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppState, User, AcademicItem, Resource, UserRole, ChatMessage, Reaction, Lesson, AiLog } from '../types';

// Hardcoded Supabase configuration for the classroom hub
const SUPABASE_URL = 'https://lbfdweyzaqmlkcfgixmn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxiZmR3ZXl6YXFtbGtjZmdpeG1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2ODE1NjAsImV4cCI6MjA4MjI1NzU2MH0.wD_mWSrD1ayCeEzVOcLPgn1ihxXemwzHYXSB_3IsjlQ';

let supabaseInstance: SupabaseClient | null = null;

export const getSupabase = () => {
  if (!supabaseInstance) {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseInstance;
};

export const supabaseService = {
  isConfigured: () => true,

  fetchFullState: async () => {
    const client = getSupabase();
    const [ { data: users }, { data: items }, { data: resources }, { data: lessons } ] = await Promise.all([
      client.from('users').select('*'),
      client.from('academic_items').select('*'),
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
      aiMetadata: l.ai_metadata || '',
      fileUrl: l.file_url,
      date: l.date_written || '', // Map date
      startTime: l.start_time || '', 
      endTime: l.end_time || '',
      keywords: l.keywords || [],
      isPublished: l.is_published,
      createdAt: l.created_at
    }));

    return {
      users: (users || []).map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role as UserRole, studentNumber: u.student_number, createdAt: u.created_at })),
      items: mappedItems,
      lessons: mappedLessons
    };
  },

  // ... User and AcademicItem methods remain unchanged ...
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

  // Lessons
  createLesson: async (lesson: Lesson) => {
    return getSupabase().from('lessons').insert([{ 
      id: lesson.id, 
      title: lesson.title, 
      subject_id: lesson.subjectId, 
      type: lesson.type, 
      description: lesson.description, 
      ai_metadata: lesson.aiMetadata,
      file_url: lesson.fileUrl, 
      date_written: lesson.date,
      start_time: lesson.startTime, 
      end_time: lesson.endTime,     
      keywords: lesson.keywords, 
      is_published: lesson.isPublished, 
      created_at: lesson.createdAt 
    }]);
  },
  
  deleteLesson: async (id: string) => getSupabase().from('lessons').delete().eq('id', id),
  
  uploadFile: async (file: File) => {
    const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${crypto.randomUUID()}_${cleanName}`;
    // Using 'lessons' bucket for lessons specifically
    const { error } = await getSupabase().storage.from('lessons').upload(fileName, file);
    if (error) throw error;
    return getSupabase().storage.from('lessons').getPublicUrl(fileName).data.publicUrl;
  },

  // Logs
  createAiLog: async (userId: string, query: string) => {
    await getSupabase().from('ai_logs').insert([{ user_id: userId, query: query }]);
  },

  fetchAiLogs: async () => {
    const { data, error } = await getSupabase().from('ai_logs').select(`
      id, query, created_at, status, user_id,
      users ( name )
    `).order('created_at', { ascending: false });
    
    if (error) return [];
    
    return data.map((log: any) => ({
      id: log.id,
      userId: log.user_id,
      userName: log.users?.name || 'Unknown',
      query: log.query,
      createdAt: log.created_at,
      status: log.status
    }));
  },

  resolveLog: async (id: string) => {
    await getSupabase().from('ai_logs').update({ status: 'resolved' }).eq('id', id);
  },

  // Chat
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
    const cleanName = isFile ? (file as File).name.replace(/[^a-zA-Z0-9.-]/g, '_') : 'audio.webm';
    const fileName = `${crypto.randomUUID()}_${cleanName}`;
    const { error } = await getSupabase().storage.from(bucket).upload(fileName, file, { upsert: false, contentType: isFile ? file.type : 'audio/webm' });
    if (error) throw error;
    return getSupabase().storage.from(bucket).getPublicUrl(fileName).data.publicUrl;
  },

  updateReactions: async (messageId: string, reactions: Reaction[]) => {
    await getSupabase().from('messages').update({ reactions: reactions }).eq('id', messageId);
  }
};


