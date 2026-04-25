import { Subject, ExamType, Question } from "./types";

// NVIDIA API Integration for Google Gemma 3
const NVIDIA_INVOKE_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const MODEL_NAME = "google/gemma-3-27b-it"; 

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Global key management
let keyPool: string[] = [];
let currentKeyIndex = 0;

const initializeKeyPool = async () => {
    if (keyPool.length > 0) return;

    // 1. Get raw string from env or use the default provided by user
    let rawKeys = process.env.VITE_NVIDIA_API_KEY || import.meta.env.VITE_NVIDIA_API_KEY || "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";
    
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

// Clean JSON response from LLM
const extractJson = (text: string) => {
    const jsonMatch = text.match(/```json\n([\s\S]*?)```/);
    if (jsonMatch) return jsonMatch[1];
    const match2 = text.match(/```\n([\s\S]*?)```/);
    if (match2) return match2[1];
    return text.trim();
};

const safeNVIDIACompletion = async (systemInstruction: string, userMessage: string, maxTokens: number = 8000): Promise<string> => {
    await initializeKeyPool();
    
    if (keyPool.length === 0) {
        throw new Error("AI Generation Failed: NVIDIA API Key is not configured.");
    }

    let lastError: any;
    const maxRetries = Math.max(keyPool.length, 3); 
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const apiKey = await getNextKey();
        console.log(`[NVIDIA AI] Attempt ${attempt + 1}/${maxRetries} using Key: ${apiKey.substring(0, 8)}...`);

        try {
            const payload = {
                model: MODEL_NAME,
                messages: [
                    { role: "system", content: systemInstruction },
                    { role: "user", content: userMessage }
                ],
                max_tokens: maxTokens,
                temperature: 0.20,
                top_p: 0.70,
                stream: false
            };

            const response = await fetch(NVIDIA_INVOKE_URL, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`NVIDIA API Error: ${response.status} ${errText}`);
            }

            const data = await response.json();
            return data.choices[0]?.message?.content || "";
            
        } catch (e: any) {
            lastError = e;
            console.warn(`[NVIDIA AI] Error on attempt: ${e.message}`);
            
            if (e.message?.includes("401") || e.message?.includes("403")) {
                continue; // Try next key
            }
            if (e.message?.includes("429")) {
                await delay(1500); 
                continue; 
            }
        }
    }
    
    console.error("[NVIDIA AI] All keys/retries exhausted.", lastError);
    throw lastError;
};

// ... questionSchema definition removed as not native to Gemma-3 Chat API...

