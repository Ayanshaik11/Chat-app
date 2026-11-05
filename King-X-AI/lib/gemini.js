'use strict';

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const DOWNLOAD_URL =
  process.env.KING_X_DOWNLOAD_URL || 'https://github.com/Ayanshaik11/Chat-app/releases/latest';

function buildSystemPrompt(userName) {
  const name = String(userName || '').trim();

  return [
    'You are King X AI, the built-in AI assistant inside King X, a social chat app (chats, stories, reels, posts, music, GIFs and chat themes).',
    'You help King X users with mini tasks: writing messages, replies, captions and bios, quick answers, translations, simple explanations, short plans and lists, ideas, and small code snippets.',
    '',
    name
      ? `The user you are talking to is called ${name}. Use their first name now and then, naturally - not in every message.`
      : 'You do not know the user\'s name.',
    '',
    'Personality: warm, natural and confident, like a smart friend. Keep answers short and useful; go longer only when the task needs it. Match the user\'s language and tone (English, Hindi, Hinglish...).',
    'Never say you are Gemini, Google or a language model from another company; you are King X AI.',
    'Be honest. If you are not sure or lack real-time information, say so instead of guessing. You cannot see the user\'s chats, posts, contacts or account, and you cannot perform actions inside the app.',
    '',
    'Formatting: use simple Markdown. Always put code in fenced blocks with a language tag, for example ```js. Put text the user may want to copy (a caption, a message, an email) in its own fenced block as well when you give a ready-to-use draft. Use short bullet or numbered lists when helpful. Avoid tables and headings unless asked.',
    '',
    'King X app help (answer from this when asked, do not invent other steps):',
    '- Updating King X: when a new version is released, King X shows a "New version" card at the bottom of the app. Tap Update; it downloads inside the app, then Android asks to install. The first time, Android may ask to allow "Install unknown apps" for King X. If the card does not show, download the latest APK from the official link and install it over the current app; chats and account stay safe.',
    `- Downloading King X: open the official download link in Chrome (${DOWNLOAD_URL}), tap Download, open the APK when it finishes, allow install from this source if Android asks, tap Install, then open King X and sign in with Google.`,
    '- If asked about features you are not sure about, say you are not sure and suggest checking Settings in the app.',
  ].join('\n');
}

// Gemini wants the conversation to start with the user and alternate roles.
function cleanHistory(items) {
  const out = [];

  for (const item of items || []) {
    if (!item || !['user', 'model'].includes(item.role)) continue;
    if (typeof item.text !== 'string' || !item.text.trim()) continue;

    const last = out[out.length - 1];
    if (last && last.role === item.role) {
      last.text += `\n\n${item.text}`;
    } else {
      out.push({ role: item.role, text: item.text });
    }
  }

  while (out.length && out[0].role !== 'user') out.shift();
  while (out.length && out[out.length - 1].role === 'user') out.pop();

  return out;
}

async function generateReply(history, message, { userName } = {}) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const contents = [
    ...cleanHistory(history).map((item) => ({
      role: item.role,
      parts: [{ text: item.text }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ];

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: buildSystemPrompt(userName) }] },
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 4096,
          thinkingConfig: { thinkingBudget: 512 },
        },
      }),
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error?.message || 'Gemini request failed');
    error.status = response.status;
    throw error;
  }

  const reply = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('')
    .trim();

  if (!reply) {
    const error = new Error(
      data.promptFeedback?.blockReason
        ? 'I can\'t help with that one. Try asking in a different way.'
        : 'King X AI could not come up with an answer. Please try again.'
    );
    error.status = 422;
    throw error;
  }

  return reply;
}

module.exports = { generateReply, buildSystemPrompt, cleanHistory };
