/**
 * LangGraph Investment Research Workflow
 *
 * A multi-stage research agent that analyzes companies through:
 * 1. Company Identification → Find ticker, sector, basic profile
 * 2. Financial Analysis → Pull key metrics and assess financial health
 * 3. Market & Competitive Analysis → Competitors, SWOT, moat
 * 4. Sentiment & News → Recent headlines, analyst sentiment
 * 5. Decision Synthesis → Final INVEST/PASS verdict with scoring
 */

import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatAnthropic } from '@langchain/anthropic';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { findTicker, fetchFinancials, assessFinancialHealth, FinancialData } from './tools/finance';
import { webSearch, searchFinancialNews, searchMarketPosition } from './tools/search';

// ─── State Schema ───────────────────────────────────────────────────────────

export interface ResearchState {
  companyName: string;
  ticker: string;
  industry: string;
  sector: string;
  profile: string;
  financials: FinancialData | null;
  financialHealth: {
    score: number;
    strengths: string[];
    concerns: string[];
  } | null;
  marketPosition: string;
  swot: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  } | null;
  sentiment: {
    summary: string;
    overallSentiment: string;
    headlines: { title: string; sentiment: string; source: string }[];
  } | null;
  decision: 'INVEST' | 'PASS' | null;
  score: number;
  scoreBreakdown: {
    value: number;
    growth: number;
    financialHealth: number;
    moat: number;
    sentiment: number;
  } | null;
  reasoning: string;
  executiveSummary: {
    thesis: string;
    pros: string[];
    cons: string[];
    risks: string[];
  } | null;
  logs: { timestamp: string; message: string; stage: string }[];
  error: string | null;
}

// ─── Config ─────────────────────────────────────────────────────────────────

export interface ResearchConfig {
  llmProvider: 'openai' | 'gemini' | 'anthropic';
  llmModel?: string;
  openaiKey?: string;
  geminiKey?: string;
  anthropicKey?: string;
  tavilyKey?: string;
  serperKey?: string;
}

// ─── LLM Factory ────────────────────────────────────────────────────────────

function createLLM(config: ResearchConfig): BaseChatModel {
  const { llmProvider } = config;

  switch (llmProvider) {
    case 'openai':
      if (!config.openaiKey) throw new Error('OpenAI API key is required');
      return new ChatOpenAI({
        modelName: config.llmModel || 'gpt-4o-mini',
        openAIApiKey: config.openaiKey,
        temperature: 0.3,
      });
    case 'gemini':
      if (!config.geminiKey) throw new Error('Google Gemini API key is required');
      return new ChatGoogleGenerativeAI({
        modelName: config.llmModel || 'gemini-1.5-flash',
        apiKey: config.geminiKey,
        temperature: 0.3,
      });
    case 'anthropic':
      if (!config.anthropicKey) throw new Error('Anthropic API key is required');
      return new ChatAnthropic({
        modelName: config.llmModel || 'claude-3-5-sonnet-20241022',
        anthropicApiKey: config.anthropicKey,
        temperature: 0.3,
      });
    default:
      throw new Error(`Unsupported LLM provider: ${llmProvider}`);
  }
}

// ─── Helper: Add Log ────────────────────────────────────────────────────────

function addLog(state: ResearchState, message: string, stage: string): void {
  state.logs.push({
    timestamp: new Date().toISOString(),
    message,
    stage,
  });
}

// ─── Node 1: Identify Company ──────────────────────────────────────────────

