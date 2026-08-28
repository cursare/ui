import { learnerAnchorId } from "./learner-anchors"
import { documentFromParsed, parseCursareDocument } from "./markdown"
import type { ContentNode, CursareDocument, ParsedContentDocument } from "./schema"
import { isSafeVideoSource } from "./video-url"

export type { ContentNode } from "./schema"

export type ContentDocumentSource = CursareDocument | ParsedContentDocument

export type VideoTextTrackKind = "captions" | "subtitles"

export interface VideoTextTrack {
  src: string
  kind: VideoTextTrackKind
  label: string
  lang: string
  default?: boolean
}

export const PUBLIC_PREAMBLE_BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "blockquote",
  "callout",
  "horizontalRule",
  "image",
  "video",
  "embed",
])

export const LEARNING_ONLY_BLOCK_TYPES = new Set([
  "reference",
  "table",
  "tableRow",
  "tableHeader",
  "tableCell",
  "codeBlock",
  "diagram",
  "mathBlock",
  "steps",
  "step",
  "audio",
  "fileAttachment",
  "glossaryTerm",
  "poll",
  "questionPool",
])

export interface DocumentProfileIssue {
  path: string
  nodeType: string
  code:
    | "invalid_document_shape"
    | "unknown_top_level_block"
    | "duplicate_step_id"
    | "missing_step_id"
    | "unsafe_url"
  message: string
}

export type ContentStarterTemplate = "blank" | "lesson" | "module" | "program"

const starterHeading = (id: string, title: string): ContentNode => ({
  type: "heading",
  attrs: { level: 2, blockId: id },
  content: [{ type: "text", text: title }],
})

const starterParagraph = (text: string): ContentNode => ({
  type: "paragraph",
  content: [{ type: "text", text }],
})

export function starterContentDoc(
  template: ContentStarterTemplate,
  title: string,
): CursareDocument {
  const body: ContentNode[] =
    template === "blank"
      ? []
      : template === "lesson"
        ? [
            starterHeading("section-start", "Start here"),
            starterParagraph("Introduce the idea, then add examples and practice."),
          ]
        : template === "module"
          ? [
              starterHeading("section-overview", "Overview"),
              starterParagraph("Set the context, then insert reusable content in learning order."),
            ]
          : [
              starterHeading("section-welcome", "Welcome"),
              starterParagraph("Explain the transformation this learning path delivers."),
              starterHeading("section-roadmap", "Roadmap"),
              starterParagraph("Insert or create the contents that make up this path."),
            ]
  return documentFromParsed({ type: "doc", content: body }, { title, description: "", image: null })
}

export function learningContentNodes(document: ContentDocumentSource): ContentNode[] {
  return bodyNodes(document)
}

function hasPrivatePreambleMedia(node: ContentNode): boolean {
  if (node.type !== "image" && node.type !== "video" && node.type !== "embed") {
    return false
  }
  return node.attrs?.private === true || node.attrs?.visibility === "private"
}

function visitNode(
  node: ContentNode,
  path: string,
  visit: (node: ContentNode, path: string) => void,
): void {
  visit(node, path)
  for (const [index, child] of (node.content ?? []).entries()) {
    visitNode(child, `${path}.content[${index}]`, visit)
  }
}

export function isSafeResourceUrl(value: unknown): boolean {
  if (value === null || value === "") return true
  if (typeof value !== "string" || value.length > 2_048) return false
  if (value.startsWith("/") && !value.startsWith("//")) return true
  try {
    return new URL(value).protocol === "https:"
  } catch {
    return false
  }
}

const VIDEO_TEXT_TRACK_KINDS = new Set<VideoTextTrackKind>(["captions", "subtitles"])
const VIDEO_TEXT_TRACK_LANGUAGE = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/
const MAX_VIDEO_TEXT_TRACKS = 20

