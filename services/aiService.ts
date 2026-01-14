
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
 * Helper: Converts remote image URLs to Base64 for Gemini Vision
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
        console.error("AI Vision Fetch Error:", e);
        return null;
    }
}

export const aiService = {
  askZay: async (userQuery: string, requestingUser: User | null, history: ChatMessage[] = []): Promise<AiResponse> => {
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
      console.error("API_KEY missing");
      return { text: "System Error: Missing AI Configuration.", type: 'text' };
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      
      // 1. Fetch Real-time Database State
      const freshState = await supabaseService.fetchFullState();
      const lessons = freshState.lessons || [];
      const items = freshState.items || [];
      const subjects = freshState.subjects || [];

      // 2. Build Conversation Memory (Last 10 turns)
      // Filter out system messages or complex metadata to keep context clean
      const recentHistory = history
        .filter(m => !m.mediaUrl || m.mediaUrl.length < 500) // Skip heavy payloads in history
        .slice(-10)
        .map(m => {
          const role = m.content.startsWith(":::AI_RESPONSE:::") ? "Zay" : "Student";
          const cleanContent = m.content.replace(":::AI_RESPONSE:::", "");
          return `${role}: ${cleanContent}`;
        })
        .join('\n');

      // 3. Smart Context Detection
      // Check if the user is referring to a lesson mentioned in history or the current query
      const searchContext = `${userQuery} ${recentHistory}`.toLowerCase();
      let targetLesson = lessons.find(l => 
        searchContext.includes(l.title.toLowerCase()) || 
        (l.keywords && l.keywords.some(k => searchContext.includes(k.toLowerCase())))
      );

      // 4. Prepare Multimodal Input
      let contentParts: any[] = [];
      let lessonContextString = "";

      if (targetLesson) {
          const attachments = targetLesson.attachments || [];
          const subject = subjects.find(s => s.id === targetLesson.subjectId);
          
          lessonContextString = `
          [FOCUSED_LESSON_DATA]
          ID: ${targetLesson.id}
          Subject: ${subject?.name.en || 'General'}
          Title: ${targetLesson.title}
          Description: ${targetLesson.description}
          Files: ${JSON.stringify(attachments.map(a => a.name))}
          (Images from this lesson have been attached for your visual analysis)
          `;

          // Inject Visual Data for Gemini
          for (const att of attachments) {
              if (att.type === 'image' && att.url) {
                  const b64 = await imageUrlToBase64(att.url);
                  if (b64) {
                      contentParts.push({ inlineData: { data: b64.data, mimeType: b64.mimeType } });
                  }
              }
          }
      }

      // Add the text prompt last
      contentParts.push({ text: userQuery });

      // 5. Build Database Context for Tasks (Homework/Exams)
      const pendingTasks = items.filter(i => new Date(i.date) >= new Date(new Date().setDate(new Date().getDate() - 7)));
      const taskContext = pendingTasks.map(i => 
          `[DB_TASK] Type:${i.type} | Title:${i.title} | Subject:${subjects.find(s=>s.id===i.subjectId)?.name.en} | Date:${i.date} | Note:${i.notes}`
      ).join('\n');

      const userName = requestingUser?.name.split(' ')[0] || "Student";

      // 6. System Instruction (The Brain)
      const systemInstruction = `
        You are Zay, the AI assistant for a specialized "1Bac Science Math" (SM) classroom.
        User: ${userName}.

        **MEMORY & CONTEXT:**
        [PREVIOUS CHAT]:
        ${recentHistory}

        [DATABASE_ASSIGNMENTS]:
        ${taskContext || "No active assignments in database."}

        ${lessonContextString}

        **CORE BEHAVIORS:**
        1. **VISION & ANALYSIS**: If I provided images of a lesson, I want you to "read" them. If asked for a summary (resume), extract the definitions, theorems, and formulas visible in the images.
        2. **ROUTER LOGIC (Homework vs Exercises)**:
           - IF user asks for "Homework" (Devoirs) -> List items from [DATABASE_ASSIGNMENTS].
           - IF user asks for "Exercises" (Série) ->
             a) Check [DATABASE_ASSIGNMENTS] first.
             b) If nothing found, OFFER to generate a new practice series based on the lesson topic/images. Say: "I don't see assigned exercises in the database, but I can generate a custom series for you based on this lesson. Want me to?"
        3. **MATH RENDERING**:
           - Use standard unicode symbols: Δ, ∑, ∫, √, ∞, ≠, ≤, ≥, ±, α, β, θ, λ, π, Ω.
           - For vectors, use bold (e.g., **AB**).
           - Do NOT use LaTeX code blocks like \`\\[ ... \\]\` or \`$$ ... $$\`. Instead, write inline math naturally.
           - Example: "Calculate the limit of f(x) as x → +∞".
        4. **MISSING DATA**:
           - If the user asks for a specific lesson/file that is NOT in [FOCUSED_LESSON_DATA] and you cannot answer, reply containing the tag: [REPORT_MISSING].

        **TOOLS**: Use Google Search for verifying scientific constants, definitions, or current news.

        **OUTPUT**:
        - Keep it academic but friendly.
        - If referring to the focused lesson files, append: ATTACH_FILES::[JSON_ARRAY]
      `;

      // 7. Call Gemini
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: contentParts },
        config: { 
          systemInstruction, 
          temperature: 0.3, // Lower temperature for accurate academic math
          tools: [{ googleSearch: {} }]
        },
      });

      let text = (response.text || "").trim();
      let resources: any[] = [];
      const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

      // Handle Resource Attachments logic
      if (text.includes("ATTACH_FILES::")) {
        const parts = text.split("ATTACH_FILES::");
        text = parts[0].trim();
        try {
            resources = JSON.parse(parts[1].trim());
        } catch (e) {
            console.error("AI Resource Parse Error", e);
        }
      } 
      // Fallback: If no explicit attachment tag but we focused a lesson, attach its files implicitly if the user asked for "files" or "document"
      else if (targetLesson && (userQuery.includes("file") || userQuery.includes("pdf") || userQuery.includes("document"))) {
         resources = targetLesson.attachments.map(a => ({ name: a.name, url: a.url, type: a.type }));
      }

      // Handle Missing Data Reporting
      if (text.includes("[REPORT_MISSING]")) {
        text = text.replace("[REPORT_MISSING]", "").trim();
        if (requestingUser) {
            await supabaseService.createAiLog(requestingUser.id, userQuery);
        }
      }

      return { text, resources, grounding, type: 'text' };

    } catch (error) {
      console.error("AI Service Error:", error);
      return { text: "My brain is momentarily disconnected (Network Error). Please try again.", type: 'text' };
    }
  }
};
