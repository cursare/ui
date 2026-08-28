import remarkDirective from "remark-directive"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import remarkStringify from "remark-stringify"
import { unified } from "unified"
import { resolveAudioUrl } from "./audio-url"
import { parseEmbedUrl } from "./embed-url"
import { RETAINED_BLOCK_TYPES, RETAINED_MARK_TYPES } from "./inventory"
import {
  type ContentHeader,
  type ContentHeaderLayout,
  type ContentHeaderLayoutItem,
  type ContentMark,
  type ContentNode,
  CURSARE_DOCUMENT_LIMITS,
  CURSARE_DOCUMENT_VERSION,
  type CursareDocument,
  DEFAULT_CONTENT_HEADER_LAYOUT,
  type DocumentDiagnostic,
  emptyContentHeader,
  isContentImage,
  isCursareDocument,
  type ParsedContentDocument,
} from "./schema"
import { resolveVideoUrl } from "./video-url"

interface MdPosition {
  start?: { line?: number; column?: number }
}

interface MdNode {
  type: string
  value?: string
  depth?: number
  ordered?: boolean
  start?: number | null
  checked?: boolean | null
  url?: string
  alt?: string
  lang?: string | null
  name?: string
  attributes?: Record<string, string | null> | null
  children?: MdNode[]
  align?: Array<"left" | "right" | "center" | null>
  position?: MdPosition
}

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkDirective)
const stringifier = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkDirective)
  .use(remarkStringify, {
    bullet: "-",
    fences: true,
    listItemIndent: "one",
    rule: "-",
    emphasis: "*",
    strong: "*",
  })

const containerTypes: Record<string, string> = {
  callout: "callout",
  table: "tableBlock",
  steps: "steps",
  step: "step",
}

const atomicTypes: Record<string, string> = {
  image: "image",
  video: "video",
  audio: "audio",
  file: "fileAttachment",
  embed: "embed",
  diagram: "diagram",
  math: "mathBlock",
  poll: "poll",
  reference: "reference",
}

const activityTypes: Record<string, string> = {
  quiz: "questionPool",
}

export class CursareDocumentError extends TypeError {
  readonly diagnostics: DocumentDiagnostic[]

  constructor(diagnostics: DocumentDiagnostic[]) {
    super(diagnostics[0]?.message ?? "The Cursare document is invalid.")
    this.name = "CursareDocumentError"
    this.diagnostics = diagnostics
  }
}

function diagnostic(
  code: DocumentDiagnostic["code"],
  message: string,
  path: string,
  node?: MdNode,
): DocumentDiagnostic {
  return {
    code,
    message,
    path,
    line: node?.position?.start?.line,
    column: node?.position?.start?.column,
  }
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

function safeUrl(value: string, links = false): boolean {
  if (!value || value.length > 2_048) return false
  if (
    value.startsWith("#") ||
    (value.startsWith("/") && !value.startsWith("//")) ||
    value.startsWith("./") ||
    value.startsWith("../")
  ) {
    return true
  }
  try {
    const protocol = new URL(value).protocol
    return links ? ["https:", "http:", "mailto:", "tel:"].includes(protocol) : protocol === "https:"
  } catch {
    return false
  }
}

function parseAttributeValue(value: string | null | undefined): unknown {
  if (value === null || value === undefined) return null
  if (value === "true") return true
  if (value === "false") return false
  if (value === "null") return null
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value)
  return value
}

function directiveAttrs(node: MdNode): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(node.attributes ?? {}).map(([key, value]) => [key, parseAttributeValue(value)]),
  )
}

function textOfMdast(node: MdNode): string {
  if (typeof node.value === "string") return node.value
  return (node.children ?? []).map(textOfMdast).join("")
}

function directDirectiveChildren(node: MdNode, name: string): MdNode[] {
  return (node.children ?? []).filter(
    (child) =>
      (child.type === "containerDirective" || child.type === "leafDirective") &&
      child.name === name,
  )
}

function directDirectiveChild(node: MdNode, name: string): MdNode | undefined {
  return directDirectiveChildren(node, name)[0]
}

function directiveText(node: MdNode | undefined): string {
  return node ? textOfMdast(node).trim() : ""
}

// Text of a node's LOOSE content only — excludes :::title/:::description/:::source
// field directives (which have their own accessors). A diagram/math body carries
// its source inline, so without this a stray :::title would leak into the source
// and canonicalize into a broken render.
function looseText(node: MdNode): string {
  return (node.children ?? [])
    .filter(
      (child) =>
        child.type !== "containerDirective" &&
        child.type !== "leafDirective" &&
        child.type !== "textDirective",
    )
    .map(textOfMdast)
    .join("")
    .trim()
}

function primitiveAttributes(
  node: MdNode,
  excluded: ReadonlySet<string> = new Set(),
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(directiveAttrs(node)).filter(([key]) => !excluded.has(key)),
  )
}

function imagePayload(node: MdNode): Record<string, unknown> {
  const attrs = primitiveAttributes(
    node,
    new Set([
      "focalX",
      "focalY",
      "creatorName",
      "creatorUrl",
      "sourceUrl",
      "intrinsicWidth",
      "intrinsicHeight",
    ]),
  )
  const focalX = parseAttributeValue(node.attributes?.focalX)
  const focalY = parseAttributeValue(node.attributes?.focalY)
  const creatorName = node.attributes?.creatorName
  const creatorUrl = node.attributes?.creatorUrl
  const sourceUrl = node.attributes?.sourceUrl
  const width = parseAttributeValue(node.attributes?.width ?? node.attributes?.intrinsicWidth)
  const height = parseAttributeValue(node.attributes?.height ?? node.attributes?.intrinsicHeight)
  const { id, ...metadata } = attrs
  return {
    ...metadata,
    ...(id ? { learnerAnchorId: id } : {}),
    alt: directiveText(node),
    ...(typeof width === "number" ? { width } : {}),
    ...(typeof height === "number" ? { height } : {}),
    ...(typeof focalX === "number" && typeof focalY === "number"
      ? { focalPoint: { x: focalX, y: focalY } }
      : {}),
    ...(creatorName && creatorUrl && sourceUrl
      ? { attribution: { creatorName, creatorUrl, sourceUrl } }
      : {}),
  }
}

function simplePayload(node: MdNode, textKey?: string): Record<string, unknown> {
  const { id, ...attrs } = primitiveAttributes(node)
  return {
    ...attrs,
    ...(id ? { learnerAnchorId: id } : {}),
    ...(textKey ? { [textKey]: directiveText(node) } : {}),
  }
}

function inlineField(
  node: MdNode,
  name: string,
  path: string,
  diagnostics: DocumentDiagnostic[],
): ContentNode[] {
  const field = directDirectiveChild(node, name)
  if (!field) return []
  return (field.children ?? []).flatMap((child, index) =>
    child.type === "paragraph"
      ? inlineNodes(child.children ?? [], `${path}.${name}[${index}]`, diagnostics)
      : inlineNodes([child], `${path}.${name}[${index}]`, diagnostics),
  )
}

function framedPayload(
  node: MdNode,
  path: string,
  diagnostics: DocumentDiagnostic[],
): Record<string, unknown> {
  const payload = simplePayload(node)
  return {
    ...payload,
    title: fieldText(node, "title"),
    description: inlineField(node, "description", path, diagnostics),
  }
}

function blockImagePayload(
  node: MdNode,
  path: string,
  diagnostics: DocumentDiagnostic[],
): Record<string, unknown> {
  const description = inlineField(node, "description", path, diagnostics)
  return {
    ...imagePayload({ ...node, children: [] }),
    alt: description.map(textOfContent).join(""),
    title: fieldText(node, "title"),
    description,
  }
}

function fieldText(node: MdNode, name: string): string {
  return directiveText(directDirectiveChild(node, name))
}

