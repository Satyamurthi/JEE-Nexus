
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { Subject, ExamType, Question, QuestionType, Difficulty } from "./types";
import { NCERT_CHAPTERS } from "./constants";
import { getLocalQuestions } from "./data/jee_dataset";
import { fetchJEEFromHuggingFace } from "./services/huggingFaceService";

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

const MODEL_ID = config.modelId || config.genModel || "gemini-2.0-flash"; 
const VISION_MODEL = config.visionModel || "gemini-2.0-flash"; 
const ANALYSIS_MODEL = config.analysisModel || "gemini-2.0-flash";

let lastRequestTimestamp = 0;
const MIN_GLOBAL_REQUEST_INTERVAL = 3000;

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

const cleanAndParseJSON = (text: string) => {
  if (!text) return null;
  let cleanText = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
  cleanText = cleanText.replace(/\/\/.*$/gm, '');
  const firstOpenBrace = cleanText.indexOf('{');
  const firstOpenBracket = cleanText.indexOf('[');
  let startIdx = -1;
  if (firstOpenBrace !== -1 && firstOpenBracket !== -1) startIdx = Math.min(firstOpenBrace, firstOpenBracket);
  else if (firstOpenBrace !== -1) startIdx = firstOpenBrace;
  else if (firstOpenBracket !== -1) startIdx = firstOpenBracket;
  if (startIdx === -1) return null;
  cleanText = cleanText.substring(startIdx);
  const lastCloseBrace = cleanText.lastIndexOf('}');
  const lastCloseBracket = cleanText.lastIndexOf(']');
  const endIdx = Math.max(lastCloseBrace, lastCloseBracket);
  if (endIdx !== -1) cleanText = cleanText.substring(0, endIdx + 1);
  try {
    return JSON.parse(cleanText);
  } catch (e) {}
  try {
    if (cleanText.trim().endsWith(',')) cleanText = cleanText.trim().slice(0, -1);
    if (!cleanText.trim().endsWith(']')) cleanText += ']';
    return JSON.parse(cleanText); 
  } catch (repairError) { return null; }
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
  }
  return Array.from(new Set(keys)).filter(k => !!k);
};

