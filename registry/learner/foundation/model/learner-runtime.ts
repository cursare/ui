export interface ContentImageAttribution {
  creatorName: string
  creatorUrl: string
  sourceUrl: string
}

export interface ContentImageFocalPoint {
  x: number
  y: number
}

export interface ContentMark {
  type: string
  attrs?: Record<string, unknown>
}

export interface ContentNode {
  type: string
  attrs?: Record<string, unknown>
  content?: ContentNode[]
  text?: string
  marks?: ContentMark[]
}

export type ParsedContentDocument = ContentNode & { type: "doc" }

export interface QuizOption {
  id: string
  text: string
}

export interface QuizQuestion {
  id: string
  prompt: string
  options: QuizOption[]
  correctOptionId: string | null
}

export const CODE_LANGUAGES = [
  { value: "plaintext", label: "Plain text" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "jsx", label: "JSX" },
  { value: "tsx", label: "TSX" },
  { value: "python", label: "Python" },
  { value: "json", label: "JSON" },
  { value: "markup", label: "HTML / XML" },
  { value: "css", label: "CSS" },
  { value: "scss", label: "SCSS" },
  { value: "bash", label: "Bash / Shell" },
  { value: "sql", label: "SQL" },
  { value: "graphql", label: "GraphQL" },
  { value: "java", label: "Java" },
  { value: "kotlin", label: "Kotlin" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "php", label: "PHP" },
  { value: "ruby", label: "Ruby" },
  { value: "swift", label: "Swift" },
  { value: "yaml", label: "YAML" },
  { value: "markdown", label: "Markdown" },
  { value: "docker", label: "Dockerfile" },
] as const

export type CodeLanguage = (typeof CODE_LANGUAGES)[number]
export type CodeLanguageValue = CodeLanguage["value"]

const languageValues = new Set<string>(CODE_LANGUAGES.map(({ value }) => value))
const CODE_LANGUAGE_ALIASES: Readonly<Record<string, CodeLanguageValue>> = {
  "c#": "csharp",
  "c++": "cpp",
  cs: "csharp",
  dockerfile: "docker",
  gql: "graphql",
  golang: "go",
  html: "markup",
  js: "javascript",
  json5: "json",
  kt: "kotlin",
  md: "markdown",
  node: "javascript",
  plain: "plaintext",
  py: "python",
  rb: "ruby",
  rs: "rust",
  sh: "bash",
  shell: "bash",
  text: "plaintext",
  ts: "typescript",
  txt: "plaintext",
  xml: "markup",
  yml: "yaml",
  zsh: "bash",
}

export function normalizeCodeLanguage(language: unknown): CodeLanguageValue {
  if (typeof language !== "string") return "plaintext"
  const value = language.trim().toLowerCase()
  const normalized = CODE_LANGUAGE_ALIASES[value] ?? value
  return languageValues.has(normalized) ? (normalized as CodeLanguageValue) : "plaintext"
}

export interface DiagramSourceNode {
  id: string
  label: string
  x: number
  y: number
}

export interface DiagramSourceEdge {
  source: string
  target: string
}

export interface DiagramSource {
  nodes: DiagramSourceNode[]
  edges: DiagramSourceEdge[]
}

const NODE_PATTERN =
  /^node\s+([a-zA-Z0-9_-]+)\s+("(?:\\.|[^"\\])*")\s+at\s+(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/
const EDGE_PATTERN = /^([a-zA-Z0-9_-]+)\s*->\s*([a-zA-Z0-9_-]+)$/

export function parseDiagramSource(source: string): DiagramSource {
  const nodes: DiagramSourceNode[] = []
  const edges: DiagramSourceEdge[] = []
  const ids = new Set<string>()

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const nodeMatch = NODE_PATTERN.exec(line)
    if (nodeMatch) {
      const [, id = "", encodedLabel = '""', x = "0", y = "0"] = nodeMatch
      if (ids.has(id)) continue
      let label = "Untitled"
      try {
        label = String(JSON.parse(encodedLabel))
      } catch {
        continue
      }
      ids.add(id)
      nodes.push({ id, label, x: Number(x), y: Number(y) })
      continue
    }
    const edgeMatch = EDGE_PATTERN.exec(line)
    if (edgeMatch) edges.push({ source: edgeMatch[1] ?? "", target: edgeMatch[2] ?? "" })
  }

  return {
    nodes,
    edges: edges.filter(({ source, target }) => ids.has(source) && ids.has(target)),
  }
}