function structuredPayload(
  kind: string,
  node: MdNode,
  path: string,
  diagnostics: DocumentDiagnostic[],
): Record<string, unknown> {
  const attrs = primitiveAttributes(node)
  if (kind === "poll") {
    const { id, ...pollAttrs } = attrs
    return {
      ...pollAttrs,
      ...(id ? { pollId: id } : {}),
      title: fieldText(node, "title"),
      description: inlineField(node, "description", path, diagnostics),
      question: fieldText(node, "question"),
      options: directDirectiveChildren(node, "option").map((option) => ({
        id: String(directiveAttrs(option).id ?? ""),
        text: directiveText(option),
      })),
    }
  }
  if (kind === "quiz") {
    const { id, ...quizAttrs } = attrs
    return {
      ...quizAttrs,
      ...(id ? { learnerAnchorId: id } : {}),
      kind,
      title: fieldText(node, "title"),
      description: inlineField(node, "description", path, diagnostics),
      questions: directDirectiveChildren(node, "question").map((question) => {
        const options = directDirectiveChildren(question, "option").map((option) => ({
          id: String(directiveAttrs(option).id ?? ""),
          text: directiveText(option),
        }))
        const correct = directDirectiveChildren(question, "option").find((option) =>
          Object.hasOwn(directiveAttrs(option), "correct"),
        )
        return {
          id: String(directiveAttrs(question).id ?? ""),
          prompt: fieldText(question, "prompt"),
          options,
          correctOptionId: correct ? String(directiveAttrs(correct).id ?? "") : "",
        }
      }),
    }
  }
  return attrs
}

function readablePayload(
  kind: string,
  node: MdNode,
  path: string,
  diagnostics: DocumentDiagnostic[],
): Record<string, unknown> {
  if (byteLength(textOfMdast(node)) > CURSARE_DOCUMENT_LIMITS.maxAtomicPayloadBytes) {
    diagnostics.push(
      diagnostic(
        "invalid_directive",
        `Atomic payload exceeds ${CURSARE_DOCUMENT_LIMITS.maxAtomicPayloadBytes} bytes.`,
        path,
        node,
      ),
    )
    return {}
  }
  if (kind === "cover") return imagePayload(node)
  if (kind === "image") return blockImagePayload(node, path, diagnostics)
  if (["video", "audio", "file", "embed"].includes(kind)) {
    return framedPayload(node, path, diagnostics)
  }
  if (kind === "diagram") {
    const source = directDirectiveChild(node, "source")
    const { id, ...attrs } = primitiveAttributes(node)
    return {
      ...attrs,
      ...(id ? { learnerAnchorId: id } : {}),
      title: fieldText(node, "title"),
      description: inlineField(node, "description", path, diagnostics),
      // Loose body only: a :::title present but no :::source must NOT fall back to
      // the title text (which would canonicalize the title into the source).
      source: source ? directiveText(source) : looseText(node),
    }
  }
  if (kind === "math") {
    return {
      ...framedPayload(node, path, diagnostics),
      latex: fieldText(node, "latex") || looseText(node),
    }
  }
  if (kind === "reference") {
    const payload = framedPayload(node, path, diagnostics)
    const { learnerAnchorId, title, description, ...reference } = payload
    const requires = reference.requires
    return {
      ...reference,
      title: readableReferenceTitle(title),
      description,
      ...(learnerAnchorId ? { blockId: learnerAnchorId } : {}),
      ...(typeof requires === "string"
        ? { requires: requires ? requires.split(",").filter(Boolean) : [] }
        : {}),
    }
  }
  return structuredPayload(kind, node, path, diagnostics)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function readableReferenceTitle(value: unknown): string {
  if (typeof value !== "string") return ""
  const candidate = value.trim()
  if (!candidate.startsWith("{") || !candidate.endsWith("}")) return value
  if (
    !["blockId", "routeSegment", "targetContentId"].every((key) => candidate.includes(`"${key}"`))
  ) {
    return value
  }
  try {
    const payload = JSON.parse(candidate)
    if (isRecord(payload)) return typeof payload.title === "string" ? payload.title : ""
  } catch {
    const title = /"title"\s*:\s*("(?:\\.|[^"\\])*")/.exec(candidate)?.[1]
    if (title) {
      try {
        return String(JSON.parse(title))
      } catch {
        return ""
      }
    }
  }
  return ""
}

function requirePayloadFields(
  payload: Record<string, unknown>,
  fields: string[],
  path: string,
  node: MdNode,
  diagnostics: DocumentDiagnostic[],
): void {
  for (const field of fields) {
    if (payload[field] === undefined || payload[field] === null || payload[field] === "") {
      diagnostics.push(
        diagnostic(
          "invalid_directive_payload",
          `Directive payload requires ${field}.`,
          `${path}.${field}`,
          node,
        ),
      )
    }
  }
}

function validateCollection(
  value: unknown,
  path: string,
  node: MdNode,
  diagnostics: DocumentDiagnostic[],
): void {
  if (Array.isArray(value)) {
    if (value.length > CURSARE_DOCUMENT_LIMITS.maxCollectionItems) {
      diagnostics.push(
        diagnostic(
          "collection_too_large",
          `Collection exceeds ${CURSARE_DOCUMENT_LIMITS.maxCollectionItems} items.`,
          path,
          node,
        ),
      )
    }
    for (const [index, item] of value.entries()) {
      validateCollection(item, `${path}[${index}]`, node, diagnostics)
    }
  } else if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) {
      validateCollection(item, `${path}.${key}`, node, diagnostics)
    }
  }
}

function hasStringFields(
  value: unknown,
  fields: string[],
  allowEmpty: ReadonlySet<string>,
): value is Record<string, unknown> {
  if (!isRecord(value)) return false
  return fields.every(
    (field) => typeof value[field] === "string" && (allowEmpty.has(field) || value[field] !== ""),
  )
}

function validateItems(
  values: unknown,
  fields: string[],
  path: string,
  label: string,
  node: MdNode,
  diagnostics: DocumentDiagnostic[],
  allowEmpty: ReadonlySet<string> = new Set(),
): void {
  if (!Array.isArray(values)) return
  values.forEach((value, index) => {
    if (hasStringFields(value, fields, allowEmpty)) return
    diagnostics.push(
      diagnostic(
        "invalid_directive_payload",
        `${label} ${index + 1} requires ${fields.join(", ")}.`,
        `${path}[${index}]`,
        node,
      ),
    )
  })
}

