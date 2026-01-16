// services/aiService.ts (Client-Side Caller)
import { User, ChatMessage } from '../types';

const AI_PREFIX = ":::AI_RESPONSE:::";

// Define the interface for the response from our API route
interface AiResponse {
  text: string;
  resources?: any[];
  grounding?: any[];
  type: 'text' | 'image' | 'file';
  isErrorDetection?: boolean;
}

/**
 * Zay AI: Frontend proxy to the secure backend AI service.
 * Communicates with the Vercel Serverless Function `/api/askZay`.
 */
export const aiService = {
  askZay: async (
    userQuery: string,
    requestingUser: User | null,
    history: ChatMessage[] = [],
    imageUrl?: string
  ): Promise<AiResponse> => {

    try {
      const response = await fetch('/api/askZay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userQuery,
          requestingUser,
          history,
          imageUrl
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Route Error:", response.status, errorText);
        return {
          text: `Error communicating with AI service: ${response.status} ${errorText}`,
          type: 'text'
        };
      }

      const aiResponse: AiResponse = await response.json();
      
      // Fix: Properly handle resources parsing
      if (aiResponse.resources && Array.isArray(aiResponse.resources)) {
        // Resources are already parsed correctly from the backend
        return aiResponse;
      }
      
      return aiResponse;

    } catch (error: any) {
      console.error("[Zay Frontend Service Error]:", error);
      return {
        text: "Failed to communicate with the AI backend service. Please check your connection.",
        type: 'text'
      };
    }
  }
};
