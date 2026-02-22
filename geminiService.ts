import { GoogleGenAI, Type } from "@google/genai";
import { Subject, ExamType, Question } from "./types";

// Standardizing model for complex Reasoning, Coding, and STEM (JEE preparation)
const MODEL_ID = "gemini-3-pro-preview";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Robust environment variable fetcher
 */
const getActiveApiKey = async (): Promise<string> => {
    // 1. Check if we have a key in environment (dev mode or injected)
    let key = process.env.API_KEY || import.meta.env.VITE_GEMINI_API_KEY || '';
    
    // 2. If no key, try to use the AI Studio selection flow
    if (!key && typeof window !== 'undefined' && (window as any).aistudio) {
        try {
            const hasKey = await (window as any).aistudio.hasSelectedApiKey();
            if (!hasKey) {
                await (window as any).aistudio.openSelectKey();
            }
            // After selection, try to read from process.env again (assuming platform injects it)
            // Or fallback to empty string and let the user retry
            key = process.env.API_KEY || '';
        } catch (e) {
            console.warn("AI Studio key selection failed:", e);
        }
    }
    
    return key;
};

// Helper to generate content using the SDK following guidelines
const safeGenerateContent = async (params: { model: string, contents: any, config?: any }): Promise<any> => {
    const apiKey = await getActiveApiKey();
    
    if (!apiKey) {
        throw new Error("AI Generation Failed: API_KEY is not configured. Please select an API Key.");
    }

    try {
        // Create a new instance for every call to ensure we use the load-balanced key
        const ai = new GoogleGenAI({ apiKey });
        
        // Enhance configuration for unique generation
        const response = await ai.models.generateContent({
            model: params.model, 
            contents: params.contents,
            config: {
                ...params.config,
                systemInstruction: "You are an expert JEE coach. Your goal is to generate HIGHLY UNIQUE, ORIGINAL, and concept-heavy problems. Do not provide common textbook problems. Use LaTeX for all math. Ensure output matches the exact JSON schema provided. The questions must be correctly formed and sufficient for JEE Advanced level.",
                temperature: 0.95, // High temperature for variety
                topP: 0.9,
                seed: params.config?.seed ?? Math.floor(Math.random() * 9999999)
            }
        });
        return response;
    } catch (e: any) {
        // Catch the specific error mentioned by the user for better debugging
        if (e.message?.includes("Requested entity was not found") || e.message?.includes("API key not valid")) {
            console.error("[Engine] Invalid API Key detected. Prompting user.");
            if (typeof window !== 'undefined' && (window as any).aistudio) {
                try {
                    await (window as any).aistudio.openSelectKey();
                    // Throw a specific error to tell the UI to retry
                    throw new Error("API Key updated. Please retry generation.");
                } catch (err) {
                    // Ignore selection error
                }
            }
        }
        throw e;
    }
};

const questionSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      subject: { type: Type.STRING },
      chapter: { type: Type.STRING },
      type: { type: Type.STRING },
      difficulty: { type: Type.STRING },
      statement: { type: Type.STRING },
      options: { type: Type.ARRAY, items: { type: Type.STRING } },
      correctAnswer: { type: Type.STRING },
      solution: { type: Type.STRING },
      explanation: { type: Type.STRING },
      concept: { type: Type.STRING },
      markingScheme: {
         type: Type.OBJECT,
         properties: { positive: { type: Type.INTEGER }, negative: { type: Type.INTEGER } }
      }
    },
    required: ["subject", "statement", "correctAnswer", "solution", "type"]
  }
};

