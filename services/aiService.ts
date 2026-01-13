
import { GoogleGenAI } from "@google/genai";
import { User } from '../types';
import { supabaseService } from './supabaseService';

interface AiResponse {
  text: string;
  mediaUrl?: string;
  type: 'text' | 'image' | 'file';
}

export const aiService = {
  askZay: async (userQuery: string, requestingUser: User | null): Promise<AiResponse> => {
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
      console.error("CRITICAL: API_KEY is undefined in browser environment.");
      return { text: "System Error: API Key configuration missing.", type: 'text' };
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      
      // ALWAYS fetch fresh state to ensure deleted lessons are gone
      const freshState = await supabaseService.fetchFullState();
      const lessons = freshState.lessons || [];
      const items = freshState.items || []; // Homework & Exams
      const subjects = freshState.subjects || [];

      // 1. Build Lesson Context
      const lessonContext = lessons
        .filter(l => l.isPublished)
        .map(l => {
          const subject = subjects.find(s => s.id === l.subjectId)?.name.en || 'General';
          
          // Detect if attachments are images
          const attachments = (l.attachments || []).map(a => {
            const isImg = a.type === 'image' || a.url.match(/\.(jpeg|jpg|gif|png|webp)$/i);
            return isImg 
              ? `[IMAGE_FILE](${a.url})` 
              : `[FILE](${a.url})`;
          }).join(', ');

          const mainFile = l.fileUrl 
            ? (l.fileUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? `[IMAGE_FILE](${l.fileUrl})` : `[FILE](${l.fileUrl})`) 
            : "";

          return `ID:${l.id} | TITLE:${l.title} | SUBJ:${subject} | DESC:${l.description} | FILES:${attachments} ${mainFile}`;
        })
        .join('\n');

      // 2. Build Homework/Exam Context
      const today = new Date();
      const upcomingItems = items
        .filter(i => new Date(i.date) >= today)
        .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map(i => `DUE:${i.date} | TYPE:${i.type} | TITLE:${i.title} | SUBJ:${subjects.find(s => s.id === i.subjectId)?.name.en}`);
      
      const calendarContext = upcomingItems.length > 0 
        ? upcomingItems.join('\n') 
        : "NO_UPCOMING_TASKS";

      const systemInstruction = `
        You are Zay, the best, most helpful academic assistant ever. 🌟

        **LIVE DATABASE:**
        LESSONS:
        ${lessonContext || "EMPTY_LIBRARY"}
        
        TASKS:
        ${calendarContext}

        **STRICT RULES:**
        1. **MAX 2 SENTENCES**. Keep it punchy and friendly.
        2. **NO HOMEWORK**: If user asks about homework/tasks and TASKS is "NO_UPCOMING_TASKS", say exactly: "No, you have none, dude! Relax. 😎"
        3. **MISSING LESSON**: If user asks for a lesson NOT in the database, say "REPORT_MISSING". Do not apologize, just trigger the report.
        4. **FOUND LESSON**: If found, say "Here is the [Lesson Name] you asked for!" and nothing else.
        5. **IMAGES**: If the found lesson has [IMAGE_FILE](URL), append "SHOW_IMG::[URL]" to the end of your response.

        **Example:**
        - User: "Do I have homework?"
        - Zay: "No, you have none, dude! Relax. 😎"
        
        - User: "Show me math"
        - Zay: "Here is the Math lesson. SHOW_IMG::https://url.com/img.png"
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userQuery,
        config: { systemInstruction, temperature: 0.1 }, // Low temp to prevent hallucinating deleted files
      });

      let text = (response.text || "").trim();
      let type: 'text' | 'image' | 'file' = 'text';
      let mediaUrl: string | undefined = undefined;

      // Handle Missing Resource Reporting
      if (text.includes("REPORT_MISSING")) {
        if (requestingUser) {
          await supabaseService.createAiLog(requestingUser.id, userQuery);
        }
        return { text: "I couldn't find that specific lesson in the library. I've reported it to the admin! 📝", type: 'text' };
      }

      // Handle Image Rendering Trigger
      if (text.includes("SHOW_IMG::")) {
        const parts = text.split("SHOW_IMG::");
        text = parts[0].trim();
        mediaUrl = parts[1]?.trim();
        type = 'image';
      }

      return { text, mediaUrl, type };

    } catch (error) {
      console.error("AI Service Failure:", error);
      return { text: "Connection error. Please try again.", type: 'text' };
    }
  }
};
