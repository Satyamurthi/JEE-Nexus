
import { GoogleGenAI, Type } from "@google/genai";
import { Subject, ExamType, Question } from "./types";
import { getLocalQuestions } from "./data/jee_dataset";

// Standardizing model for complex Reasoning, Coding, and STEM (JEE preparation)
const MODEL_ID = "gemini-3-pro-preview";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- MULTI-KEY MANAGEMENT SYSTEM ---
const getAvailableKeys = (): string[] => {
    const keys: string[] = [];
    
    // 1. Check primary key (can be single or comma-separated)
    if (process.env.API_KEY) {
        if (process.env.API_KEY.includes(',')) {
            keys.push(...process.env.API_KEY.split(',').map(k => k.trim()).filter(k => k));
        } else {
            keys.push(process.env.API_KEY);
        }
    }

    // 2. Check auxiliary keys (API_KEY_1 to API_KEY_10)
    for (let i = 1; i <= 10; i++) {
        const k = process.env[`API_KEY_${i}`];
        if (k) keys.push(k);
    }

    // Remove duplicates
    return Array.from(new Set(keys));
};

const API_KEYS = getAvailableKeys();

// Helper to generate content with Key Rotation and Retry logic
const safeGenerateContent = async (params: { model: string, contents: any, config?: any }): Promise<any> => {
    if (API_KEYS.length === 0) {
        throw new Error("No API Keys configured. Please set API_KEY in environment variables.");
    }

    let lastError: any = null;
    
    // Try keys in a random order to distribute load initially, or sequential?
    // Sequential ensures we exhaust one key before moving, but random is better for avoiding 'thundering herd' on one key.
    // Let's copy the array and shuffle it for this request.
    const shuffledKeys = [...API_KEYS].sort(() => 0.5 - Math.random());

    for (const key of shuffledKeys) {
        try {
            const ai = new GoogleGenAI({ apiKey: key });
            const response = await ai.models.generateContent({
                model: params.model, 
                contents: params.contents,
                config: params.config
            });
            return response; // Success, return immediately
        } catch (e: any) {
            lastError = e;
            const msg = e.message || e.toString();
            
            // Check for specific errors where rotation makes sense (429, 500, Quota)
            // If it's a structural error (400), rotation won't help, but for robustness we try next anyway unless list exhausted.
            console.warn(`[Gemini] Key ending in ...${key.slice(-4)} failed: ${msg}. Switching keys...`);
            
            // Short delay before retrying with next key to prevent tight loops
            await delay(500); 
        }
    }

    // If we run out of keys
    console.error("[Gemini] All API keys exhausted or failed.");
    throw lastError || new Error("All API keys failed.");
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

  // --- ATTEMPT 1: MULTI-KEY GOOGLE GEMINI AI ---
  try {
      console.log(`[AI] Generating ${count} questions for ${subject} using Multi-Key Engine...`);
      const prompt = `Act as a senior JEE coach. Create ${count} original ${subject} questions for ${type}. Topics: ${topicFocus}. Difficulty: ${difficulty || 'JEE Advanced'}. Use LaTeX for all math formulas. Ensure the JSON strictly follows the response schema.`;
      
      const response = await safeGenerateContent({
        model: MODEL_ID,
        contents: prompt,
        config: { 
          responseMimeType: "application/json", 
          responseSchema: questionSchema,
          temperature: 0.7
        }
      });
      
      const text = response.text;
      if (text) {
          try {
              const data = JSON.parse(text);
              if (Array.isArray(data)) {
                  allQuestions.push(...data.map((q: any, i: number) => ({
                      ...q,
                      id: `ai-${Date.now()}-${i}`,
                      subject: q.subject || subject,
                      type: q.options ? 'MCQ' : 'Numerical',
                      markingScheme: q.markingScheme || (q.options ? { positive: 4, negative: 1 } : { positive: 4, negative: 0 })
                  })));
              }
          } catch (parseErr) {
              console.warn("[AI] Failed to parse JSON response.");
          }
      }
  } catch (e) {
      console.error("[AI] Gemini generation failed across all available keys.");
  }

  // --- FALLBACK: LOCAL CACHE ONLY (Dataset Removed) ---
  if (allQuestions.length < count) {
      const needed = count - allQuestions.length;
      console.log(`[Fallback] Fetching ${needed} from local archive.`);
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
    // Parallel generation is safer now with multiple keys, but sequential is still more robust against rate limits if keys are few.
    // We will use sequential to be safe.
    const physics = await generateJEEQuestions(Subject.Physics, config.physics.mcq + config.physics.numerical, ExamType.Advanced, config.physics.chapters, 'Hard', [], config.physics);
    await delay(500); 
    const chemistry = await generateJEEQuestions(Subject.Chemistry, config.chemistry.mcq + config.chemistry.numerical, ExamType.Advanced, config.chemistry.chapters, 'Hard', [], config.chemistry);
    await delay(500);
    const mathematics = await generateJEEQuestions(Subject.Mathematics, config.mathematics.mcq + config.mathematics.numerical, ExamType.Advanced, config.mathematics.chapters, 'Hard', [], config.mathematics);
    return { physics, chemistry, mathematics };
  } catch (error) {
    return {
        physics: getLocalQuestions(Subject.Physics, 10),
        chemistry: getLocalQuestions(Subject.Chemistry, 10),
        mathematics: getLocalQuestions(Subject.Mathematics, 10)
    };
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
