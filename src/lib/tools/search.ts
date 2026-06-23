/**
 * Web Search Tool
 * 
 * Supports multiple search providers:
 * 1. Tavily API (best for research - structured results)
 * 2. Serper API (Google Search)  
 * 3. DuckDuckGo fallback (no API key needed)
 */

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

interface SearchConfig {
  tavilyKey?: string;
  serperKey?: string;
}

/**
 * Search using Tavily API (recommended for research)
 */
async function searchWithTavily(query: string, apiKey: string): Promise<SearchResult[]> {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'advanced',
      max_results: 8,
      include_answer: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed: ${response.statusText}`);
  }

  const data = await response.json();
  return (data.results || []).map((r: { title: string; content: string; url: string }) => ({
    title: r.title,
    snippet: r.content,
    url: r.url,
  }));
}

/**
 * Search using Serper API (Google Search)
 */
async function searchWithSerper(query: string, apiKey: string): Promise<SearchResult[]> {
  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query, num: 8 }),
  });

  if (!response.ok) {
    throw new Error(`Serper search failed: ${response.statusText}`);
  }

  const data = await response.json();
  return (data.organic || []).map((r: { title: string; snippet: string; link: string }) => ({
    title: r.title,
    snippet: r.snippet,
    url: r.link,
  }));
}

/**
 * Fallback: DuckDuckGo Instant Answer API
 * Note: This is limited but works without an API key
 */
async function searchWithDuckDuckGo(query: string): Promise<SearchResult[]> {
  const encodedQuery = encodeURIComponent(query);
  const response = await fetch(
    `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_redirect=1&no_html=1`
  );

  if (!response.ok) {
    throw new Error(`DuckDuckGo search failed: ${response.statusText}`);
  }

  const data = await response.json();
  const results: SearchResult[] = [];

  // Abstract / main result
  if (data.Abstract) {
    results.push({
      title: data.Heading || query,
      snippet: data.Abstract,
      url: data.AbstractURL || '',
    });
  }

  // Related topics
  if (data.RelatedTopics) {
    for (const topic of data.RelatedTopics.slice(0, 6)) {
      if (topic.Text) {
        results.push({
          title: topic.FirstURL?.split('/').pop() || '',
          snippet: topic.Text,
          url: topic.FirstURL || '',
        });
      }
    }
  }

  return results;
}

/**
 * Main search function — tries providers in priority order
 */
export async function webSearch(
  query: string,
  config: SearchConfig
): Promise<{ results: SearchResult[]; provider: string }> {
  // 1. Try Tavily first
  if (config.tavilyKey) {
    try {
      const results = await searchWithTavily(query, config.tavilyKey);
      return { results, provider: 'Tavily' };
    } catch (e) {
      console.warn('Tavily search failed, trying fallback:', e);
    }
  }

  // 2. Try Serper
  if (config.serperKey) {
    try {
      const results = await searchWithSerper(query, config.serperKey);
      return { results, provider: 'Serper' };
    } catch (e) {
      console.warn('Serper search failed, trying fallback:', e);
    }
  }

  // 3. DuckDuckGo fallback (no key needed)
  try {
    const results = await searchWithDuckDuckGo(query);
    return { results, provider: 'DuckDuckGo' };
  } catch (e) {
    console.warn('DuckDuckGo search also failed:', e);
  }

  return { results: [], provider: 'none' };
}

/**
 * Specialized financial news search
 */
export async function searchFinancialNews(
  companyName: string,
  config: SearchConfig
): Promise<{ results: SearchResult[]; provider: string }> {
  const query = `${companyName} stock market news financial analysis latest 2024 2025`;
  return webSearch(query, config);
}

/**
 * Search for competitor and market info
 */
export async function searchMarketPosition(
  companyName: string,
  industry: string,
  config: SearchConfig
): Promise<{ results: SearchResult[]; provider: string }> {
  const query = `${companyName} ${industry} competitors market share analysis SWOT`;
  return webSearch(query, config);
}
