import {
  type ContentNode,
  learnerAnchorId,
  type ParsedContentDocument,
} from "@/components/cursare/foundation/model/learner-runtime"
export interface LearnerCourseProjection {
  key: string
  title: string
  publisher: string
  description: string | null
  coverImage: string | null
  theme?: string | null
  done: number
  total: number
  percent: number
  completed: boolean
  resumeHref: string
  courseHomeHref: string
  certificateHref?: string | null
}

export interface LearnerHomeProjection<T extends { completed: boolean }> {
  primary: T | null
  active: T[]
  completed: T[]
}

export function projectLearnerHome<T extends { completed: boolean }>(
  courses: readonly T[],
): LearnerHomeProjection<T> {
  const active = courses.filter((course) => !course.completed)
  return {
    primary: active[0] ?? null,
    active: active.slice(1),
    completed: courses.filter((course) => course.completed),
  }
}

export type CurriculumItemKind = "section" | "reference"
export type CurriculumItemState = "completed" | "current" | "available" | "locked"

export interface CurriculumStepSource {
  kind: CurriculumItemKind
  id: string
  title: string
  done: boolean
  available: boolean
  current: boolean
  locked: boolean
  lockReason: "drip" | "prerequisite" | null
  unlockAt: number | null
  routeSegment: string | null
}

export interface CurriculumJourneyItem extends CurriculumStepSource {
  state: CurriculumItemState
  href: string | null
  position: number
}

export function projectCurriculumJourney(
  steps: readonly CurriculumStepSource[],
  destinationFor: (step: CurriculumStepSource) => string | null,
): CurriculumJourneyItem[] {
  const declaredCurrent = steps.findIndex((step) => step.current && !step.done && !step.locked)
  const nextAvailable = steps.findIndex((step) => step.available && !step.done && !step.locked)
  const currentIndex = declaredCurrent >= 0 ? declaredCurrent : nextAvailable

  return steps.map((step, index) => {
    const state: CurriculumItemState = step.done
      ? "completed"
      : step.locked || !step.available
        ? "locked"
        : index === currentIndex
          ? "current"
          : "available"
    const reachable = !step.locked && (step.available || step.done)
    return {
      ...step,
      current: state === "current",
      state,
      href: reachable ? destinationFor(step) : null,
      position: index + 1,
    }
  })
}

export type StudyResourceKind = "download" | "external"

export interface StudyResource {
  key: string
  kind: StudyResourceKind
  label: string
  href: string
  size: number | null
  mime: string | null
  activityId?: string | null
  sectionId?: string
}

function isSafeDownloadUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2_048) return false
  if (value.startsWith("/") && !value.startsWith("//")) return true
  try {
    return new URL(value).protocol === "https:"
  } catch {
    return false
  }
}

function isSafeExternalUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2_048) return false
  try {
    return ["https:", "http:"].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

function textOf(node: ContentNode): string {
  return node.text ?? (node.content ?? []).map(textOf).join("")
}

// Only from the already-revealed document the host supplied.
export function extractStudyResources(doc: ParsedContentDocument): StudyResource[] {
  const resources: StudyResource[] = []
  const seen = new Set<string>()
  let sectionId = "section:0"

  const add = (resource: StudyResource) => {
    const identity = `${resource.kind}:${resource.href}`
    if (seen.has(identity)) return
    seen.add(identity)
    resources.push(resource)
  }

  const visit = (node: ContentNode, inheritedActivityId: string | null = null) => {
    const ownActivityId = learnerAnchorId(node)
    if (node.type === "heading" && ownActivityId) sectionId = ownActivityId
    const activityId = ownActivityId ?? inheritedActivityId
    if (node.type === "fileAttachment") {
      const href = node.attrs?.url
      if (isSafeDownloadUrl(href)) {
        const name =
          typeof node.attrs?.name === "string" && node.attrs.name.trim()
            ? node.attrs.name.trim()
            : "Download"
        add({
          key: `download:${href}`,
          kind: "download",
          label: name,
          href,
          size: typeof node.attrs?.size === "number" ? node.attrs.size : null,
          mime: typeof node.attrs?.mime === "string" ? node.attrs.mime : null,
          activityId,
          sectionId,
        })
      }
    }

    for (const mark of node.marks ?? []) {
      const href = mark.type === "link" ? mark.attrs?.href : null
      if (!isSafeExternalUrl(href)) continue
      add({
        key: `external:${href}`,
        kind: "external",
        label: textOf(node).trim() || new URL(href).hostname,
        href,
        size: null,
        mime: null,
        activityId,
        sectionId,
      })
    }

    for (const child of node.content ?? []) visit(child, activityId)
  }

  visit(doc)
  return resources
}
