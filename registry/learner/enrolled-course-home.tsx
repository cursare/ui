import { themeVars } from "@/components/cursare/foundation/model"
import { ContentCoverMedia, LearnerRoot } from "@/components/cursare/foundation/runtime"
import { Progress, ProgressIndicator, ProgressTrack } from "@/components/cursare/ui/progress"
import type { ReactNode } from "react"
import { CurriculumJourney, type CurriculumJourneyMessages } from "./curriculum-journey"
import type { CurriculumJourneyItem } from "./study-projections"

export interface EnrolledCourseHomeProps {
  title: string
  publisher: string
  description: string | null
  coverImage: string | null
  theme?: string | null
  done: number
  total: number
  percent: number
  progressLabel: string
  orientationLabel: string
  journey: CurriculumJourneyItem[]
  journeyMessages: CurriculumJourneyMessages
  primaryAction: ReactNode
  secondaryActions?: ReactNode
  cohortContext?: ReactNode
}

export function EnrolledCourseHome({
  title,
  publisher,
  description,
  coverImage,
  theme,
  done,
  total,
  percent,
  progressLabel,
  orientationLabel,
  journey,
  journeyMessages,
  primaryAction,
  secondaryActions,
  cohortContext,
}: EnrolledCourseHomeProps) {
  return (
    <LearnerRoot
      as="main"
      contractKey="blocks.enrolled-course-home"
      id="main-content"
      className="learner-course-home"
      style={themeVars(theme)}
      data-testid="learner-course-home"
    >
      <section
        className="learner-course-home-hero"
        data-learner-effect="reveal"
        aria-labelledby="learner-course-home-title"
      >
        <div className="learner-course-home-cover">
          <ContentCoverMedia
            src={coverImage}
            width={1200}
            height={750}
            loading="eager"
            className="size-full"
          />
        </div>
        <div className="learner-course-home-copy">
          <p className="learner-home-eyebrow">{orientationLabel}</p>
          <p className="learner-course-home-publisher">{publisher}</p>
          <h1 id="learner-course-home-title">{title}</h1>
          {description ? <p className="learner-course-home-description">{description}</p> : null}
          <div className="learner-course-home-progress">
            <div>
              <span>{progressLabel}</span>
              <span>
                {done}/{total}
              </span>
            </div>
            <Progress value={percent} aria-label={progressLabel}>
              <ProgressTrack>
                <ProgressIndicator />
              </ProgressTrack>
            </Progress>
          </div>
          <div className="learner-course-home-actions">
            <div className="learner-course-home-primary-action">{primaryAction}</div>
            {secondaryActions ? (
              <div className="learner-course-home-secondary-actions">{secondaryActions}</div>
            ) : null}
          </div>
        </div>
      </section>

      <div className="learner-course-home-grid">
        <CurriculumJourney items={journey} messages={journeyMessages} />
        {cohortContext ? (
          <aside className="learner-course-home-cohort">{cohortContext}</aside>
        ) : null}
      </div>
    </LearnerRoot>
  )
}