export type EmbedProvider =
  | "stackblitz"
  | "codesandbox"
  | "codepen"
  | "figma"
  | "desmos"
  | "geogebra"

export interface ParsedEmbedUrl {
  provider: EmbedProvider
  label: "StackBlitz" | "CodeSandbox" | "CodePen" | "Figma" | "Desmos" | "GeoGebra"
  src: string
}

const ID_RE = /^[\w-]+$/

function hostIs(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`)
}

export function parseEmbedUrl(raw: string): ParsedEmbedUrl | null {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  if (url.protocol !== "https:") return null
  const host = url.hostname.toLowerCase()
  const segments = url.pathname.split("/").filter(Boolean)

  if (hostIs(host, "stackblitz.com")) {
    if (!url.searchParams.has("embed")) url.searchParams.set("embed", "1")
    return { provider: "stackblitz", label: "StackBlitz", src: url.toString() }
  }
  if (hostIs(host, "codesandbox.io")) {
    let id: string | undefined
    if (segments[0] === "p" && segments[1] === "sandbox") id = segments[2]
    else if (segments[0] === "s" || segments[0] === "embed") id = segments[1]
    if (!id || !ID_RE.test(id)) return null
    return {
      provider: "codesandbox",
      label: "CodeSandbox",
      src: `https://codesandbox.io/embed/${id}`,
    }
  }
  if (hostIs(host, "codepen.io")) {
    const [user, kind, id] = segments
    if (!user || !id || (kind !== "pen" && kind !== "embed")) return null
    if (!ID_RE.test(user) || !ID_RE.test(id)) return null
    return { provider: "codepen", label: "CodePen", src: `https://codepen.io/${user}/embed/${id}` }
  }
  if (hostIs(host, "figma.com")) {
    const kind = segments[0] ?? ""
    if (kind !== "file" && kind !== "proto" && kind !== "design") return null
    return {
      provider: "figma",
      label: "Figma",
      src: `https://www.figma.com/embed?embed_host=cursare&url=${encodeURIComponent(url.toString())}`,
    }
  }
  if (hostIs(host, "desmos.com")) {
    if (segments[0] !== "calculator") return null
    return { provider: "desmos", label: "Desmos", src: url.toString() }
  }
  if (hostIs(host, "geogebra.org")) {
    if (segments[0] === "m" && segments[1]) {
      if (!ID_RE.test(segments[1])) return null
      return {
        provider: "geogebra",
        label: "GeoGebra",
        src: `https://www.geogebra.org/material/iframe/id/${segments[1]}`,
      }
    }
    if (segments.length === 0) return null
    return { provider: "geogebra", label: "GeoGebra", src: url.toString() }
  }
  return null
}

export type VideoProvider = "file" | "hls" | "youtube" | "vimeo"
export type VideoUrlResult =
  | { status: "supported"; provider: VideoProvider; src: string }
  | { status: "unsupported-provider"; provider: "loom" }
  | { status: "invalid" }

const VIDEO_FILE_EXTENSION = /\.(?:m4v|mov|mp4|ogv|webm)$/i
const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/
const VIMEO_VIDEO_ID = /^\d+$/

function normalizedHost(url: URL): string {
  return url.hostname.toLowerCase().replace(/^www\./, "")
}

