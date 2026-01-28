// api/askZay.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// --- INLINED CONSTANTS ---
const ZAY_USER_ID = '00000000-0000-0000-0000-000000000001';

// --- INLINED TYPES ---
interface User {
  id: string;
  email: string;
  name: string;
  role: 'DEV' | 'ADMIN' | 'STUDENT';
}
interface ChatMessage {
  id: string;
  userId: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'audio';
  mediaUrl?: string;
}
interface LessonAttachment {
  name: string;
  url: string;
  type: 'file' | 'image' | 'video';
}
interface Lesson {
  id: string;
  title: string;
  subjectId: string;
  type: string;
  description: string;
  attachments: LessonAttachment[];
  date: string;
}

// --- SUPABASE CLIENT ---
const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY!;

let supabaseInstance: SupabaseClient | null = null;
const getSupabase = () => {
  if (!supabaseInstance) {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  return supabaseInstance;
};

const fetchLessons = async () => {
  const client = getSupabase();
  const { data: lessons, error } = await client
    .from('lessons')
    .select('id, title, subject_id, type, description, attachments, date_written')
    .eq('is_published', true);

  if (error) {
    console.error("Error fetching lessons:", error);
    return [];
  }
  return lessons || [];
};

// --- MAIN HANDLER ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const NVIDIA_API_KEY = process.env.API_KEY;
  if (!NVIDIA_API_KEY) {
    console.error("NVIDIA_API_KEY not set");
    return res.status(500).json({ error: "Server configuration error." });
  }

  // Initialize NVIDIA NIM client
  const client = new OpenAI({
    baseURL: "https://integrate.api.nvidia.com/v1",
    apiKey: NVIDIA_API_KEY,
  });

  const { userQuery, requestingUser, history, mediaAttachments }: { 
    userQuery: string; 
    requestingUser: User; 
    history: ChatMessage[];
    mediaAttachments?: { url: string; type: string }[];
  } = req.body;

  if (!userQuery) {
    return res.status(400).json({ error: "Missing userQuery" });
  }

  try {
    const hubLessons = await fetchLessons();

    // Prepare knowledge base
    const hubKnowledgeBase = hubLessons.map(lesson => ({
      id: lesson.id,
      title: lesson.title,
      subjectId: lesson.subject_id,
      type: lesson.type,
      summary: lesson.description,
      date: lesson.date_written,
      attachments: lesson.attachments || [],
    }));

    // Process conversation history
    const sanitizedHistory = (history || []).slice(-10).map(msg => ({
      role: (msg.userId === ZAY_USER_ID || msg.content.startsWith(":::AI_RESPONSE:::")) ? 'assistant' : 'user',
      content: msg.content.replace(":::AI_RESPONSE:::", "").trim()
    }));

    // Detect user language
    const detectLanguage = (text: string): string => {
      const frenchKeywords = ['bonjour', 'merci', 'comment', 'mathématiques', 'physique'];
      const darijaKeywords = ['سلام', 'كيفاش', 'بزاف', 'رياضيات', 'فيزياء'];
      
      const lowerText = text.toLowerCase();
      if (darijaKeywords.some(k => lowerText.includes(k))) return 'darija';
      if (frenchKeywords.some(k => lowerText.includes(k))) return 'french';
      return 'english';
    };

    const detectedLanguage = detectLanguage(userQuery);

    // Enhanced system prompt with multimodal instructions
    const systemPrompt = `
[SYSTEM]
You are Zay, the official AI Diagnostic Assistant for 1BacSM students.
Model: Meta/Llama-3.1-405B-Instruct (NVIDIA NIM)

CORE RULES:
1. LANGUAGE ADAPTATION: Respond EXCLUSIVELY in the SAME language the user uses.
   - If user switches from French to English, IMMEDIATELY switch to English
   - If user writes in Moroccan Darija, respond fluently in Darija
   - Maintain language consistency throughout conversation

2. TONE & STYLE:
   - Be helpful, smart, concise, and peer-like
   - Avoid overly technical jargon unless explaining concepts
   - Use Markdown when appropriate (bold, lists)

3. MEMORY & CONTEXT:
   - Use conversation history for context
   - Remember previous topics and user preferences

4. SUBJECT EXPERTISE:
   - 1Bac Science Math curriculum specialist
   - Mathematics, Physics & Chemistry, Biology, other subjects

5. DATABASE INTEGRATION:
   - Access 'HUB_LIBRARY' knowledge base
   - When asked about topics, search HUB_LIBRARY for relevant lessons
   - ALWAYS reference lessons using: [[LESSON_TITLE_HERE]]
   - Provide attachments using JSON tag at END of response:
     [ATTACH_RESOURCES: [{"name": "Name", "url": "https://...", "type": "image/file"}]]

6. MULTIMODAL CAPABILITIES:
   - Analyze images, PDFs, documents sent by users
   - Generate exercises/quizzes based on database resources
   - Process multiple files simultaneously
   - Extract key information from visual content

7. DIAGNOSTIC FUNCTION:
   - Identify calculation/logic errors
   - Flag with: [DIAGNOSTIC ALERT]

8. OUTPUT GUIDELINES:
   - Prioritize accuracy and clarity
   - Never mention being an AI or internal processes
   - Reference only real database resources

[HUB_LIBRARY]
${JSON.stringify(hubKnowledgeBase, null, 2)}

[STUDENT]
Name: ${requestingUser?.name || 'Student'}
Current Language: ${detectedLanguage}

[END SYSTEM]
`;

    // Prepare messages array
    const messages = [
      { role: "system", content: systemPrompt.trim() },
      ...sanitizedHistory,
      { 
        role: "user", 
        content: [
          { type: "text", text: userQuery.trim() },
          ...(mediaAttachments || []).map(att => ({
            type: att.type === 'image' ? "image_url" : "text",
            [att.type === 'image' ? "image_url" : "text"]: att.type === 'image' 
              ? { url: att.url } 
              : `[Attached ${att.type}: ${att.url}]`
          }))
        ].flat()
      }
    ];

    // Call NVIDIA NIM API
    const completion = await client.chat.completions.create({
      model: "meta/llama-3.1-405b-instruct",
      messages: messages as any,
      temperature: 0.4,
      top_p: 0.95,
      max_tokens: 2048,
      stream: false,
    });

    const nvidiaData = completion.choices[0];
    let rawText = nvidiaData.message.content?.trim() || "";

    // Parse custom tags
    let finalText = rawText;
    let resources: LessonAttachment[] = [];
    let isErrorDetection = false;

    if (finalText.includes("[DIAGNOSTIC ALERT]")) {
      isErrorDetection = true;
    }

    const resourceTagMatch = finalText.match(/\[ATTACH_RESOURCES:\s*(\[[\s\S]*?\])\s*\]/i);
    if (resourceTagMatch) {
      try {
        resources = JSON.parse(resourceTagMatch[1]);
        finalText = finalText.replace(resourceTagMatch[0], '').trim();
      } catch (parseError) {
        console.error("Error parsing resources:", parseError);
      }
    }

    const responseType = resources.length > 0 || isErrorDetection ? 'file' : 'text';

    return res.status(200).json({
      text: finalText,
      resources: resources,
      grounding: [],
      type: responseType,
      isErrorDetection: isErrorDetection,
    });

  } catch (error: any) {
    console.error("Critical Error:", error);
    res.status(500).json({
      error: "Zay is unavailable. Please try again.",
      text: "Zay is currently unavailable. Please try again later.",
      resources: [],
      grounding: [],
      type: 'text',
      isErrorDetection: false
    });
  }
}
