export const CURSARE_DOCUMENT_VERSION = 1 as const

export const DEFAULT_CONTENT_HEADER_LAYOUT = ["cover", "title", "description"] as const
export type ContentHeaderLayoutItem = (typeof DEFAULT_CONTENT_HEADER_LAYOUT)[number]
export type ContentHeaderLayout = readonly [
  ContentHeaderLayoutItem,
  ContentHeaderLayoutItem,
  ContentHeaderLayoutItem,
]

export interface ContentImageAttribution {
  creatorName: string
  creatorUrl: string
  sourceUrl: string
}

export interface ContentImageFocalPoint {
  x: number
  y: number
}

export interface ContentImage {
  src: string
  alt: string
  assetId?: string | null
  attribution?: ContentImageAttribution | null
  focalPoint?: ContentImageFocalPoint | null
  width?: number | null
  height?: number | null
  mimeType?: string | null
}

export interface ContentHeader {
  title: string
  description: string
  image: ContentImage | null
  layout?: ContentHeaderLayout
}

export interface CursareDocument {
  version: typeof CURSARE_DOCUMENT_VERSION
  markdown: string
}

export interface ContentMark {
  type: string
  attrs?: Record<string, unknown>
}

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

export interface ContentNode {
  type: string
  attrs?: Record<string, unknown>
  content?: ContentNode[]
  text?: string
  marks?: ContentMark[]
}

export type ParsedContentDocument = ContentNode & { type: "doc" }

export interface DocumentDiagnostic {
  code:
    | "invalid_document"
    | "unsupported_version"
    | "document_too_large"
    | "document_too_deep"
    | "too_many_nodes"
    | "too_many_directives"
    | "invalid_directive"
    | "invalid_directive_payload"
    | "invalid_nesting"
    | "collection_too_large"
    | "invalid_header"
    | "unknown_directive"
    | "task_list_not_supported"
    | "duplicate_stable_id"
    | "missing_stable_id"
    | "unsafe_url"
    | "non_canonical_round_trip"
  message: string
  path: string
  line?: number
  column?: number
}

export const CURSARE_DOCUMENT_LIMITS = {
  maxBytes: 2 * 1024 * 1024,
  maxDepth: 32,
  maxNodes: 20_000,
  maxDirectives: 2_000,
  maxAtomicPayloadBytes: 128 * 1024,
  maxCollectionItems: 500,
} as const

export function emptyContentHeader(title = ""): ContentHeader {
  return { title, description: "", image: null }
}

export function isCursareDocument(value: unknown): value is CursareDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const document = value as Record<string, unknown>
  return (
    hasOnlyKeys(document, ["version", "markdown"]) &&
    document.version === CURSARE_DOCUMENT_VERSION &&
    typeof document.markdown === "string"
  )
}

export function isContentHeaderLayout(value: unknown): value is ContentHeaderLayout {
  return (
    Array.isArray(value) &&
    value.length === DEFAULT_CONTENT_HEADER_LAYOUT.length &&
    new Set(value).size === DEFAULT_CONTENT_HEADER_LAYOUT.length &&
    value.every((item) => DEFAULT_CONTENT_HEADER_LAYOUT.includes(item as ContentHeaderLayoutItem))
  )
}

export function isContentImage(value: unknown): value is ContentImage {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const image = value as Record<string, unknown>
  if (
    !hasOnlyKeys(image, [
      "src",
      "alt",
      "assetId",
      "attribution",
      "focalPoint",
      "width",
      "height",
      "mimeType",
    ])
  ) {
    return false
  }
  return (
    typeof image.src === "string" &&
    image.src.length <= 2_048 &&
    typeof image.alt === "string" &&
    image.alt.length <= 500 &&
    optionalString(image.assetId) &&
    optionalString(image.mimeType) &&
    optionalPositiveInteger(image.width) &&
    optionalPositiveInteger(image.height) &&
    isFocalPoint(image.focalPoint) &&
    isAttribution(image.attribution)
  )
}

function optionalString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === "string"
}

function optionalPositiveInteger(value: unknown): boolean {
  return value === undefined || value === null || (Number.isInteger(value) && Number(value) > 0)
}

function isFocalPoint(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const point = value as Record<string, unknown>
  if (!hasOnlyKeys(point, ["x", "y"])) return false
  return (
    typeof point.x === "number" &&
    point.x >= 0 &&
    point.x <= 1 &&
    typeof point.y === "number" &&
    point.y >= 0 &&
    point.y <= 1
  )
}

function isAttribution(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const attribution = value as Record<string, unknown>
  if (!hasOnlyKeys(attribution, ["creatorName", "creatorUrl", "sourceUrl"])) return false
  return (
    typeof attribution.creatorName === "string" &&
    typeof attribution.creatorUrl === "string" &&
    typeof attribution.sourceUrl === "string"
  )
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const allowed = new Set(keys)
  return Object.keys(value).every((key) => allowed.has(key))
}