function validatePayload(
  kind: string,
  payload: Record<string, unknown>,
  path: string,
  node: MdNode,
  diagnostics: DocumentDiagnostic[],
): void {
  validateCollection(payload, path, node, diagnostics)
  const requirements: Record<string, string[]> = {
    image: ["src"],
    video: ["src", "provider"],
    audio: ["src"],
    file: ["url", "name"],
    embed: ["src"],
    diagram: ["source"],
    math: ["latex"],
    poll: ["pollId", "question", "options"],
    reference: ["blockId", "targetContentId", "routeSegment", "title"],
    activity: ["kind"],
  }
  requirePayloadFields(payload, requirements[kind] ?? [], path, node, diagnostics)
  if (
    kind === "video" &&
    typeof payload.src === "string" &&
    payload.src !== "" &&
    typeof payload.provider === "string"
  ) {
    const resolved = resolveVideoUrl(payload.src)
    if (resolved.status !== "supported" || resolved.provider !== payload.provider) {
      diagnostics.push(
        diagnostic(
          "unsafe_url",
          "The video source must be supported and match its provider.",
          path,
          node,
        ),
      )
    }
  }
  if (
    kind === "audio" &&
    typeof payload.src === "string" &&
    payload.src !== "" &&
    resolveAudioUrl(payload.src).status !== "supported"
  ) {
    diagnostics.push(
      diagnostic("unsafe_url", "The audio source must be a supported direct file URL.", path, node),
    )
  }
  if (
    kind === "embed" &&
    typeof payload.src === "string" &&
    payload.src !== "" &&
    !parseEmbedUrl(payload.src)
  ) {
    diagnostics.push(
      diagnostic("unsafe_url", "The embed source must use a supported provider.", path, node),
    )
  }
  if (kind === "poll" && (!Array.isArray(payload.options) || payload.options.length < 2)) {
    diagnostics.push(
      diagnostic(
        "invalid_directive_payload",
        "Polls require at least two options.",
        `${path}.options`,
        node,
      ),
    )
  } else if (kind === "poll") {
    validateItems(
      payload.options,
      ["id", "text"],
      `${path}.options`,
      "Poll option",
      node,
      diagnostics,
    )
  }
  if (kind === "reference" && typeof payload.routeSegment === "string") {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(payload.routeSegment)) {
      diagnostics.push(
        diagnostic(
          "invalid_directive_payload",
          "Reference routeSegment must be a lowercase URL segment.",
          `${path}.routeSegment`,
          node,
        ),
      )
    }
    if (
      payload.afterHours !== undefined &&
      payload.afterHours !== null &&
      (!Number.isInteger(payload.afterHours) || Number(payload.afterHours) <= 0)
    ) {
      diagnostics.push(
        diagnostic(
          "invalid_directive_payload",
          "Reference afterHours must be a positive whole number or null.",
          `${path}.afterHours`,
          node,
        ),
      )
    }
    if (
      payload.dripAnchor !== undefined &&
      payload.dripAnchor !== "enroll" &&
      payload.dripAnchor !== "prev"
    ) {
      diagnostics.push(
        diagnostic(
          "invalid_directive_payload",
          "Reference dripAnchor must be enroll or prev.",
          `${path}.dripAnchor`,
          node,
        ),
      )
    }
  }
  if (kind === "activity") {
    if (payload.kind === "quiz") {
      validateItems(
        payload.questions,
        ["id", "prompt", "correctOptionId"],
        `${path}.questions`,
        "Question",
        node,
        diagnostics,
      )
      if (!Array.isArray(payload.questions) || payload.questions.length === 0) {
        diagnostics.push(
          diagnostic(
            "invalid_directive_payload",
            "Quiz requires at least one question.",
            `${path}.questions`,
            node,
          ),
        )
      }
      for (const [index, question] of (Array.isArray(payload.questions)
        ? payload.questions
        : []
      ).entries()) {
        if (!isRecord(question)) continue
        validateItems(
          question.options,
          ["id", "text"],
          `${path}.questions[${index}].options`,
          "Answer option",
          node,
          diagnostics,
        )
        if (!Array.isArray(question.options) || question.options.length < 2) {
          diagnostics.push(
            diagnostic(
              "invalid_directive_payload",
              "Each quiz question requires at least two answer options.",
              `${path}.questions[${index}].options`,
              node,
            ),
          )
        } else if (
          !question.options.some(
            (option) =>
              isRecord(option) &&
              typeof option.id === "string" &&
              option.id === question.correctOptionId,
          )
        ) {
          diagnostics.push(
            diagnostic(
              "invalid_directive_payload",
              "correctOptionId must identify one answer option in the same question.",
              `${path}.questions[${index}].correctOptionId`,
              node,
            ),
          )
        }
      }
    }
  }
  const urlKeys = new Set(["src", "url", "creatorUrl", "sourceUrl"])
  const walk = (value: unknown, valuePath: string, key = "") => {
    if (typeof value === "string" && value !== "" && urlKeys.has(key) && !safeUrl(value)) {
      diagnostics.push(diagnostic("unsafe_url", `The ${key} URL is not allowed.`, valuePath, node))
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        walk(item, `${valuePath}[${index}]`)
      })
    } else if (isRecord(value)) {
      Object.entries(value).forEach(([childKey, item]) => {
        walk(item, `${valuePath}.${childKey}`, childKey)
      })
    }
  }
  walk(payload, path)
}

function validateContainer(
  name: string,
  attrs: Record<string, unknown>,
  path: string,
  node: MdNode,
  diagnostics: DocumentDiagnostic[],
): void {
  const allowedByName: Record<string, readonly string[]> = {
    callout: ["id", "title", "variant"],
    table: ["columnWidths", "description", "learnerAnchorId", "title"],
    steps: ["description", "id", "title"],
    step: ["id", "title"],
  }
  const requiredByName: Record<string, readonly string[]> = {
    step: ["id", "title"],
  }
  const allowed = new Set(allowedByName[name] ?? [])
  for (const key of Object.keys(attrs)) {
    if (allowed.has(key)) continue
    diagnostics.push(
      diagnostic(
        "invalid_directive_payload",
        `${name} does not support the ${key} attribute.`,
        `${path}.${key}`,
        node,
      ),
    )
  }
  for (const key of requiredByName[name] ?? []) {
    if (typeof attrs[key] === "string" && attrs[key] !== "") continue
    diagnostics.push(
      diagnostic(
        "invalid_directive_payload",
        `${name} requires a non-empty ${key} attribute.`,
        `${path}.${key}`,
        node,
      ),
    )
  }
  for (const key of ["id", "learnerAnchorId"] as const) {
    const value = attrs[key]
    if (value === undefined) continue
    if (typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9:_-]*$/.test(value)) continue
    diagnostics.push(
      diagnostic(
        "invalid_directive_payload",
        `${name} ${key} must be a stable ASCII identifier.`,
        `${path}.${key}`,
        node,
      ),
    )
  }
  if (
    name === "callout" &&
    attrs.variant !== undefined &&
    !["info", "success", "warning", "danger"].includes(String(attrs.variant))
  ) {
    diagnostics.push(
      diagnostic(
        "invalid_directive_payload",
        "Callout variant must be info, success, warning, or danger.",
        `${path}.variant`,
        node,
      ),
    )
  }
  if (
    name === "table" &&
    attrs.columnWidths !== undefined &&
    (typeof attrs.columnWidths !== "string" ||
      tableColumnWidths(attrs.columnWidths).length !==
        attrs.columnWidths.trim().split(/\s+/).length)
  ) {
    diagnostics.push(
      diagnostic(
        "invalid_directive_payload",
        "Table columnWidths must be space-separated positive numbers.",
        `${path}.columnWidths`,
        node,
      ),
    )
  }
}

function withMarks(nodes: ContentNode[], mark: ContentMark): ContentNode[] {
  return nodes.map((node) =>
    node.type === "text"
      ? { ...node, marks: [...(node.marks ?? []), mark] }
      : { ...node, content: node.content ? withMarks(node.content, mark) : node.content },
  )
}

function inlineNodes(
  nodes: MdNode[],
  path: string,
  diagnostics: DocumentDiagnostic[],
): ContentNode[] {
  return nodes.flatMap((node, index) => {
    const childPath = `${path}[${index}]`
    if (node.type === "text") return [{ type: "text", text: node.value ?? "" }]
    if (node.type === "break") return [{ type: "hardBreak" }]
    if (node.type === "inlineCode") {
      return [{ type: "text", text: node.value ?? "", marks: [{ type: "code" }] }]
    }
    if (node.type === "strong") {
      return withMarks(inlineNodes(node.children ?? [], childPath, diagnostics), { type: "bold" })
    }
    if (node.type === "emphasis") {
      return withMarks(inlineNodes(node.children ?? [], childPath, diagnostics), { type: "italic" })
    }
    if (node.type === "delete") {
      return withMarks(inlineNodes(node.children ?? [], childPath, diagnostics), { type: "strike" })
    }
    if (node.type === "link") {
      if (!safeUrl(node.url ?? "", true)) {
        diagnostics.push(diagnostic("unsafe_url", "The link URL is not allowed.", childPath, node))
      }
      return withMarks(inlineNodes(node.children ?? [], childPath, diagnostics), {
        type: "link",
        attrs: { href: node.url ?? "" },
      })
    }
    if (node.type === "image") {
      if (!safeUrl(node.url ?? "")) {
        diagnostics.push(diagnostic("unsafe_url", "The image URL is not allowed.", childPath, node))
      }
      return [{ type: "image", attrs: { src: node.url ?? "", alt: node.alt ?? "" } }]
    }
    if (node.type === "textDirective") {
      const name = node.name ?? ""
      const attrs = directiveAttrs(node)
      const children = inlineNodes(node.children ?? [], childPath, diagnostics)
      const markType =
        name === "underline"
          ? "underline"
          : name === "highlight"
            ? "highlight"
            : name === "color"
              ? "textStyle"
              : null
      if (markType) return withMarks(children, { type: markType, attrs })
      if (name === "math-inline") {
        return [{ type: "mathInline", attrs: { latex: String(attrs.latex ?? textOfMdast(node)) } }]
      }
      if (name === "glossary") {
        return [
          {
            type: "glossaryTerm",
            attrs: { term: textOfMdast(node), definition: String(attrs.definition ?? "") },
          },
        ]
      }
    }
    diagnostics.push(
      diagnostic(
        "unknown_directive",
        `Unsupported inline Markdown node: ${node.type}.`,
        childPath,
        node,
      ),
    )
    return []
  })
}

