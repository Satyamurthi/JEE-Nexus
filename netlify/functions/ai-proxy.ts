
import { GoogleGenAI } from "@google/genai";

export const handler = async (event: any, context: any) => {
    // Handle CORS preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405, 
            body: JSON.stringify({ error: { message: 'Method Not Allowed' } }) 
        };
    }

    try {
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            console.error("Server API_KEY is missing in environment variables.");
            return {
                statusCode: 500,
                body: JSON.stringify({ error: { message: "Server configuration error: API_KEY missing" } })
            };
        }

        const body = JSON.parse(event.body || '{}');
        const { model, contents, config } = body;

        const ai = new GoogleGenAI({ apiKey });
        
        // Call the Google GenAI SDK
        const response = await ai.models.generateContent({
            model: model || 'gemini-3-flash-preview',
            contents,
            config
        });

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify(response)
        };

    } catch (error: any) {
        console.error("AI Proxy Execution Error:", error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
                error: { 
                    message: error.message || "Internal Server Error during AI generation",
                    details: error.toString()
                } 
            })
        };
    }
};
