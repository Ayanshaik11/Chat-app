'use strict';

const MODEL = 'gemini-2.5-flash';

async function generateReply(history, message) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const contents = [
    ...history.map(item => ({
      role: item.role,
      parts: [{ text: item.text }],
    })),
    {
      role: 'user',
      parts: [{ text: message }],
    },
  ];

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: {
          parts: [{
            text: 'You are King X AI, the helpful AI assistant inside the King X app. Be friendly, clear, and useful.'
          }]
        },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048
        }
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(
      data.error?.message || 'Gemini request failed'
    );
    error.status = response.status;
    throw error;
  }

  const reply = data.candidates?.[0]?.content?.parts
    ?.map(part => part.text || '')
    .join('')
    .trim();

  if (!reply) {
    throw new Error('Gemini returned an empty response');
  }

  return reply;
}

module.exports = { generateReply };
