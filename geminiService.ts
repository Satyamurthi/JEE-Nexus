
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { Subject, ExamType, Question, QuestionType, Difficulty } from "./types";
import { NCERT_CHAPTERS } from "./constants";
import { getLocalQuestions } from "./data/jee_dataset"; // Import fallback dataset

// Configuration Defaults
const getModelConfig = () => {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem('nexus_model_config') || '{}');
  } catch (e) { return {}; }
};

const config = getModelConfig();
const PROVIDER = config.provider || 'google'; 
const BASE_URL = config.baseUrl || '';

// Primary Model: gemini-2.0-flash (Stable, Fast)
const MODEL_ID = config.modelId || config.genModel || "gemini-2.0-flash"; 
const VISION_MODEL = config.visionModel || "gemini-2.0-flash"; 
const ANALYSIS_MODEL = config.analysisModel || "gemini-2.0-flash";

// Global Rate Limiter
let lastRequestTimestamp = 0;
const MIN_GLOBAL_REQUEST_INTERVAL = 3000; // Minimum 3s between ANY request globally

const enforceGlobalThrottle = async () => {
    const now = Date.now();
    const timeSinceLast = now - lastRequestTimestamp;
    if (timeSinceLast < MIN_GLOBAL_REQUEST_INTERVAL) {
        await new Promise(resolve => setTimeout(resolve, MIN_GLOBAL_REQUEST_INTERVAL - timeSinceLast));
    }
    lastRequestTimestamp = Date.now();
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

/**
 * Robust JSON Cleaner & Repairer
 */
const cleanAndParseJSON = (text: string) => {
  if (!text) return null;
  
  let cleanText = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
  cleanText = cleanText.replace(/\/\/.*$/gm, ''); // Remove single line comments
  
  const firstOpenBrace = cleanText.indexOf('{');
  const firstOpenBracket = cleanText.indexOf('[');
  
  let startIdx = -1;
  if (firstOpenBrace !== -1 && firstOpenBracket !== -1) {
     startIdx = Math.min(firstOpenBrace, firstOpenBracket);
  } else if (firstOpenBrace !== -1) {
     startIdx = firstOpenBrace;
  } else if (firstOpenBracket !== -1) {
     startIdx = firstOpenBracket;
  }
  
  if (startIdx === -1) return null;

  cleanText = cleanText.substring(startIdx);
  
  const lastCloseBrace = cleanText.lastIndexOf('}');
  const lastCloseBracket = cleanText.lastIndexOf(']');
  const endIdx = Math.max(lastCloseBrace, lastCloseBracket);
  
  if (endIdx !== -1) {
      cleanText = cleanText.substring(0, endIdx + 1);
  }

  try {
    return JSON.parse(cleanText);
  } catch (e) {
    // Continue to aggressive repair
  }

  try {
    // Fallback: If truncation is suspected (common with Math output), try to close the array
    if (cleanText.trim().endsWith(',')) cleanText = cleanText.trim().slice(0, -1);
    if (!cleanText.trim().endsWith(']')) cleanText += ']';
    return JSON.parse(cleanText); 
  } catch (repairError: any) {
    console.error("JSON Repair Failed:", repairError.message);
    return null;
  }
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const API_KEY_POOL: string[] = [];

const getAvailableApiKeys = (): string[] => {
  const keys = [...API_KEY_POOL];
  const parseEnvList = (envVal: string | undefined) => {
    if (!envVal) return [];
    return envVal.split(',').map(k => k.trim()).filter(k => k);
  };

  if (typeof window !== 'undefined') {
      try {
          const localConfig = JSON.parse(localStorage.getItem('nexus_api_config') || '{}');
          if (localConfig.geminiApiKey) keys.unshift(...parseEnvList(localConfig.geminiApiKey));
      } catch(e) {}
  }

  if (typeof process !== 'undefined' && process.env) {
    if (process.env.API_KEY) keys.unshift(...parseEnvList(process.env.API_KEY));
    if (process.env.REACT_APP_API_KEY) keys.unshift(...parseEnvList(process.env.REACT_APP_API_KEY));
  }
  
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    const env = (import.meta as any).env;
    if (env.VITE_API_KEY) keys.unshift(...parseEnvList(env.VITE_API_KEY));
    if (env.API_KEY) keys.unshift(...parseEnvList(env.API_KEY));
  }

  return Array.from(new Set(keys)).filter(k => !!k);
};

const safeGenerateContent = async (params: any, retries = 2, initialDelay = 5000, keyOffset = 0): Promise<any> => {
    await enforceGlobalThrottle();

    try {
        const keys = getAvailableApiKeys();
        
        // --- HYBRID FALLBACK MECHANISM ---
        // If no API keys are present, throw specific error to trigger local fallback
        if (keys.length === 0) {
            throw new Error("NO_API_KEYS"); 
        }
        
        const activeKey = keys[keyOffset % keys.length];
        const ai = new GoogleGenAI({ apiKey: activeKey });
        
        // Intelligent Model Fallback Strategy
        let effectiveModel = params.model;
        if (params.model.includes('gemini-2.0-flash') && retries <= 1) {
            effectiveModel = 'gemini-1.5-flash';
        }

        return await ai.models.generateContent({
            model: effectiveModel, 
            contents: params.contents,
            config: params.config
        });
    } catch (e: any) {
        console.warn(`GenAI Error (${params.model}):`, e.message || e);
        
        // Critical: Detect Quota Exhaustion OR Network Failure
        const isRateLimit = e.message?.includes('429') || e.status === 429 || e.status === 403 || e.message?.includes('Quota exceeded');
        const isNetworkError = e.message?.includes('Failed to fetch') || e.message?.includes('NetworkError') || e.message?.includes('Load failed');
        
        if (isNetworkError) {
             // If network is failing, don't retry endlessly, switch to offline fallback immediately
             throw new Error("NETWORK_FAILURE");
        }

        if (isRateLimit) {
            // Immediate fallback if we have retried enough or if it's a strict 429
            if (retries <= 0) {
                throw new Error("QUOTA_EXCEEDED"); // Custom signal to trigger local fallback
            }
            
            let waitTime = Math.max(initialDelay * 2, 5000); 
            console.log(`[Rate Limit] Switching key & Pausing for ${Math.round(waitTime/1000)}s...`);
            await delay(waitTime);
            return safeGenerateContent(params, retries - 1, waitTime, keyOffset + 1);
        }
        
        if (retries > 0) {
             await delay(initialDelay);
             return safeGenerateContent(params, retries - 1, initialDelay * 2, keyOffset);
        }
        throw e;
    }
};

const extractText = (response: any): string => {
    try {
        if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
            return response.candidates[0].content.parts.map((p: any) => p.text).join('') || '';
        }
        return response.text || '';
    } catch (e) { return ''; }
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

export const getQuickHint = async (statement: string, subject: string): Promise<string> => {
  try {
    const response = await safeGenerateContent({
      model: MODEL_ID, 
      contents: `Hint for ${subject}: ${statement.substring(0, 300)}...`
    });
    return extractText(response) || "Review concepts.";
  } catch (e) { return "Hint unavailable."; }
};

export const refineQuestionText = async (text: string): Promise<string> => {
  return text; 
};

const generateQuestionBatch = async (subject: Subject, batchMcqCount: number, batchNumCount: number, type: ExamType, topicFocus: string): Promise<Question[]> => {
  const count = batchMcqCount + batchNumCount;
  if (count === 0) return [];

  const prompt = `
    Create ${count} unique ${subject} questions for ${type}.
    Distribution: ${batchMcqCount} MCQs (4 options), ${batchNumCount} Numericals.
    Topics: ${topicFocus}. Difficulty: Hard/Advanced.
    Use LaTeX for Math ($...$). Return ONLY a JSON Array.
    JSON Keys: subject, chapter, type, difficulty, statement, options (for MCQ), correctAnswer, solution, explanation, concept.
  `;

  try {
    const response = await safeGenerateContent({
      model: MODEL_ID,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: questionSchema,
      }
    });
    const data = cleanAndParseJSON(extractText(response));
    const rawList = Array.isArray(data) ? data : [];
    
    const validMcqs: any[] = [];
    const validNums: any[] = [];
    
    rawList.forEach((q: any) => {
        const hasValidOptions = Array.isArray(q.options) && q.options.length >= 2;
        if (hasValidOptions) {
            q.type = 'MCQ';
            validMcqs.push(q);
        } else {
            q.type = 'Numerical';
            q.options = []; 
            validNums.push(q);
        }
    });

    const finalMcqs = validMcqs.slice(0, batchMcqCount);
    const finalNums = validNums.slice(0, batchNumCount);

    return [...finalMcqs, ...finalNums]
        .filter((q: any) => q && typeof q === 'object')
        .map((q: any, i: number) => {
            const defaultMarking = q.type === 'MCQ' ? { positive: 4, negative: 1 } : { positive: 4, negative: 0 };
            const safeMarkingScheme = (q.markingScheme && typeof q.markingScheme === 'object' && typeof q.markingScheme.positive === 'number')
                ? q.markingScheme
                : defaultMarking;

            return {
                id: q.id || `gen-${Date.now()}-${i}-${Math.random().toString(36).substring(7)}`,
                subject: q.subject || subject,
                chapter: q.chapter || 'General',
                type: q.type, 
                difficulty: q.difficulty || 'Hard',
                statement: q.statement || 'Question generation failed.',
                options: q.options || [],
                correctAnswer: q.correctAnswer || '',
                solution: q.solution || '',
                explanation: q.explanation || '',
                concept: q.concept || '',
                markingScheme: safeMarkingScheme
            };
    });
  } catch (error: any) {
    if (error.message === "QUOTA_EXCEEDED" || error.message === "NO_API_KEYS" || error.message === "NETWORK_FAILURE") {
        throw error; // Re-throw to be caught by the main loop fallback
    }
    console.error(`Batch Gen Failed:`, error);
    return [];
  }
};