function isWebVttResourceUrl(value: unknown): value is string {
  if (!isSafeResourceUrl(value) || typeof value !== "string" || value.length === 0) return false
  try {
    return new URL(value, "https://cursare.invalid").pathname.toLowerCase().endsWith(".vtt")
  } catch {
    return false
  }
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

export function isSafeVideoTextTracks(value: unknown): boolean {
  if (value === undefined) return true
  if (!Array.isArray(value) || value.length > MAX_VIDEO_TEXT_TRACKS) return false
  const tracks = videoTextTracks(value)
  return tracks.length === value.length && tracks.filter((track) => track.default).length <= 1
}

export function isSafeVideoUrl(attrs: Record<string, unknown>): boolean {
  return isSafeVideoSource(attrs.src, attrs.provider)
}

function parsedDocument(source: ContentDocumentSource): ParsedContentDocument {
  if ("version" in source) return parseCursareDocument(source).document
  return source
}

function bodyNodes(source: ContentDocumentSource): ContentNode[] {
  return parsedDocument(source).content ?? []
}
function stepIdOf(node: ContentNode): string | null {
  if (node.type !== "heading" && node.type !== "reference") return null
  const value = node.attrs?.blockId ?? node.attrs?.learnerAnchorId
  return typeof value === "string" && value.trim() ? value : null
}

export function validateContentDoc(source: CursareDocument): DocumentProfileIssue[] {
  return parseCursareDocument(source).diagnostics.map((issue) => ({
    path: issue.path,
    nodeType: "document",
    code:
      issue.code === "duplicate_stable_id"
        ? "duplicate_step_id"
        : issue.code === "missing_stable_id"
          ? "missing_step_id"
          : issue.code === "unsafe_url"
            ? "unsafe_url"
            : "invalid_document_shape",
    message: issue.message,
  }))
}

function isPublicPreambleBlock(node: ContentNode): boolean {
  if (!PUBLIC_PREAMBLE_BLOCK_TYPES.has(node.type) || hasPrivatePreambleMedia(node)) return false
  let safe = true
  visitNode(node, "preamble", (child) => {
    if (LEARNING_ONLY_BLOCK_TYPES.has(child.type) || hasPrivatePreambleMedia(child)) safe = false
  })
  return safe
}

export function publicSafePreamble(source: ContentDocumentSource): {
  content: ParsedContentDocument
  hasLearningContent: boolean
} {
  const nodes = parsedDocument(source).content ?? []
  const content: ContentNode[] = []
  let stopped = false
  for (const node of nodes) {
    if (stopped || node.type === "reference" || !isPublicPreambleBlock(node)) {
      stopped = true
      continue
    }
    content.push(node)
  }
  return { content: { type: "doc", content }, hasLearningContent: stopped }
}

function textOf(node?: ContentNode): string {
  if (!node) {
    return ""
  }
  if (typeof node.text === "string") {
    return node.text
  }
  return (node.content ?? []).map(textOf).join("")
}

export interface ContentSection {
  index: number
  title: string
  id: string
}

export interface ContentActivityLocation {
  activityId: string
  sectionId: string
}

function findContentActivity(
  doc: ContentDocumentSource,
  matches: (node: ContentNode) => boolean,
): ContentActivityLocation | null {
  let sectionId = "section:0"
  let found: ContentActivityLocation | null = null
  const visit = (node: ContentNode) => {
    if (found) return
    if (node.type === "heading") {
      const id = node.attrs?.blockId
      if (typeof id === "string" && id) sectionId = id
    }
    if (matches(node)) {
      // Per-type identity: a poll's id lives in pollId, not learnerAnchorId, so
      // reading the raw attr returned null and the poll.submitted event never fired.
      const id = learnerAnchorId(node)
      if (id) found = { activityId: id, sectionId }
    }
    for (const child of node.content ?? []) visit(child)
  }
  for (const node of learningContentNodes(doc)) visit(node)
  return found
}

export function quizActivityLocation(
  doc: ContentDocumentSource,
  answeredQuestionIds: readonly string[],
): ContentActivityLocation | null {
  const answered = new Set(answeredQuestionIds)
  return findContentActivity(doc, (node) =>
    node.type === "questionPool" && Array.isArray(node.attrs?.questions)
      ? node.attrs.questions.some(
          (question) =>
            typeof question === "object" &&
            question !== null &&
            "id" in question &&
            typeof question.id === "string" &&
            answered.has(question.id),
        )
      : false,
  )
}

export function pollActivityLocation(
  doc: ContentDocumentSource,
  pollId: string,
): ContentActivityLocation | null {
  return findContentActivity(doc, (node) => node.type === "poll" && node.attrs?.pollId === pollId)
}

const RESERVED_REFERENCE_SLUGS = new Set(["certificate"])

// Normalize a parent-owned module URL segment without changing the target content.
export function normalizeReferenceSlug(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/g, "")
  return RESERVED_REFERENCE_SLUGS.has(cleaned) ? `${cleaned}-1` : cleaned
}

