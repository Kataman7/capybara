require('dotenv').config();
const OpenAI = require('openai');

// Support any OpenAI-compatible endpoint by allowing a custom baseURL + API key.
// Prefer the generic AI_API_KEY for provider-agnostic setups.
// Old var names (OPENAI_API_KEY / OPENAI_KEY) are no longer supported.
const API_KEY = process.env.AI_API_KEY || '';
const BASE_URL = process.env.AI_API_BASE_URL || process.env.OPENAI_BASE_URL || undefined;

if (!API_KEY) {
  console.warn('Warning: no AI API key set. Please set AI_API_KEY.');
}

const openai = new OpenAI({ apiKey: API_KEY, baseURL: BASE_URL });

async function sendChat(messages, modelName) {
  return openai.chat.completions.create({
    messages,
    model: modelName || process.env.AI_MODEL || 'gpt-3.5-turbo'
  });
}

module.exports = { sendChat };
