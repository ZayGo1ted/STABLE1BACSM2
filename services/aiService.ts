
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
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // FETCH FRESH STATE directly from DB to ensure AI "sees" everything
      const freshState = await supabaseService.fetchFullState();
      const lessons = freshState.lessons;
      const subjects = freshState.subjects;

      // Improved Context Builder: 
      // We send more lessons to the AI and let Gemini handle the semantic matching
      // instead of a strict string.includes() filter in JavaScript.
      const queryLower = userQuery.toLowerCase();
      const lessonContext = lessons
        .filter(l => l.isPublished)
        .slice(0, 15) // Give AI a broader view of the last 15 lessons
        .map(l => {
          const subject = subjects.find(s => s.id === l.subjectId)?.name.en || 'General';
          const fileLinks = (l.attachments || []).map(a => `   - ${a.name}: ${a.url}`).join('\n');
          return `
            LESSON_ENTRY:
            Title: ${l.title}
            Subject: ${subject}
            Description: ${l.description}
            Keywords: ${l.keywords.join(', ')}
            AI_Meta: ${l.aiMetadata}
            Resources:
            ${fileLinks || "No attachments"}
          `;
        }).join('\n---\n');

      const systemInstruction = `
        You are @Zay, the smart hub assistant for the "1BacSM" class.
        You have access to a library of lessons. Your job is to find the right resource for the student.

        **CLASS LIBRARY:**
        ${lessonContext || "THE_LIBRARY_IS_CURRENTLY_EMPTY"}

        **STRICT PROTOCOL:**
        1. If a student asks for a specific lesson, file, or topic:
           - Look for it in the CLASS LIBRARY above.
           - If you find a match (even a partial one), provide a short helpful response and end it with: 
             "MEDIA_URL::[THE_URL_OF_THE_FIRST_ATTACHMENT]"
           - If NO RELEVANT LESSON is found in the provided list, respond with ONLY: "NOT_FOUND_IN_DB".
        2. Be polite, concise, and professional.
        3. Use Markdown for formatting.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: userQuery,
        config: { systemInstruction, temperature: 0.2 },
      });

      const text = (response.text || "").trim();

      // Trigger logging if not found
      if (text.includes("NOT_FOUND_IN_DB") || text.includes("ERROR_NO_MATCH")) {
        if (requestingUser) {
           await supabaseService.createAiLog(requestingUser.id, userQuery);
        }
        return { 
          text: "I couldn't find that specific lesson in my current records. I've logged this as a missing resource for the Dev team! 📢", 
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
      console.error("AI Service Error:", error);
      return { text: "😵 Connection to Zay lost. Please try again.", type: 'text' };
    }
  }
};