interface StepCommon {
  id: string
  position: number
  // `null` defaults to the preceding step (sequential); `[]` is always open.
  requires: string[] | null
}

// What a drip delay counts from: enrollment, or completing the previous step.
export type DripAnchor = "enroll" | "prev"

export type PublishedContentStep =
  | ({ kind: "section"; sectionIndex: number; title: string } & StepCommon)
  | ({
      kind: "reference"
      targetContentId: string
      routeSegment: string
      title: string
      afterHours: number | null
      dripAnchor: DripAnchor
    } & StepCommon)

function parseAfterHours(attrs: Record<string, unknown>): number | null {
  return typeof attrs.afterHours === "number" ? attrs.afterHours : null
}

function parseRequires(value: unknown): string[] | null {
  return Array.isArray(value) ? value.map(String) : null
}

export const PUBLISHED_CONTENT_MANIFEST_VERSION = 1 as const

export interface PublishedContentManifest {
  version: typeof PUBLISHED_CONTENT_MANIFEST_VERSION
  steps: PublishedContentStep[]
}

export function extractContentManifest(doc: ContentDocumentSource): PublishedContentManifest {
  const steps: PublishedContentStep[] = []
  const seen = new Set<string>()
  let sectionIndex = 0
  for (const node of learningContentNodes(doc)) {
    if (node.type === "heading") {
      const id = stepIdOf(node)
      if (!id) throw new TypeError("A heading requires a stable block id.")
      if (seen.has(id)) throw new TypeError(`The step id ${id} is duplicated.`)
      seen.add(id)
      steps.push({
        kind: "section",
        sectionIndex,
        title: textOf(node).trim() || `Section ${sectionIndex + 1}`,
        id,
        position: steps.length,
        requires: parseRequires(node.attrs?.requires),
      })
      sectionIndex += 1
    } else if (node.type === "reference" && node.attrs?.targetContentId) {
      const id = stepIdOf(node)
      if (!id) throw new TypeError("A content reference requires a stable block id.")
      if (seen.has(id)) throw new TypeError(`The step id ${id} is duplicated.`)
      seen.add(id)
      steps.push({
        kind: "reference",
        targetContentId: String(node.attrs.targetContentId),
        routeSegment: String(node.attrs.routeSegment ?? ""),
        title: String(node.attrs.title ?? "Referenced content"),
        id,
        position: steps.length,
        requires: parseRequires(node.attrs.requires),
        afterHours: parseAfterHours(node.attrs),
        dripAnchor: node.attrs.dripAnchor === "prev" ? "prev" : "enroll",
      })
    }
  }
  const body = learningContentNodes(doc)
  if (steps.length === 0 && body.length > 0) {
    steps.push({
      kind: "section",
      sectionIndex: 0,
      title: "The content",
      id: "section:0",
      position: 0,
      requires: null,
    })
  }
  return { version: PUBLISHED_CONTENT_MANIFEST_VERSION, steps }
}

export function manifestSections(manifest: PublishedContentManifest): ContentSection[] {
  return manifest.steps
    .filter(
      (step): step is Extract<PublishedContentStep, { kind: "section" }> => step.kind === "section",
    )
    .map((step) => ({ index: step.sectionIndex, title: step.title, id: step.id }))
}

export function manifestSectionIds(manifest: PublishedContentManifest): string[] {
  return manifestSections(manifest).map((section) => section.id)
}

export function manifestReferenceSteps(
  manifest: PublishedContentManifest,
): Array<Extract<PublishedContentStep, { kind: "reference" }>> {
  return manifest.steps.filter(
    (step): step is Extract<PublishedContentStep, { kind: "reference" }> =>
      step.kind === "reference",
  )
}

