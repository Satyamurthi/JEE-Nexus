
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { Subject, ExamType, Question, QuestionType, Difficulty } from "./types";
import { NCERT_CHAPTERS } from "./constants";

// FIX: Adhere to API key guidelines by initializing directly with process.env.API_KEY.
// Initialize AI client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Returns the shared AI client instance
const getAI = () => {
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
const GEN_MODEL = config.genModel || "gemini-3-flash-preview";
const VISION_MODEL = config.visionModel || "gemini-2.0-flash-exp";
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

/**
 * Robust JSON cleaner and parser specifically for LLM-generated JSON containing LaTeX.
 * LLMs often fail to escape backslashes correctly in JSON strings.
 */
const cleanAndParseJSON = (text: string) => {
  if (!text) return null;

  // 1. Remove Markdown code blocks
  let cleanText = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  
  // 2. Locate the outermost JSON array or object
  const firstOpenBracket = cleanText.indexOf('[');
  const firstOpenBrace = cleanText.indexOf('{');
  const lastCloseBracket = cleanText.lastIndexOf(']');
  const lastCloseBrace = cleanText.lastIndexOf('}');

  const start = (firstOpenBracket !== -1 && (firstOpenBrace === -1 || firstOpenBracket < firstOpenBrace)) ? firstOpenBracket : firstOpenBrace;
  const end = (lastCloseBracket !== -1 && (lastCloseBrace === -1 || lastCloseBracket > lastCloseBrace)) ? lastCloseBracket : lastCloseBrace;

  if (start !== -1 && end !== -1) {
    cleanText = cleanText.substring(start, end + 1);
  }

  try {
    // Attempt standard parse first
    return JSON.parse(cleanText);
  } catch (e) {
    console.warn("Standard JSON parse failed, attempting LaTeX-resilient sanitization...", e);
    
    let sanitized = cleanText;

    // Regex to handle backslashes more safely
    sanitized = sanitized.replace(/\\(u[\da-fA-F]{4}|[^"\\/bfnrtu])/g, '\\\\$1');

    try {
      const result = JSON.parse(sanitized);
      return result;
    } catch (e2) {
      console.error("Advanced sanitization failed. JSON Text Snippet:", sanitized.substring(0, 300));
      return null;
    }
  }
};

export const getQuickHint = async (statement: string, subject: string): Promise<string> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: GEN_MODEL,
      contents: `Provide a single, very short conceptual hint (max 15 words) for this ${subject} question. Do NOT solve it. Do NOT give formulas. Just the starting concept. Question: ${statement.substring(0, 300)}...`
    });
    return response.text || "Recall basic principles.";
  } catch (e) {
    return "Check your concepts.";
  }
};

