// The accent trio (`--fx-a/b/c`) the interactive components are painted with,
// chosen per content by the author. Pure module, so it is safe in client bundles
// and shared by core validation and the web.

// `ink` is the contrast text color for a saturated on-gradient surface.
export const CONTENT_THEMES = {
  ember: {
    label: "Ember",
    a: "#f59e0b",
    b: "#f97316",
    c: "#f43f5e",
    ink: "#451a03",
    actionInk: "#431407",
  },
  ocean: {
    label: "Ocean",
    a: "#06b6d4",
    b: "#2563eb",
    c: "#7c3aed",
    ink: "#082f49",
    actionInk: "#ffffff",
  },
  forest: {
    label: "Forest",
    a: "#84cc16",
    b: "#059669",
    c: "#0284c7",
    ink: "#052e16",
    actionInk: "#ffffff",
  },
  orchid: {
    label: "Orchid",
    a: "#d946ef",
    b: "#9333ea",
    c: "#4f46e5",
    ink: "#2e1065",
    actionInk: "#ffffff",
  },
  graphite: {
    label: "Graphite",
    a: "#d6d3d1",
    b: "#78716c",
    c: "#292524",
    ink: "#fafaf9",
    actionInk: "#ffffff",
  },
} as const

export type PresetContentTheme = keyof typeof CONTENT_THEMES
export type CustomContentTheme = `custom:#${string}`
export type ContentTheme = PresetContentTheme | CustomContentTheme

export const CONTENT_THEME_KEYS = Object.keys(CONTENT_THEMES) as PresetContentTheme[]
export const CUSTOM_CONTENT_THEME_PATTERN = /^custom:#[0-9a-f]{6}$/i

export function createCustomContentTheme(color: string): CustomContentTheme {
  const normalized = color.toLowerCase()
  if (!/^#[0-9a-f]{6}$/.test(normalized)) {
    throw new TypeError("A custom content theme requires a six-digit hex color.")
  }
  return `custom:${normalized}` as CustomContentTheme
}

export function customContentThemeColor(theme: string | null | undefined): string | null {
  return theme && CUSTOM_CONTENT_THEME_PATTERN.test(theme) ? theme.slice(7).toLowerCase() : null
}

export function isContentTheme(theme: string): theme is ContentTheme {
  return (
    CONTENT_THEME_KEYS.includes(theme as PresetContentTheme) ||
    CUSTOM_CONTENT_THEME_PATTERN.test(theme)
  )
}

function mixHex(color: string, target: "#ffffff" | "#000000", weight: number): string {
  const source = [1, 3, 5].map((start) => Number.parseInt(color.slice(start, start + 2), 16))
  const destination = target === "#ffffff" ? 255 : 0
  return `#${source
    .map((channel) => Math.round(channel + (destination - channel) * weight))
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`
}

function contrastInk(color: string): "#1c1917" | "#ffffff" {
  const red = Number.parseInt(color.slice(1, 3), 16) / 255
  const green = Number.parseInt(color.slice(3, 5), 16) / 255
  const blue = Number.parseInt(color.slice(5, 7), 16) / 255
  const linearize = (channel: number) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  const luminance = 0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue)
  // The relative-luminance crossover where black beats white under WCAG's
  // contrast formula.
  return luminance > 0.179 ? "#1c1917" : "#ffffff"
}

function resolveTheme(theme: string | null | undefined) {
  const customColor = customContentThemeColor(theme)
  if (customColor) {
    return {
      a: mixHex(customColor, "#ffffff", 0.28),
      b: customColor,
      c: mixHex(customColor, "#000000", 0.24),
      ink: contrastInk(mixHex(customColor, "#ffffff", 0.28)),
      actionInk: contrastInk(customColor),
    }
  }
  return CONTENT_THEMES[(theme as PresetContentTheme) ?? "ember"] ?? CONTENT_THEMES.ember
}

// Null means the brand default.
export function themeVars(theme: string | null | undefined): Record<string, string> {
  const entry = resolveTheme(theme)
  return {
    "--fx-a": entry.a,
    "--fx-b": entry.b,
    "--fx-c": entry.c,
    "--fx-ink": entry.ink,
    // Semantic learner-facing roles. Components consume these instead of
    // inventing local color mixes, which keeps the course identity continuous
    // from the offer through the reader and completion states.
    "--course-accent": entry.b,
    "--course-accent-start": entry.a,
    "--course-accent-end": entry.c,
    "--course-accent-ink": entry.ink,
    "--course-action-ink": entry.actionInk,
    "--course-hover": `color-mix(in oklab, var(--background) 94%, ${entry.b} 6%)`,
    "--course-soft": `color-mix(in oklab, var(--background) 92%, ${entry.b} 8%)`,
    "--course-selected": `color-mix(in oklab, var(--background) 86%, ${entry.b} 14%)`,
    "--course-focus": entry.b,
    "--course-canvas": "var(--background)",
    "--course-canvas-strong": `color-mix(in oklab, var(--background) 92%, ${entry.b} 8%)`,
    "--course-selection": `color-mix(in oklab, var(--background) 86%, ${entry.b} 14%)`,
  }
}
