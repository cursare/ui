"use client"

import {
  type LearnerAnchor,
  learnerAnchors,
  type ParsedContentDocument,
} from "@/components/cursare/foundation/model"
import {
  createVideoPlaybackService,
  type EditorMessages,
  type LearnerActivityReport,
  LearnerButton,
  type PollLoad,
  type PollVote,
  type QuizGrade,
  type ReferenceSearch,
  type SavedQuiz,
} from "@/components/cursare/composer/viewer"
import { MessageSquarePlus } from "lucide-react"
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { DirectDocumentRenderer, type DirectReaderServices } from "./document-renderer"
import { learnerAnchorDomTargets } from "./learner-note-dom"

export interface LearnerNoteAnchorContext {
  anchorId: string
  blockType: string
  label: string
  sectionId: string | null
  sectionLabel: string | null
  noteCount: number
}

export interface LearnerNoteCreationRequest extends LearnerNoteAnchorContext {
  videoSeconds: number | null
}

export interface LearnerNoteNavigationTarget {
  key: string
  anchorId: string
  videoSeconds?: number | null
}

export interface LearnerNotesBridge {
  counts?: Readonly<Record<string, number>>
  createLabel: (context: LearnerNoteAnchorContext) => string
  countLabel: (count: number, context: LearnerNoteAnchorContext) => string
  onCreateRequest: (request: LearnerNoteCreationRequest) => void
  onActiveAnchorChange?: (context: LearnerNoteAnchorContext | null) => void
  navigationTarget?: LearnerNoteNavigationTarget | null
  onNavigationComplete?: (target: LearnerNoteNavigationTarget, found: boolean) => void
  setPlaybackTimeResolver?: (
    resolver: ((anchorId: string) => Promise<number | null>) | null,
  ) => void
}

interface AnchorPlacement {
  context: LearnerNoteAnchorContext
  top: number
}

export interface ContentReaderProps {
  content: ParsedContentDocument
  referenceProvider?: ReferenceSearch
  referenceBase?: string | null
  referenceNavigationEnabled?: boolean
  completedReferenceKeys?: string[]
  unavailableReferenceKeys?: string[]
  onGradeQuiz?: QuizGrade
  savedQuiz?: SavedQuiz | null
  onPollVote?: PollVote
  onPollLoad?: PollLoad
  messages?: EditorMessages
  learnerNotes?: LearnerNotesBridge
  onLearnerActivity?: LearnerActivityReport
}