export const generateJEEQuestions = async (subject: Subject, count: number, type: ExamType, chapters?: string[], difficulty?: string, topics?: string[], distribution?: { mcq: number, numerical: number }): Promise<Question[]> => {
  
  const allQuestions: Question[] = [];
  let totalMcqTarget = distribution ? distribution.mcq : Math.ceil(count * 0.8);
  let totalNumTarget = distribution ? distribution.numerical : count - totalMcqTarget;
  
  const isFullSyllabus = !chapters || chapters.length === 0;
  let topicFocus = isFullSyllabus ? "Full Syllabus" : `Chapters: ${chapters.join(', ')}`;

  // --- ATTEMPT 1: GOOGLE GEMINI AI ---
  try {
      console.log(`[AI] Generating ${count} unique questions for ${subject}...`);
      
      // Multi-layered entropy to force unique generation
      const sessionEntropy = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      
      const prompt = `BatchID: ${sessionEntropy}. 
      Generate ${count} COMPLETELY UNIQUE and NEVER-BEFORE-SEEN questions for ${subject} (${type} level). 
      Scope: ${topicFocus}. 
      Mandatory: Do NOT repeat problems from standard mock tests or previous batches. 
      Vary the parameters, numerical values, and conceptual combinations. 
      Use LaTeX for all formulas. 
      Strict JSON format.`;
      
      const response = await safeGenerateContent({
        model: MODEL_ID,
        contents: prompt,
        config: { 
          responseMimeType: "application/json", 
          responseSchema: questionSchema
        }
      });
      
      const text = response.text;
      if (text) {
          try {
              const data = JSON.parse(text);
              if (Array.isArray(data)) {
                  allQuestions.push(...data.map((q: any) => ({
                      ...q,
                      id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                      subject: q.subject || subject,
                      type: q.options ? 'MCQ' : 'Numerical',
                      markingScheme: q.markingScheme || (q.options ? { positive: 4, negative: 1 } : { positive: 4, negative: 0 })
                  })));
              }
          } catch (parseErr) {
              console.warn("[AI] JSON Parse Failure.");
          }
      }
  } catch (e: any) {
      console.error("[AI] Gemini failure:", e.message);
      throw e; // Fail fast if AI fails, as we are AI-only now
  }

  const finalMcqs = allQuestions.filter(q => q.type === 'MCQ').slice(0, totalMcqTarget);
  const finalNums = allQuestions.filter(q => q.type === 'Numerical').slice(0, totalNumTarget);

  return [...finalMcqs, ...finalNums];
};

export const getQuickHint = async (statement: string, subject: string): Promise<string> => {
  try {
    const response = await safeGenerateContent({ 
      model: MODEL_ID, 
      contents: `Provide a single-sentence strategic hint for this ${subject} question: ${statement.substring(0, 500)}` 
    });
    return response.text || "Focus on fundamental principles.";
  } catch (e) { return "Hint unavailable."; }
};

export const generateFullJEEDailyPaper = async (config: any): Promise<{ physics: Question[], chemistry: Question[], mathematics: Question[] }> => {
  try {
    // Distributed generation with random delays to avoid hitting same-key rate limits simultaneously
    const physics = await generateJEEQuestions(Subject.Physics, config.physics.mcq + config.physics.numerical, ExamType.Advanced, config.physics.chapters, 'Hard', [], config.physics);
    await delay(1000);
    const chemistry = await generateJEEQuestions(Subject.Chemistry, config.chemistry.mcq + config.chemistry.numerical, ExamType.Advanced, config.chemistry.chapters, 'Hard', [], config.chemistry);
    await delay(1000);
    const mathematics = await generateJEEQuestions(Subject.Mathematics, config.mathematics.mcq + config.mathematics.numerical, ExamType.Advanced, config.mathematics.chapters, 'Hard', [], config.mathematics);
    return { physics, chemistry, mathematics };
  } catch (error) {
    console.error("Full paper generation failed:", error);
    throw error;
  }
};

export const parseDocumentToQuestions = async (questionFile: File, solutionFile?: File): Promise<Question[]> => {
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = error => reject(error);
    });
  };

  try {
    const qData = await fileToBase64(questionFile);
    const parts: any[] = [{ inlineData: { mimeType: questionFile.type, data: qData } }];
    
    if (solutionFile) {
      const sData = await fileToBase64(solutionFile);
      parts.push({ inlineData: { mimeType: solutionFile.type, data: sData } });
    }

    const prompt = `Digitize and structure the JEE questions from these documents. Output a JSON array matching the schema. Use LaTeX for math.`;
    
    const response = await safeGenerateContent({ 
      model: MODEL_ID, 
      contents: { parts: [...parts, { text: prompt }] }, 
      config: { responseMimeType: "application/json", responseSchema: questionSchema } 
    });
    const text = response.text;
    if (!text) throw new Error("Parser response empty");
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error("Unexpected data structure");
    return data.map((q, idx) => ({ ...q, id: `parsed-${Date.now()}-${idx}` }));
  } catch (error) { 
    console.error("Document parsing failed:", error);
    throw error; 
  }
};

export const getDeepAnalysis = async (result: any) => {
    try {
        const response = await safeGenerateContent({ 
          model: MODEL_ID, 
          contents: `Review this JEE performance data and provide a mentorship summary including strong areas and critical improvements: ${JSON.stringify(result).substring(0, 8000)}` 
        });
        return response.text || "Analysis complete. Keep practicing consistent drills.";
    } catch (e) { 
        return "Cognitive analysis is temporarily unavailable due to a network disruption."; 
    }
};