export const generateJEEQuestions = async (subject: Subject, count: number, type: ExamType, chapters?: string[], difficulty?: string | Difficulty, topics?: string[], distribution?: { mcq: number, numerical: number }): Promise<Question[]> => {
  
  // --- OFFLINE FALLBACK MECHANISM ---
  const useFallback = async () => {
      console.warn(`[Fallback] Serving offline questions for ${subject}`);
      await delay(1500); // Simulate network delay for UX consistency
      return getLocalQuestions(subject, count);
  };

  let totalMcqTarget = distribution ? distribution.mcq : Math.ceil(count * 0.8);
  let totalNumTarget = distribution ? distribution.numerical : count - totalMcqTarget;
  
  const isFullSyllabus = !chapters || chapters.length === 0;
  let topicFocus = isFullSyllabus ? "Full Syllabus High Weightage" : `Chapters: ${chapters.join(', ')}`;
  if (topics && topics.length > 0) topicFocus += ` | Topics: ${topics.join(', ')}`;

  const allQuestions: Question[] = [];
  const BATCH_SIZE = 12; 

  let mcqNeeded = totalMcqTarget;
  let numNeeded = totalNumTarget;
  let failSafe = 0;

  while ((mcqNeeded > 0 || numNeeded > 0) && failSafe < 5) {
      let currentMcq = 0;
      let currentNum = 0;

      if (mcqNeeded > 0 && numNeeded > 0) {
          const mcqShare = Math.min(mcqNeeded, Math.ceil(BATCH_SIZE * 0.7)); 
          currentMcq = mcqShare;
          currentNum = Math.min(numNeeded, BATCH_SIZE - currentMcq);
          if (currentMcq + currentNum < BATCH_SIZE) {
             if (mcqNeeded > currentMcq) currentMcq = Math.min(mcqNeeded, BATCH_SIZE - currentNum);
             else if (numNeeded > currentNum) currentNum = Math.min(numNeeded, BATCH_SIZE - currentMcq);
          }
      } else if (mcqNeeded > 0) {
          currentMcq = Math.min(mcqNeeded, BATCH_SIZE);
      } else if (numNeeded > 0) {
          currentNum = Math.min(numNeeded, BATCH_SIZE);
      }

      console.debug(`Generating Batch for ${subject}: Asking for ${currentMcq} MCQ, ${currentNum} Num`);

      try {
          const batch = await generateQuestionBatch(subject, currentMcq, currentNum, type, topicFocus);
          
          if (batch.length === 0) {
              failSafe++;
              await delay(2000);
              continue;
          }

          allQuestions.push(...batch);
          mcqNeeded = Math.max(0, mcqNeeded - batch.filter(q => q.type === 'MCQ').length);
          numNeeded = Math.max(0, numNeeded - batch.filter(q => q.type === 'Numerical').length);

      } catch (e: any) {
          // If we hit the specific Quota/Network Error, switch to fallback IMMEDIATELY
          if (e.message === "QUOTA_EXCEEDED" || e.message === "NO_API_KEYS" || e.message === "NETWORK_FAILURE") {
              const remainingCount = totalMcqTarget + totalNumTarget - allQuestions.length;
              if (remainingCount > 0) {
                  const fallbackQs = getLocalQuestions(subject, remainingCount);
                  allQuestions.push(...fallbackQs);
              }
              break; // Exit loop, we have filled the rest with offline data
          }
          console.error("Batch error:", e);
          failSafe++;
      }
      
      if (mcqNeeded > 0 || numNeeded > 0) await delay(5000); 
  }

  // Final check: If we failed to get enough questions via API, fill the rest from local
  if (allQuestions.length < count) {
      const needed = count - allQuestions.length;
      console.log(`Filling ${needed} remaining questions from local bank`);
      const extra = getLocalQuestions(subject, needed);
      allQuestions.push(...extra);
  }

  const finalMcqs = allQuestions.filter(q => q.type === 'MCQ').slice(0, totalMcqTarget);
  const finalNums = allQuestions.filter(q => q.type === 'Numerical').slice(0, totalNumTarget);

  return [...finalMcqs, ...finalNums];
};

