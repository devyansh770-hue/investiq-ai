# DeepVest — AI Investment Research Agent

An AI-powered investment research platform that performs deep multi-stage analysis on any publicly traded company and delivers a clear **INVEST** or **PASS** decision with detailed reasoning.

![DeepVest](https://img.shields.io/badge/DeepVest-AI_Research-gold?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)
![LangChain](https://img.shields.io/badge/LangChain-JS-green?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)

---

## 🏗️ Architecture

DeepVest uses a **multi-stage research agent** built with LangChain.js that executes the following pipeline:

```
[Company Name Input]
       │
       ▼
┌─────────────────┐
│  1. IDENTIFY     │  → Find ticker, sector, company profile
│     COMPANY      │     (Yahoo Finance + Web Search + LLM)
└──────┬──────────┘
       ▼
┌─────────────────┐
│  2. FINANCIAL    │  → Pull key metrics: P/E, ROE, margins,
│     ANALYSIS     │     debt/equity, growth, analyst targets
└──────┬──────────┘
       ▼
┌─────────────────┐
│  3. MARKET &     │  → Competitors, market position,
│     SWOT         │     SWOT analysis (Strengths/Weaknesses/
│                  │     Opportunities/Threats)
└──────┬──────────┘
       ▼
┌─────────────────┐
│  4. SENTIMENT    │  → Recent news analysis, headline
│     ANALYSIS     │     sentiment, analyst consensus
└──────┬──────────┘
       ▼
┌─────────────────┐
│  5. DECISION     │  → Synthesize all data into INVEST/PASS
│     SYNTHESIS    │     with scoring across 5 dimensions
└─────────────────┘
```

### Scoring Dimensions (each out of 20, total 100)
| Dimension | What it measures |
|-----------|-----------------|
| **Value** | How attractively the stock is priced |
| **Growth** | Revenue/earnings growth trajectory |
| **Financial Health** | Balance sheet strength, debt levels |
| **Moat** | Competitive advantage durability |
| **Sentiment** | Market perception, news, analyst views |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ and npm
- At least one LLM API key (OpenAI, Google Gemini, or Anthropic)

### 1. Clone & Install

```bash
cd investment-agent
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your API keys:

```env
# Choose one LLM provider
GOOGLE_API_KEY=your_gemini_key     # Recommended (cheapest)
OPENAI_API_KEY=your_openai_key     # Alternative
ANTHROPIC_API_KEY=your_anthropic_key # Alternative

# Search (optional but recommended)
TAVILY_API_KEY=your_tavily_key     # Best for research
SERPER_API_KEY=your_serper_key     # Google Search alternative

# Default provider
DEFAULT_LLM_PROVIDER=gemini
```

> **Note:** You can also enter API keys directly in the Settings panel in the UI — no `.env.local` required.

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and start researching!

---

## 💻 Technology Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Framework** | Next.js 15 (App Router) | Unified frontend + backend, SSR, API routes |
| **Language** | TypeScript | Type safety across the full stack |
| **Styling** | CSS Modules (Vanilla CSS) | Scoped styles, maximum control, no dependencies |
| **AI/LLM** | LangChain.js | Multi-provider LLM abstraction |
| **Agent Workflow** | Custom graph pipeline | Sequential multi-stage research execution |
| **Financial Data** | Yahoo Finance (public API) | Real-time stock data, no key required |
| **Web Search** | Tavily / Serper / DuckDuckGo | Tiered search with automatic fallback |
| **Icons** | Lucide React | Consistent, lightweight icon library |
| **Streaming** | Server-Sent Events (SSE) | Real-time log streaming from backend to UI |

---

## 📁 Project Structure

```
investment-agent/
├── src/
│   ├── app/
│   │   ├── api/research/
│   │   │   └── route.ts          # SSE streaming API endpoint
│   │   ├── globals.css           # CSS reset & base styles
│   │   ├── layout.tsx            # HTML layout, fonts, metadata
│   │   ├── page.module.css       # Dashboard styles (1100+ lines)
│   │   └── page.tsx              # Main dashboard component
│   └── lib/
│       ├── graph.ts              # Research workflow (5-stage pipeline)
│       └── tools/
│           ├── finance.ts        # Yahoo Finance data fetcher
│           └── search.ts         # Multi-provider web search
├── .env.example                  # Environment variable template
├── next.config.js                # Next.js configuration
├── package.json                  # Dependencies
├── README.md                     # This file
└── tsconfig.json                 # TypeScript configuration
```

---

## 🎨 UI Features

- **Dark glassmorphism theme** — premium, not template-looking
- **Real-time terminal** — watch the AI agent think step-by-step
- **Decision panel** — glowing INVEST/PASS badge with confidence score
- **5 tabbed views**: Executive Summary, Financials, SWOT, Sentiment, Logs
- **Responsive** — works on desktop, tablet, and mobile
- **Settings panel** — configure LLM provider and API keys in-app

---

## 🔑 Supported LLM Providers

| Provider | Models | Env Variable |
|----------|--------|-------------|
| **Google Gemini** | gemini-1.5-flash, gemini-1.5-pro | `GOOGLE_API_KEY` |
| **OpenAI** | gpt-4o-mini, gpt-4o | `OPENAI_API_KEY` |
| **Anthropic** | claude-3-5-sonnet | `ANTHROPIC_API_KEY` |

---

## 📝 Design Decisions

1. **Why CSS Modules over Tailwind?** — The assignment requires Vanilla CSS. CSS Modules provide scoped styles with full control and zero runtime overhead.

2. **Why not a full LangGraph state machine?** — We use a simplified sequential pipeline that achieves the same multi-stage workflow without the complexity of a state graph. Each stage passes results forward.

3. **Why Yahoo Finance?** — Free, requires no API key, provides comprehensive fundamental data for public companies.

4. **Why SSE over WebSockets?** — Simpler implementation for uni-directional streaming (server → client). Perfect for log streaming.

5. **Why tiered search?** — Tavily gives best research results but requires a key. DuckDuckGo works as a zero-config fallback.

---

## License

MIT
