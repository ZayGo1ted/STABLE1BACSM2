
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppState, User, AcademicItem, Resource, UserRole, ChatMessage, Reaction, Lesson, AiLog } from '../types';

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
    const [ { data: users }, { data: items }, { data: resources }, { data: lessons }, { data: timetable } ] = await Promise.all([
      client.from('users').select('*'),
      client.from('academic_items').select('*'),
      client.from('resources').select('*'),
      client.from('lessons').select('*'),
      client.from('timetable').select('*')
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
      attachments: l.attachments || (l.file_url ? [{ name: 'Main File', url: l.file_url, type: 'file' }] : []),
      date: l.date_written || '', 
      startTime: l.start_time || '', 
      endTime: l.end_time || '',
      keywords: l.keywords || [],
      isPublished: l.is_published,
      createdAt: l.created_at
    }));

    return {
      users: (users || []).map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role as UserRole, studentNumber: u.student_number, createdAt: u.created_at })),
      items: mappedItems,
      lessons: mappedLessons,
      timetable: (timetable || []).map((e: any) => ({ id: e.id, day: e.day, startHour: e.start_hour, endHour: e.end_hour, subjectId: e.subject_id, color: e.color, room: e.room }))
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
    return data;
  },

  updateAcademicItem: async (item: AcademicItem) => {
    const client = getSupabase();
    await client.from('academic_items').update({ title: item.title, subject_id: item.subjectId, type: item.type, date: item.date, time: item.time, location: item.location, notes: item.notes }).eq('id', item.id);
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
      file_url: lesson.attachments[0]?.url || '', 
      attachments: lesson.attachments,
      date_written: lesson.date,
      start_time: lesson.startTime, 
      end_time: lesson.endTime,     
      keywords: lesson.keywords, 
      is_published: lesson.isPublished, 
      created_at: lesson.createdAt 
    }]);
  },

  updateLesson: async (lesson: Lesson) => {
    return getSupabase().from('lessons').update({
      title: lesson.title,
      subject_id: lesson.subjectId,
      type: lesson.type,
      description: lesson.description,
      ai_metadata: lesson.aiMetadata,
      file_url: lesson.attachments[0]?.url || '',
      attachments: lesson.attachments,
      date_written: lesson.date,
      start_time: lesson.startTime,
      end_time: lesson.endTime,
      keywords: lesson.keywords,
      is_published: lesson.isPublished
    }).eq('id', lesson.id);
  },
  
  deleteLesson: async (id: string) => getSupabase().from('lessons').delete().eq('id', id),
  
  // Chat Messages
  fetchMessages: async (limit: number = 100): Promise<ChatMessage[]> => {
    const client = getSupabase();
    const { data, error } = await client
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) {
      console.error("Fetch Messages Error:", error);
      return [];
    }
    return (data || []).map(m => ({
      id: m.id,
      userId: m.user_id,
      content: m.content,
      type: m.type,
      mediaUrl: m.media_url,
      fileName: m.file_name,
      createdAt: m.created_at,
      reactions: m.reactions || [],
      readBy: m.read_by || []
    }));
  },

  sendMessage: async (msg: { userId: string; content: string; type?: string; mediaUrl?: string; fileName?: string }) => {
    const client = getSupabase();
    const { error } = await client.from('messages').insert([{
      user_id: msg.userId,
      content: msg.content,
      type: msg.type || 'text',
      media_url: msg.mediaUrl || null,
      file_name: msg.fileName || null
    }]);
    if (error) throw error;
  },

  deleteMessage: async (id: string) => {
    const client = getSupabase();
    const { error } = await client.from('messages').delete().eq('id', id);
    if (error) throw error;
  },

  clearChat: async () => {
    const client = getSupabase();
    const { error } = await client.from('messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
  },

  uploadFile: async (file: File) => {
    const client = getSupabase();
    // Sanitize filename: remove non-ascii, spaces to underscores
    const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${Date.now()}_${cleanName}`;
    
    const { data, error } = await client.storage
      .from('lessons')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });
    
    if (error) {
      console.error("Supabase Storage Error:", error);
      throw new Error(`Storage Error: ${error.message}. Ensure RLS policies allow 'anon' role to insert into 'lessons' bucket.`);
    }
    
    const { data: urlData } = client.storage.from('lessons').getPublicUrl(fileName);
    return urlData.publicUrl;
  },

  // Logs
  createAiLog: async (userId: string, query: string) => {
    try {
      const { error } = await getSupabase().from('ai_logs').insert([{ 
        user_id: userId, 
        query: query, 
        status: 'unresolved' 
      }]);
      if (error) throw error;
    } catch (e) {
      console.error("Critical: Failed to create AI Log", e);
    }
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
  }
};
