import { themeVars } from "@/components/cursare/foundation/model/learner-runtime"
import { ContentCoverMedia, LearnerRoot } from "@/components/cursare/foundation/runtime"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/cursare/ui/avatar"
import { Button } from "@/components/cursare/ui/button"
import { ArrowRight, CircleCheck, Star } from "lucide-react"
import type { CSSProperties, ReactNode } from "react"

const FALLBACK_COLOR_KEYS = [
  "amber",
  "orange",
  "rose",
  "red",
  "violet",
  "blue",
  "cyan",
  "emerald",
  "lime",
  "zinc",
] as const

export type FallbackColor = (typeof FALLBACK_COLOR_KEYS)[number]

export const FALLBACK_TINTS: Record<FallbackColor, string> = {
  amber: "var(--warning)",
  orange: "var(--fx-a, var(--primary))",
  rose: "var(--fx-b, var(--primary))",
  red: "var(--destructive)",
  violet: "var(--fx-c, var(--primary))",
  blue: "var(--primary)",
  cyan: "var(--chart-2, var(--primary))",
  emerald: "var(--success)",
  lime: "var(--chart-4, var(--primary))",
  zinc: "var(--muted-foreground)",
}

function fallbackColor(seed: string): FallbackColor {
  let hash = 0
  for (const char of seed.toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) % 997
  return FALLBACK_COLOR_KEYS[hash % FALLBACK_COLOR_KEYS.length] ?? "zinc"
}

// Stable for the same seed.
export function fallbackTint(seed: string): CSSProperties {
  return { "--fallback-tint": FALLBACK_TINTS[fallbackColor(seed)] } as CSSProperties
}

export function orgInitials(name: string): string {
  return (
    name
      .split(/[\s/]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0] ?? "")
      .join("")
      .toUpperCase() || "•"
  )
}

export function OrgAvatar({
  name,
  logo,
  className,
  fallbackClassName,
}: {
  name: string
  logo?: string | null
  className?: string
  fallbackClassName?: string
}) {
  return (
    <Avatar className={className}>
      {logo ? <AvatarImage src={logo} alt="" /> : null}
      <AvatarFallback
        className={`fallback-panel rounded-[inherit] font-heading font-semibold ${fallbackClassName ?? ""}`}
        style={fallbackTint(name)}
      >
        {orgInitials(name)}
      </AvatarFallback>
    </Avatar>
  )
}

export interface CourseHeroCardProps {
  coverImage: string | null
  title: string
  publisher: string
  publisherLogo?: string | null
  description: string | null
  tags?: string[]
  priceLabel?: string
  rating: { average: number; count: number } | null
  progress?: ReactNode
  cta: ReactNode
  badge?: ReactNode
  completed?: boolean
  orientation?: "vertical" | "horizontal"
  theme?: string | null
  className?: string
  showPublisher?: boolean
  contractKey?: "blocks.course-card" | "blocks.course-hero-card"
}