export function manifestTargetContentIds(manifest: PublishedContentManifest): string[] {
  return [...new Set(manifestReferenceSteps(manifest).map((step) => step.targetContentId))]
}

export function manifestCompletionStepIds(manifest: PublishedContentManifest): string[] {
  return manifest.steps.map((step) => step.id)
}

export function manifestOutline(
  manifest: PublishedContentManifest,
): readonly PublishedContentStep[] {
  return manifest.steps
}

export interface ManifestBreadcrumb {
  stepId: string
  targetContentId: string
  title: string
  routeSegment: string
}

export function manifestBreadcrumb(
  manifest: PublishedContentManifest,
  stepId: string,
): ManifestBreadcrumb | null {
  const step = manifestReferenceSteps(manifest).find((candidate) => candidate.id === stepId)
  return step
    ? {
        stepId: step.id,
        targetContentId: step.targetContentId,
        title: step.title,
        routeSegment: step.routeSegment,
      }
    : null
}

export function manifestResumeStep(
  manifest: PublishedContentManifest,
  isComplete: (stepId: string) => boolean,
): PublishedContentStep | null {
  return manifest.steps.find((step) => !isComplete(step.id)) ?? null
}

export type ContentManifestResolver = (contentId: string) => PublishedContentManifest | null

export interface ContentGraphVisit {
  contentId: string
  depth: number
  path: string[]
  viaStepId: string | null
}

export function contentReferenceCycle(
  rootContentId: string,
  resolve: ContentManifestResolver,
): string[] | null {
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const path: string[] = []

  const visit = (contentId: string): string[] | null => {
    if (visiting.has(contentId)) {
      const start = path.indexOf(contentId)
      return [...path.slice(start), contentId]
    }
    if (visited.has(contentId)) return null
    visiting.add(contentId)
    path.push(contentId)
    for (const targetId of manifestTargetContentIds(
      resolve(contentId) ?? { version: PUBLISHED_CONTENT_MANIFEST_VERSION, steps: [] },
    )) {
      const cycle = visit(targetId)
      if (cycle) return cycle
    }
    path.pop()
    visiting.delete(contentId)
    visited.add(contentId)
    return null
  }

  return visit(rootContentId)
}

export function traverseContentGraph(
  rootContentId: string,
  resolve: ContentManifestResolver,
  limit = 1_000,
): ContentGraphVisit[] {
  const visits: ContentGraphVisit[] = []
  const walk = (contentId: string, path: string[], viaStepId: string | null): void => {
    if (path.includes(contentId))
      throw new TypeError(`Content reference cycle: ${[...path, contentId].join(" -> ")}`)
    if (visits.length >= limit) throw new RangeError(`Content graph exceeds ${limit} visits.`)
    const nextPath = [...path, contentId]
    visits.push({ contentId, depth: path.length, path: nextPath, viaStepId })
    const manifest = resolve(contentId)
    if (!manifest) return
    for (const step of manifestReferenceSteps(manifest)) {
      walk(step.targetContentId, nextPath, step.id)
    }
  }
  walk(rootContentId, [], null)
  return visits
}

export interface StepState {
  available: boolean
  reason: LockReason | null
  // Null when not drip-gated, or when a "prev"-anchored predecessor isn't
  // complete yet and the timer hasn't started.
  unlockAt: number | null
}

// One set of semantics for every step kind. Sections unlock by prerequisites;
// references unlock by their release rule — drip plus EXPLICIT prerequisites
// only, never sequentially by document order.
//
// A prerequisite id that no longer exists is treated as satisfied, so a deleted
// target can never dead-lock a learner.
export function stepStates(steps: PublishedContentStep[], ctx: ReleaseContext): StepState[] {
  const known = new Set(steps.map((s) => s.id))
  const isComplete = (id: string) => !known.has(id) || ctx.isComplete(id)
  return steps.map((step, i) => {
    if (step.kind === "reference") {
      // A "prev" anchor whose predecessor isn't complete has no anchor, so the
      // step stays locked with its timer unstarted.
      const prev = steps[i - 1]
      const anchorAt =
        step.dripAnchor === "prev"
          ? prev
            ? (ctx.completedAt?.(prev.id) ?? null)
            : null
          : ctx.enrolledAt
      const access = referenceAccess(step, { now: ctx.now, isComplete, anchorAt })
      return { available: access.accessible, reason: access.reason, unlockAt: access.unlockAt }
    }
    const ok = effectiveRequires(steps, i).every(isComplete)
    return { available: ok, reason: ok ? null : "prerequisite", unlockAt: null }
  })
}

