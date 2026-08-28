"use client"

import { LearnerRoot } from "@/components/cursare/foundation/runtime"
import { Button } from "@/components/cursare/ui/button"
import { Checkbox } from "@/components/cursare/ui/checkbox"
import {
  Sheet,
  SheetFooter,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
} from "@/components/cursare/ui/sheet"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
} from "@/components/cursare/ui/sidebar"
import { cn } from "@/lib/utils"
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Lock,
  Play,
  Target,
} from "lucide-react"
import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { compactCourseChildTitle } from "./course-labels"
import type { CurriculumJourneyItem, CurriculumStepSource } from "./study-projections"

export interface CourseOutlineMessages {
  heading: string
  close: string
  currentStep: string
  showAllSteps: string
  showFewerSteps: string
  inThisModule: string
  needsReview: string
  lastQuiz: string
  lessonKind: string
  moduleKind: string
  completedState: string
  lockedState: string
  currentState: string
  availableState: string
  prerequisiteShort: string
  prerequisiteLock: string
  unlocksSoon: string
  unlocksIn: (remaining: string) => string
  markComplete: (title: string) => string
  markIncomplete: (title: string) => string
  goToStep: (title: string) => string
}

export const COURSE_OUTLINE_OPEN_EVENT = "cursare:course-outline-open"

const COURSE_OUTLINE_ROW_CLASS =
  "grid min-h-11 grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-1 rounded-lg px-1 py-1.5 text-sm"

export interface CourseOutlineReviewHint {
  key: string
  title: string
  score: number
  total: number
  href: string
}

export interface CourseOutlineProps {
  rootTitle: string
  rootItems: CurriculumJourneyItem[]
  viewedItems?: CurriculumJourneyItem[] | null
  referenceTitle?: string | null
  activeRootSlug?: string | null
  activeSectionId?: string | null
  rootCompleted?: boolean
  pending?: boolean
  error?: string | null
  reviewHints?: CourseOutlineReviewHint[]
  lastQuizScore?: { score: number; total: number } | null
  messages: CourseOutlineMessages
  footer?: ReactNode
  onToggleCompletion: (scope: "root" | "viewed", sectionId: string, completed: boolean) => void
  onOpenSection: (sectionId: string, options: { closeMobile: boolean }) => void
}

