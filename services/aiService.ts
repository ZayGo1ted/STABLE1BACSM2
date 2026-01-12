
import { GoogleGenAI } from "@google/genai";
import { AppState, User, Lesson, Subject } from '../types';
import { storageService } from './storageService';

interface AiResponse {
  text: string;
  mediaUrl?: string;
  type: 'text' | 'image' | 'file';
}

/**
 * AI Service for @Zay Classroom Assistant.
 * Implements Google Gemini 3 Flash Preview for intelligent classroom support.
 */
export const aiService = {
  /**
   * Generates a response from @Zay using the provided context.
   * @param userQuery The student's question or command.
   * @param requestingUser The user profile making the request.
   */
  askZay: async (userQuery: string, requestingUser: User | null): Promise<AiResponse> => {
    // 1. Strict Environment Variable Check
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.error("AI Service Error: process.env.API_KEY is missing.");
      return { text: "⚠️ Connectivity Error: My brain is disconnected (Missing API Key). Please tell the developer.", type: 'text' };
    }

    try {
      // 2. Initialize Client
      const ai = new GoogleGenAI({ apiKey });
      
      // 3. Load Context (RAG)
      const appState: AppState = storageService.loadState();
      
      // 4. Time Context
      const now = new Date();
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDayName = dayNames[now.getDay()];
      const currentDateStr = now.toISOString().split('T')[0];
      const currentTimeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // 5. Build Knowledge Base
      const upcomingItems = appState.items
        .filter(i => new Date(i.date) >= new Date(new Date().setDate(now.getDate() - 1)))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 8)
        .map(i => `- ${i.type.toUpperCase()}: ${i.title} (${i.date} @ ${i.time})`);

      const subjectsList = appState.subjects.map(s => s.name.en).join(', ');

      // 5.1 LESSON RETRIEVAL (Basic RAG)
      const queryLower = userQuery.toLowerCase();
      const relevantLessons = appState.lessons
        .filter(l => l.isPublished)
        .filter(l => {
          const contentMatch = l.title.toLowerCase().includes(queryLower) || 
                               l.description.toLowerCase().includes(queryLower) ||
                               l.keywords.some(k => queryLower.includes(k.toLowerCase()));
          const subject = appState.subjects.find(s => s.id === l.subjectId);
          const subjectMatch = subject ? queryLower.includes(subject.name.en.toLowerCase()) || 
                                         queryLower.includes(subject.name.fr.toLowerCase()) : false;
          return contentMatch || subjectMatch;
        })
        .slice(0, 5);

      const lessonContext = relevantLessons.map(l => {
          const subject = appState.subjects.find(s => s.id === l.subjectId)?.name.en || 'General';
          return `
            [LESSON MATCH]
            ID: ${l.id}
            Title: ${l.title}
            Subject: ${subject}
            Type: ${l.type}
            Desc: ${l.description}
            Time: ${l.estimatedTime}
            URL: ${l.fileUrl}
          `;
      }).join('\n');

      const systemInstruction = `
        You are @Zay, the smart classroom assistant for "1BacSM" (Science Math).
        
        **CONTEXT:**
        - Today: ${currentDateStr} (${currentDayName}), ${currentTimeStr}
        - User: ${requestingUser?.name || 'Student'}
        
        **DATA:**
        - Upcoming Tasks: ${upcomingItems.length ? upcomingItems.join('; ') : 'Nothing scheduled soon.'}
        - Subjects: ${subjectsList}
        
        **LESSON DATABASE:**
        ${lessonContext || "No specific lessons found for this query."}

        **STRICT RULES:**
        1. Keep responses EXTREMELY SHORT (1-2 sentences).
        2. If you find a matching lesson in the context:
           - Provide a short summary.
           - IMPORTANT: You MUST output the file URL as the LAST line of your response in this exact format: "MEDIA_URL::[URL]"
        3. Do not invent lessons.
        4. If the user explicitly asks for a file/image and you found one, use the MEDIA_URL format.
      `;

      // 6. Generate Content
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userQuery,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
        },
      });

      // 7. Parse Result
      const text = response.text || "";
      const mediaSplit = text.split("MEDIA_URL::");
      
      let finalText = mediaSplit[0].trim();
      let mediaUrl = mediaSplit[1]?.trim();
      let type: 'text' | 'image' | 'file' = 'text';

      if (mediaUrl) {
        const ext = mediaUrl.split('.').pop()?.toLowerCase();
        if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext || '')) {
          type = 'image';
        } else {
          type = 'file';
        }
      }

      return {
        text: finalText,
        mediaUrl: mediaUrl,
        type: type
      };

    } catch (error: any) {
      console.error("AI Generation Failed:", error);
      return { text: "😵 I got confused. Please ask again.", type: 'text' };
    }
  }
};
