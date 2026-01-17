// api/askZay.ts
// --- INLINED DEPENDENCIES ---
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// --- INLINED CONSTANTS.TSX ---
const ZAY_USER_ID = '00000000-0000-0000-0000-000000000001';

// --- INLINED TYPES.TS ---
interface User { id: string; email: string; name: string; role: 'DEV' | 'ADMIN' | 'STUDENT'; }
interface ChatMessage { id: string; userId: string; content: string; type: 'text' | 'image' | 'file' | 'audio'; }
interface Subject { id: string; name: { en: string; fr: string; ar: string }; coefficient: number; }

const INITIAL_SUBJECTS: Subject[] = [
  { id: 'math', name: { en: 'Mathematics SM', fr: 'Mathématiques SM', ar: 'الرياضيات م.ر' }, coefficient: 7 },
  { id: 'physics', name: { en: 'Physics & Chemistry', fr: 'Physique-Chimie', ar: 'الفيزياء والكيمياء' }, coefficient: 7 },
  { id: 'svt', name: { en: 'SVT', fr: 'SVT', ar: 'علوم الحياة والأرض' }, coefficient: 2 },
  { id: 'fr', name: { en: 'French', fr: 'Français', ar: 'اللغة الفرنسية' }, coefficient: 4 },
];

// --- INLINED SUPABASE SERVICE LOGIC ---
const SUPABASE_URL = 'https://lbfdweyzaqmlkcfgixmn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxiZmR3ZXl6YXFtbGtjZmdpeG1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2ODE1NjAsImV4cCI6MjA4MjI1NzU2MH0.wD_mWSrD1ayCeEzVOcLPgn1ihxXemwzHYXSB_3IsjlQ';

let supabaseInstance: SupabaseClient | null = null;
const getSupabase = () => {
  if (!supabaseInstance) supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return supabaseInstance;
};

const fetchFullState = async () => {
  const client = getSupabase();
  const [ { data: users }, { data: items }, { data: resources }, { data: lessons } ] = await Promise.all([
    client.from('users').select('*'),
    client.from('academic_items').select('*'),
    client.from('resources').select('*'),
    client.from('lessons').select('*')
  ]);

  return {
    users: users || [],
    items: (items || []).map(i => ({ ...i, resources: (resources || []).filter(r => r.item_id === i.id) })),
    lessons: lessons || [],
    subjects: INITIAL_SUBJECTS
  };
};

// --- MAIN HANDLER ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ text: 'Method Not Allowed' });

  const { userQuery, requestingUser, history }: any = req.body;
  const AI_PREFIX = ":::AI_RESPONSE:::";

  try {
    // 1. Fetch Supabase Data for Context
    const freshState = await fetchFullState();
    const hubLibrary = freshState.lessons.map(l => ({ title: l.title, summary: l.description, id: l.id }));

    // 2. Prepare Messages for GPT-5.2
    const contextHistory = (history || []).slice(-10).map((msg: any) => ({
      role: (msg.userId === ZAY_USER_ID || msg.content.startsWith(AI_PREFIX)) ? 'assistant' : 'user',
      content: msg.content.replace(AI_PREFIX, '')
    }));

    const systemInstruction = `
      You are Zay, the Smart Diagnostic Assistant for 1BacSM.
      Model: GPT-5.2 Pro.
      
      RULES:
      1. DIAGNOSTICS: Verify math/physics logic. Prefix errors with "[DIAGNOSTIC ALERT]".
      2. FILE DELIVERY: Use EXACT tag: [ATTACH_RESOURCES: JSON_ARRAY]
      3. No "AI-speak". Be a smart peer.
      
      HUB_LIBRARY: ${JSON.stringify(hubLibrary)}
      STUDENT: ${requestingUser?.name || 'Student'}
    `;

    // 3. CALL GPT-5.2 via Puter API
    const response = await fetch('https://api.puter.com/v2/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-5.2', // Using the 2026 flagship GPT-5.2
        messages: [
          { role: 'system', content: systemInstruction },
          ...contextHistory,
          { role: 'user', content: userQuery }
        ],
        temperature: 0.2
      })
    });

    const data = await response.json();
    let text = data.message?.content || "";
    
    // 4. ROBUST RESOURCE PARSING (Your Original Logic)
    let resources: any[] = [];
    const tag = "[ATTACH_RESOURCES:";
    const tagIndex = text.indexOf(tag);
    if (tagIndex !== -1) {
      const afterTag = text.substring(tagIndex + tag.length);
      const closingBracketIndex = afterTag.lastIndexOf(']');
      if (closingBracketIndex !== -1) {
        try {
          const cleanJson = afterTag.substring(0, closingBracketIndex).replace(/```json|```/g, '').trim();
          resources = JSON.parse(cleanJson);
          text = text.substring(0, tagIndex).trim();
        } catch (e) { console.error("Parse error", e); }
      }
    }

    return res.status(200).json({
      text,
      resources,
      type: (resources.length > 0 || text.includes("[DIAGNOSTIC ALERT]")) ? 'file' : 'text',
      isErrorDetection: text.includes("[DIAGNOSTIC ALERT]")
    });

  } catch (error) {
    console.error("Zay Error:", error);
    res.status(500).json({ text: "GPT-5.2 is warming up. Try again?", type: 'text' });
  }
}
