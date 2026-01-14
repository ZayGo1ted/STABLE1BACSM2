
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
      const recentHistory = history
        .filter(m => !m.mediaUrl || m.mediaUrl.length < 500)
        .slice(-10)
        .map(m => {
          const role = m.content.startsWith(":::AI_RESPONSE:::") ? "Zay" : "Student";
          const cleanContent = m.content.replace(":::AI_RESPONSE:::", "");
          return `${role}: ${cleanContent}`;
        })
        .join('\n');

      // 3. Smart Context Detection
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
          Files: ${JSON.stringify(attachments.map(a => ({ name: a.name, type: a.type, url: a.url })))}
          (Visual data from these files is available to you for analysis)
          `;

          for (const att of attachments) {
              if (att.type === 'image' && att.url) {
                  const b64 = await imageUrlToBase64(att.url);
                  if (b64) {
                      contentParts.push({ inlineData: { data: b64.data, mimeType: b64.mimeType } });
                  }
              }
          }
      }

      contentParts.push({ text: userQuery });

      // 5. Build Database Context for Tasks
      const pendingTasks = items.filter(i => new Date(i.date) >= new Date(new Date().setDate(new Date().getDate() - 7)));
      const taskContext = pendingTasks.map(i => 
          `[DB_TASK] Type:${i.type} | Title:${i.title} | Subject:${subjects.find(s=>s.id===i.subjectId)?.name.en} | Date:${i.date} | Note:${i.notes}`
      ).join('\n');

      const userName = requestingUser?.name.split(' ')[0] || "Student";

      // 6. System Instruction
      const systemInstruction = `
        You are Zay, the AI assistant for 1Bac Science Math.
        User: ${userName}.

        **MEMORY:**
        ${recentHistory}

        **DATA:**
        ${taskContext || "No active DB tasks."}
        ${lessonContextString}

        **RULES:**
        1. **OUTPUT CONTROL (CRITICAL)**:
           - If user asks for "Exercises" or a "Series": GENERATE the text questions. Do NOT attach the lesson PDF unless explicitly asked (e.g., "give me the file").
           - If user asks for "The Lesson": Summarize it. Do NOT attach the PDF unless asked.
           - ONLY use the \`ATTACH_FILES::[...]\` command if the user specifically requested the physical document/file or if the question cannot be answered without sending the file.

        2. **ROUTER**:
           - "Homework" (Devoirs) -> Check [DB_TASK] first.
           - "Exercises" (Série) -> If no [DB_TASK], generate a custom series based on the analyzed lesson images/context.

        3. **MATH**:
           - Use Unicode: Δ, ∑, ∫, √, ∞, ≠, ≤, ≥, ±, α, β, θ, λ, π, Ω.
           - Vectors: **AB**.
           - No LaTeX blocks like \`$$\`. Use natural inline math.

        4. **MISSING**:
           - If asked for a file/lesson not in [FOCUSED_LESSON_DATA], reply with [REPORT_MISSING].

        **RESPONSE FORMAT**:
        Answer in academic markdown. 
        If attaching files is absolutely necessary based on the request:
        ATTACH_FILES::[{"name": "Filename", "url": "URL", "type": "file"}]
      `;

      // 7. Call Gemini
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: { parts: contentParts },
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
            console.error("AI Resource Parse Error", e);
        }
      } 
      // STRICTER FALLBACK: Only attach if query explicitly asks for files/pdfs, ignoring generic context
      else if (targetLesson && (userQuery.toLowerCase().includes("pdf") || userQuery.toLowerCase().includes("file") || userQuery.toLowerCase().includes("download"))) {
         resources = targetLesson.attachments.map(a => ({ name: a.name, url: a.url, type: a.type }));
      }

      if (text.includes("[REPORT_MISSING]")) {
        text = text.replace("[REPORT_MISSING]", "").trim();
        if (requestingUser) await supabaseService.createAiLog(requestingUser.id, userQuery);
      }

      return { text, resources, grounding, type: 'text' };

    } catch (error) {
      console.error("AI Service Error:", error);
      return { text: "Network hiccup. Try again.", type: 'text' };
    }
  }
};
