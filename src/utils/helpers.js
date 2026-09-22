export const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

// same id for both people, e.g. chat between A and B
export const pairId = (a, b) => [a, b].sort().join('_');

export const toMillis = (ts) => {
  if (!ts) return Date.now();
  if (typeof ts === 'number') return ts;
  if (ts.toMillis) return ts.toMillis();
  if (ts.seconds) return ts.seconds * 1000;
  return Date.now();
};

export function timeAgo(ts) {
  const s = Math.max(0, Math.floor((Date.now() - toMillis(ts)) / 1000));
  if (s < 60) return 'now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(toMillis(ts)).toLocaleDateString();
}

export const clock = (ts) =>
  new Date(toMillis(ts)).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

// A user is only really "online" if their heartbeat (lastSeen) is recent —
// this avoids showing "Online" forever after someone closes/kills the app.
export const PRESENCE_WINDOW_MS = 70 * 1000;
export function isOnline(u) {
  if (!u?.online) return false;
  return Date.now() - toMillis(u.lastSeen) < PRESENCE_WINDOW_MS;
}

export function lastSeenText(u) {
  if (isOnline(u)) return 'Online';
  if (!u?.lastSeen) return 'Offline';
  const t = timeAgo(u.lastSeen);
  return t === 'now' ? 'Last seen just now' : `Last seen ${t} ago`;
}

export const initials = (name = '?') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';
