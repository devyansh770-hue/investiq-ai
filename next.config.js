/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow streaming responses from API routes
  experimental: {
    serverComponentsExternalPackages: [
      '@langchain/core',
      '@langchain/langgraph',
      '@langchain/openai',
      '@langchain/google-genai',
      '@langchain/anthropic',
    ],
  },
};

module.exports = nextConfig;
