
import { GoogleGenAI, Type } from "@google/genai";
import { Subject, ExamType, Question } from "./types";

// Standardizing model for complex Reasoning, Coding, and STEM (JEE preparation)
const MODEL_ID = "gemini-3-pro-preview";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- MULTI-KEY MANAGEMENT SYSTEM ---
// This system rotates keys to bypass the RPM (Requests Per Minute) limits of the free tier.
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
    
    // Shuffle keys to distribute load evenly across the pool
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
            const isRateLimit = msg.includes('429') || msg.includes('Quota') || msg.includes('Resource has been exhausted');
            
            if (isRateLimit) {
                console.warn(`[Gemini] Key ending in ...${key.slice(-4)} exhausted. Rotating to next key...`);
            } else {
                console.warn(`[Gemini] Key ending in ...${key.slice(-4)} error: ${msg}. Retrying...`);
            }
            
            // Short delay before retrying with next key to prevent tight loops
            await delay(500); 
        }
    }

    // If we run out of keys
    console.error("[Gemini] All API keys exhausted or failed. Please add more keys to 'API_KEY' in .env to increase RPM limits.");
    throw lastError || new Error("All API keys failed due to Rate Limits or Network issues.");
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
  
  const isFullSyllabus = !chapters || chapters.length === 0;
  let topicFocus = isFullSyllabus ? "Full Syllabus" : `Chapters: ${chapters.join(', ')}`;
  if (topics && topics.length > 0) topicFocus += `, Topics: ${topics.join(', ')}`;

  // --- ATTEMPT: MULTI-KEY GOOGLE GEMINI AI ONLY ---
  try {
      console.log(`[AI] Generating ${count} questions for ${subject} using Multi-Key Engine...`);
      const prompt = `Act as a senior JEE coach. Create ${count} original ${subject} questions for ${type}. 
      Focus on: ${topicFocus}. 
      Difficulty Level: ${difficulty || 'JEE Advanced'}. 
      Distribution: Approx ${distribution?.mcq || '80%'} MCQs and ${distribution?.numerical || '20%'} Numerical Value Type.
      Use LaTeX for all math formulas (e.g. $x^2$). 
      Ensure the JSON strictly follows the response schema. 
      IMPORTANT: Unique, high-quality questions only.`;
      
      const response = await safeGenerateContent({
        model: MODEL_ID,
        contents: prompt,
        config: { 
          responseMimeType: "application/json", 
          responseSchema: questionSchema,
          temperature: 0.8 // Slightly higher creativity for unique questions
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
                      type: (q.options && q.options.length > 0) ? 'MCQ' : 'Numerical',
                      markingScheme: q.markingScheme || ((q.options && q.options.length > 0) ? { positive: 4, negative: 1 } : { positive: 4, negative: 0 })
                  })));
              }
          } catch (parseErr) {
              console.warn("[AI] Failed to parse JSON response.", parseErr);
          }
      }
  } catch (e: any) {
      console.error(`[AI] Generation failed for ${subject}:`, e.message);
      // We explicitly throw here so the UI knows we failed to generate anything
      throw new Error(`AI Generation Failed: ${e.message}`);
  }

  // --- STRICT AI POLICY: No Local Fallback ---
  if (allQuestions.length === 0) {
      throw new Error("AI returned 0 questions. The Rate Limit may have been reached across all keys.");
  }

  // Slice to exact requirements if AI over-generated
  let finalQuestions = allQuestions;
  if (distribution) {
      const mcqs = allQuestions.filter(q => q.type === 'MCQ');
      const nums = allQuestions.filter(q => q.type === 'Numerical');
      
      // If we don't have enough of a specific type, fill with whatever we have to avoid empty set
      const neededMcq = distribution.mcq;
      const neededNum = distribution.numerical;
      
      finalQuestions = [...mcqs.slice(0, neededMcq), ...nums.slice(0, neededNum)];
      
      // If still short, fill from remaining
      if (finalQuestions.length < count) {
          const remaining = allQuestions.filter(q => !finalQuestions.includes(q));
          finalQuestions.push(...remaining.slice(0, count - finalQuestions.length));
      }
  } else {
      finalQuestions = allQuestions.slice(0, count);
  }

  return finalQuestions;
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
    // Sequential generation to avoid hitting concurrency limits if using single key, 
    // but with Multi-Key, this is safer. Sequential is still more robust for long tasks.
    const physics = await generateJEEQuestions(Subject.Physics, config.physics.mcq + config.physics.numerical, ExamType.Advanced, config.physics.chapters, 'Hard', [], config.physics);
    await delay(1000); 
    const chemistry = await generateJEEQuestions(Subject.Chemistry, config.chemistry.mcq + config.chemistry.numerical, ExamType.Advanced, config.chemistry.chapters, 'Hard', [], config.chemistry);
    await delay(1000);
    const mathematics = await generateJEEQuestions(Subject.Mathematics, config.mathematics.mcq + config.mathematics.numerical, ExamType.Advanced, config.mathematics.chapters, 'Hard', [], config.mathematics);
    
    return { physics, chemistry, mathematics };
  } catch (error) {
    console.error("Daily Paper Generation Failed:", error);
    // Return empty so Admin UI shows failure instead of fake data
    return { physics: [], chemistry: [], mathematics: [] };
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