function headingMeta(nodes: ContentNode[]): {
  content: ContentNode[]
  attrs: Record<string, unknown>
} {
  const content = [...nodes]
  const last = content.at(-1)
  if (last?.type !== "text" || !last.text) return { content, attrs: {} }
  const match = last.text.match(
    /\s*\{#([A-Za-z0-9][A-Za-z0-9:_-]*)(?:\s+requires="([^"]*)")?\}\s*$/,
  )
  if (!match) return { content, attrs: {} }
  const text = last.text.slice(0, match.index).trimEnd()
  if (text) content[content.length - 1] = { ...last, text }
  else content.pop()
  return {
    content,
    attrs: {
      blockId: match[1],
      requires: match[2] === undefined ? null : match[2] ? match[2].split(",") : [],
    },
  }
}

function paragraphMeta(nodes: ContentNode[]): {
  content: ContentNode[]
  attrs: Record<string, unknown>
} {
  const content = [...nodes]
  const last = content.at(-1)
  if (last?.type !== "text" || !last.text) return { content, attrs: {} }
  const match = last.text.match(/\s*\{#([A-Za-z0-9][A-Za-z0-9:_-]*)\}\s*$/)
  if (!match) return { content, attrs: {} }
  const text = last.text.slice(0, match.index).trimEnd()
  if (text) content[content.length - 1] = { ...last, text }
  else content.pop()
  return { content, attrs: { learnerAnchorId: match[1] } }
}

function tableColumnWidths(value: unknown): number[] {
  if (typeof value !== "string") return []
  return value
    .trim()
    .split(/\s+/)
    .map(Number)
    .filter((width) => Number.isFinite(width) && width > 0)
}

function applyTableColumnWidths(content: ContentNode[], value: unknown): ContentNode[] {
  const widths = tableColumnWidths(value)
  if (widths.length === 0) return content
  return content.map((child) => {
    if (child.type !== "table") return child
    return {
      ...child,
      content: (child.content ?? []).map((row) => ({
        ...row,
        content: (row.content ?? []).map((cell, index) => ({
          ...cell,
          ...(widths[index]
            ? { attrs: { ...(cell.attrs ?? {}), columnWidth: widths[index] } }
            : {}),
        })),
      })),
    }
  })
}

function blockNode(
  node: MdNode,
  path: string,
  diagnostics: DocumentDiagnostic[],
  depth: number,
): ContentNode | null {
  if (depth > CURSARE_DOCUMENT_LIMITS.maxDepth) {
    diagnostics.push(
      diagnostic(
        "document_too_deep",
        `Document nesting exceeds ${CURSARE_DOCUMENT_LIMITS.maxDepth}.`,
        path,
        node,
      ),
    )
    return null
  }
  const children = () =>
    (node.children ?? [])
      .map((child, index) => blockNode(child, `${path}.children[${index}]`, diagnostics, depth + 1))
      .filter((child): child is ContentNode => Boolean(child))
  const childrenWithout = (names: ReadonlySet<string>) =>
    (node.children ?? [])
      .filter(
        (child) =>
          !(
            (child.type === "containerDirective" || child.type === "leafDirective") &&
            child.name &&
            names.has(child.name)
          ),
      )
      .map((child, index) => blockNode(child, `${path}.children[${index}]`, diagnostics, depth + 1))
      .filter((child): child is ContentNode => Boolean(child))
  if (node.type === "paragraph") {
    const result = paragraphMeta(inlineNodes(node.children ?? [], path, diagnostics))
    return { type: "paragraph", attrs: result.attrs, content: result.content }
  }
  if (node.type === "heading") {
    const result = headingMeta(inlineNodes(node.children ?? [], path, diagnostics))
    return {
      type: "heading",
      attrs: { level: node.depth ?? 2, ...result.attrs },
      content: result.content,
    }
  }
  if (node.type === "blockquote") return { type: "blockquote", content: children() }
  if (node.type === "thematicBreak") return { type: "horizontalRule" }
  if (node.type === "code") {
    return {
      type: "codeBlock",
      attrs: { language: node.lang ?? null },
      content: [{ type: "text", text: node.value ?? "" }],
    }
  }
  if (node.type === "list") {
    if (
      (node.children ?? []).some((child) => child.checked !== null && child.checked !== undefined)
    ) {
      diagnostics.push(
        diagnostic(
          "task_list_not_supported",
          "Checkbox lists are not supported. Convert them to an ordinary list explicitly.",
          path,
          node,
        ),
      )
    }
    if (node.ordered) {
      // Preserve a non-default first number (e.g. "3." starts at 3); the serializer
      // re-emits it. Without this the list silently renumbers from 1 on save.
      const start = typeof node.start === "number" ? node.start : 1
      return {
        type: "orderedList",
        ...(start !== 1 ? { attrs: { start } } : {}),
        content: children(),
      }
    }
    return { type: "bulletList", content: children() }
  }
  if (node.type === "listItem") return { type: "listItem", content: children() }
  if (node.type === "table") {
    const rows = children()
    const alignments = node.align ?? []
    for (const row of rows) {
      if (row.type !== "tableRow") continue
      row.content = (row.content ?? []).map((cell, index) => ({
        ...cell,
        ...(alignments[index]
          ? { attrs: { ...(cell.attrs ?? {}), alignment: alignments[index] } }
          : {}),
      }))
    }
    const firstRow = rows[0]
    if (firstRow?.type === "tableRow") {
      rows[0] = {
        ...firstRow,
        content: (firstRow.content ?? []).map((cell) =>
          cell.type === "tableCell" ? { ...cell, type: "tableHeader" } : cell,
        ),
      }
    }
    return { type: "table", attrs: { align: alignments }, content: rows }
  }
  if (node.type === "tableRow") return { type: "tableRow", content: children() }
  if (node.type === "tableCell") {
    return {
      type: "tableCell",
      content: [
        { type: "paragraph", content: inlineNodes(node.children ?? [], path, diagnostics) },
      ],
    }
  }
  if (node.type === "image") {
    if (!safeUrl(node.url ?? "")) {
      diagnostics.push(diagnostic("unsafe_url", "The image URL is not allowed.", path, node))
    }
    return { type: "image", attrs: { src: node.url ?? "", alt: node.alt ?? "" } }
  }
  if (node.type === "containerDirective" || node.type === "leafDirective") {
    const name = node.name ?? ""
    if (name === "cursare-anchor") {
      const attrs = directiveAttrs(node)
      const id = attrs.id
      const wrapped = children()
      if (
        typeof id !== "string" ||
        !/^[A-Za-z0-9][A-Za-z0-9:_-]*$/.test(id) ||
        wrapped.length !== 1
      ) {
        diagnostics.push(
          diagnostic(
            "invalid_directive_payload",
            "A learner anchor requires one stable id and exactly one block.",
            path,
            node,
          ),
        )
        return wrapped[0] ?? null
      }
      const child = wrapped[0]
      if (!child) return null
      return { ...child, attrs: { ...(child.attrs ?? {}), learnerAnchorId: id } }
    }
    if (name.startsWith("cursare-")) {
      const kind = name.slice("cursare-".length)
      if (activityTypes[kind]) {
        const payload = readablePayload(kind, node, path, diagnostics)
        validatePayload("activity", payload, path, node, diagnostics)
        const { kind: _kind, ...attrs } = payload
        return { type: activityTypes[kind], attrs }
      }
      const payload = readablePayload(kind, node, path, diagnostics)
      validatePayload(kind, payload, path, node, diagnostics)
      const type = atomicTypes[kind]
      if (!type) {
        diagnostics.push(
          diagnostic("unknown_directive", `Unknown Cursare directive: ${name}.`, path, node),
        )
        return null
      }
      return { type, attrs: payload }
    }
    const type = containerTypes[name]
    if (type) {
      const attrs = directiveAttrs(node)
      const title = fieldText(node, "title")
      const description = inlineField(node, "description", path, diagnostics)
      if (title || directDirectiveChild(node, "title")) attrs.title = title
      if (description.length > 0 || directDirectiveChild(node, "description")) {
        attrs.description = description
      }
      validateContainer(name, attrs, path, node, diagnostics)
      const content = childrenWithout(new Set(["title", "description"]))
      return {
        type,
        attrs,
        content:
          type === "tableBlock" ? applyTableColumnWidths(content, attrs.columnWidths) : content,
      }
    }
    diagnostics.push(
      diagnostic("unknown_directive", `Unknown Cursare directive: ${name}.`, path, node),
    )
    return null
  }
  if (node.type === "html") {
    diagnostics.push(
      diagnostic("unknown_directive", "Raw HTML is not supported in Cursare Markdown.", path, node),
    )
    return null
  }
  diagnostics.push(
    diagnostic("unknown_directive", `Unsupported Markdown node: ${node.type}.`, path, node),
  )
  return null
}

function countNodes(node: ContentNode): number {
  return 1 + (node.content ?? []).reduce((sum, child) => sum + countNodes(child), 0)
}

function stableIds(
  node: ContentNode,
  ids: Map<string, string>,
  diagnostics: DocumentDiagnostic[],
  path: string,
) {
  const attrs = node.attrs ?? {}
  const values: unknown[] = []
  const collectPayloadIds = (value: unknown, key = "") => {
    if (typeof value === "string" && ["id", "blockId", "learnerAnchorId", "pollId"].includes(key)) {
      values.push(value)
    } else if (Array.isArray(value)) {
      value.forEach((item) => {
        collectPayloadIds(item)
      })
    } else if (isRecord(value)) {
      Object.entries(value).forEach(([childKey, item]) => {
        collectPayloadIds(item, childKey)
      })
    }
  }
  collectPayloadIds(attrs)
  for (const value of values) {
    if (typeof value !== "string" || !value) continue
    const previous = ids.get(value)
    if (previous) {
      diagnostics.push(
        diagnostic(
          "duplicate_stable_id",
          `Stable id ${value} is already used at ${previous}.`,
          path,
        ),
      )
    } else ids.set(value, path)
  }
  for (const [index, child] of (node.content ?? []).entries()) {
    stableIds(child, ids, diagnostics, `${path}.content[${index}]`)
  }
}

function validateNesting(
  node: ContentNode,
  parent: ContentNode | null,
  path: string,
  diagnostics: DocumentDiagnostic[],
  insideStep = false,
): void {
  if (node.type === "heading" && typeof node.attrs?.blockId !== "string") {
    diagnostics.push(
      diagnostic(
        "missing_stable_id",
        "Headings require a stable {#id} attribute.",
        `${path}.blockId`,
      ),
    )
  }
  const requiredParent: Record<string, string> = { step: "steps" }
  const expected = requiredParent[node.type]
  if (expected && parent?.type !== expected) {
    diagnostics.push(
      diagnostic("invalid_nesting", `${node.type} may appear only inside ${expected}.`, path),
    )
  }
  if (node.type === "steps" && (node.content ?? []).some((child) => child.type !== "step")) {
    diagnostics.push(diagnostic("invalid_nesting", "Steps may contain only step items.", path))
  }
  if (
    node.type === "tableBlock" &&
    ((node.content ?? []).length !== 1 || node.content?.[0]?.type !== "table")
  ) {
    diagnostics.push(
      diagnostic("invalid_nesting", "A table block must contain exactly one table.", path),
    )
  }
  if (node.type === "steps" && insideStep) {
    diagnostics.push(diagnostic("invalid_nesting", "Steps cannot be nested inside a step.", path))
  }
  // Interactive blocks are addressed by top-level identity (learner-anchors is
  // top-level only), so a nested poll/quiz would render but be dead — votes
  // rejected, quizzes ungradable, section gating blind to it. Keep them top-level
  // so the whole delivery pipeline agrees.
  if ((node.type === "poll" || node.type === "questionPool") && parent && parent.type !== "doc") {
    diagnostics.push(
      diagnostic(
        "invalid_nesting",
        `${node.type === "poll" ? "Polls" : "Quizzes"} must be a top-level block, not nested inside ${parent.type}.`,
        path,
      ),
    )
  }
  const childInsideStep = insideStep || node.type === "step"
  for (const [index, child] of (node.content ?? []).entries()) {
    validateNesting(child, node, `${path}.content[${index}]`, diagnostics, childInsideStep)
  }
}

export function inspectCursareDocument(value: unknown): DocumentDiagnostic[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [
      diagnostic("invalid_document", "Expected canonical Cursare Markdown version 1.", "document"),
    ]
  }
  const record = value as Record<string, unknown>
  if (record.version !== CURSARE_DOCUMENT_VERSION) {
    return [
      diagnostic(
        "unsupported_version",
        `Document version must be ${CURSARE_DOCUMENT_VERSION}.`,
        "document.version",
      ),
    ]
  }
  if (!isCursareDocument(value)) {
    return [
      diagnostic(
        "invalid_document",
        "Expected { version: 1, markdown } with one canonical Cursare Markdown source.",
        "document",
      ),
    ]
  }
  if (byteLength(value.markdown) > CURSARE_DOCUMENT_LIMITS.maxBytes) {
    return [
      diagnostic(
        "document_too_large",
        `Document exceeds ${CURSARE_DOCUMENT_LIMITS.maxBytes} bytes.`,
        "document",
      ),
    ]
  }
  return []
}

export interface ParsedCursareDocument {
  document: ParsedContentDocument
  header: ContentHeader
  diagnostics: DocumentDiagnostic[]
}

function layoutRole(node: MdNode): (typeof DEFAULT_CONTENT_HEADER_LAYOUT)[number] | null {
  if (node.type === "heading" && node.depth === 1) return "title"
  if (node.type !== "containerDirective" && node.type !== "leafDirective") return null
  if (node.name === "cursare-cover") return "cover"
  if (node.name === "cursare-description") return "description"
  return null
}

function parseDocumentLayout(
  root: MdNode,
  diagnostics: DocumentDiagnostic[],
): { header: ContentHeader; body: MdNode[] } {
  const header = emptyContentHeader()
  const layout: (typeof DEFAULT_CONTENT_HEADER_LAYOUT)[number][] = []
  const body: MdNode[] = []
  const seen = new Set<(typeof DEFAULT_CONTENT_HEADER_LAYOUT)[number]>()

  for (const [index, node] of (root.children ?? []).entries()) {
    const role = layoutRole(node)
    const path = `document.markdown[${index}]`
    if (!role) {
      body.push(node)
      if (index < DEFAULT_CONTENT_HEADER_LAYOUT.length) {
        diagnostics.push(
          diagnostic(
            "invalid_header",
            "Cover, title and description must be the first three Markdown blocks.",
            path,
            node,
          ),
        )
      }
      continue
    }
    if (index >= DEFAULT_CONTENT_HEADER_LAYOUT.length || seen.has(role)) {
      diagnostics.push(
        diagnostic(
          "invalid_header",
          `${role} must appear exactly once inside the first three Markdown blocks.`,
          path,
          node,
        ),
      )
      continue
    }
    seen.add(role)
    layout.push(role)
    if (role === "title") {
      header.title = textOfMdast(node).trim()
      if (header.title.length > 240) {
        diagnostics.push(diagnostic("invalid_header", "Title exceeds 240 characters.", path, node))
      }
    } else if (role === "description") {
      header.description = textOfMdast(node).trim()
      if (header.description.length > 2_000) {
        diagnostics.push(
          diagnostic("invalid_header", "Description exceeds 2000 characters.", path, node),
        )
      }
    } else {
      const payload = readablePayload("cover", node, path, diagnostics)
      if (!payload.src) {
        header.image = null
      } else {
        validatePayload("image", payload, path, node, diagnostics)
        if (isContentImage(payload)) header.image = payload
        else {
          diagnostics.push(
            diagnostic("invalid_header", "Cover payload is not a valid content image.", path, node),
          )
        }
      }
    }
  }

  for (const role of DEFAULT_CONTENT_HEADER_LAYOUT) {
    if (!seen.has(role)) {
      diagnostics.push(
        diagnostic(
          "invalid_header",
          `The Markdown document requires one ${role} block.`,
          "document.markdown",
        ),
      )
    }
  }
  if (layout.length === DEFAULT_CONTENT_HEADER_LAYOUT.length) {
    header.layout = layout as unknown as ContentHeaderLayout
  }
  return { header, body }
}

export function parseCursareDocument(value: unknown): ParsedCursareDocument {
  const diagnostics = inspectCursareDocument(value)
  const empty = {
    document: { type: "doc", content: [] } as ParsedContentDocument,
    header: emptyContentHeader(),
  }
  if (!isCursareDocument(value)) return { ...empty, diagnostics }
  if (diagnostics.some((issue) => issue.code === "document_too_large")) {
    return { ...empty, diagnostics }
  }
  let root: MdNode
  try {
    root = parser.parse(value.markdown) as unknown as MdNode
  } catch (error) {
    diagnostics.push(
      diagnostic(
        "invalid_document",
        error instanceof Error ? error.message : "Markdown could not be parsed.",
        "document.markdown",
      ),
    )
    return { ...empty, diagnostics }
  }
  const layout = parseDocumentLayout(root, diagnostics)
  const content = layout.body
    .map((node, index) => blockNode(node, `document.markdown.body[${index}]`, diagnostics, 0))
    .filter((node): node is ContentNode => Boolean(node))
  const document: ParsedContentDocument = { type: "doc", content }
  const total = countNodes(document)
  if (total > CURSARE_DOCUMENT_LIMITS.maxNodes) {
    diagnostics.push(
      diagnostic(
        "too_many_nodes",
        `Document contains ${total} nodes; the limit is ${CURSARE_DOCUMENT_LIMITS.maxNodes}.`,
        "document.markdown",
      ),
    )
  }
  const directiveCount = value.markdown.match(/^:{1,3}(?:cursare-)?[a-z][\w-]*/gm)?.length ?? 0
  if (directiveCount > CURSARE_DOCUMENT_LIMITS.maxDirectives) {
    diagnostics.push(
      diagnostic(
        "too_many_directives",
        `Document contains ${directiveCount} directives; the limit is ${CURSARE_DOCUMENT_LIMITS.maxDirectives}.`,
        "document.markdown",
      ),
    )
  }
  stableIds(document, new Map(), diagnostics, "document.markdown.body")
  validateNesting(document, null, "document.markdown.body", diagnostics)
  return { document, header: layout.header, diagnostics }
}

export function requireCursareDocument(value: unknown): CursareDocument {
  const parsed = parseCursareDocument(value)
  if (parsed.diagnostics.length > 0) throw new CursareDocumentError(parsed.diagnostics)
  return canonicalizeCursareDocument(value as CursareDocument)
}

const DRAFT_TOLERATED_DIAGNOSTICS = new Set<DocumentDiagnostic["code"]>([
  "invalid_directive_payload",
])

export function draftDocumentDiagnostics(value: unknown): DocumentDiagnostic[] {
  return parseCursareDocument(value).diagnostics.filter(
    (diagnostic) => !DRAFT_TOLERATED_DIAGNOSTICS.has(diagnostic.code),
  )
}

export function requireCursareDraft(value: unknown): CursareDocument {
  const diagnostics = draftDocumentDiagnostics(value)
  if (diagnostics.length > 0) throw new CursareDocumentError(diagnostics)
  return canonicalizeCursareDraft(value as CursareDocument)
}

function mdText(node: ContentNode): MdNode[] {
  if (node.type === "text") {
    let current: MdNode = { type: "text", value: node.text ?? "" }
    for (const mark of node.marks ?? []) {
      if (mark.type === "bold") current = { type: "strong", children: [current] }
      else if (mark.type === "italic") current = { type: "emphasis", children: [current] }
      else if (mark.type === "strike") current = { type: "delete", children: [current] }
      else if (mark.type === "code") current = { type: "inlineCode", value: textOfMdast(current) }
      else if (mark.type === "link") {
        current = { type: "link", url: String(mark.attrs?.href ?? ""), children: [current] }
      } else {
        const name =
          mark.type === "textStyle" ? "color" : mark.type === "highlight" ? "highlight" : mark.type
        current = {
          type: "textDirective",
          name,
          attributes: Object.fromEntries(
            Object.entries(mark.attrs ?? {}).map(([key, value]) => [key, String(value)]),
          ),
          children: [current],
        }
      }
    }
    return [current]
  }
  if (node.type === "hardBreak") return [{ type: "break" }]
  if (node.type === "mathInline") {
    return [
      {
        type: "textDirective",
        name: "math-inline",
        attributes: { latex: String(node.attrs?.latex ?? "") },
      },
    ]
  }
  if (node.type === "glossaryTerm") {
    return [
      {
        type: "textDirective",
        name: "glossary",
        attributes: { definition: String(node.attrs?.definition ?? "") },
        children: [{ type: "text", value: String(node.attrs?.term ?? "") }],
      },
    ]
  }
  if (node.type === "image") {
    return [
      {
        type: "image",
        url: String(node.attrs?.src ?? ""),
        alt: String(node.attrs?.alt ?? ""),
      },
    ]
  }
  return (node.content ?? []).flatMap(mdText)
}

function attrsToDirective(
  attrs: Record<string, unknown> | undefined,
  excluded: ReadonlySet<string> = new Set(),
): Record<string, string | null> {
  return Object.fromEntries(
    Object.entries(attrs ?? {})
      .filter(
        ([key, value]) =>
          !excluded.has(key) &&
          value !== undefined &&
          value !== null &&
          (typeof value !== "object" || Array.isArray(value)),
      )
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, Array.isArray(value) ? value.join(",") : String(value)]),
  )
}

