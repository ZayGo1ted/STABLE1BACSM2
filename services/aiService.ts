// services/aiService.ts
import { ChatMessage, User } from '../types';

const ZAY_API_ENDPOINT = '/api/askZay'; // Assuming it's deployed on the same origin

export const aiService = {
  /**
   * Sends the query and context to your custom backend API which handles interaction with the NVIDIA model.
   */
  askZay: async (
    userQuery: string,
    requestingUser: User,
    history: ChatMessage[] = []
  ) => {
    try {
      const response = await fetch(ZAY_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userQuery,
          requestingUser, // Send user info for personalization/context
          history,       // Send full history for memory
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Zay API Error (${response.status}):`, errorText);
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();

      // Ensure returned data has expected structure
      return {
        text: data.text?.trim() || "Zay is thinking...",
        resources: data.resources || [], // Array of {name, url, type} from DB
        grounding: data.grounding || [], // Array of grounding chunks from NVIDIA NIM
        type: data.type || 'text', // 'text' or 'file' based on content/resources
        isErrorDetection: data.isErrorDetection || false,
      };

    } catch (error: any) {
      console.error("Zay Service Error (Client Side):", error);
      // Provide a user-friendly fallback message
      return {
        text: "Zay encountered an issue. Could you please rephrase your question?",
        resources: [],
        grounding: [],
        type: 'text',
        isErrorDetection: false,
      };
    }
  }
};
