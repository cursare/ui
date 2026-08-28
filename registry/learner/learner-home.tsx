import { themeVars } from "@/components/cursare/foundation/model/learner-runtime"
import { ContentCoverMedia, LearnerRoot } from "@/components/cursare/foundation/runtime"
import { Button } from "@/components/cursare/ui/button"
import { Progress, ProgressIndicator, ProgressTrack } from "@/components/cursare/ui/progress"
import { ArrowRight, Award, Check, Library } from "lucide-react"
import type { LearnerCourseProjection, LearnerHomeProjection } from "./study-projections"

export interface LearnerHomeMessages {
  resumeHeading: string
  activeHeading: string
  completedHeading: string
  continueLabel: string
  reviewLabel: string
  certificateLabel: string
  completedLabel: string
  progressLabel: (course: LearnerCourseProjection) => string
  emptyTitle: string
  emptyDescription: string
}

export interface LearnerHomeProps {
  projection: LearnerHomeProjection<LearnerCourseProjection>
  messages: LearnerHomeMessages
  emptyAction?: React.ReactNode
}

function CourseCover({
  course,
  priority = false,
}: {
  course: LearnerCourseProjection
  priority?: boolean
}) {
  return (
    <ContentCoverMedia
      src={course.coverImage}
      width={960}
      height={600}
      loading={priority ? "eager" : "lazy"}
      className="size-full"
    />
  )
}

function CourseProgress({ course, label }: { course: LearnerCourseProjection; label: string }) {
  return (
    <div className="learner-home-progress">
      <Progress value={course.percent} aria-label={label}>
        <ProgressTrack className="h-1.5">
          <ProgressIndicator />
        </ProgressTrack>
      </Progress>
      <span>{label}</span>
    </div>
  )
}

export function LearnerHome({ projection, messages, emptyAction }: LearnerHomeProps) {
  const { primary, active, completed } = projection
  if (!primary && completed.length === 0) {
    return (
      <LearnerRoot
        as="section"
        contractKey="blocks.learner-home"
        className="learner-home-empty"
        aria-labelledby="learner-home-empty-title"
      >
        <Library aria-hidden />
        <h2 id="learner-home-empty-title">{messages.emptyTitle}</h2>
        <p>{messages.emptyDescription}</p>
        {emptyAction}
      </LearnerRoot>
    )
  }

  return (
    <LearnerRoot contractKey="blocks.learner-home" className="learner-home-flow">
      {primary ? (
        <section aria-labelledby="learner-home-resume-title">
          <p className="learner-home-eyebrow">{messages.resumeHeading}</p>
          <article
            className="learner-home-primary"
            style={themeVars(primary.theme)}
            data-testid="learner-home-primary"
          >
            <div className="learner-home-primary-cover">
              <CourseCover course={primary} priority />
            </div>
            <div className="learner-home-primary-copy">
              <p>{primary.publisher}</p>
              <h2 id="learner-home-resume-title">{primary.title}</h2>
              {primary.description ? <p>{primary.description}</p> : null}
              <CourseProgress course={primary} label={messages.progressLabel(primary)} />
              <Button render={<a href={primary.resumeHref} />}>
                {messages.continueLabel} <ArrowRight />
              </Button>
            </div>
          </article>
        </section>
      ) : null}

      {active.length > 0 ? (
        <section aria-labelledby="learner-home-active-title">
          <h2 id="learner-home-active-title" className="learner-home-section-title">
            {messages.activeHeading}
          </h2>
          <div className="learner-home-active-list">
            {active.map((course) => (
              <article
                key={course.key}
                className="learner-home-active-course"
                style={themeVars(course.theme)}
              >
                <div className="learner-home-active-cover">
                  <CourseCover course={course} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="learner-home-course-publisher">{course.publisher}</p>
                  <h3>{course.title}</h3>
                  <CourseProgress course={course} label={messages.progressLabel(course)} />
                </div>
                <Button variant="outline" render={<a href={course.resumeHref} />}>
                  {messages.continueLabel}
                </Button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {completed.length > 0 ? (
        <section aria-labelledby="learner-home-completed-title">
          <h2 id="learner-home-completed-title" className="learner-home-section-title">
            {messages.completedHeading}
          </h2>
          <div className="learner-home-completed-list">
            {completed.map((course) => (
              <article key={course.key} className="learner-home-completed-course">
                <span className="learner-home-complete-mark">
                  <Check aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p>{messages.completedLabel}</p>
                  <h3>{course.title}</h3>
                  <span>{course.publisher}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" render={<a href={course.courseHomeHref} />}>
                    {messages.reviewLabel}
                  </Button>
                  {course.certificateHref ? (
                    <Button variant="outline" render={<a href={course.certificateHref} />}>
                      <Award /> {messages.certificateLabel}
                    </Button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </LearnerRoot>
  )
}