function isHost(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`)
}

function youtubeVideoId(url: URL): string | null {
  const host = normalizedHost(url)
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0]
    return id && YOUTUBE_VIDEO_ID.test(id) ? id : null
  }
  if (!isHost(host, "youtube.com") && !isHost(host, "youtube-nocookie.com")) return null
  const segments = url.pathname.split("/").filter(Boolean)
  const candidate =
    url.pathname === "/watch"
      ? url.searchParams.get("v")
      : ["embed", "live", "shorts", "v"].includes(segments[0] ?? "")
        ? segments[1]
        : null
  return candidate && YOUTUBE_VIDEO_ID.test(candidate) ? candidate : null
}

function vimeoVideo(url: URL): { id: string; hash: string | null } | null {
  const host = normalizedHost(url)
  if (!isHost(host, "vimeo.com")) return null
  const segments = url.pathname.split("/").filter(Boolean)
  const idIndex =
    segments[0] === "video" ? 1 : segments.findIndex((part) => VIMEO_VIDEO_ID.test(part))
  const id = segments[idIndex]
  if (!id || !VIMEO_VIDEO_ID.test(id)) return null
  const candidateHash =
    url.searchParams.get("h") ?? url.searchParams.get("hash") ?? segments[idIndex + 1]
  const hash = candidateHash && /^[A-Za-z0-9]+$/.test(candidateHash) ? candidateHash : null
  return { id, hash }
}

function parsedUrl(value: string): { persisted: string; url: URL } | null {
  if (value.startsWith("/") && !value.startsWith("//")) {
    return { persisted: value, url: new URL(value, "https://cursare.invalid") }
  }
  try {
    const url = new URL(value)
    return url.protocol === "https:" ? { persisted: url.href, url } : null
  } catch {
    return null
  }
}

export function resolveVideoUrl(raw: string): VideoUrlResult {
  const value = raw.trim()
  if (!value || value.length > 2_048) return { status: "invalid" }
  const parsed = parsedUrl(value)
  if (!parsed) return { status: "invalid" }

  const youtubeId = youtubeVideoId(parsed.url)
  if (youtubeId) {
    return {
      status: "supported",
      provider: "youtube",
      src: `https://www.youtube.com/watch?v=${youtubeId}`,
    }
  }
  const vimeo = vimeoVideo(parsed.url)
  if (vimeo) {
    return {
      status: "supported",
      provider: "vimeo",
      src: `https://vimeo.com/${vimeo.id}${vimeo.hash ? `?h=${vimeo.hash}` : ""}`,
    }
  }
  if (isHost(normalizedHost(parsed.url), "loom.com")) {
    return { status: "unsupported-provider", provider: "loom" }
  }

  const path = parsed.url.pathname.toLowerCase()
  if (path.endsWith(".m3u8")) return { status: "supported", provider: "hls", src: parsed.persisted }
  if (VIDEO_FILE_EXTENSION.test(path)) {
    return { status: "supported", provider: "file", src: parsed.persisted }
  }
  return { status: "invalid" }
}

export function isVideoProvider(value: unknown): value is VideoProvider {
  return value === "file" || value === "hls" || value === "youtube" || value === "vimeo"
}

export function isSafeVideoSource(src: unknown, provider: unknown): boolean {
  if (src === null || src === "") return isVideoProvider(provider)
  if (typeof src !== "string" || !isVideoProvider(provider)) return false
  const resolved = resolveVideoUrl(src)
  return resolved.status === "supported" && resolved.provider === provider
}

export type VideoTextTrackKind = "captions" | "subtitles"
export interface VideoTextTrack {
  src: string
  kind: VideoTextTrackKind
  label: string
  lang: string
  default?: boolean
}

const VIDEO_TEXT_TRACK_KINDS = new Set<VideoTextTrackKind>(["captions", "subtitles"])
const VIDEO_TEXT_TRACK_LANGUAGE = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/
const MAX_VIDEO_TEXT_TRACKS = 20

function isWebVttResourceUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value || value.length > 2_048) return false
  if (!value.startsWith("/") || value.startsWith("//")) {
    try {
      if (new URL(value).protocol !== "https:") return false
    } catch {
      return false
    }
  }
  return new URL(value, "https://cursare.invalid").pathname.toLowerCase().endsWith(".vtt")
}

function isVideoTextTrack(value: unknown): value is VideoTextTrack {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const track = value as Record<string, unknown>
  return (
    isWebVttResourceUrl(track.src) &&
    typeof track.kind === "string" &&
    VIDEO_TEXT_TRACK_KINDS.has(track.kind as VideoTextTrackKind) &&
    typeof track.label === "string" &&
    track.label.length > 0 &&
    track.label.length <= 80 &&
    track.label === track.label.trim() &&
    typeof track.lang === "string" &&
    VIDEO_TEXT_TRACK_LANGUAGE.test(track.lang) &&
    (track.default === undefined || typeof track.default === "boolean")
  )
}

