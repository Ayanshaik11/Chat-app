'use strict';

const {
  generateReply: generateGeminiReply,
  buildSystemPrompt,
} = require('./gemini');

const TOTAL_BUDGET_MS = 48000;
const PROVIDER_TIMEOUT_MS = 9000;
const MIN_REMAINING_MS = 3000;

function providerError(message, status = 503) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getText(data) {
  const content = data?.choices?.[0]?.message?.content;

  if (typeof content === 'string') return content.trim();

  if (Array.isArray(content)) {
    return content.map((part) => part.text || '').join('').trim();
  }

  return '';
}

async function openAIRequest({
  url,
  key,
  model,
  history,
  message,
  userName,
  headers = {},
  timeoutMs,
}) {
  const messages = [
    { role: 'system', content: buildSystemPrompt(userName) },
    ...(history || [])
      .filter((item) =>
        ['user', 'model'].includes(item?.role) &&
        typeof item.text === 'string'
      )
      .map((item) => ({
        role: item.role === 'model' ? 'assistant' : 'user',
        content: item.text,
      })),
    { role: 'user', content: message },
  ];

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      ...headers,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.8,
      max_tokens: 2048,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw providerError(
      data.error?.message || data.message ||
      `Provider returned HTTP ${response.status}`,
      response.status
    );
  }

  const reply = getText(data);

  if (!reply) {
    throw providerError('Provider returned an empty answer');
  }

  return reply;
}

async function generateReply(history, message, { userName } = {}) {
  const startedAt = Date.now();

  const remaining = () =>
    TOTAL_BUDGET_MS - (Date.now() - startedAt);

  const providers = [
    {
      name: 'Cloudflare',
      enabled: () =>
        !!(
          process.env.CLOUDFLARE_ACCOUNT_ID &&
          process.env.CLOUDFLARE_API_TOKEN
        ),
      run: (timeoutMs) => openAIRequest({
        url: `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1/chat/completions`,
        key: process.env.CLOUDFLARE_API_TOKEN,
        model:
          process.env.CLOUDFLARE_MODEL ||
          '@cf/meta/llama-3.1-8b-instruct-fp8',
        history,
        message,
        userName,
        timeoutMs,
      }),
    },
    {
      name: 'Groq',
      enabled: () => !!process.env.GROQ_API_KEY,
      run: (timeoutMs) => openAIRequest({
        url: 'https://api.groq.com/openai/v1/chat/completions',
        key: process.env.GROQ_API_KEY,
        model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
        history,
        message,
        userName,
        timeoutMs,
      }),
    },
    {
      name: 'Gemini',
      enabled: () => !!process.env.GEMINI_API_KEY,
      run: (timeoutMs) =>
        generateGeminiReply(history, message, {
          userName,
          timeoutMs,
        }),
    },
    {
      name: 'OpenRouter',
      enabled: () => !!process.env.OPENROUTER_API_KEY,
      run: (timeoutMs) => openAIRequest({
        url: 'https://openrouter.ai/api/v1/chat/completions',
        key: process.env.OPENROUTER_API_KEY,
        model: 'openrouter/free',
        history,
        message,
        userName,
        timeoutMs,
        headers: {
          'HTTP-Referer': 'https://chat-app-king-x-ai.vercel.app',
          'X-Title': 'King X AI',
        },
      }),
    },
  ];

  const failures = [];

  for (const provider of providers) {
    const left = remaining();

    if (left < MIN_REMAINING_MS) {
      console.warn('King X AI: total time budget exhausted');
      break;
    }

    if (!provider.enabled()) {
      failures.push(`${provider.name}: not configured`);
      continue;
    }

    const timeoutMs = Math.max(
      1000,
      Math.min(PROVIDER_TIMEOUT_MS, left - 1000)
    );

    try {
      const reply = await provider.run(timeoutMs);

      console.log(`King X AI provider: ${provider.name}`);
      return reply;
    } catch (error) {
      console.error(
        `King X AI ${provider.name} failed:`,
        error.message
      );

      failures.push(`${provider.name}: ${error.message}`);

      // Never bypass a safety refusal.
      if (error.status === 422) throw error;
    }
  }

  console.error('King X AI provider failures:', failures);

  throw providerError(
    'All configured AI providers are currently unavailable. Please try again later.'
  );
}

module.exports = { generateReply };
