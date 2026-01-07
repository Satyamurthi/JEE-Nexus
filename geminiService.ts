
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
// API Key is handled via process.env.API_KEY for Google, but keeping legacy fallback for other providers
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
        // 1. Identify backslashes that are NOT followed by valid JSON escape characters (" \ / b f n r t u)
        // 2. Double escape them (e.g., \alpha -> \\alpha)
        // The regex matches a sequence of backslashes (\+) followed by an invalid escape char
        const fixedText = cleanText.replace(/(\\+)([^"\\/bfnrtu])/g, (match, backslashes, char) => {
            // If we have an odd number of backslashes (1, 3, etc.), the last one is trying to escape 'char'
            // Since 'char' is not a valid JSON escape, we must escape the backslash itself.
            if (backslashes.length % 2 === 1) {
                return backslashes + "\\" + char;
            }
            // If even (2, 4), the backslashes are already paired, so we leave it alone.
            return match;
        });
        
        return JSON.parse(fixedText);
    } catch (e2) {
        console.error("JSON Parse failed after sanitization:", e2);
        // Last resort: Try to extract array if it looks like one
        const arrayMatch = cleanText.match(/\[.*\]/s);
        if (arrayMatch) {
            try {
                 // Try recursive sanitization on just the array part
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
 * Main Wrapper
 */
const safeGenerateContent = async (params: any, retries = 3): Promise<any> => {
    // Reload config on every call to ensure latest settings
    const currentConfig = getModelConfig();
    const currentProvider = currentConfig.provider || 'google';
    
    try {
        if (currentProvider === 'google') {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
        console.warn("AI Generation Error:", e);
        if (retries > 0) {
            // Backoff strategy for rate limits
            await delay(4000); 
            return safeGenerateContent(params, retries - 1);
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
    // Sequential Execution to prevent Rate Limiting on Preview Models
    
    // 1. Physics
    const physics = await generateJEEQuestions(Subject.Physics, config.physics.mcq + config.physics.numerical, ExamType.Advanced, config.physics.chapters, Difficulty.Hard, config.physics.topics, { mcq: config.physics.mcq, numerical: config.physics.numerical });
    await delay(4000); // 4s Backoff to match RPM limits

    // 2. Chemistry
    const chemistry = await generateJEEQuestions(Subject.Chemistry, config.chemistry.mcq + config.chemistry.numerical, ExamType.Advanced, config.chemistry.chapters, Difficulty.Hard, config.chemistry.topics, { mcq: config.chemistry.mcq, numerical: config.chemistry.numerical });
    await delay(4000); 

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
  
  if (currentProvider === 'google') {
      const qBase64 = qBase64DataUrl.split(',')[1];
      parts.push({ inlineData: { mimeType: questionFile.type, data: qBase64 } });
      
      if (solutionFile) {
        const sBase64DataUrl = await fileToBase64(solutionFile);
        const sBase64 = sBase64DataUrl.split(',')[1];
        parts.push({ inlineData: { mimeType: solutionFile.type, data: sBase64 } });
      }
  } else {
      const qBase64 = qBase64DataUrl.split(',')[1];
      parts.push({ inlineData: { mimeType: questionFile.type, data: qBase64 } });
      
      if (solutionFile) {
        const sBase64DataUrl = await fileToBase64(solutionFile);
        const sBase64 = sBase64DataUrl.split(',')[1];
        parts.push({ inlineData: { mimeType: solutionFile.type, data: sBase64 } });
      }
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
