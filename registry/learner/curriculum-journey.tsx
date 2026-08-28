import { LearnerRoot } from "@/components/cursare/foundation/runtime"
import { Check, Clock3, Lock, Play } from "lucide-react"
import type { CurriculumJourneyItem } from "./study-projections"

export interface CurriculumJourneyMessages {
  heading: string
  sectionKind: string
  referenceKind: string
  completed: string
  current: string
  available: string
  locked: string
  prerequisiteLock: string
  dripLock: string
}

export interface CurriculumJourneyProps {
  items: CurriculumJourneyItem[]
  messages: CurriculumJourneyMessages
  headingLevel?: 2 | 3
  compact?: boolean
  className?: string
}

export function CurriculumJourney({
  items,
  messages,
  headingLevel = 2,
  compact = false,
  className,
}: CurriculumJourneyProps) {
  const Heading = headingLevel === 3 ? "h3" : "h2"
  return (
    <LearnerRoot
      as="section"
      contractKey="blocks.curriculum-journey"
      className={`learner-journey ${compact ? "learner-journey-compact" : ""} ${className ?? ""}`}
      aria-labelledby="learner-journey-title"
    >
      <Heading id="learner-journey-title" className="learner-journey-title">
        {messages.heading}
      </Heading>
      <ol className="learner-journey-list" data-learner-effect="trace">
        {items.map((item) => {
          const stateLabel = messages[item.state]
          const lockLabel =
            item.lockReason === "drip" ? messages.dripLock : messages.prerequisiteLock
          const icon = item.done ? (
            <Check aria-hidden />
          ) : item.state === "locked" ? (
            <Lock aria-hidden />
          ) : item.state === "current" ? (
            <Play aria-hidden />
          ) : (
            <Clock3 aria-hidden />
          )
          const content = (
            <>
              <span className="learner-journey-icon">{icon}</span>
              <span className="learner-journey-copy">
                <span className="learner-journey-name">{item.title}</span>
                <span className="learner-journey-meta">
                  {item.kind === "reference" ? messages.referenceKind : messages.sectionKind}
                  <span aria-hidden> · </span>
                  <span>{stateLabel}</span>
                  {item.state === "locked" ? (
                    <>
                      <span aria-hidden> · </span>
                      <span>{lockLabel}</span>
                    </>
                  ) : null}
                </span>
              </span>
            </>
          )
          return (
            <li key={`${item.kind}:${item.id}`} data-journey-state={item.state}>
              {item.href ? (
                <a
                  href={item.href}
                  className="learner-journey-item learner-journey-link"
                  aria-current={item.current ? "step" : undefined}
                >
                  {content}
                </a>
              ) : (
                <div
                  className="learner-journey-item"
                  aria-current={item.current ? "step" : undefined}
                >
                  {content}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </LearnerRoot>
  )
}
