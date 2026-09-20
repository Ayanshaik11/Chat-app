export const STORY_MS = 24 * 60 * 60 * 1000;

export function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value === "number") return new Date(value);
  return null;
}

// 1706... -> "just now" / "7m" / "3h" / "2d" / "14 Mar"
export function timeAgo(value) {
  const date = toDate(value);
  if (!date) return "";

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${date.getDate()} ${months[date.getMonth()]}`;
}

export function clockTime(value) {
  const date = toDate(value);
  if (!date) return "";
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const suffix = hours >= 12 ? "pm" : "am";
  return `${((hours + 11) % 12) + 1}:${minutes} ${suffix}`;
}

// Stories older than 24 hours are never shown
export function isLive(story) {
  const date = toDate(story.createdAt);
  if (!date) return true; // just written, server timestamp not back yet
  return Date.now() - date.getTime() < STORY_MS;
}

export function storyHoursLeft(story) {
  const date = toDate(story.createdAt);
  if (!date) return 24;
  return Math.max(0, Math.ceil((STORY_MS - (Date.now() - date.getTime())) / 3600000));
}

// Both people share one chat document, whoever opens it first
export function chatIdFor(a, b) {
  return [a, b].sort().join("__");
}

export function initials(name, email) {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/);
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function handleFromEmail(email) {
  return "@" + String(email || "user").split("@")[0].toLowerCase().replace(/[^a-z0-9._]/g, "");
}

export function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
