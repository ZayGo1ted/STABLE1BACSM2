
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
 * AI Service: NVIDIA NIM Implementation
 * Model: meta/llama-3.2-90b-vision-instruct
 * Protocol: OpenAI Compatible
 */
export const aiService = {
  askZay: async (userQuery: string, requestingUser: User | null, history: ChatMessage[] = [], imageUrl?: string): Promise<AiResponse> => {
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
      console.error("[Zay AI] CRITICAL: API_KEY is missing from environment.");
      return { text: "Configuration Error: API Key missing. Please check your environment variables.", type: 'text' };
    }

    try {
      const client = new OpenAI({
        apiKey: apiKey,
        baseURL: "https://integrate.api.nvidia.com/v1",
        dangerouslyAllowBrowser: true 
      });

      const MODEL_ID = "meta/llama-3.2-90b-vision-instruct";

      // 1. Context Sync from Supabase
      const freshState = await supabaseService.fetchFullState();
      const lessons = freshState.lessons || [];
      const subjects = freshState.subjects || [];

      // 2. Fuzzy Match for Lesson Content
      const normalizedQuery = userQuery.toLowerCase();
      const matchedLesson = lessons.find(l => {
        const titleMatch = normalizedQuery.includes(l.title.toLowerCase());
        const keywordMatch = l.keywords?.some(k => normalizedQuery.includes(k.toLowerCase()));
        return titleMatch || keywordMatch;
      });

      // 3. System Instruction
      const systemPrompt = `
        You are Zay, the Elite AI Academic Hub Controller for 1BacSM. 
        Engine: Llama-3.2-90b-Vision (NVIDIA NIM).

        **OPERATIONAL DIRECTIVES**:
        1. **90% DATA DEPENDENCY**: For summaries or exercises, strictly use the lesson data provided in the context.
        2. **MATH**: Use Unicode (Δ, ∑, ∫, √, ∞, ≠, ≤, ≥, ±, α, β, θ, λ, π, Ω). Bold vectors: **AB**.
        3. **COMMANDS**: Append file links using: ATTACH_FILES::[{"name": "...", "url": "...", "type": "..."}]
      `;

      // 4. Build Multi-modal Payload
      const userContent: any[] = [{ type: "text", text: userQuery }];

      if (imageUrl) {
        userContent.push({ type: "image_url", image_url: { url: imageUrl, detail: "high" } });
      }

      if (matchedLesson) {
        const images = (matchedLesson.attachments || []).filter(a => a.type === 'image').slice(0, 3);
        images.forEach(img => {
          userContent.push({ type: "image_url", image_url: { url: img.url, detail: "high" } });
        });
        userContent.unshift({ type: "text", text: `[HUB_DATA]: Context for "${matchedLesson.title}" attached.` });
      }

      // 5. History Mapping
      const conversationHistory = history
        .filter(m => !m.mediaUrl || m.mediaUrl.length < 500)
        .slice(-8)
        .map(m => ({
          role: (m.content.startsWith(":::AI_RESPONSE:::") ? "assistant" : "user") as "assistant" | "user",
          content: m.content.replace(":::AI_RESPONSE:::", "")
        }));

      // 6. API Call
      const completion = await client.chat.completions.create({
        model: MODEL_ID,
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationHistory,
          { role: "user", content: userContent }
        ],
        temperature: 0.1,
        max_tokens: 2048,
      });

      let text = (completion.choices[0].message.content || "").trim();
      let resources: any[] = [];

      // 7. Auto-Attach Logic
      if (matchedLesson && !text.includes("ATTACH_FILES::")) {
        const fileLinks = (matchedLesson.attachments || []).map(a => ({ name: a.name, url: a.url, type: a.type }));
        text += `\n\nATTACH_FILES::${JSON.stringify(fileLinks)}`;
      }

      if (text.includes("ATTACH_FILES::")) {
        const parts = text.split("ATTACH_FILES::");
        text = parts[0].trim();
        try {
          resources = JSON.parse(parts[parts.length - 1].trim());
        } catch (e) {
          console.error("[Zay AI] Resource Parse Error");
        }
      }

      return { text, resources, type: 'text' };

    } catch (error: any) {
      console.error("[Zay AI] Detailed API Error:", {
        status: error.status,
        message: error.message,
        body: error.body
      });

      let msg = "The Hub Controller (Llama-Vision) encountered an error.";
      if (error.status === 401) msg = "AI Auth Error: Invalid NVIDIA API Key.";
      else if (error.status === 429) msg = "AI Rate Limit: Too many requests to the Hub.";
      else if (error.message) msg = `AI Error: ${error.message}`;

      return { text: msg, type: 'text' };
    }
  }
};
