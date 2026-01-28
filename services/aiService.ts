// services/aiService.ts
import { ChatMessage, User } from '../types';

const ZAY_API_ENDPOINT = '/api/askZay';

export const aiService = {
  askZay: async (
    userQuery: string,
    requestingUser: User,
    history: ChatMessage[] = [],
    mediaAttachments?: { url: string; type: string }[]
  ) => {
    try {
      const response = await fetch(ZAY_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userQuery,
          requestingUser,
          history,
          mediaAttachments,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Zay API Error (${response.status}):`, errorText);
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        text: data.text?.trim() || "Zay is processing your request...",
        resources: data.resources || [],
        grounding: data.grounding || [],
        type: data.type || 'text',
        isErrorDetection: data.isErrorDetection || false,
      };

    } catch (error: any) {
      console.error("Zay Service Error:", error);
      return {
        text: "Zay encountered an issue. Please try again.",
        resources: [],
        grounding: [],
        type: 'text',
        isErrorDetection: false,
      };
    }
  }
};
