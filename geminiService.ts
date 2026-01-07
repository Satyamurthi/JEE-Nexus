
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
// Legacy fallback or new fields
const PROVIDER = config.provider || 'google'; 
const API_KEY = config.apiKey || ''; 
const BASE_URL = config.baseUrl || '';
const MODEL_ID = config.modelId || config.genModel || "gemini-3-flash-preview"; 

// Constants for Google
const VISION_MODEL = config.visionModel || "gemini-2.5-flash-image"; 
const ANALYSIS_MODEL = config.analysisModel || "gemini-3-flash-preview";

// Helper to convert File to Base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // OpenAI needs full data url for image_url, Gemini needs raw base64
      // We will resolve with full data URL and split if needed
      resolve(result);
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
 * Calls the Netlify Proxy Function (Google Only)
 */
const callAIProxy = async (params: any) => {
    try {
        const response = await fetch('/.netlify/functions/ai-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            const data = await response.json();
            if (!response.ok) throw { status: response.status, message: data.error?.message || response.statusText };
            return data;
        } else {
            const text = await response.text();
            throw { status: response.status, message: `Proxy connection failed: ${text.substring(0, 100)}` };
        }
    } catch (error: any) {
        console.error("Proxy Call Failed:", error);
        throw error;
    }
};

/**
 * OpenAI Compatible API Call (DeepSeek, ChatGPT, etc.)
 */
const callOpenAICompatible = async (params: any, providerConfig: any) => {
    if (!providerConfig.apiKey) throw new Error("API Key is required for non-Google providers. Please configure in Admin > System Settings.");
    
    const messages = [];
    let systemPrompt = "";

    // 1. Handle Config/System Prompt
    if (params.config?.systemInstruction) {
        systemPrompt += params.config.systemInstruction;
    }

    // 2. Handle Schema (Translate Google Schema to Text Instruction)
    if (params.config?.responseSchema) {
        systemPrompt += "\n\nCRITICAL: You must output a valid JSON object matching this structure. Do not include markdown formatting.\n";
        systemPrompt += "Expected JSON Structure: " + JSON.stringify(params.config.responseSchema, null, 2);
    }

    if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
    }

    // 3. Handle Contents (Text or Image)
    const content = params.contents;
    let userMessageContent: any = "";

    // Check if simple string
    if (typeof content === 'string') {
        userMessageContent = content;
    } 
    // Check if Object with parts (Gemini style)
    else if (content.parts) {
        if (content.parts.length === 1 && content.parts[0].text) {
            userMessageContent = content.parts[0].text;
        } else {
            // Multimodal conversion
            userMessageContent = [];
            for (const part of content.parts) {
                if (part.text) {
                    userMessageContent.push({ type: "text", text: part.text });
                } else if (part.inlineData) {
                    // Gemini uses raw base64 in inlineData.data
                    // OpenAI needs "data:image/jpeg;base64,..."
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

    // DeepSeek/OpenAI JSON Mode
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
    
    // Normalize to Gemini Candidate Structure for compatibility
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
 * Main Wrapper
 */
const safeGenerateContent = async (params: any, retries = 3): Promise<any> => {
    // Reload config on every call to ensure latest settings
    const currentConfig = getModelConfig();
    const currentProvider = currentConfig.provider || 'google';
    
    try {
        if (currentProvider === 'google') {
            // Check if user has a custom Google Key
            if (currentConfig.apiKey) {
                const { GoogleGenAI } = await import("@google/genai");
                const ai = new GoogleGenAI({ apiKey: currentConfig.apiKey });
                return await ai.models.generateContent({
                    model: params.model, // Use the passed model (usually default or configured)
                    contents: params.contents,
                    config: params.config
                });
            }
            return await callAIProxy(params);
        } else {
            // Override model with provider specific model from config
            const providerParams = { ...currentConfig, provider: currentProvider };
            return await callOpenAICompatible(params, providerParams);
        }
    } catch (e: any) {
        console.warn("AI Generation Error:", e);
        if (retries > 0) {
            await delay(2000);
            return safeGenerateContent(params, retries - 1);
        }
        throw e;
    }
};

// Helper to extract text from Raw JSON response (Proxy or Adapter)
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

// Define response schema (Used for Google, translated for others)
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
      model: MODEL_ID, // Use configured model
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
  const qBase64DataUrl = await fileToBase64(questionFile);
  const parts: any[] = [];

  // For Gemini: Extract base64 from data URL (data:image/png;base64,ABC...) -> ABC...
  // For OpenAI: Use full data URL
  
  const currentProvider = config.provider || 'google';
  
  if (currentProvider === 'google') {
      // Gemini Format
      const qBase64 = qBase64DataUrl.split(',')[1];
      parts.push({ inlineData: { mimeType: questionFile.type, data: qBase64 } });
      
      if (solutionFile) {
        const sBase64DataUrl = await fileToBase64(solutionFile);
        const sBase64 = sBase64DataUrl.split(',')[1];
        parts.push({ inlineData: { mimeType: solutionFile.type, data: sBase64 } });
      }
  } else {
      // OpenAI/DeepSeek Format (handled in adapter, pass full structure)
      // We pass it as "inlineData" with a special flag or just handle it in the adapter by checking if 'data:' exists?
      // Actually, we can reuse the Gemini structure structure but keep the full DataURL in the 'data' field 
      // if we are lazy, BUT the adapter expects specific logic.
      
      // Let's stick to Gemini format here, and let the adapter reconstruct the Data URL if needed.
      const qBase64 = qBase64DataUrl.split(',')[1];
      parts.push({ inlineData: { mimeType: questionFile.type, data: qBase64 } });
      
      if (solutionFile) {
        const sBase64DataUrl = await fileToBase64(solutionFile);
        const sBase64 = sBase64DataUrl.split(',')[1];
        parts.push({ inlineData: { mimeType: solutionFile.type, data: sBase64 } });
      }
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
      model: MODEL_ID, // Ensure model supports vision (e.g. gpt-4o, gemini-flash)
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
            model: MODEL_ID,
            contents: prompt
        });
        return extractText(response) || "Summary not available.";
    } catch (e) {
        return "Analysis failed.";
    }
};
