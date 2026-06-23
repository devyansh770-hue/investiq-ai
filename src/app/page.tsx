'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Search,
  Settings,
  TrendingUp,
  Shield,
  BarChart3,
  Newspaper,
  Terminal,
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  Zap,
  Target,
  Swords,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import styles from './page.module.css';

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface LogEntry {
  timestamp: string;
  message: string;
  stage: string;
}

interface ScoreBreakdown {
  value: number;
  growth: number;
  financialHealth: number;
  moat: number;
  sentiment: number;
}

interface FinancialData {
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
}

interface ResearchResult {
  companyName: string;
  ticker: string;
  industry: string;
  sector: string;
  profile: string;
  financials: FinancialData | null;
  financialHealth: { score: number; strengths: string[]; concerns: string[] } | null;
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
  scoreBreakdown: ScoreBreakdown | null;
  reasoning: string;
  executiveSummary: {
    thesis: string;
    pros: string[];
    cons: string[];
    risks: string[];
  } | null;
  error: string | null;
}

interface Config {
  llmProvider: 'openai' | 'gemini' | 'anthropic';
  llmModel: string;
  openaiKey: string;
  geminiKey: string;
  anthropicKey: string;
  tavilyKey: string;
  serperKey: string;
}

/* ─── Tab Definitions ────────────────────────────────────────────────────── */

const TABS = [
  { id: 'summary', label: 'Executive Summary', icon: FileText },
  { id: 'financials', label: 'Financials', icon: BarChart3 },
  { id: 'swot', label: 'SWOT Analysis', icon: Swords },
  { id: 'sentiment', label: 'Sentiment & News', icon: Newspaper },
  { id: 'logs', label: 'System Logs', icon: Terminal },
] as const;

type TabId = (typeof TABS)[number]['id'];

/* ─── Component ──────────────────────────────────────────────────────────── */