export function ContentReader({
  content,
  referenceProvider,
  referenceBase,
  referenceNavigationEnabled,
  completedReferenceKeys,
  unavailableReferenceKeys,
  onGradeQuiz,
  savedQuiz,
  onPollVote,
  onPollLoad,
  messages,
  learnerNotes,
  onLearnerActivity,
}: ContentReaderProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const actionRefs = useRef(new Map<string, HTMLButtonElement>())
  const [placements, setPlacements] = useState<AnchorPlacement[]>([])
  const anchors = useMemo(() => learnerAnchors(content), [content])
  const playback = useMemo(createVideoPlaybackService, [])
  const sectionByAnchor = useMemo(
    () => new Map(anchors.map((anchor) => [anchor.id, anchor.sectionId])),
    [anchors],
  )
  const services = useMemo<DirectReaderServices>(
    () => ({
      messages,
      referenceProvider,
      referenceBase,
      referenceNavigationEnabled,
      completedReferenceKeys,
      unavailableReferenceKeys,
      onGradeQuiz,
      savedQuiz,
      onPollVote,
      onPollLoad,
      onLearnerActivity,
      playback,
      sectionByAnchor,
    }),
    [
      completedReferenceKeys,
      messages,
      onGradeQuiz,
      onLearnerActivity,
      onPollLoad,
      onPollVote,
      playback,
      referenceBase,
      referenceNavigationEnabled,
      referenceProvider,
      savedQuiz,
      sectionByAnchor,
      unavailableReferenceKeys,
    ],
  )

  useEffect(() => {
    if (!learnerNotes?.setPlaybackTimeResolver) return
    learnerNotes.setPlaybackTimeResolver((anchorId) => playback.currentTime(anchorId))
    return () => learnerNotes.setPlaybackTimeResolver?.(null)
  }, [learnerNotes?.setPlaybackTimeResolver, playback])

  const contextFor = useCallback(
    (anchor: LearnerAnchor): LearnerNoteAnchorContext => ({
      anchorId: anchor.id,
      blockType: anchor.nodeType,
      label: anchor.label,
      sectionId: anchor.sectionId,
      sectionLabel: anchor.sectionLabel,
      noteCount: learnerNotes?.counts?.[anchor.id] ?? 0,
    }),
    [learnerNotes?.counts],
  )

  useLayoutEffect(() => {
    if (!learnerNotes || !rootRef.current) {
      setPlacements([])
      return
    }
    const root = rootRef.current
    let frame = 0
    const measure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const rootRect = root.getBoundingClientRect()
        const next = learnerAnchorDomTargets(root, anchors).map(({ anchor, element }) => {
          const rect = element.getBoundingClientRect()
          return {
            context: contextFor(anchor),
            top: rect.top - rootRect.top + Math.min(8, Math.max(0, rect.height / 2 - 16)),
          }
        })
        setPlacements(next)
      })
    }
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    for (const { element } of learnerAnchorDomTargets(root, anchors)) observer.observe(element)
    window.addEventListener("resize", measure)
    measure()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [anchors, contextFor, learnerNotes])

  useEffect(() => {
    if (!learnerNotes?.onActiveAnchorChange || !rootRef.current || placements.length === 0) return
    const root = rootRef.current
    let frame = 0
    let lastId: string | null = null
    const report = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const threshold = 128
        const targets = learnerAnchorDomTargets(root, anchors)
        const current =
          [...targets]
            .reverse()
            .find(({ element }) => element.getBoundingClientRect().top <= threshold) ?? targets[0]
        const id = current?.anchor.id ?? null
        if (id === lastId) return
        lastId = id
        learnerNotes.onActiveAnchorChange?.(current ? contextFor(current.anchor) : null)
      })
    }
    document.addEventListener("scroll", report, { passive: true, capture: true })
    report()
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener("scroll", report, { capture: true })
    }
  }, [anchors, contextFor, learnerNotes, placements.length])

  useEffect(() => {
    const target = learnerNotes?.navigationTarget
    const root = rootRef.current
    if (!target || !root) return
    let cancelled = false
    let frame = 0
    let attempts = 0
    const locate = () => {
      if (cancelled) return
      const match = learnerAnchorDomTargets(root, anchors).find(
        ({ anchor }) => anchor.id === target.anchorId,
      )
      if (!match && attempts < 30) {
        attempts += 1
        frame = requestAnimationFrame(locate)
        return
      }
      if (!match) {
        learnerNotes.onNavigationComplete?.(target, false)
        return
      }
      match.element.scrollIntoView({ behavior: "smooth", block: "center" })
      const complete = async () => {
        if (typeof target.videoSeconds === "number") {
          await playback.seek(target.anchorId, target.videoSeconds)
        }
        window.setTimeout(() => {
          if (cancelled) return
          actionRefs.current.get(target.anchorId)?.focus({ preventScroll: true })
          learnerNotes.onNavigationComplete?.(target, true)
        }, 320)
      }
      void complete()
    }
    locate()
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [anchors, learnerNotes?.navigationTarget, learnerNotes?.onNavigationComplete, playback])

  const createNote = async (context: LearnerNoteAnchorContext) => {
    const videoSeconds =
      context.blockType === "video" ? await playback.currentTime(context.anchorId) : null
    learnerNotes?.onCreateRequest({ ...context, videoSeconds })
  }

  return (
    <div
      ref={rootRef}
      className="content-editor"
      data-mode="reader"
      data-learner-notes={learnerNotes ? "enabled" : undefined}
    >
      <DirectDocumentRenderer document={content} services={services} />
      {learnerNotes ? (
        <div className="content-note-actions" aria-hidden="false">
          {placements.map(({ context, top }) => {
            const countLabel = learnerNotes.countLabel(context.noteCount, context)
            const createLabel = learnerNotes.createLabel(context)
            return (
              <LearnerButton
                key={context.anchorId}
                ref={(element) => {
                  if (element) actionRefs.current.set(context.anchorId, element)
                  else actionRefs.current.delete(context.anchorId)
                }}
                type="button"
                variant="ghost"
                className="content-note-action"
                data-learner-effect="focus"
                data-has-notes={context.noteCount > 0 ? "true" : undefined}
                style={
                  {
                    "--learner-note-top": `${top}px`,
                  } as CSSProperties
                }
                aria-label={context.noteCount > 0 ? `${createLabel}. ${countLabel}` : createLabel}
                title={createLabel}
                onClick={() => void createNote(context)}
              >
                <MessageSquarePlus aria-hidden="true" />
                {context.noteCount > 0 ? (
                  <span className="content-note-count" aria-hidden="true">
                    {context.noteCount > 99 ? "99+" : context.noteCount}
                  </span>
                ) : null}
              </LearnerButton>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
