
import { GoogleGenAI } from "@google/genai";
import { User } from '../types';
import { supabaseService } from './supabaseService';

interface AiResponse {
  text: string;
  resources?: any[];
  grounding?: any[];
  type: 'text' | 'image' | 'file';
}

export const aiService = {
  askZay: async (userQuery: string, requestingUser: User | null): Promise<AiResponse> => {
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
      console.error("CRITICAL: API_KEY is undefined.");
      return { text: "System Error: API Key configuration missing.", type: 'text' };
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      
      const freshState = await supabaseService.fetchFullState();
      const lessons = freshState.lessons || [];
      const items = freshState.items || [];
      const subjects = freshState.subjects || [];

      // Build context for Lessons (Library)
      const lessonContext = lessons
        .filter(l => l.isPublished)
        .map(l => {
          const subject = subjects.find(s => s.id === l.subjectId)?.name.en || 'General';
          const attachmentsJson = (l.attachments || []).map(a => ({
            name: a.name,
            url: a.url,
            type: a.type
          }));
          return `[LESSON] ID:${l.id} | TITLE:${l.title} | SUBJ:${subject} | DESC:${l.description} | RESOURCES:${JSON.stringify(attachmentsJson)}`;
        })
        .join('\n');

      // Build context for Academic Items (Homework/Exams/Tasks)
      const taskContext = items
        .map(i => {
          const subject = subjects.find(s => s.id === i.subjectId)?.name.en || 'General';
          return `[TASK/HW] ID:${i.id} | TYPE:${i.type} | TITLE:${i.title} | SUBJ:${subject} | DUE:${i.date} | NOTES:${i.notes}`;
        })
        .join('\n');

      const userName = requestingUser?.name.split(' ')[0] || "Student";

      const systemInstruction = `
        You are Zay, the smart academic assistant for the 1Bac Science Math (SM) classroom. 
        You are talking to ${userName}.

        **DATABASE CONTEXT:**
        --- LESSONS IN LIBRARY ---
        ${lessonContext || "NO_LESSONS"}
        
        --- TEACHER TASKS/HOMEWORKS ---
        ${taskContext || "NO_TASKS"}

        **CORE CAPABILITIES & LOGIC:**
        1. **RESUMES (SUMMARIES)**: If asked for a "resume" or summary of a lesson, analyze the description and metadata provided. Generate a structured summary with Key Concepts, Formulas, and Definitions.
        2. **EXERCISES**: 
           - If the user asks for "exercises" or "série d'exercices", you must clarify if they want:
             a) A NEW AI-generated series (based on lesson resources).
             b) The specific homework/tasks the teacher already assigned in the database.
           - If you have enough info, provide the relevant database tasks OR generate a new series using Science Math level difficulty.
        3. **SMART RESPONSES**: You have access to Google Search. Use it for complex scientific queries or current events.
        4. **FORMATTING**: 
           - Use standard academic Markdown.
           - Use math signs (Δ, ∑, ∫, √, subscripts/superscripts) correctly.
           - NO weird ascii/glitch signs.
           - Max 1 emoji.
        5. **MISSING DATA**: If you can't find anything relevant in the database to answer a specific question about the class, reply: "REPORT_MISSING".

        **ATTACHING FILES**:
        When mentioning a lesson from the database, append: ATTACH_FILES::[JSON_RESOURCES_HERE]
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userQuery,
        config: { 
          systemInstruction, 
          temperature: 0.3,
          tools: [{ googleSearch: {} }]
        },
      });

      let text = (response.text || "").trim();
      let resources: any[] = [];
      const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

      if (text.includes("REPORT_MISSING")) {
        if (requestingUser) await supabaseService.createAiLog(requestingUser.id, userQuery);
        return { text: `I couldn't find that specific data in our classroom hub, ${userName}. I've reported this to the admin!`, type: 'text' };
      }

      if (text.includes("ATTACH_FILES::")) {
        const parts = text.split("ATTACH_FILES::");
        text = parts[0].trim();
        try {
            resources = JSON.parse(parts[1].trim());
        } catch (e) {
            console.error("AI returned malformed JSON for resources");
        }
      }

      return { text, resources, grounding, type: 'text' };

    } catch (error) {
      console.error("AI Service Error:", error);
      return { text: "Connection error. Please check your internet or try again.", type: 'text' };
    }
  }
};