export function videoTextTracks(value: unknown): VideoTextTrack[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, MAX_VIDEO_TEXT_TRACKS).filter(isVideoTextTrack)
}

const CONTENT_THEMES = {
  ember: { a: "#f59e0b", b: "#f97316", c: "#f43f5e", ink: "#451a03", actionInk: "#431407" },
  ocean: { a: "#06b6d4", b: "#2563eb", c: "#7c3aed", ink: "#082f49", actionInk: "#ffffff" },
  forest: { a: "#84cc16", b: "#059669", c: "#0284c7", ink: "#052e16", actionInk: "#ffffff" },
  orchid: { a: "#d946ef", b: "#9333ea", c: "#4f46e5", ink: "#2e1065", actionInk: "#ffffff" },
  graphite: { a: "#d6d3d1", b: "#78716c", c: "#292524", ink: "#fafaf9", actionInk: "#ffffff" },
} as const

function customContentThemeColor(theme: string | null | undefined): string | null {
  return theme && /^custom:#[0-9a-f]{6}$/i.test(theme) ? theme.slice(7).toLowerCase() : null
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
  return CONTENT_THEMES[(theme as keyof typeof CONTENT_THEMES) ?? "ember"] ?? CONTENT_THEMES.ember
}

export function themeVars(theme: string | null | undefined): Record<string, string> {
  const entry = resolveTheme(theme)
  return {
    "--fx-a": entry.a,
    "--fx-b": entry.b,
    "--fx-c": entry.c,
    "--fx-ink": entry.ink,
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

export interface LearnerAnchor {
  id: string
  nodeType: string
  label: string
  sectionId: string | null
  sectionLabel: string | null
  order: number
}

const LEARNER_ANCHOR_ATTR = "learnerAnchorId"
const LEARNER_ANCHOR_LABEL_LIMIT = 96
const IDENTITY_ATTR_BY_NODE_TYPE = new Map<string, string>([
  ["heading", "blockId"],
  ["reference", "blockId"],
  ["callout", "id"],
  ["steps", "id"],
  ["step", "id"],
  ["poll", "pollId"],
])

function textOf(node: ContentNode | undefined): string {
  if (!node) return ""
  if (typeof node.text === "string") return node.text
  return (node.content ?? []).map(textOf).join(" ")
}

function learnerAnchorLabel(node: ContentNode): string {
  const text = textOf(node).replace(/\s+/g, " ").trim()
  if (text) return text.slice(0, LEARNER_ANCHOR_LABEL_LIMIT)
  const explicit = [
    node.attrs?.title,
    node.attrs?.name,
    node.attrs?.question,
    node.attrs?.label,
  ].find((value) => typeof value === "string" && value.trim())
  if (typeof explicit === "string") return explicit.trim().slice(0, LEARNER_ANCHOR_LABEL_LIMIT)
  return node.type
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase())
}

export function learnerAnchorId(node: ContentNode): string | null {
  const identityAttr = IDENTITY_ATTR_BY_NODE_TYPE.get(node.type) ?? LEARNER_ANCHOR_ATTR
  const value = node.attrs?.[identityAttr]
  return typeof value === "string" && value.trim() ? value : null
}

export function learnerAnchors(doc: ParsedContentDocument): LearnerAnchor[] {
  const anchors: LearnerAnchor[] = []
  let sectionId: string | null = null
  let sectionLabel: string | null = null
  for (const [order, node] of (doc.content ?? []).entries()) {
    const id = learnerAnchorId(node)
    if (!id) continue
    if (node.type === "heading") {
      sectionId = id
      sectionLabel = learnerAnchorLabel(node)
    }
    anchors.push({
      id,
      nodeType: node.type,
      label: learnerAnchorLabel(node),
      sectionId,
      sectionLabel,
      order,
    })
  }
  return anchors
}
