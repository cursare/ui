"use client"

import { LearnerRoot } from "@/components/cursare/foundation/runtime"
import { Button } from "@/components/cursare/ui/button"
import { MenuItem } from "@/components/cursare/ui/menu"
import {
  Sheet,
  SheetDescription,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
} from "@/components/cursare/ui/sheet"
import { Download, ExternalLink, X } from "lucide-react"
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type { StudyResource } from "./study-projections"

export interface StudyToolDefinition {
  id: string
  label: string
  description: string
  icon: ReactNode
  content: ReactNode
  count?: number
}

export interface StudyToolsMessages {
  close: string
  resources: string
  resourcesDescription: string
  resourcesEmpty: string
  resourceDownload: string
  resourceExternal: string
}

interface StudyToolsContextValue {
  tools: StudyToolDefinition[]
  openTool: (id: string, trigger: HTMLElement) => void
  closeTool: () => void
}

const StudyToolsContext = createContext<StudyToolsContextValue | null>(null)

export function useCloseStudyTool() {
  return useContext(StudyToolsContext)?.closeTool
}

export function useStudyTools() {
  return useContext(StudyToolsContext)
}

export function StudyToolsMenuItems() {
  const context = useContext(StudyToolsContext)
  if (!context) return null
  return (
    <>
      {context.tools.map((tool) => (
        <MenuItem key={tool.id} onClick={(event) => context.openTool(tool.id, event.currentTarget)}>
          {tool.icon}
          <span>{tool.label}</span>
          {tool.count === undefined ? null : (
            <span className="ml-auto text-muted-foreground text-xs tabular-nums">{tool.count}</span>
          )}
        </MenuItem>
      ))}
    </>
  )
}

export function StudyToolsProvider({
  tools,
  messages,
  focusModeActive = false,
  children,
}: {
  tools: StudyToolDefinition[]
  messages: Pick<StudyToolsMessages, "close">
  focusModeActive?: boolean
  children: ReactNode
}) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [mobile, setMobile] = useState(false)
  const [wide, setWide] = useState(false)
  const triggerRef = useRef<HTMLElement | null>(null)
  const railCloseRef = useRef<HTMLButtonElement | null>(null)
  const activeTool = tools.find((tool) => tool.id === activeId) ?? null

  useEffect(() => {
    const mobileMedia = window.matchMedia("(max-width: 1023px)")
    const wideMedia = window.matchMedia("(min-width: 1536px)")
    const update = () => {
      setMobile(mobileMedia.matches)
      setWide(wideMedia.matches)
    }
    update()
    mobileMedia.addEventListener("change", update)
    wideMedia.addEventListener("change", update)
    return () => {
      mobileMedia.removeEventListener("change", update)
      wideMedia.removeEventListener("change", update)
    }
  }, [])

  const closeTool = useCallback(() => {
    setActiveId(null)
    window.setTimeout(() => triggerRef.current?.focus(), 0)
  }, [])

  const openTool = useCallback((id: string, trigger: HTMLElement) => {
    triggerRef.current = trigger
    setActiveId(id)
  }, [])

  useEffect(() => {
    if (focusModeActive) closeTool()
  }, [closeTool, focusModeActive])

  useEffect(() => {
    if (!activeTool || !wide) return
    railCloseRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && closeTool()
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [activeTool, closeTool, wide])

  const context = useMemo(() => ({ tools, openTool, closeTool }), [closeTool, openTool, tools])
  return (
    <StudyToolsContext.Provider value={context}>
      <LearnerRoot
        contractKey="blocks.study-tools"
        className="learner-study-frame"
        data-context-tool-open={wide && activeTool ? true : undefined}
      >
        {children}
        {wide && activeTool ? (
          <aside
            className="learner-study-tool-rail"
            aria-labelledby="learner-study-tool-title"
            data-testid="learner-contextual-tool"
          >
            <header>
              <h2 id="learner-study-tool-title">{activeTool.label}</h2>
              <Button
                ref={railCloseRef}
                type="button"
                variant="ghost"
                aria-label={messages.close}
                onClick={closeTool}
              >
                <X />
              </Button>
            </header>
            <div className="learner-study-tool-rail-body">{activeTool.content}</div>
          </aside>
        ) : null}
      </LearnerRoot>
      <Sheet open={activeTool !== null && !wide} onOpenChange={(open) => !open && closeTool()}>
        <SheetPopup
          side={mobile ? "bottom" : "right"}
          className={
            mobile
              ? "max-h-[88dvh] rounded-t-2xl border-t-0"
              : "w-[min(32rem,calc(100vw-2rem))] max-w-none"
          }
          closeProps={{ "aria-label": messages.close }}
        >
          {activeTool ? (
            <>
              <SheetHeader className="border-b px-5 py-4">
                <SheetTitle>{activeTool.label}</SheetTitle>
                <SheetDescription className="sr-only">{activeTool.description}</SheetDescription>
              </SheetHeader>
              <SheetPanel className="px-5 py-5" data-testid="learner-contextual-tool">
                {activeTool.content}
              </SheetPanel>
            </>
          ) : null}
        </SheetPopup>
      </Sheet>
    </StudyToolsContext.Provider>
  )
}

export function StudyResourceList({
  resources,
  messages,
  onOpen,
}: {
  resources: StudyResource[]
  messages: StudyToolsMessages
  onOpen?: (resource: StudyResource) => void
}) {
  if (resources.length === 0) {
    return (
      <LearnerRoot
        as="p"
        contractKey="blocks.study-resource-list"
        className="py-8 text-center text-muted-foreground text-sm"
      >
        {messages.resourcesEmpty}
      </LearnerRoot>
    )
  }
  return (
    <LearnerRoot as="ul" contractKey="blocks.study-resource-list" className="divide-y">
      {resources.map((resource) => (
        <li key={resource.key}>
          <a
            href={resource.href}
            download={resource.kind === "download" ? resource.label : undefined}
            target={resource.kind === "external" ? "_blank" : undefined}
            rel={resource.kind === "external" ? "noopener noreferrer" : undefined}
            className="flex min-h-14 items-center gap-3 rounded-sm py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onOpen?.(resource)}
          >
            {resource.kind === "download" ? (
              <Download className="size-4 shrink-0" aria-hidden />
            ) : (
              <ExternalLink className="size-4 shrink-0" aria-hidden />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-sm">{resource.label}</span>
              <span className="text-muted-foreground text-xs">
                {resource.kind === "download"
                  ? messages.resourceDownload
                  : messages.resourceExternal}
              </span>
            </span>
          </a>
        </li>
      ))}
    </LearnerRoot>
  )
}
