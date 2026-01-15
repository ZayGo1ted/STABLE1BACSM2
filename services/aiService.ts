import OpenAI from "openai"; // 1. Import OpenAI
import { User, ChatMessage } from '../types';
import { supabaseService } from './supabaseService';

interface AiResponse {
  text: string;
  resources?: any[];
  grounding?: any[];
  type: 'text' | 'image' | 'file';
}

// 2. Initialize the client (Vercel will pick up process.env.API_KEY)
const client = new OpenAI({
  apiKey: process.env.API_KEY, 
  baseURL: 'https://integrate.api.nvidia.com/v1', // 3. The NVIDIA "Highway"
});

export const aiService = {
  askZay: async (userQuery: string, requestingUser: User | null, history: ChatMessage[] = []): Promise<AiResponse> => {
    const MODEL_ID = "meta/llama-4-maverick-17b-128e-instruct";

    try {
      // Fetch fresh Hub data (Lessons/Subjects)
      const freshState = await supabaseService.fetchFullState();
      const lessons = freshState.lessons || [];
      const subjects = freshState.subjects || [];

      // Logic to find a matching lesson based on user query
      const normalizedQuery = userQuery.toLowerCase();
      const matchedLesson = lessons.find(l => {
        const titleMatch = normalizedQuery.includes(l.title.toLowerCase());
        const keywordMatch = l.keywords?.some(k => normalizedQuery.includes(k.toLowerCase()));
        return titleMatch || keywordMatch;
      });

      // Prepare Multi-modal Context
      let contextualMessages: any[] = [];
      if (matchedLesson) {
        const imageAttachments = (matchedLesson.attachments || []).filter(a => a.type === 'image').slice(0, 3);
        
        const content: any[] = [{ 
          type: "text", 
          text: `[HUB CONTEXT]: Lesson "${matchedLesson.title}". Subject: ${subjects.find(s => s.id === matchedLesson.subjectId)?.name.en || 'General'}. Use the provided visual materials to generate exercises.` 
        }];

        imageAttachments.forEach(img => {
          content.push({ type: "image_url", image_url: { url: img.url } });
        });

        contextualMessages.push({ role: "system", content });
      }

      // Convert conversation history to OpenAI format
      const conversationHistory = history.slice(-6).map(m => ({
        role: m.content.startsWith(":::AI_RESPONSE:::") ? "assistant" : "user",
        content: m.content.replace(":::AI_RESPONSE:::", "")
      }));

      // 4. The Request to NVIDIA
      const completion = await client.chat.completions.create({
        model: MODEL_ID,
        messages: [
          { role: "system", content: "You are @Zay, an Elite Academic AI. Engine: Llama-4 Maverick." },
          ...contextualMessages,
          ...conversationHistory,
          { role: "user", content: userQuery }
        ],
        temperature: 0.15,
      });

      let text = (completion.choices[0].message.content || "").trim();
      let resources: any[] = [];

      // Auto-attach logic (if matching lesson found)
      if (matchedLesson && !text.includes("ATTACH_FILES::")) {
        const fileLinks = (matchedLesson.attachments || []).map(a => ({ name: a.name, url: a.url, type: a.type }));
        text += `\n\nATTACH_FILES::${JSON.stringify(fileLinks)}`;
      }

      return { text, resources, type: 'text' };

    } catch (error: any) {
      console.error("Zay (NVIDIA) Error:", error);
      return { text: "Zay is currently offline. Error: " + error.message, type: 'text' };
    }
  }
};
