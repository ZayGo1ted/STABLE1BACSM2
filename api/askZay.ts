// api/askZay.ts (CORRECTED VERSION)
// --- INLINED DEPENDENCIES TO FIX MODULE_NOT_FOUND ---
import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// --- INLINED CONSTANTS.TSX ---
const ZAY_USER_ID = '00000000-0000-0000-0000-000000000001';

// --- INLINED TYPES.TS (Only the parts we need) ---
interface User {
  id: string;
  email: string;
  name: string;
  role: 'DEV' | 'ADMIN' | 'STUDENT'; // Simplified UserRole enum
  studentNumber?: string;
  createdAt: string;
  isOnline?: boolean;
}

interface ChatMessage {
  id: string;
  userId: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'audio';
  mediaUrl?: string;
  fileName?: string;
  createdAt: string;
  reactions: any[]; // Simplified
  readBy: string[];
}

interface LessonAttachment {
  name: string;
  url: string;
  type: 'file' | 'image' | 'video';
  size?: number;
}

interface Lesson {
  id: string;
  title: string;
  subjectId: string;
  type: 'lesson' | 'summary' | 'exercise' | 'exam_prep';
  description: string;
  aiMetadata: string;
  fileUrl?: string;
  attachments: LessonAttachment[];
  date: string;
  startTime: string;
  endTime: string;
  keywords: string[];
  isPublished: boolean;
  createdAt: string;
}

interface AcademicItem {
  id: string;
  title: string;
  subjectId: string;
  type: 'exam' | 'homework' | 'event' | 'task';
  date: string;
  time?: string;
  location?: string;
  notes: string;
  resources: any[]; // Simplified Resource
}

interface Subject {
  id: string;
  name: { en: string; fr: string; ar: string };
  description: { en: string; fr: string; ar: string };
  color: string;
  coefficient: number;
}

const INITIAL_SUBJECTS: Subject[] = [
  { id: 'math', name: { en: 'Mathematics SM', fr: 'Mathématiques SM', ar: 'الرياضيات م.ر' }, description: { en: 'Logic, Sets, Functions', fr: 'Logique, Ensembles, Fonctions', ar: 'المنطق، المجموعات، الدوال' }, color: 'bg-blue-600', coefficient: 7 },
  { id: 'physics', name: { en: 'Physics & Chemistry', fr: 'Physique-Chimie', ar: 'الفيزياء والكيمياء' }, description: { en: 'Mechanics & Redox', fr: 'Mécanique & Redox', ar: 'الميكانيكا والكيمياء' }, color: 'bg-purple-600', coefficient: 7 },
  { id: 'svt', name: { en: 'SVT', fr: 'SVT', ar: 'علوم الحياة والأرض' }, description: { en: 'Geology & Biology', fr: 'Géologie & Biologie', ar: 'الجيولوجيا والبيولوجيا' }, color: 'bg-green-600', coefficient: 2 },
  { id: 'fr', name: { en: 'French', fr: 'Français', ar: 'اللغة الفرنسية' }, description: { en: 'The Antigone, Le Dernier Jour', fr: 'Antigone, Le Dernier Jour', ar: 'الأدب الفرنسي' }, color: 'bg-red-600', coefficient: 4 },
  { id: 'ar', name: { en: 'Arabic', fr: 'Arabe', ar: 'اللغة العربية' }, description: { en: 'Literature', fr: 'Littérature', ar: 'الأدب العربي' }, color: 'bg-emerald-600', coefficient: 2 },
  { id: 'islamic', name: { en: 'Islamic Education', fr: 'Éducation Islamique', ar: 'التربية الإسلامية' }, description: { en: 'Faith and Values', fr: 'Foi et Valeurs', ar: 'العقيدة والقيم' }, color: 'bg-teal-600', coefficient: 2 },
  { id: 'history', name: { en: 'History & Geography', fr: 'Histoire-Géo', ar: 'التاريخ والجغرافيا' }, description: { en: 'World History & Maps', fr: 'Histoire Mondiale & Cartes', ar: 'التاريخ العالمي والجغرافيا' }, color: 'bg-yellow-600', coefficient: 2 },
  { id: 'english', name: { en: 'English', fr: 'Anglais', ar: 'اللغة الإنجليزية' }, description: { en: 'Grammar and Vocab', fr: 'Grammaire et Vocabulaire', ar: 'اللغة الإنجليزية' }, color: 'bg-indigo-600', coefficient: 2 },
  { id: 'phil', name: { en: 'Philosophy', fr: 'Philosophie', ar: 'الفلسفة' }, description: { en: 'Reason and Truth', fr: 'Raison et Vérité', ar: 'المجزوءات الفلسفية' }, color: 'bg-amber-600', coefficient: 2 },
  { id: 'eps', name: { en: 'Sports', fr: 'E.P.S', ar: 'التربية البدنية' }, description: { en: 'Physical Activity', fr: 'Activité Physique', ar: 'الرياضة' }, color: 'bg-orange-600', coefficient: 2 }
];

