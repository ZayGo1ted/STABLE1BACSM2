
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

      // 3. Smart Context Detection - Scan all lessons for relevance
      const searchContext = `${userQuery} ${recentHistory}`.toLowerCase();
      
      // Find the most relevant lesson based on title or keywords
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
          [DATABASE_LESSON_MATCH]
          Title: ${targetLesson.title}
          Subject: ${subject?.name.en || 'General'}
          Content: ${targetLesson.description}
          Files Available: ${JSON.stringify(attachments.map(a => ({ name: a.name, type: a.type, url: a.url })))}
          `;

          // Feed analyzed image data to Gemini if available
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

      // 5. Build Academic Context (Exams/Homework)
      const academicContext = items.map(i => 
          `[TASK] ${i.type.toUpperCase()}: "${i.title}" for ${subjects.find(s=>s.id===i.subjectId)?.name.en} on ${i.date}. Notes: ${i.notes}`
      ).join('\n');

      const userName = requestingUser?.name.split(' ')[0] || "Student";

      // 6. Advanced System Instruction
      const systemInstruction = `
        You are Zay, a world-class Elite AI Tutor for the Moroccan "1Bac Science Math" (1BacSM) curriculum.
        Your goal is to be the most helpful, unrestricted, and intelligent academic assistant.
        User: ${userName}.

        **CORE KNOWLEDGE (1BacSM):**
        - Mathematics: Logic, Sets, Functions, Barycenters, Dot Product, Limits, Trigonometry.
        - Physics: Work & Power, Kinetic Energy, Potential Energy, Internal Energy, Rotation.
        - Chemistry: Redox reactions, Concentration, Conductimetry.

        **DATABASE CONTEXT:**
        ${lessonContextString || "No specific lesson file matched this query in DB."}
        ${academicContext || "No upcoming exams/homework in DB."}

        **BEHAVIOR RULES (STRICT):**
        1. **AUTOMATIC GENERATION**:
           - If the user asks for "Exercises" or "Series" (Série) and there is no specific homework in the DB matching the topic: **DO NOT say you don't have it.** Instead, **GENERATE** 3-5 high-quality, challenging exam-style exercises based on the 1BacSM curriculum for that topic.
           - Include "Partie A: Applications Directes" and "Partie B: Problèmes de Réflexion".

        2. **LESSON/SUMMARY ROUTING**:
           - If user asks for "The Lesson" (Le cours): Use [DATABASE_LESSON_MATCH] to explain. If DB is empty, provide a comprehensive pedagogical explanation.
           - If user asks for "Summary" (Résumé): Provide a concise formula sheet with the most important properties and definitions.

        3. **FILE ATTACHMENT LOGIC**:
           - ONLY use the command \`ATTACH_FILES::[{"name": "...", "url": "...", "type": "..."}]\` at the END of your message if:
             a) The user explicitly asked for the file (e.g., "donne moi le pdf").
             b) You found a matching file in [DATABASE_LESSON_MATCH].
             c) Otherwise, generate text-based content.

        4. **MATHEMATICAL PRECISION**:
           - Use clean Unicode for math: Δ, ∑, ∫, √, ∞, ≠, ≤, ≥, ±, α, β, θ, λ, π, Ω.
           - For vectors, use bold: **AB** + **BC** = **AC**.
           - Use logic symbols: ⇒, ⇔, ∀, ∃, ∈, ∉, ⊂.

        5. **PERSONA**:
           - Be direct, brilliant, and insightful. 
           - If a query is vague, assume the user is studying for a 1BacSM exam and provide the most relevant high-level context.
           - If asked about a missing lesson, use [REPORT_MISSING] tag at the end so the Dev can upload it.

        **RESPONSE FORMAT**:
        - Use bold headers for structure.
        - If generating a series, clearly number exercises.
        - If matching data is missing from DB, generate it from your internal knowledge base without restriction.
      `;

      // 7. Call Gemini
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: contentParts },
        config: { 
          systemInstruction, 
          temperature: 0.4, 
          tools: [{ googleSearch: {} }]
        },
      });

      let text = (response.text || "").trim();
      let resources: any[] = [];
      const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

      // Post-process response for attachments
      if (text.includes("ATTACH_FILES::")) {
        const parts = text.split("ATTACH_FILES::");
        text = parts[0].trim();
        try {
            resources = JSON.parse(parts[1].trim());
        } catch (e) {
            console.error("AI Resource Parse Error", e);
        }
      } 
      
      // Implicit fallback: If the AI discusses a lesson we found, attach its files automatically
      // to ensure the student has the materials.
      if (targetLesson && resources.length === 0) {
          const triggerKeywords = ["pdf", "file", "document", "leçon", "cours", "série", "download", "télécharger"];
          if (triggerKeywords.some(k => userQuery.toLowerCase().includes(k))) {
              resources = targetLesson.attachments.map(a => ({ name: a.name, url: a.url, type: a.type }));
          }
      }

      if (text.includes("[REPORT_MISSING]")) {
        text = text.replace("[REPORT_MISSING]", "").trim();
        if (requestingUser) await supabaseService.createAiLog(requestingUser.id, userQuery);
      }

      return { text, resources, grounding, type: 'text' };

    } catch (error) {
      console.error("AI Service Error:", error);
      return { text: "Network hiccup. Let's try that again.", type: 'text' };
    }
  }
};