export function CourseOutline({
  rootTitle,
  rootItems,
  viewedItems = null,
  referenceTitle,
  activeRootSlug = null,
  activeSectionId = null,
  pending = false,
  error = null,
  reviewHints = [],
  lastQuizScore = null,
  messages,
  footer,
  onToggleCompletion,
  onOpenSection,
}: CourseOutlineProps) {
  const [expanded, setExpanded] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const nested = viewedItems !== null
  const doneCount = rootItems.filter((item) => item.done).length
  const currentRootIndex = resolveCurrentIndex(rootItems, activeRootSlug, activeSectionId)
  const windowStart = Math.max(0, Math.min(currentRootIndex - 1, rootItems.length - 5))
  const visibleRootItems =
    expanded || rootItems.length <= 5 ? rootItems : rootItems.slice(windowStart, windowStart + 5)
  const currentRootItem = rootItems[currentRootIndex] ?? null
  const inlineCompletion = resolveInlineCompletion(currentRootItem, viewedItems, referenceTitle)
  const nestedModuleTitle = resolveNestedModuleTitle(referenceTitle, currentRootItem)

  useEffect(() => {
    const openOutline = () => setMobileOpen(true)
    window.addEventListener(COURSE_OUTLINE_OPEN_EVENT, openOutline)
    return () => window.removeEventListener(COURSE_OUTLINE_OPEN_EVENT, openOutline)
  }, [])

  const openSection = (sectionId: string) => {
    const closeMobile = mobileOpen
    if (closeMobile) setMobileOpen(false)
    onOpenSection(sectionId, { closeMobile })
  }

  const body = (
    <div className="space-y-2">
      <div className="flex h-8 items-center justify-between gap-3 px-2">
        <p className="font-medium text-sidebar-foreground text-xs">{messages.heading}</p>
        <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
          {doneCount}/{rootItems.length}
        </span>
      </div>

      <CourseOutlineStepList
        items={visibleRootItems}
        parentTitle={rootTitle}
        pending={pending}
        activeSlug={nested ? activeRootSlug : null}
        activeSectionId={nested ? null : activeSectionId}
        messages={messages}
        onToggle={(id, checked) => onToggleCompletion("root", id, checked)}
        onOpen={openSection}
        inlineCompletion={inlineCompletion}
        onToggleInline={(id, checked) => onToggleCompletion("viewed", id, checked)}
      />

      {rootItems.length > 5 ? (
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? <ChevronUp /> : <ChevronDown />}
          {expanded ? messages.showFewerSteps : messages.showAllSteps}
        </Button>
      ) : null}

      {nested && viewedItems && !inlineCompletion ? (
        <div className="border-sidebar-border border-t pt-2">
          <p className="flex h-8 items-center px-2 font-medium text-muted-foreground text-xs">
            {messages.inThisModule}
          </p>
          {nestedModuleTitle ? (
            <p className="mb-1 truncate px-2 font-medium text-sm">{nestedModuleTitle}</p>
          ) : null}
          <CourseOutlineStepList
            items={viewedItems}
            pending={pending}
            activeSlug={null}
            activeSectionId={activeSectionId}
            messages={messages}
            onToggle={(id, checked) => onToggleCompletion("viewed", id, checked)}
            onOpen={openSection}
          />
        </div>
      ) : null}

      {reviewHints.length > 0 || lastQuizScore ? (
        <div className="border-sidebar-border border-t pt-2">
          <p className="flex h-8 items-center px-2 font-medium text-muted-foreground text-xs">
            {messages.needsReview}
          </p>
          <ul className="flex flex-col gap-1">
            {reviewHints.map((hint) => (
              <li key={hint.key} className={COURSE_OUTLINE_ROW_CLASS}>
                <Target className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <a
                  href={hint.href}
                  className="flex min-w-0 items-center break-words leading-5 underline-offset-4 hover:underline"
                >
                  {compactCourseChildTitle(rootTitle, hint.title)}
                </a>
                <span className="flex h-5 shrink-0 items-center text-muted-foreground text-xs">
                  {hint.score}/{hint.total}
                </span>
              </li>
            ))}
            {lastQuizScore ? (
              <li className={COURSE_OUTLINE_ROW_CLASS}>
                <ClipboardList className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate text-muted-foreground">{messages.lastQuiz}</span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {lastQuizScore.score}/{lastQuizScore.total}
                </span>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {error ? (
        <p className="px-2 text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )

  const desktopBody = (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <CourseOutlineSidebarStepList
            items={visibleRootItems}
            parentTitle={rootTitle}
            pending={pending}
            activeSlug={nested ? activeRootSlug : null}
            activeSectionId={nested ? null : activeSectionId}
            messages={messages}
            onToggle={(id, checked) => onToggleCompletion("root", id, checked)}
            onOpen={openSection}
            inlineCompletion={inlineCompletion}
            onToggleInline={(id, checked) => onToggleCompletion("viewed", id, checked)}
            nestedItems={nested && viewedItems && !inlineCompletion ? viewedItems : null}
            nestedParentId={currentRootItem?.id ?? null}
            nestedActiveSectionId={activeSectionId}
            onToggleNested={(id, checked) => onToggleCompletion("viewed", id, checked)}
          />
          {rootItems.length > 5 ? (
            <SidebarMenu className="mt-1">
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="h-auto min-h-11 py-2 text-muted-foreground"
                  onClick={() => setExpanded((value) => !value)}
                >
                  {expanded ? <ChevronUp /> : <ChevronDown />}
                  <span>{expanded ? messages.showFewerSteps : messages.showAllSteps}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          ) : null}
        </SidebarGroupContent>
      </SidebarGroup>

      {reviewHints.length > 0 || lastQuizScore ? (
        <SidebarGroup className="border-sidebar-border border-t">
          <SidebarGroupLabel>{messages.needsReview}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {reviewHints.map((hint) => (
                <SidebarMenuItem key={hint.key}>
                  <SidebarMenuButton
                    render={<a href={hint.href} />}
                    className="h-auto min-h-11 py-2 pr-10"
                  >
                    <Target aria-hidden />
                    <span>{compactCourseChildTitle(rootTitle, hint.title)}</span>
                  </SidebarMenuButton>
                  <SidebarMenuBadge>
                    {hint.score}/{hint.total}
                  </SidebarMenuBadge>
                </SidebarMenuItem>
              ))}
              {lastQuizScore ? (
                <SidebarMenuItem>
                  <div className="flex h-8 items-center gap-2 px-2 text-muted-foreground text-sm">
                    <ClipboardList className="size-4 shrink-0" aria-hidden />
                    <span className="truncate">{messages.lastQuiz}</span>
                  </div>
                  <SidebarMenuBadge className="top-1.5">
                    {lastQuizScore.score}/{lastQuizScore.total}
                  </SidebarMenuBadge>
                </SidebarMenuItem>
              ) : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ) : null}

      {error ? (
        <SidebarGroup className="border-sidebar-border border-t">
          <SidebarGroupContent>
            <p className="px-2 py-1 text-destructive text-xs" role="alert">
              {error}
            </p>
          </SidebarGroupContent>
        </SidebarGroup>
      ) : null}
    </>
  )

  const desktopFooter = footer ? (
    <SidebarFooter className="mt-auto shrink-0 border-sidebar-border border-t pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {footer}
    </SidebarFooter>
  ) : null

  const desktopHeader = (
    <SidebarHeader className="border-sidebar-border border-b">
      <div className="flex h-8 items-center justify-between gap-3 px-2 font-medium text-xs">
        <span>{messages.heading}</span>
        <span className="shrink-0 text-muted-foreground tabular-nums">
          {doneCount}/{rootItems.length}
        </span>
      </div>
    </SidebarHeader>
  )

  return (
    <LearnerRoot
      as="aside"
      contractKey="blocks.course-outline"
      className="learner-course-sidebar sticky top-0 z-20 mb-8 py-2 lg:z-auto lg:mb-0 lg:h-dvh lg:py-0"
    >
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetPopup
          side="bottom"
          className="max-h-[82dvh] rounded-t-2xl border-t-0"
          closeProps={{ "aria-label": messages.close }}
        >
          <SheetHeader>
            <SheetTitle className="pr-8 text-lg">{messages.heading}</SheetTitle>
            <p className="break-words text-muted-foreground text-sm">{rootTitle}</p>
          </SheetHeader>
          <SheetPanel data-testid="learner-mobile-outline">
            <nav aria-label={messages.heading}>{body}</nav>
          </SheetPanel>
          {footer ? (
            <SheetFooter
              variant="bare"
              className="shrink-0 flex-col border-sidebar-border border-t px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:justify-start"
              data-testid="learner-mobile-outline-footer"
            >
              <SidebarProvider className="min-h-0 w-full [--sidebar-width:100%]">
                <div className="w-full">{footer}</div>
              </SidebarProvider>
            </SheetFooter>
          ) : null}
        </SheetPopup>
      </Sheet>
      <SidebarProvider className="hidden h-full min-h-0 w-full [--sidebar-width:100%] lg:flex">
        <Sidebar
          collapsible="none"
          className="h-full w-full border-sidebar-border border-r bg-sidebar text-sidebar-foreground"
        >
          <nav className="flex min-h-0 flex-1 flex-col" aria-label={messages.heading}>
            {desktopHeader}
            <SidebarContent>{desktopBody}</SidebarContent>
            {desktopFooter}
          </nav>
        </Sidebar>
      </SidebarProvider>
    </LearnerRoot>
  )
}

interface InlineCompletion {
  referenceId: string
  item: CurriculumStepSource
}

function CourseOutlineStepList({
  items,
  parentTitle,
  pending,
  activeSlug,
  activeSectionId,
  messages,
  onToggle,
  onOpen,
  inlineCompletion = null,
  onToggleInline,
}: {
  items: CurriculumJourneyItem[]
  parentTitle?: string
  pending: boolean
  activeSlug: string | null
  activeSectionId: string | null
  messages: CourseOutlineMessages
  onToggle: (sectionId: string, completed: boolean) => void
  onOpen: (sectionId: string) => void
  inlineCompletion?: InlineCompletion | null
  onToggleInline?: (sectionId: string, completed: boolean) => void
}) {
  return (
    <ol className="flex flex-col gap-1">
      {items.map((item) => {
        const { isCurrent, lockReason, navigable, state } = courseOutlineItemView(
          item,
          activeSlug,
          activeSectionId,
          messages,
        )
        const displayTitle = parentTitle
          ? compactCourseChildTitle(parentTitle, item.title)
          : item.title
        const inlineItem =
          item.kind === "reference" && inlineCompletion?.referenceId === item.id
            ? inlineCompletion.item
            : null
        const titleClass = item.done
          ? "text-foreground/70"
          : item.locked
            ? "text-muted-foreground"
            : isCurrent
              ? "font-medium"
              : ""
        return (
          <li
            key={`${item.kind}-${item.id}`}
            data-slot="course-outline-mobile-step"
            data-step-state={state}
            className={cn(
              COURSE_OUTLINE_ROW_CLASS,
              "transition-colors",
              isCurrent
                ? "font-medium text-foreground"
                : item.locked
                  ? "text-foreground/60"
                  : "hover:bg-foreground/[0.035] hover:text-foreground",
            )}
            aria-current={
              isCurrent ? (activeSectionId === item.id ? "step" : "location") : undefined
            }
            title={lockReason ?? undefined}
          >
            <CourseOutlineStateDescription
              item={item}
              isCurrent={isCurrent}
              lockReason={lockReason}
              messages={messages}
            />
            {inlineItem && !item.locked ? (
              <CompletionCheckbox
                item={inlineItem}
                pending={pending}
                messages={messages}
                onToggle={(completed) => onToggleInline?.(inlineItem.id, completed)}
              />
            ) : item.kind === "section" && !item.locked ? (
              <CompletionCheckbox
                item={item}
                pending={pending}
                messages={messages}
                onToggle={(completed) => onToggle(item.id, completed)}
              />
            ) : (
              <ReferenceStateMarker done={item.done} locked={item.locked} />
            )}

            <div className={navigable ? "min-w-0" : "col-span-2 min-w-0"}>
              {item.kind === "reference" && item.href ? (
                <a
                  href={item.href}
                  className={`flex min-h-11 min-w-0 items-center break-words rounded-sm text-left leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring ${titleClass}`}
                >
                  {displayTitle}
                </a>
              ) : item.kind === "section" && (item.done || item.available) ? (
                <Button
                  type="button"
                  variant="ghost"
                  aria-current={isCurrent ? "location" : undefined}
                  aria-label={messages.goToStep(item.title)}
                  className={`max-w-full min-w-0 justify-start text-left ${titleClass}`}
                  data-course-section-target={item.id}
                  onClick={() => onOpen(item.id)}
                >
                  {displayTitle}
                </Button>
              ) : (
                <span className={`block min-w-0 break-words leading-5 ${titleClass}`}>
                  {displayTitle}
                  {item.locked ? <span className="sr-only"> — {messages.lockedState}</span> : null}
                </span>
              )}
            </div>
            {navigable ? (
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

function CourseOutlineSidebarStepList({
  items,
  parentTitle,
  pending,
  activeSlug,
  activeSectionId,
  messages,
  onToggle,
  onOpen,
  inlineCompletion = null,
  onToggleInline,
  nestedItems = null,
  nestedParentId = null,
  nestedActiveSectionId = null,
  onToggleNested,
}: {
  items: CurriculumJourneyItem[]
  parentTitle?: string
  pending: boolean
  activeSlug: string | null
  activeSectionId: string | null
  messages: CourseOutlineMessages
  onToggle: (sectionId: string, completed: boolean) => void
  onOpen: (sectionId: string) => void
  inlineCompletion?: InlineCompletion | null
  onToggleInline?: (sectionId: string, completed: boolean) => void
  nestedItems?: CurriculumJourneyItem[] | null
  nestedParentId?: string | null
  nestedActiveSectionId?: string | null
  onToggleNested?: (sectionId: string, completed: boolean) => void
}) {
  return (
    <SidebarMenu>
      {items.map((item) => {
        const view = courseOutlineItemView(item, activeSlug, activeSectionId, messages)
        const { isCurrent, lockReason, navigable } = view
        const displayTitle = parentTitle
          ? compactCourseChildTitle(parentTitle, item.title)
          : item.title
        const inlineItem =
          item.kind === "reference" && inlineCompletion?.referenceId === item.id
            ? inlineCompletion.item
            : null
        const hasCompletionControl =
          !item.locked && (inlineItem !== null || item.kind === "section")
        const hasVisibleNestedItems = Boolean(nestedItems && item.id === nestedParentId)
        const showCurrentMarker = isCurrent && !hasVisibleNestedItems
        const menuButtonClassName = cn(
          "h-auto min-h-11 py-2",
          hasCompletionControl && "pl-8",
          item.done && "text-sidebar-foreground/70",
          item.locked && "text-sidebar-foreground/65 disabled:opacity-100",
          isCurrent && "font-medium",
        )
        const menuButtonContent = (
          <>
            <CourseOutlineStateDescription
              item={item}
              isCurrent={isCurrent}
              lockReason={lockReason}
              messages={messages}
            />
            {!hasCompletionControl ? (
              <ReferenceStateMarker done={item.done} locked={item.locked} />
            ) : null}
            <span className="min-w-0 flex-1 text-left">
              <span className="block whitespace-normal break-words leading-5">{displayTitle}</span>
            </span>
            {navigable ? <ChevronRight className="text-muted-foreground" aria-hidden /> : null}
          </>
        )

        return (
          <SidebarMenuItem
            key={`${item.kind}-${item.id}`}
            data-step-state={
              showCurrentMarker ? "current" : hasVisibleNestedItems ? "location" : view.state
            }
            title={lockReason ?? undefined}
          >
            {inlineItem && !item.locked ? (
              <CompletionCheckbox
                className="absolute top-1/2 left-2 z-10 -translate-y-1/2"
                item={inlineItem}
                pending={pending}
                messages={messages}
                onToggle={(completed) => onToggleInline?.(inlineItem.id, completed)}
              />
            ) : item.kind === "section" && !item.locked ? (
              <CompletionCheckbox
                className="absolute top-1/2 left-2 z-10 -translate-y-1/2"
                item={item}
                pending={pending}
                messages={messages}
                onToggle={(completed) => onToggle(item.id, completed)}
              />
            ) : null}

            {item.kind === "reference" && item.href ? (
              <SidebarMenuButton
                isActive={showCurrentMarker}
                render={<a href={item.href} />}
                className={menuButtonClassName}
                aria-current={isCurrent ? "location" : undefined}
              >
                {menuButtonContent}
              </SidebarMenuButton>
            ) : item.kind === "section" && (item.done || item.available) ? (
              <SidebarMenuButton
                isActive={showCurrentMarker}
                className={menuButtonClassName}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={messages.goToStep(item.title)}
                data-course-section-target={item.id}
                onClick={() => onOpen(item.id)}
              >
                {menuButtonContent}
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton
                isActive={showCurrentMarker}
                className={menuButtonClassName}
                disabled
              >
                {menuButtonContent}
              </SidebarMenuButton>
            )}
            {nestedItems && item.id === nestedParentId ? (
              <CourseOutlineSidebarSubStepList
                items={nestedItems}
                pending={pending}
                activeSectionId={nestedActiveSectionId}
                messages={messages}
                onToggle={(id, checked) => onToggleNested?.(id, checked)}
                onOpen={onOpen}
              />
            ) : null}
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}

function CourseOutlineSidebarSubStepList({
  items,
  pending,
  activeSectionId,
  messages,
  onToggle,
  onOpen,
}: {
  items: CurriculumJourneyItem[]
  pending: boolean
  activeSectionId: string | null
  messages: CourseOutlineMessages
  onToggle: (sectionId: string, completed: boolean) => void
  onOpen: (sectionId: string) => void
}) {
  return (
    <SidebarMenuSub className="mx-0 ml-2 gap-1 px-1.5 py-1.5">
      {items.map((item) => {
        const { isCurrent, lockReason, navigable, state } = courseOutlineItemView(
          item,
          null,
          activeSectionId,
          messages,
        )
        const hasCompletionControl = item.kind === "section" && !item.locked
        const buttonClassName = cn(
          "h-auto! min-h-11 py-2",
          hasCompletionControl && "pl-8",
          "text-left",
          item.done && "text-sidebar-foreground/70",
          item.locked && "text-sidebar-foreground/65 aria-disabled:opacity-100",
          isCurrent && "font-medium",
        )
        const content = (
          <>
            <CourseOutlineStateDescription
              item={item}
              isCurrent={isCurrent}
              lockReason={lockReason}
              messages={messages}
            />
            {!hasCompletionControl ? (
              <ReferenceStateMarker done={item.done} locked={item.locked} />
            ) : null}
            <span className="min-w-0 flex-1 text-left">
              <span className="block whitespace-normal break-words leading-5">{item.title}</span>
            </span>
            {navigable ? <ChevronRight className="text-muted-foreground" aria-hidden /> : null}
          </>
        )

        return (
          <SidebarMenuSubItem
            key={`${item.kind}-${item.id}`}
            data-step-state={state}
            title={lockReason ?? undefined}
          >
            {hasCompletionControl ? (
              <CompletionCheckbox
                className="absolute top-1/2 left-2 z-10 -translate-y-1/2"
                item={item}
                pending={pending}
                messages={messages}
                onToggle={(completed) => onToggle(item.id, completed)}
              />
            ) : null}

            {item.kind === "reference" && item.href ? (
              <SidebarMenuSubButton
                isActive={isCurrent}
                render={<a href={item.href} />}
                className={buttonClassName}
                aria-current={isCurrent ? "location" : undefined}
              >
                {content}
              </SidebarMenuSubButton>
            ) : item.kind === "section" && (item.done || item.available) ? (
              <SidebarMenuSubButton
                isActive={isCurrent}
                render={<Button type="button" variant="ghost" />}
                className={cn("w-full justify-start border-0 shadow-none", buttonClassName)}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={messages.goToStep(item.title)}
                data-course-section-target={item.id}
                onClick={() => onOpen(item.id)}
              >
                {content}
              </SidebarMenuSubButton>
            ) : (
              <SidebarMenuSubButton
                isActive={isCurrent}
                render={<div />}
                className={buttonClassName}
                aria-disabled="true"
              >
                {content}
              </SidebarMenuSubButton>
            )}
          </SidebarMenuSubItem>
        )
      })}
    </SidebarMenuSub>
  )
}

type CourseOutlineStepState = "available" | "completed" | "current" | "locked"

function courseOutlineItemView(
  item: CurriculumJourneyItem,
  activeSlug: string | null,
  activeSectionId: string | null,
  messages: CourseOutlineMessages,
) {
  const isActive =
    (activeSlug !== null && item.routeSegment === activeSlug) || item.id === activeSectionId
  const isCurrent = isActive || (!activeSectionId && !activeSlug && item.current)
  const state: CourseOutlineStepState = item.done
    ? "completed"
    : item.locked
      ? "locked"
      : isCurrent
        ? "current"
        : "available"
  return {
    isCurrent,
    state,
    lockReason: courseOutlineLockReason(item, messages),
    navigable:
      (item.kind === "reference" && Boolean(item.href)) ||
      (item.kind === "section" && (item.done || item.available)),
  }
}

function CourseOutlineStateDescription({
  item,
  isCurrent,
  lockReason,
  messages,
}: {
  item: CurriculumJourneyItem
  isCurrent: boolean
  lockReason: string | null
  messages: CourseOutlineMessages
}) {
  const state = item.done
    ? messages.completedState
    : item.locked
      ? messages.lockedState
      : isCurrent
        ? messages.currentState
        : messages.availableState
  return (
    <span className="sr-only">
      {item.kind === "reference" ? messages.moduleKind : messages.lessonKind}. {state}.
      {lockReason ? ` ${lockReason}.` : null}
    </span>
  )
}

function courseOutlineLockReason(
  item: CurriculumJourneyItem,
  messages: CourseOutlineMessages,
): string | null {
  if (!item.locked || item.done) return null
  return item.lockReason === "drip" ? messages.unlocksSoon : messages.prerequisiteLock
}

function ReferenceStateMarker({ done, locked }: { done: boolean; locked: boolean }) {
  return (
    <span
      className={`learner-completion-marker flex size-4 shrink-0 items-center justify-center justify-self-center rounded-full ${
        done ? "bg-primary text-primary-foreground" : "text-muted-foreground"
      }`}
      data-slot="course-outline-state-marker"
      aria-hidden
    >
      {done ? (
        <Check className="size-3" />
      ) : locked ? (
        <Lock className="size-3" />
      ) : (
        <Play className="size-3" />
      )}
    </span>
  )
}

function CompletionCheckbox({
  className,
  item,
  pending,
  messages,
  onToggle,
}: {
  className?: string
  item: CurriculumStepSource
  pending: boolean
  messages: CourseOutlineMessages
  onToggle: (completed: boolean) => void
}) {
  return (
    <Checkbox
      className={cn(
        "learner-completion-marker rounded-full before:rounded-full [&_[data-slot=checkbox-indicator]]:rounded-full",
        className,
      )}
      aria-label={
        item.done ? messages.markIncomplete(item.title) : messages.markComplete(item.title)
      }
      checked={item.done}
      disabled={pending || (!item.available && !item.done)}
      onCheckedChange={(value) => onToggle(Boolean(value))}
    />
  )
}

function resolveCurrentIndex(
  items: CurriculumJourneyItem[],
  activeRootSlug: string | null,
  activeSectionId: string | null,
) {
  const visible = items.findIndex(
    (item) =>
      (activeRootSlug !== null && item.routeSegment === activeRootSlug) ||
      item.id === activeSectionId,
  )
  const declared = items.findIndex((item) => item.current)
  const next = items.findIndex((item) => item.available && !item.done)
  return Math.max(0, visible >= 0 ? visible : declared >= 0 ? declared : next)
}

function resolveInlineCompletion(
  root: CurriculumJourneyItem | null,
  viewedItems: CurriculumJourneyItem[] | null,
  referenceTitle?: string | null,
): InlineCompletion | null {
  const viewed = viewedItems?.length === 1 ? viewedItems[0] : null
  return root?.kind === "reference" &&
    viewed?.kind === "section" &&
    viewed.title.trim().toLocaleLowerCase() ===
      (referenceTitle ?? root.title).trim().toLocaleLowerCase()
    ? { referenceId: root.id, item: viewed }
    : null
}

function resolveNestedModuleTitle(
  referenceTitle: string | null | undefined,
  root: CurriculumJourneyItem | null,
) {
  return referenceTitle?.trim() &&
    referenceTitle.trim().toLocaleLowerCase() !== root?.title.trim().toLocaleLowerCase()
    ? referenceTitle
    : null
}
