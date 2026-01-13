
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
      
      const freshState = await supabaseService.fetchFullState();
      const lessons = freshState.lessons || [];
      const subjects = freshState.subjects || [];

      // Build robust context with ALL files
      const lessonContext = lessons
        .filter(l => l.isPublished)
        .map(l => {
          const subject = subjects.find(s => s.id === l.subjectId)?.name.en || 'General';
          
          let fileList = (l.attachments || [])
            .map(a => `[${a.name}](${a.url})`)
            .join(', ');
            
          if (!fileList && l.fileUrl) {
            fileList = `[Main File](${l.fileUrl})`;
          }

          return `
ITEM_ID: ${l.id}
TITLE: ${l.title}
SUBJECT: ${subject}
DESCRIPTION: ${l.description}
KEYWORDS: ${l.keywords.join(', ')}
FILES: ${fileList || "No files"}
--------------------------------`;
        })
        .join('\n');

      const systemInstruction = `
        You are Zay, a professional academic assistant for the 1BacSM class.
        
        **DATABASE:**
        ${lessonContext || "LIBRARY_IS_EMPTY"}

        **PROTOCOL:**
        1. **Direct Answers Only**: Answer the user's question directly. Do not offer extra help ("Let me know if..."). Do not use filler ("Here is the lesson").
        2. **Lesson Requests**: 
           - If a user asks for a lesson, exercise, or resource, search the DATABASE.
           - If found, format the response exactly like this:
             **Title of Lesson**
             <Description in normal text>
             
             **Resources:**
             - [File Name](URL)
             - [File Name](URL)
           
        3. **Missing Info**: If the specific lesson is NOT in the database, simply say: "I couldn't find that specific resource in the library."
        
        4. **Tone**: Professional, academic, strictly concise.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userQuery,
        config: { systemInstruction, temperature: 0.1 }, 
      });

      const text = (response.text || "").trim();

      // Simple logging for "not found" scenarios to help admins
      if (text.toLowerCase().includes("couldn't find") || text.toLowerCase().includes("not found")) {
        if (requestingUser) {
          await supabaseService.createAiLog(requestingUser.id, userQuery);
        }
      }

      // We no longer strip MEDIA_URL since the AI formats links in Markdown [Link](url)
      // The ChatRoom component will handle rendering these links.

      return { text: text, type: 'text' };

    } catch (error) {
      console.error("AI Service Failure:", error);
      return { text: "Service temporarily unavailable. Please try again later.", type: 'text' };
    }
  }
};