function textParagraph(value: unknown): MdNode[] {
  if (
    Array.isArray(value) &&
    value.every(
      (node): node is ContentNode =>
        Boolean(node) && typeof node === "object" && typeof node.type === "string",
    )
  ) {
    const children = value.flatMap(mdText)
    return children.length > 0 ? [{ type: "paragraph", children }] : []
  }
  const text = String(value ?? "")
  return text ? [{ type: "paragraph", children: [{ type: "text", value: text }] }] : []
}

function fieldDirective(name: string, value: unknown): MdNode {
  return {
    type: "containerDirective",
    name,
    children: textParagraph(value),
  }
}

function imageDirectiveAttributes(attrs: Record<string, unknown>): Record<string, string | null> {
  const focalPoint = isRecord(attrs.focalPoint) ? attrs.focalPoint : null
  const attribution = isRecord(attrs.attribution) ? attrs.attribution : null
  return {
    ...attrsToDirective(
      attrs,
      new Set([
        "alt",
        "title",
        "description",
        "learnerAnchorId",
        "focalPoint",
        "attribution",
        "intrinsicWidth",
        "intrinsicHeight",
      ]),
    ),
    ...(attrs.learnerAnchorId ? { id: String(attrs.learnerAnchorId) } : {}),
    ...(attrs.width === undefined && attrs.intrinsicWidth !== undefined
      ? { width: String(attrs.intrinsicWidth) }
      : {}),
    ...(attrs.height === undefined && attrs.intrinsicHeight !== undefined
      ? { height: String(attrs.intrinsicHeight) }
      : {}),
    ...(focalPoint
      ? { focalX: String(focalPoint.x ?? ""), focalY: String(focalPoint.y ?? "") }
      : {}),
    ...(attribution
      ? {
          creatorName: String(attribution.creatorName ?? ""),
          creatorUrl: String(attribution.creatorUrl ?? ""),
          sourceUrl: String(attribution.sourceUrl ?? ""),
        }
      : {}),
  }
}

