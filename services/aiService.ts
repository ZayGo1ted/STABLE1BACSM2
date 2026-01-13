
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
    // Initializing AI right before call to ensure latest API Key is used and follows direct usage guideline
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const appState: AppState = storageService.loadState();
      
      const queryLower = userQuery.toLowerCase();
      const relevantLessons = appState.lessons
        .filter(l => l.isPublished)
        .filter(l => {
          return l.title.toLowerCase().includes(queryLower) || 
                 l.description.toLowerCase().includes(queryLower) ||
                 l.aiMetadata.toLowerCase().includes(queryLower) ||
                 l.keywords.some(k => queryLower.includes(k.toLowerCase()));
        })
        .slice(0, 5);

      const lessonContext = relevantLessons.map(l => {
          const subject = appState.subjects.find(s => s.id === l.subjectId)?.name.en || 'General';
          const fileLinks = (l.attachments || []).map((a, i) => `   - File: ${a.name} (URL: ${a.url})`).join('\n');
          return `
            [MATCHED_LESSON]
            ID: ${l.id}
            Topic: ${l.title}
            Subject: ${subject}
            Summary: ${l.description}
            Hidden Meta: ${l.aiMetadata}
            Timing: ${l.date} (${l.startTime}-${l.endTime})
            Attachments:
            ${fileLinks || "None"}
          `;
      }).join('\n');

      const systemInstruction = `
        You are @Zay, the smart hub assistant for the "1BacSM" class.
        Current Context: ${new Date().toLocaleString()}
        User: ${requestingUser?.name}

        **DATABASE OF LESSONS:**
        ${lessonContext || "EMPTY_DATABASE"}

        **STRICT OPERATING RULES:**
        1. If the user asks for a file, lesson, or specific resource:
           - Scan the DATABASE OF LESSONS above for a match.
           - If FOUND, respond naturally and append "MEDIA_URL::[URL]" using the FIRST attachment URL.
           - If NOT FOUND, you MUST respond with EXACTLY: "ERROR_NO_MATCH_LOG_REQUEST".
        2. If the user is just chatting, be brief and professional.
        3. Do not mention the hidden metadata to students.
      `;

      // Upgraded to gemini-3-pro-preview for complex reasoning in Science Math context
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: userQuery,
        config: { systemInstruction, temperature: 0.1 },
      });

      const text = (response.text || "").trim();

      // Reliable Failure detection - Trigger log if AI can't find the lesson
      if (text.toUpperCase().includes("ERROR_NO_MATCH_LOG_REQUEST") || text.toUpperCase().includes("NO_LESSON_FOUND")) {
        if (requestingUser) {
           // We explicitly await this to ensure the log is recorded before returning
           await supabaseService.createAiLog(requestingUser.id, userQuery);
        }
        return { 
          text: "I couldn't find that specific lesson or resource in our database yet. I've sent a priority alert to the Dev team to upload it for you! 📢", 
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
      return { text: "😵 Connection failed. Please try again in a moment.", type: 'text' };
    }
  }
};