// Explicit `requires`, or the preceding step by default.
function effectiveRequires(steps: PublishedContentStep[], index: number): string[] {
  const step = steps[index]
  if (!step) return []
  const prev = steps[index - 1]
  return step.requires ?? (prev ? [prev.id] : [])
}

// True when `candidateId` already (transitively) requires `stepId`. Keeps the
// "Unlocks after" picker from dead-locking a learner.
export function wouldCreatePrerequisiteCycle(
  steps: PublishedContentStep[],
  stepId: string,
  candidateId: string,
): boolean {
  if (stepId === candidateId) return true
  const indexById = new Map(steps.map((step, i) => [step.id, i]))
  const seen = new Set<string>()
  const stack = [candidateId]
  while (stack.length > 0) {
    const id = stack.pop() as string
    if (id === stepId) return true
    if (seen.has(id)) continue
    seen.add(id)
    const idx = indexById.get(id)
    if (idx !== undefined) stack.push(...effectiveRequires(steps, idx))
  }
  return false
}

export interface ReleaseContext {
  // When the learner enrolled — anchors "enroll" drip; null when not enrolled.
  enrolledAt: Date | null
  now: Date
  isComplete: (id: string) => boolean
  // Completion time of a step id, for "prev"-anchored drip — null when the step
  // isn't complete or its time wasn't recorded (falls back to a locked timer). */
  completedAt?: (id: string) => Date | null
}

export type LockReason = "drip" | "prerequisite"

// Whether a referenced module is open under its PACING rule — and if not, why. The
// rule (drip + explicit prerequisites) lives on the reference, owned by the parent
// doc, so the same child content is paced independently per root. Access/payment is
// NOT checked here — it's a property of the sellable unit the learner entered
// through. A reference's `requires` is EXPLICIT (empty = none) — no default-to-
// previous; modules are paced by their own rule, not by document order.
export function referenceAccess(
  step: Extract<PublishedContentStep, { kind: "reference" }>,
  ctx: { now: Date; isComplete: (id: string) => boolean; anchorAt: Date | null },
): { accessible: boolean; reason: LockReason | null; unlockAt: number | null } {
  if (step.afterHours != null && step.afterHours > 0) {
    const unlockAt = ctx.anchorAt ? ctx.anchorAt.getTime() + step.afterHours * 3_600_000 : null
    if (unlockAt == null || ctx.now.getTime() < unlockAt) {
      return { accessible: false, reason: "drip", unlockAt }
    }
  }
  const reqs = step.requires ?? []
  if (!reqs.every((id) => ctx.isComplete(id))) {
    return { accessible: false, reason: "prerequisite", unlockAt: null }
  }
  return { accessible: true, reason: null, unlockAt: null }
}

// Reveal only the first `revealSteps` steps of a content's body — the header,
// any preamble, and content up to (and including) the current step. Everything
// belonging to later (locked) steps is dropped, so a learner can't read ahead.
// `hasMore` is true when content was withheld.
export function revealUpTo(
  source: ContentDocumentSource,
  revealSteps: number,
): { content: ParsedContentDocument; hasMore: boolean } {
  const doc = parsedDocument(source)
  const nodes = doc.content ?? []
  const out: ContentNode[] = []
  let steps = 0
  let hasMore = false
  for (const node of nodes) {
    const isStep =
      node.type === "heading" || (node.type === "reference" && Boolean(node.attrs?.targetContentId))
    if (isStep) {
      steps += 1
      if (steps > revealSteps) {
        hasMore = true
        break
      }
    }
    out.push(node)
  }
  return { content: { type: "doc", content: out }, hasMore }
}

