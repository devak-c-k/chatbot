import { streamText, convertToModelMessages } from "ai";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const result = streamText({
      model: "gemini-2.5-flash", // Fast model for real-time chat (immediate streaming, low latency)
      system: "You are a helpful coding assistant where your work is to help developers to write code instead of giving the theory give the code your full attention.",                        // Reasoning models ('openai/gpt-5') would add 10-15s delay - poor UX for chat
      messages: convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Chat API error:", error);

    // Return a proper error response
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