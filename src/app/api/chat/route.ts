import { streamText, convertToModelMessages } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { getAvailableApiKey } from "@/lib/kv";



export const maxDuration = 30;


export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { messages } = body;
        if (!Array.isArray(messages)) {
            return new Response(JSON.stringify({ error: 'Invalid payload: messages must be an array' }), { status: 400 });
        }

    const { apiKey } = await getAvailableApiKey();
    const google = createGoogleGenerativeAI({ apiKey });
   
        const modelName = "gemini-2.5-flash";

        const result = streamText({
            model: google(modelName),
            system: "You are a helpful multimodal coding assistant. Provide concise, code-focused answers.",
            messages: convertToModelMessages(messages),
        });

        return result.toUIMessageStreamResponse();
    } catch (error) {
        console.error("Chat API error:", error);
        return new Response(
            JSON.stringify({
                error: "Failed to process chat request",
                details: error instanceof Error ? error.message : "Unknown error",
            }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            },
        );
    }
}