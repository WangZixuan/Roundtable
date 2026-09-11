// Skins are pure CSS. Every one of them is a block of custom properties in
// styles.css, selected by a `data-skin` attribute; this module only decides
// which one is active and remembers the choice. Nothing here knows a colour —
// that keeps the two halves from drifting apart, and it means adding a skin is
// one CSS block plus one line in SKINS.

export const SKIN_IDS = ["midnight", "atelier", "foundry", "lagoon"] as const;
export type SkinId = (typeof SKIN_IDS)[number];

export type Skin = {
  id: SkinId;
  name: string;
  /** One line, shown under the name in the picker. */
  tagline: string;
};

export const SKINS: readonly Skin[] = [
  { id: "midnight", name: "Midnight", tagline: "The original. Cool and dark." },
  { id: "atelier", name: "Atelier", tagline: "Daylight on paper, warm and quiet." },
  { id: "foundry", name: "Foundry", tagline: "Night shift. Dark, warm, lit in brass." },
  { id: "lagoon", name: "Lagoon", tagline: "Cool daylight. Porcelain and deep teal." },
];

export const DEFAULT_SKIN: SkinId = "lagoon";

const KEY = "omb-skin";
const TITLE_BAR_SURFACE_KEY = "titleBarSurface";
const TITLE_BAR_BACKDROP_KEY = "titleBarBackdrop";

export type TitleBarSurface = "app" | "chat" | "panel";

export function dimTitleBarColor(color: string, opacity: number): string {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!match) return color;
  const channel = (value: string) => Math.round(Number.parseInt(value, 16) * (1 - opacity)).toString(16).padStart(2, "0");
  return `#${channel(match[1])}${channel(match[2])}${channel(match[3])}`;
}

// The input is whatever localStorage handed back — a string this app wrote
// on an earlier run, a value edited by hand, or a leftover from a renamed
// skin. The list is the schema.
function isSkinId(value: unknown): value is SkinId {
  // SAFETY: the assertion only satisfies includes()' parameter type; the
  // check itself is what decides, and a non-member returns false.
  return SKIN_IDS.includes(value as SkinId);
}

// Reaching for localStorage is itself a failure point: on an origin with
// storage blocked the getter throws, and `typeof` alone doesn't shield it.
function getStore(): Storage | undefined {
  try {
    // A bare feature test, not a narrowing of parsed input: in a renderer
    // without storage the identifier is simply not defined.
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

export function readSkin(): SkinId {
  try {
    const stored = getStore()?.getItem(KEY);
    return isSkinId(stored) ? stored : DEFAULT_SKIN;
  } catch {
    return DEFAULT_SKIN;
  }
}

/** Match Windows' native caption-button overlay to the surface beneath it. */
function syncTitleBarTheme(): void {
  const storedSurface = document.documentElement.dataset[TITLE_BAR_SURFACE_KEY];
  const surface: TitleBarSurface = storedSurface === "app" || storedSurface === "panel" ? storedSurface : "chat";
  const styles = getComputedStyle(document.documentElement);
  const backgroundToken =
    surface === "panel" ? "--color-panel" : surface === "app" ? "--color-app" : "--color-chat-background";
  const surfaceBackground = styles.getPropertyValue(backgroundToken).trim() || styles.getPropertyValue("--color-app").trim();
  const backdropOpacity = Number.parseFloat(document.documentElement.dataset[TITLE_BAR_BACKDROP_KEY] ?? "0");
  const background = backdropOpacity > 0
    ? dimTitleBarColor(surfaceBackground, backdropOpacity)
    : surfaceBackground;
  window.ogb?.setTitleBarTheme?.({
    background,
    symbols: styles.getPropertyValue("--color-ink").trim(),
  });
}

export function setTitleBarSurface(surface: TitleBarSurface, backdropOpacity = 0): void {
  document.documentElement.dataset[TITLE_BAR_SURFACE_KEY] = surface;
  document.documentElement.dataset[TITLE_BAR_BACKDROP_KEY] = String(backdropOpacity);
  syncTitleBarTheme();
}

export function setTitleBarBackdrop(backdropOpacity: number): void {
  document.documentElement.dataset[TITLE_BAR_BACKDROP_KEY] = String(backdropOpacity);
  syncTitleBarTheme();
}

/**
 * Point the document at a skin and remember it. Called once before the first
 * paint (main.tsx) and again on every change from the picker — a stamped
 * attribute rather than a class so it can never collide with Tailwind.
 */
export function applySkin(id: SkinId): void {
  document.documentElement.dataset.skin = id;
  syncTitleBarTheme();
  try {
    getStore()?.setItem(KEY, id);
  } catch {
    /* quota / private mode — the skin still applies for this session */
  }
}