export const generateJEEQuestions = async (subject: Subject, count: number, type: ExamType, chapters?: string[], difficulty?: string, topics?: string[], distribution?: { mcq: number, numerical: number }): Promise<Question[]> => {
  
  const allQuestions: Question[] = [];
  let totalMcqTarget = distribution ? distribution.mcq : Math.ceil(count * 0.8);
  let totalNumTarget = distribution ? distribution.numerical : count - totalMcqTarget;
  
  const isFullSyllabus = !chapters || chapters.length === 0;
  let topicFocus = isFullSyllabus ? "Full Syllabus" : `Chapters: ${chapters.join(', ')}`;
  if (topics && topics.length > 0) {
      topicFocus += ` | Specific Topics: ${topics.join(', ')}`;
  }

  try {
      console.log(`[AI] Generating ${count} unique questions for ${subject} (MCQ: ${totalMcqTarget}, Num: ${totalNumTarget})...`);
      
      const sessionEntropy = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      
      const systemInstruction = `You are an expert JEE coach. Generate HIGHLY UNIQUE, ORIGINAL problems. Do not provide common textbook problems. Use LaTeX for math.`;
      const prompt = `BatchID: ${sessionEntropy}. 
      Generate EXACTLY ${count} COMPLETELY UNIQUE and NEVER-BEFORE-SEEN questions for ${subject} (${type} level). 
      
      DISTRIBUTION:
      - Exactly ${totalMcqTarget} Multiple Choice Questions (type: "MCQ")
      - Exactly ${totalNumTarget} Numerical Value Questions (type: "Numerical")
      
      Scope: ${topicFocus}. 
      Difficulty: ${difficulty || 'Advanced'}.
      Use LaTeX for all formulas. 
      
      OUTPUT FORMAT:
      You MUST return ONLY a valid JSON array. Do not include markdown formatting or explanations outside of the JSON. It must match this exact structure for each item:
      [
        {
          "subject": "${subject}",
          "chapter": "Name of chapter",
          "type": "MCQ" or "Numerical",
          "difficulty": "Medium" or "Hard",
          "statement": "Question statement text here...",
          "options": ["Opt A", "Opt B", "Opt C", "Opt D"], 
          "correctAnswer": "A", 
          "solution": "Step by step solution...",
          "explanation": "Why this is correct...",
          "concept": "Underlying concept",
          "markingScheme": { "positive": 4, "negative": 1 }
        }
      ]
      Note: For "Numerical" type questions, leave "options" as an empty array [] and put the exact number string in "correctAnswer".`;
      
      const textResponse = await safeNVIDIACompletion(systemInstruction, prompt, 8000);
      
      if (textResponse) {
          try {
              const cleanJson = extractJson(textResponse);
              const data = JSON.parse(cleanJson);
              if (Array.isArray(data)) {
                  data.forEach((q: any) => {
                      const processedQ = {
                          ...q,
                          id: `ai-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                          subject: q.subject || subject,
                          type: q.type || (q.options && q.options.length > 0 ? 'MCQ' : 'Numerical'),
                          markingScheme: Object.assign({ positive: 4, negative: q.type === 'Numerical' ? 0 : 1 }, q.markingScheme || {})
                      };
                      allQuestions.push(processedQ);
                  });
              }
          } catch (parseErr) {
              console.warn("[AI] JSON Parse Failure on NVIDIA response.", parseErr);
              console.log("Raw Response received:", textResponse);
          }
      }
  } catch (e: any) {
      console.error("[AI] NVIDIA API failure:", e.message);
      // Don't throw immediately, let the padding handle incomplete arrays
  }

  let finalMcqs = allQuestions.filter(q => q.type === 'MCQ').slice(0, totalMcqTarget);
  let finalNums = allQuestions.filter(q => q.type === 'Numerical').slice(0, totalNumTarget);

  // PADDING LOGIC: Ensure exact counts are met even if AI under-delivers
  while (finalMcqs.length < totalMcqTarget) {
      finalMcqs.push({
          id: `placeholder-mcq-${Date.now()}-${finalMcqs.length}`,
          subject: subject,
          chapter: chapters?.[0] || "General",
          type: "MCQ",
          difficulty: "Medium",
          statement: "AI failed to generate this MCQ. Please regenerate the paper for a complete set.",
          options: ["Option A", "Option B", "Option C", "Option D"],
          correctAnswer: "A",
          solution: "N/A",
          explanation: "Placeholder due to AI generation shortfall.",
          concept: "N/A",
          markingScheme: { positive: 4, negative: 1 }
      });
  }

  while (finalNums.length < totalNumTarget) {
      finalNums.push({
          id: `placeholder-num-${Date.now()}-${finalNums.length}`,
          subject: subject,
          chapter: chapters?.[0] || "General",
          type: "Numerical",
          difficulty: "Medium",
          statement: "AI failed to generate this numerical question. Please regenerate the paper for a complete set.",
          correctAnswer: "0",
          solution: "N/A",
          explanation: "Placeholder due to AI generation shortfall.",
          concept: "N/A",
          markingScheme: { positive: 4, negative: 0 }
      });
  }

  return [...finalMcqs, ...finalNums];
};

export const getQuickHint = async (statement: string, subject: string): Promise<string> => {
  try {
    const text = await safeNVIDIACompletion(
      "You are a helpful tutor.",
      `Provide a single-sentence strategic hint for this ${subject} question: ${statement.substring(0, 500)}`
    );
    return text || "Focus on fundamental principles.";
  } catch (e) { return "Hint unavailable."; }
};

export const generateFullJEEDailyPaper = async (config: any): Promise<{ physics: Question[], chemistry: Question[], mathematics: Question[] }> => {
  try {
    const physics = await generateJEEQuestions(Subject.Physics, config.physics.mcq + config.physics.numerical, ExamType.Advanced, config.physics.chapters, 'Hard', config.physics.topics, config.physics);
    await delay(1000);
    const chemistry = await generateJEEQuestions(Subject.Chemistry, config.chemistry.mcq + config.chemistry.numerical, ExamType.Advanced, config.chemistry.chapters, 'Hard', config.chemistry.topics, config.chemistry);
    await delay(1000);
    const mathematics = await generateJEEQuestions(Subject.Mathematics, config.mathematics.mcq + config.mathematics.numerical, ExamType.Advanced, config.mathematics.chapters, 'Hard', config.mathematics.topics, config.mathematics);
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
    // NVIDIA gemma-3 text chat doesn't natively support multiple arbitrary documents in simple array format via this endpoint natively or if it does, it needs image URLs.
    // For now we try to send the prompt. It might fail if files are sent. We will extract text or use basic prompt placeholder.
    // Assuming user might upload images. Gemma 3 vision on NVIDIA API accepts images as base64 in messages: 
    // { role: "user", content: [ { type: "text", text: "..." }, { type: "image_url", image_url: {"url": "data:image/png;base64,..."} } ] }
    
    let contentArr: any[] = [
        { type: "text", text: `Digitize and structure the JEE questions from these documents. Output a JSON array matching the JEE question schema. Use LaTeX for math. Format as exactly shown below: \n[\n  {\n    "subject": "Physics",\n    "chapter": "String",\n    "type": "MCQ",\n    "difficulty": "Medium",\n    "statement": "String",\n    "options": ["A", "B", "C", "D"],\n    "correctAnswer": "A",\n    "solution": "String",\n    "explanation": "String",\n    "concept": "String",\n    "markingScheme": { "positive": 4, "negative": 1 }\n  }\n]` }
    ];

    if (questionFile.type.startsWith('image/')) {
        const qData = await fileToBase64(questionFile);
        contentArr.push({ type: "image_url", image_url: { url: `data:${questionFile.type};base64,${qData}` } });
    }
    
    if (solutionFile && solutionFile.type.startsWith('image/')) {
        const sData = await fileToBase64(solutionFile);
        contentArr.push({ type: "image_url", image_url: { url: `data:${solutionFile.type};base64,${sData}` } });
    }
    
    // Fallback if not an image (e.g. PDF might not be supported natively by chat API without text extraction)
    if (!questionFile.type.startsWith('image/')) {
        contentArr[0].text += `\n[NOTE: Non-image file uploaded. This AI endpoint may not be able to read this file natively unless it's text. Please try uploading images.]`;
    }

    const payload = {
        model: MODEL_NAME,
        messages: [{ role: "user", content: contentArr }],
        max_tokens: 4096,
        temperature: 0.2
    };

    await initializeKeyPool();
    const response = await fetch(NVIDIA_INVOKE_URL, {
        method: "POST",
        headers: { "Authorization": `Bearer ${keyPool[0]}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    
    if (!response.ok) throw new Error("Document parsing failed API request");
    
    const responseData = await response.json();
    const text = responseData.choices[0]?.message?.content;
    
    if (!text) throw new Error("Parser response empty");
    const jsonStr = extractJson(text);
    const parsed = JSON.parse(jsonStr);
    
    if (!Array.isArray(parsed)) throw new Error("Unexpected data structure");
    return parsed.map((q, idx) => ({ ...q, id: `parsed-${Date.now()}-${idx}` }));
  } catch (error) { 
    console.error("Document parsing failed:", error);
    throw error; 
  }
};

export const getDeepAnalysis = async (result: any) => {
    try {
        const text = await safeNVIDIACompletion(
            "You are an expert tutor providing constructive feedback.",
            `Review this JEE performance data and provide a mentorship summary including strong areas and critical improvements: ${JSON.stringify(result).substring(0, 8000)}` 
        );
        return text || "Analysis complete. Keep practicing consistent drills.";
    } catch (e) { 
        return "Cognitive analysis is temporarily unavailable due to a network disruption."; 
    }
};