/**
 * Financial Data Tool
 * 
 * Fetches stock metrics and financial data using Yahoo Finance
 * via publicly available endpoints (no API key required).
 */

export interface FinancialData {
  ticker: string;
  price: number | null;
  currency: string;
  marketCap: string;
  peRatio: number | null;
  forwardPE: number | null;
  pegRatio: number | null;
  debtToEquity: number | null;
  returnOnEquity: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  profitMargin: number | null;
  operatingMargin: number | null;
  dividendYield: number | null;
  beta: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  targetMeanPrice: number | null;
  recommendationKey: string | null;
  sector: string;
  industry: string;
  fullTimeEmployees: number | null;
  longBusinessSummary: string;
  error?: string;
}

/**
 * Format market cap to human readable string
 */
function formatMarketCap(value: number | null): string {
  if (!value) return 'N/A';
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
}

/**
 * Try to find a stock ticker for a company name using Yahoo Finance search
 */
export async function findTicker(companyName: string): Promise<{ ticker: string; name: string } | null> {
  try {
    const encodedQuery = encodeURIComponent(companyName);
    const response = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodedQuery}&quotesCount=5&newsCount=0`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const quotes = data.quotes || [];

    // Find the best equity match
    const equity = quotes.find(
      (q: { quoteType: string }) => q.quoteType === 'EQUITY'
    );
    if (equity) {
      return { ticker: equity.symbol, name: equity.shortname || equity.longname || companyName };
    }

    // Fallback to first result
    if (quotes.length > 0) {
      return { ticker: quotes[0].symbol, name: quotes[0].shortname || quotes[0].longname || companyName };
    }

    return null;
  } catch (e) {
    console.warn('Yahoo Finance search failed:', e);
    return null;
  }
}

/**
 * Fetch financial data for a given ticker from Yahoo Finance
 */
export async function fetchFinancials(ticker: string): Promise<FinancialData> {
  const defaultData: FinancialData = {
    ticker,
    price: null,
    currency: 'USD',
    marketCap: 'N/A',
    peRatio: null,
    forwardPE: null,
    pegRatio: null,
    debtToEquity: null,
    returnOnEquity: null,
    revenueGrowth: null,
    earningsGrowth: null,
    profitMargin: null,
    operatingMargin: null,
    dividendYield: null,
    beta: null,
    fiftyTwoWeekHigh: null,
    fiftyTwoWeekLow: null,
    targetMeanPrice: null,
    recommendationKey: null,
    sector: 'Unknown',
    industry: 'Unknown',
    fullTimeEmployees: null,
    longBusinessSummary: '',
  };

  try {
    // Use the quoteSummary endpoint to get comprehensive data
    const modules = [
      'summaryProfile',
      'summaryDetail',
      'financialData',
      'defaultKeyStatistics',
      'earningsTrend',
    ].join(',');

    const response = await fetch(
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=${modules}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      }
    );

    if (!response.ok) {
      return { ...defaultData, error: `Failed to fetch data for ${ticker}: ${response.statusText}` };
    }

    const data = await response.json();
    const result = data.quoteSummary?.result?.[0];
    if (!result) {
      return { ...defaultData, error: `No data found for ${ticker}` };
    }

    const profile = result.summaryProfile || {};
    const detail = result.summaryDetail || {};
    const financial = result.financialData || {};
    const keyStats = result.defaultKeyStatistics || {};

    return {
      ticker,
      price: financial.currentPrice?.raw ?? detail.previousClose?.raw ?? null,
      currency: financial.financialCurrency || detail.currency || 'USD',
      marketCap: formatMarketCap(detail.marketCap?.raw ?? null),
      peRatio: detail.trailingPE?.raw ?? null,
      forwardPE: detail.forwardPE?.raw ?? keyStats.forwardPE?.raw ?? null,
      pegRatio: keyStats.pegRatio?.raw ?? null,
      debtToEquity: financial.debtToEquity?.raw ?? null,
      returnOnEquity: financial.returnOnEquity?.raw ?? null,
      revenueGrowth: financial.revenueGrowth?.raw ?? null,
      earningsGrowth: financial.earningsGrowth?.raw ?? null,
      profitMargin: financial.profitMargins?.raw ?? null,
      operatingMargin: financial.operatingMargins?.raw ?? null,
      dividendYield: detail.dividendYield?.raw ?? null,
      beta: detail.beta?.raw ?? null,
      fiftyTwoWeekHigh: detail.fiftyTwoWeekHigh?.raw ?? null,
      fiftyTwoWeekLow: detail.fiftyTwoWeekLow?.raw ?? null,
      targetMeanPrice: financial.targetMeanPrice?.raw ?? null,
      recommendationKey: financial.recommendationKey ?? null,
      sector: profile.sector || 'Unknown',
      industry: profile.industry || 'Unknown',
      fullTimeEmployees: profile.fullTimeEmployees ?? null,
      longBusinessSummary: profile.longBusinessSummary || '',
    };
  } catch (e) {
    console.warn('Yahoo Finance quoteSummary failed:', e);
    return { ...defaultData, error: `Error fetching data: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * Get a quick summary of key financial health indicators
 */
export function assessFinancialHealth(data: FinancialData): {
  score: number;
  strengths: string[];
  concerns: string[];
} {
  let score = 50; // Start neutral
  const strengths: string[] = [];
  const concerns: string[] = [];

  // P/E Ratio assessment
  if (data.peRatio !== null) {
    if (data.peRatio > 0 && data.peRatio < 15) {
      score += 8;
      strengths.push(`Attractive P/E ratio of ${data.peRatio.toFixed(1)} (value territory)`);
    } else if (data.peRatio >= 15 && data.peRatio < 25) {
      score += 4;
      strengths.push(`Reasonable P/E ratio of ${data.peRatio.toFixed(1)}`);
    } else if (data.peRatio >= 25 && data.peRatio < 50) {
      score -= 3;
      concerns.push(`Elevated P/E ratio of ${data.peRatio.toFixed(1)} suggests premium pricing`);
    } else if (data.peRatio >= 50) {
      score -= 8;
      concerns.push(`Very high P/E of ${data.peRatio.toFixed(1)} indicates extreme premium or speculative valuation`);
    } else {
      score -= 10;
      concerns.push('Negative earnings (P/E not meaningful)');
    }
  }

  // Profit margins
  if (data.profitMargin !== null) {
    const margin = data.profitMargin * 100;
    if (margin > 20) {
      score += 8;
      strengths.push(`Strong profit margin of ${margin.toFixed(1)}%`);
    } else if (margin > 10) {
      score += 4;
      strengths.push(`Healthy profit margin of ${margin.toFixed(1)}%`);
    } else if (margin > 0) {
      score += 1;
      concerns.push(`Thin profit margin of ${margin.toFixed(1)}%`);
    } else {
      score -= 8;
      concerns.push(`Negative profit margin of ${margin.toFixed(1)}% — company is losing money`);
    }
  }

  // Debt to Equity
  if (data.debtToEquity !== null) {
    if (data.debtToEquity < 50) {
      score += 6;
      strengths.push(`Low debt-to-equity ratio of ${data.debtToEquity.toFixed(1)}%`);
    } else if (data.debtToEquity < 100) {
      score += 2;
    } else if (data.debtToEquity < 200) {
      score -= 4;
      concerns.push(`High debt-to-equity of ${data.debtToEquity.toFixed(1)}%`);
    } else {
      score -= 8;
      concerns.push(`Very high leverage with D/E of ${data.debtToEquity.toFixed(1)}%`);
    }
  }

  // ROE
  if (data.returnOnEquity !== null) {
    const roe = data.returnOnEquity * 100;
    if (roe > 20) {
      score += 8;
      strengths.push(`Excellent ROE of ${roe.toFixed(1)}% — strong capital efficiency`);
    } else if (roe > 10) {
      score += 4;
      strengths.push(`Good ROE of ${roe.toFixed(1)}%`);
    } else if (roe > 0) {
      score += 1;
    } else {
      score -= 6;
      concerns.push(`Negative ROE — company destroying shareholder value`);
    }
  }

  // Revenue growth
  if (data.revenueGrowth !== null) {
    const growth = data.revenueGrowth * 100;
    if (growth > 20) {
      score += 8;
      strengths.push(`Strong revenue growth of ${growth.toFixed(1)}%`);
    } else if (growth > 5) {
      score += 4;
      strengths.push(`Solid revenue growth of ${growth.toFixed(1)}%`);
    } else if (growth >= 0) {
      score += 1;
    } else {
      score -= 6;
      concerns.push(`Revenue declining at ${growth.toFixed(1)}%`);
    }
  }

  // Analyst recommendation
  if (data.recommendationKey) {
    if (['strong_buy', 'buy'].includes(data.recommendationKey)) {
      score += 5;
      strengths.push(`Analyst consensus: ${data.recommendationKey.replace('_', ' ').toUpperCase()}`);
    } else if (data.recommendationKey === 'hold') {
      score += 0;
    } else {
      score -= 5;
      concerns.push(`Analyst consensus: ${data.recommendationKey.replace('_', ' ').toUpperCase()}`);
    }
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  return { score, strengths, concerns };
}
