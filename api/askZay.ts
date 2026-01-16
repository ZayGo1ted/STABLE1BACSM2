// api/askZay.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { supabaseService } from '../../services/supabaseService'; // Adjust path as needed
import { ZAY_USER_ID } from '../../constants'; // Adjust path as needed
import { User, ChatMessage } from '../../types'; // Adjust path as needed

// IMPORTANT: These types/interfaces should ideally be shared or defined here
// to avoid importing from the client bundle if possible.
interface AiRequestBody {
  userQuery: string;
  requestingUser: User | null;
  history: ChatMessage[];
  imageUrl?: string; // Not used in current logic, but passed
}

interface AiResponse {
  text: string;
  resources?: any[];
  grounding?: any[];
  type: 'text' | 'image' | 'file';
  isErrorDetection?: boolean;
}

const AI_PREFIX = ":::AI_RESPONSE:::";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ text: 'Method Not Allowed', type: 'text' });
  }

  // Get the NVIDIA API Key from Vercel Environment Variables (SECURE)
  const apiKey = process.env.NVIDIA_API_KEY;

  if (!apiKey) {
    console.error("NVIDIA_API_KEY is not configured on the server.");
    return res.status(500).json({
      text: "Server configuration error: NVIDIA API Key is missing.",
      type: 'text'
    });
  }

  // Parse request body
  const { userQuery, requestingUser, history, imageUrl }: AiRequestBody = req.body;

  if (!userQuery) {
    return res.status(400).json({ text: 'Missing userQuery in request body.', type: 'text' });
  }

  try {
    // --- Context Building Logic (Moved Server-Side) ---
    // 1. Fetch State
    const freshState = await supabaseService.fetchFullState();
    const allLessons = freshState.lessons || [];
    const subjects = freshState.subjects || [];
    const academicItems = freshState.items || [];

    // 2. Build Context
    const hubLibrary = allLessons.map(l => ({
      lesson_id: l.id,
      title: l.title,
      subject: subjects.find(s => s.id === l.subjectId)?.name.en,
      summary: l.description,
      attachments: l.attachments || []
    }));

    const activeHomework = academicItems.map(i => ({
      title: i.title,
      type: i.type,
      due: i.date,
      subject: subjects.find(s => s.id === i.subjectId)?.name.en,
      lesson_link: i.title
    }));

    // 3. Process History
    const contextHistory: { role: 'user' | 'assistant'; content: string }[] = (history || [])
      .slice(-15)
      .map(msg => {
        const isAI = msg.userId === ZAY_USER_ID || msg.content.startsWith(AI_PREFIX);
        return {
          role: isAI ? 'assistant' : 'user',
          content: msg.content.replace(AI_PREFIX, '')
        };
      });

    // 4. System Instruction
    const systemInstruction = `
You are Zay, the Smart Diagnostic Assistant for the 1BacSM Hub.
Engine: NVIDIA NIM (e.g., meta/llama3-70b-instruct).

**BEHAVIORAL RULES**:
1. **MEMORY**: Always refer back to history if the user says "it", "that", or "him".
2. **FILE DELIVERY**: If a user asks for a lesson, you MUST find the match in HUB_LIBRARY and send the REAL links.
   USE TAG: [ATTACH_RESOURCES: JSON_ARRAY]
   NEVER invent links. If it's in the DB, send the actual attachment objects.
3. **NO-HOMEWORK LOGIC**: 
   If a student asks for "exercises" or "homework" for a specific lesson:
   - Check HUB_LIBRARY (attachments) and ACTIVE_HOMEWORK list.
   - If there are NO assigned files or homework items for that specific lesson, you MUST say:
     "I found 0 assigned homeworks for [Lesson Name] in the Hub. Would you like me to generate an AI-powered exercise series based on the resources available in the database for this lesson?"
4. **DIAGNOSTICS**: If a student shows math/physics work, check for errors.
   Prefix errors with: "[DIAGNOSTIC ALERT]: Error in [Concept]"

**HUB_LIBRARY**:
${JSON.stringify(hubLibrary, null, 1)}

**ACTIVE_HOMEWORK (Official Tasks)**:
${JSON.stringify(activeHomework, null, 1)}

**USER CONTEXT**:
Current Student: ${requestingUser?.name || 'Student'}
`;

    // 5. Prepare Messages for OpenAI SDK
    const messagesForModel: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemInstruction },
      ...contextHistory,
      { role: "user", content: userQuery }
    ];

    // --- NVIDIA NIM API Call (Server-Side, Secure) ---
    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://integrate.api.nvidia.com/v1',
      // No dangerouslyAllowBrowser needed here, as we are ON the server
    });

    const completion = await openai.chat.completions.create({
      model: "meta/llama3-70b-instruct",
      messages: messagesForModel,
      temperature: 0.15,
      top_p: 1,
      max_tokens: 1024,
      stream: false,
    });

    let text = completion.choices?.[0]?.message?.content?.trim() || "";

    if (!text) {
      console.warn("Received empty response content from NVIDIA NIM.");
      return res.status(200).json({
        text: "The AI model returned an empty response. Please try rephrasing your question.",
        type: 'text'
      });
    }

    // --- Resource Parsing (Server-Side) ---
    let resources: any[] = [];
    let grounding: any[] = [];
    const isErrorDetection = text.includes("[DIAGNOSTIC ALERT]");

    const tag = "[ATTACH_RESOURCES:";
    if (text.includes(tag)) {
      const parts = text.split(tag);
      text = parts[0].trim();
      const jsonStr = parts[1].split(']')[0].trim();
      try {
        resources = JSON.parse(jsonStr);
      } catch (e) {
        console.error("JSON Parse Error in AI response", e);
        text += "\n\n[Error parsing attached resources.]";
      }
    }

    // --- Respond to Client ---
    const finalResponse: AiResponse = {
      text,
      resources,
      grounding,
      type: (resources.length > 0 || isErrorDetection) ? 'file' : 'text',
      isErrorDetection
    };

    res.status(200).json(finalResponse);

  } catch (error: any) {
    console.error("[Zay NIM Service Error - Server Side]:", error);

    let userMessage = "My neural processor (NVIDIA NIM) is temporarily offline. Please try your request again shortly.";

    if (error instanceof OpenAI.APIError) {
      console.error("OpenAI API Error Details:", error.status, error.message, error.type, error.code, error.param);
      if (error.status === 401) {
        userMessage = "Authentication with the AI service failed. (Invalid API Key)"; // Should be rare if env var is set
      } else if (error.status === 404) {
        userMessage = "Requested AI model or resource was not found. Please check the model name or endpoint.";
      } else if (error.status === 429) {
        userMessage = "Rate limit exceeded for the AI service. Please wait before trying again.";
      } else if (error.status >= 500) {
        userMessage = "The AI service is currently experiencing technical difficulties. Please try again later.";
      } else {
        userMessage = `An unexpected error occurred (${error.status}). Details: ${error.message.substring(0, 100)}...`;
      }
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      userMessage = "Could not connect to the AI service endpoint. Please check network connectivity.";
    }

    res.status(500).json({ text: userMessage, type: 'text' });
  }
}
