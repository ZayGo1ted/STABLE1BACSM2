
import OpenAI from 'openai';
import { User, ChatMessage } from '../types';
import { supabaseService } from './supabaseService';

interface AiResponse {
  text: string;
  resources?: any[];
  grounding?: any[];
  type: 'text' | 'image' | 'file';
}

/**
 * Zay AI: High-Performance Academic Controller
 * Powered by NVIDIA NIM (meta/llama-3.2-90b-vision-instruct)
 */
export const aiService = {
  askZay: async (userQuery: string, requestingUser: User | null, history: ChatMessage[] = [], imageUrl?: string): Promise<AiResponse> => {
    // API_KEY must be in environment
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
      console.error("[Zay] ERROR: No API Key found. Ensure 'API_KEY' environment variable is set.");
      return { 
        text: "Configuration Error: The AI core is offline (Missing Key). Contact the developer.", 
        type: 'text' 
      };
    }

    try {
      // NVIDIA NIM requires a specific base URL for OpenAI-compatible SDK usage
      const client = new OpenAI({
        apiKey: apiKey,
        baseURL: "https://integrate.api.nvidia.com/v1",
        dangerouslyAllowBrowser: true 
      });

      const MODEL_ID = "meta/llama-3.2-90b-vision-instruct";

      // 1. Context Retrieval from Hub Library
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

      // 3. Cognitive Directive (System Prompt)
      const systemPrompt = `
        You are Zay, the Elite AI Academic Hub Controller for 1BacSM. 
        Engine: Llama-3.2-90b-Vision (NVIDIA NIM).

        **DIRECTIVES**:
        1. **HUB DEPENDENCY**: Use matched lesson data to answer queries about summaries or exercises.
        2. **MATH NOTATION**: Use Unicode (Δ, ∑, ∫, √, ∞, ≠, ≤, ≥, ±, α, β, θ, λ, π, Ω). Bold vectors: **AB**.
        3. **FILE ATTACHMENT**: If a lesson matches, append files using: ATTACH_FILES::[{"name": "...", "url": "...", "type": "..."}]
      `;

      // 4. Multi-Modal String Construction (Specific to NVIDIA Vision docs)
      // Documentation says: "When content is a string, image can be passed with <img> tags"
      let finalPrompt = userQuery;

      // Add user-uploaded image
      if (imageUrl) {
        finalPrompt += `\n<img src="${imageUrl}" />`;
      }

      // Add auto-retrieved lesson context images
      if (matchedLesson) {
        const images = (matchedLesson.attachments || [])
          .filter(a => a.type === 'image')
          .slice(0, 3);
        
        images.forEach(img => {
          finalPrompt += `\n<img src="${img.url}" />`;
        });
        
        finalPrompt = `[CONTEXT: Materials for '${matchedLesson.title}' loaded]\n${finalPrompt}`;
      }

      // 5. History Mapping (Last 10 messages for deep context)
      const conversationHistory = history
        .filter(m => !m.mediaUrl || m.mediaUrl.length < 500)
        .slice(-10)
        .map(m => {
          const isAi = m.content.startsWith(":::AI_RESPONSE:::");
          return {
            role: (isAi ? "assistant" : "user") as "assistant" | "user",
            content: m.content.replace(":::AI_RESPONSE:::", "")
          };
        });

      // 6. Request with Advanced Error Monitoring
      console.log(`[Zay] Transmitting to NVIDIA NIM...`);
      
      const response = await client.chat.completions.create({
        model: MODEL_ID,
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationHistory,
          { role: "user", content: finalPrompt }
        ],
        temperature: 0.1,
        max_tokens: 2048,
        top_p: 1
      });

      if (!response.choices?.length) {
        throw new Error("NVIDIA NIM returned 200 OK but choices array is empty.");
      }

      let text = (response.choices[0].message.content || "").trim();
      let resources: any[] = [];

      // 7. Auto-File Injection
      if (matchedLesson && !text.includes("ATTACH_FILES::")) {
        const fileLinks = (matchedLesson.attachments || []).map(a => ({ name: a.name, url: a.url, type: a.type }));
        text += `\n\nATTACH_FILES::${JSON.stringify(fileLinks)}`;
      }

      // 8. Command Parsing
      if (text.includes("ATTACH_FILES::")) {
        const parts = text.split("ATTACH_FILES::");
        text = parts[0].trim();
        try {
          resources = JSON.parse(parts[parts.length - 1].trim());
        } catch (e) {
          console.warn("[Zay] Attachment parse failed.");
        }
      }

      return { text, resources, type: 'text' };

    } catch (error: any) {
      // CRITICAL: Reworked Error catching for better documentation compliance
      console.error("[Zay Diagnostic] Full Error Object:", error);
      
      const status = error.status || error.response?.status;
      const body = error.response?.data || error.message;

      console.error(`[Zay Diagnostic] Status: ${status} | Body:`, body);

      let userMsg = "The Hub Controller (Llama-Vision) encountered an error.";

      if (status === 422) {
        userMsg = "AI Error (422): Input format rejected. Please check message structure or safety filters.";
      } else if (status === 401) {
        userMsg = "AI Auth Error (401): Invalid or Expired NVIDIA API Key.";
      } else if (status === 429) {
        userMsg = "AI Overload (429): Quota exceeded on the NVIDIA server.";
      } else if (error.message) {
        userMsg = `AI Error: ${error.message}`;
      }

      return { text: userMsg, type: 'text' };
    }
  }
};
