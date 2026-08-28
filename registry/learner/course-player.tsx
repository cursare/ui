"use client"

import { type ParsedContentDocument, themeVars } from "@/components/cursare/foundation/model/learner-runtime"
import {
  ContentReader,
  type EditorMessages,
  type LearnerActivityReport,
  type LearnerNotesBridge,
  type PollLoad,
  type PollVote,
  type QuizGrade,
  type SavedQuiz,
} from "@/components/cursare/composer/reader"
import { LearnerRoot } from "@/components/cursare/foundation/runtime"

export interface CoursePlayerProps {
  content: ParsedContentDocument
  savedQuiz?: SavedQuiz | null
  basePath: string
  referenceNavigationEnabled?: boolean
  completedKeys?: string[]
  unavailableKeys?: string[]
  theme?: string | null
  hideHeader?: boolean
  className?: string
  messages?: EditorMessages
  onGradeQuiz?: QuizGrade
  onPollVote?: PollVote
  onPollLoad?: PollLoad
  learnerNotes?: LearnerNotesBridge
  onLearnerActivity?: LearnerActivityReport
}

// The host injects every side effect, so this block knows nothing about sessions,
// routes or persistence.
export function CoursePlayer({
  content,
  savedQuiz,
  basePath,
  referenceNavigationEnabled = true,
  completedKeys,
  unavailableKeys,
  theme,
  hideHeader = false,
  className,
  messages,
  onGradeQuiz,
  onPollVote,
  onPollLoad,
  learnerNotes,
  onLearnerActivity,
}: CoursePlayerProps) {
  const readerClass = hideHeader ? "learner-reader learner-reader-with-shell" : "learner-reader"

  return (
    <LearnerRoot
      contractKey="blocks.course-player"
      className={className ? `${readerClass} ${className}` : readerClass}
      style={themeVars(theme)}
    >
      <ContentReader
        content={content}
        onGradeQuiz={onGradeQuiz}
        savedQuiz={savedQuiz}
        referenceBase={basePath}
        referenceNavigationEnabled={referenceNavigationEnabled}
        completedReferenceKeys={completedKeys}
        unavailableReferenceKeys={unavailableKeys}
        onPollVote={onPollVote}
        onPollLoad={onPollLoad}
        messages={messages}
        learnerNotes={learnerNotes}
        onLearnerActivity={onLearnerActivity}
      />
    </LearnerRoot>
  )
}