async function identifyCompany(
  state: ResearchState,
  config: ResearchConfig,
  onLog: (log: { timestamp: string; message: string; stage: string }) => void
): Promise<void> {
  const log = (msg: string) => {
    addLog(state, msg, 'identify');
    onLog(state.logs[state.logs.length - 1]);
  };

  log(`🔍 Starting research on "${state.companyName}"...`);
  log('📋 Looking up stock ticker and company profile...');

  // Try to find the ticker
  const tickerResult = await findTicker(state.companyName);

  if (tickerResult) {
    state.ticker = tickerResult.ticker;
    log(`✅ Found ticker: ${tickerResult.ticker} (${tickerResult.name})`);
  } else {
    log(`⚠️ Could not find a stock ticker for "${state.companyName}". Will proceed with web research only.`);
    state.ticker = '';
  }

  // Use LLM to identify the company profile
  const llm = createLLM(config);
  const searchConfig = { tavilyKey: config.tavilyKey, serperKey: config.serperKey };
  const { results: profileResults } = await webSearch(
    `${state.companyName} company profile sector industry overview`,
    searchConfig
  );

  log(`🌐 Retrieved ${profileResults.length} search results for company profile`);

  const profileContext = profileResults
    .slice(0, 5)
    .map((r) => `${r.title}: ${r.snippet}`)
    .join('\n\n');

  const profileResponse = await llm.invoke([
    new SystemMessage(
      'You are a financial analyst. Given search results about a company, provide a brief profile including: industry, sector, main products/services, headquarters, and any key facts. Be concise but informative. Format as a short paragraph.'
    ),
    new HumanMessage(
      `Company: ${state.companyName}${state.ticker ? ` (${state.ticker})` : ''}\n\nSearch Results:\n${profileContext || 'No search results available. Use your knowledge.'}`
    ),
  ]);

  state.profile = typeof profileResponse.content === 'string' 
    ? profileResponse.content 
    : JSON.stringify(profileResponse.content);

  // Extract industry/sector from profile if we have financial data
  if (!state.industry) {
    const sectorResponse = await llm.invoke([
      new SystemMessage(
        'Given this company profile, respond with ONLY the industry name (e.g., "Technology", "Healthcare", "Consumer Goods", "Financial Services"). Single phrase only.'
      ),
      new HumanMessage(state.profile),
    ]);
    state.industry = typeof sectorResponse.content === 'string'
      ? sectorResponse.content.trim()
      : 'Unknown';
    state.sector = state.industry;
  }

  log(`🏢 Company identified: ${state.industry} sector`);
  log('✅ Company identification complete');
}

// ─── Node 2: Financial Analysis ─────────────────────────────────────────────

async function analyzeFinancials(
  state: ResearchState,
  config: ResearchConfig,
  onLog: (log: { timestamp: string; message: string; stage: string }) => void
): Promise<void> {
  const log = (msg: string) => {
    addLog(state, msg, 'financials');
    onLog(state.logs[state.logs.length - 1]);
  };

  log('📊 Fetching financial data and key metrics...');

  if (state.ticker) {
    const financials = await fetchFinancials(state.ticker);
    state.financials = financials;

    if (financials.error) {
      log(`⚠️ ${financials.error}`);
    } else {
      log(`💰 Current Price: ${financials.currency} ${financials.price?.toFixed(2) ?? 'N/A'}`);
      log(`📈 Market Cap: ${financials.marketCap}`);
      log(`📉 P/E Ratio: ${financials.peRatio?.toFixed(2) ?? 'N/A'}`);
      log(`💹 Profit Margin: ${financials.profitMargin ? (financials.profitMargin * 100).toFixed(1) + '%' : 'N/A'}`);
      log(`🏦 Debt/Equity: ${financials.debtToEquity?.toFixed(1) ?? 'N/A'}%`);
    }

    // Assess financial health
    const health = assessFinancialHealth(financials);
    state.financialHealth = health;

    if (financials.sector && financials.sector !== 'Unknown') {
      state.sector = financials.sector;
      state.industry = financials.industry || state.industry;
    }

    log(`🩺 Financial Health Score: ${health.score}/100`);
    log(`✅ Financial analysis complete — ${health.strengths.length} strengths, ${health.concerns.length} concerns identified`);
  } else {
    log('⚠️ No ticker available — performing web-based financial analysis...');

    const llm = createLLM(config);
    const searchConfig = { tavilyKey: config.tavilyKey, serperKey: config.serperKey };
    const { results } = await webSearch(
      `${state.companyName} financial performance revenue profit 2024`,
      searchConfig
    );

    const context = results.slice(0, 5).map((r) => `${r.title}: ${r.snippet}`).join('\n\n');

    const analysisResponse = await llm.invoke([
      new SystemMessage(
        'You are a financial analyst. Based on the search results, estimate the company financial health on a scale of 0-100, list key strengths and concerns. Respond in JSON format: { "score": number, "strengths": string[], "concerns": string[] }'
      ),
      new HumanMessage(`Company: ${state.companyName}\n\nSearch Results:\n${context || 'No data available.'}`),
    ]);

    try {
      const content = typeof analysisResponse.content === 'string'
        ? analysisResponse.content
        : JSON.stringify(analysisResponse.content);
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        state.financialHealth = JSON.parse(jsonMatch[0]);
      }
    } catch {
      state.financialHealth = { score: 50, strengths: [], concerns: ['Unable to parse financial data'] };
    }

    log(`🩺 Estimated Financial Health Score: ${state.financialHealth?.score ?? 50}/100`);
    log('✅ Web-based financial analysis complete');
  }
}

