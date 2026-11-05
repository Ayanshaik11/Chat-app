// King X AI - where the AI backend lives (the Vercel project in the King-X-AI folder)
export const KING_X_AI_URL = (
  process.env.EXPO_PUBLIC_KING_X_AI_URL || 'https://chat-app-king-x-ai.vercel.app'
).replace(/\/+$/, '');

// Official King X download page. Change it here if the page moves.
export const KING_X_DOWNLOAD_URL =
  process.env.EXPO_PUBLIC_KING_X_DOWNLOAD_URL || 'https://download-kingx.vercel.app/';

// Ready-made messages shown when the chat opens.
//  - `answer`  : answered instantly by the app (no internet needed), still shown with thinking + typing
//  - no answer : sent to King X AI like a normal message
export const QUICK_PROMPTS = [
  {
    id: 'update',
    icon: 'cloud-download-outline',
    label: 'How to update King X?',
    answer: [
      'Here\'s how to update King X 📲',
      '',
      '**Inside the app (easiest)**',
      '1. Open King X. When a new version is out, a **New version** card slides up at the bottom.',
      '2. Tap **Update** - it downloads inside the app.',
      '3. When it finishes, Android asks to install. Tap **Install**.',
      '',
      'The first time, Android may ask you to allow **Install unknown apps** for King X. Turn it on, go back and tap Update again.',
      '',
      '**Don\'t see the card?** Download the latest APK from the link below and install it over your current app. Your account and chats stay safe.',
      '',
      KING_X_DOWNLOAD_URL,
    ].join('\n'),
  },
  {
    id: 'download',
    icon: 'link-outline',
    label: 'How to download via link?',
    answer: [
      'Here\'s how to download King X from the link 🔗',
      '',
      '1. Open this link in **Chrome**:',
      KING_X_DOWNLOAD_URL,
      '2. Tap **Download** for the latest version.',
      '3. When the APK finishes, tap **Open** in the download notification.',
      '4. If Android asks, allow **Install from this source** for Chrome.',
      '5. Tap **Install**, then open King X and sign in with Google.',
      '',
      'Tip: use **Chrome** - some browsers block APK downloads.',
    ].join('\n'),
  },
  {
    id: 'about',
    icon: 'sparkles-outline',
    label: 'What can you do?',
    answer: [
      'I\'m **King X AI**, your mini-task helper inside King X ✨',
      '',
      '- ✍️ Write captions, bios and message replies',
      '- 🌐 Translate and fix your writing',
      '- 💡 Explain things in a simple way',
      '- 📝 Make quick lists, plans and ideas',
      '- 🧑‍💻 Write small code snippets - code comes in its own block with a **Copy** button',
      '',
      'Just type what you need.',
    ].join('\n'),
  },
  {
    id: 'caption',
    icon: 'image-outline',
    label: 'Caption for my post',
    prompt: 'Write 3 short, catchy caption ideas for my King X post. Ask me what the post is about first if you need to.',
  },
  {
    id: 'reply',
    icon: 'chatbubble-ellipses-outline',
    label: 'Help me reply',
    prompt: 'Help me write a polite reply to a message. Ask me what the message says and how I want to answer.',
  },
  {
    id: 'code',
    icon: 'code-slash-outline',
    label: 'Show a code example',
    prompt: 'Show me a small JavaScript example that reverses a string, with a short explanation.',
  },
];

const GREETINGS = [
  (n) => `Hey ${n}, what's up? 👋`,
  (n) => `Yo ${n}! What's up? 😄`,
  (n) => `Hi ${n}, what's up today? ✨`,
];

export const greetingFor = (name) => {
  const first = String(name || '').trim().split(/\s+/)[0] || 'there';
  const pick = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
  return `${pick(first)}\n\nI'm King X AI. Ask me anything, or tap one of the quick ones below.`;
};
