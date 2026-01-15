
import { GoogleGenAI } from "@google/genai";
import { User, ChatMessage } from '../types';
import { supabaseService } from './supabaseService';

interface AiResponse {
  text: string;
  resources?: any[];
  grounding?: any[];
  type: 'text' | 'image' | 'file';
  isErrorDetection?: boolean;
}

/**
 * Zay AI: Diagnostic Academic Controller
 * Model: gemini-3-flash-preview (Fast, High-Availability)
 */
export const aiService = {
  askZay: async (userQuery: string, requestingUser: User | null, history: ChatMessage[] = [], imageUrl?: string): Promise<AiResponse> => {
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
      return { 
        text: "System Alert: API Key missing. Please check environment variables.", 
        type: 'text' 
      };
    }

    try {
      // Re-initialize for every call to ensure the latest environment key is used
      const ai = new GoogleGenAI({ apiKey: apiKey });
      const modelName = 'gemini-3-flash-preview';

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

      // 3. System Instruction optimized for Diagnostic Error Detection
      const systemInstruction = `
        You are Zay, the High-Speed Diagnostic AI for the 1BacSM Hub.
        Engine: Google Gemini 3 Flash.

        **PRIMARY ROLE: ERROR DETECTOR**
        - If the student provides a calculation or a logic step, analyze it for errors.
        - If an error is found, start your response with: "[DIAGNOSTIC ALERT]: Error Detected in [Concept]"
        - Explain WHY it is wrong and provide the correct scientific path.

        **DOMAIN: 1Bac Science Math (Physics, Math, SVT)**
        - Use professional symbols: (Δ, ∑, ∫, √, ∞, ≠, ≤, ≥, ±, α, β, θ, λ, π, Ω).
        - Use Google Search for validating complex formulas or recent scientific data.

        **HUB INTEGRATION**:
        - If a lesson matches the user query, append resources using: ATTACH_FILES::[{"name": "...", "url": "...", "type": "..."}]
        
        **CURRENT CLASSROOM INDEX**:
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

      // 5. Generate Content with Search Grounding
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ parts }],
        config: {
          systemInstruction,
          temperature: 0.1, // Low temperature for higher accuracy in error detection
          tools: [{ googleSearch: {} }]
        },
      });

      let text = response.text || "";
      let resources: any[] = [];
      let grounding: any[] = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const isErrorDetection = text.includes("[DIAGNOSTIC ALERT]");

      // 6. Injection of Hub Resources
      if (matchedLesson && !text.includes("ATTACH_FILES::")) {
        const fileLinks = (matchedLesson.attachments || []).map(a => ({ name: a.name, url: a.url, type: a.type }));
        text += `\n\nATTACH_FILES::${JSON.stringify(fileLinks)}`;
      }

      // 7. Final Response Parsing
      if (text.includes("ATTACH_FILES::")) {
        const splitParts = text.split("ATTACH_FILES::");
        text = splitParts[0].trim();
        try {
          resources = JSON.parse(splitParts[splitParts.length - 1].trim());
        } catch (e) {}
      }

      return { text, resources, grounding, type: 'text', isErrorDetection };

    } catch (error: any) {
      console.error("[Zay Flash Error]:", error);
      return { 
        text: `The AI core is recharging. Please try again in a few seconds.`, 
        type: 'text' 
      };
    }
  }
};
