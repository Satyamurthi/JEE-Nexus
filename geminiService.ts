
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { Subject, ExamType, Question, QuestionType, Difficulty } from "./types";
import { NCERT_CHAPTERS } from "./constants";

// Lazy initialization holder
let ai: GoogleGenAI | null = null;

// Helper to get env vars safely in Vite/Netlify/Node environments
const getEnv = (key: string) => {
  // 1. Check Vite import.meta.env (Primary for this stack)
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    return (import.meta as any).env[key] || 
           (import.meta as any).env[`VITE_${key}`] || 
           (import.meta as any).env[`REACT_APP_${key}`];
  }
  // 2. Check standard process.env (Node/Webpack/Netlify Build)
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return '';
};

// Returns the shared AI client instance, initializing it on first use
const getAI = () => {
    if (!ai) {
        // Prioritize Environment Variable
        const apiKey = getEnv('API_KEY') || getEnv('VITE_API_KEY');
        
        if (!apiKey) {
            console.error("Gemini API Key missing. Please set VITE_API_KEY in your .env file or Netlify settings.");
            throw new Error("API Configuration Error: Key not found. Please check system settings.");
        }
        ai = new GoogleGenAI({ apiKey });
    }
    return ai;
};

// Retrieve model configuration from local storage or use defaults
const getModelConfig = () => {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem('nexus_model_config') || '{}');
  } catch (e) { return {}; }
};

const config = getModelConfig();
// Using recommended models based on task complexity
// Fallback to gemini-2.0-flash as it is currently the most stable high-rate-limit model
const GEN_MODEL = config.genModel || "gemini-2.0-flash"; 
const VISION_MODEL = config.visionModel || "gemini-2.0-flash";
const ANALYSIS_MODEL = config.analysisModel || "gemini-2.0-flash";

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

/**
 * Robust JSON cleaner and parser specifically for LLM-generated JSON containing LaTeX.
 */
const cleanAndParseJSON = (text: string) => {
  if (!text) return null;

  // 1. Remove Markdown code blocks if any
  let cleanText = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  
  try {
    // Attempt standard parse first
    return JSON.parse(cleanText);
  } catch (e) {
    // Attempt cleanup if standard parse fails
    let sanitized = cleanText;
    try {
        return JSON.parse(sanitized);
    } catch (e2) {
        console.warn("JSON Parse failed:", e2);
        return null;
    }
  }
};

// Helper for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Wrapper for API calls with automatic retry logic for 429 errors.
 */
const safeGenerateContent = async (params: any, retries = 3): Promise<any> => {
    const aiInstance = getAI();
    try {
        return await aiInstance.models.generateContent(params);
    } catch (e: any) {
        const isRateLimit = e.status === 429 || 
                            e.message?.includes('429') || 
                            e.message?.includes('Quota') || 
                            e.message?.includes('RESOURCE_EXHAUSTED');
        
        // If quota exceeded or model not found (404 for exp models), try fallback
        if ((isRateLimit || e.status === 404 || e.status === 503) && retries > 0) {
            console.warn(`Gemini API Error (${e.status}). Retrying... (${retries} attempts left)`);
            
            await delay(2000 * (4 - retries)); // Backoff: 2s, 4s, 6s

            // If it was the last retry or a specific hard error, switch to the most stable model
            if (retries === 1 || e.status === 404) {
                 const fallbackModel = 'gemini-2.0-flash';
                 if (params.model !== fallbackModel) {
                     console.warn(`Switching to stable fallback model: ${fallbackModel}`);
                     return safeGenerateContent({ ...params, model: fallbackModel }, 0);
                 }
            }
            
            return safeGenerateContent(params, retries - 1);
        }
        
        throw e;
    }
};