export const refineQuestionText = async (text: string): Promise<string> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: GEN_MODEL,
      contents: `Fix grammar and clarity of this JEE question text. Keep LaTeX math ($...$) intact. Text: ${text}`
    });
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
  difficulty?: Difficulty,
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

  let topicFocus = "Cover a diverse range of high-weightage topics from the full Class 11 and 12 NCERT syllabus";
  
  if (!isFullSyllabus) {
    // Advanced Topic Focus Generation
    // We map each selected chapter to either "Any Topic" or "Specific Topics"
    const subjectChapters = NCERT_CHAPTERS[subject] || [];
    
    const constraints = chapters.map(chap => {
        const chapDef = subjectChapters.find(c => c.name === chap);
        // If we can't find definitions, default to whole chapter
        if (!chapDef) return `- Chapter: ${chap} (Focus: Balanced Mix of All Topics)`;

        // Find which topics from this chapter are selected
        const selectedTopicsForChap = chapDef.topics.filter(t => topics?.includes(t));
        
        if (selectedTopicsForChap.length > 0) {
            // Specific topics selected
            return `- Chapter: ${chap} (STRICTLY RESTRICT to topics: ${selectedTopicsForChap.join(', ')})`;
        } else {
            // No specific topics selected -> Random/Mixed for this chapter
            return `- Chapter: ${chap} (Focus: Random Balanced Mix of Topics)`;
        }
    });

    topicFocus = `
        Generate questions strictly distributed among the following chapters with specific constraints:
        ${constraints.join('\n')}
        
        Note: If a chapter specifies "Random Balanced Mix", choose diverse concepts from that chapter. 
        If it specifies "STRICTLY RESTRICT", do not step outside those topics.
    `;
  }

  const prompt = `
    Act as a strict JEE Exam Database.
    Generate a JSON Array of exactly ${count} ${subject} questions for ${type}.
    
    Target Scope: ${topicFocus}
    Difficulty Level: ${difficulty || 'JEE Standard'}
    Format: ${mcqCount} MCQs (Single Correct) and ${numericalCount} Numerical Value Questions.

    Output Rules:
    1. Return ONLY the JSON Array. No markdown formatting (no \`\`\`json).
    2. Use LaTeX for all mathematical expressions enclosed in $.
    3. CRITICAL: Escape all backslashes in strings. Use \\\\ instead of \\.
       Example: "\\\\frac{1}{2}" instead of "\\frac{1}{2}".
    
    JSON Object Schema:
    {
      "subject": "${subject}",
      "chapter": "${chapters && chapters.length > 0 ? chapters.join(', ') : 'Mixed Syllabus'}",
      "type": "MCQ" or "Numerical",
      "statement": "Question text...",
      "options": ["A", "B", "C", "D"], // Empty for Numerical
      "correctAnswer": "0" (index for MCQ) or "Value" (for Numerical),
      "solution": "Step-by-step solution...",
      "explanation": "Concept explanation...",
      "markingScheme": { "positive": 4, "negative": 1 }
    }
  `;

  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  ];

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: GEN_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        safetySettings: safetySettings,
      }
    });

    const data = cleanAndParseJSON(response.text);
    return Array.isArray(data) ? data : [];
  } catch (error: any) {
    console.error("Gemini Generation Failure:", error);
    throw error;
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
    // Generate each subject in parallel to ensure granular control logic is respected per subject
    const [physicsQuestions, chemistryQuestions, mathematicsQuestions] = await Promise.all([
        generateJEEQuestions(
            Subject.Physics, 
            config.physics.mcq + config.physics.numerical, 
            ExamType.Main, 
            config.physics.chapters, 
            Difficulty.Medium, 
            config.physics.topics,
            { mcq: config.physics.mcq, numerical: config.physics.numerical }
        ),
        generateJEEQuestions(
            Subject.Chemistry, 
            config.chemistry.mcq + config.chemistry.numerical, 
            ExamType.Main, 
            config.chemistry.chapters, 
            Difficulty.Medium, 
            config.chemistry.topics,
            { mcq: config.chemistry.mcq, numerical: config.chemistry.numerical }
        ),
        generateJEEQuestions(
            Subject.Mathematics, 
            config.mathematics.mcq + config.mathematics.numerical, 
            ExamType.Main, 
            config.mathematics.chapters, 
            Difficulty.Medium, 
            config.mathematics.topics,
            { mcq: config.mathematics.mcq, numerical: config.mathematics.numerical }
        )
    ]);

    return {
        physics: physicsQuestions,
        chemistry: chemistryQuestions,
        mathematics: mathematicsQuestions
    };

  } catch (error: any) {
    console.error("Full Paper Generation Failure:", error);
    throw error;
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
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: VISION_MODEL, // Keep using 2.0-flash for vision as it's multimodal optimized
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
    return [];
  }
};

export const getDeepAnalysis = async (result: any) => {
    try {
        const ai = getAI();
        const prompt = `Analyze these JEE mock results: ${JSON.stringify(result)}. Provide deep pedagogical feedback.`;
        const response = await ai.models.generateContent({
            model: ANALYSIS_MODEL,
            contents: prompt
        });
        return response.text || "Summary not available.";
    } catch (e) {
        return "Analysis failed.";
    }
};