export default function ResearchDashboard() {
  // Search state
  const [companyName, setCompanyName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Config state
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState<Config>({
    llmProvider: 'gemini',
    llmModel: '',
    openaiKey: '',
    geminiKey: '',
    anthropicKey: '',
    tavilyKey: '',
    serperKey: '',
  });

  // Results state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('summary');

  // Refs
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  // Focus input on load
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /* ─── Research Handler ───────────────────────────────────────────────── */

  const handleResearch = useCallback(async () => {
    if (!companyName.trim() || isLoading) return;

    setIsLoading(true);
    setLogs([]);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyName.trim(),
          config,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Research request failed');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);
              if (eventType === 'log') {
                setLogs((prev) => [...prev, parsed]);
              } else if (eventType === 'result') {
                setResult(parsed);
              } else if (eventType === 'error') {
                setError(parsed.error);
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [companyName, config, isLoading]);

  /* ─── Helpers ────────────────────────────────────────────────────────── */

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    } catch {
      return '';
    }
  };

  const formatPercent = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return 'N/A';
    return (value * 100).toFixed(1) + '%';
  };

  const formatNumber = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return 'N/A';
    return value.toFixed(2);
  };

  const getScoreColor = (score: number): string => {
    if (score >= 70) return '#22c55e';
    if (score >= 50) return '#f0b429';
    return '#ef4444';
  };

  /* ─── Score Circle ─────────────────────────────────────────────────── */

  const ScoreCircle = ({ score }: { score: number }) => {
    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    const color = getScoreColor(score);

    return (
      <div className={styles.confidenceScore}>
        <div className={styles.scoreCircle}>
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={radius} />
            <circle
              cx="50"
              cy="50"
              r={radius}
              style={{
                stroke: color,
                strokeDasharray: circumference,
                strokeDashoffset: offset,
              }}
            />
          </svg>
          <div className={styles.scoreValue}>{score}</div>
        </div>
        <span className={styles.scoreLabel}>Confidence</span>
      </div>
    );
  };

  /* ─── Metric Card ──────────────────────────────────────────────────── */

  const MetricCard = ({
    name,
    value,
    barPercent,
    subtext,
  }: {
    name: string;
    value: string;
    barPercent?: number;
    subtext?: string;
  }) => (
    <div className={styles.metricCard}>
      <div className={styles.metricName}>{name}</div>
      <div className={styles.metricValue}>{value}</div>
      {barPercent !== undefined && (
        <div className={styles.metricBar}>
          <div
            className={styles.metricBarFill}
            style={{ width: `${Math.max(0, Math.min(100, barPercent))}%` }}
          />
        </div>
      )}
      {subtext && <div className={styles.metricSubtext}>{subtext}</div>}
    </div>
  );

  /* ─── Render ────────────────────────────────────────────────────────── */

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <Zap size={20} />
          </div>
          <div>
            <div className={styles.logoText}>DeepVest</div>
            <div className={styles.logoSubtext}>AI Investment Research</div>
          </div>
        </div>
        <button
          className={styles.settingsToggle}
          onClick={() => setShowSettings(!showSettings)}
          id="settings-toggle"
        >
          <Settings size={15} />
          Settings
          <ChevronDown
            size={13}
            style={{
              transform: showSettings ? 'rotate(180deg)' : 'rotate(0)',
              transition: 'transform 0.25s ease',
            }}
          />
        </button>
      </header>

      <main className={styles.main}>
        {/* Settings Panel */}
        {showSettings && (
          <div className={styles.settingsPanel}>
            <div className={styles.settingsGrid}>
              <div className={styles.settingsGroup}>
                <label className={styles.settingsLabel}>LLM Provider</label>
                <select
                  className={styles.settingsSelect}
                  value={config.llmProvider}
                  onChange={(e) =>
                    setConfig({ ...config, llmProvider: e.target.value as Config['llmProvider'] })
                  }
                  id="llm-provider-select"
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                </select>
              </div>
              <div className={styles.settingsGroup}>
                <label className={styles.settingsLabel}>Model Override (Optional)</label>
                <input
                  className={styles.settingsInput}
                  type="text"
                  placeholder="e.g., gpt-4o, gemini-1.5-pro"
                  value={config.llmModel}
                  onChange={(e) => setConfig({ ...config, llmModel: e.target.value })}
                  id="llm-model-input"
                />
              </div>

              {config.llmProvider === 'openai' && (
                <div className={styles.settingsGroup}>
                  <label className={styles.settingsLabel}>OpenAI API Key</label>
                  <input
                    className={styles.settingsInput}
                    type="password"
                    placeholder="sk-..."
                    value={config.openaiKey}
                    onChange={(e) => setConfig({ ...config, openaiKey: e.target.value })}
                    id="openai-key-input"
                  />
                </div>
              )}
              {config.llmProvider === 'gemini' && (
                <div className={styles.settingsGroup}>
                  <label className={styles.settingsLabel}>Google Gemini API Key</label>
                  <input
                    className={styles.settingsInput}
                    type="password"
                    placeholder="AIza..."
                    value={config.geminiKey}
                    onChange={(e) => setConfig({ ...config, geminiKey: e.target.value })}
                    id="gemini-key-input"
                  />
                </div>
              )}
              {config.llmProvider === 'anthropic' && (
                <div className={styles.settingsGroup}>
                  <label className={styles.settingsLabel}>Anthropic API Key</label>
                  <input
                    className={styles.settingsInput}
                    type="password"
                    placeholder="sk-ant-..."
                    value={config.anthropicKey}
                    onChange={(e) => setConfig({ ...config, anthropicKey: e.target.value })}
                    id="anthropic-key-input"
                  />
                </div>
              )}

              <div className={styles.settingsGroup}>
                <label className={styles.settingsLabel}>Tavily API Key (Search)</label>
                <input
                  className={styles.settingsInput}
                  type="password"
                  placeholder="tvly-..."
                  value={config.tavilyKey}
                  onChange={(e) => setConfig({ ...config, tavilyKey: e.target.value })}
                  id="tavily-key-input"
                />
              </div>
              <div className={styles.settingsGroup}>
                <label className={styles.settingsLabel}>Serper API Key (Search Fallback)</label>
                <input
                  className={styles.settingsInput}
                  type="password"
                  placeholder="Optional"
                  value={config.serperKey}
                  onChange={(e) => setConfig({ ...config, serperKey: e.target.value })}
                  id="serper-key-input"
                />
              </div>
            </div>
          </div>
        )}

        {/* Hero Section */}
        <section className={styles.heroSection}>
          <div className={styles.searchContainer}>
            <div className={styles.searchWrapper}>
              <Search size={18} style={{ color: '#475569', flexShrink: 0 }} />
              <input
                ref={inputRef}
                className={styles.searchInput}
                type="text"
                placeholder="Enter a company name... (e.g., Apple, Tesla, Microsoft)"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleResearch()}
                disabled={isLoading}
                id="company-search-input"
              />
              <button
                className={styles.searchButton}
                onClick={handleResearch}
                disabled={isLoading || !companyName.trim()}
                id="research-button"
              >
                {isLoading ? (
                  <>
                    <span style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>⏳</span>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Target size={16} />
                    Research
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Terminal / Live Logs */}
        {(logs.length > 0 || isLoading) && (
          <div className={styles.terminal}>
            <div className={styles.terminalHeader}>
              <span className={styles.terminalDot} />
              <span className={styles.terminalDot} />
              <span className={styles.terminalDot} />
              <span className={styles.terminalTitle}>
                Research Agent — {result?.companyName || companyName}
              </span>
            </div>
            <div className={styles.terminalBody} ref={terminalRef}>
              {logs.map((log, i) => (
                <div key={i} className={styles.logEntry}>
                  <span className={styles.logTimestamp}>{formatTimestamp(log.timestamp)}</span>
                  <span className={styles.logMessage}>{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Panel */}
        {error && (
          <div className={styles.errorPanel}>
            <div className={styles.errorTitle}>
              <AlertTriangle size={18} />
              Research Error
            </div>
            <div className={styles.errorMessage}>{error}</div>
          </div>
        )}

        {/* Results Dashboard */}
        {result && result.decision && (
          <div className={styles.resultsSection}>
            {/* Decision Panel */}
            <div className={styles.decisionPanel}>
              <div>
                <div
                  className={`${styles.decisionBadge} ${
                    result.decision === 'INVEST' ? styles.decisionInvest : styles.decisionPass
                  }`}
                >
                  {result.decision === 'INVEST' ? (
                    <CheckCircle size={22} />
                  ) : (
                    <XCircle size={22} />
                  )}
                  {result.decision}
                </div>
                <p
                  style={{
                    color: '#94a3b8',
                    fontSize: '14px',
                    marginTop: '14px',
                    maxWidth: '520px',
                    lineHeight: 1.6,
                  }}
                >
                  {result.executiveSummary?.thesis || result.reasoning?.slice(0, 200)}
                </p>
              </div>
              <ScoreCircle score={result.score} />
            </div>

            {/* Score Breakdown Bar */}
            {result.scoreBreakdown && (
              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  marginTop: '20px',
                  flexWrap: 'wrap',
                }}
              >
                {[
                  { label: 'Value', value: result.scoreBreakdown.value, max: 20 },
                  { label: 'Growth', value: result.scoreBreakdown.growth, max: 20 },
                  { label: 'Health', value: result.scoreBreakdown.financialHealth, max: 20 },
                  { label: 'Moat', value: result.scoreBreakdown.moat, max: 20 },
                  { label: 'Sentiment', value: result.scoreBreakdown.sentiment, max: 20 },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      flex: 1,
                      minWidth: '140px',
                      background: 'rgba(15, 22, 41, 0.5)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      borderRadius: '10px',
                      padding: '14px 16px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        color: '#64748b',
                        marginBottom: '6px',
                      }}
                    >
                      {item.label}
                    </div>
                    <div
                      style={{
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: '20px',
                        fontWeight: 700,
                        color: getScoreColor((item.value / item.max) * 100),
                      }}
                    >
                      {item.value}
                      <span style={{ fontSize: '12px', color: '#475569', fontWeight: 400 }}>
                        /{item.max}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tabs */}
            <div className={styles.tabsContainer}>
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                    id={`tab-${tab.id}`}
                  >
                    <Icon size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            <div className={styles.tabContent} key={activeTab}>
              {/* Executive Summary */}
              {activeTab === 'summary' && result.executiveSummary && (
                <div>
                  {/* Thesis */}
                  <div
                    style={{
                      background: 'rgba(240, 180, 41, 0.04)',
                      border: '1px solid rgba(240, 180, 41, 0.12)',
                      borderRadius: '12px',
                      padding: '20px 24px',
                      marginBottom: '20px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '12px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.7px',
                        color: '#f0b429',
                        fontWeight: 600,
                        marginBottom: '8px',
                      }}
                    >
                      Investment Thesis
                    </div>
                    <div style={{ fontSize: '15px', color: '#e2e8f0', lineHeight: 1.6 }}>
                      {result.executiveSummary.thesis}
                    </div>
                  </div>

                  {/* Reasoning */}
                  {result.reasoning && (
                    <div
                      style={{
                        background: 'rgba(15, 22, 41, 0.4)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '12px',
                        padding: '20px 24px',
                        marginBottom: '20px',
                        fontSize: '14px',
                        color: '#94a3b8',
                        lineHeight: 1.7,
                      }}
                    >
                      {result.reasoning}
                    </div>
                  )}

                  {/* Pros / Cons / Risks */}
                  <div className={styles.summaryGrid}>
                    <div className={styles.summaryCard}>
                      <div className={styles.summaryCardHeader}>
                        <TrendingUp size={16} style={{ color: '#22c55e' }} />
                        <span className={styles.summaryCardTitle}>Strengths</span>
                      </div>
                      <ul className={styles.summaryList}>
                        {result.executiveSummary.pros.map((p, i) => (
                          <li key={i} className={styles.summaryItem}>{p}</li>
                        ))}
                      </ul>
                    </div>

                    <div className={styles.summaryCard}>
                      <div className={styles.summaryCardHeader}>
                        <AlertTriangle size={16} style={{ color: '#ef4444' }} />
                        <span className={styles.summaryCardTitle}>Weaknesses</span>
                      </div>
                      <ul className={styles.summaryList}>
                        {result.executiveSummary.cons.map((c, i) => (
                          <li key={i} className={styles.summaryItem}>{c}</li>
                        ))}
                      </ul>
                    </div>

                    <div className={styles.summaryCard} style={{ gridColumn: '1 / -1' }}>
                      <div className={styles.summaryCardHeader}>
                        <Shield size={16} style={{ color: '#f0b429' }} />
                        <span className={styles.summaryCardTitle}>Key Risks</span>
                      </div>
                      <ul className={styles.summaryList}>
                        {result.executiveSummary.risks.map((r, i) => (
                          <li key={i} className={styles.summaryItem}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Financials */}
              {activeTab === 'financials' && (
                <div>
                  {result.financials ? (
                    <>
                      {/* Company Info Bar */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          marginBottom: '24px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "'Outfit', sans-serif",
                            fontSize: '18px',
                            fontWeight: 700,
                            color: '#f1f3f5',
                          }}
                        >
                          {result.ticker || result.companyName}
                        </span>
                        <span
                          style={{
                            fontSize: '12px',
                            color: '#64748b',
                            background: 'rgba(255,255,255,0.04)',
                            padding: '4px 12px',
                            borderRadius: '20px',
                            border: '1px solid rgba(255,255,255,0.06)',
                          }}
                        >
                          {result.financials.sector} · {result.financials.industry}
                        </span>
                        {result.financials.recommendationKey && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              padding: '4px 12px',
                              borderRadius: '20px',
                              background: ['strong_buy', 'buy'].includes(
                                result.financials.recommendationKey
                              )
                                ? 'rgba(34,197,94,0.1)'
                                : result.financials.recommendationKey === 'hold'
                                ? 'rgba(240,180,41,0.1)'
                                : 'rgba(239,68,68,0.1)',
                              color: ['strong_buy', 'buy'].includes(
                                result.financials.recommendationKey
                              )
                                ? '#4ade80'
                                : result.financials.recommendationKey === 'hold'
                                ? '#f0b429'
                                : '#f87171',
                              border: '1px solid',
                              borderColor: ['strong_buy', 'buy'].includes(
                                result.financials.recommendationKey
                              )
                                ? 'rgba(34,197,94,0.2)'
                                : result.financials.recommendationKey === 'hold'
                                ? 'rgba(240,180,41,0.2)'
                                : 'rgba(239,68,68,0.2)',
                            }}
                          >
                            {result.financials.recommendationKey.replace('_', ' ')}
                          </span>
                        )}
                      </div>

                      <div className={styles.metricsGrid}>
                        <MetricCard
                          name="Stock Price"
                          value={`${result.financials.currency} ${formatNumber(result.financials.price)}`}
                          subtext={`52W: ${formatNumber(result.financials.fiftyTwoWeekLow)} – ${formatNumber(result.financials.fiftyTwoWeekHigh)}`}
                        />
                        <MetricCard
                          name="Market Cap"
                          value={result.financials.marketCap}
                        />
                        <MetricCard
                          name="P/E Ratio"
                          value={formatNumber(result.financials.peRatio)}
                          barPercent={
                            result.financials.peRatio
                              ? Math.min(100, (result.financials.peRatio / 50) * 100)
                              : 0
                          }
                          subtext={`Forward P/E: ${formatNumber(result.financials.forwardPE)}`}
                        />
                        <MetricCard
                          name="Profit Margin"
                          value={formatPercent(result.financials.profitMargin)}
                          barPercent={
                            result.financials.profitMargin
                              ? Math.max(0, result.financials.profitMargin * 100)
                              : 0
                          }
                          subtext={`Operating: ${formatPercent(result.financials.operatingMargin)}`}
                        />
                        <MetricCard
                          name="Return on Equity"
                          value={formatPercent(result.financials.returnOnEquity)}
                          barPercent={
                            result.financials.returnOnEquity
                              ? Math.min(100, Math.max(0, result.financials.returnOnEquity * 100))
                              : 0
                          }
                        />
                        <MetricCard
                          name="Revenue Growth"
                          value={formatPercent(result.financials.revenueGrowth)}
                          barPercent={
                            result.financials.revenueGrowth
                              ? Math.min(100, Math.max(0, (result.financials.revenueGrowth + 0.5) * 100))
                              : 0
                          }
                          subtext={`Earnings Growth: ${formatPercent(result.financials.earningsGrowth)}`}
                        />
                        <MetricCard
                          name="Debt / Equity"
                          value={
                            result.financials.debtToEquity !== null
                              ? `${result.financials.debtToEquity.toFixed(1)}%`
                              : 'N/A'
                          }
                          barPercent={
                            result.financials.debtToEquity
                              ? Math.min(100, (result.financials.debtToEquity / 200) * 100)
                              : 0
                          }
                        />
                        <MetricCard
                          name="Dividend Yield"
                          value={formatPercent(result.financials.dividendYield)}
                        />
                        <MetricCard
                          name="Beta"
                          value={formatNumber(result.financials.beta)}
                          subtext="Market risk measure (1.0 = market)"
                        />
                      </div>

                      {/* Financial Health Assessment */}
                      {result.financialHealth && (
                        <div style={{ marginTop: '28px' }}>
                          <h3
                            style={{
                              fontFamily: "'Outfit', sans-serif",
                              fontSize: '16px',
                              fontWeight: 600,
                              color: '#e2e8f0',
                              marginBottom: '16px',
                            }}
                          >
                            Financial Health Assessment
                          </h3>
                          <div className={styles.summaryGrid}>
                            <div className={styles.summaryCard}>
                              <div className={styles.summaryCardHeader}>
                                <CheckCircle size={16} style={{ color: '#22c55e' }} />
                                <span className={styles.summaryCardTitle}>
                                  Strengths ({result.financialHealth.strengths.length})
                                </span>
                              </div>
                              <ul className={styles.summaryList}>
                                {result.financialHealth.strengths.map((s, i) => (
                                  <li key={i} className={styles.summaryItem}>{s}</li>
                                ))}
                                {result.financialHealth.strengths.length === 0 && (
                                  <li className={styles.summaryItem} style={{ color: '#475569' }}>
                                    No notable strengths identified
                                  </li>
                                )}
                              </ul>
                            </div>
                            <div className={styles.summaryCard}>
                              <div className={styles.summaryCardHeader}>
                                <AlertTriangle size={16} style={{ color: '#ef4444' }} />
                                <span className={styles.summaryCardTitle}>
                                  Concerns ({result.financialHealth.concerns.length})
                                </span>
                              </div>
                              <ul className={styles.summaryList}>
                                {result.financialHealth.concerns.map((c, i) => (
                                  <li key={i} className={styles.summaryItem}>{c}</li>
                                ))}
                                {result.financialHealth.concerns.length === 0 && (
                                  <li className={styles.summaryItem} style={{ color: '#475569' }}>
                                    No notable concerns identified
                                  </li>
                                )}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ color: '#64748b', fontSize: '14px' }}>
                      No financial data available for this company. The analysis was performed using
                      web research only.
                    </div>
                  )}
                </div>
              )}

              {/* SWOT Analysis */}
              {activeTab === 'swot' && (
                <div>
                  {result.marketPosition && (
                    <div
                      style={{
                        background: 'rgba(15, 22, 41, 0.4)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '12px',
                        padding: '18px 22px',
                        marginBottom: '20px',
                        fontSize: '14px',
                        color: '#94a3b8',
                        lineHeight: 1.6,
                      }}
                    >
                      {result.marketPosition}
                    </div>
                  )}

                  {result.swot ? (
                    <div className={styles.swotGrid}>
                      <div className={`${styles.swotCard} ${styles.swotStrength}`}>
                        <div className={styles.swotTitle}>💪 Strengths</div>
                        <ul className={styles.swotList}>
                          {result.swot.strengths.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                      <div className={`${styles.swotCard} ${styles.swotWeakness}`}>
                        <div className={styles.swotTitle}>⚠️ Weaknesses</div>
                        <ul className={styles.swotList}>
                          {result.swot.weaknesses.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </div>
                      <div className={`${styles.swotCard} ${styles.swotOpportunity}`}>
                        <div className={styles.swotTitle}>🚀 Opportunities</div>
                        <ul className={styles.swotList}>
                          {result.swot.opportunities.map((o, i) => (
                            <li key={i}>{o}</li>
                          ))}
                        </ul>
                      </div>
                      <div className={`${styles.swotCard} ${styles.swotThreat}`}>
                        <div className={styles.swotTitle}>🛡️ Threats</div>
                        <ul className={styles.swotList}>
                          {result.swot.threats.map((t, i) => (
                            <li key={i}>{t}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: '#64748b', fontSize: '14px' }}>
                      SWOT analysis data not available.
                    </div>
                  )}
                </div>
              )}

              {/* Sentiment & News */}
              {activeTab === 'sentiment' && (
                <div>
                  {result.sentiment ? (
                    <>
                      {/* Sentiment Summary */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          marginBottom: '20px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span
                          className={`${styles.sentimentBadge} ${
                            result.sentiment.overallSentiment === 'positive'
                              ? styles.sentimentPositive
                              : result.sentiment.overallSentiment === 'negative'
                              ? styles.sentimentNegative
                              : styles.sentimentNeutral
                          }`}
                          style={{ fontSize: '13px', padding: '6px 16px' }}
                        >
                          {result.sentiment.overallSentiment === 'positive' && (
                            <ArrowUpRight size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                          )}
                          {result.sentiment.overallSentiment === 'negative' && (
                            <ArrowDownRight size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                          )}
                          {result.sentiment.overallSentiment === 'neutral' && (
                            <Minus size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                          )}
                          {result.sentiment.overallSentiment}
                        </span>
                        <span style={{ color: '#94a3b8', fontSize: '14px', lineHeight: 1.5 }}>
                          {result.sentiment.summary}
                        </span>
                      </div>

                      {/* Headlines */}
                      <div className={styles.newsGrid}>
                        {result.sentiment.headlines.map((headline, i) => (
                          <div key={i} className={styles.newsItem}>
                            <div>
                              <div className={styles.newsTitle}>{headline.title}</div>
                              <div className={styles.newsMeta}>
                                <span>{headline.source}</span>
                              </div>
                            </div>
                            <span
                              className={`${styles.sentimentBadge} ${
                                headline.sentiment === 'positive'
                                  ? styles.sentimentPositive
                                  : headline.sentiment === 'negative'
                                  ? styles.sentimentNegative
                                  : styles.sentimentNeutral
                              }`}
                            >
                              {headline.sentiment}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div style={{ color: '#64748b', fontSize: '14px' }}>
                      Sentiment analysis data not available.
                    </div>
                  )}
                </div>
              )}

              {/* System Logs */}
              {activeTab === 'logs' && (
                <div className={styles.terminal} style={{ marginTop: 0 }}>
                  <div className={styles.terminalHeader}>
                    <span className={styles.terminalDot} />
                    <span className={styles.terminalDot} />
                    <span className={styles.terminalDot} />
                    <span className={styles.terminalTitle}>
                      Full Execution Log — {logs.length} entries
                    </span>
                  </div>
                  <div className={styles.terminalBody} style={{ maxHeight: '500px' }}>
                    {logs.map((log, i) => (
                      <div key={i} className={styles.logEntry}>
                        <span className={styles.logTimestamp}>{formatTimestamp(log.timestamp)}</span>
                        <span
                          style={{
                            fontSize: '10px',
                            color: '#475569',
                            background: 'rgba(255,255,255,0.03)',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.3px',
                            flexShrink: 0,
                          }}
                        >
                          {log.stage}
                        </span>
                        <span className={styles.logMessage}>{log.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
