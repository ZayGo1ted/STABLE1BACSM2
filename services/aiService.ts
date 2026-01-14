
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { User } from '../types';
import { supabaseService } from './supabaseService';

interface AiResponse {
  text: string;
  resources?: any[];
  grounding?: any[];
  type: 'text' | 'image' | 'file';
}

/**
 * Utility to convert image URL to base64 for AI "Reading"
 */
async function imageUrlToBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64data = (reader.result as string).split(',')[1];
                resolve({ data: base64data, mimeType: blob.type });
            };
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.error("Failed to fetch image for AI analysis", e);
        return null;
    }
}

export const aiService = {
  askZay: async (userQuery: string, requestingUser: User | null): Promise<AiResponse> => {
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
      return { text: "System Error: API Key configuration missing.", type: 'text' };
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      
      const freshState = await supabaseService.fetchFullState();
      const lessons = freshState.lessons || [];
      const items = freshState.items || [];
      const subjects = freshState.subjects || [];

      // 1. Find relevant context first
      const queryLower = userQuery.toLowerCase();
      let targetLesson = lessons.find(l => 
        queryLower.includes(l.title.toLowerCase()) || 
        (l.keywords && l.keywords.some(k => queryLower.includes(k.toLowerCase())))
      );

      // 2. If a specific lesson is targeted, prepare its content for deep analysis
      let parts: any[] = [{ text: userQuery }];
      let lessonResourcesText = "";

      if (targetLesson) {
          const attachments = targetLesson.attachments || [];
          // Send image content directly to AI so it can "read" the papers/exercises
          for (const att of attachments) {
              if (att.type === 'image') {
                  const b64 = await imageUrlToBase64(att.url);
                  if (b64) {
                      parts.push({
                          inlineData: { data: b64.data, mimeType: b64.mimeType }
                      });
                  }
              }
          }
          lessonResourcesText = `[TARGET_LESSON_CONTENT] 
          Title: ${targetLesson.title}
          Description: ${targetLesson.description}
          Files Available: ${JSON.stringify(attachments.map(a => a.name))}
          `;
      }

      const lessonContext = lessons
        .filter(l => l.isPublished && l.id !== targetLesson?.id)
        .slice(0, 5) // Keep context manageable
        .map(l => `[OTHER_LESSON] TITLE:${l.title} | DESC:${l.description}`)
        .join('\n');

      const taskContext = items
        .map(i => `[DATABASE_HW_OR_TASK] TITLE:${i.title} | TYPE:${i.type} | DUE:${i.date} | NOTES:${i.notes}`)
        .join('\n');

      const userName = requestingUser?.name.split(' ')[0] || "Student";

      const systemInstruction = `
        You are Zay, the elite academic assistant for the 1Bac Science Math (SM) classroom.
        You are talking to ${userName}.

        **INTELLIGENCE RULES:**
        1. **RESUMES (SUMMARIES)**: When asked for a resume of a lesson, analyze the [TARGET_LESSON_CONTENT] and any images provided in the prompt. Create a professional academic summary with: 
           - Key Definitions
           - Critical Formulas (using proper math signs)
           - Core Methodology.
        2. **EXERCISES vs HOMEWORK**:
           - "Homework" (Devoirs/Tasks): Refers to specific teacher assignments in the [DATABASE_HW_OR_TASK] section.
           - "Exercises": Can mean either the database homework OR a new series you generate.
           - **Action**: If the user is unclear, ask: "Do you want the specific homework the teacher assigned in the database, or should I generate a new 'Série d'exercices' based on the lesson materials?"
        3. **READING CONTENT**: You have been provided with images of lesson papers. Analyze the text and diagrams in these images to answer questions or generate similar practice problems.
        4. **SEARCH**: Use Google Search for complex scientific proofs, logic paradoxes, or current academic standards.
        5. **FORMATTING**: Use high-quality Markdown. Use math symbols (Δ, ∑, ∫, √, →, ∀, ∃, ∈) and LaTeX-style bolding for vectors.

        **CONTEXT:**
        ${lessonResourcesText}
        ${taskContext}
        ${lessonContext}

        If you find a matching lesson, always include the file resources using: ATTACH_FILES::[JSON_ARRAY_OF_ATTACHMENTS]
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: { 
          systemInstruction, 
          temperature: 0.3,
          tools: [{ googleSearch: {} }]
        },
      });

      let text = (response.text || "").trim();
      let resources: any[] = [];
      const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

      if (text.includes("ATTACH_FILES::")) {
        const parts = text.split("ATTACH_FILES::");
        text = parts[0].trim();
        try {
            resources = JSON.parse(parts[1].trim());
        } catch (e) {
            console.error("AI resource parsing error");
        }
      }

      return { text, resources, grounding, type: 'text' };

    } catch (error) {
      console.error("AI Service Error:", error);
      return { text: "I'm having trouble analyzing the files right now. Please try again.", type: 'text' };
    }
  }
};
