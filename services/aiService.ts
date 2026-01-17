// services/aiService.ts
import { ChatMessage, User } from '../types';

export const aiService = {
  /**
   * Main function to interact with Zay. 
   * Uses GPT-5.2 Pro via Puter.js for high-level reasoning.
   */
  askZay: async (
    userQuery: string,
    history: ChatMessage[] = [],
    imageUrl?: string
  ) => {
    try {
      // Use gpt-5.2-pro for tough math/physics logic
      // Note: OpenRouter driver is used for high-tier Pro models in Puter.js
      const model = imageUrl ? "gpt-5.2" : "gpt-5.2-pro";
      const options = {
        model: model,
        driver: "openrouter",
        temperature: 0.5, // Lower temperature for more accurate SM answers
        max_tokens: 1500
      };

      // Construct a strictly academic context
      const systemMessage = {
        role: "system",
        content: `You are Zay, a highly capable assistant for 1Bac Science Math (1BacSM) students. 
        Your tone is helpful, smart, and peer-like. 
        Focus exclusively on:
        - Physics/Chemistry (Mechanics, Electricity, Organic Chem)
        - Mathematics (Logic, Functions, Sequences)
        - Providing lesson titles and helpful study tips.
        NEVER mention being an AI or use technical jargon about processors.`
      };

      // Combine history with current query
      const messages = [
        systemMessage,
        ...history.slice(-8).map(msg => ({
          role: msg.userId === 'ZAY_ID' ? 'assistant' : 'user',
          content: msg.content
        })),
        { role: 'user', content: userQuery }
      ];

      // Execute via Puter.js
      const response: any = await (window as any).puter.ai.chat(messages, options);
      
      const text = typeof response === 'string' ? response : response?.message?.content || response?.text;

      return {
        text: text.trim(),
        type: 'text'
      };

    } catch (error) {
      console.error("Zay Assistant Error:", error);
      // Fallback to GPT-5.2 Chat for speed if Pro fails
      const fallback = await (window as any).puter.ai.chat(userQuery, { model: "gpt-5.2-chat" });
      return { text: fallback, type: 'text' };
    }
  }
};
