"use client"

import {
  type ContentImageAttribution,
  type ContentImageFocalPoint,
  themeVars,
} from "@/components/cursare/foundation/model/learner-runtime"
import { LearnerRoot } from "@/components/cursare/foundation/runtime"
import type { ReactNode } from "react"
import { CourseHero } from "./course-hero"
import { compactCourseChildTitle } from "./course-labels"

export interface CourseShellProps {
  contentTitle: string
  referenceTitle?: string | null
  description?: string | null
  heroSrc: string | null
  heroAttribution?: ContentImageAttribution | null
  heroFocalPoint?: ContentImageFocalPoint | null
  heroPhotoByLabel?: string
  heroPhotoOnLabel?: string
  hero?: ReactNode
  theme?: string | null
  sidebar: ReactNode
  children: ReactNode
  focusMode?: boolean
  contextualTool?: ReactNode
  contextualToolLabel?: string
  showCourseContext?: boolean
}

// White-label learning shell; the host supplies copy, navigation and content.
export function CourseShell({
  contentTitle,
  referenceTitle,
  description,
  heroSrc,
  heroAttribution,
  heroFocalPoint,
  heroPhotoByLabel,
  heroPhotoOnLabel,
  hero,
  theme,
  sidebar,
  children,
  focusMode = false,
  contextualTool,
  contextualToolLabel = "Study tool",
  showCourseContext = true,
}: CourseShellProps) {
  const displayModuleTitle = referenceTitle
    ? compactCourseChildTitle(contentTitle, referenceTitle)
    : contentTitle
  const showsCourseContext = Boolean(
    showCourseContext &&
      referenceTitle &&
      referenceTitle.trim().toLowerCase() !== contentTitle.trim().toLowerCase(),
  )
  const cover = hero ?? (
    <CourseHero
      src={heroSrc}
      compact
      attribution={heroAttribution}
      focalPoint={heroFocalPoint}
      photoByLabel={heroPhotoByLabel}
      onLabel={heroPhotoOnLabel}
    />
  )

  return (
    <LearnerRoot
      contractKey="blocks.course-shell"
      className="content-hero-page content-hero-page-enrolled learner-course-shell"
      data-focus-mode={focusMode}
      data-testid="learner-course"
      style={themeVars(theme)}
    >
      {focusMode ? null : (
        <div data-slot="course-cover" className="w-full">
          {cover}
        </div>
      )}

      <main id="main-content" className="min-h-dvh w-full max-w-none">
        <div
          data-slot="course-study-surfaces"
          data-contextual-tool={contextualTool ? "open" : undefined}
          className={
            focusMode
              ? "mx-auto w-full max-w-4xl"
              : contextualTool
                ? "lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] 2xl:grid-cols-[16rem_minmax(0,1fr)_22rem]"
                : "lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]"
          }
        >
          {focusMode ? null : (
            <div data-slot="content-outline" className="min-w-0 lg:min-h-dvh">
              {sidebar}
            </div>
          )}
          <div
            className="learner-course-content mx-auto min-w-0 w-full max-w-[calc(var(--learner-measure-prose)+2*var(--learner-page-gutter))] px-[var(--learner-page-gutter)] pt-16 pb-12 md:pb-14 lg:pt-7"
            data-slot="course-reader"
          >
            <header className="learner-course-intro mb-[clamp(1rem,1.5vw,1.5rem)]">
              {showsCourseContext ? (
                <p className="mb-2 font-medium text-muted-foreground text-sm leading-5">
                  {contentTitle}
                </p>
              ) : null}
              <h1 className="max-w-3xl text-balance font-heading font-semibold text-4xl tracking-[-0.04em] sm:text-5xl">
                {displayModuleTitle}
              </h1>
              {description ? (
                <p className="mt-3 max-w-2xl text-pretty text-base text-muted-foreground leading-relaxed sm:text-lg">
                  {description}
                </p>
              ) : null}
            </header>
            {children}
          </div>
          {focusMode || !contextualTool ? null : (
            <aside data-slot="course-contextual-tool" aria-label={contextualToolLabel}>
              {contextualTool}
            </aside>
          )}
        </div>
      </main>
    </LearnerRoot>
  )
}
