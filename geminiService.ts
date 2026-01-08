
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
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
// Legacy fallback or new fields
const PROVIDER = config.provider || 'google'; 
const BASE_URL = config.baseUrl || '';
// User requested gemini-3.0-preview everywhere. Mapping to available preview tag.
const MODEL_ID = config.modelId || config.genModel || "gemini-3-flash-preview"; 

// Constants for Google
const VISION_MODEL = config.visionModel || "gemini-3-flash-preview"; 
const ANALYSIS_MODEL = config.analysisModel || "gemini-3-flash-preview";

// Helper to convert File to Base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = error => reject(error);
  });
};

const cleanAndParseJSON = (text: string) => {
  if (!text) return null;
  // Remove markdown code blocks and whitespace
  let cleanText = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  
  try {
    return JSON.parse(cleanText);
  } catch (e) {
    console.warn("Initial JSON Parse failed, attempting sanitization...");
    try {
        // Robust Sanitization for LaTeX Backslashes
        const fixedText = cleanText.replace(/(\\+)([^"\\/bfnrtu])/g, (match, backslashes, char) => {
            if (backslashes.length % 2 === 1) {
                return backslashes + "\\" + char;
            }
            return match;
        });
        
        return JSON.parse(fixedText);
    } catch (e2) {
        console.error("JSON Parse failed after sanitization:", e2);
        // Last resort: Try to extract array if it looks like one
        const arrayMatch = cleanText.match(/\[.*\]/s);
        if (arrayMatch) {
            try {
                 const fixedArray = arrayMatch[0].replace(/(\\+)([^"\\/bfnrtu])/g, (m, b, c) => b.length % 2 === 1 ? b + "\\" + c : m);
                 return JSON.parse(fixedArray);
            } catch (e3) {}
        }
        return null;
    }
  }
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * MULTI-KEY ROTATION SYSTEM
 * Handles 429/Quota limits by cycling through a pool of available keys.
 */
const API_KEY_POOL = [
  "AIzaSyDmInFBTJ3dA_BmPopd9hALyqh78Dnycqc",
  "AIzaSyCIpRbTI0HNCU-xD0TBK9oVYau2HymmFjo",
  "AIzaSyAO_SBZPrmNYM9nyXNdzsjp8gdoKm3Oheo"
];

const getAvailableApiKeys = (): string[] => {
  // Start with the hardcoded backup keys
  const keys = [...API_KEY_POOL];
  
  const parseEnvList = (envVal: string | undefined) => {
    if (!envVal) return [];
    return envVal.split(',').map(k => k.trim()).filter(k => k);
  };

  // Check process.env (Standard/CRA)
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.GEMINI_API_KEYS) keys.unshift(...parseEnvList(process.env.GEMINI_API_KEYS));
    if (process.env.REACT_APP_GEMINI_API_KEYS) keys.unshift(...parseEnvList(process.env.REACT_APP_GEMINI_API_KEYS));
    if (process.env.API_KEY) keys.unshift(process.env.API_KEY);
    if (process.env.REACT_APP_API_KEY) keys.unshift(process.env.REACT_APP_API_KEY);
    if (process.env.VITE_API_KEY) keys.unshift(process.env.VITE_API_KEY);
  }
  
  // Check import.meta.env (Vite)
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    const env = (import.meta as any).env;
    if (env.VITE_GEMINI_API_KEYS) keys.unshift(...parseEnvList(env.VITE_GEMINI_API_KEYS));
    if (env.VITE_API_KEY) keys.unshift(env.VITE_API_KEY);
    if (env.API_KEY) keys.unshift(env.API_KEY);
  }

  // Deduplicate and filter empty
  return Array.from(new Set(keys)).filter(k => !!k && k.trim() !== '');
};

/**
 * OpenAI Compatible API Call (DeepSeek, ChatGPT, etc.)
 */
const callOpenAICompatible = async (params: any, providerConfig: any) => {
    if (!providerConfig.apiKey) throw new Error("API Key is required for non-Google providers. Please configure in Admin > System Settings.");
    
    const messages = [];
    let systemPrompt = "";

    if (params.config?.systemInstruction) {
        systemPrompt += params.config.systemInstruction;
    }

    if (params.config?.responseSchema) {
        systemPrompt += "\n\nCRITICAL: You must output a valid JSON object matching this structure. Do not include markdown formatting.\n";
        systemPrompt += "Expected JSON Structure: " + JSON.stringify(params.config.responseSchema, null, 2);
    }

    if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
    }

    const content = params.contents;
    let userMessageContent: any = "";

    if (typeof content === 'string') {
        userMessageContent = content;
    } 
    else if (content.parts) {
        if (content.parts.length === 1 && content.parts[0].text) {
            userMessageContent = content.parts[0].text;
        } else {
            userMessageContent = [];
            for (const part of content.parts) {
                if (part.text) {
                    userMessageContent.push({ type: "text", text: part.text });
                } else if (part.inlineData) {
                    const mime = part.inlineData.mimeType;
                    const b64 = part.inlineData.data;
                    userMessageContent.push({ 
                        type: "image_url", 
                        image_url: { url: `data:${mime};base64,${b64}` } 
                    });
                }
            }
        }
    }

    messages.push({ role: "user", content: userMessageContent });

    const payload: any = {
        model: providerConfig.modelId,
        messages: messages,
        temperature: params.config?.temperature || 0.7,
    };

    if (params.config?.responseMimeType === "application/json") {
        payload.response_format = { type: "json_object" };
    }

    const response = await fetch(`${providerConfig.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${providerConfig.apiKey}`
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`${providerConfig.provider} API Error: ${err}`);
    }

    const data = await response.json();
    
    const textOutput = data.choices[0]?.message?.content || "";
    return {
        candidates: [{
            content: {
                parts: [{ text: textOutput }]
            }
        }]
    };
};

