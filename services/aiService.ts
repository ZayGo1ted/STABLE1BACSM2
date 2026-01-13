import { User } from '../types';
import { supabaseService } from './supabaseService';

interface AiResponse {
  text: string;
  mediaUrl?: string;
  type: 'text' | 'image' | 'file';
}

const getEnvVar = (key: string): string => {
  if (import.meta?.env?.[key]) return import.meta.env[key];
  if (typeof process !== 'undefined' && process.env?.[key]) return process.env[key];
  return '';
};

export const aiService = {
  askZay: async (userQuery: string, requestingUser: User | null): Promise<AiResponse> => {
    const API_KEY = getEnvVar('VITE_GEMINI_API_KEY');

    if (!API_KEY) {
      console.error('Missing Gemini API key');
      return { text: 'System error: API key missing.', type: 'text' };
    }

    try {
      // 🔄 Always fetch fresh state
      const freshState = await supabaseService.fetchFullState();
      const lessons = freshState.lessons || [];
      const items = freshState.items || [];
      const subjects = freshState.subjects || [];

      // 📚 Build lesson context
      const lessonContext = lessons
        .filter(l => l.isPublished)
        .map(l => {
          const subject =
            subjects.find(s => s.id === l.subjectId)?.name?.en || 'General';

          const attachments = (l.attachments || [])
            .map(a => {
              const isImg = a.type === 'image' || /\.(jpg|jpeg|png|gif|webp)$/i.test(a.url);
              return isImg
                ? `[IMAGE_FILE](${a.url})`
                : `[FILE](${a.url})`;
            })
            .join(', ');

          const mainFile = l.fileUrl
            ? /\.(jpg|jpeg|png|gif|webp)$/i.test(l.fileUrl)
              ? `[IMAGE_FILE](${l.fileUrl})`
              : `[FILE](${l.fileUrl})`
            : '';

          return `ID:${l.id} | TITLE:${l.title} | SUBJECT:${subject} | DESC:${l.description} | FILES:${attachments} ${mainFile}`;
        })
        .join('\n');

      // 📅 Build calendar context
      const today = new Date();
      const calendarContext = items
        .filter(i => new Date(i.date) >= today)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map(i => {
          const subject =
            subjects.find(s => s.id === i.subjectId)?.name?.en || 'General';
          return `DUE:${i.date} | TYPE:${i.type} | TITLE:${i.title} | SUBJECT:${subject}`;
        })
        .join('\n') || 'NO_UPCOMING_TASKS';

      // 🧠 SYSTEM INSTRUCTION
      const systemInstruction = `
You are **@Zay**, a smart, strict academic assistant for **1BacSM (Science Math)**.

LANGUAGE:
- Reply in the SAME language as the user (English / French / Arabic).
- Never mix languages.

DATABASE (ONLY SOURCE OF TRUTH):

LESSONS:
${lessonContext || 'EMPTY_LIBRARY'}

CALENDAR:
${calendarContext}

RULES:
1. NO HALLUCINATION. If it is not in the database, it does not exist.
2. EXTREME BREVITY. Max 2 short sentences.
3. If user asks about homework/exams and CALENDAR = NO_UPCOMING_TASKS:
   → "You have nothing due right now. Relax 😎"
4. If a requested lesson or file does NOT exist:
   → Output EXACT token: REPORT_MISSING
5. If a lesson includes [IMAGE_FILE](URL):
   - Answer normally
   - Append at the END: SHOW_IMG::URL
6. Plain text only. No markdown. No lists.
`;

      // 🌐 Gemini REST call
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': API_KEY,
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemInstruction }],
            },
            contents: [
              {
                role: 'user',
                parts: [{ text: userQuery }],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 600,
            },
          }),
        }
      );

      if (!response.ok) {
        const err = await response.text();
        throw new Error(err);
      }

      const data = await response.json();
      let text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

      // 🚨 Missing content handling
      if (text.includes('REPORT_MISSING')) {
        if (requestingUser) {
          await supabaseService.createAiLog(requestingUser.id, userQuery);
        }
        return {
          text: "I couldn't find that lesson in the library. The admin has been notified.",
          type: 'text',
        };
      }

      // 🖼️ Image handling
      if (text.includes('SHOW_IMG::')) {
        const [cleanText, url] = text.split('SHOW_IMG::');
        return {
          text: cleanText.trim(),
          mediaUrl: url.trim(),
          type: 'image',
        };
      }

      return { text, type: 'text' };

    } catch (error) {
      console.error('AI ERROR:', error);
      return { text: 'Connection error. Please try again.', type: 'text' };
    }
  },
};