function simpleReadableDirective(
  name: string,
  attrs: Record<string, unknown>,
  textKey?: string,
): MdNode {
  const identityKey = name === "reference" ? "blockId" : "learnerAnchorId"
  const attributes =
    name === "cover" || name === "image"
      ? imageDirectiveAttributes(attrs)
      : {
          ...attrsToDirective(attrs, new Set([...(textKey ? [textKey] : []), identityKey])),
          ...(attrs[identityKey] ? { id: String(attrs[identityKey]) } : {}),
        }
  return {
    type: "containerDirective",
    name: `cursare-${name}`,
    attributes,
    children: textParagraph(textKey ? attrs[textKey] : ""),
  }
}

function structuredReadableDirective(name: string, attrs: Record<string, unknown>): MdNode {
  if (["image", "video", "audio", "file", "embed", "reference"].includes(name)) {
    const identityKey = name === "reference" ? "blockId" : "learnerAnchorId"
    const attributes =
      name === "image"
        ? imageDirectiveAttributes(attrs)
        : {
            ...attrsToDirective(attrs, new Set(["title", "description", identityKey])),
            ...(attrs[identityKey] ? { id: String(attrs[identityKey]) } : {}),
          }
    return {
      type: "containerDirective",
      name: `cursare-${name}`,
      attributes,
      children: [
        fieldDirective("title", attrs.title),
        fieldDirective("description", attrs.description),
      ],
    }
  }
  if (name === "diagram") {
    return {
      type: "containerDirective",
      name: "cursare-diagram",
      attributes: {
        ...attrsToDirective(attrs, new Set(["title", "description", "source", "learnerAnchorId"])),
        ...(attrs.learnerAnchorId ? { id: String(attrs.learnerAnchorId) } : {}),
      },
      children: [
        fieldDirective("title", attrs.title),
        fieldDirective("description", attrs.description),
        fieldDirective("source", attrs.source),
      ],
    }
  }
  if (name === "math") {
    return {
      type: "containerDirective",
      name: "cursare-math",
      attributes: {
        ...attrsToDirective(attrs, new Set(["title", "description", "latex", "learnerAnchorId"])),
        ...(attrs.learnerAnchorId ? { id: String(attrs.learnerAnchorId) } : {}),
      },
      children: [
        fieldDirective("title", attrs.title),
        fieldDirective("description", attrs.description),
        fieldDirective("latex", attrs.latex),
      ],
    }
  }
  if (name === "poll") {
    const options = Array.isArray(attrs.options) ? attrs.options : []
    return {
      type: "containerDirective",
      name: "cursare-poll",
      attributes: {
        ...attrsToDirective(
          attrs,
          new Set(["title", "description", "question", "options", "pollId"]),
        ),
        ...(attrs.pollId ? { id: String(attrs.pollId) } : {}),
      },
      children: [
        fieldDirective("title", attrs.title),
        fieldDirective("description", attrs.description),
        fieldDirective("question", attrs.question),
        ...options.filter(isRecord).map((option) => ({
          type: "containerDirective",
          name: "option",
          attributes: attrsToDirective(option, new Set(["text"])),
          children: textParagraph(option.text),
        })),
      ],
    }
  }
  if (name === "quiz") {
    const questions = Array.isArray(attrs.questions) ? attrs.questions : []
    return {
      type: "containerDirective",
      name: "cursare-quiz",
      attributes: {
        ...attrsToDirective(
          attrs,
          new Set(["kind", "title", "description", "questions", "learnerAnchorId"]),
        ),
        ...(attrs.learnerAnchorId ? { id: String(attrs.learnerAnchorId) } : {}),
      },
      children: [
        fieldDirective("title", attrs.title),
        fieldDirective("description", attrs.description),
        ...questions.filter(isRecord).map((question) => {
          const options = Array.isArray(question.options) ? question.options : []
          return {
            type: "containerDirective",
            name: "question",
            attributes: attrsToDirective(
              question,
              new Set(["prompt", "options", "correctOptionId"]),
            ),
            children: [
              fieldDirective("prompt", question.prompt),
              ...options.filter(isRecord).map((option) => ({
                type: "containerDirective",
                name: "option",
                attributes: {
                  ...attrsToDirective(option, new Set(["text"])),
                  ...(option.id === question.correctOptionId ? { correct: "true" } : {}),
                },
                children: textParagraph(option.text),
              })),
            ],
          }
        }),
      ],
    }
  }
  return simpleReadableDirective(name, attrs)
}

