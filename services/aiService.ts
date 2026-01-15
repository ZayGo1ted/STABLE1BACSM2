
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
 * Zay AI: Elite Academic Intelligence Layer
 * Engine: gemini-3-pro-preview (Superior Successor to 1.5 Pro)
 */
export const aiService = {
  askZay: async (userQuery: string, requestingUser: User | null, history: ChatMessage[] = [], imageUrl?: string): Promise<AiResponse> => {
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
      return { 
        text: "System Alert: Gemini 3 Pro Engine is currently offline. Please check your Hub configuration.", 
        type: 'text' 
      };
    }

    try {
      // Re-initialize for every call to ensure the latest environment key is used
      const ai = new GoogleGenAI({ apiKey: apiKey });
      const modelName = 'gemini-3-pro-preview';

      // 1. Context Sync from Hub Library
      const freshState = await supabaseService.fetchFullState();
      const lessons = freshState.lessons || [];
      const subjects = freshState.subjects || [];

      // 2. Intelligent Context Matching
      const normalizedQuery = userQuery.toLowerCase();
      const matchedLesson = lessons.find(l => {
        const titleMatch = normalizedQuery.includes(l.title.toLowerCase());
        const keywordMatch = l.keywords?.some(k => normalizedQuery.includes(k.toLowerCase()));
        return titleMatch || keywordMatch;
      });

      // 3. System Instruction for High-Level Science/Math
      const systemInstruction = `
        You are Zay, the Elite Academic Intelligence for the 1BacSM Hub.
        Engine: Google Gemini 3 Pro (High Reasoning).

        **GOAL**: Act as a perfect tutor and knowledge bridge for Science-Math students.
        **RULES**:
        1. **LIBRARY FIRST**: Prioritize using the provided Hub context for lesson data.
        2. **MATH PRECISION**: Use professional Unicode symbols (Δ, ∑, ∫, √, ∞, ≠, ≤, ≥, ±, α, β, θ, λ, π, Ω).
        3. **LINKING**: If a lesson matches, append files using: ATTACH_FILES::[{"name": "...", "url": "...", "type": "..."}]
        4. **GROUNDING**: Leverage Google Search for deep scientific validation and real-time facts.

        **CURRENT HUB CONTEXT**:
        ${JSON.stringify(lessons.map(l => ({ title: l.title, subject: subjects.find(s => s.id === l.subjectId)?.name.en })), null, 1)}
      `;

      // 4. Build Multi-modal Parts
      const parts: any[] = [{ text: userQuery }];

      if (imageUrl) {
        try {
          const res = await fetch(imageUrl);
          const blob = await res.blob();
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.readAsDataURL(blob);
          });
          parts.push({ inlineData: { data: base64, mimeType: blob.type } });
        } catch (e) { console.warn("Vision input failed."); }
      }

      // 5. Execute Pro-grade content generation
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ parts }],
        config: {
          systemInstruction,
          temperature: 0.3, 
          tools: [{ googleSearch: {} }]
        },
      });

      let text = response.text || "";
      let resources: any[] = [];
      let grounding: any[] = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

      // 6. Injection of Hub Resources if matched
      if (matchedLesson && !text.includes("ATTACH_FILES::")) {
        const fileLinks = (matchedLesson.attachments || []).map(a => ({ name: a.name, url: a.url, type: a.type }));
        text += `\n\nATTACH_FILES::${JSON.stringify(fileLinks)}`;
      }

      // 7. Parse the output for the Chat UI
      if (text.includes("ATTACH_FILES::")) {
        const splitParts = text.split("ATTACH_FILES::");
        text = splitParts[0].trim();
        try {
          resources = JSON.parse(splitParts[splitParts.length - 1].trim());
        } catch (e) {}
      }

      return { text, resources, grounding, type: 'text' };

    } catch (error: any) {
      console.error("[Zay Pro Error]:", error);
      return { 
        text: `Gemini Pro engine is currently under high load. Please retry your query in 10 seconds.`, 
        type: 'text' 
      };
    }
  }
};