const safeGenerateContent = async (params: any, retries = 2, initialDelay = 5000, keyOffset = 0): Promise<any> => {
    await enforceGlobalThrottle();
    try {
        const keys = getAvailableApiKeys();
        if (keys.length === 0) throw new Error("NO_API_KEYS"); 
        const activeKey = keys[keyOffset % keys.length];
        const ai = new GoogleGenAI({ apiKey: activeKey });
        return await ai.models.generateContent({
            model: params.model, 
            contents: params.contents,
            config: params.config
        });
    } catch (e: any) {
        const isRateLimit = e.message?.includes('429') || e.status === 429 || e.status === 403 || e.message?.includes('Quota exceeded');
        const isNetworkError = e.message?.includes('Failed to fetch') || e.message?.includes('NetworkError');
        if (isNetworkError) throw new Error("NETWORK_FAILURE");
        if (isRateLimit) {
            if (retries <= 0) throw new Error("QUOTA_EXCEEDED");
            await delay(initialDelay);
            return safeGenerateContent(params, retries - 1, initialDelay * 2, keyOffset + 1);
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

export const generateJEEQuestions = async (subject: Subject, count: number, type: ExamType, chapters?: string[], difficulty?: string | Difficulty, topics?: string[], distribution?: { mcq: number, numerical: number }): Promise<Question[]> => {
  
  const allQuestions: Question[] = [];
  let totalMcqTarget = distribution ? distribution.mcq : Math.ceil(count * 0.8);
  let totalNumTarget = distribution ? distribution.numerical : count - totalMcqTarget;
  
  const isFullSyllabus = !chapters || chapters.length === 0;
  let topicFocus = isFullSyllabus ? "Full Syllabus" : `Chapters: ${chapters.join(', ')}`;

  // --- ATTEMPT 1: GOOGLE GEMINI AI ---
  try {
      console.log(`[AI] Generating questions for ${subject}...`);
      const prompt = `Create ${count} JEE ${subject} questions for ${type}. Topics: ${topicFocus}. Use LaTeX. Return JSON Array.`;
      const response = await safeGenerateContent({
        model: MODEL_ID,
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: questionSchema }
      });
      const data = cleanAndParseJSON(extractText(response));
      if (data && Array.isArray(data) && data.length > 0) {
          allQuestions.push(...data.map((q, i) => ({
              ...q,
              id: `ai-${Date.now()}-${i}`,
              subject: q.subject || subject,
              type: q.options ? 'MCQ' : 'Numerical',
              markingScheme: q.markingScheme || (q.options ? { positive: 4, negative: 1 } : { positive: 4, negative: 0 })
          })));
      }
  } catch (e) {
      console.warn("[AI] Failed or Quota hit, switching to Hugging Face Dataset...");
  }

  // --- ATTEMPT 2: HUGGING FACE DATASET (If AI failed or returned less) ---
  if (allQuestions.length < count) {
      const needed = count - allQuestions.length;
      try {
          console.log(`[Dataset] Fetching ${needed} questions from Hugging Face...`);
          const hfQuestions = await fetchJEEFromHuggingFace(subject, needed);
          allQuestions.push(...hfQuestions);
      } catch (e) {
          console.warn("[Dataset] HF API failed, falling back to Local Cache...");
      }
  }

  // --- ATTEMPT 3: LOCAL CACHE (Total Resilience) ---
  if (allQuestions.length < count) {
      const needed = count - allQuestions.length;
      console.log(`[Local] Pulling ${needed} questions from internal bank.`);
      const localQs = getLocalQuestions(subject, needed);
      allQuestions.push(...localQs);
  }

  const finalMcqs = allQuestions.filter(q => q.type === 'MCQ').slice(0, totalMcqTarget);
  const finalNums = allQuestions.filter(q => q.type === 'Numerical').slice(0, totalNumTarget);

  return [...finalMcqs, ...finalNums];
};

export const getQuickHint = async (statement: string, subject: string): Promise<string> => {
  try {
    const response = await safeGenerateContent({ model: MODEL_ID, contents: `Hint for ${subject}: ${statement.substring(0, 300)}...` });
    return extractText(response) || "Review concepts.";
  } catch (e) { return "Hint unavailable."; }
};

export const refineQuestionText = async (text: string): Promise<string> => text;

export const generateFullJEEDailyPaper = async (config: any): Promise<{ physics: Question[], chemistry: Question[], mathematics: Question[] }> => {
  try {
    const physics = await generateJEEQuestions(Subject.Physics, config.physics.mcq + config.physics.numerical, ExamType.Advanced, config.physics.chapters, Difficulty.Hard, [], config.physics);
    await delay(2000);
    const chemistry = await generateJEEQuestions(Subject.Chemistry, config.chemistry.mcq + config.chemistry.numerical, ExamType.Advanced, config.chemistry.chapters, Difficulty.Hard, [], config.chemistry);
    await delay(2000);
    const mathematics = await generateJEEQuestions(Subject.Mathematics, config.mathematics.mcq + config.mathematics.numerical, ExamType.Advanced, config.mathematics.chapters, Difficulty.Hard, [], config.mathematics);
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
  const qBase64DataUrl = await fileToBase64(questionFile);
  const parts: any[] = [{ inlineData: { mimeType: questionFile.type, data: qBase64DataUrl.split(',')[1] } }];
  if (solutionFile) {
    const sBase64DataUrl = await fileToBase64(solutionFile);
    parts.push({ inlineData: { mimeType: solutionFile.type, data: sBase64DataUrl.split(',')[1] } });
  }
  const prompt = `Extract JEE questions as JSON Array. Use LaTeX.`;
  try {
    const response = await safeGenerateContent({ model: VISION_MODEL, contents: { parts: [...parts, { text: prompt }] }, config: { responseMimeType: "application/json" } });
    let data = cleanAndParseJSON(extractText(response));
    if (!Array.isArray(data)) throw new Error("Parsed data is not an array");
    return data.map((q, idx) => ({ ...q, id: `parsed-${Date.now()}-${idx}` }));
  } catch (error) { throw error; }
};

export const getDeepAnalysis = async (result: any) => {
    try {
        const response = await safeGenerateContent({ model: ANALYSIS_MODEL, contents: `Analyze exam performance: ${JSON.stringify(result).substring(0, 5000)}` });
        return extractText(response);
    } catch (e) { return "Analysis currently unavailable."; }
};
