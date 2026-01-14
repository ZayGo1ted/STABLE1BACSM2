
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
      console.error("CRITICAL: API_KEY is undefined.");
      return { text: "System Error: API Key missing.", type: 'text' };
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

          return `ID:${l.id} | TITLE:${l.title} | SUBJ:${subject} | DESC:${l.description} | RESOURCES:${JSON.stringify(attachmentsJson)}`;
        })
        .join('\n');

      const userName = requestingUser?.name.split(' ')[0] || "Student";

      const systemInstruction = `
        You are Zay, a brilliant academic assistant for a 1Bac Science Math student named ${userName}.

        **BEHAVIOR:**
        - You are helpful, encouraging, and highly academic.
        - If a user asks for "exercises" or "série d'exercices" for a specific lesson in the database:
          1. Find the lesson details from the context below.
          2. Generate a custom "Series d'exercices" (Worksheet) with at least 3 high-quality problems ranging from easy to difficult.
          3. Focus on 1Bac SM level complexity (Logic, Physics, etc.).
        - If the user asks for files, always include the relevant ATTACH_FILES:: link.

        **CONTEXT DATA:**
        ${lessonContext || "NO_LESSONS_AVAILABLE"}

        **STRICT FORMATTING:**
        1. **NO WEIRD SIGNS**: Do not use complex markdown, glitch text, or excessive bolding.
        2. **PLAIN TEXT ONLY**: Keep it simple and readable on small screens.
        3. **LIMIT EMOJIS**: Use a maximum of 1 emoji per message, only if necessary.
        4. **LANGUAGE**: Reply in the student's language (English, French, or Arabic/Darija).

        **MISSING CONTENT:**
        If no lesson matches the user's query, reply exactly: "REPORT_MISSING".
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userQuery,
        config: { systemInstruction, temperature: 0.3 }, 
      });

      let text = (response.text || "").trim();
      let resources: any[] = [];

      if (text.includes("REPORT_MISSING")) {
        if (requestingUser) await supabaseService.createAiLog(requestingUser.id, userQuery);
        return { text: `I couldn't find a lesson matching that topic in our library, ${userName}. I've noted this for the Admin to update!`, type: 'text' };
      }

      // Handle file attachments if AI decided to include them
      if (text.includes("ATTACH_FILES::")) {
        const parts = text.split("ATTACH_FILES::");
        text = parts[0].trim();
        try {
            resources = JSON.parse(parts[1].trim());
        } catch (e) {
            console.error("AI returned invalid JSON for files");
        }
      }

      return { text, resources, type: 'text' };

    } catch (error) {
      console.error("AI Service Error:", error);
      return { text: "I'm having trouble connecting right now. Please try again in a moment.", type: 'text' };
    }
  }
};
