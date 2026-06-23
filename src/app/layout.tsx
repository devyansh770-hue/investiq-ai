import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DeepVest — AI Investment Research Agent",
  description:
    "An AI-powered investment research agent that performs deep multi-stage analysis on any public company: financials, market position, news sentiment, SWOT analysis — and delivers a clear INVEST or PASS decision with detailed reasoning.",
  keywords: [
    "investment research",
    "AI agent",
    "stock analysis",
    "financial analysis",
    "SWOT analysis",
    "market sentiment",
    "LangGraph",
  ],
  authors: [{ name: "DeepVest" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
