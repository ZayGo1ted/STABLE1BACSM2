
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
    // API Key is strictly obtained from process.env.API_KEY
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
      console.error("[Zay AI] Error: API_KEY is missing from environment variables.");
      return { text: "Configuration Error: The Hub's AI key is not set. Contact the developer.", type: 'text' };
    }

    try {
      const client = new OpenAI({
        apiKey: apiKey,
        baseURL: "https://integrate.api.nvidia.com/v1",
        dangerouslyAllowBrowser: true 
      });

      const MODEL_ID = "meta/llama-3.2-90b-vision-instruct";

      // 1. Fetch Fresh Database State for Dynamic Context
      const freshState = await supabaseService.fetchFullState();
      const lessons = freshState.lessons || [];
      const subjects = freshState.subjects || [];

      // 2. Dynamic Context Matching (Fuzzy search for lesson keywords)
      const normalizedQuery = userQuery.toLowerCase();
      const matchedLesson = lessons.find(l => {
        const titleMatch = normalizedQuery.includes(l.title.toLowerCase());
        const keywordMatch = l.keywords?.some(k => normalizedQuery.includes(k.toLowerCase()));
        return titleMatch || keywordMatch;
      });

      // 3. Hub Library Metadata Injection
      const hubLibrarySummary = lessons.map(l => ({
        title: l.title,
        type: l.type,
        desc: l.description,
        subject: subjects.find(s => s.id === l.subjectId)?.name.en || 'General'
      }));

      const systemPrompt = `
        You are Zay, the Elite AI Academic Hub Controller for 1BacSM. 
        Core Engine: Llama-3.2-90b-Vision (NVIDIA NIM).

        **HUB LIBRARY INDEX**:
        ${JSON.stringify(hubLibrarySummary, null, 1)}

        **OPERATIONAL DIRECTIVES**:
        1. **90% DATA DEPENDENCY**: If asked for a "Résumé" or "Série d'exercices", you MUST base 90% of your content on the matched lesson files provided in the context.
        2. **VISION ENABLED**: Use any provided image_urls to extract specific mathematical problems, diagrams, and notation.
        3. **FORMATTING**: Use Unicode for math symbols (Δ, ∑, ∫, √, ∞, ≠, ≤, ≥, ±, α, β, θ, λ, π, Ω). Bold vectors: **AB**.
        4. **ATTACHMENTS**: If a database match is found, append file links using: ATTACH_FILES::[{"name": "...", "url": "...", "type": "..."}] at the end.

        Always prioritize specific classroom data over general training knowledge.
      `;

      // 4. Multi-modal Message Construction
      const userContentParts: any[] = [{ type: "text", text: userQuery }];

      // Case A: User uploaded an image directly to the chat
      if (imageUrl) {
        userContentParts.push({ 
          type: "image_url", 
          image_url: { url: imageUrl, detail: "high" } 
        });
      }

      // Case B: Lesson matched - auto-inject its reference images into vision window
      if (matchedLesson) {
        const images = (matchedLesson.attachments || []).filter(a => a.type === 'image').slice(0, 3);
        images.forEach(img => {
          userContentParts.push({ 
            type: "image_url", 
            image_url: { url: img.url, detail: "high" } 
          });
        });
        
        userContentParts.unshift({ 
          type: "text", 
          text: `[HUB_CONTEXT_LOADED]: Analyzing material for "${matchedLesson.title}". Description: ${matchedLesson.description}` 
        });
      }

      // 5. Conversation History Mapping
      const conversationHistory = history
        .filter(m => !m.mediaUrl || m.mediaUrl.length < 500) // Filter out heavy payloads
        .slice(-8) // Context window depth
        .map(m => {
          const isAi = m.content.startsWith(":::AI_RESPONSE:::");
          return {
            role: (isAi ? "assistant" : "user") as "assistant" | "user",
            content: m.content.replace(":::AI_RESPONSE:::", "")
          };
        });

      // 6. API Execution with Detailed Monitoring
      console.log(`[Zay AI] Requesting NIM model: ${MODEL_ID}...`);
      
      const completion = await client.chat.completions.create({
        model: MODEL_ID,
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationHistory,
          { role: "user", content: userContentParts }
        ],
        temperature: 0.1, // Strict mathematical accuracy
        max_tokens: 2048,
        top_p: 1,
      });

      if (!completion.choices || completion.choices.length === 0) {
        throw new Error("NVIDIA NIM returned an empty response (possible safety trigger or quota issue).");
      }

      let text = (completion.choices[0].message.content || "").trim();
      let resources: any[] = [];

      // 7. Auto-Attach Hub Files if missing from AI output
      if (matchedLesson && !text.includes("ATTACH_FILES::")) {
        const fileLinks = (matchedLesson.attachments || []).map(a => ({ name: a.name, url: a.url, type: a.type }));
        text += `\n\nATTACH_FILES::${JSON.stringify(fileLinks)}`;
      }

      // 8. Command Parsing
      if (text.includes("ATTACH_FILES::")) {
        const parts = text.split("ATTACH_FILES::");
        text = parts[0].trim();
        try {
          const jsonPart = parts[parts.length - 1].trim();
          resources = JSON.parse(jsonPart);
        } catch (e) {
          console.warn("[Zay AI] Failed to parse resource JSON from response.");
        }
      }

      return { text, resources, type: 'text' };

    } catch (error: any) {
      // Detailed Error Catching
      console.error("[Zay AI] Detailed Error Context:", {
        message: error.message,
        status: error.status,
        code: error.code,
        type: error.type,
        stack: error.stack
      });

      let userErrorMessage = "The Hub Controller (Llama-Vision) encountered an error.";

      if (error.status === 401) userErrorMessage = "Authentication failed: Check NVIDIA API Key permissions.";
      else if (error.status === 429) userErrorMessage = "NVIDIA NIM Quota exceeded: Too many requests.";
      else if (error.status === 404) userErrorMessage = "Model not found: Check model ID 'meta/llama-3.2-90b-vision-instruct'.";
      else if (error.message) userErrorMessage = `AI Engine Error: ${error.message}`;

      return { 
        text: userErrorMessage, 
        type: 'text' 
      };
    }
  }
};
