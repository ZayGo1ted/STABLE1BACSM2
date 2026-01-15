
import { GoogleGenAI } from "@google/genai";
import { User, ChatMessage } from '../types';
import { supabaseService } from './supabaseService';

interface AiResponse {
  text: string;
  resources?: any[];
  grounding?: any[];
  type: 'text' | 'image' | 'file';
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
      
      // 1. Fetch ALL Database Data (Lessons, Tasks, Subjects)
      const freshState = await supabaseService.fetchFullState();
      const lessons = freshState.lessons || [];
      const items = freshState.items || [];
      const subjects = freshState.subjects || [];

      // 2. Format a "Hub Library Index" for the AI
      // We pass the entire library metadata so the AI can handle fuzzy matching/misspellings
      const hubLibraryIndex = lessons.map(l => ({
        id: l.id,
        title: l.title,
        subject: subjects.find(s => s.id === l.subjectId)?.name.en || 'General',
        type: l.type,
        keywords: l.keywords || [],
        files: (l.attachments || []).map(a => ({ name: a.name, url: a.url, type: a.type }))
      }));

      // 3. Build Conversation Memory
      const recentHistory = history
        .filter(m => !m.mediaUrl || m.mediaUrl.length < 500)
        .slice(-8)
        .map(m => {
          const role = m.content.startsWith(":::AI_RESPONSE:::") ? "Zay" : "Student";
          const cleanContent = m.content.replace(":::AI_RESPONSE:::", "");
          return `${role}: ${cleanContent}`;
        })
        .join('\n');

      const userName = requestingUser?.name.split(' ')[0] || "Student";

      // 4. Elite System Instruction
      const systemInstruction = `
        You are Zay, the Elite AI Academic Hub Controller for 1BacSM.
        Your primary directive is to serve the **HUB LIBRARY** data accurately.

        **HUB LIBRARY INDEX (INTERNAL DATABASE)**:
        ${JSON.stringify(hubLibraryIndex, null, 2)}

        **ACADEMIC CALENDAR (EXAMS/HW)**:
        ${JSON.stringify(items.map(i => ({ title: i.title, type: i.type, date: i.date })), null, 2)}

        **STRICT OPERATIONAL PROTOCOLS**:

        1. **FUZZY SEARCHING & MISSPELLINGS**:
           - Users often misspell (e.g., "fzik" for "physics", "lecon" for "leçon"). 
           - Scan the HUB LIBRARY INDEX for the most relevant match based on intent.

        2. **LESSON REQUESTS ("Leçon", "Cours", "Explique moi...", "Le document...")**:
           - **IF A MATCH EXISTS**: 
             * Stop immediately. Do not give a long explanation from your memory.
             * Respond: "I found the lesson **[Lesson Title]** in the Hub library. Here is the file for your study."
             * Attach the files using: \`ATTACH_FILES::[JSON_FILES_FROM_INDEX]\`.
           - **IF NO MATCH EXISTS**:
             * Explicitly state: "I couldn't find a specific lesson for this in the Hub database."
             * **PERMISSION BUFFER**: Ask: "Would you like me to explain it using my internal 1BacSM knowledge?"
             * DO NOT explain until they say yes.

        3. **EXERCISE SERIES ("Série", "Exercices", "Train me")**:
           - Check if a matching [TASK] or [EXERCISE] type lesson exists in the Hub Index.
           - If NO match exists: **GENERATE** a high-quality "Série d'exercices" (3-5 problems) in your message.
           - **STRICT RESTRICTION**: When you generate a series yourself, **DO NOT** attach any files from the Hub Index. The response should be pure text exercises.

        4. **SUMMARY REQUESTS ("Résumé")**:
           - Only summarize from your own knowledge if the Hub Index doesn't contain a "summary" type lesson for that topic.

        5. **MATHEMATICAL PRECISION**:
           - Use Unicode: Δ, ∑, ∫, √, ∞, ≠, ≤, ≥, ±, α, β, θ, λ, π, Ω, ⇒, ⇔, ∀, ∃, ∈.
           - Bold vectors: **AB**.

        **RESPONSE FORMAT**:
        - Be direct and professional.
        - Commands like \`ATTACH_FILES::[...]\` MUST be at the very end.
      `;

      // 5. Call Gemini
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash',
        contents: { parts: [{ text: `History:\n${recentHistory}\n\nUser Question: ${userQuery}` }] },
        config: { 
          systemInstruction, 
          temperature: 0.2, // Lower temperature for stricter adherence
          tools: [{ googleSearch: {} }]
        },
      });

      let text = (response.text || "").trim();
      let resources: any[] = [];
      const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

      // 6. Post-process response for attachments command
      if (text.includes("ATTACH_FILES::")) {
        const parts = text.split("ATTACH_FILES::");
        text = parts[0].trim();
        try {
            const jsonPart = parts[parts.length - 1].trim();
            resources = JSON.parse(jsonPart);
        } catch (e) {
            console.error("AI Resource Parse Error", e);
        }
      } 

      return { text, resources, grounding, type: 'text' };

    } catch (error) {
      console.error("AI Service Error:", error);
      return { text: "Connection error with the Hub. Please retry.", type: 'text' };
    }
  }
};
