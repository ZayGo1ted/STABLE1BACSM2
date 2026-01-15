
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
 * Targeted Model: llama-4-maverick-17b-128e-instruct
 * Optimized for: Multi-modal context (Images/PDF metadata)
 */
export const aiService = {
  askZay: async (userQuery: string, requestingUser: User | null, history: ChatMessage[] = []): Promise<AiResponse> => {
    const apiKey = process.env.API_KEY;
    const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
    const MODEL_ID = "meta/llama-4-maverick-17b-128e-instruct";

    if (!apiKey) {
      console.error("API_KEY (NVIDIA) missing");
      return { text: "System Error: NVIDIA Hub Configuration missing.", type: 'text' };
    }

    try {
      // 1. Fetch Fresh State for Context
      const freshState = await supabaseService.fetchFullState();
      const lessons = freshState.lessons || [];
      const subjects = freshState.subjects || [];

      // 2. Perform Intelligent Lesson Search (Internal)
      // Find a lesson that matches the user's query keywords or title
      const normalizedQuery = userQuery.toLowerCase();
      const matchedLesson = lessons.find(l => {
        const titleMatch = normalizedQuery.includes(l.title.toLowerCase());
        const keywordMatch = l.keywords?.some(k => normalizedQuery.includes(k.toLowerCase()));
        return titleMatch || keywordMatch;
      });

      // 3. Prepare Multi-modal Content (Images) if lesson found
      let contextualMessages: any[] = [];
      
      if (matchedLesson) {
        const imageAttachments = (matchedLesson.attachments || []).filter(a => a.type === 'image').slice(0, 3);
        
        // Build a content block with text AND image references for the LLM
        const contentBlock: any[] = [
          { 
            type: "text", 
            text: `[SYSTEM CONTEXT: DATA SOURCE ACTIVATED]
                   The user is asking about the lesson: "${matchedLesson.title}".
                   Lesson Description: "${matchedLesson.description}"
                   Subject: ${subjects.find(s => s.id === matchedLesson.subjectId)?.name.en || 'General'}
                   Type: ${matchedLesson.type}
                   
                   STRICT DIRECTIVE: You are now "seeing" the visual materials for this lesson. 
                   If requested to generate a "Série d'exercices" or "Résumé", you MUST derive 90% of your 
                   logic, specific numbers, notation, and difficulty level from this specific source.
                   If you generate an exercise, it should look like it came from these specific documents.`
          }
        ];

        // Add Image URLs (NIM Maverick/Vision models can consume these)
        imageAttachments.forEach(img => {
          contentBlock.push({
            type: "image_url",
            image_url: { url: img.url }
          });
        });

        contextualMessages.push({ role: "system", content: contentBlock });
      }

      // 4. Build Conversation History
      const conversationHistory = history
        .filter(m => !m.mediaUrl || m.mediaUrl.length < 500)
        .slice(-6)
        .map(m => {
          const isAi = m.content.startsWith(":::AI_RESPONSE:::");
          return {
            role: isAi ? "assistant" : "user",
            content: m.content.replace(":::AI_RESPONSE:::", "")
          };
        });

      // 5. Base System Prompt
      const baseSystemPrompt = `
        You are Zay, the Elite AI Academic Hub Controller. 
        Engine: llama-4-maverick (Vision Enabled).

        **OPERATIONAL CORE**:
        - You act as a mirror of the Hub Library. 
        - When a specific lesson/image context is provided in the messages, prioritize it 90% over your training data.
        - MATH: Use Unicode (Δ, ∑, ∫, √, ∞, ≠, ≤, ≥, ±, α, β, θ, λ, π, Ω). Bold vectors: **AB**.
        - ATTACH_FILES: If the user needs the actual PDF/Image from the Hub, use command: ATTACH_FILES::[{"name": "...", "url": "...", "type": "..."}]

        **FUZZY MATCHING**:
        - Handle typos ("fzik", "math sm", "lecon").
        - If the user asks for "Série" or "Exercices" and a match is found, generate exercises based ON THE FILES PROVIDED and then attach them.
      `;

      // 6. Execute API Call
      const response = await fetch(NVIDIA_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: MODEL_ID,
          messages: [
            { role: "system", content: baseSystemPrompt },
            ...contextualMessages,
            ...conversationHistory,
            { role: "user", content: userQuery }
          ],
          temperature: 0.15, // Low temperature for academic accuracy
          max_tokens: 2048
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || "NVIDIA NIM Connectivity Error");
      }

      const data = await response.json();
      let text = (data.choices[0].message.content || "").trim();
      let resources: any[] = [];

      // 7. Auto-Attach Logic for matched lesson
      if (matchedLesson && !text.includes("ATTACH_FILES::")) {
        const fileLinks = (matchedLesson.attachments || []).map(a => ({ name: a.name, url: a.url, type: a.type }));
        text += `\n\nATTACH_FILES::${JSON.stringify(fileLinks)}`;
      }

      // Parse resources from text if AI used the command explicitly
      if (text.includes("ATTACH_FILES::")) {
        const parts = text.split("ATTACH_FILES::");
        text = parts[0].trim();
        try {
            const jsonPart = parts[parts.length - 1].trim();
            resources = JSON.parse(jsonPart);
        } catch (e) {
            console.error("NVIDIA Resource Parse Error", e);
        }
      }

      return { text, resources, type: 'text' };

    } catch (error: any) {
      console.error("Zay (NVIDIA Maverick) Service Error:", error);
      return { text: `Zay is currently having trouble accessing the Hub data: ${error.message}`, type: 'text' };
    }
  }
};
