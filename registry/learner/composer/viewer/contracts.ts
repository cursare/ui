import type { ReactNode } from "react"

export interface PollOption {
  id: string
  text: string
}

import type { QuizOption, QuizQuestion } from "@/components/cursare/foundation/model"

export type QuestionOption = QuizOption
export type PoolQuestion = QuizQuestion

export interface PracticeFraming {
  title: string
  description?: ReactNode
}

export function readPracticeFraming(
  attrs: { title?: unknown; description?: unknown },
  fallbackTitle: string,
): PracticeFraming {
  return {
    title: String(attrs.title ?? "").trim() || fallbackTitle,
    description:
      typeof attrs.description === "string" ? attrs.description.trim() || undefined : undefined,
  }
}

export interface PollResults {
  counts: Record<string, number>
  total: number
  mine: string | null
}

export type PollVote = (pollId: string, optionId: string) => Promise<PollResults | null>
export type PollLoad = (pollId: string) => Promise<PollResults | null>

export type QuizAnswers = Record<string, string>

export interface QuizQuestionResult {
  questionId: string
  correct: boolean
  correctOptionId: string | null
}

export interface QuizResult {
  results: QuizQuestionResult[]
  score: number
  total: number
  persisted?: boolean
}

export function isUsableQuizResult(result: QuizResult): boolean {
  return result.total > 0 && result.persisted !== false
}

export type QuizGrade = (answers: QuizAnswers) => Promise<QuizResult>

export interface SavedQuiz {
  score: number
  total: number
  answers?: Record<string, string>
}

export type LearnerActivity =
  | {
      type: "quiz_started" | "resource_downloaded"
      activityId: string
      sectionId: string
    }
  | {
      type: "video_started" | "video_completed"
      activityId: string
      sectionId: string
    }
  | {
      type: "video_progress"
      activityId: string
      sectionId: string
      percent: 25 | 50 | 75
    }

export type LearnerActivityReport = (activity: LearnerActivity) => void

export interface ReferenceOption {
  id: string
  title: string
  routeSegment: string
}

export type ReferenceSearch = (query: string) => Promise<ReferenceOption[]>

export interface VideoPlaybackCapabilities {
  playPause: boolean
  currentTime: boolean
  seek: boolean
  duration: boolean
  playbackRate: boolean
  quality: boolean
  fullscreen: boolean
  pictureInPicture: boolean
  events: {
    readiness: boolean
    ended: boolean
  }
}

export interface VideoPlaybackHandle {
  capabilities: () => VideoPlaybackCapabilities
  currentTime: () => Promise<number | null>
  seek: (seconds: number) => Promise<boolean>
  destroy?: () => void
  ready?: () => void
}

export interface VideoPlaybackService {
  register: (anchorId: string, handle: VideoPlaybackHandle) => () => void
  currentTime: (anchorId: string) => Promise<number | null>
  seek: (anchorId: string, seconds: number) => Promise<boolean>
}

export function createVideoPlaybackService(): VideoPlaybackService {
  const handles = new Map<string, VideoPlaybackHandle>()
  return {
    register(anchorId, handle) {
      handles.get(anchorId)?.destroy?.()
      handles.set(anchorId, handle)
      return () => {
        if (handles.get(anchorId) === handle) handles.delete(anchorId)
        handle.destroy?.()
      }
    },
    async currentTime(anchorId) {
      const value = await handles.get(anchorId)?.currentTime()
      return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null
    },
    async seek(anchorId, seconds) {
      if (!Number.isFinite(seconds) || seconds < 0) return false
      return (await handles.get(anchorId)?.seek(seconds)) ?? false
    },
  }
}