function readableDirective(name: string, attrs: Record<string, unknown> | undefined): MdNode {
  const values = attrs ?? {}
  if (
    [
      "image",
      "video",
      "audio",
      "file",
      "embed",
      "reference",
      "diagram",
      "math",
      "poll",
      "quiz",
    ].includes(name)
  ) {
    return structuredReadableDirective(name, values)
  }
  const textKeys: Record<string, string> = {
    cover: "alt",
    diagram: "source",
  }
  return simpleReadableDirective(name, values, textKeys[name])
}

function anchoredBlock(node: ContentNode, block: MdNode): MdNode {
  const id = node.attrs?.learnerAnchorId
  if (typeof id !== "string" || !id) return block
  return {
    type: "containerDirective",
    name: "cursare-anchor",
    attributes: { id },
    children: [block],
  }
}

function toMdast(node: ContentNode): MdNode | null {
  const children = () =>
    (node.content ?? []).map(toMdast).filter((child): child is MdNode => Boolean(child))
  if (node.type === "paragraph") {
    const inline = (node.content ?? []).flatMap(mdText)
    const id = node.attrs?.learnerAnchorId
    if (typeof id === "string" && id) inline.push({ type: "text", value: ` {#${id}}` })
    return { type: "paragraph", children: inline }
  }
  if (node.type === "heading") {
    const inline = (node.content ?? []).flatMap(mdText)
    const id = typeof node.attrs?.blockId === "string" ? node.attrs.blockId : ""
    const requires = node.attrs?.requires
    const suffix = id
      ? ` {#${id}${Array.isArray(requires) ? ` requires="${requires.join(",")}"` : ""}}`
      : ""
    if (suffix) inline.push({ type: "text", value: suffix })
    return { type: "heading", depth: Number(node.attrs?.level ?? 2), children: inline }
  }
  if (node.type === "blockquote") {
    return anchoredBlock(node, { type: "blockquote", children: children() })
  }
  if (node.type === "horizontalRule") return anchoredBlock(node, { type: "thematicBreak" })
  if (node.type === "codeBlock") {
    return anchoredBlock(node, {
      type: "code",
      lang: String(node.attrs?.language ?? "") || null,
      value: textOfContent(node),
    })
  }
  if (node.type === "bulletList" || node.type === "orderedList") {
    const start =
      node.type === "orderedList" && typeof node.attrs?.start === "number"
        ? node.attrs.start
        : undefined
    return anchoredBlock(node, {
      type: "list",
      ordered: node.type === "orderedList",
      ...(start !== undefined && start !== 1 ? { start } : {}),
      children: children(),
    })
  }
  if (node.type === "listItem") return { type: "listItem", children: children() }
  if (node.type === "table") {
    return anchoredBlock(node, {
      type: "table",
      align: (node.attrs?.align as MdNode["align"]) ?? [],
      children: children(),
    })
  }
  if (node.type === "tableRow") return { type: "tableRow", children: children() }
  if (node.type === "tableHeader" || node.type === "tableCell") {
    return { type: "tableCell", children: (node.content ?? []).flatMap(mdText) }
  }
  const containerName = Object.entries(containerTypes).find(([, type]) => type === node.type)?.[0]
  if (containerName) {
    const title = node.attrs?.title
    const description = node.attrs?.description
    return {
      type: "containerDirective",
      name: containerName,
      attributes: attrsToDirective(node.attrs, new Set(["description", "title"])),
      children: [
        ...(title !== undefined ? [fieldDirective("title", title)] : []),
        ...(description !== undefined ? [fieldDirective("description", description)] : []),
        ...children(),
      ],
    }
  }
  const atomicName = Object.entries(atomicTypes).find(([, type]) => type === node.type)?.[0]
  if (atomicName) return readableDirective(atomicName, node.attrs)
  if (node.type === "questionPool") {
    return readableDirective("quiz", { kind: "quiz", ...(node.attrs ?? {}) })
  }
  return null
}