// Define response schema using Type from @google/genai
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
    // Property access .text
    return response.text || "Recall basic principles.";
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
    // Property access .text
    return response.text || text;
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
    // Advanced Topic Focus Generation
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

    topicFocus = `
        Generate questions strictly distributed among the following chapters with specific constraints:
        ${constraints.join('\n')}
    `;
  }

  // UPDATED PROMPT FOR HIGHER DIFFICULTY - EXACT JEE ADVANCED SPEC
  const prompt = `
    Act as the Chief Paper Setter for JEE Advanced (IIT-JEE).
    Your task is to generate exactly ${count} questions of "JEE Advanced" standard for the subject: ${subject}.
    
    Target Scope: ${topicFocus}
    Difficulty Profile: 100% HARD to EXTREME. (No Board level or Main level questions).
    Structure: ${mcqCount} Single/Multi Correct MCQs and ${numericalCount} Numerical Value Type (Integer/Decimal).

    STRICT GUIDELINES FOR "JEE ADVANCED" LEVEL:
    1. MULTI-CONCEPTUAL: Every question must merge at least two distinct concepts (e.g., Rotation + Magnetism, Thermodynamics + SHM, Probability + Complex Numbers, Organic Mechanism + Stoichiometry).
    2. NO DIRECT FORMULAS: Questions must require deriving a relation, calculus-based analysis, or visualizing a complex physical situation.
    3. NUMERICALS: Must be calculation-intensive or require precise logic. Answers can be integers (0-9) or decimals to 2 places.
    4. PHYSICS: Use non-inertial frames, variable mass, constraint relations (rod/wedge), RLC transients, or wave optics with interference.
    5. CHEMISTRY: Focus on reaction mechanisms with stereochemistry (R/S, E/Z), complex buffer/solubility cases, or crystal field splitting with magnetic moments.
    6. MATHS: Use calculus with inequalities, vector 3D involving skew lines/planes, or probability involving Bayes theorem mixed with P&C.

    OUTPUT FORMAT RULES:
    1. Return strictly valid JSON array.
    2. Use LaTeX for ALL math expressions, enclosed in single dollar signs $. 
    3. ESCAPE BACKSLASHES in LaTeX string literals (e.g., use "\\\\alpha" for \\alpha, "\\\\frac" for \\frac). This is critical for JSON parsing.
    4. For 'Numerical' type, set "options": [].
    5. markingScheme: {"positive": 4, "negative": 1} for MCQ, {"positive": 4, "negative": 0} for Numerical.
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

    // Property access .text
    const text = response.text;
    if (!text) throw new Error("Empty response from AI");

    const data = cleanAndParseJSON(text);
    return Array.isArray(data) ? data : [];
  } catch (error: any) {
    console.error(`Gemini Generation Failure for ${subject}:`, error);
    return [];
  }
};

interface SubjectConfig {
    mcq: number;
    numerical: number;
    chapters: string[];
    topics: string[];
}

interface FullGenerationConfig {
  physics: SubjectConfig;
  chemistry: SubjectConfig;
  mathematics: SubjectConfig;
}

export const generateFullJEEDailyPaper = async (config: FullGenerationConfig): Promise<{ physics: Question[], chemistry: Question[], mathematics: Question[] }> => {
  try {
    // Use Promise.allSettled to ensure partial results are returned even if one subject fails
    const results = await Promise.allSettled([
        generateJEEQuestions(
            Subject.Physics, 
            config.physics.mcq + config.physics.numerical, 
            ExamType.Advanced, 
            config.physics.chapters, 
            Difficulty.Hard, 
            config.physics.topics,
            { mcq: config.physics.mcq, numerical: config.physics.numerical }
        ),
        generateJEEQuestions(
            Subject.Chemistry, 
            config.chemistry.mcq + config.chemistry.numerical, 
            ExamType.Advanced, 
            config.chemistry.chapters, 
            Difficulty.Hard, 
            config.chemistry.topics,
            { mcq: config.chemistry.mcq, numerical: config.chemistry.numerical }
        ),
        generateJEEQuestions(
            Subject.Mathematics, 
            config.mathematics.mcq + config.mathematics.numerical, 
            ExamType.Advanced, 
            config.mathematics.chapters, 
            Difficulty.Hard, 
            config.mathematics.topics,
            { mcq: config.mathematics.mcq, numerical: config.mathematics.numerical }
        )
    ]);

    // Helper to safely extract value
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


export const parseDocumentToQuestions = async (
  questionFile: File,
  solutionFile?: File
): Promise<Question[]> => {
  const qBase64 = await fileToBase64(questionFile);
  
  const parts: any[] = [
    {
      inlineData: {
        mimeType: questionFile.type,
        data: qBase64
      }
    }
  ];

  if (solutionFile) {
    const sBase64 = await fileToBase64(solutionFile);
    parts.push({
      inlineData: {
        mimeType: solutionFile.type,
        data: sBase64
      }
    });
  }

  const prompt = `
    Extract every question from these documents into a structured JSON array.
    Ensure LaTeX format for math ($...$).
    IMPORTANT: Escape all LaTeX backslashes properly in JSON (e.g. "\\\\alpha").
  `;

  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  ];

  try {
    // Attempting to use the safer wrapper for document parsing
    const response = await safeGenerateContent({
      model: VISION_MODEL,
      contents: {
        parts: [
          ...parts,
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        safetySettings: safetySettings,
      }
    });

    // Property access .text
    const data = cleanAndParseJSON(response.text);
    const questions = Array.isArray(data) ? data : [];
    
    return questions.map((q: any, idx: number) => ({
      ...q,
      id: q.id || `parsed-${Date.now()}-${idx}`,
      markingScheme: q.markingScheme || { positive: 4, negative: q.type === 'MCQ' ? 1 : 0 },
      subject: q.subject || 'Physics',
      type: q.type || 'MCQ',
      difficulty: q.difficulty || 'Medium',
      explanation: q.explanation || q.solution || 'Extracted from document.',
      concept: q.concept || 'Theory',
      options: q.options || [],
      statement: q.statement || 'Statement missing.',
      correctAnswer: q.correctAnswer || '',
      solution: q.solution || 'No solution provided.'
    }));
  } catch (error) {
    console.error("Parsing Failure:", error);
    // Re-throw to allow UI to handle it
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
        // Property access .text
        return response.text || "Summary not available.";
    } catch (e) {
        return "Analysis failed.";
    }
};
