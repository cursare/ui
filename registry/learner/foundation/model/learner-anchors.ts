import type { ContentDocumentSource, ContentNode } from "./doc"
import { draftDocumentFromParsed, parseCursareDocument } from "./markdown"
import type { CursareDocument, ParsedContentDocument } from "./schema"

export const LEARNER_ANCHOR_ATTR = "learnerAnchorId"

const LABEL_LIMIT = 96
const IDENTITY_ATTR_BY_NODE_TYPE = new Map<string, string>([
  ["heading", "blockId"],
  ["reference", "blockId"],
  ["callout", "id"],
  ["steps", "id"],
  ["step", "id"],
  ["poll", "pollId"],
])

export interface LearnerAnchor {
  id: string
  nodeType: string
  label: string
  sectionId: string | null
  sectionLabel: string | null
  order: number
}

export interface LearnerAnchorMatch extends LearnerAnchor {
  node: ContentNode
}

export interface LearnerAnchorIdentityIssue {
  id: string | null
  nodeType: string
  order: number
  reason: "duplicate" | "missing"
}

export type LearnerAnchorMint = (node: ContentNode, order: number) => string

interface AddressableNode {
  node: ContentNode
  replace: (node: ContentNode) => void
}

function textOf(node: ContentNode | undefined): string {
  if (!node) return ""
  if (typeof node.text === "string") return node.text
  return (node.content ?? []).map(textOf).join(" ")
}

function normalizedText(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function typeLabel(type: string): string {
  return type
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase())
}

export function learnerAnchorLabel(node: ContentNode): string {
  const text = normalizedText(textOf(node))
  if (text) return text.slice(0, LABEL_LIMIT)
  const explicit = [
    node.attrs?.title,
    node.attrs?.name,
    node.attrs?.question,
    node.attrs?.label,
  ].find((value) => typeof value === "string" && value.trim())
  return typeof explicit === "string" ? explicit.trim().slice(0, LABEL_LIMIT) : typeLabel(node.type)
}

function mapAddressableNodes(
  doc: ParsedContentDocument,
  visit: (entry: AddressableNode) => void,
): ParsedContentDocument {
  let changed = false
  const content = (doc.content ?? []).map((node) => {
    let next = node
    visit({
      node,
      replace(value) {
        next = value
      },
    })
    if (next !== node) changed = true
    return next
  })
  return changed ? { ...doc, content } : doc
}

function parsedDocument(doc: ContentDocumentSource): ParsedContentDocument {
  return "version" in doc ? parseCursareDocument(doc).document : doc
}

function addressableNodes(doc: ContentDocumentSource): ContentNode[] {
  const nodes: ContentNode[] = []
  mapAddressableNodes(parsedDocument(doc), ({ node }) => nodes.push(node))
  return nodes
}

export function learnerAnchorId(node: ContentNode): string | null {
  const identityAttr = IDENTITY_ATTR_BY_NODE_TYPE.get(node.type) ?? LEARNER_ANCHOR_ATTR
  const value = node.attrs?.[identityAttr]
  return typeof value === "string" && value.trim() ? value : null
}

function withoutAnchorIdentity(node: ContentNode): ContentNode {
  const attrs = { ...(node.attrs ?? {}) }
  delete attrs[LEARNER_ANCHOR_ATTR]
  delete attrs[IDENTITY_ATTR_BY_NODE_TYPE.get(node.type) ?? LEARNER_ANCHOR_ATTR]
  return {
    ...node,
    ...(Object.keys(attrs).length > 0 ? { attrs } : { attrs: undefined }),
    ...(node.content ? { content: node.content.map(withoutAnchorIdentity) } : {}),
  }
}

export function learnerAnchorFingerprint(node: ContentNode): string {
  return JSON.stringify(withoutAnchorIdentity(node))
}

function hash(value: string): string {
  let result = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 16777619)
  }
  return (result >>> 0).toString(36)
}

export const deterministicLearnerAnchorMint: LearnerAnchorMint = (node, order) =>
  `learner-${hash(learnerAnchorFingerprint(node))}-${order.toString(36)}`

export function ensureLearnerAnchors(
  doc: CursareDocument,
  mint?: LearnerAnchorMint,
): CursareDocument
export function ensureLearnerAnchors(
  doc: ParsedContentDocument,
  mint?: LearnerAnchorMint,
): ParsedContentDocument
export function ensureLearnerAnchors(
  doc: ContentDocumentSource,
  mint: LearnerAnchorMint = deterministicLearnerAnchorMint,
): CursareDocument | ParsedContentDocument {
  const seen = new Set<string>()
  let order = 0
  const parsed = mapAddressableNodes(parsedDocument(doc), ({ node, replace }) => {
    const existing = learnerAnchorId(node)
    let id = existing
    if (!id || seen.has(id)) {
      do {
        id = mint(node, order)
      } while (!id || seen.has(id))
    }
    if (existing !== id) {
      const attrs = { ...(node.attrs ?? {}) }
      const identityAttr = IDENTITY_ATTR_BY_NODE_TYPE.get(node.type) ?? LEARNER_ANCHOR_ATTR
      attrs[identityAttr] = id
      replace({ ...node, attrs })
    }
    seen.add(id)
    order += 1
  })
  return "version" in doc
    ? draftDocumentFromParsed(parsed, parseCursareDocument(doc).header)
    : parsed
}

export function learnerAnchors(doc: ContentDocumentSource): LearnerAnchor[] {
  const anchors: LearnerAnchor[] = []
  let sectionId: string | null = null
  let sectionLabel: string | null = null
  for (const [order, node] of addressableNodes(doc).entries()) {
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

export function learnerAnchorIdentityIssues(
  doc: ContentDocumentSource,
): LearnerAnchorIdentityIssue[] {
  const issues: LearnerAnchorIdentityIssue[] = []
  const seen = new Set<string>()
  for (const [order, node] of addressableNodes(doc).entries()) {
    const id = learnerAnchorId(node)
    if (!id) {
      issues.push({ id: null, nodeType: node.type, order, reason: "missing" })
      continue
    }
    if (seen.has(id)) {
      issues.push({ id, nodeType: node.type, order, reason: "duplicate" })
      continue
    }
    seen.add(id)
  }
  return issues
}

export function findLearnerAnchor(
  doc: ContentDocumentSource,
  id: string,
): LearnerAnchorMatch | null {
  const nodes = addressableNodes(doc)
  let sectionId: string | null = null
  let sectionLabel: string | null = null
  for (const [order, node] of nodes.entries()) {
    const anchorId = learnerAnchorId(node)
    if (node.type === "heading" && anchorId) {
      sectionId = anchorId
      sectionLabel = learnerAnchorLabel(node)
    }
    if (anchorId === id) {
      return {
        id: anchorId,
        nodeType: node.type,
        label: learnerAnchorLabel(node),
        sectionId,
        sectionLabel,
        order,
        node,
      }
    }
  }
  return null
}
