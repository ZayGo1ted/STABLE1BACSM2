
import { GoogleGenAI } from "@google/genai";
import { User, ChatMessage } from '../types';
import { supabaseService } from './supabaseService';

interface AiResponse {
  text: string;
  resources?: any[];
  grounding?: any[];
  type: 'text' | 'image' | 'file';
}

/**
 * Utility to convert image URL to base64 for AI Multimodal Vision
 */
async function imageUrlToBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64data = (reader.result as string).split(',')[1];
                resolve({ data: base64data, mimeType: blob.type });
            };
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.error("Failed to fetch image for AI analysis", e);
        return null;
    }
}

export const aiService = {
  askZay: async (userQuery: string, requestingUser: User | null, history: ChatMessage[]): Promise<AiResponse> => {
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
      return { text: "System Error: API Key configuration missing.", type: 'text' };
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      
      const freshState = await supabaseService.fetchFullState();
      const lessons = freshState.lessons || [];
      const items = freshState.items || [];
      const subjects = freshState.subjects || [];

      // 1. Contextual Memory: Format the last few messages for the AI
      // We exclude the AI_PREFIX from old messages to keep it clean
      const recentHistory = history.slice(-10).map(m => {
          const isAi = m.content.includes(":::AI_RESPONSE:::");
          const content = m.content.replace(":::AI_RESPONSE:::", "");
          return `${isAi ? 'Zay (You)' : 'Student'}: ${content}`;
      }).join('\n');

      // 2. Identify Target Lesson: Find if the user is talking about a specific lesson in current query or history
      const searchSpace = (userQuery + " " + recentHistory).toLowerCase();
      let targetLesson = lessons.find(l => 
        searchSpace.includes(l.title.toLowerCase()) || 
        (l.keywords && l.keywords.some(k => searchSpace.includes(k.toLowerCase())))
      );

      // 3. Prepare Multimodal Parts: Text + Images from files
      let contentsParts: any[] = [];
      let lessonContextHeader = "";

      if (targetLesson) {
          const attachments = targetLesson.attachments || [];
          lessonContextHeader = `[TARGET_LESSON_INFO]
          Title: ${targetLesson.title}
          Context: ${targetLesson.description}
          Files Available: ${JSON.stringify(attachments.map(a => a.name))}
          \n`;

          // Add images from the lesson so Zay can "read" them
          for (const att of attachments) {
              if (att.type === 'image') {
                  const b64 = await imageUrlToBase64(att.url);
                  if (b64) {
                      contentsParts.push({
                          inlineData: { data: b64.data, mimeType: b64.mimeType }
                      });
                  }
              }
          }
      }

      // Add the text prompt at the end of the parts
      contentsParts.push({ text: userQuery });

      const taskContext = items
        .map(i => `[DATABASE_TASK] ID: ${i.id} | TYPE: ${i.type} | TITLE: ${i.title} | DUE: ${i.date} | NOTES: ${i.notes}`)
        .join('\n');

      const userName = requestingUser?.name.split(' ')[0] || "Student";

      const systemInstruction = `
        You are Zay, the brilliant academic assistant for a 1Bac Science Math (SM) student named ${userName}.
        
        **CONVERSATION MEMORY (Last 10 turns):**
        ${recentHistory}

        **DATABASE CONTEXT:**
        ${lessonContextHeader}
        ${taskContext}

        **OPERATIONAL GUIDELINES:**
        1. **RESUMES (SUMMARIES)**: When asked for a resume, analyze the [TARGET_LESSON_INFO] and any images provided. Images are actual lesson papers/whiteboards. Extract definitions, formulas, and theorems from them to create a high-quality academic summary.
        2. **EXERCISES vs HOMEWORK**:
           - If a student says "exercises" or "homework" and it's unclear:
             ASK: "Would you like me to show the homework the teacher assigned in the database, or should I generate a NEW series of exercises based on the lesson papers I've analyzed?"
           - If they want the teacher's version, search [DATABASE_TASK].
           - If they want a generated series, create 3-5 challenging SM-level problems based on the analyzed file content.
        3. **SMART MEMORY**: If the student says something like "yes", "do it", or "@zay okay," use the CONVERSATION MEMORY to understand the context of the previous turn.
        4. **SEARCH**: You have access to Google Search. Use it for complex scientific queries or verifying math proofs.
        5. **FORMATTING**: Use high-quality Markdown. Use math signs (Δ, ∑, ∫, √, α, β, subscripts/superscripts) for professional notation.

        If a specific lesson is found, append ATTACH_FILES::[JSON_ARRAY] to your response.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: contentsParts },
        config: { 
          systemInstruction, 
          temperature: 0.3,
          tools: [{ googleSearch: {} }]
        },
      });

      let text = (response.text || "").trim();
      let resources: any[] = [];
      const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

      if (text.includes("ATTACH_FILES::")) {
        const parts = text.split("ATTACH_FILES::");
        text = parts[0].trim();
        try {
            resources = JSON.parse(parts[1].trim());
        } catch (e) {
            console.error("AI resource parsing failed");
        }
      }

      return { text, resources, grounding, type: 'text' };

    } catch (error) {
      console.error("AI Service Error:", error);
      return { text: "I'm having a bit of trouble connecting to my database. Could you try asking again?", type: 'text' };
    }
  }
};
