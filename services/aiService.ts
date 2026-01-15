
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
 * Targeted Model: meta/llama-3.2-90b-vision-instruct
 */
export const aiService = {
  askZay: async (userQuery: string, requestingUser: User | null, history: ChatMessage[] = [], imageUrl?: string): Promise<AiResponse> => {
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
      console.error("API_KEY missing");
      return { text: "System Error: Missing NVIDIA AI Configuration.", type: 'text' };
    }

    try {
      const client = new OpenAI({
        apiKey: apiKey,
        baseURL: "https://integrate.api.nvidia.com/v1",
        dangerouslyAllowBrowser: true // Required for client-side integration
      });

      const MODEL_ID = "meta/llama-3.2-90b-vision-instruct";

      // 1. Fetch Fresh Database State for specific context
      const freshState = await supabaseService.fetchFullState();
      const lessons = freshState.lessons || [];
      const subjects = freshState.subjects || [];

      // 2. Dynamic Context Matching
      const normalizedQuery = userQuery.toLowerCase();
      const matchedLesson = lessons.find(l => {
        const titleMatch = normalizedQuery.includes(l.title.toLowerCase());
        const keywordMatch = l.keywords?.some(k => normalizedQuery.includes(k.toLowerCase()));
        return titleMatch || keywordMatch;
      });

      // 3. Construct System Message with Database Index
      const hubLibrarySummary = lessons.map(l => ({
        title: l.title,
        type: l.type,
        desc: l.description,
        subject: subjects.find(s => s.id === l.subjectId)?.name.en || 'General'
      }));

      const systemPrompt = `
        You are Zay, the Elite AI Academic Hub Controller for 1BacSM.
        Engine: llama-3.2-90b-vision-instruct.

        **ACADEMIC DATABASE (HUB LIBRARY)**:
        ${JSON.stringify(hubLibrarySummary, null, 1)}

        **OPERATIONAL DIRECTIVES**:
        1. **90% DATA DEPENDENCY RULE**: When asked to generate a "Résumé" or "Série d'exercices", you MUST use the description and visual data of the corresponding lesson in the database.
        2. **VISION CAPABILITY**: You can see images. Use this to extract specific mathematical notation, diagrams, and problem structures from the classroom files.
        3. **MATH PRECISION**: Use Unicode (Δ, ∑, ∫, √, ∞, ≠, ≤, ≥, ±, α, β, θ, λ, π, Ω). Bold vectors: **AB**.
        4. **FILE COMMAND**: Always attach relevant files using: ATTACH_FILES::[{"name": "...", "url": "...", "type": "..."}]

        **FUZZY MATCHING**:
        - Handle typos ("fzik", "math sm", "lecon").
        - Always act as if the classroom database is the single source of truth.
      `;

      // 4. Build Multi-modal Content (Vision Support)
      const userContent: any[] = [{ type: "text", text: userQuery }];

      // If there's an explicit image URL from the chat
      if (imageUrl) {
        userContent.push({ type: "image_url", image_url: { url: imageUrl } });
      }

      // If we matched a lesson, include its primary images as vision context automatically
      if (matchedLesson) {
        const imageAttachments = (matchedLesson.attachments || []).filter(a => a.type === 'image').slice(0, 2);
        imageAttachments.forEach(img => {
          userContent.push({ 
            type: "image_url", 
            image_url: { url: img.url },
            detail: "high" 
          });
        });
        
        // Add a prompt to look at these specific files
        userContent.unshift({ 
          type: "text", 
          text: `[SYSTEM: CONTEXT LOADED] I am analyzing the files for "${matchedLesson.title}". Use these visual materials to answer.` 
        });
      }

      // 5. Format Conversation History
      const conversationHistory = history
        .filter(m => !m.mediaUrl || m.mediaUrl.length < 500)
        .slice(-6)
        .map(m => {
          const isAi = m.content.startsWith(":::AI_RESPONSE:::");
          return {
            role: (isAi ? "assistant" : "user") as "assistant" | "user",
            content: m.content.replace(":::AI_RESPONSE:::", "")
          };
        });

      // 6. Request Completion
      const completion = await client.chat.completions.create({
        model: MODEL_ID,
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationHistory,
          { role: "user", content: userContent }
        ],
        temperature: 0.1, // Requested for high mathematical accuracy
        max_tokens: 2048,
        top_p: 1,
      });

      let text = (completion.choices[0].message.content || "").trim();
      let resources: any[] = [];

      // 7. Auto-Attach Logic
      if (matchedLesson && !text.includes("ATTACH_FILES::")) {
        const fileLinks = (matchedLesson.attachments || []).map(a => ({ name: a.name, url: a.url, type: a.type }));
        text += `\n\nATTACH_FILES::${JSON.stringify(fileLinks)}`;
      }

      // Parse resources from response if they exist
      if (text.includes("ATTACH_FILES::")) {
        const parts = text.split("ATTACH_FILES::");
        text = parts[0].trim();
        try {
          const jsonPart = parts[parts.length - 1].trim();
          resources = JSON.parse(jsonPart);
        } catch (e) {
          console.error("SDK Resource Parse Error", e);
        }
      }

      return { text, resources, type: 'text' };

    } catch (error: any) {
      console.error("Zay (NVIDIA SDK) Error:", error);
      return { 
        text: `The Hub Controller (Llama-Vision) encountered an error: ${error.message}`, 
        type: 'text' 
      };
    }
  }
};