/**
 * Main Wrapper with Multi-Key Rotation
 * Automatically switches keys on 429/403 errors.
 */
const safeGenerateContent = async (params: any, retries = 3, initialDelay = 3000, keyOffset = 0): Promise<any> => {
    // Reload config on every call
    const currentConfig = getModelConfig();
    const currentProvider = currentConfig.provider || 'google';
    
    try {
        if (currentProvider === 'google') {
            const keys = getAvailableApiKeys();
            if (keys.length === 0) throw new Error("No API Keys found in pool or environment.");
            
            // Round-robin selection based on retries/offset
            const activeKey = keys[keyOffset % keys.length];
            
            // Debug only: console.log(`[Gemini] Using Key Index: ${keyOffset % keys.length} / ${keys.length}`); 
            
            const ai = new GoogleGenAI({ apiKey: activeKey });
            return await ai.models.generateContent({
                model: params.model, 
                contents: params.contents,
                config: params.config
            });
        } else {
            const providerParams = { ...currentConfig, provider: currentProvider };
            return await callOpenAICompatible(params, providerParams);
        }
    } catch (e: any) {
        console.warn(`AI Generation Error (Retries: ${retries}, KeyOffset: ${keyOffset}):`, e.message || e);
        
        // Check for 429 Rate Limit or 403 Quota Exceeded or 503 Overload
        const isRateLimit = e.message?.includes('429') || e.status === 429 || e.message?.includes('quota') || e.status === 403;
        const isServerOverload = e.message?.includes('503') || e.status === 503;

        if (retries > 0) {
            if (isRateLimit) {
                // IMMEDIATE ROTATION: Try next key without waiting
                console.log("Quota limit hit. Rotating to next API Key immediately...");
                return safeGenerateContent(params, retries - 1, 500, keyOffset + 1);
            }
            
            if (isServerOverload) {
                // Exponential backoff for server issues
                const waitTime = initialDelay * (2 ** (3 - retries));
                await delay(waitTime);
                return safeGenerateContent(params, retries - 1, initialDelay, keyOffset);
            }
            
            // Standard Retry
            await delay(1000);
            return safeGenerateContent(params, retries - 1, initialDelay, keyOffset);
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
    } catch (e) {
        return '';
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
      model: MODEL_ID, 
      contents: `Provide a single, very short conceptual hint (max 15 words) for this ${subject} question. Do NOT solve it. Question: ${statement.substring(0, 300)}...`
    });
    return extractText(response) || "Recall basic principles.";
  } catch (e) {
    return "Check your concepts.";
  }
};

