import type {
  ContentImageFocalPoint,
  ContentImageAttribution as CoverAttribution,
} from "@/components/cursare/foundation/model"
import { ContentCoverAttribution, ContentCoverMedia, LearnerRoot } from "@/components/cursare/foundation/runtime"
import type { CSSProperties } from "react"

export function CourseHero({
  src,
  compact = false,
  fade = true,
  attribution,
  focalPoint,
  photoByLabel,
  onLabel,
}: {
  src: string | null
  compact?: boolean
  fade?: boolean
  attribution?: CoverAttribution | null
  focalPoint?: ContentImageFocalPoint | null
  photoByLabel?: string
  onLabel?: string
}) {
  // The authored focal point steers the crop; without one the media centers.
  const focalStyle = focalPoint
    ? ({
        "--learner-cover-focal-x": `${Math.round(focalPoint.x * 100)}%`,
        "--learner-cover-focal-y": `${Math.round(focalPoint.y * 100)}%`,
      } as CSSProperties)
    : undefined
  return (
    <LearnerRoot
      aria-hidden={attribution ? undefined : true}
      contractKey="blocks.course-hero"
      data-learner-edge="page-start"
      style={focalStyle}
      className={`course-cover-signature relative w-full overflow-hidden ${
        compact ? "h-[clamp(104px,16vh,168px)]" : "h-[clamp(210px,32vh,360px)]"
      }`}
    >
      <ContentCoverMedia src={src} className="size-full" />
      {attribution ? (
        <ContentCoverAttribution {...attribution} photoByLabel={photoByLabel} onLabel={onLabel} />
      ) : null}
      <div className="course-cover-theme pointer-events-none absolute inset-0" />
      {fade ? (
        <div
          className={`course-cover-fade pointer-events-none absolute inset-x-0 bottom-0 ${
            compact ? "h-16" : "h-28"
          }`}
        />
      ) : null}
    </LearnerRoot>
  )
}
