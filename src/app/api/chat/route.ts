import { streamText, convertToModelMessages } from "ai";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Heuristic to detect if last user message contains images (either via parts or markdown data/remote image links)
function lastUserMessageHasImage(rawMessages: any[]): boolean {
    const lastUser = [...rawMessages].reverse().find(m => m?.role === 'user');
    if (!lastUser) return false;
    // If parts API shape with files
    if (Array.isArray(lastUser.parts)) {
        if (lastUser.parts.some((p: any) => p?.type === 'file' && typeof p.mediaType === 'string' && p.mediaType.startsWith('image/'))) {
            return true;
        }
        if (lastUser.parts.some((p: any) => p?.type === 'image')) return true; // future proof
        // Aggregate text to run regex below
    }
    const textSegments: string[] = [];
    if (typeof lastUser.content === 'string') textSegments.push(lastUser.content);
    if (Array.isArray(lastUser.parts)) {
        for (const part of lastUser.parts) {
            if (part?.type === 'text' && typeof part.text === 'string') textSegments.push(part.text);
        }
    }
    const combined = textSegments.join('\n');
    if (!combined) return false;
    const markdownImageRegex = /!\[[^\]]*\]\((?:data:image\/|https?:\/\/[^)]+\.(?:png|jpe?g|gif|webp|svg))/i;
    return markdownImageRegex.test(combined);
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { messages } = body;
        if (!Array.isArray(messages)) {
            return new Response(JSON.stringify({ error: 'Invalid payload: messages must be an array' }), { status: 400 });
        }

        // Decide model: if image present -> image-capable model, else text model
        const hasImage = lastUserMessageHasImage(messages);
        const modelName = hasImage ? "google/gemini-2.5-flash-image-preview" : "gemini-2.5-flash";

        const result = streamText({
            model: modelName,
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