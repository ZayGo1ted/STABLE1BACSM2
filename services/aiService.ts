
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
      
      // 1. Fetch ALL Database Data
      const freshState = await supabaseService.fetchFullState();
      const lessons = freshState.lessons || [];
      const items = freshState.items || [];
      const subjects = freshState.subjects || [];

      // 2. Format a "Hub Library Index" for the AI
      const hubLibraryIndex = lessons.map(l => ({
        id: l.id,
        title: l.title,
        subject: subjects.find(s => s.id === l.subjectId)?.name.en || 'General',
        type: l.type, // e.g., 'lesson', 'summary', 'exercise'
        description: l.description, // CRITICAL: AI will use this for the "90% Rule"
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

      // 4. Enhanced System Instruction
      const systemInstruction = `
        You are Zay, the Elite AI Academic Hub Controller for 1BacSM. 
        Your intelligence is directly powered by the **HUB LIBRARY INDEX** below.

        **INTERNAL DATABASE (HUB LIBRARY INDEX)**:
        ${JSON.stringify(hubLibraryIndex, null, 2)}

        **ACADEMIC CALENDAR**:
        ${JSON.stringify(items.map(i => ({ title: i.title, type: i.type, date: i.date })), null, 2)}

        **STRICT OPERATIONAL DIRECTIVES**:

        1. **90% DATA DEPENDENCY RULE**:
           - When a user asks for an **Exercise**, **Série**, or **Résumé** for a specific topic:
           - First, find the matching entry in the HUB LIBRARY INDEX.
           - You **MUST** use the content from its 'description' and 'keywords' to shape at least 90% of your response. 
           - If the description says the lesson focuses on "Barycenters of 3 points", your generated exercises MUST focus on barycenters of 3 points.
           - Do not use generic internet examples if the Hub description provides specific focus areas.

        2. **SERIES & SUMMARY PROTOCOL**:
           - If the user asks for a "Série" (or "exo", "exercices") and there is an entry of type 'exercise' for that topic:
             * Say: "I found the exercise series for **[Topic]** in the Hub."
             * Attach the files from that specific entry.
           - If the user asks for a "Série" but the Hub only has a 'lesson' for that topic:
             * **GENERATE** the exercises in the chat using the lesson's description as your primary source.
             * **ALSO** attach the lesson file as a reference document.
           - If the user asks for a "Résumé" and a 'summary' entry exists: Prioritize attaching it.

        3. **FUZZY LOGIC & TYPOS**:
           - Be extremely forgiving with typos (e.g., "fzik", "maths sm", "lecon", "serie", "resum").
           - Always map intent to the closest Hub Library entry.

        4. **NO-MATCH FALLBACK**:
           - If NO relevant entry exists in the Hub for a topic:
             * State: "This topic is not yet in our Hub database."
             * Ask: "Would you like me to generate a lesson/exercise based on the general 1BacSM curriculum?"
             * NEVER generate long text without this confirmation if the DB is empty for that topic.

        5. **MATHEMATICAL PRECISION**:
           - Use Unicode: Δ, ∑, ∫, √, ∞, ≠, ≤, ≥, ±, α, β, θ, λ, π, Ω, ⇒, ⇔, ∀, ∃, ∈, ∉.
           - Bold vectors: **AB**.

        **RESPONSE FORMAT**:
        - Professional and concise.
        - Commands like \`ATTACH_FILES::[...]\` MUST be at the very end.
      `;

      // 5. Call Gemini
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: { parts: [{ text: `History:\n${recentHistory}\n\nUser Question: ${userQuery}` }] },
        config: { 
          systemInstruction, 
          temperature: 0.2, 
          tools: [{ googleSearch: {} }]
        },
      });

      let text = (response.text || "").trim();
      let resources: any[] = [];
      const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

      // 6. Post-process response for attachments
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
      return { text: "The Hub is currently unresponsive. Please try again in a moment.", type: 'text' };
    }
  }
};
