import { type ContentDocumentSource, type ContentNode, publicSafePreamble } from "./doc"
import { parseCursareDocument } from "./markdown"
import type { ParsedContentDocument } from "./schema"

interface SanitizedOption {
  id: string
  text: string
}

interface AuthorQuestion {
  id: string
  prompt: string
  options: SanitizedOption[]
  correctOptionId: string | null
}

// Quiz sampling must be STABLE per learner. Without a seed every server render
// re-rolled `Math.random`, so a reload showed a different quiz and the learner's
// saved answers no longer lined up. `seed === undefined` falls back to
// `Math.random` for anonymous preview.
function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return h >>> 0
}

function mulberry32(a: number): () => number {
  let state = a
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = arr[i] as T
    arr[i] = arr[j] as T
    arr[j] = tmp
  }
  return arr
}

// Drives adaptive sampling: missed questions come back first, mastered ones make
// room for material the learner hasn't seen yet.
export interface QuestionMastery {
  [questionId: string]: { correct: number; misses: number }
}

// Lower rank = higher priority: needs-work → unseen → mastered.
function masteryRank(mastery: QuestionMastery, id: string): number {
  const entry = mastery[id]
  if (!entry) return 1 // unseen
  return entry.misses >= entry.correct ? 0 : 2
}

function sanitizeNode(
  node: ContentNode,
  rand: () => number,
  mastery?: QuestionMastery,
): ContentNode {
  if (node.type === "questionPool") {
    const attrs = node.attrs ?? {}
    const questions = Array.isArray(attrs.questions) ? (attrs.questions as AuthorQuestion[]) : []
    const reveal = Math.max(1, Math.min(Number(attrs.reveal) || 1, questions.length || 1))
    // Seeded shuffle, then a STABLE sort by mastery bucket, so the sample only
    // shifts when a new attempt lands.
    const ordered = shuffle(questions, rand)
    if (mastery) ordered.sort((a, b) => masteryRank(mastery, a.id) - masteryRank(mastery, b.id))
    const sampled = ordered
      .slice(0, reveal)
      // Drop correctOptionId; shuffle options so order isn't a tell.
      .map((question) => ({
        id: question.id,
        prompt: question.prompt,
        options: shuffle(question.options ?? [], rand).map((option) => ({
          id: option.id,
          text: option.text,
        })),
      }))
    return { ...node, attrs: { ...attrs, questions: sampled, collapsed: false } }
  }
  // Defense in depth: a questionPool nested in a callout/step/blockquote/listItem
  // must be sampled and stripped of correctOptionId too. Without recursing here,
  // the raw answer key of any nested quiz ships straight to the learner client.
  if (node.content && node.content.length > 0) {
    return { ...node, content: node.content.map((child) => sanitizeNode(child, rand, mastery)) }
  }
  return node
}

// ALWAYS run this before sending content to a learner client: the raw author
// document carries every question and its answer. Pass `seed` (e.g.
// `${userId}:${targetContentId}`) so the sample stays stable across reloads and keeps
// matching the learner's saved answers.
export function forLearner(
  source: ContentDocumentSource,
  seed?: string,
  mastery?: QuestionMastery,
): ParsedContentDocument {
  const doc = "version" in source ? parseCursareDocument(source).document : source
  const rand = seed === undefined ? Math.random : mulberry32(hashSeed(seed))
  return {
    type: "doc",
    content: (doc.content ?? []).map((node) => sanitizeNode(node, rand, mastery)),
  }
}

export interface SalesPreview {
  content: ParsedContentDocument
  gated: boolean
}

export interface SalesPreviewOptions {
  seed?: string
}

export function salesPreview(
  doc: ContentDocumentSource,
  options: SalesPreviewOptions = {},
): SalesPreview {
  const projection = publicSafePreamble(doc)
  return {
    content: forLearner(projection.content, options.seed),
    gated: projection.hasLearningContent,
  }
}

// Build the answer key (question id → correct option id) from the *author*
// document. Server-only — use it to grade a learner's answers; never send it to
// a client.
export function collectAnswerKey(source: ContentDocumentSource): Record<string, string | null> {
  const doc = "version" in source ? parseCursareDocument(source).document : source
  const key: Record<string, string | null> = {}
  for (const node of doc.content ?? []) {
    if (node.type === "questionPool") {
      const questions = Array.isArray(node.attrs?.questions)
        ? (node.attrs.questions as AuthorQuestion[])
        : []
      for (const question of questions) {
        key[question.id] = question.correctOptionId ?? null
      }
    }
  }
  return key
}
