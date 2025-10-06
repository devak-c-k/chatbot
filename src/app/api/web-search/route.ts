// Simple Tavily web search proxy to keep the API key server-side
// POST { query: string }
// Returns: { answer?: string, results: Array<{ title: string; url: string; content: string; score?: number }> }

export const maxDuration = 15; // keep it quick

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

export async function POST(req: Request) {
  try {
    const { query } = await req.json();
    if (!query || typeof query !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid payload: missing query' }), { status: 400 });
    }

    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Tavily API key not configured on server' }), { status: 500 });
    }

    const tavilyRes = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: 5,
        include_answer: true,
        search_depth: 'basic',
      }),
    });

    if (!tavilyRes.ok) {
      const text = await tavilyRes.text();
      return new Response(JSON.stringify({ error: 'Tavily request failed', details: text }), { status: 502 });
    }

    const data = await tavilyRes.json();
    const results: TavilyResult[] = Array.isArray(data.results) ? data.results.map((r: any) => ({
      title: r.title,
      url: r.url,
      content: r.content,
      score: r.score,
    })) : [];

    return Response.json({ answer: data.answer, results });
  } catch (err) {
    console.error('Web search error:', err);
    return new Response(JSON.stringify({ error: 'Failed to perform web search' }), { status: 500 });
  }
}