export const generateFullJEEDailyPaper = async (config: any): Promise<{ physics: Question[], chemistry: Question[], mathematics: Question[] }> => {
  try {
    const physics = await generateJEEQuestions(Subject.Physics, config.physics.mcq + config.physics.numerical, ExamType.Advanced, config.physics.chapters, Difficulty.Hard, [], config.physics);
    await delay(10000);
    const chemistry = await generateJEEQuestions(Subject.Chemistry, config.chemistry.mcq + config.chemistry.numerical, ExamType.Advanced, config.chemistry.chapters, Difficulty.Hard, [], config.chemistry);
    await delay(10000);
    const mathematics = await generateJEEQuestions(Subject.Mathematics, config.mathematics.mcq + config.mathematics.numerical, ExamType.Advanced, config.mathematics.chapters, Difficulty.Hard, [], config.mathematics);

    return { physics: physics || [], chemistry: chemistry || [], mathematics: mathematics || [] };
  } catch (error) {
    console.error("Full Paper Gen Error:", error);
    // Fallback for full paper failure
    return {
        physics: getLocalQuestions(Subject.Physics, 10),
        chemistry: getLocalQuestions(Subject.Chemistry, 10),
        mathematics: getLocalQuestions(Subject.Mathematics, 10)
    };
  }
};

