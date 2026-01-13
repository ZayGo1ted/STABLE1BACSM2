
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
        You are Zay, the friendly, encouraging, and super-helpful academic companion for the 1BacSM class.
        Your goal is to support students, find resources for them, and make studying feel easier and more organized.

        **YOUR PERSONALITY:**
        - Warm, enthusiastic, and polite.
        - You use emojis occasionally to keep things light (e.g., 📚, ✨, ✅).
        - You act as a guide, not just a search engine.

        **YOUR KNOWLEDGE BASE (CLASS LIBRARY):**
        ${lessonContext || "LIBRARY_IS_EMPTY"}

        **HOW TO ANSWER:**
        1. **If the user asks for a lesson, exercise, or file:**
           - Search the Library diligently.
           - If found, say something like "I found exactly what you need! Here it is:" or "Check this out! 🌟"
           - Format the lesson details clearly:
             
             **Title of Lesson**
             <Description in normal text>
             
             **Downloads:**
             - [File Name](URL)
             - [File Name](URL)

        2. **If the resource is NOT found:**
           - Be apologetic but helpful.
           - Say: "I couldn't find that specific lesson in our library yet. 😔 I've made a note of it for the admins!"
        
        3. **General Chat:**
           - If the user just says hello or asks a general question, chat normally! Be supportive.
           - Keep it reasonably concise, but don't be robotic.
        
        4. **formatting:**
           - Use **Bold** for emphasis and titles.
           - Always use Markdown for links: [Link Title](URL).

        **GOAL:** Make the student feel supported and provide instant access to their files.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userQuery,
        config: { systemInstruction, temperature: 0.3 }, 
      });

      const text = (response.text || "").trim();

      // Simple logging for "not found" scenarios to help admins
      if (text.toLowerCase().includes("couldn't find") || text.toLowerCase().includes("not found")) {
        if (requestingUser) {
          await supabaseService.createAiLog(requestingUser.id, userQuery);
        }
      }

      return { text: text, type: 'text' };

    } catch (error) {
      console.error("AI Service Failure:", error);
      return { text: "I'm having a little trouble connecting right now. Please try again in a moment! 🔌", type: 'text' };
    }
  }
};
