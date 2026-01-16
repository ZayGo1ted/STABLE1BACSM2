
import { GoogleGenAI } from "@google/genai";
import { User, ChatMessage, Lesson, AcademicItem } from '../types';
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
 * Zay AI: Advanced Diagnostic & Resource Layer
 * Engine: gemini-2.5-flash
 */
export const aiService = {
  askZay: async (userQuery: string, requestingUser: User | null, history: ChatMessage[] = [], imageUrl?: string): Promise<AiResponse> => {
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
      return { 
        text: "System Alert: API Key missing. Please check configuration.", 
        type: 'text' 
      };
    }

    try {
      const ai = new GoogleGenAI({ apiKey: apiKey });
      const modelName = 'gemini-3-flash-preview';

      // 1. Fetch Comprehensive State
      const freshState = await supabaseService.fetchFullState();
      const allLessons = freshState.lessons || [];
      const subjects = freshState.subjects || [];
      const academicItems = freshState.items || []; // This includes homework/exams

      // 2. Build Intelligent Context
      const hubLibrary = allLessons.map(l => ({
        lesson_id: l.id,
        title: l.title,
        subject: subjects.find(s => s.id === l.subjectId)?.name.en,
        summary: l.description,
        attachments: l.attachments || [] // Real DB links
      }));

      const activeHomework = academicItems.map(i => ({
        title: i.title,
        type: i.type,
        due: i.date,
        subject: subjects.find(s => s.id === i.subjectId)?.name.en,
        lesson_link: i.title // Students often refer to homework by lesson name
      }));

      // 3. Process History (Memory)
      const contextHistory = history.slice(-15).map(msg => {
        const isAI = msg.userId === ZAY_USER_ID || msg.content.startsWith(AI_PREFIX);
        return {
          role: isAI ? 'model' : 'user',
          parts: [{ text: msg.content.replace(AI_PREFIX, '') }]
        };
      });

      // 4. Advanced System Instructions
      const systemInstruction = `
        You are Zay, the Smart Diagnostic Assistant for the 1BacSM Hub.
        Engine: Gemini 2.5 Flash.

        **BEHAVIORAL RULES**:
        1. **MEMORY**: Always refer back to history if the user says "it", "that", or "him".
        2. **FILE DELIVERY**: If a user asks for a lesson, you MUST find the match in HUB_LIBRARY and send the REAL links.
           USE TAG: [ATTACH_RESOURCES: JSON_ARRAY]
           NEVER invent links. If it's in the DB, send the actual attachment objects.
        3. **NO-HOMEWORK LOGIC**: 
           If a student asks for "exercises" or "homework" for a specific lesson:
           - Check HUB_LIBRARY (attachments) and ACTIVE_HOMEWORK list.
           - If there are NO assigned files or homework items for that specific lesson, you MUST say:
             "I found 0 assigned homeworks for [Lesson Name] in the Hub. Would you like me to generate an AI-powered exercise series based on the resources available in the database for this lesson?"
        4. **DIAGNOSTICS**: If a student shows math/physics work, check for errors.
           Prefix errors with: "[DIAGNOSTIC ALERT]: Error in [Concept]"

        **HUB_LIBRARY**:
        ${JSON.stringify(hubLibrary, null, 1)}

        **ACTIVE_HOMEWORK (Official Tasks)**:
        ${JSON.stringify(activeHomework, null, 1)}

        **USER CONTEXT**:
        Current Student: ${requestingUser?.name || 'Student'}
      `;

      // 5. Build Request Parts
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
          currentParts.push({ inlineData: { data: base64, mimeType: blob.type } });
        } catch (e) { console.warn("Image capture failed."); }
      }

      // 6. API Call
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          ...contextHistory,
          { role: 'user', parts: currentParts }
        ],
        config: {
          systemInstruction,
          temperature: 0.15,
          tools: [{ googleSearch: {} }]
        },
      });

      let text = response.text || "";
      let resources: any[] = [];
      let grounding: any[] = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const isErrorDetection = text.includes("[DIAGNOSTIC ALERT]");

      // 7. Parse Resources
      const tag = "[ATTACH_RESOURCES:";
      if (text.includes(tag)) {
        const parts = text.split(tag);
        text = parts[0].trim();
        const jsonStr = parts[1].split(']')[0].trim();
        try {
          resources = JSON.parse(jsonStr);
        } catch (e) { console.error("JSON Parse Error in AI response", e); }
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
        text: "My neural processor is resetting. Please repeat that query.", 
        type: 'text' 
      };
    }
  }
};