export const parseDocumentToQuestions = async (questionFile: File, solutionFile?: File): Promise<Question[]> => {
  const qBase64DataUrl = await fileToBase64(questionFile);
  const parts: any[] = [{ inlineData: { mimeType: questionFile.type, data: qBase64DataUrl.split(',')[1] } }];
  
  if (solutionFile) {
    const sBase64DataUrl = await fileToBase64(solutionFile);
    parts.push({ inlineData: { mimeType: solutionFile.type, data: sBase64DataUrl.split(',')[1] } });
  }

  const prompt = `
  Analyze the provided document(s) and extract EVERY question from ALL subjects (Physics, Chemistry, Mathematics).
  STRICT FORMATTING RULES:
  1. Return ONLY a valid JSON Array.
  2. Escape all LaTeX backslashes.
  3. Wrap math in $ delimiters.
  4. Detect Subject from headers.
  
  JSON Structure:
  [{ "subject": "Physics", "statement": "Question...", "type": "MCQ", "options": ["A", "B", "C", "D"], "correctAnswer": "A", "solution": "Solution..." }]
  `;

  try {
    const response = await safeGenerateContent({
      model: VISION_MODEL, 
      contents: { parts: [...parts, { text: prompt }] },
      config: { responseMimeType: "application/json" } 
    });

    const text = extractText(response);
    let data = cleanAndParseJSON(text);

    if (data && !Array.isArray(data)) {
        if (Array.isArray(data.questions)) data = data.questions;
        else if (Array.isArray(data.data)) data = data.data;
        else if (Array.isArray(data.items)) data = data.items;
        else if (Array.isArray(data.result)) data = data.result;
    }
    
    if (!Array.isArray(data)) throw new Error("Parsed data is not an array");

    return data
      .filter((q: any) => q && typeof q === 'object')
      .map((q: any, idx: number) => {
        const defaultMarking = { positive: 4, negative: 1 };
        const safeMarkingScheme = (q.markingScheme && typeof q.markingScheme === 'object' && typeof q.markingScheme.positive === 'number') ? q.markingScheme : defaultMarking;

        return {
            ...q,
            id: `parsed-${Date.now()}-${idx}`,
            markingScheme: safeMarkingScheme,
            subject: q.subject || 'Physics', 
            type: q.type || 'MCQ',
            options: q.options || [],
            statement: q.statement || 'Error parsing statement',
            correctAnswer: q.correctAnswer || '',
            solution: q.solution || ''
        };
    });
  } catch (error) {
    console.error("Parsing Failure:", error);
    throw error;
  }
};

export const getDeepAnalysis = async (result: any) => {
    try {
        const response = await safeGenerateContent({
            model: ANALYSIS_MODEL,
            contents: `Analyze exam performance: ${JSON.stringify(result).substring(0, 5000)}. Brief strategic advice.`
        });
        return extractText(response);
    } catch (e) { return "Analysis currently unavailable due to high server load."; }
};
