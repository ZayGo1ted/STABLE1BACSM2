
import { GoogleGenAI } from "@google/genai";
import { User, ChatMessage, Lesson } from '../types';
import { supabaseService } from './supabaseService';
import { ZAY_USER_ID } from '../constants';

const AI_PREFIX = ":::AI_RESPONSE:::";

interface AiResponse {
  text: string;
  resources?: any[];
  grounding?: any[];
  type: 'text' | 'image' | 'file';
  isErrorDetection?: boolean;
}

/**
 * Zay AI: Smart Diagnostic Academic Layer
 * Engine: gemini-flash-lite-latest
 * Features: Multi-turn memory, Strict file retrieval, 1BacSM logic checking.
 */
export const aiService = {
  askZay: async (userQuery: string, requestingUser: User | null, history: ChatMessage[] = [], imageUrl?: string): Promise<AiResponse> => {
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
      return { 
        text: "System Alert: API Key missing. AI Core is offline.", 
        type: 'text' 
      };
    }

    try {
      const ai = new GoogleGenAI({ apiKey: apiKey });
      const modelName = 'gemini-2.5-flash';

      // 1. Fetch current library state for grounding
      const freshState = await supabaseService.fetchFullState();
      const allLessons = freshState.lessons || [];
      const subjects = freshState.subjects || [];

      // 2. Format Classroom Library for AI Context
      const classroomLibrary = allLessons.map(l => ({
        title: l.title,
        subject: subjects.find(s => s.id === l.subjectId)?.name.en,
        description: l.description,
        type: l.type,
        attachments: l.attachments || [] // These are the real URLs from the DB
      }));

      // 3. Construct Conversational Memory
      // Limit history to last 15 messages to stay within context limits
      const contextHistory = history.slice(-15).map(msg => {
        const isAI = msg.userId === ZAY_USER_ID || msg.content.startsWith(AI_PREFIX);
        return {
          role: isAI ? 'model' : 'user',
          parts: [{ text: msg.content.replace(AI_PREFIX, '') }]
        };
      });

      // 4. System Instruction: The "Brain" of Zay
      const systemInstruction = `
        You are Zay, a highly intelligent and helpful academic assistant for a 1Bac Science Math (SM) classroom.
        
        **CORE COMPETENCIES**:
        - **MEMORY**: You remember previous parts of the conversation. If a student asks "tell me more about that", refer to the history.
        - **DIAGNOSTIC ERROR DETECTION**: If a student provides math/physics steps, find errors. 
          Use prefix: "[DIAGNOSTIC ALERT]: Error in [Concept]" for any logic/calculation flaws.
        - **REAL FILE DELIVERY**: You have a "HUB_LIBRARY" below. 
          If a user asks for a lesson, summary, or files, find the matching item in the library.
          You MUST NOT make up file names or URLs. 
          If you find a match, append the actual attachments using: [ATTACH_RESOURCES: JSON_ARRAY_OF_ATTACHMENTS]
          Example: [ATTACH_RESOURCES: [{"name": "Lesson.pdf", "url": "https://...", "type": "file"}]]

        **CURRICULUM (1BacSM)**:
        - Math (Logic, Sets, Functions, Trig)
        - Physics (Mechanics, Electricity, Chemistry)
        - SVT (Geology)
        
        **HUB_LIBRARY (THE ONLY SOURCE FOR REAL FILES)**:
        ${JSON.stringify(classroomLibrary, null, 1)}

        **USER INFO**:
        Student Name: ${requestingUser?.name || 'Student'}
      `;

      // 5. Multi-modal Construction for current prompt
      const currentParts: any[] = [{ text: userQuery }];
      if (imageUrl) {
        try {
          const res = await fetch(imageUrl);
          const blob = await res.blob();
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.readAsDataURL(blob);
          });
          // Fix: Always use the correct variable name 'currentParts' to append multimodal parts
          currentParts.push({ inlineData: { data: base64, mimeType: blob.type } });
        } catch (e) { console.warn("Vision input failed."); }
      }

      // 6. Execute Request with Memory
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          ...contextHistory,
          { role: 'user', parts: currentParts }
        ],
        config: {
          systemInstruction,
          temperature: 0.1, // Low temp for facts/logic
          tools: [{ googleSearch: {} }]
        },
      });

      let text = response.text || "";
      let resources: any[] = [];
      let grounding: any[] = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const isErrorDetection = text.includes("[DIAGNOSTIC ALERT]");

      // 7. Resource Extraction logic
      const resourceTag = "[ATTACH_RESOURCES:";
      if (text.includes(resourceTag)) {
        const parts = text.split(resourceTag);
        text = parts[0].trim();
        const jsonContent = parts[1].split(']')[0].trim();
        try {
          resources = JSON.parse(jsonContent);
        } catch (e) {
          console.error("Resource parsing failure:", e);
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
      console.error("[Zay Lite Error]:", error);
      return { 
        text: "My neural link is flickering. One moment...", 
        type: 'text' 
      };
    }
  }
};
