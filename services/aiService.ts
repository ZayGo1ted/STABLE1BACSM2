// services/aiService.ts
import OpenAI from 'openai'; // <-- ADD THIS IMPORT
// Remove the old Google GenAI import
// import { GoogleGenAI } from "@google/genai";
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
 * Engine: NVIDIA NIM (using OpenAI SDK)
 *
 * *** REQUIREMENTS FOR FULL FUNCTIONALITY ***
 * 1. NVIDIA API Key stored in environment variable `NVIDIA_API_KEY`.
 * 2. Network access from your deployment environment (Vercel) to https://integrate.api.nvidia.com
 * 3. (Optional but Recommended) Move this logic to a Vercel Serverless Function for security.
 */
export const aiService = {
  askZay: async (userQuery: string, requestingUser: User | null, history: ChatMessage[] = [], imageUrl?: string): Promise<AiResponse> => {
    
    // *** CHANGE 1: Use NVIDIA_API_KEY ***
    const apiKey = process.env.NVIDIA_API_KEY; 

    if (!apiKey) {
      console.error("NVIDIA_API_KEY is not configured.");
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
        // Convert to OpenAI message format
        return {
          role: isAI ? 'assistant' : 'user' as const, // 'as const' helps TS infer literal types
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

      // 5. Prepare Messages for OpenAI SDK
      // OpenAI expects an array like [{role: "system", content: "..."}, {role: "user", content: "..."}, ...]
      const messagesForModel: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: systemInstruction },
        ...contextHistory,
        { role: "user", content: userQuery }
      ];

      // *** CHANGE 2: Initialize OpenAI Client for NVIDIA NIM ***
      const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: 'https://integrate.api.nvidia.com/v1', // Standard NVIDIA NIM v1 endpoint
      });

      // *** CHANGE 3: Make the Completion Request using OpenAI SDK ***
      const completion = await openai.chat.completions.create({
        model: "meta/llama3-70b-instruct", // Specify the model
        messages: messagesForModel,
        temperature: 0.15,
        top_p: 1,
        max_tokens: 1024,
        stream: false, // Set to true if you want to handle streaming (more complex)
      });

      // 6. Process the Response (OpenAI format)
      let text = completion.choices?.[0]?.message?.content?.trim() || "";
      
      if (!text) {
         console.warn("Received empty response content from NVIDIA NIM.");
         return {
            text: "The AI model returned an empty response. Please try rephrasing your question.",
            type: 'text'
         };
      }

      // Initialize response parts (same as before)
      let resources: any[] = [];
      let grounding: any[] = [];
      const isErrorDetection = text.includes("[DIAGNOSTIC ALERT]");

      // 7. Parse Resources (Same parsing logic as before)
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

      // 8. Return Structured Response
      return {
        text,
        resources,
        grounding,
        type: (resources.length > 0 || isErrorDetection) ? 'file' : 'text',
        isErrorDetection
      };

    } catch (error: any) {
      console.error("[Zay NIM Service Error via OpenAI SDK]:", error);
      
      // Provide a more user-friendly and informative fallback message
      let userMessage = "My neural processor (NVIDIA NIM) is temporarily offline. Please try your request again shortly.";
      
      // Check for common error types (error might be an OpenAI APIError object)
      if (error instanceof OpenAI.APIError) {
        console.error("OpenAI API Error Details:", error.status, error.message, error.type, error.code, error.param);
        if (error.status === 401) {
          userMessage = "Authentication with the AI service failed. (Invalid API Key)";
        } else if (error.status === 404) {
          userMessage = "Requested AI model or resource was not found. Please check the model name or endpoint.";
        } else if (error.status === 429) {
          userMessage = "Rate limit exceeded for the AI service. Please wait before trying again.";
        } else if (error.status >= 500) {
          userMessage = "The AI service is currently experiencing technical difficulties. Please try again later.";
        } else {
          userMessage = `An unexpected error occurred (${error.status}). Details: ${error.message.substring(0, 100)}...`;
        }
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
         userMessage = "Could not connect to the AI service endpoint. Please check network connectivity.";
      }

      return {
        text: userMessage,
        type: 'text'
      };
    }
  }
};