function textOfContent(node: ContentNode): string {
  if (typeof node.text === "string") return node.text
  return (node.content ?? []).map(textOfContent).join("")
}

export function serializeMarkdown(document: ParsedContentDocument): string {
  const root: MdNode = {
    type: "root",
    children: (document.content ?? []).map(toMdast).filter((node): node is MdNode => Boolean(node)),
  }
  return stringifyMarkdownRoot(root)
}

function stringifyMarkdownRoot(root: MdNode): string {
  return stringifier
    .stringify(root as never)
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd()
}

function documentLayoutNodes(header: ContentHeader): Record<ContentHeaderLayoutItem, MdNode> {
  return {
    cover: readableDirective("cover", header.image ? { ...header.image } : {}),
    title: {
      type: "heading",
      depth: 1,
      children: header.title ? [{ type: "text", value: header.title }] : [],
    },
    description: {
      type: "containerDirective",
      name: "cursare-description",
      children: [
        {
          type: "paragraph",
          children: header.description ? [{ type: "text", value: header.description }] : [],
        },
      ],
    },
  }
}

export function serializeDocumentMarkdown(
  document: ParsedContentDocument,
  header: ContentHeader,
): string {
  const canonical = canonicalHeader(header)
  const layoutNodes = documentLayoutNodes(canonical)
  const layout = canonical.layout ?? DEFAULT_CONTENT_HEADER_LAYOUT
  return stringifyMarkdownRoot({
    type: "root",
    children: [
      ...layout.map((item) => layoutNodes[item]),
      ...(document.content ?? []).map(toMdast).filter((node): node is MdNode => Boolean(node)),
    ],
  })
}

function assertSerializableDocument(document: ParsedContentDocument): void {
  const supportedNodes = new Set<string>(["doc", "text", ...RETAINED_BLOCK_TYPES])
  const supportedMarks = new Set<string>(RETAINED_MARK_TYPES)
  const diagnostics: DocumentDiagnostic[] = []
  const visit = (node: ContentNode, path: string) => {
    if (!supportedNodes.has(node.type)) {
      diagnostics.push(
        diagnostic(
          "unknown_directive",
          `${node.type} is not part of the Cursare Markdown contract.`,
          path,
        ),
      )
    }
    for (const [index, mark] of (node.marks ?? []).entries()) {
      if (!supportedMarks.has(mark.type)) {
        diagnostics.push(
          diagnostic(
            "unknown_directive",
            `${mark.type} is not a supported inline mark.`,
            `${path}.marks[${index}]`,
          ),
        )
      }
    }
    for (const [index, child] of (node.content ?? []).entries()) {
      visit(child, `${path}.content[${index}]`)
    }
  }
  visit(document, "document")
  if (diagnostics.length > 0) throw new CursareDocumentError(diagnostics)
}

function canonicalHeader(header: ContentHeader): ContentHeader {
  const image = header.image
    ? {
        ...header.image,
        src: header.image.src.trim(),
        alt: header.image.alt.trim(),
        focalPoint: header.image.focalPoint
          ? {
              x: Math.min(1, Math.max(0, header.image.focalPoint.x)),
              y: Math.min(1, Math.max(0, header.image.focalPoint.y)),
            }
          : null,
      }
    : null
  const layout = header.layout
  const usesDefaultLayout =
    !layout || layout.every((item, index) => item === DEFAULT_CONTENT_HEADER_LAYOUT[index])
  return {
    title: header.title.trim(),
    description: header.description.trim(),
    image,
    ...(usesDefaultLayout ? {} : { layout: [...layout] as ContentHeaderLayout }),
  }
}

export function makeCursareDocument(
  options: {
    title?: string
    description?: string
    image?: ContentHeader["image"]
    layout?: ContentHeaderLayout
    body?: string
  } = {},
): CursareDocument {
  const header: ContentHeader = {
    ...emptyContentHeader(options.title ?? ""),
    description: options.description ?? "",
    image: options.image ?? null,
    ...(options.layout ? { layout: options.layout } : {}),
  }
  const layoutSource = serializeDocumentMarkdown({ type: "doc", content: [] }, header)
  const body = options.body?.trim()
  return {
    version: CURSARE_DOCUMENT_VERSION,
    markdown: body ? `${layoutSource}\n\n${body}` : layoutSource,
  }
}

function canonicalizeDocument(
  document: CursareDocument,
  allowIncomplete: boolean,
): CursareDocument {
  const parsed = parseCursareDocument(document)
  const diagnostics = allowIncomplete
    ? parsed.diagnostics.filter((diagnostic) => !DRAFT_TOLERATED_DIAGNOSTICS.has(diagnostic.code))
    : parsed.diagnostics
  if (diagnostics.length > 0) throw new CursareDocumentError(diagnostics)

  const header = canonicalHeader(parsed.header)
  let markdown = serializeDocumentMarkdown(parsed.document, header)
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = {
      version: CURSARE_DOCUMENT_VERSION,
      markdown,
    } satisfies CursareDocument
    const reparsed = parseCursareDocument(candidate)
    const reparseDiagnostics = allowIncomplete
      ? reparsed.diagnostics.filter(
          (diagnostic) => !DRAFT_TOLERATED_DIAGNOSTICS.has(diagnostic.code),
        )
      : reparsed.diagnostics
    if (reparseDiagnostics.length > 0) {
      throw new CursareDocumentError([
        {
          code: "non_canonical_round_trip",
          message: "Markdown serialization produced an invalid canonical document.",
          path: "document.markdown",
        },
      ])
    }
    const nextMarkdown = serializeDocumentMarkdown(reparsed.document, reparsed.header)
    if (nextMarkdown === markdown) return candidate
    markdown = nextMarkdown
  }

  throw new CursareDocumentError([
    {
      code: "non_canonical_round_trip",
      message: "Markdown does not have a stable canonical serialization.",
      path: "document.markdown",
    },
  ])
}

export function canonicalizeCursareDocument(document: CursareDocument): CursareDocument {
  return canonicalizeDocument(document, false)
}

export function canonicalizeCursareDraft(document: CursareDocument): CursareDocument {
  return canonicalizeDocument(document, true)
}

function documentFromParsedMode(
  parsed: ParsedContentDocument,
  header: ContentHeader,
  allowIncomplete: boolean,
): CursareDocument {
  assertSerializableDocument(parsed)
  const markdown = serializeDocumentMarkdown(parsed, header)
  const document = {
    version: CURSARE_DOCUMENT_VERSION,
    markdown,
  } satisfies CursareDocument
  const diagnostics = allowIncomplete
    ? draftDocumentDiagnostics(document)
    : parseCursareDocument(document).diagnostics
  if (diagnostics.length > 0) throw new CursareDocumentError(diagnostics)
  return document
}

export function documentFromParsed(
  parsed: ParsedContentDocument,
  header: ContentHeader,
): CursareDocument {
  return documentFromParsedMode(parsed, header, false)
}

export function draftDocumentFromParsed(
  parsed: ParsedContentDocument,
  header: ContentHeader,
): CursareDocument {
  return documentFromParsedMode(parsed, header, true)
}

export function semanticallyEqualDocuments(left: CursareDocument, right: CursareDocument): boolean {
  return (
    JSON.stringify(canonicalizeCursareDocument(left)) ===
    JSON.stringify(canonicalizeCursareDocument(right))
  )
}
