import { Question, Subject, QuestionType, Difficulty } from "../types";

const HF_DATASET_URL = "https://datasets-server.huggingface.co/rows?dataset=Satyamurthi%2FJEE_Questions&config=default&split=train";

export const fetchJEEFromHuggingFace = async (subject: Subject, count: number): Promise<Question[]> => {
    try {
        // We fetch a random offset to get different questions each time
        const randomOffset = Math.floor(Math.random() * 50);
        const response = await fetch(`${HF_DATASET_URL}&offset=${randomOffset}&limit=100`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) throw new Error("HF API Unavailable");

        // Fix: Standard fetch Response does not have a 'data' property. Use the .json() method instead.
        const json = await response.json();
        const rows = json.rows || [];

        // Map HF format to our standardized Question format
        const mappedQuestions: Question[] = rows
            .map((row: any, index: number) => {
                const data = row.row;
                // Heuristic to match subject if the dataset doesn't explicitly flag it per row
                // Most JEE datasets on HF are mixed; we filter by keywords
                const text = (data.question || data.text || "").toLowerCase();
                const isPhysics = text.includes("force") || text.includes("mass") || text.includes("velocity") || text.includes("circuit");
                const isChem = text.includes("reaction") || text.includes("mole") || text.includes("organic") || text.includes("compound");
                const isMath = text.includes("integral") || text.includes("matrix") || text.includes("probability") || text.includes("function");

                let detectedSubject = Subject.Physics;
                if (isChem) detectedSubject = Subject.Chemistry;
                if (isMath) detectedSubject = Subject.Mathematics;

                if (detectedSubject !== subject) return null;

                return {
                    id: `hf-${Date.now()}-${index}`,
                    subject: detectedSubject,
                    chapter: data.chapter || "General",
                    type: data.options ? QuestionType.MCQ : QuestionType.Numerical,
                    difficulty: "Hard",
                    statement: data.question || data.text,
                    options: data.options || ["Option A", "Option B", "Option C", "Option D"],
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