
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
          Found: YES
          Title: ${targetLesson.title}
          Subject: ${subject?.name.en || 'General'}
          Content Summary: ${targetLesson.description}
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
      } else {
          lessonContextString = `[DATABASE_LESSON_MATCH] Found: NO`;
      }

      contentParts.push({ text: userQuery });

      // 5. Build Academic Context (Exams/Homework)
      const academicContext = items.map(i => 
          `[TASK] ${i.type.toUpperCase()}: "${i.title}" for ${subjects.find(s=>s.id===i.subjectId)?.name.en} on ${i.date}. Notes: ${i.notes}`
      ).join('\n');

      const userName = requestingUser?.name.split(' ')[0] || "Student";

      // 6. Refined System Instruction
      const systemInstruction = `
        You are Zay, the Elite AI Academic Hub Controller for 1BacSM students.
        User: ${userName}.

        **CORE MANDATE**: fulfill user needs with precision, using Hub data as priority.

        **DATABASE CONTEXT**:
        ${lessonContextString}
        ${academicContext}

        **BEHAVIOR RULES (STRICT)**:
        1. **LESSON REQUESTS ("Leçon", "Cours", "The Lesson")**:
           - If Found: YES in [DATABASE_LESSON_MATCH]:
             *   DO NOT explain the lesson from your own knowledge. 
             *   Instead, say: "I've found the lesson **[Title]** in the Hub. Here is the file for your study."
             *   Use \`ATTACH_FILES::[...]\` with the Hub files.
           - If Found: NO in [DATABASE_LESSON_MATCH]:
             *   Say: "I couldn't find this lesson in our Hub database. Would you like me to provide a full explanation based on my internal knowledge?" 
             *   Wait for permission before generating long tutoring text.

        2. **EXERCISE SERIES ("Série", "Exercices")**:
           - If [TASK] exists for this topic: Reference it and attach relevant Hub task files.
           - If no [TASK] exists: **GENERATE** 3-5 high-level 1BacSM exercises (Applications + Reflection).
           - **CRITICAL**: When generating a series from scratch, **DO NOT** attach unrelated lesson PDFs or Hub files from [DATABASE_LESSON_MATCH] unless the user specifically asked for them.

        3. **SUMMARY REQUESTS ("Résumé")**:
           - Check [DATABASE_LESSON_MATCH] for existing summary files first.
           - If missing, generate a concise formula sheet with Unicode math.

        4. **FILE ATTACHMENT PROTOCOL**:
           - Only use \`ATTACH_FILES::[JSON_ARRAY]\` at the END of your message if:
             a) The user asked for a file ("donne moi le pdf", "send me the document").
             b) You are delivering a specific matched lesson from the database.
           - **NEVER** attach files from the database when you are generating a new exercise series.

        5. **PERSONA & STYLE**:
           - Professional, direct, and extremely intelligent.
           - Use Unicode for math: Δ, ∑, ∫, √, ∞, ≠, ≤, ≥, ±, α, β, θ, λ, π, Ω.
           - Bold vectors: **AB**.
           - If query is missing context, ask for the subject.

        **RESPONSE FORMAT**:
        - Concise headers.
        - Math blocks for equations.
        - \`ATTACH_FILES::[{"name": "...", "url": "...", "type": "..."}]\` ONLY when appropriate.
      `;

      // 7. Call Gemini
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash',
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

      // Post-process response for attachments
      if (text.includes("ATTACH_FILES::")) {
        const parts = text.split("ATTACH_FILES::");
        text = parts[0].trim();
        try {
            // Take the last match if multiple exist
            const jsonPart = parts[parts.length - 1].trim();
            resources = JSON.parse(jsonPart);
        } catch (e) {
            console.error("AI Resource Parse Error", e);
        }
      } 

      // Remove [REPORT_MISSING] if generated
      if (text.includes("[REPORT_MISSING]")) {
        text = text.replace("[REPORT_MISSING]", "").trim();
        if (requestingUser) await supabaseService.createAiLog(requestingUser.id, userQuery);
      }

      return { text, resources, grounding, type: 'text' };

    } catch (error) {
      console.error("AI Service Error:", error);
      return { text: "I encountered a processing error. Please rephrase or try again.", type: 'text' };
    }
  }
};
