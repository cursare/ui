"use client"

import { LearnerRoot } from "@/components/cursare/foundation/runtime"
import { Input } from "@/components/cursare/ui/input"
import { Search } from "lucide-react"
import { useMemo, useState } from "react"
import { CourseCard, type CourseCatalogItem } from "./course-card"

export interface CourseCatalogProps {
  items: CourseCatalogItem[]
  id?: string
  heading?: string
  searchPlaceholder?: string
  emptyLabel?: string
  publisherContext?: "show" | "implicit"
  onSelect?: (item: CourseCatalogItem) => void
}

const SEARCH_MINIMUM_COURSES = 5

// Over data already resolved by the host.
export function CourseCatalog({
  items,
  id,
  heading,
  searchPlaceholder = "Search courses",
  emptyLabel = "No courses match your search.",
  publisherContext = "show",
  onSelect,
}: CourseCatalogProps) {
  const [query, setQuery] = useState("")
  const normalizedQuery = query.trim().toLowerCase()
  const shown = useMemo(
    () =>
      normalizedQuery
        ? items.filter(
            (item) =>
              item.title.toLowerCase().includes(normalizedQuery) ||
              item.description.toLowerCase().includes(normalizedQuery),
          )
        : items,
    [items, normalizedQuery],
  )

  const onlyItem = shown.length === 1 ? shown[0] : null
  const showSearch = items.length >= SEARCH_MINIMUM_COURSES

  return (
    <LearnerRoot
      as="section"
      contractKey="blocks.course-catalog"
      id={id}
      data-slot="course-catalog"
      className="scroll-mt-24 space-y-5"
    >
      {heading || showSearch ? (
        <div
          data-slot="course-catalog-toolbar"
          className="flex flex-wrap items-center justify-between gap-3"
        >
          {heading ? <h2 className="font-heading text-xl tracking-tight">{heading}</h2> : null}
          {showSearch ? (
            <div data-slot="course-catalog-search" className="relative ms-auto w-full max-w-xs">
              <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="pl-9"
              />
            </div>
          ) : null}
        </div>
      ) : null}
      {shown.length === 0 ? (
        <p className="learner-course-empty p-8 text-center text-muted-foreground text-sm">
          {emptyLabel}
        </p>
      ) : onlyItem ? (
        <div
          data-slot="course-catalog-grid"
          data-catalog-layout="single"
          className="grid max-w-3xl"
        >
          <CourseCard
            item={onlyItem}
            orientation="horizontal"
            publisherContext={publisherContext}
            onSelect={onSelect}
          />
        </div>
      ) : shown.length <= 2 ? (
        <div data-slot="course-catalog-grid" className="grid max-w-4xl gap-4 sm:grid-cols-2">
          {shown.map((item) => (
            <CourseCard
              key={item.key}
              item={item}
              publisherContext={publisherContext}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : (
        <div data-slot="course-catalog-grid" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((item) => (
            <CourseCard
              key={item.key}
              item={item}
              publisherContext={publisherContext}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </LearnerRoot>
  )
}
