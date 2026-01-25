// api/askZay.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// --- INLINED CONSTANTS.TSX ---
const ZAY_USER_ID = '00000000-0000-0000-0000-000000000001';

// --- INLINED TYPES.TS (Simplified for API route) ---
interface User {
  id: string;
  email: string;
  name: string;
  role: 'DEV' | 'ADMIN' | 'STUDENT';
}
interface ChatMessage {
  id: string;
  userId: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'audio';
  mediaUrl?: string; // For potential future handling of user media
}
interface LessonAttachment {
  name: string;
  url: string;
  type: 'file' | 'image' | 'video';
}
interface Lesson {
  id: string;
  title: string;
  subjectId: string;
  type: string; // 'lesson' | 'summary' | etc.
  description: string; // Main content/summary text
  attachments: LessonAttachment[];
  date: string;
  // ... other fields as needed
}

// --- INLINED SUPABASE SERVICE LOGIC ---
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Use service key for full access

let supabaseInstance: SupabaseClient | null = null;
const getSupabase = () => {
  if (!supabaseInstance) {
    // Use service role key for backend access
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  }
  return supabaseInstance;
};

const fetchLessons = async () => {
  const client = getSupabase();
  const { data: lessons, error } = await client
    .from('lessons')
    .select('id, title, subject_id, type, description, attachments, date_written')
    .eq('is_published', true);

  if (error) {
    console.error("Error fetching lessons from Supabase:", error);
    return [];
  }
  return lessons || [];
};

