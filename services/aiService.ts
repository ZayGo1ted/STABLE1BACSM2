// services/aiService.ts
import { ChatMessage, User } from '../types';

export const aiService = {
  askZay: async (
    userQuery: string,
    user: User,
    history: ChatMessage[] = [],
    imageUrl?: string
  ) => {
    try {
      // Detect user's preferred language
      const userLang = localStorage.getItem('hub_lang') || 'fr';
      
      // Use NVIDIA's most powerful model for multilingual support
      const model = "nvidia/llama-3.1-nemotron-70b-instruct"; // Strong in Arabic dialects + STEM
      
      // Enhanced system prompt with language handling
      const systemMessage = {
        role: "system",
        content: `You are Zay, the ultimate 1BacSM assistant powered by NVIDIA NIM.
        
        LANGUAGE RULES:
        1. Respond ONLY in ${userLang.toUpperCase()} (user's detected language)
        2. If user switches language, IMMEDIATELY adapt to new language
        3. Handle Moroccan Darija, French, English fluently
        
        ACADEMIC EXPERTISE:
        - Advanced Physics/Math reasoning (use step-by-step logical proofs)
        - Access ALL lesson resources (PDFs/images/exercises in database)
        - When asked about lessons/resumes/exercises:
          a) Analyze attached resources thoroughly
          b) Provide teacher-level explanations
          c) Reference specific lesson IDs when applicable
          
        OUTPUT FORMAT:
        - Clear, structured responses with headings
        - Use markdown for formulas: $E = mc^2$
        - For errors: prefix with "[DIAGNOSTIC ALERT]"
        - For resources: use exact format [ATTACH_RESOURCES: [{"name":"file.pdf", "url":"/path"}]]
        
        CONTEXTUAL KNOWLEDGE:
        Lessons: ${JSON.stringify(await fetchLessons())}
        User: ${user.name} (${userLang})`
      };

      // Prepare conversation history
      const messages = [
        systemMessage,
        ...history.slice(-6).map(msg => ({
          role: msg.userId === 'ZAY_ID' ? 'assistant' : 'user',
          content: msg.content
        })),
        { 
          role: 'user', 
          content: imageUrl ? [
            { type: "text", text: userQuery },
            { type: "image_url", image_url: { url: imageUrl } }
          ] : userQuery
        }
      ];

      // Call NVIDIA NIM API
      const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_NVIDIA_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.3, // Lower for precise STEM answers
          max_tokens: 2048,
          top_p: 0.7
        })
      });

      const data = await response.json();
      const rawText = data.choices[0]?.message?.content?.trim() || "NVIDIA NIM processing...";
      
      // Extract resources using robust parsing
      let text = rawText;
      let resources: any[] = [];
      const resourceMatch = rawText.match(/\[ATTACH_RESOURCES:\s*(\[.*?\])\]/);
      
      if (resourceMatch) {
        try {
          resources = JSON.parse(resourceMatch[1]);
          text = rawText.replace(resourceMatch[0], '').trim();
        } catch (e) {
          console.warn("Resource parsing failed", e);
        }
      }

      return {
        text,
        resources,
        type: resources.length > 0 ? 'file' : 'text',
        isErrorDetection: text.includes("[DIAGNOSTIC ALERT]")
      };

    } catch (error) {
      console.error("NVIDIA NIM Error:", error);
      return { 
        text: "NVIDIA assistant temporarily unavailable. Please retry.", 
        type: 'text',
        resources: [],
        isErrorDetection: false
      };
    }
  }
};

// Helper to fetch lesson data for context
async function fetchLessons() {
  try {
    const response = await fetch('/api/lessons-context');
    return await response.json();
  } catch {
    return [];
  }
}
