import { GoogleGenAI, Type } from "@google/genai";
import { Subject, ExamType, Question } from "./types";
import { getLocalQuestions } from "./data/jee_dataset";
import { fetchJEEFromHuggingFace } from "./services/huggingFaceService";

// Standardizing model for complex Reasoning, Coding, and STEM (JEE preparation)
const MODEL_ID = "gemini-3-pro-preview";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Utility to extract and load-balance multiple API keys.
 * Expects process.env.API_KEY to be a single key or a comma-separated list.
 */
const getActiveApiKey = (): string => {
    const rawValue = process.env.API_KEY || '';
    if (!rawValue) return '';
    
    // Split by comma, trim whitespace, and remove empty entries
    const keys = rawValue.split(',').map(k => k.trim()).filter(k => k.length > 0);
    
    if (keys.length === 0) return '';
    
    // Load balancing: Randomly select a key from the pool to distribute traffic
    const randomIndex = Math.floor(Math.random() * keys.length);
    return keys[randomIndex];
};

// Helper to generate content using the SDK following guidelines
const safeGenerateContent = async (params: { model: string, contents: any, config?: any }): Promise<any> => {
    const apiKey = getActiveApiKey();
    
    if (!apiKey) {
        throw new Error("AI Generation Failed: No API Keys configured. Please set API_KEY in environment variables.");
    }

    try {
        // Create a new instance for every call to ensure we use the load-balanced key
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: params.model, 
            contents: params.contents,
            config: {
                ...params.config,
                // Add a random seed if not provided to increase output variance
                seed: params.config?.seed ?? Math.floor(Math.random() * 1000000)
            }
        });
        return response;
    } catch (e: any) {
        console.warn("Gemini API request failed:", e.message || e);
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
      
      // Inject unique entropy into the prompt to force the AI to vary its choices
      const entropy = Math.random().toString(36).substring(7);
      const prompt = `Act as a senior JEE coach. SessionID: ${entropy}. 
      Create ${count} ORIGINAL and UNIQUE ${subject} questions for ${type}. 
      Topics: ${topicFocus}. Difficulty: ${difficulty || 'JEE Advanced'}. 
      Do NOT repeat questions from previous sessions. Use LaTeX for all math formulas. 
      Ensure the JSON strictly follows the response schema.`;
      
      const response = await safeGenerateContent({
        model: MODEL_ID,
        contents: prompt,
        config: { 
          responseMimeType: "application/json", 
          responseSchema: questionSchema,
          temperature: 0.9 // Higher temperature for more creative/varied generation
        }
      });
      
      const text = response.text;
      if (text) {
          try {
              const data = JSON.parse(text);
              if (Array.isArray(data)) {
                  allQuestions.push(...data.map((q: any, i: number) => ({
                      ...q,
                      id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                      subject: q.subject || subject,
                      type: q.options ? 'MCQ' : 'Numerical',
                      markingScheme: q.markingScheme || (q.options ? { positive: 4, negative: 1 } : { positive: 4, negative: 0 })
                  })));
              }
          } catch (parseErr) {
              console.warn("[AI] Failed to parse JSON response, falling back.");
          }
      }
  } catch (e) {
      console.warn("[AI] Gemini generation failed or blocked, reverting to secondary sources.");
      // If the error is specifically about API keys, throw it so UI can show it
      if (e.message?.includes("API Keys")) throw e;
  }

  // --- ATTEMPT 2: HUGGING FACE DATASET ---
  if (allQuestions.length < count) {
      const needed = count - allQuestions.length;
      try {
          const hfQuestions = await fetchJEEFromHuggingFace(subject, needed);
          if (hfQuestions && hfQuestions.length > 0) {
              allQuestions.push(...hfQuestions);
          }
      } catch (e) {
          console.warn("[Dataset] HF fetch unsuccessful.");
      }
  }

  // --- ATTEMPT 3: LOCAL CACHE ---
  if (allQuestions.length < count) {
      const needed = count - allQuestions.length;
      const localQs = getLocalQuestions(subject, needed);
      allQuestions.push(...localQs);
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
    // Sequential generation for better stability
    const physics = await generateJEEQuestions(Subject.Physics, config.physics.mcq + config.physics.numerical, ExamType.Advanced, config.physics.chapters, 'Hard', [], config.physics);
    await delay(500); // Small delay between subjects to avoid simultaneous spikes on the same key pool
    const chemistry = await generateJEEQuestions(Subject.Chemistry, config.chemistry.mcq + config.chemistry.numerical, ExamType.Advanced, config.chemistry.chapters, 'Hard', [], config.chemistry);
    await delay(500);
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