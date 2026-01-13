import { GoogleGenAI } from "@google/genai";
import { AppState, User, Lesson, Subject } from '../types';
import { storageService } from './storageService';
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
    if (!apiKey) return { text: "⚠️ API Key missing.", type: 'text' };

    try {
      const ai = new GoogleGenAI({ apiKey });
      const appState: AppState = storageService.loadState();
      
      const now = new Date();
      const currentDateStr = now.toISOString().split('T')[0];
      const currentTimeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Lesson Context with new fields and Hidden Metadata
      const queryLower = userQuery.toLowerCase();
      const relevantLessons = appState.lessons
        .filter(l => l.isPublished)
        .filter(l => {
          const contentMatch = l.title.toLowerCase().includes(queryLower) || 
                               l.description.toLowerCase().includes(queryLower) ||
                               l.aiMetadata.toLowerCase().includes(queryLower) ||
                               l.keywords.some(k => queryLower.includes(k.toLowerCase()));
          return contentMatch;
        })
        .slice(0, 5);

      const lessonContext = relevantLessons.map(l => {
          const subject = appState.subjects.find(s => s.id === l.subjectId)?.name.en || 'General';
          return `
            [LESSON]
            Title: ${l.title}
            Subject: ${subject}
            Desc: ${l.description}
            Metadata (Hidden info): ${l.aiMetadata}
            Written On: ${l.date} from ${l.startTime} to ${l.endTime}
            File URL: ${l.fileUrl}
          `;
      }).join('\n');

      const systemInstruction = `
        You are @Zay, the helper for "1BacSM".
        Current Time: ${currentDateStr} ${currentTimeStr}
        User: ${requestingUser?.name}

        **AVAILABLE LESSONS:**
        ${lessonContext || "NONE"}

        **RULES:**
        1. If the user asks for a lesson, exercise, or file:
           - Check the [LESSON] list above.
           - If found, output a short confirmation like "Here is the lesson on [Topic]." followed immediately by "MEDIA_URL::[File URL]".
           - If NOT found, output EXACTLY: "NO_LESSON_FOUND". Do not say anything else.
        2. If the user asks general questions not related to a specific file:
           - Answer briefly.
        3. If you find a lesson, you can use the "Written On" time to add context (e.g., "This was written today...").
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userQuery,
        config: { systemInstruction: systemInstruction, temperature: 0.5 },
      });

      const text = (response.text || "").trim();

      // Check for failure token
      if (text.includes("NO_LESSON_FOUND")) {
        // Log to database
        if (requestingUser) {
           await supabaseService.createAiLog(requestingUser.id, userQuery);
        }
        return { 
          text: "❌ I couldn't find that lesson. I've notified the Admin to upload it.", 
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

      return { text: finalText, mediaUrl: mediaUrl, type: type };

    } catch (error: any) {
      return { text: "😵 Brain freeze. Try again.", type: 'text' };
    }
  }
};
