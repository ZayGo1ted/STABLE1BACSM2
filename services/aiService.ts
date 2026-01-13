
import { GoogleGenAI } from "@google/genai";
import { User, Lesson, Subject } from '../types';
import { supabaseService } from './supabaseService';

interface AiResponse {
  text: string;
  mediaUrl?: string;
  type: 'text' | 'image' | 'file';
}

/**
 * AI Service for @Zay Classroom Assistant.
 */
export const aiService = {
  /**
   * Generates a response from @Zay using the provided context.
   */
  askZay: async (userQuery: string, requestingUser: User | null): Promise<AiResponse> => {
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
      console.error("Zay Error: API_KEY is missing from environment. Check Vercel settings.");
      return { text: "⚠️ Connectivity issue: API Key missing in deployment.", type: 'text' };
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      
      // Fetch fresh library data
      const freshState = await supabaseService.fetchFullState();
      const lessons = freshState.lessons || [];
      const subjects = freshState.subjects || [];

      // Improved Context Builder: Let Gemini handle matching
      const lessonContext = lessons
        .filter(l => l.isPublished)
        .slice(0, 20) // Provide a healthy slice of recent lessons
        .map(l => {
          const subject = subjects.find(s => s.id === l.subjectId)?.name.en || 'General';
          const fileLinks = (l.attachments || []).map(a => `   - ${a.name}: ${a.url}`).join('\n');
          return `
            LESSON_ENTRY:
            Title: ${l.title}
            Subject: ${subject}
            Description: ${l.description}
            Keywords: ${l.keywords.join(', ')}
            Resources:
            ${fileLinks || "No attachments"}
          `;
        }).join('\n---\n');

      const systemInstruction = `
        You are @Zay, the smart hub assistant for the "1BacSM" class.
        You assist students in finding lessons and resources from the CLASS LIBRARY.

        **CLASS LIBRARY:**
        ${lessonContext || "THE_LIBRARY_IS_CURRENTLY_EMPTY"}

        **STRICT PROTOCOL:**
        1. When asked for a lesson or topic, find the closest match in the library.
        2. If matched, answer helpfully and ALWAYS end with: "MEDIA_URL::[THE_URL_OF_THE_FIRST_ATTACHMENT]".
        3. If NO RELEVANT LESSON exists in the list above, you MUST say exactly: "NOT_FOUND_IN_DB".
        4. Be professional and speak in the language of the query.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: userQuery,
        config: { systemInstruction, temperature: 0.2 },
      });

      const text = (response.text || "").trim();

      if (text.includes("NOT_FOUND_IN_DB")) {
        if (requestingUser) {
           await supabaseService.createAiLog(requestingUser.id, userQuery);
        }
        return { 
          text: "I couldn't find that specific lesson in our current library. I've notified the team to upload it! 📢", 
          type: 'text' 
        };
      }

      const mediaSplit = text.split("MEDIA_URL::");
      let finalText = mediaSplit[0].trim();
      let mediaUrl = mediaSplit[1]?.trim();
      let type: 'text' | 'image' | 'file' = 'text';

      if (mediaUrl) {
        const ext = mediaUrl.split('.').pop()?.toLowerCase();
        type = ['jpg', 'jpeg', 'png', 'webp'].includes(ext || '') ? 'image' : 'file';
      }

      return { text: finalText, mediaUrl, type };

    } catch (error: any) {
      console.error("Zay System Error:", error);
      return { text: "😵 Connection to Zay interrupted. Please try again later.", type: 'text' };
    }
  }
};