// --- INLINED SUPABASE SERVICE LOGIC ---
const SUPABASE_URL = 'https://lbfdweyzaqmlkcfgixmn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxiZmR3ZXl6YXFtbGtjZmdpeG1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2ODE1NjAsImV4cCI6MjA4MjI1NzU2MH0.wD_mWSrD1ayCeEzVOcLPgn1ihxXemwzHYXSB_3IsjlQ';

let supabaseInstance: SupabaseClient | null = null;

const getSupabase = () => {
  if (!supabaseInstance) {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseInstance;
};

const fetchFullState = async () => {
  const client = getSupabase();
  const [ { data: users }, { data: items }, { data: resources }, { data: lessons }, { data: timetable } ] = await Promise.all([
    client.from('users').select('*'),
    client.from('academic_items').select('*'),
    client.from('resources').select('*'),
    client.from('lessons').select('*'),
    client.from('timetable').select('*')
  ]);

  const mappedLessons = (lessons || []).map((l: any) => ({
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
    users: (users || []).map((u: any) => ({ id: u.id, email: u.email, name: u.name, role: u.role, studentNumber: u.student_number, createdAt: u.created_at })),
    items: (items || []).map((item: any) => ({
      id: item.id,
      title: item.title,
      subjectId: item.subject_id,
      type: item.type,
      date: item.date,
      time: item.time || '08:00',
      location: item.location,
      notes: item.notes,
      resources: (resources || []).filter((r: any) => r.item_id === item.id).map((r: any) => ({ id: r.id, title: r.title, type: r.type, url: r.url }))
    })),
    lessons: mappedLessons,
    timetable: (timetable || []).map((e: any) => ({ id: e.id, day: e.day, startHour: e.start_hour, endHour: e.end_hour, subjectId: e.subject_id, color: e.color, room: e.room })),
    subjects: INITIAL_SUBJECTS
  };
};
// --- END INLINED SUPABASE SERVICE ---

// --- INTERFACE DEFINITIONS (FOR AI REQUEST BODY/RESPONSE) ---
interface AiRequestBody {
  userQuery: string;
  requestingUser: User | null;
  history: ChatMessage[];
  imageUrl?: string;
}

interface AiResponse {
  text: string;
  resources?: any[];
  grounding?: any[];
  type: 'text' | 'image' | 'file';
  isErrorDetection?: boolean;
}

const AI_PREFIX = ":::AI_RESPONSE:::";

// --- MAIN HANDLER ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ text: 'Method Not Allowed', type: 'text' });
  }

  const apiKey = process.env.NVIDIA_API_KEY;

  if (!apiKey) {
    console.error("NVIDIA_API_KEY is not configured on the server.");
    return res.status(500).json({
      text: "Server configuration error: NVIDIA API Key is missing.",
      type: 'text'
    });
  }

  const { userQuery, requestingUser, history, imageUrl }: AiRequestBody = req.body;

  if (!userQuery) {
    return res.status(400).json({ text: 'Missing userQuery in request body.', type: 'text' });
  }

  try {
    // --- Context Building Logic (Using Inlined fetchFullState) ---
    const freshState = await fetchFullState();
    const allLessons = freshState.lessons || [];
    const subjects = freshState.subjects || [];
    const academicItems = freshState.items || [];

    const hubLibrary = allLessons.map(l => ({
      lesson_id: l.id,
      title: l.title,
      subject: subjects.find(s => s.id === l.subjectId)?.name.en,
      summary: l.description,
      attachments: l.attachments || []
    }));

    const activeHomework = academicItems.map(i => ({
      title: i.title,
      type: i.type,
      due: i.date,
      subject: subjects.find(s => s.id === i.subjectId)?.name.en,
      lesson_link: i.title
    }));

    const contextHistory: { role: 'user' | 'assistant'; content: string }[] = (history || [])
      .slice(-15)
      .map(msg => {
        const isAI = msg.userId === ZAY_USER_ID || msg.content.startsWith(AI_PREFIX);
        return {
          role: isAI ? 'assistant' : 'user',
          content: msg.content.replace(AI_PREFIX, '')
        };
      });

    const systemInstruction = `
You are Zay, the Smart Diagnostic Assistant for the 1BacSM Hub.
Engine: NVIDIA NIM (e.g., meta/llama3-70b-instruct).

**BEHAVIORAL RULES**:
1. **DIAGNOSTICS**: If the student provides math/physics steps, verify the logic. 
   Prefix errors with: "[DIAGNOSTIC ALERT]: Error in [Concept]"
2. **FILE DELIVERY**: If a user asks for a lesson or files, find the match in HUB_LIBRARY.
   You MUST use this EXACT tag format: [ATTACH_RESOURCES: JSON_ARRAY]
   CRITICAL: The JSON_ARRAY must be strictly valid JSON. Do NOT use markdown code blocks (\` \` \`) inside the tag. Do NOT include trailing commas.
3. **NO-HOMEWORK FALLBACK**: If a student asks for "exercises" or "homework" for a lesson and there are 0 official tasks in ACTIVE_HOMEWORK or HUB_LIBRARY, you MUST say:
   "I found 0 assigned homeworks for [Lesson Name] in the Hub. Since you have no official tasks yet, would you like me to generate an AI-powered exercise series based on the resources available in the database for this lesson?"
4. **MEMORY**: Always refer back to history if the user says "it", "that", or "him".

**HUB_LIBRARY**:
${JSON.stringify(hubLibrary, null, 1)}

**ACTIVE_HOMEWORK**:
${JSON.stringify(activeHomework, null, 1)}

**STUDENT**:
Name: ${requestingUser?.name || 'Student'}
`;

    const messagesForModel: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemInstruction },
      ...contextHistory,
      { role: "user", content: userQuery }
    ];

    // --- NVIDIA NIM API Call ---
    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://integrate.api.nvidia.com/v1',
    });

    const completion = await openai.chat.completions.create({
      model: "meta/llama3-70b-instruct",
      messages: messagesForModel,
      temperature: 0.15,
      top_p: 1,
      max_tokens: 1024,
      stream: false,
    });

    let text = completion.choices?.[0]?.message?.content?.trim() || "";
    let resources: any[] = [];
    let grounding: any[] = [];
    const isErrorDetection = text.includes("[DIAGNOSTIC ALERT]");

    // --- ROBUST RESOURCE PARSING (MATCHES ORIGINAL LOGIC) ---
    const tag = "[ATTACH_RESOURCES:";
    const tagIndex = text.indexOf(tag);
    if (tagIndex !== -1) {
      const afterTag = text.substring(tagIndex + tag.length);
      const closingBracketIndex = afterTag.lastIndexOf(']');
      
      if (closingBracketIndex !== -1) {
        const jsonStr = afterTag.substring(0, closingBracketIndex).trim();
        // Remove potential markdown code block markers if the AI ignored instructions
        const cleanJson = jsonStr.replace(/```json|```/g, '').trim();
        
        try {
          resources = JSON.parse(cleanJson);
          // Clean up text by removing the tag portion
          text = text.substring(0, tagIndex).trim();
        } catch (e) {
          console.error("[Zay] Resource extraction error:", e, "Payload:", cleanJson);
          text += `\n\n[Error parsing attached resources: ${e instanceof Error ? e.message : 'Unknown error'}]`;
        }
      }
    }

    // --- Respond to Client ---
    const finalResponse: AiResponse = { 
      text, 
      resources, 
      grounding, 
      type: (resources.length > 0 || isErrorDetection) ? 'file' : 'text', 
      isErrorDetection 
    };

    res.status(200).json(finalResponse);

  } catch (error: any) {
    console.error("[Zay NIM Service Error - Server Side]:", error);

    let userMessage = "My neural processor (NVIDIA NIM) is temporarily offline. Please try your request again shortly.";

    if (error instanceof OpenAI.APIError) {
      console.error("OpenAI API Error Details:", error.status, error.message, error.type, error.code, error.param);
      if (error.status === 401) {
        userMessage = "Authentication with the AI service failed. (Invalid API Key)";
      } else if (error.status === 404) {
        userMessage = "Requested AI model or resource was not found. Please check the model name or endpoint.";
      } else if (error.status === 429) {
        userMessage = "Rate limit exceeded for the AI service. Please wait before trying again.";
      } else if (error.status >= 500) {
        userMessage = "The AI service is currently experiencing technical difficulties. Please try again later.";
      } else {
        userMessage = `An unexpected error occurred (${error.status}). Details: ${error.message.substring(0, 100)}...`;
      }
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      userMessage = "Could not connect to the AI service endpoint. Please check network connectivity.";
    }

    res.status(500).json({ text: userMessage, type: 'text' });
  }
}
