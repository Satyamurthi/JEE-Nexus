
import { Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { Subject, ExamType, Question, QuestionType, Difficulty } from "./types";
import { NCERT_CHAPTERS } from "./constants";

// Configuration Defaults
const getModelConfig = () => {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem('nexus_model_config') || '{}');
  } catch (e) { return {}; }
};

const config = getModelConfig();
const GEN_MODEL = config.genModel || "gemini-3-flash-preview"; 
const VISION_MODEL = config.visionModel || "gemini-2.5-flash-image"; 
const ANALYSIS_MODEL = config.analysisModel || "gemini-3-flash-preview";

// Helper to convert File to Base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

const cleanAndParseJSON = (text: string) => {
  if (!text) return null;
  let cleanText = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  try {
    return JSON.parse(cleanText);
  } catch (e) {
    let sanitized = cleanText;
    try {
        return JSON.parse(sanitized);
    } catch (e2) {
        console.warn("JSON Parse failed:", e2);
        return null;
    }
  }
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calls the Netlify Proxy Function instead of Google directly.
 * This hides the API Key and enforces backend rate limiting.
 */
const callAIProxy = async (params: any) => {
    try {
        const response = await fetch('/.netlify/functions/ai-proxy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(params)
        });

        const contentType = response.headers.get("content-type");
        
        // Handle JSON responses (Success or JSON Errors)
        if (contentType && contentType.includes("application/json")) {
            const data = await response.json();
            if (!response.ok) {
                throw {
                    status: response.status,
                    message: data.error?.message || response.statusText
                };
            }
            return data;
        } else {
            // Handle HTML/Text responses (e.g., 502 Bad Gateway, 404 Not Found)
            const text = await response.text();
            throw {
                status: response.status,
                message: `Proxy connection failed (${response.status}). Ensure the backend function is running. Details: ${text.substring(0, 100)}`
            };
        }
    } catch (error: any) {
        console.error("Proxy Call Failed:", error);
        throw error;
    }
};

/**
 * Wrapper for API calls with automatic retry logic for 429 errors.
 * Includes intelligent model switching to avoid quota exhaustion.
 */
const safeGenerateContent = async (params: any, retries = 3): Promise<any> => {
    try {
        return await callAIProxy(params);
    } catch (e: any) {
        const isRateLimit = e.status === 429 || 
                            e.message?.includes('429') || 
                            e.message?.includes('Quota') || 
                            e.message?.includes('Rate limit');
        
        const isModelError = e.status === 404 || e.status === 503;

        if ((isRateLimit || isModelError) && retries > 0) {
            console.warn(`AI Error (${e.status || 'Quota'}). Retrying... (${retries} attempts left)`);
            
            // Exponential backoff: 4s, 8s, 12s
            await delay(4000 * (4 - retries));

            let nextParams = { ...params };

            // Intelligent Model Switching strategy
            if (isRateLimit || isModelError) {
                const currentModel = nextParams.model;
                let fallbackModel = '';

                if (currentModel === 'gemini-3-flash-preview') {
                    fallbackModel = 'gemini-2.0-flash-lite-preview-02-05';
                } else if (currentModel === 'gemini-2.5-flash-image') {
                    fallbackModel = 'gemini-2.0-flash';
                } else if (currentModel === 'gemini-2.0-flash') {
                    fallbackModel = 'gemini-2.0-flash-lite-preview-02-05';
                }

                if (fallbackModel && fallbackModel !== currentModel) {
                    console.warn(`Switching model from ${currentModel} to ${fallbackModel} due to error.`);
                    nextParams.model = fallbackModel;
                }
            }
            
            return safeGenerateContent(nextParams, retries - 1);
        }
        
        throw e;
    }
};

// Helper to extract text from Raw JSON response (Proxy doesn't return SDK object with getters)
const extractText = (response: any): string => {
    try {
        if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
            return response.candidates[0].content.parts.map((p: any) => p.text).join('') || '';
        }
        return '';
    } catch (e) {
        return '';
    }
};