// All commercial copy is host-supplied.
export function CourseHeroCard({
  coverImage,
  title,
  publisher,
  publisherLogo = null,
  description,
  tags,
  priceLabel,
  rating,
  progress,
  cta,
  badge,
  completed = false,
  orientation = "vertical",
  theme,
  className,
  showPublisher = true,
  contractKey = "blocks.course-hero-card",
}: CourseHeroCardProps) {
  const isHorizontal = orientation === "horizontal"
  const resolvedTitle = title || "Untitled course"
  const coverClassName = isHorizontal ? "size-full" : "h-36 w-full"
  const cover = (
    <ContentCoverMedia src={coverImage} contentSlot="course-cover" className={coverClassName} />
  )

  return (
    <LearnerRoot
      contractKey={contractKey}
      data-learner-effect="lift"
      data-slot="course-hero-card"
      data-course-card-orientation={orientation}
      className={`learner-course-card relative w-full overflow-hidden ${isHorizontal ? "group flex flex-col p-3 sm:flex-row sm:items-center" : ""} ${className ?? ""}`}
      style={theme !== undefined ? themeVars(theme) : undefined}
    >
      {badge ? <div className="absolute end-3 top-3 z-10">{badge}</div> : null}
      {isHorizontal ? (
        <div
          data-course-cover-kind={coverImage ? "image" : "fallback"}
          className="learner-course-card-cover h-32 w-full shrink-0 overflow-hidden sm:size-24"
        >
          {cover}
        </div>
      ) : (
        cover
      )}
      <div
        data-slot="course-card-body"
        className={
          isHorizontal
            ? "flex min-w-0 flex-1 flex-col px-2 pt-4 pb-1 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6 sm:p-1 sm:pl-4"
            : "p-5"
        }
      >
        <div className="min-w-0">
          <h3
            data-slot="course-title"
            className={`flex items-center gap-1.5 font-heading font-semibold leading-tight tracking-tight ${isHorizontal ? "text-lg" : "text-xl"}`}
          >
            {completed ? (
              <CircleCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : null}
            <span className={isHorizontal ? "line-clamp-2 break-words" : undefined}>
              {resolvedTitle}
            </span>
          </h3>
          {showPublisher ? (
            <div className="mt-1 flex items-center gap-1.5">
              <OrgAvatar
                name={publisher}
                logo={publisherLogo}
                className="size-4 shrink-0 rounded-full"
                fallbackClassName="text-[7px]"
              />
              <p className="text-muted-foreground text-xs">{publisher}</p>
            </div>
          ) : null}
          {description ? (
            <p
              className={`text-muted-foreground text-sm ${isHorizontal ? "mt-1 line-clamp-2" : "mt-3 line-clamp-3"}`}
            >
              {description}
            </p>
          ) : null}
          {tags && tags.length > 0 ? (
            <div
              className={`${isHorizontal ? "mt-2" : "mt-3"} flex flex-wrap items-center gap-x-2 gap-y-0.5`}
            >
              {tags.map((tag) => (
                <span key={tag} className="text-muted-foreground text-xs">
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}
          {progress ? (
            <div className={isHorizontal ? "mt-2 inline-flex px-2 py-1" : "mt-4"}>{progress}</div>
          ) : null}
        </div>
        <div
          data-slot="course-card-footer"
          className={
            isHorizontal
              ? "mt-4 flex items-center justify-between gap-4 sm:mt-0 sm:flex-col sm:items-end"
              : "mt-5 flex items-center justify-between gap-4 border-t pt-4"
          }
        >
          <div className="flex items-center gap-2">
            {priceLabel ? <span className="font-medium text-sm">{priceLabel}</span> : null}
            {rating && rating.count > 0 ? (
              <span className="flex items-center gap-1 text-muted-foreground text-xs">
                <Star className="size-3 fill-current" aria-hidden />
                {rating.average.toFixed(1)} ({rating.count})
              </span>
            ) : null}
          </div>
          {cta}
        </div>
      </div>
    </LearnerRoot>
  )
}

export interface CourseCatalogItem {
  key: string
  href: string
  title: string
  publisher: string
  publisherLogo?: string | null
  description: string
  coverImage: string | null
  theme?: string | null
  tags?: string[]
  status?: "enrolled" | "completed"
  progressLabel?: string
  rating?: { average: number; count: number } | null
  priceLabel?: string
  ctaLabel: string
}

// Routing, money formatting and CTA copy belong to the host.
export function CourseCard({
  item,
  orientation,
  publisherContext = "show",
  onSelect,
}: {
  item: CourseCatalogItem
  orientation?: "vertical" | "horizontal"
  publisherContext?: "show" | "implicit"
  onSelect?: (item: CourseCatalogItem) => void
}) {
  return (
    <CourseHeroCard
      coverImage={item.coverImage}
      title={item.title}
      publisher={item.publisher}
      publisherLogo={item.publisherLogo ?? null}
      description={item.description}
      tags={publisherContext === "implicit" && item.status ? undefined : item.tags}
      priceLabel={item.priceLabel}
      rating={item.rating ?? null}
      orientation={orientation}
      theme={item.theme}
      completed={item.status === "completed"}
      showPublisher={publisherContext === "show"}
      contractKey="blocks.course-card"
      progress={
        item.progressLabel ? (
          <p className="text-muted-foreground text-xs">{item.progressLabel}</p>
        ) : undefined
      }
      cta={
        <Button
          variant={
            orientation === "horizontal"
              ? "secondary"
              : item.status === "enrolled"
                ? "default"
                : "outline"
          }
          className={
            orientation === "horizontal"
              ? "group/cta static after:absolute after:inset-0"
              : undefined
          }
          render={<a href={item.href} onClick={() => onSelect?.(item)} />}
        >
          {item.ctaLabel}
          {orientation === "horizontal" ? (
            <ArrowRight className="size-3.5 transition-transform group-hover/cta:translate-x-0.5" />
          ) : null}
        </Button>
      }
    />
  )
}
