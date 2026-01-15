
import { GoogleGenAI } from "@google/genai";
import { User, ChatMessage, Lesson } from '../types';
import { supabaseService } from './supabaseService';

interface AiResponse {
  text: string;
  resources?: any[];
  grounding?: any[];
  type: 'text' | 'image' | 'file';
  isErrorDetection?: boolean;
}

/**
 * Zay AI: Advanced Diagnostic Academic Layer
 * Engine: Gemini 2.5 Flash (Latest High-Reasoning & Context-Aware)
 */
export const aiService = {
  askZay: async (userQuery: string, requestingUser: User | null, history: ChatMessage[] = [], imageUrl?: string): Promise<AiResponse> => {
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
      return { 
        text: "System Alert: API Key missing. AI Core is currently detached.", 
        type: 'text' 
      };
    }

    try {
      const ai = new GoogleGenAI({ apiKey: apiKey });
      const modelName = 'gemini-2.5-flash-lite';

      // 1. Deep Context Fetching
      // We pull EVERYTHING so the AI can "read" the whole classroom state
      const freshState = await supabaseService.fetchFullState();
      const allLessons = freshState.lessons || [];
      const subjects = freshState.subjects || [];

      // 2. Comprehensive Classroom Index
      // Map lessons to a format the AI can perfectly parse
      const classroomContext = allLessons.map(l => ({
        lesson_id: l.id,
        title: l.title,
        subject: subjects.find(s => s.id === l.subjectId)?.name.en,
        type: l.type,
        summary: l.description,
        files: l.attachments || [] // Actual download links
      }));

      // 3. High-Intelligence System Instruction
      const systemInstruction = `
        You are Zay, the Elite Diagnostic AI for the 1BacSM Hub.
        Engine: Google Gemini 2.5 Flash.

        **MISSION**:
        1. **ERROR DETECTOR**: Actively hunt for mistakes in student math/physics logic. 
           - If you find an error, use: "[DIAGNOSTIC ALERT]: Error in [Concept Name]"
        2. **FILE INTEGRITY**: You have access to the actual Hub Library (Context below).
           - When a user asks about a lesson, YOU MUST provide the actual file links from that lesson.
           - DO NOT invent file names. Copy the URL and Name EXACTLY from the context.
           - APPEND the files at the end of your message using this strict format: [ATTACH_RESOURCES: [{"name": "...", "url": "...", "type": "..."}]]

        **DOMAIN KNOWLEDGE (1Bac Science Math)**:
        - Physics: Mechanics, Electricity, Redox, Optics.
        - Math: Logic, Sets, Functions, Trig, Sequences.
        - Use symbols: Δ, ∑, ∫, √, ∞, ≠, ≤, ≥, ±, α, β, θ, λ, π, Ω.

        **THE ACTUAL HUB LIBRARY (READ EVERYTHING BELOW)**:
        ${JSON.stringify(classroomContext, null, 1)}
      `;

      // 4. Multi-modal Construction
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

      // 5. Generate Response
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ parts }],
        config: {
          systemInstruction,
          temperature: 0.2, // Low temperature for high precision/consistency
          tools: [{ googleSearch: {} }]
        },
      });

      let text = response.text || "";
      let resources: any[] = [];
      let grounding: any[] = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const isErrorDetection = text.includes("[DIAGNOSTIC ALERT]");

      // 6. Extraction of the Resources JSON
      const resourceTag = "[ATTACH_RESOURCES:";
      if (text.includes(resourceTag)) {
        const parts = text.split(resourceTag);
        text = parts[0].trim();
        const jsonStr = parts[1].split(']')[0].trim();
        try {
          resources = JSON.parse(jsonStr);
        } catch (e) {
          console.error("Resource parsing failed:", e);
        }
      }

      return { 
        text, 
        resources, 
        grounding, 
        type: (resources.length > 0 || isErrorDetection) ? 'file' : 'text', 
        isErrorDetection 
      };

    } catch (error: any) {
      console.error("[Zay 2.5 Error]:", error);
      return { 
        text: "Zay's core is under high load. Please try again in a few seconds.", 
        type: 'text' 
      };
    }
  }
};
