// services/aiService.ts
// import { GoogleGenAI } from "@google/genai"; // <-- REMOVE THIS IMPORT
import { User, ChatMessage, Lesson, AcademicItem } from '../types';
import { supabaseService } from './supabaseService';
import { ZAY_USER_ID } from '../constants';

const AI_PREFIX = ":::AI_RESPONSE:::";

interface AiResponse {
  text: string;
  resources?: any[];
  grounding?: any[]; // May be less detailed than Google's
  type: 'text' | 'image' | 'file';
  isErrorDetection?: boolean;
}

/**
 * Zay AI: Advanced Diagnostic & Resource Layer
 * Engine: NVIDIA NIM (e.g., meta/llama3-70b-instruct)
 *
 * *** REQUIREMENTS FOR FULL FUNCTIONALITY ***
 * 1. NVIDIA API Key stored in environment variable `NVIDIA_API_KEY`.
 * 2. Correct `NVIDIA_NIM_ENDPOINT` defined below.
 * 3. Network access from your deployment environment (Vercel) to the NVIDIA endpoint.
 * 4. (Optional but Recommended) Move this logic to a Vercel Serverless Function for security.
 */
export const aiService = {
  askZay: async (userQuery: string, requestingUser: User | null, history: ChatMessage[] = [], imageUrl?: string): Promise<AiResponse> => {
    
    // *** CHANGE 1: Use NVIDIA_API_KEY ***
    const apiKey = process.env.NVIDIA_API_KEY; 

    if (!apiKey) {
      return {
        text: "Configuration Error: NVIDIA API Key (NVIDIA_API_KEY) is missing.",
        type: 'text'
      };
    }

    try {
      // 1. Fetch State (Unchanged)
      const freshState = await supabaseService.fetchFullState();
      const allLessons = freshState.lessons || [];
      const subjects = freshState.subjects || [];
      const academicItems = freshState.items || [];

      // 2. Build Context (Unchanged)
      const hubLibrary = allLessons.map(l => ({
        lesson_id: l.id,
        title: l.title,
        subject: subjects.find(s => s.id === l.subjectId)?.name.en,
        summary: l.description,
        attachments: l.attachments || []
      }));

      const activeHomework = academicItems.map(i => ({
        title: i.title,
        type: i.type,
        due: i.date,
        subject: subjects.find(s => s.id === i.subjectId)?.name.en,
        lesson_link: i.title
      }));

      // 3. Process History (Unchanged)
      const contextHistory = history.slice(-15).map(msg => {
        const isAI = msg.userId === ZAY_USER_ID || msg.content.startsWith(AI_PREFIX);
        return {
          role: isAI ? 'assistant' : 'user',
          content: msg.content.replace(AI_PREFIX, '')
        };
      });

      // 4. System Instruction (Unchanged)
      const systemInstruction = `
You are Zay, the Smart Diagnostic Assistant for the 1BacSM Hub.
Engine: NVIDIA NIM (e.g., meta/llama3-70b-instruct).

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

      // 5. Prepare Messages (Standard format for chat models)
      const messagesForModel = [
        { role: "system", content: systemInstruction },
        ...contextHistory,
        { role: "user", content: userQuery }
      ];

      // *** CHANGE 2: NVIDIA NIM API CALL ***
      // IMPORTANT: UPDATE THIS ENDPOINT WITH THE CORRECT ONE FROM NVIDIA DOCUMENTATION
      // Example placeholder for a hosted NVIDIA NIM service endpoint:
      const NVIDIA_NIM_ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions"; // <--- YOU MUST CHANGE THIS

      const requestBody = {
        model: "meta/llama3-70b-instruct", // <--- UPDATE MODEL NAME IF DIFFERENT
        messages: messagesForModel,
        temperature: 0.15,
        top_p: 1,
        max_tokens: 1024,
        stream: false
      };

      // Make the API call using fetch
      const response = await fetch(NVIDIA_NIM_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`, // Standard Bearer Token Auth
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`NVIDIA NIM API Error (${response.status}):`, errorText);
        throw new Error(`NVIDIA API request failed with status ${response.status}`);
      }

      const data = await response.json();

      // 6. Process Response (Similar structure expected)
      let text = data.choices?.[0]?.message?.content?.trim() || "";
      let resources: any[] = [];
      let grounding: any[] = []; // Simplified
      const isErrorDetection = text.includes("[DIAGNOSTIC ALERT]");

      // 7. Parse Resources (Unchanged logic)
      const tag = "[ATTACH_RESOURCES:";
      if (text.includes(tag)) {
        const parts = text.split(tag);
        text = parts[0].trim();
        const jsonStr = parts[1].split(']')[0].trim();
        try {
          resources = JSON.parse(jsonStr);
        } catch (e) {
          console.error("JSON Parse Error in AI response", e);
          text += "\n\n[Error parsing attached resources.]";
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
      console.error("[Zay NIM Service Error]:", error);
      return {
        text: "My neural processor (NVIDIA NIM) is temporarily offline. Please try your request again shortly.",
        type: 'text'
      };
    }
  }
};
