
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
 * AI Service: Advanced NVIDIA NIM Controller
 * Model: meta/llama-3.2-90b-vision-instruct
 */
export const aiService = {
  askZay: async (userQuery: string, requestingUser: User | null, history: ChatMessage[] = [], imageUrl?: string): Promise<AiResponse> => {
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
      console.error("[Zay Controller] CRITICAL: API_KEY is missing. Check your environment variables.");
      return { 
        text: "System Alert: My AI Core (NVIDIA) is not authenticated. Please ensure the 'API_KEY' is correctly set in the Hub environment.", 
        type: 'text' 
      };
    }

    try {
      // 1. Initialize OpenAI SDK with NVIDIA Base URL
      const client = new OpenAI({
        apiKey: apiKey,
        baseURL: "https://integrate.api.nvidia.com/v1",
        dangerouslyAllowBrowser: true 
      });

      const MODEL_ID = "meta/llama-3.2-90b-vision-instruct";

      // 2. Intelligence: Hub Context Sync
      // We pull the entire library index so Zay knows what's available
      const freshState = await supabaseService.fetchFullState();
      const lessons = freshState.lessons || [];
      const subjects = freshState.subjects || [];

      // 3. Dynamic Context Matching
      const normalizedQuery = userQuery.toLowerCase();
      const matchedLesson = lessons.find(l => {
        const titleMatch = normalizedQuery.includes(l.title.toLowerCase());
        const keywordMatch = l.keywords?.some(k => normalizedQuery.includes(k.toLowerCase()));
        return titleMatch || keywordMatch;
      });

      // 4. Advanced Cognitive System Prompt
      const systemPrompt = `
        You are Zay, the Elite AI Controller for the 1BacSM Academic Hub.
        Engine: Llama-3.2-90b-Vision.

        **MISSION**: You act as a perfect mirror of the Hub's Library.
        **RULES**:
        1. **90% CONTENT DEPENDENCY**: When generating a 'Résumé' or 'Série d'exercices', you MUST use the description and visual content of the provided Hub materials.
        2. **MATH NOTATION**: Use Unicode (Δ, ∑, ∫, √, ∞, ≠, ≤, ≥, ±, α, β, θ, λ, π, Ω). Bold vectors: **AB**. Use LaTeX style only for complex blocks.
        3. **FILE ATTACHMENT**: If you find a matching lesson, you MUST append its files using the command: ATTACH_FILES::[{"name": "...", "url": "...", "type": "..."}]
        4. **VISION**: You can see files. If images are provided in the content block, analyze them for specific mathematical formulas and notation.

        **HUB LIBRARY INDEX**:
        ${JSON.stringify(lessons.map(l => ({ title: l.title, subject: subjects.find(s => s.id === l.subjectId)?.name.en })), null, 1)}
      `;

      // 5. Construct Multi-modal User Message
      const userContentParts: any[] = [{ type: "text", text: userQuery }];

      // Case A: Manual Image upload from chat
      if (imageUrl) {
        userContentParts.push({ 
          type: "image_url", 
          image_url: { url: imageUrl, detail: "high" } 
        });
      }

      // Case B: Auto-Vision Injection (If Zay recognizes a lesson, he looks at it)
      if (matchedLesson) {
        const hubImages = (matchedLesson.attachments || [])
          .filter(a => a.type === 'image')
          .slice(0, 3);
          
        hubImages.forEach(img => {
          userContentParts.push({ 
            type: "image_url", 
            image_url: { url: img.url, detail: "high" } 
          });
        });

        // Add context prefix
        userContentParts.unshift({ 
          type: "text", 
          text: `[HUB_LIBRARY_MATCH]: I have retrieved the materials for '${matchedLesson.title}'. Analyzing visuals...` 
        });
      }

      // 6. Map Conversation History
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

      // 7. Execute NVIDIA NIM Request
      console.log(`[Zay Controller] Sending request to NIM (${MODEL_ID})...`);
      
      const response = await client.chat.completions.create({
        model: MODEL_ID,
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationHistory,
          { role: "user", content: userContentParts }
        ],
        temperature: 0.1, // Precision-focused for math/science
        max_tokens: 2048,
        top_p: 1
      });

      if (!response.choices || response.choices.length === 0) {
        throw new Error("Empty response choice from NVIDIA.");
      }

      let text = (response.choices[0].message.content || "").trim();
      let resources: any[] = [];

      // 8. Auto-Attach Command if Zay matched a lesson but forgot to command it
      if (matchedLesson && !text.includes("ATTACH_FILES::")) {
        const fileLinks = (matchedLesson.attachments || []).map(a => ({ name: a.name, url: a.url, type: a.type }));
        text += `\n\nATTACH_FILES::${JSON.stringify(fileLinks)}`;
      }

      // 9. Command Parsing for UI Rendering
      if (text.includes("ATTACH_FILES::")) {
        const parts = text.split("ATTACH_FILES::");
        text = parts[0].trim();
        try {
          const jsonStr = parts[parts.length - 1].trim();
          resources = JSON.parse(jsonStr);
        } catch (e) {
          console.warn("[Zay Controller] Failed to parse resource JSON.");
        }
      }

      return { text, resources, type: 'text' };

    } catch (error: any) {
      // Enhanced Error Logging for Debugging
      console.error("[Zay Controller] API Failure Details:", {
        message: error.message,
        status: error.status,
        code: error.code,
        body: error.response?.data
      });

      let userFriendlyMsg = "The Hub Controller (Llama-Vision) encountered an error.";
      
      if (error.status === 401) userFriendlyMsg = "AI Authentication Error: Check your NVIDIA API Key.";
      else if (error.status === 404) userFriendlyMsg = "AI Routing Error: Model not found at NVIDIA endpoint.";
      else if (error.status === 429) userFriendlyMsg = "AI Overload: Too many requests. Try again in 60 seconds.";
      else if (error.message) userFriendlyMsg = `AI Engine Error: ${error.message}`;

      return { 
        text: userFriendlyMsg, 
        type: 'text' 
      };
    }
  }
};
