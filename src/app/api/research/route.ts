/**
 * Streaming Research API Route
 * 
 * Accepts a POST request with company name and config,
 * runs the LangGraph workflow, and streams logs + final results
 * back to the client via Server-Sent Events (SSE).
 */

import { NextRequest } from 'next/server';
import { runResearchWorkflow, ResearchConfig } from '@/lib/graph';

export const maxDuration = 120; // Allow up to 2 minutes for research
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyName, config } = body as {
      companyName: string;
      config: ResearchConfig;
    };

    if (!companyName || !companyName.trim()) {
      return new Response(
        JSON.stringify({ error: 'Company name is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Merge environment variables with client-provided config
    const mergedConfig: ResearchConfig = {
      llmProvider: config.llmProvider || (process.env.DEFAULT_LLM_PROVIDER as ResearchConfig['llmProvider']) || 'gemini',
      llmModel: config.llmModel || process.env.DEFAULT_LLM_MODEL || undefined,
      openaiKey: config.openaiKey || process.env.OPENAI_API_KEY,
      geminiKey: config.geminiKey || process.env.GOOGLE_API_KEY,
      anthropicKey: config.anthropicKey || process.env.ANTHROPIC_API_KEY,
      tavilyKey: config.tavilyKey || process.env.TAVILY_API_KEY,
      serperKey: config.serperKey || process.env.SERPER_API_KEY,
    };

    // Validate that we have at least one LLM key
    const hasLLMKey =
      (mergedConfig.llmProvider === 'openai' && mergedConfig.openaiKey) ||
      (mergedConfig.llmProvider === 'gemini' && mergedConfig.geminiKey) ||
      (mergedConfig.llmProvider === 'anthropic' && mergedConfig.anthropicKey);

    if (!hasLLMKey) {
      return new Response(
        JSON.stringify({
          error: `No API key configured for ${mergedConfig.llmProvider}. Please add your API key in Settings or set it as an environment variable.`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create a ReadableStream for SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: unknown) => {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        };

        try {
          const result = await runResearchWorkflow(
            companyName.trim(),
            mergedConfig,
            (log) => {
              // Stream each log entry as it happens
              sendEvent('log', log);
            }
          );

          // Send the final result
          sendEvent('result', {
            companyName: result.companyName,
            ticker: result.ticker,
            industry: result.industry,
            sector: result.sector,
            profile: result.profile,
            financials: result.financials,
            financialHealth: result.financialHealth,
            marketPosition: result.marketPosition,
            swot: result.swot,
            sentiment: result.sentiment,
            decision: result.decision,
            score: result.score,
            scoreBreakdown: result.scoreBreakdown,
            reasoning: result.reasoning,
            executiveSummary: result.executiveSummary,
            error: result.error,
          });

          sendEvent('done', { success: true });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error occurred';
          sendEvent('error', { error: message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
