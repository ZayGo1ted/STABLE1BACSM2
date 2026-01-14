
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppState, User, AcademicItem, Resource, UserRole, ChatMessage, Lesson, AiLog } from '../types';
import { INITIAL_SUBJECTS } from '../constants';

const SUPABASE_URL = 'https://lbfdweyzaqmlkcfgixmn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxiZmR3ZXl6YXFtbGtjZmdpeG1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2ODE1NjAsImV4cCI6MjA4MjI1NzU2MH0.wD_mWSrD1ayCeEzVOcLPgn1ihxXemwzHYXSB_3IsjlQ';

let supabaseInstance: SupabaseClient | null = null;

export const getSupabase = () => {
  if (!supabaseInstance) {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseInstance;
};

/**
 * Compression Utility
 * Optimized for Mobile PWA:
 * 1. Max width 1600px (Balance between quality and RAM usage)
 * 2. Aggressive cleanup of canvas/image objects
 */
const compressFile = async (file: File): Promise<File> => {
  if (!file.type.startsWith('image/')) return file;
  if (file.type.includes('svg') || file.type.includes('gif')) return file;

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // 1600px is safer for mobile memory than 1920px
        const MAX_WIDTH = 1600; 
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round(height * (MAX_WIDTH / width));
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            // Cleanup memory immediately
            img.src = ''; 
            canvas.width = 0;
            canvas.height = 0;

            if (!blob) {
              resolve(file); 
              return;
            }
            
            const newName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
            const newFile = new File([blob], newName, {
              type: 'image/webp',
              lastModified: Date.now(),
            });
            
            console.log(`Compressed: ${(file.size/1024/1024).toFixed(2)}MB -> ${(newFile.size/1024/1024).toFixed(2)}MB`);
            resolve(newFile);
          },
          'image/webp',
          0.75 
        );
      };
      
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
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

    const mappedLessons = (lessons || []).map(l => ({
      id: l.id,
      title: l.title,
      subjectId: l.subject_id,
      type: l.type,
      description: l.description,
      aiMetadata: l.ai_metadata || '',
      fileUrl: l.file_url,
      attachments: Array.isArray(l.attachments) ? l.attachments : (l.file_url ? [{ name: 'Main File', url: l.file_url, type: 'file' }] : []),
      date: l.date_written || '', 
      startTime: l.start_time || '', 
      endTime: l.end_time || '',
      keywords: Array.isArray(l.keywords) ? l.keywords : [],
      isPublished: l.is_published,
      createdAt: l.created_at
    }));

    return {
      users: (users || []).map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role as UserRole, studentNumber: u.student_number, createdAt: u.created_at })),
      items: (items || []).map(item => ({
        id: item.id,
        title: item.title,
        subjectId: item.subject_id,
        type: item.type,
        date: item.date,
        time: item.time || '08:00',
        location: item.location,
        notes: item.notes,
        resources: (resources || []).filter(r => r.item_id === item.id).map(r => ({ id: r.id, title: r.title, type: r.type, url: r.url }))
      })),
      lessons: mappedLessons,
      timetable: (timetable || []).map((e: any) => ({ id: e.id, day: e.day, startHour: e.start_hour, endHour: e.end_hour, subjectId: e.subject_id, color: e.color, room: e.room })),
      subjects: INITIAL_SUBJECTS
    };
  },

  registerUser: async (user: User) => getSupabase().from('users').insert([{ id: user.id, email: user.email.toLowerCase(), name: user.name, role: user.role, student_number: user.studentNumber, created_at: user.createdAt }]),
  updateUser: async (user: User) => getSupabase().from('users').update({ name: user.name, role: user.role, student_number: user.studentNumber }).eq('id', user.id),
  deleteUser: async (id: string) => getSupabase().from('users').delete().eq('id', id),
  getUserByEmail: async (email: string) => getSupabase().from('users').select('*').eq('email', email.toLowerCase()).maybeSingle(),
  
  createAcademicItem: async (item: AcademicItem) => getSupabase().from('academic_items').insert([{ id: item.id, title: item.title, subject_id: item.subjectId, type: item.type, date: item.date, time: item.time, location: item.location, notes: item.notes }]),
  updateAcademicItem: async (item: AcademicItem) => getSupabase().from('academic_items').update({ title: item.title, subject_id: item.subjectId, type: item.type, date: item.date, time: item.time, location: item.location, notes: item.notes }).eq('id', item.id),
  deleteAcademicItem: async (id: string) => getSupabase().from('academic_items').delete().eq('id', id),

  createLesson: async (lesson: Lesson) => {
    const { error } = await getSupabase().from('lessons').insert([{ 
      id: lesson.id, title: lesson.title, subject_id: lesson.subjectId, type: lesson.type, description: lesson.description, ai_metadata: lesson.aiMetadata,
      attachments: lesson.attachments, date_written: lesson.date, start_time: lesson.startTime, end_time: lesson.endTime, keywords: lesson.keywords, is_published: lesson.isPublished 
    }]);
    if (error) throw error; // Throw to UI
  },

  updateLesson: async (lesson: Lesson) => {
    const { error } = await getSupabase().from('lessons').update({
      title: lesson.title, subject_id: lesson.subjectId, type: lesson.type, description: lesson.description, ai_metadata: lesson.aiMetadata,
      attachments: lesson.attachments, date_written: lesson.date, start_time: lesson.startTime, end_time: lesson.endTime, keywords: lesson.keywords, is_published: lesson.isPublished
    }).eq('id', lesson.id);
    if (error) throw error; // Throw to UI
  },
  
  deleteLesson: async (id: string) => {
    const { error, count } = await getSupabase().from('lessons').delete({ count: 'exact' }).eq('id', id);
    if (error) return { error };
    if (count === 0) return { error: { message: 'Deletion failed. Item not found or permission denied.' } };
    return { error: null };
  },
  
  fetchMessages: async (limit: number = 100): Promise<ChatMessage[]> => {
    const { data, error } = await getSupabase().from('messages').select('*').order('created_at', { ascending: true }).limit(limit);
    if (error) return [];
    return (data || []).map(m => ({ id: m.id, userId: m.user_id, content: m.content, type: m.type, mediaUrl: m.media_url, fileName: m.file_name, createdAt: m.created_at, reactions: m.reactions || [], readBy: m.read_by || [] }));
  },

  sendMessage: async (msg: { userId: string; content: string; type?: string; mediaUrl?: string; fileName?: string }) => {
    return getSupabase().from('messages').insert([{ user_id: msg.userId, content: msg.content, type: msg.type || 'text', media_url: msg.mediaUrl || null, file_name: msg.fileName || null }]);
  },

  deleteMessage: async (id: string) => getSupabase().from('messages').delete().eq('id', id),
  clearChat: async () => getSupabase().from('messages').delete().neq('id', '00000000-0000-0000-0000-000000000000'),

  uploadFile: async (file: File) => {
    // 1. Compress
    const processedFile = await compressFile(file);

    // 2. Sanitize Filename (Critical for Supabase Storage)
    const cleanName = processedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_').substring(0, 50);
    const fileName = `${Date.now()}_${cleanName}`;
    
    // 3. Upload
    const { error } = await getSupabase().storage.from('lessons').upload(fileName, processedFile, {
        cacheControl: '3600',
        upsert: false
    });
    
    if (error) throw error;
    
    // 4. Return Public URL
    const { data } = getSupabase().storage.from('lessons').getPublicUrl(fileName);
    return { url: data.publicUrl, size: processedFile.size };
  },

  createAiLog: async (userId: string, query: string) => {
    if (!userId) return;
    try {
      await getSupabase().from('ai_logs').insert([{ user_id: userId, query: query, status: 'unresolved' }]);
    } catch (e) { console.error(e); }
  },

  fetchAiLogs: async () => {
    const { data, error } = await getSupabase().from('ai_logs').select(`id, query, created_at, status, user_id, users ( name )`).order('created_at', { ascending: false });
    if (error) return [];
    return data.map((log: any) => ({ id: log.id, userId: log.user_id, userName: log.users?.name || 'Unknown', query: log.query, createdAt: log.created_at, status: log.status }));
  },

  resolveLog: async (id: string) => getSupabase().from('ai_logs').update({ status: 'resolved' }).eq('id', id)
};
