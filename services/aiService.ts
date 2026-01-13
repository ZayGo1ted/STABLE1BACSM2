
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
        You are Zay, assistant for the 1BacSM class.
        Use the LIBRARY below to answer.
        
        LIBRARY:
        ${lessonContext || "EMPTY"}

        RULES:
        1. NO BOLD TEXT. Do not use double asterisks.
        2. If you find a match, provide the answer and end with MEDIA_URL::[URL].
        3. If no match exists, say exactly: NOT_FOUND_IN_DB.
        4. Keep answers short and plain text.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userQuery,
        config: { systemInstruction, temperature: 0.1 },
      });

      const text = response.text || "";

      if (text.includes("NOT_FOUND_IN_DB")) {
        if (requestingUser) {
          await supabaseService.createAiLog(requestingUser.id, userQuery);
        }
        return { 
          text: "I could not find that lesson in our library. I have logged this for the developers.", 
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
      return { text: "Zay is currently unavailable. Check your connection.", type: 'text' };
    }
  }
};