// Reveal only the steps the learner has unlocked. Unlike revealUpTo (a
// prefix cut), availability can be non-contiguous — step 3 may be open while step 2
// is locked — so this is a filter: a step's content is kept only when
// `isRevealed(stepId)` is true, and locked steps' content is dropped (never shipped).
// Preamble before the first step (the header) is always shown. `hasLocked` is true
// when any step's content was withheld.
export function revealAvailable(
  source: ContentDocumentSource,
  isRevealed: (stepId: string) => boolean,
): { content: ParsedContentDocument; hasLocked: boolean } {
  const doc = parsedDocument(source)
  const nodes = doc.content ?? []
  const out: ContentNode[] = []
  let currentRevealed = true // preamble before the first step is always shown
  let hasLocked = false
  for (const node of nodes) {
    const isHeading = node.type === "heading"
    const isRef = node.type === "reference" && Boolean(node.attrs?.targetContentId)
    if (isHeading || isRef) {
      const id = stepIdOf(node)
      if (!id) throw new TypeError(`${node.type} requires a stable block id.`)
      currentRevealed = isRevealed(id)
      if (!currentRevealed) {
        hasLocked = true
        continue // drop the step-starting node along with its content
      }
    }
    if (currentRevealed) out.push(node)
  }
  return { content: { type: "doc", content: out }, hasLocked }
}

export interface DocQuestion {
  id: string
  prompt: string
}

// Every quiz question in a doc (id + prompt) — for author-facing analytics.
export function collectQuestions(doc: ContentDocumentSource): DocQuestion[] {
  const questions: DocQuestion[] = []
  for (const node of learningContentNodes(doc)) {
    if (node.type === "questionPool") {
      const items = Array.isArray(node.attrs?.questions)
        ? (node.attrs.questions as { id?: string; prompt?: string }[])
        : []
      for (const item of items) {
        if (item?.id) questions.push({ id: item.id, prompt: item.prompt ?? "" })
      }
    }
  }
  return questions
}

export interface DocPoll {
  pollId: string
  question: string
  options: { id: string; text: string }[]
}

// Every class poll in a doc (question + options) — for author-facing analytics.
export function collectPolls(doc: ContentDocumentSource): DocPoll[] {
  const polls: DocPoll[] = []
  for (const node of learningContentNodes(doc)) {
    if (node.type !== "poll" || !node.attrs?.pollId) continue
    const options = Array.isArray(node.attrs.options)
      ? (node.attrs.options as { id?: string; text?: string }[])
      : []
    polls.push({
      pollId: String(node.attrs.pollId),
      question: String(node.attrs.question ?? ""),
      options: options
        .filter((option) => option?.id)
        .map((option) => ({ id: String(option.id), text: option.text ?? "" })),
    })
  }
  return polls
}

// Pull the header fields out of a document (for listings, cards, SEO).
export function extractHeader(document: CursareDocument): import("./schema").ContentHeader {
  return parseCursareDocument(document).header
}

// The question ids of every question pool INSIDE a given section (content
// between that heading and the next one), addressed by the section's stable id.
// Used to gate section completion: a section that carries a quiz isn't done
// until the learner has submitted it. Pools in the preamble (before any
// heading) gate nothing — except in a heading-less content, whose single
// synthetic section (`section:0`) owns the whole body.
export function sectionQuizIds(doc: ContentDocumentSource, sectionId: string): string[] {
  const nodes = learningContentNodes(doc)
  const hasHeadings = nodes.some((node) => node.type === "heading")
  const poolIds = (node: ContentNode): string[] => {
    const questions = Array.isArray(node.attrs?.questions)
      ? (node.attrs.questions as { id: string }[])
      : []
    return questions.filter((question) => question?.id).map((question) => question.id)
  }

  const ids: string[] = []
  let inSection = !hasHeadings && sectionId === "section:0"
  for (const node of nodes) {
    if (node.type === "heading") {
      const id = stepIdOf(node)
      if (!id) throw new TypeError("A heading requires a stable block id.")
      inSection = id === sectionId
      continue
    }
    if (inSection && node.type === "questionPool") {
      ids.push(...poolIds(node))
    }
  }
  return ids
}