// ─── Node 3: Market & Competitive Analysis ──────────────────────────────────

async function analyzeMarket(
  state: ResearchState,
  config: ResearchConfig,
  onLog: (log: { timestamp: string; message: string; stage: string }) => void
): Promise<void> {
  const log = (msg: string) => {
    addLog(state, msg, 'market');
    onLog(state.logs[state.logs.length - 1]);
  };

  log('⚔️ Analyzing market position and competitive landscape...');

  const llm = createLLM(config);
  const searchConfig = { tavilyKey: config.tavilyKey, serperKey: config.serperKey };
  const { results } = await searchMarketPosition(state.companyName, state.industry, searchConfig);

  log(`🌐 Found ${results.length} results on competitive landscape`);

  const context = results.slice(0, 6).map((r) => `${r.title}: ${r.snippet}`).join('\n\n');

  const marketResponse = await llm.invoke([
    new SystemMessage(
      `You are a strategic analyst. Based on the search results and your knowledge, provide a SWOT analysis for this company. Respond in valid JSON format:
{
  "marketPosition": "Brief summary of market position",
  "swot": {
    "strengths": ["strength 1", "strength 2", "strength 3"],
    "weaknesses": ["weakness 1", "weakness 2", "weakness 3"],
    "opportunities": ["opportunity 1", "opportunity 2", "opportunity 3"],
    "threats": ["threat 1", "threat 2", "threat 3"]
  }
}
Each array should have 3-5 items. Be specific and insightful, not generic.`
    ),
    new HumanMessage(
      `Company: ${state.companyName} (${state.ticker || 'no ticker'})\nIndustry: ${state.industry}\nSector: ${state.sector}\nProfile: ${state.profile}\n\nSearch Results:\n${context || 'No search results available. Use your knowledge.'}`
    ),
  ]);

  try {
    const content = typeof marketResponse.content === 'string'
      ? marketResponse.content
      : JSON.stringify(marketResponse.content);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      state.marketPosition = parsed.marketPosition || '';
      state.swot = parsed.swot || null;
    }
  } catch {
    state.marketPosition = 'Unable to parse market analysis';
    state.swot = null;
  }

  if (state.swot) {
    log(`💪 Identified ${state.swot.strengths.length} strengths and ${state.swot.weaknesses.length} weaknesses`);
    log(`🚀 Found ${state.swot.opportunities.length} opportunities and ${state.swot.threats.length} threats`);
  }

  log('✅ Market & competitive analysis complete');
}

// ─── Node 4: Sentiment & News Analysis ──────────────────────────────────────

async function analyzeSentiment(
  state: ResearchState,
  config: ResearchConfig,
  onLog: (log: { timestamp: string; message: string; stage: string }) => void
): Promise<void> {
  const log = (msg: string) => {
    addLog(state, msg, 'sentiment');
    onLog(state.logs[state.logs.length - 1]);
  };

  log('📰 Analyzing recent news and market sentiment...');

  const llm = createLLM(config);
  const searchConfig = { tavilyKey: config.tavilyKey, serperKey: config.serperKey };
  const { results, provider } = await searchFinancialNews(state.companyName, searchConfig);

  log(`🌐 Retrieved ${results.length} news articles via ${provider}`);

  const context = results.slice(0, 8).map((r) => `[${r.url}] ${r.title}: ${r.snippet}`).join('\n\n');

  const sentimentResponse = await llm.invoke([
    new SystemMessage(
      `You are a sentiment analyst. Analyze the news articles about this company and provide:
1. An overall sentiment assessment
2. Individual headline sentiments
3. Key themes

Respond in valid JSON:
{
  "summary": "2-3 sentence summary of current sentiment and news landscape",
  "overallSentiment": "positive" | "negative" | "neutral" | "mixed",
  "headlines": [
    { "title": "headline text", "sentiment": "positive|negative|neutral", "source": "source name or domain" }
  ]
}
Include 4-6 headlines maximum.`
    ),
    new HumanMessage(
      `Company: ${state.companyName} (${state.ticker || 'no ticker'})\n\nRecent News:\n${context || 'No recent news found. Provide a general assessment based on your knowledge.'}`
    ),
  ]);

  try {
    const content = typeof sentimentResponse.content === 'string'
      ? sentimentResponse.content
      : JSON.stringify(sentimentResponse.content);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      state.sentiment = JSON.parse(jsonMatch[0]);
    }
  } catch {
    state.sentiment = {
      summary: 'Unable to analyze sentiment from available data.',
      overallSentiment: 'neutral',
      headlines: [],
    };
  }

  if (state.sentiment) {
    log(`📊 Overall Sentiment: ${state.sentiment.overallSentiment.toUpperCase()}`);
    log(`📰 Analyzed ${state.sentiment.headlines.length} key headlines`);
  }

  log('✅ Sentiment analysis complete');
}

