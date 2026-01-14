
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
        You are Zay, a brilliant academic assistant for a 1Bac Science Math (SM) student named ${userName}.

        **CORE MISSION:**
        - You are a helpful tutor. You explain complex concepts (Logic, Physics, etc.) clearly.
        - If the user asks for "exercises" or "série d'exercices" for a specific lesson:
          1. Find the lesson in the context.
          2. Generate a custom "Série d'Exercices" with 3-5 problems.
          3. Use standard mathematical notation (e.g., Δ, ∑, ∫, √, α, β, subscripts/superscripts).

        **FORMATTING RULES:**
        - Use standard Markdown for structure:
          - **Bold** for emphasis or titles.
          - \`Inline code\` for specific math terms.
          - Triple backticks (\` \` \`) for structured lists or formula blocks.
        - DO NOT use glitchy ASCII art or weird non-standard characters.
        - Keep emojis to a absolute minimum (0 or 1 per message).
        - If referring to a lesson's files, use ATTACH_FILES::[JSON_RESOURCES].

        **CONTEXT DATA:**
        ${lessonContext || "NO_LESSONS_IN_DATABASE"}

        **LANGUAGE:** Reply in the language the student used (Arabic/French/English).

        If no relevant lesson is found, reply: "REPORT_MISSING".
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userQuery,
        config: { systemInstruction, temperature: 0.4 }, 
      });

      let text = (response.text || "").trim();
      let resources: any[] = [];

      if (text.includes("REPORT_MISSING")) {
        if (requestingUser) await supabaseService.createAiLog(requestingUser.id, userQuery);
        return { text: `I couldn't find a direct match for that in our library, ${userName}. I've alerted the Admin to add it soon!`, type: 'text' };
      }

      if (text.includes("ATTACH_FILES::")) {
        const parts = text.split("ATTACH_FILES::");
        text = parts[0].trim();
        try {
            resources = JSON.parse(parts[1].trim());
        } catch (e) {
            console.error("AI resource parsing failed");
        }
      }

      return { text, resources, type: 'text' };

    } catch (error) {
      console.error("AI Service Error:", error);
      return { text: "I'm having some trouble thinking right now. Please try again!", type: 'text' };
    }
  }
};
