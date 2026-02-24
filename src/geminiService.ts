import { GoogleGenAI, Type } from "@google/genai";
import { Subject, ExamType, Question } from "./types";

// Standardizing model for complex Reasoning, Coding, and STEM (JEE preparation)
const PRIMARY_MODEL = "gemini-3.1-pro-preview";
const FALLBACK_MODEL = "gemini-3-flash-preview"; // Fallback for rate limits

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Global key management
let keyPool: string[] = [];
let currentKeyIndex = 0;

const initializeKeyPool = async () => {
    if (keyPool.length > 0) return;

    // 1. Get raw string from env
    let rawKeys = process.env.API_KEY || import.meta.env.VITE_GEMINI_API_KEY || '';
    
    // 2. If no key, try to use the AI Studio selection flow
    if (!rawKeys && typeof window !== 'undefined' && (window as any).aistudio) {
        try {
            const hasKey = await (window as any).aistudio.hasSelectedApiKey();
            if (!hasKey) {
                await (window as any).aistudio.openSelectKey();
                console.log("API Key selected. Reloading...");
                window.location.reload();
                return;
            }
            // Try to read again, though likely requires reload
            rawKeys = process.env.API_KEY || '';
        } catch (e) {
            console.warn("AI Studio key selection failed:", e);
        }
    }

    // 3. Parse comma-separated keys
    if (rawKeys) {
        keyPool = rawKeys.split(',').map(k => k.trim()).filter(k => k.length > 0);
    }
};

const getNextKey = async (): Promise<string> => {
    await initializeKeyPool();
    if (keyPool.length === 0) return '';
    
    const key = keyPool[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % keyPool.length;
    return key;
};

// Helper to generate content using the SDK following guidelines
const safeGenerateContent = async (params: { model: string, contents: any, config?: any }): Promise<any> => {
    await initializeKeyPool();
    
    if (keyPool.length === 0) {
        throw new Error("AI Generation Failed: API_KEY is not configured. Please select an API Key.");
    }

    let lastError: any;
    // Try up to 3 times with different keys (or same key if pool is small)
    const maxRetries = Math.max(keyPool.length, 3); 
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const apiKey = await getNextKey();
        console.log(`[AI] Attempt ${attempt + 1}/${maxRetries} using Key: ${apiKey.substring(0, 8)}...`);

        try {
            const ai = new GoogleGenAI({ apiKey });
            
            // Determine model - use fallback if we've failed before on 429
            const modelToUse = (attempt > 0 && lastError?.status === 429) ? FALLBACK_MODEL : params.model;
            if (modelToUse !== params.model) console.log(`[AI] Switching to fallback model: ${modelToUse}`);

            const response = await ai.models.generateContent({
                model: modelToUse, 
                contents: params.contents,
                config: {
                    ...params.config,
                    systemInstruction: "You are an expert JEE coach. Your goal is to generate HIGHLY UNIQUE, ORIGINAL, and concept-heavy problems. Do not provide common textbook problems. Use LaTeX for all math. Ensure output matches the exact JSON schema provided. The questions must be correctly formed and sufficient for JEE Advanced level.",
                    temperature: 0.95,
                    topP: 0.9,
                    seed: params.config?.seed ?? Math.floor(Math.random() * 9999999)
                }
            });
            return response;
        } catch (e: any) {
            lastError = e;
            
            // Handle specific errors
            if (e.message?.includes("API key not valid") || e.status === 400) {
                console.warn(`[AI] Invalid Key: ${apiKey.substring(0, 8)}... rotating.`);
                continue; // Try next key
            }
            
            if (e.status === 429 || e.message?.includes("quota") || e.message?.includes("RESOURCE_EXHAUSTED")) {
                console.warn(`[AI] Rate Limit hit on Key: ${apiKey.substring(0, 8)}... rotating.`);
                await delay(1000); // Wait a bit before retry
                continue; // Try next key
            }

            // For other errors, throw immediately
            throw e;
        }
    }
    
    // If we exhausted all retries
    console.error("[AI] All keys/retries exhausted.");
    throw lastError;
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
      Generate EXACTLY ${count} COMPLETELY UNIQUE and NEVER-BEFORE-SEEN questions for ${subject} (${type} level). 
      DISTRIBUTION: You MUST generate exactly ${totalMcqTarget} Multiple Choice Questions (type: "MCQ") and exactly ${totalNumTarget} Numerical Value Questions (type: "Numerical").
      Scope: ${topicFocus}. 
      Mandatory: Do NOT repeat problems from standard mock tests or previous batches. 
      Vary the parameters, numerical values, and conceptual combinations. 
      Use LaTeX for all formulas. 
      Strict JSON format.`;
      
      const response = await safeGenerateContent({
        model: PRIMARY_MODEL,
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
                      type: (q.type === 'Numerical' || !q.options || q.options.length === 0) ? 'Numerical' : 'MCQ',
                      markingScheme: q.markingScheme || ((q.type === 'Numerical' || !q.options || q.options.length === 0) ? { positive: 4, negative: 0 } : { positive: 4, negative: 1 })
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

  // Pad with placeholders if AI generated fewer questions to prevent layout/order breaking
  while (finalMcqs.length < totalMcqTarget) {
      finalMcqs.push({
          id: `fallback-mcq-${Date.now()}-${Math.random()}`,
          subject,
          chapter: "General",
          type: "MCQ",
          difficulty: "Medium",
          statement: "Placeholder Question: The AI failed to generate enough questions for this section. Please skip or mark for review.",
          options: ["A", "B", "C", "D"],
          correctAnswer: "A",
          solution: "Placeholder",
          explanation: "Placeholder",
          concept: "Placeholder",
          markingScheme: { positive: 4, negative: 1 }
      });
  }

  while (finalNums.length < totalNumTarget) {
      finalNums.push({
          id: `fallback-num-${Date.now()}-${Math.random()}`,
          subject,
          chapter: "General",
          type: "Numerical",
          difficulty: "Medium",
          statement: "Placeholder Question: The AI failed to generate enough numerical questions for this section. Please skip or mark for review.",
          options: [],
          correctAnswer: "0",
          solution: "Placeholder",
          explanation: "Placeholder",
          concept: "Placeholder",
          markingScheme: { positive: 4, negative: 0 }
      });
  }

  return [...finalMcqs, ...finalNums];
};

export const getQuickHint = async (statement: string, subject: string): Promise<string> => {
  try {
    const response = await safeGenerateContent({ 
      model: PRIMARY_MODEL, 
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
      model: PRIMARY_MODEL, 
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
          model: PRIMARY_MODEL, 
          contents: `Review this JEE performance data and provide a mentorship summary including strong areas and critical improvements: ${JSON.stringify(result).substring(0, 8000)}` 
        });
        return response.text || "Analysis complete. Keep practicing consistent drills.";
    } catch (e) { 
        return "Cognitive analysis is temporarily unavailable due to a network disruption."; 
    }
};