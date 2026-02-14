import { Question, Subject, QuestionType, Difficulty } from "../types";

const HF_DATASET_URL = "https://datasets-server.huggingface.co/rows?dataset=Reja1%2Fjee-neet-benchmark&config=default&split=train";

export const fetchJEEFromHuggingFace = async (subject: Subject, count: number): Promise<Question[]> => {
    try {
        // Reduced offset to ensure we get data even if dataset is small
        const randomOffset = Math.floor(Math.random() * 10);
        
        const response = await fetch(`${HF_DATASET_URL}&offset=${randomOffset}&limit=100`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            mode: 'cors',
            credentials: 'omit'
        });

        if (!response.ok) {
            // Throwing explicit error to be caught below
            throw new Error(`HF API Error: ${response.status} ${response.statusText}`);
        }

        const json = await response.json();
        const rows = json.rows || [];

        // Map HF format to our standardized Question format
        const mappedQuestions: Question[] = rows
            .map((row: any, index: number) => {
                const data = row.row;
                // Heuristic to match subject if the dataset doesn't explicitly flag it per row
                // Most JEE datasets on HF are mixed; we filter by keywords
                const text = (data.question || data.text || "").toLowerCase();
                const isPhysics = text.includes("force") || text.includes("mass") || text.includes("velocity") || text.includes("circuit") || text.includes("field") || text.includes("energy");
                const isChem = text.includes("reaction") || text.includes("mole") || text.includes("organic") || text.includes("compound") || text.includes("acid");
                const isMath = text.includes("integral") || text.includes("matrix") || text.includes("probability") || text.includes("function") || text.includes("triangle");

                let detectedSubject = Subject.Physics;
                if (isChem && !isPhysics) detectedSubject = Subject.Chemistry;
                if (isMath && !isPhysics && !isChem) detectedSubject = Subject.Mathematics;

                // If subject is requested, we try to be lenient or exact. 
                // For now, strict filter to ensure quality.
                if (detectedSubject !== subject) return null;

                // Handle options if they come as an object/dictionary (common in some HF datasets)
                let optionsList = ["Option A", "Option B", "Option C", "Option D"];
                if (Array.isArray(data.options)) {
                    optionsList = data.options;
                } else if (typeof data.options === 'object' && data.options !== null) {
                    optionsList = Object.values(data.options);
                }

                return {
                    id: `hf-${Date.now()}-${index}`,
                    subject: detectedSubject,
                    chapter: data.chapter || "General Practice",
                    type: data.options ? QuestionType.MCQ : QuestionType.Numerical,
                    difficulty: "Hard",
                    statement: data.question || data.text,
                    options: optionsList,
                    correctAnswer: data.answer || data.correct_option || "1",
                    solution: data.solution || data.explanation || "Detailed solution available in reference material.",
                    explanation: data.explanation || "JEE Level Concept Application.",
                    concept: data.topic || "Core JEE Advanced",
                    markingScheme: { positive: 4, negative: 1 }
                };
            })
            .filter((q: any) => q !== null);

        return mappedQuestions.sort(() => 0.5 - Math.random()).slice(0, count);
    } catch (error) {
        console.warn("Hugging Face Fetch Failed:", error);
        return [];
    }
};