/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    '@langchain/core',
    '@langchain/langgraph',
    '@langchain/openai',
    '@langchain/google-genai',
    '@langchain/anthropic',
  ],
};

module.exports = nextConfig;