// ─── Node 5: Decision Synthesis ─────────────────────────────────────────────

async function synthesizeDecision(
  state: ResearchState,
  config: ResearchConfig,
  onLog: (log: { timestamp: string; message: string; stage: string }) => void
): Promise<void> {
  const log = (msg: string) => {
    addLog(state, msg, 'decision');
    onLog(state.logs[state.logs.length - 1]);
  };

  log('🧠 Synthesizing all research into investment decision...');
  log('⚖️ Weighing financial health, market position, and sentiment...');

  const llm = createLLM(config);

  // Build comprehensive context
  const researchContext = `
COMPANY: ${state.companyName} (${state.ticker || 'No ticker'})
INDUSTRY: ${state.industry} | SECTOR: ${state.sector}

PROFILE:
${state.profile}

FINANCIAL DATA:
${state.financials ? `
- Price: ${state.financials.currency} ${state.financials.price ?? 'N/A'}
- Market Cap: ${state.financials.marketCap}
- P/E Ratio: ${state.financials.peRatio ?? 'N/A'}
- Forward P/E: ${state.financials.forwardPE ?? 'N/A'}
- PEG Ratio: ${state.financials.pegRatio ?? 'N/A'}
- Debt/Equity: ${state.financials.debtToEquity ?? 'N/A'}%
- ROE: ${state.financials.returnOnEquity ? (state.financials.returnOnEquity * 100).toFixed(1) + '%' : 'N/A'}
- Revenue Growth: ${state.financials.revenueGrowth ? (state.financials.revenueGrowth * 100).toFixed(1) + '%' : 'N/A'}
- Profit Margin: ${state.financials.profitMargin ? (state.financials.profitMargin * 100).toFixed(1) + '%' : 'N/A'}
- Operating Margin: ${state.financials.operatingMargin ? (state.financials.operatingMargin * 100).toFixed(1) + '%' : 'N/A'}
- Dividend Yield: ${state.financials.dividendYield ? (state.financials.dividendYield * 100).toFixed(2) + '%' : 'N/A'}
- Beta: ${state.financials.beta ?? 'N/A'}
- 52W High: ${state.financials.fiftyTwoWeekHigh ?? 'N/A'} | 52W Low: ${state.financials.fiftyTwoWeekLow ?? 'N/A'}
- Analyst Target: ${state.financials.targetMeanPrice ?? 'N/A'}
- Analyst Recommendation: ${state.financials.recommendationKey ?? 'N/A'}
` : 'No financial data available'}

FINANCIAL HEALTH ASSESSMENT:
Score: ${state.financialHealth?.score ?? 'N/A'}/100
Strengths: ${state.financialHealth?.strengths?.join(', ') || 'None identified'}
Concerns: ${state.financialHealth?.concerns?.join(', ') || 'None identified'}

MARKET POSITION:
${state.marketPosition || 'Not analyzed'}

SWOT ANALYSIS:
${state.swot ? `
Strengths: ${state.swot.strengths.join(', ')}
Weaknesses: ${state.swot.weaknesses.join(', ')}
Opportunities: ${state.swot.opportunities.join(', ')}
Threats: ${state.swot.threats.join(', ')}
` : 'Not available'}

SENTIMENT:
${state.sentiment ? `
Overall: ${state.sentiment.overallSentiment}
Summary: ${state.sentiment.summary}
Key Headlines: ${state.sentiment.headlines.map(h => `[${h.sentiment}] ${h.title}`).join('\n')}
` : 'Not analyzed'}
`;

  const decisionResponse = await llm.invoke([
    new SystemMessage(
      `You are a senior investment analyst making a final investment recommendation. 
Based on all the research provided, you must:
1. Make a clear INVEST or PASS decision
2. Score the investment across 5 dimensions (each out of 20, totaling 100)
3. Provide an executive summary

Respond in valid JSON format:
{
  "decision": "INVEST" or "PASS",
  "totalScore": number (0-100),
  "scoreBreakdown": {
    "value": number (0-20, how attractively priced),
    "growth": number (0-20, growth trajectory),
    "financialHealth": number (0-20, balance sheet strength),
    "moat": number (0-20, competitive advantage durability),
    "sentiment": number (0-20, market perception)
  },
  "reasoning": "2-3 paragraph detailed investment reasoning",
  "executiveSummary": {
    "thesis": "One sentence investment thesis",
    "pros": ["pro 1", "pro 2", "pro 3"],
    "cons": ["con 1", "con 2", "con 3"],
    "risks": ["risk 1", "risk 2", "risk 3"]
  }
}

Be honest and balanced. High-quality companies at unreasonable valuations should get PASS. 
Risky companies with transformative potential should be flagged with appropriate caveats.
INVEST means the risk/reward profile is favorable for a long-term investor.
PASS means the stock is either overvalued, too risky, or has better alternatives.`
    ),
    new HumanMessage(researchContext),
  ]);

  try {
    const content = typeof decisionResponse.content === 'string'
      ? decisionResponse.content
      : JSON.stringify(decisionResponse.content);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      state.decision = parsed.decision === 'INVEST' ? 'INVEST' : 'PASS';
      state.score = parsed.totalScore ?? 50;
      state.scoreBreakdown = parsed.scoreBreakdown ?? null;
      state.reasoning = parsed.reasoning ?? '';
      state.executiveSummary = parsed.executiveSummary ?? null;
    }
  } catch {
    state.decision = 'PASS';
    state.score = 0;
    state.reasoning = 'Unable to parse decision analysis. Defaulting to PASS for safety.';
  }

  if (state.decision) {
    const emoji = state.decision === 'INVEST' ? '🟢' : '🔴';
    log(`${emoji} DECISION: ${state.decision} (Score: ${state.score}/100)`);
    if (state.scoreBreakdown) {
      log(`📊 Value: ${state.scoreBreakdown.value}/20 | Growth: ${state.scoreBreakdown.growth}/20 | Health: ${state.scoreBreakdown.financialHealth}/20 | Moat: ${state.scoreBreakdown.moat}/20 | Sentiment: ${state.scoreBreakdown.sentiment}/20`);
    }
  }

  log('✅ Investment analysis complete!');
}

