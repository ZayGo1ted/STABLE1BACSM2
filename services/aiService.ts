
import { GoogleGenAI } from "@google/genai";
import { User } from '../types';
import { supabaseService } from './supabaseService';

interface AiResponse {
  text: string;
  resources?: any[];
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
      const items = freshState.items || [];
      const subjects = freshState.subjects || [];

      const lessonContext = lessons
        .filter(l => l.isPublished)
        .map(l => {
          const subject = subjects.find(s => s.id === l.subjectId)?.name.en || 'General';
          const attachmentsJson = (l.attachments || []).map(a => ({
            name: a.name,
            url: a.url,
            type: a.type
          }));

          return `ID:${l.id} | TITLE:${l.title} | SUBJ:${subject} | DESC:${l.description} | RESOURCES_JSON:${JSON.stringify(attachmentsJson)}`;
        })
        .join('\n');

      const today = new Date();
      const upcomingItems = items
        .filter(i => new Date(i.date) >= today)
        .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map(i => `DUE:${i.date} | TYPE:${i.type} | TITLE:${i.title} | SUBJ:${subjects.find(s => s.id === i.subjectId)?.name.en}`);
      
      const calendarContext = upcomingItems.length > 0 
        ? upcomingItems.join('\n') 
        : "NO_UPCOMING_TASKS";

      const userName = requestingUser?.name.split(' ')[0] || "Student";

      const systemInstruction = `
        You are Zay, a smart academic assistant for ${userName}.

        **DATABASE CONTEXT:**
        ${lessonContext || "EMPTY_LIBRARY"}
        
        TASKS:
        ${calendarContext}

        **STRICT FORMATTING RULES:**
        1. **PLAIN TEXT ONLY**: Use standard alphanumeric characters. Do NOT use weird signs, complex markdown decorations, or ASCII art.
        2. **EMOJIS**: Use emojis very rarely (maximum 1 per message).
        3. **LANGUAGE**: Reply in the user's language (Darija, Arabic, French, or English).
        4. **FILE SHARING**: 
           - You MUST include ALL relevant resources from the lesson's RESOURCES_JSON.
           - Append them using: ATTACH_FILES::[JSON_ARRAY_OF_RESOURCES]
        5. **MISSING**: If no lesson matches, reply "REPORT_MISSING".

        **Example Response:**
        "Here is the lesson on limits. ATTACH_FILES::[{\"name\":\"Notes\",\"url\":\"...\",\"type\":\"image\"}]"
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: userQuery,
        config: { systemInstruction, temperature: 0.2 }, 
      });

      let text = (response.text || "").trim();
      let resources: any[] = [];

      if (text.includes("REPORT_MISSING")) {
        if (requestingUser) await supabaseService.createAiLog(requestingUser.id, userQuery);
        return { text: `I couldn't find that lesson, ${userName}. I've reported this to the admin.`, type: 'text' };
      }

      if (text.includes("ATTACH_FILES::")) {
        const parts = text.split("ATTACH_FILES::");
        text = parts[0].trim();
        try {
            resources = JSON.parse(parts[1].trim());
        } catch (e) {
            console.error("AI sent invalid JSON", e);
        }
      }

      return { text, resources, type: 'text' };

    } catch (error) {
      console.error("AI Service Failure:", error);
      return { text: "Connection error. Please try again.", type: 'text' };
    }
  }
};