export const refineQuestionText = async (text: string): Promise<string> => {
  try {
    const response = await safeGenerateContent({
      model: MODEL_ID,
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
    1. Return strictly valid JSON array. Do not use Markdown code blocks.
    2. Use LaTeX for math ($...$). CRITICAL: You MUST double-escape all backslashes. 
       Example: Use "\\\\alpha" instead of "\\alpha". Use "\\\\frac" instead of "\\frac".
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
      model: MODEL_ID,
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
    // Sequential Execution with rotation awareness
    // We add small delays to prevent hitting burst limits on a single key if rotation hasn't triggered yet
    
    // 1. Physics
    const physics = await generateJEEQuestions(Subject.Physics, config.physics.mcq + config.physics.numerical, ExamType.Advanced, config.physics.chapters, Difficulty.Hard, config.physics.topics, { mcq: config.physics.mcq, numerical: config.physics.numerical });
    await delay(2000); 

    // 2. Chemistry
    const chemistry = await generateJEEQuestions(Subject.Chemistry, config.chemistry.mcq + config.chemistry.numerical, ExamType.Advanced, config.chemistry.chapters, Difficulty.Hard, config.chemistry.topics, { mcq: config.chemistry.mcq, numerical: config.chemistry.numerical });
    await delay(2000); 

    // 3. Mathematics
    const mathematics = await generateJEEQuestions(Subject.Mathematics, config.mathematics.mcq + config.mathematics.numerical, ExamType.Advanced, config.mathematics.chapters, Difficulty.Hard, config.mathematics.topics, { mcq: config.mathematics.mcq, numerical: config.mathematics.numerical });

    return {
        physics: physics || [],
        chemistry: chemistry || [],
        mathematics: mathematics || []
    };
  } catch (error: any) {
    console.error("Full Paper Generation Critical Failure:", error);
    return { physics: [], chemistry: [], mathematics: [] };
  }
};

export const parseDocumentToQuestions = async (questionFile: File, solutionFile?: File): Promise<Question[]> => {
  const qBase64DataUrl = await fileToBase64(questionFile);
  const parts: any[] = [];

  const currentProvider = config.provider || 'google';
  
  const qBase64 = qBase64DataUrl.split(',')[1];
  parts.push({ inlineData: { mimeType: questionFile.type, data: qBase64 } });
  
  if (solutionFile) {
    const sBase64DataUrl = await fileToBase64(solutionFile);
    const sBase64 = sBase64DataUrl.split(',')[1];
    parts.push({ inlineData: { mimeType: solutionFile.type, data: sBase64 } });
  }

  const prompt = `Extract every question from these documents into a structured JSON array. 
  RETURN ONLY RAW JSON. NO MARKDOWN. NO \`\`\`.
  CRITICAL: Escape all backslashes in LaTeX math. Example: use "\\\\alpha" instead of "\\alpha".
  
  Expected JSON format:
  [
    {
      "subject": "Physics/Chemistry/Mathematics",
      "statement": "Question text...",
      "type": "MCQ/Numerical",
      "options": ["A", "B", "C", "D"], // Only for MCQ
      "correctAnswer": "0", // Index for MCQ, Value for Numerical
      "solution": "Detailed solution...",
      "explanation": "Brief concept explanation...",
      "concept": "Core topic name",
      "difficulty": "Medium"
    }
  ]
  `;

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
      config: { 
          // responseMimeType: "application/json", // Disabled to avoid model errors, we parse manually
          safetySettings: safetySettings 
      }
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