// Define response schema
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
         properties: {
             positive: { type: Type.INTEGER },
             negative: { type: Type.INTEGER }
         }
      }
    },
    required: ["subject", "statement", "correctAnswer", "solution", "type"]
  }
};

export const getQuickHint = async (statement: string, subject: string): Promise<string> => {
  try {
    const response = await safeGenerateContent({
      model: GEN_MODEL,
      contents: `Provide a single, very short conceptual hint (max 15 words) for this ${subject} question. Do NOT solve it. Do NOT give formulas. Just the starting concept. Question: ${statement.substring(0, 300)}...`
    });
    return extractText(response) || "Recall basic principles.";
  } catch (e) {
    return "Check your concepts.";
  }
};

export const refineQuestionText = async (text: string): Promise<string> => {
  try {
    const response = await safeGenerateContent({
      model: GEN_MODEL,
      contents: `Fix grammar and clarity of this JEE question text. Keep LaTeX math ($...$) intact. Text: ${text}`
    });
    return extractText(response) || text;
  } catch (e) {
    return text;
  }
};

export const generateJEEQuestions = async (
  subject: Subject,
  count: number,
  type: ExamType,
  chapters?: string[],
  difficulty?: string | Difficulty,
  topics?: string[],
  distribution?: { mcq: number, numerical: number }
): Promise<Question[]> => {
  let mcqCount = count;
  let numericalCount = 0;
  
  if (distribution) {
      mcqCount = distribution.mcq;
      numericalCount = distribution.numerical;
  } else if (count >= 5) {
      mcqCount = Math.ceil(count * 0.8);
      numericalCount = count - mcqCount;
  }

  const isFullSyllabus = !chapters || chapters.length === 0;

  let topicFocus = "Cover high-weightage topics from Class 11 and 12 NCERT syllabus. Focus on complex applications.";
  
  if (!isFullSyllabus) {
    const subjectChapters = NCERT_CHAPTERS[subject] || [];
    const constraints = chapters.map(chap => {
        const chapDef = subjectChapters.find(c => c.name === chap);
        if (!chapDef) return `- Chapter: "${chap}" (Focus: Multi-concept linking)`;
        const selectedTopicsForChap = chapDef.topics.filter(t => topics?.includes(t));
        if (selectedTopicsForChap.length > 0) {
            return `- Chapter: "${chap}" (STRICTLY RESTRICT to topics: ${selectedTopicsForChap.join(', ')})`;
        } else {
            return `- Chapter: "${chap}" (Focus: Deep Conceptual Depth)`;
        }
    });
    topicFocus = `Generate questions strictly distributed among the following chapters with specific constraints:\n${constraints.join('\n')}`;
  }

  const prompt = `
    Act as the Chief Paper Setter for JEE Advanced (IIT-JEE).
    Your task is to generate exactly ${count} questions of "JEE Advanced" standard for the subject: ${subject}.
    Target Scope: ${topicFocus}
    Difficulty Profile: 100% HARD to EXTREME.
    Structure: ${mcqCount} Single/Multi Correct MCQs and ${numericalCount} Numerical Value Type.
    GUIDELINES:
    1. MULTI-CONCEPTUAL: Merge distinct concepts.
    2. NO DIRECT FORMULAS: Require derivation/analysis.
    3. NUMERICALS: Integers (0-9) or decimals (2 places).
    OUTPUT FORMAT:
    1. Return strictly valid JSON array.
    2. Use LaTeX for math ($...$). ESCAPE BACKSLASHES (e.g., "\\\\alpha").
    3. markingScheme: {"positive": 4, "negative": 1} for MCQ, {"positive": 4, "negative": 0} for Numerical.
  `;

  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  ];

  try {
    const response = await safeGenerateContent({
      model: GEN_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: questionSchema,
        safetySettings: safetySettings,
      }
    });

    const text = extractText(response);
    if (!text) throw new Error("Empty response from AI");

    const data = cleanAndParseJSON(text);
    return Array.isArray(data) ? data : [];
  } catch (error: any) {
    console.error(`Generation Failure for ${subject}:`, error);
    return [];
  }
};