// ─── Main Workflow Runner ───────────────────────────────────────────────────

export async function runResearchWorkflow(
  companyName: string,
  config: ResearchConfig,
  onLog: (log: { timestamp: string; message: string; stage: string }) => void
): Promise<ResearchState> {
  // Initialize state
  const state: ResearchState = {
    companyName,
    ticker: '',
    industry: '',
    sector: '',
    profile: '',
    financials: null,
    financialHealth: null,
    marketPosition: '',
    swot: null,
    sentiment: null,
    decision: null,
    score: 0,
    scoreBreakdown: null,
    reasoning: '',
    executiveSummary: null,
    logs: [],
    error: null,
  };

  try {
    // Stage 1: Identify Company
    await identifyCompany(state, config, onLog);

    // Stage 2: Financial Analysis
    await analyzeFinancials(state, config, onLog);

    // Stage 3: Market & Competitive Analysis
    await analyzeMarket(state, config, onLog);

    // Stage 4: Sentiment Analysis
    await analyzeSentiment(state, config, onLog);

    // Stage 5: Decision Synthesis
    await synthesizeDecision(state, config, onLog);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    state.error = errorMessage;
    addLog(state, `❌ Error: ${errorMessage}`, 'error');
    onLog(state.logs[state.logs.length - 1]);
  }

  return state;
}
