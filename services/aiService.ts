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
      console.error("API_KEY missing in this environment.");
      return { text: "Connection error: API key not detected in deployment.", type: 'text' };
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      
      // Fetch fresh library data directly from DB
      const freshState = await supabaseService.fetchFullState();
      const lessons = freshState.lessons || [];
      const subjects = freshState.subjects || [];

      const lessonContext = lessons
        .filter(l => l.isPublished)
        .map(l => {
          const subject = subjects.find(s => s.id === l.subjectId)?.name.en || 'General';
          const files = (l.attachments || []).map(a => `   - ${a.name}: ${a.url}`).join('\n');
          return `
ENTRY_START
Title: ${l.title}
Subject: ${subject}
Description: ${l.description}
Meta: ${l.aiMetadata}
Keywords: ${l.keywords.join(', ')}
Files:
${files || "none"}
ENTRY_END`;
        }).join('\n');

      const systemInstruction = `
        You are Zay, the smart assistant for 1BacSM (Sciences Math). 
        You help students with all subjects including Physics, Chemistry, Math, and French.

        LIBRARY CONTEXT:
        ${lessonContext || "EMPTY"}

        OPERATIONAL GUIDELINES:
        1. NO BOLDING: Never use double asterisks (**) or bold text. Keep it clean and plain.
        2. BE HELPFUL: If a student asks about a subject, provide a clear, concise explanation based on the LIBRARY.
        3. MEDIA INTEGRATION: If a relevant file exists, explain it briefly and end your message with MEDIA_URL::[URL].
        4. FALLBACK: If the question is completely outside the library data or school context, respond ONLY with: NOT_FOUND_IN_DB.
        5. TONE: Be a supportive, high-tech classmate. Avoid sounding like a rigid bot.
      `;

      // Updated to the latest Flash model (Gemini 2.0 Flash)
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userQuery,
        config: { systemInstruction, temperature: 0.2 },
      });

      const text = response.text || "";

      if (text.includes("NOT_FOUND_IN_DB")) {
        if (requestingUser) {
          await supabaseService.createAiLog(requestingUser.id, userQuery);
        }
        return { 
          text: "I couldn't find that specific resource in our library. I've logged this so the dev team can add it soon!", 
          type: 'text' 
        };
      }

      const parts = text.split("MEDIA_URL::");
      const cleanText = parts[0].trim();
      const mediaUrl = parts[1]?.trim();
      let type: 'text' | 'image' | 'file' = 'text';

      if (mediaUrl) {
        const ext = mediaUrl.split('.').pop()?.toLowerCase();
        type = ['jpg', 'jpeg', 'png'].includes(ext || '') ? 'image' : 'file';
      }

      return { text: cleanText, mediaUrl, type };

    } catch (error) {
      console.error("AI Error:", error);
      return { text: "Zay is currently offline for maintenance. Try again in a bit!", type: 'text' };
    }
  }
};
