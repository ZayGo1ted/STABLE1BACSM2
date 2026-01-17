// services/aiService.ts
import { User, ChatMessage } from '../types';

const AI_PREFIX = ":::AI_RESPONSE:::";

interface AiResponse {
  text: string;
  resources?: any[];
  grounding?: any[];
  type: 'text' | 'image' | 'file';
  isErrorDetection?: boolean;
}

/**
 * Zay AI: Frontend proxy using Puter.js for free unlimited OpenAI API access
 * Supports GPT-5, GPT-4 Vision, and multimodal capabilities
 */
export const aiService = {
  askZay: async (
    userQuery: string,
    requestingUser: User | null,
    history: ChatMessage[] = [],
    imageUrl?: string
  ): Promise<AiResponse> => {
    try {
      // Use the most powerful model available
      const model = imageUrl ? "gpt-4o" : "gpt-5.2";
      
      let prompt = userQuery;
      
      // If there's an image, include it in the request
      if (imageUrl) {
        // For image analysis, we pass both text and image URL
        prompt = `${userQuery}\n\nAnalyze this image: ${imageUrl}`;
      }
      
      // Add conversation history for context
      if (history.length > 0) {
        const historyText = history
          .slice(-5) // Last 5 messages for context
          .map(msg => `${msg.userId === requestingUser?.id ? 'User' : 'Assistant'}: ${msg.content}`)
          .join('\n');
        prompt = `Conversation history:\n${historyText}\n\nCurrent query: ${userQuery}`;
      }
      
      // Call Puter.js API
      const response: any = await (window as any).puter.ai.chat(prompt, {
        model: model,
        temperature: 0.1,
        max_tokens: 2048,
        stream: false
      });
      
      let text = "";
      if (typeof response === 'string') {
        text = response;
      } else if (response && response.choices && response.choices[0] && response.choices[0].message) {
        text = response.choices[0].message.content || "";
      } else if (response && response.text) {
        text = response.text;
      } else {
        text = "Sorry, I couldn't process that request.";
      }
      
      // Extract resources if they exist in the response
      let resources: any[] = [];
      let grounding: any[] = [];
      const isErrorDetection = text.includes("[DIAGNOSTIC ALERT]");
      
      // Parse resource attachments if present
      const tag = "[ATTACH_RESOURCES:";
      const tagIndex = text.indexOf(tag);
      if (tagIndex !== -1) {
        const afterTag = text.substring(tagIndex + tag.length);
        const closingBracketIndex = afterTag.lastIndexOf(']');
        
        if (closingBracketIndex !== -1) {
          const jsonStr = afterTag.substring(0, closingBracketIndex).trim();
          const cleanJson = jsonStr.replace(/```json|```/g, '').trim();
          
          try {
            resources = JSON.parse(cleanJson);
            text = text.substring(0, tagIndex).trim();
          } catch (e) {
            console.error("[Zay] Resource extraction error:", e, "Payload:", cleanJson);
          }
        }
      }
      
      return { 
        text, 
        resources, 
        grounding, 
        type: (resources.length > 0 || isErrorDetection) ? 'file' : 'text', 
        isErrorDetection 
      };

    } catch (error: any) {
      console.error("[Zay Puter.js Service Error]:", error);
      return {
        text: "My neural processor encountered an error. Please try your request again.",
        type: 'text'
      };
    }
  },
  
  // New function for image analysis
  analyzeImage: async (
    imageUrl: string,
    userQuery: string,
    requestingUser: User | null
  ): Promise<AiResponse> => {
    try {
      // Use GPT-4 Vision for image analysis
      const response: any = await (window as any).puter.ai.chat(
        userQuery,
        imageUrl,
        {
          model: "gpt-4o",
          temperature: 0.1,
          max_tokens: 1024
        }
      );
      
      let text = "";
      if (typeof response === 'string') {
        text = response;
      } else if (response && response.choices && response.choices[0] && response.choices[0].message) {
        text = response.choices[0].message.content || "";
      } else {
        text = "I analyzed the image but couldn't generate a response.";
      }
      
      return {
        text,
        resources: [],
        grounding: [],
        type: 'text',
        isErrorDetection: text.includes("[DIAGNOSTIC ALERT]")
      };
      
    } catch (error: any) {
      console.error("[Zay Image Analysis Error]:", error);
      return {
        text: "I had trouble analyzing that image. Please try again.",
        type: 'text'
      };
    }
  }
};
