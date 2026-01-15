
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
 * Zay AI: High-Performance Gemini Controller
 * model: gemini-3-flash-preview
 */
export const aiService = {
  askZay: async (userQuery: string, requestingUser: User | null, history: ChatMessage[] = [], imageUrl?: string): Promise<AiResponse> => {
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
      return { 
        text: "System Alert: The Gemini AI Core is offline (Missing API_KEY). Please configure your environment.", 
        type: 'text' 
      };
    }

    try {
      // Re-initialize for every call to ensure the latest environment key is used
      const ai = new GoogleGenAI({ apiKey: apiKey });
      const modelName = 'gemini-2.5-flash';

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

      // 3. System Instruction
      const systemInstruction = `
        You are Zay, the Elite AI Controller for the 1BacSM Academic Hub.
        Engine: Google Gemini 3 Flash.

        **MISSION**: You act as a perfect mirror of the Hub's Library.
        **RULES**:
        1. **HUB DEPENDENCY**: Use the provided library context to answer queries about lessons, summaries, or exercises.
        2. **MATH NOTATION**: Use Unicode (Δ, ∑, ∫, √, ∞, ≠, ≤, ≥, ±, α, β, θ, λ, π, Ω). Bold vectors: **AB**.
        3. **FILE ATTACHMENT**: If a lesson matches, you MUST append its files using: ATTACH_FILES::[{"name": "...", "url": "...", "type": "..."}]
        4. **GROUNDING**: Use Google Search for real-time information or deep academic sources outside the hub.

        **HUB LIBRARY INDEX**:
        ${JSON.stringify(lessons.map(l => ({ title: l.title, subject: subjects.find(s => s.id === l.subjectId)?.name.en })), null, 1)}
      `;

      // 4. Build Multi-modal Content
      const parts: any[] = [{ text: userQuery }];

      // User Uploaded Image (Multimodal Support)
      if (imageUrl) {
        try {
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.readAsDataURL(blob);
          });
          parts.push({
            inlineData: {
              data: base64,
              mimeType: blob.type
            }
          });
        } catch (e) {
          console.warn("[Zay] Image conversion failed.");
        }
      }

      // 5. Execute Gemini Content Generation
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ parts }],
        config: {
          systemInstruction,
          temperature: 0.2,
          tools: [{ googleSearch: {} }]
        },
      });

      let text = response.text || "";
      let resources: any[] = [];
      let grounding: any[] = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

      // 6. Auto-File Injection based on matched hub data
      if (matchedLesson && !text.includes("ATTACH_FILES::")) {
        const fileLinks = (matchedLesson.attachments || []).map(a => ({ name: a.name, url: a.url, type: a.type }));
        text += `\n\nATTACH_FILES::${JSON.stringify(fileLinks)}`;
      }

      // 7. Command Parsing for UI Attachment Rendering
      if (text.includes("ATTACH_FILES::")) {
        const splitParts = text.split("ATTACH_FILES::");
        text = splitParts[0].trim();
        try {
          resources = JSON.parse(splitParts[splitParts.length - 1].trim());
        } catch (e) {}
      }

      return { text, resources, grounding, type: 'text' };

    } catch (error: any) {
      console.error("[Zay Gemini Diagnostic]:", error);
      return { 
        text: `AI Intelligence Layer Error: ${error.message || "Connection failed to Gemini."}`, 
        type: 'text' 
      };
    }
  }
};
