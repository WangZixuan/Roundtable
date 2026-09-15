export const AGENT_COLOR_NAMES = [
  "green", "blue", "red", "orange", "purple",
  "cyan", "pink", "yellow", "teal", "coral",
] as const;

export type AgentColor = (typeof AGENT_COLOR_NAMES)[number];

export const AGENT_COLORS = {
  green: "#009957",
  blue: "#377FE6",
  red: "#D94B52",
  orange: "#E78531",
  purple: "#8057C8",
  cyan: "#0EA5C6",
  pink: "#D84F8B",
  yellow: "#D8A729",
  teal: "#01A492",
  coral: "#E5634E",
} satisfies Record<AgentColor, string>;

const graphemes = (value: string): string[] => {
  return Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value), ({ segment }) => segment);
};

/** Two compact, Unicode-safe characters for an agent avatar. */
export function agentInitials(fullName: string): string {
  const normalized = fullName.normalize("NFKC").trim().replace(/\s+/gu, " ");
  if (!normalized) return "?";
  const words = normalized.split(" ");
  const initials = words.length > 1
    ? `${graphemes(words[0])[0] ?? ""}${graphemes(words[words.length - 1])[0] ?? ""}`
    : graphemes(words[0]).slice(0, 2).join("");
  return initials.toLocaleUpperCase();
}

/** Stable FNV-1a mapping from a normalized full name into the ten-color palette. */
export function agentColorIndex(fullName: string): number {
  const normalized = fullName.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();
  let hash = 0x811c9dc5;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % AGENT_COLOR_NAMES.length;
}

export function agentColorForName(fullName: string): AgentColor {
  return AGENT_COLOR_NAMES[agentColorIndex(fullName)];
}

/** Pick the more legible foreground for a palette-colored avatar surface. */
export function agentAvatarForeground(color: AgentColor): "#111111" | "#ffffff" {
  const hex = AGENT_COLORS[color].slice(1);
  const channels = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const luminance = channels
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  const whiteContrast = 1.05 / (luminance + 0.05);
  const blackContrast = (luminance + 0.05) / 0.05;
  return whiteContrast >= blackContrast ? "#ffffff" : "#111111";
}