// --- MAIN HANDLER ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Validate Request Method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 2. Get Environment Variables
  const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
  if (!NVIDIA_API_KEY) {
    console.error("NVIDIA_API_KEY is not set in environment variables.");
    return res.status(500).json({ error: "Server configuration error." });
  }

  // Example NVIDIA NIM endpoint (replace with your actual one)
  const NVIDIA_NIM_ENDPOINT = "https://integrate.api.nvidia.com/v1/granite-345b-code-instruct"; // Hypothetical endpoint


  // 3. Extract Data from Request Body
  const { userQuery, requestingUser, history }: { userQuery: string; requestingUser: User; history: ChatMessage[] } = req.body;

  if (!userQuery) {
    return res.status(400).json({ error: "Missing userQuery in request body." });
  }

  try {
    // 4. Fetch Latest Data from Supabase
    const hubLessons = await fetchLessons();

    // 5. Prepare Structured Context for the LLM
    //    a. Hub Library Knowledge Base
    const hubKnowledgeBase = hubLessons.map(lesson => ({
      id: lesson.id,
      title: lesson.title,
      subjectId: lesson.subject_id,
      type: lesson.type,
      summary: lesson.description,
      date: lesson.date_written,
      // Potentially include key points extracted from description if needed
    }));

    //    b. Conversation History (Sanitized)
    const sanitizedHistory = (history || []).slice(-10).map(msg => ({
      role: (msg.userId === ZAY_USER_ID || msg.content.startsWith(":::AI_RESPONSE:::")) ? 'assistant' : 'user',
      content: msg.content.replace(":::AI_RESPONSE:::", "").trim() // Remove prefix if present
    }));

    // 6. Construct the Prompt for NVIDIA LLM
    //    The prompt is designed to be explicit and guide the model's behavior.
    const systemPrompt = `
[SYSTEM]
You are Zay, the official AI Diagnostic Assistant for 1BacSM students.
Model: Granite-345B-Instruct (or your chosen powerful NVIDIA model).

RULES & PERSONALITY:
1. LANGUAGE: Always respond fluently in the language the user uses. If they write in French, reply in French. If in English, reply in English. Crucially, if they use Moroccan Darija (Colloquial Arabic), you MUST respond in fluent, natural Moroccan Darija. Understand Darija nuances perfectly.
2. TONE: Be helpful, smart, concise, and peer-like. Avoid overly formal or technical jargon unless explaining a concept requires it.
3. MEMORY: You have access to the conversation history. Use it to maintain context.
4. SUBJECT MATTER EXPERTISE: You are an expert in 1Bac Science Math curriculum:
   - Mathematics (Logic, Sets, Functions, Sequences, Limits, Derivatives, Statistics)
   - Physics & Chemistry (Mechanics, Thermodynamics, Waves, Optics, Atomic Physics, Stoichiometry, Redox)
   - Biology (Cell Biology, Genetics, Evolution, Ecology)
   - Other subjects as per the curriculum.
5. DATABASE INTEGRATION:
   - You have access to a knowledge base called 'HUB_LIBRARY'.
   - When asked about a topic, actively search the HUB_LIBRARY for relevant lessons or summaries.
   - If you find a match, ALWAYS respond with the lesson title and provide a summary from its description.
   - To signal that you are referencing a lesson, wrap the lesson title like this: [[LESSON_TITLE_HERE]].
   - To provide downloadable attachments from that lesson, use this exact JSON tag structure at the END of your response:
     [ATTACH_RESOURCES: [{"name": "Attachment Name 1", "url": "https://link.to.file1", "type": "image"}, {"name": "Attachment Name 2", "url": "https://link.to.file2", "type": "file"}]]
     - Only include attachments from the matched lesson in the HUB_LIBRARY.
     - Do NOT fabricate attachment links.
6. DIAGNOSTIC CAPABILITY:
   - Carefully analyze user questions, especially those involving calculations or problem-solving steps.
   - If you identify a logical or mathematical error, point it out politely and clearly.
   - Prefix such diagnostic alerts with exactly this flag: [DIAGNOSTIC ALERT].
7. OUTPUT FORMAT:
   - Prioritize clarity and correctness.
   - Use Markdown for simple formatting (bold, lists) if needed, but avoid complex structures.
   - NEVER mention being an AI, using APIs, or referring to internal databases explicitly to the user.

CONTEXTUAL DATA:
[HUB_LIBRARY]
${JSON.stringify(hubKnowledgeBase, null, 2)}

[STUDENT]
Name: ${requestingUser?.name || 'Student'}

[END SYSTEM]
`;

    // 7. Prepare Messages Array for NVIDIA API
    const messages = [
      { role: "system", content: systemPrompt.trim() },
      ...sanitizedHistory,
      { role: "user", content: userQuery.trim() }
    ];

    console.log("Sending messages to NVIDIA NIM:", JSON.stringify(messages, null, 2)); // Debugging

    // 8. Call NVIDIA NIM API Directly
    const nvidiaResponse = await fetch(NVIDIA_NIM_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NVIDIA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "granite-345b-code-instruct", // Specify the model if needed by endpoint
        messages: messages,
        // Adjust parameters for reasoning and output
        temperature: 0.4, // Lower temp for more focused, factual answers
        top_p: 0.95,
        max_tokens: 2048, // Allow longer, detailed responses
        stream: false,
        // Optional: Enable grounding/retrieval if supported by the specific NIM/model
        // retrieval: { ... } // Check NVIDIA NIM docs for specifics
      }),
    });

    if (!nvidiaResponse.ok) {
      const errorText = await nvidiaResponse.text();
      console.error(`NVIDIA NIM API Error (${nvidiaResponse.status}):`, errorText);
      throw new Error(`NVIDIA NIM request failed: ${nvidiaResponse.statusText}`);
    }

    const nvidiaData = await nvidiaResponse.json();
    console.log("Raw response from NVIDIA NIM:", JSON.stringify(nvidiaData, null, 2)); // Debugging

    // 9. Extract Text Response
    //    The path might vary depending on the specific NIM/model output format.
    //    Common paths are data.choices[0].message.content or similar.
    let rawText = "";
    try {
        // Standard OpenAI-like completion format
        if (nvidiaData.choices && nvidiaData.choices[0] && nvidiaData.choices[0].message) {
            rawText = nvidiaData.choices[0].message.content?.trim() || "";
        }
        // Alternative format sometimes seen
        else if (nvidiaData.data && nvidiaData.data[0]) {
             rawText = nvidiaData.data[0]?.text?.trim() || "";
        }
        // Add checks for other potential formats based on NIM docs
        else {
            console.warn("Unexpected response format from NVIDIA NIM:", nvidiaData);
            rawText = nvidiaData.text || nvidiaData.message || JSON.stringify(nvidiaData); // Fallback
        }
    } catch (parseErr) {
        console.error("Error extracting text from NVIDIA response:", parseErr, nvidiaData);
        rawText = "Zay received a complex response and needs a moment to process it.";
    }

    if (!rawText) {
        throw new Error("Received empty text from NVIDIA NIM.");
    }

    // 10. Parse Custom Tags (Resources, Lesson References)
    let finalText = rawText;
    let resources: LessonAttachment[] = [];
    let isErrorDetection = false;
    let referencedLessons: string[] = []; // Track lesson titles mentioned

    // Check for Diagnostic Alert
    if (finalText.includes("[DIAGNOSTIC ALERT]")) {
        isErrorDetection = true;
    }

    // Extract ATTACH_RESOURCES tag
    const resourceTagMatch = finalText.match(/\[ATTACH_RESOURCES:\s*(\[[\s\S]*?\])\s*\]/i);
    if (resourceTagMatch) {
        try {
            const resourceJsonString = resourceTagMatch[1];
            resources = JSON.parse(resourceJsonString);
            // Remove the tag from the final text shown to the user
            finalText = finalText.replace(resourceTagMatch[0], '').trim();
        } catch (parseError) {
            console.error("Error parsing ATTACH_RESOURCES JSON:", parseError, resourceTagMatch?.[1]);
            // Don't fail completely, just don't attach resources
        }
    }

    // Extract LESSON_TITLE references (for potential future enhancements or logging)
    const lessonRefMatches = finalText.matchAll(/\[\[(.*?)\]\]/g);
    for (const match of lessonRefMatches) {
        if (match[1]) referencedLessons.push(match[1]);
    }
    // Optionally remove the double brackets for cleaner display, or leave them if you want to highlight lessons
    // finalText = finalText.replace(/\[\[(.*?)\]\]/g, '$1');


    // 11. Determine Response Type
    let responseType = 'text';
    if (resources.length > 0 || isErrorDetection) {
        responseType = 'file'; // Signal frontend there are attachments or diagnostics
    }


    // 12. Send Response Back to Frontend
    return res.status(200).json({
      text: finalText,
      resources: resources, // Array of {name, url, type}
      // If NVIDIA NIM provides grounding/chunks, pass them along
      // grounding: nvidiaData.usage?.grounding_chunks || [], // Placeholder - check actual NIM response
      grounding: [], // Implement if NIM supports it
      type: responseType,
      isErrorDetection: isErrorDetection,
      // referencedLessons: referencedLessons // Optional: send back for frontend logic
    });

  } catch (error: any) {
    console.error("Critical Error in Zay API Handler:", error);
    // Send a generic error message to the frontend
    res.status(500).json({
      error: "Zay is currently unavailable. Please try again later.",
      text: "Zay is currently unavailable. Please try again later.",
      resources: [],
      grounding: [],
      type: 'text',
      isErrorDetection: false
    });
  }
}