interface SubjectConfig { mcq: number; numerical: number; chapters: string[]; topics: string[]; }
interface FullGenerationConfig { physics: SubjectConfig; chemistry: SubjectConfig; mathematics: SubjectConfig; }

export const generateFullJEEDailyPaper = async (config: FullGenerationConfig): Promise<{ physics: Question[], chemistry: Question[], mathematics: Question[] }> => {
  try {
    const results = await Promise.allSettled([
        generateJEEQuestions(Subject.Physics, config.physics.mcq + config.physics.numerical, ExamType.Advanced, config.physics.chapters, Difficulty.Hard, config.physics.topics, { mcq: config.physics.mcq, numerical: config.physics.numerical }),
        generateJEEQuestions(Subject.Chemistry, config.chemistry.mcq + config.chemistry.numerical, ExamType.Advanced, config.chemistry.chapters, Difficulty.Hard, config.chemistry.topics, { mcq: config.chemistry.mcq, numerical: config.chemistry.numerical }),
        generateJEEQuestions(Subject.Mathematics, config.mathematics.mcq + config.mathematics.numerical, ExamType.Advanced, config.mathematics.chapters, Difficulty.Hard, config.mathematics.topics, { mcq: config.mathematics.mcq, numerical: config.mathematics.numerical })
    ]);

    const getResult = (index: number) => {
        const res = results[index];
        return res.status === 'fulfilled' ? res.value : [];
    };

    return {
        physics: getResult(0),
        chemistry: getResult(1),
        mathematics: getResult(2)
    };
  } catch (error: any) {
    console.error("Full Paper Generation Critical Failure:", error);
    return { physics: [], chemistry: [], mathematics: [] };
  }
};

export const parseDocumentToQuestions = async (questionFile: File, solutionFile?: File): Promise<Question[]> => {
  const qBase64 = await fileToBase64(questionFile);
  const parts: any[] = [{ inlineData: { mimeType: questionFile.type, data: qBase64 } }];

  if (solutionFile) {
    const sBase64 = await fileToBase64(solutionFile);
    parts.push({ inlineData: { mimeType: solutionFile.type, data: sBase64 } });
  }

  const prompt = `Extract every question from these documents into a structured JSON array. Ensure LaTeX format for math ($...$). Escape backslashes properly.`;

  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  ];

  try {
    const response = await safeGenerateContent({
      model: VISION_MODEL,
      contents: { parts: [...parts, { text: prompt }] },
      config: { responseMimeType: "application/json", safetySettings: safetySettings }
    });

    const data = cleanAndParseJSON(extractText(response));
    const questions = Array.isArray(data) ? data : [];
    
    return questions.map((q: any, idx: number) => ({
      ...q,
      id: q.id || `parsed-${Date.now()}-${idx}`,
      markingScheme: q.markingScheme || { positive: 4, negative: q.type === 'MCQ' ? 1 : 0 },
      subject: q.subject || 'Physics',
      type: q.type || 'MCQ',
      difficulty: q.difficulty || 'Medium',
      explanation: q.explanation || q.solution || 'Extracted.',
      concept: q.concept || 'Theory',
      options: q.options || [],
      statement: q.statement || 'Statement missing.',
      correctAnswer: q.correctAnswer || '',
      solution: q.solution || 'No solution.'
    }));
  } catch (error) {
    console.error("Parsing Failure:", error);
    throw error;
  }
};

export const getDeepAnalysis = async (result: any) => {
    try {
        const prompt = `Analyze these JEE mock results: ${JSON.stringify(result)}. Provide deep pedagogical feedback.`;
        const response = await safeGenerateContent({
            model: ANALYSIS_MODEL,
            contents: prompt
        });
        return extractText(response) || "Summary not available.";
    } catch (e) {
        return "Analysis failed.";
    }
};
