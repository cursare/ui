"use client"

import "katex/dist/katex.min.css"
import "@xyflow/react/dist/style.css"

import {
  type ContentNode,
  learnerAnchorId,
  parseDiagramSource,
  parseEmbedUrl,
  videoTextTracks,
} from "@/components/cursare/foundation/model"
import { syntaxHighlighter } from "@/components/cursare/composer/syntax"
import { Button as LearnerButton } from "@/components/cursare/ui/button"
import { Background, MarkerType, Panel, ReactFlow, useReactFlow } from "@xyflow/react"
import {
  ArrowRight,
  AudioLines,
  Blocks,
  Check,
  CircleCheck,
  Code2,
  Copy,
  Download,
  ImageIcon,
  Lightbulb,
  LockKeyhole,
  Maximize2,
  OctagonAlert,
  Puzzle,
  Sigma,
  TriangleAlert,
  Video,
  Workflow,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import {
  type CSSProperties,
  Fragment,
  lazy,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import { ReaderAudioPlayer } from "./audio-player"
import type {
  LearnerActivityReport,
  PollLoad,
  PollVote,
  PoolQuestion,
  QuizGrade,
  ReferenceSearch,
  SavedQuiz,
  VideoPlaybackHandle,
  VideoPlaybackService,
} from "./contracts"
import { fileAttachmentIcon, formatFileAttachmentMetadata } from "./file-attachment"
import { LearnerMediaRoot, LearnerTechnicalRoot } from "./learner-family-primitives"
import { LearnerBlockShell, LearnerHeader, LearnerRoot } from "./learner-primitives"
import { type EditorMessages, editorMessage } from "./messages"
import { PollView, QuizView } from "./practice"
import { resolveReferenceReaderState } from "./reference-reader-state"
import { videoPlayerCopy } from "./video-player-messages"
import { videoPlaybackSource } from "./video-source"

const AccessibleVideoPlayer = lazy(async () => {
  const module = await import("./accessible-video-player")
  return { default: module.AccessibleVideoPlayer }
})

export const LEARNER_NODE_POLICIES = [
  "doc",
  "text",
  "paragraph",
  "heading",
  "hardBreak",
  "blockquote",
  "bulletList",
  "orderedList",
  "listItem",
  "tableBlock",
  "table",
  "tableRow",
  "tableHeader",
  "tableCell",
  "horizontalRule",
  "callout",
  "image",
  "video",
  "audio",
  "embed",
  "fileAttachment",
  "reference",
  "codeBlock",
  "diagram",
  "mathBlock",
  "mathInline",
  "glossaryTerm",
  "steps",
  "step",
  "poll",
  "questionPool",
] as const

export const LEARNER_MARK_POLICIES = [
  "bold",
  "italic",
  "strike",
  "code",
  "underline",
  "link",
  "highlight",
  "textStyle",
] as const

export interface DirectReaderServices {
  messages?: EditorMessages
  referenceProvider?: ReferenceSearch
  referenceBase?: string | null
  referenceNavigationEnabled?: boolean
  completedReferenceKeys?: string[]
  unavailableReferenceKeys?: string[]
  onGradeQuiz?: QuizGrade
  savedQuiz?: SavedQuiz | null
  onPollVote?: PollVote
  onPollLoad?: PollLoad
  onLearnerActivity?: LearnerActivityReport
  playback: VideoPlaybackService
  sectionByAnchor: ReadonlyMap<string, string | null>
  videoHeadingByNode?: WeakMap<ContentNode, string | null>
}

function textContent(node: ContentNode): string {
  if (node.type === "text") return node.text ?? ""
  return (node.content ?? []).map(textContent).join("")
}

function videoHeadingByNode(document: ContentNode): WeakMap<ContentNode, string | null> {
  const labels = new WeakMap<ContentNode, string | null>()
  let heading: string | null = null
  const visit = (node: ContentNode) => {
    if (node.type === "heading") heading = textContent(node).trim() || heading
    if (node.type === "video") labels.set(node, heading)
    for (const child of node.content ?? []) visit(child)
  }
  visit(document)
  return labels
}

const serializedObjectPlaceholder = /^(?:\\?\[object Object\])(?:,\\?\[object Object\])*$/

function isSerializedObjectPlaceholder(value: string): boolean {
  return serializedObjectPlaceholder.test(value.trim())
}

function stringAttr(node: ContentNode, key: string): string {
  const value = node.attrs?.[key]
  return typeof value === "string" && !isSerializedObjectPlaceholder(value) ? value : ""
}

function tableCellStyle(node: ContentNode): CSSProperties | undefined {
  const alignment = node.attrs?.alignment
  const width = Number(node.attrs?.columnWidth ?? 0)
  const style: CSSProperties = {}
  if (alignment === "center" || alignment === "left" || alignment === "right") {
    style.textAlign = alignment
  }
  if (Number.isFinite(width) && width > 0) style.width = width
  return Object.keys(style).length > 0 ? style : undefined
}

function inlineAttr(node: ContentNode, key: string): ContentNode[] {
  const value = node.attrs?.[key]
  if (typeof value === "string") {
    return value && !isSerializedObjectPlaceholder(value) ? [{ type: "text", text: value }] : []
  }
  if (!Array.isArray(value)) return []
  const content = value.filter(
    (child): child is ContentNode =>
      Boolean(child) && typeof child === "object" && typeof child.type === "string",
  )
  return isSerializedObjectPlaceholder(content.map(textContent).join("")) ? [] : content
}

function inlineAttrText(node: ContentNode, key: string): string {
  return inlineAttr(node, key).map(textContent).join("")
}

function InlineAttribute({
  node,
  attribute,
  path,
  services,
}: {
  node: ContentNode
  attribute: string
  path: string
  services: DirectReaderServices
}) {
  return (
    <>
      {inlineAttr(node, attribute).map((child, index) => (
        <RenderNode
          key={stableKey(child, `${path}.${attribute}.${index}`)}
          node={child}
          path={`${path}.${attribute}.${index}`}
          services={services}
        />
      ))}
    </>
  )
}

function stableKey(node: ContentNode, path: string): string {
  for (const key of [
    "learnerAnchorId",
    "blockId",
    "id",
    "pollId",
    "orderingId",
    "targetContentId",
  ]) {
    const value = stringAttr(node, key)
    if (value) return `${node.type}:${value}`
  }
  return `${node.type}:${path}`
}

function nodeDomAttributes(node: ContentNode) {
  const blockId = stringAttr(node, "blockId")
  // Per-type identity (callout/steps→id, poll→pollId, reference/heading→blockId,
  // else learnerAnchorId) — the SAME id the model's learnerAnchors() puts in the
  // search index and note anchors, so a search-result click or note resolves to a
  // real DOM target for every block, not just headings.
  const anchorId = learnerAnchorId(node) ?? ""
  const requires = Array.isArray(node.attrs?.requires) ? node.attrs?.requires : null
  return {
    "data-learner-anchor-id": anchorId || undefined,
    "data-block-id": blockId || undefined,
    "data-requires": requires ? JSON.stringify(requires) : undefined,
  }
}

function renderMarkedText(node: ContentNode, key: string): ReactNode {
  let rendered: ReactNode = node.text ?? ""
  const marks = node.marks ?? []
  for (let index = marks.length - 1; index >= 0; index -= 1) {
    const mark = marks[index]
    if (!mark) continue
    const markKey = `${key}:mark:${index}`
    if (mark.type === "bold") rendered = <strong key={markKey}>{rendered}</strong>
    else if (mark.type === "italic") rendered = <em key={markKey}>{rendered}</em>
    else if (mark.type === "strike") rendered = <s key={markKey}>{rendered}</s>
    else if (mark.type === "code") rendered = <code key={markKey}>{rendered}</code>
    else if (mark.type === "underline") rendered = <u key={markKey}>{rendered}</u>
    else if (mark.type === "link") {
      const href = typeof mark.attrs?.href === "string" ? mark.attrs.href : "#"
      const target = mark.attrs?.target === "_blank" ? "_blank" : undefined
      rendered = (
        <a key={markKey} href={href} target={target} rel={target ? "noreferrer" : undefined}>
          {rendered}
        </a>
      )
    } else if (mark.type === "highlight") {
      const color = typeof mark.attrs?.color === "string" ? mark.attrs.color : undefined
      rendered = (
        <mark
          key={markKey}
          className={color ? "content-custom-highlight" : undefined}
          style={color ? ({ "--learner-mark-background": color } as CSSProperties) : undefined}
        >
          {rendered}
        </mark>
      )
    } else if (mark.type === "textStyle") {
      const color = typeof mark.attrs?.color === "string" ? mark.attrs.color : undefined
      rendered = (
        <span
          key={markKey}
          className={color ? "content-text-color" : undefined}
          style={color ? ({ "--learner-text-color": color } as CSSProperties) : undefined}
        >
          {rendered}
        </span>
      )
    }
  }
  return rendered
}

function CopyButton({ value, messages }: { value: string; messages?: EditorMessages }) {
  const [copied, setCopied] = useState(false)
  const label = editorMessage(messages, copied ? "codeBlockCopied" : "codeBlockCopy")
  return (
    <LearnerButton
      type="button"
      variant="ghost"
      aria-label={label}
      title={label}
      className="content-code-block-copy"
      onClick={async () => {
        await navigator.clipboard.writeText(value)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1_500)
      }}
    >
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
    </LearnerButton>
  )
}

function HighlightedCode({ code, language }: { code: string; language?: unknown }) {
  const highlighted = syntaxHighlighter.tokenize(code, language)
  if (highlighted.tokens.length === 0) return code

  const content: ReactNode[] = []
  let offset = 0
  for (const token of highlighted.tokens) {
    if (token.from > offset) content.push(code.slice(offset, token.from))
    content.push(
      <span key={`${token.from}-${token.to}`} className={token.className}>
        {code.slice(token.from, token.to)}
      </span>,
    )
    offset = token.to
  }
  if (offset < code.length) content.push(code.slice(offset))
  return content
}

function CalloutView({ node, children }: { node: ContentNode; children: ReactNode }) {
  const variant = ["info", "success", "warning", "danger"].includes(stringAttr(node, "variant"))
    ? stringAttr(node, "variant")
    : "info"
  const Icon =
    variant === "success"
      ? CircleCheck
      : variant === "warning"
        ? TriangleAlert
        : variant === "danger"
          ? OctagonAlert
          : Lightbulb
  const title = stringAttr(node, "title")
  return (
    <LearnerRoot
      contractKey="runtime.aside.callout"
      {...nodeDomAttributes(node)}
      className={`content-block content-callout content-callout-${variant}`}
      data-type="callout"
    >
      <div className="content-callout-surface" data-variant={variant}>
        <span className="content-callout-icon">
          <Icon aria-hidden="true" />
        </span>
        <div className="content-callout-body">
          {title ? <strong className="content-callout-title">{title}</strong> : null}
          {children}
        </div>
      </div>
    </LearnerRoot>
  )
}

function useKatex(latex: string, displayMode: boolean): string {
  const [html, setHtml] = useState("")
  useEffect(() => {
    let alive = true
    import("katex")
      .then(({ default: katex }) =>
        katex.renderToString(latex || "\\,", {
          displayMode,
          throwOnError: false,
          output: "html",
        }),
      )
      .then((rendered) => {
        if (alive) setHtml(rendered)
      })
      .catch(() => {
        if (alive) setHtml("")
      })
    return () => {
      alive = false
    }
  }, [displayMode, latex])
  return html
}

function MathView({
  node,
  inline,
  path,
  services,
}: {
  node: ContentNode
  inline: boolean
  path?: string
  services?: DirectReaderServices
}) {
  const latex = stringAttr(node, "latex")
  const html = useKatex(latex, !inline)
  if (inline) {
    return (
      <LearnerRoot
        as="span"
        contractKey="runtime.flow.inline"
        {...nodeDomAttributes(node)}
        className="content-block content-math-inline"
        data-type="mathInline"
      >
        {html ? (
          <span
            className="content-math-inline-render"
            role="math"
            aria-label={latex}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX renders escaped math markup with throwOnError disabled.
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          // Before hydration / if KaTeX fails to load, show the source instead of
          // an empty box so the math is never invisible.
          <span className="content-math-inline-render" role="math" aria-label={latex}>
            {latex}
          </span>
        )}
      </LearnerRoot>
    )
  }
  const title = stringAttr(node, "title")
  const description = inlineAttr(node, "description")
  return (
    <LearnerTechnicalRoot
      contractKey="runtime.technical.math"
      {...nodeDomAttributes(node)}
      className="content-block content-mathBlock"
      data-type="mathBlock"
    >
      <LearnerBlockShell
        bodyClassName="content-math-reader"
        className="content-math-shell"
        description={
          description.length > 0 && path && services ? (
            <InlineAttribute node={node} attribute="description" path={path} services={services} />
          ) : undefined
        }
        icon={<Sigma aria-hidden="true" />}
        title={title || undefined}
      >
        {html ? (
          <div
            className="content-math-render"
            role="math"
            aria-label={latex}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX renders escaped math markup with throwOnError disabled.
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          // Before hydration / if KaTeX fails to load, show the source, not a blank.
          <div className="content-math-render" role="math" aria-label={latex}>
            {latex}
          </div>
        )}
      </LearnerBlockShell>
    </LearnerTechnicalRoot>
  )
}

function DiagramControls() {
  const { fitView, zoomIn, zoomOut } = useReactFlow()

  return (
    <Panel className="content-diagram-controls" position="bottom-left">
      <LearnerButton
        type="button"
        variant="outline"
        aria-label="Zoom In"
        title="Zoom In"
        onClick={() => void zoomIn()}
      >
        <ZoomIn aria-hidden="true" />
      </LearnerButton>
      <LearnerButton
        type="button"
        variant="outline"
        aria-label="Zoom Out"
        title="Zoom Out"
        onClick={() => void zoomOut()}
      >
        <ZoomOut aria-hidden="true" />
      </LearnerButton>
      <LearnerButton
        type="button"
        variant="outline"
        aria-label="Fit View"
        title="Fit View"
        onClick={() => void fitView({ padding: 0.2 })}
      >
        <Maximize2 aria-hidden="true" />
      </LearnerButton>
    </Panel>
  )
}

function DiagramView({
  node,
  path,
  services,
}: {
  node: ContentNode
  path: string
  services: DirectReaderServices
}) {
  const diagram = useMemo(() => parseDiagramSource(stringAttr(node, "source")), [node])
  const title = stringAttr(node, "title")
  const description = inlineAttr(node, "description")
  const nodes = useMemo(
    () =>
      diagram.nodes.map(({ id, label, x, y }) => ({
        id,
        data: { label },
        position: { x, y },
      })),
    [diagram.nodes],
  )
  const edges = useMemo(
    () =>
      diagram.edges.map(({ source, target }, index) => ({
        id: `${source}-${target}-${index}`,
        markerEnd: { type: MarkerType.ArrowClosed },
        source,
        target,
      })),
    [diagram.edges],
  )
  return (
    <LearnerTechnicalRoot
      contractKey="runtime.technical.diagram"
      {...nodeDomAttributes(node)}
      className="content-block content-diagram"
      data-type="diagram"
    >
      <LearnerBlockShell
        className="content-diagram-shell"
        description={
          description.length > 0 ? (
            <InlineAttribute node={node} attribute="description" path={path} services={services} />
          ) : undefined
        }
        icon={<Workflow aria-hidden="true" />}
        title={title}
      >
        {nodes.length === 0 ? (
          <p className="content-diagram-error">
            <TriangleAlert className="size-3.5" /> Invalid diagram
          </p>
        ) : (
          <div className="content-diagram-flow">
            <ReactFlow
              edges={edges}
              elementsSelectable={false}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              nodes={nodes}
              nodesConnectable={false}
              nodesDraggable={false}
              panOnDrag
              proOptions={{ hideAttribution: true }}
              zoomOnDoubleClick={false}
            >
              <Background gap={24} size={1} />
              <DiagramControls />
            </ReactFlow>
          </div>
        )}
      </LearnerBlockShell>
    </LearnerTechnicalRoot>
  )
}

function VideoView({
  node,
  path,
  services,
}: {
  node: ContentNode
  path: string
  services: DirectReaderServices
}) {
  const src = stringAttr(node, "src")
  const source = useMemo(
    () => videoPlaybackSource(src, node.attrs?.provider),
    [node.attrs?.provider, src],
  )
  const anchorId = stringAttr(node, "learnerAnchorId")
  const [controlledHandle, setControlledHandle] = useState<VideoPlaybackHandle | null>(null)
  const sectionId = services.sectionByAnchor.get(anchorId) ?? null
  const copy = videoPlayerCopy((key, params) => editorMessage(services.messages, key, params))
  const sectionLabel = services.videoHeadingByNode?.get(node) ?? null
  const title = stringAttr(node, "title")
  const description = inlineAttr(node, "description")
  const accessibleTitle = title || (sectionLabel ? copy.sectionLabel(sectionLabel) : copy.title)
  const tracks = useMemo(() => videoTextTracks(node.attrs?.tracks), [node.attrs?.tracks])
  const acceptControlledHandle = useCallback((handle: VideoPlaybackHandle) => {
    setControlledHandle(handle)
  }, [])
  useEffect(() => {
    if (!anchorId || !source || !controlledHandle) return
    return services.playback.register(anchorId, controlledHandle)
  }, [anchorId, controlledHandle, services.playback, source])
  if (!source) return null
  const reportMilestone = (percent: 0 | 25 | 50 | 75 | 100) => {
    if (!anchorId || !sectionId) return
    if (percent === 0) {
      services.onLearnerActivity?.({ type: "video_started", activityId: anchorId, sectionId })
    } else if (percent === 100) {
      services.onLearnerActivity?.({ type: "video_completed", activityId: anchorId, sectionId })
    } else {
      services.onLearnerActivity?.({
        type: "video_progress",
        activityId: anchorId,
        sectionId,
        percent,
      })
    }
  }
  return (
    <LearnerMediaRoot
      contractKey="runtime.media.video"
      {...nodeDomAttributes(node)}
      className="content-block content-video"
      data-type="video"
    >
      <LearnerBlockShell
        bodyClassName="content-video-reader"
        className="content-video-shell"
        description={
          description.length > 0 ? (
            <InlineAttribute node={node} attribute="description" path={path} services={services} />
          ) : undefined
        }
        icon={<Video aria-hidden="true" />}
        title={title || undefined}
      >
        <Suspense
          fallback={
            <div className="content-video-status" role="status">
              {copy.loading}
            </div>
          }
        >
          <AccessibleVideoPlayer
            key={`${source.provider}:${source.src}`}
            src={source.src}
            provider={source.provider}
            tracks={tracks}
            title={accessibleTitle}
            loadingLabel={copy.loading}
            failureLabel={copy.failure}
            shortcutHelp={copy.shortcuts}
            resumeIdentity={`${anchorId || "video"}:${source.provider}:${source.src}`}
            resumePrompt={copy.resumePrompt}
            resumeAction={copy.resumeAction}
            startOver={copy.startOver}
            transcriptLabel={copy.transcript}
            transcriptSearchLabel={copy.transcriptSearch}
            transcriptEmptyLabel={copy.transcriptEmpty}
            transcriptFailureLabel={copy.transcriptFailure}
            translations={copy.translations}
            onPlaybackHandle={acceptControlledHandle}
            onMilestone={reportMilestone}
          />
        </Suspense>
      </LearnerBlockShell>
    </LearnerMediaRoot>
  )
}

function FileView({
  node,
  path,
  services,
}: {
  node: ContentNode
  path: string
  services: DirectReaderServices
}) {
  const url = stringAttr(node, "url")
  if (!url) return null
  const name = stringAttr(node, "name") || editorMessage(services.messages, "fileLabel")
  const mime = stringAttr(node, "mime")
  const size = typeof node.attrs?.size === "number" ? node.attrs.size : null
  const metadata = formatFileAttachmentMetadata(size, mime || null, name)
  const FileIcon = fileAttachmentIcon(mime || null, name)
  const title = stringAttr(node, "title")
  const description = inlineAttr(node, "description")
  const hasFraming = Boolean(title || description.length)
  const details = [title && title !== name ? name : "", metadata].filter(Boolean).join(" · ")
  const reportDownload = () => {
    const activityId = stringAttr(node, "learnerAnchorId")
    const sectionId = services.sectionByAnchor.get(activityId) ?? null
    if (activityId && sectionId) {
      services.onLearnerActivity?.({ type: "resource_downloaded", activityId, sectionId })
    }
  }
  return (
    <LearnerRoot
      contractKey="runtime.navigation.file"
      {...nodeDomAttributes(node)}
      className="content-block content-fileAttachment content-file-attachment"
      data-has-framing={hasFraming || undefined}
      data-type="fileAttachment"
    >
      <LearnerHeader
        icon={<FileIcon aria-hidden="true" />}
        title={title || name}
        description={
          description.length > 0 ? (
            <InlineAttribute node={node} attribute="description" path={path} services={services} />
          ) : undefined
        }
        metadata={details || undefined}
        actions={
          <LearnerButton
            render={
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                download={name}
                onClick={reportDownload}
              />
            }
            variant="ghost"
            aria-label={`${editorMessage(services.messages, "fileDownload")} ${name}`}
          >
            {editorMessage(services.messages, "fileDownload")}
            <Download aria-hidden="true" />
          </LearnerButton>
        }
      />
    </LearnerRoot>
  )
}

function ReferenceView({
  node,
  path,
  services,
}: {
  node: ContentNode
  path: string
  services: DirectReaderServices
}) {
  const key = stringAttr(node, "targetContentId")
  const title = stringAttr(node, "title") || editorMessage(services.messages, "untitledContent")
  const description = inlineAttr(node, "description")
  const slug = stringAttr(node, "routeSegment")
  const afterHours =
    typeof node.attrs?.afterHours === "number" && node.attrs.afterHours > 0
      ? node.attrs.afterHours
      : null
  const releaseDays = afterHours ? Math.max(1, Math.round(afterHours / 24)) : 0
  const releaseText =
    releaseDays === 0
      ? editorMessage(services.messages, "referenceImmediately")
      : `${releaseDays} ${editorMessage(
          services.messages,
          releaseDays === 1 ? "referenceUnitDay" : "referenceUnitDays",
        )} ${editorMessage(
          services.messages,
          node.attrs?.dripAnchor === "prev" ? "referenceAnchorPrev" : "referenceAnchorEnroll",
        )}`
  const completed = services.completedReferenceKeys?.includes(key) ?? false
  const unavailable = services.unavailableReferenceKeys?.includes(key) ?? false
  const state = resolveReferenceReaderState({
    base: services.referenceBase?.replace(/\/$/, "") ?? null,
    completed,
    navigationEnabled: services.referenceNavigationEnabled !== false,
    routeSegment: slug,
    unavailable,
  })
  const content = (
    <LearnerHeader
      className="content-reference-header"
      icon={<Blocks aria-hidden="true" />}
      title={title}
      description={
        description.length > 0 ? (
          <InlineAttribute node={node} attribute="description" path={path} services={services} />
        ) : undefined
      }
      metadata={
        <span className="content-reference-meta">
          <span className="content-reference-slug">/{slug}</span>
          <span className="content-reference-separator" aria-hidden="true">
            ·
          </span>
          <span className="content-reference-release">{releaseText}</span>
        </span>
      }
      actions={
        <span className="content-reference-trailing">
          {state.status === "completed" ? (
            <CircleCheck
              className="content-reference-done"
              aria-label={editorMessage(services.messages, "referenceCompletedAria")}
            />
          ) : state.disabled ? (
            <LockKeyhole
              aria-label={editorMessage(
                services.messages,
                state.status === "enrollment-required"
                  ? "referenceStatusEnrollmentRequired"
                  : "referenceUnavailableAria",
              )}
            />
          ) : (
            <ArrowRight aria-hidden="true" />
          )}
        </span>
      }
    />
  )
  return state.href ? (
    <LearnerRoot
      as="a"
      contractKey="runtime.navigation.reference"
      {...nodeDomAttributes(node)}
      className="content-reference-reader content-reference-link"
      data-learner-effect="focus"
      data-done={state.status === "completed" || undefined}
      data-unavailable={unavailable || undefined}
      href={state.href}
      data-type="reference"
    >
      {content}
    </LearnerRoot>
  ) : (
    <LearnerRoot
      contractKey="runtime.navigation.reference"
      {...nodeDomAttributes(node)}
      className="content-reference-reader"
      data-type="reference"
      aria-disabled={state.disabled || undefined}
      data-disabled={state.disabled || undefined}
      data-done={state.status === "completed" || undefined}
      data-unavailable={unavailable || undefined}
    >
      {content}
    </LearnerRoot>
  )
}

function RenderChildren({
  node,
  path,
  services,
}: {
  node: ContentNode
  path: string
  services: DirectReaderServices
}) {
  return (
    <>
      {(node.content ?? []).map((child, index) => (
        <RenderNode
          key={stableKey(child, `${path}.${index}`)}
          node={child}
          path={`${path}.${index}`}
          services={services}
        />
      ))}
    </>
  )
}

function RenderNode({
  node,
  path,
  services,
}: {
  node: ContentNode
  path: string
  services: DirectReaderServices
}): ReactNode {
  if (node.type === "text") return renderMarkedText(node, path)
  const children = <RenderChildren node={node} path={path} services={services} />
  const dom = nodeDomAttributes(node)
  if (node.type === "doc") return children
  if (node.type === "paragraph") {
    const standaloneImage = node.content?.length === 1 ? node.content[0] : null
    if (standaloneImage?.type === "image") {
      return (
        <RenderNode
          node={{
            ...standaloneImage,
            attrs: {
              ...standaloneImage.attrs,
              learnerAnchorId:
                standaloneImage.attrs?.learnerAnchorId ?? node.attrs?.learnerAnchorId,
              blockId: standaloneImage.attrs?.blockId ?? node.attrs?.blockId,
              requires: standaloneImage.attrs?.requires ?? node.attrs?.requires,
            },
          }}
          path={`${path}.0`}
          services={services}
        />
      )
    }
    return (
      <LearnerRoot as="p" contractKey="runtime.flow.prose" {...dom}>
        {children}
      </LearnerRoot>
    )
  }
  if (node.type === "heading") {
    const level = Math.min(6, Math.max(1, Number(node.attrs?.level) || 2))
    const as = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
    return (
      <LearnerRoot as={as} contractKey="runtime.flow.prose" {...dom}>
        {children}
      </LearnerRoot>
    )
  }
  if (node.type === "hardBreak") return <br />
  if (node.type === "blockquote")
    return (
      <LearnerRoot as="blockquote" contractKey="runtime.flow.blockquote" {...dom}>
        {children}
      </LearnerRoot>
    )
  if (node.type === "bulletList")
    return (
      <LearnerRoot as="ul" contractKey="runtime.flow.lists" {...dom}>
        {children}
      </LearnerRoot>
    )
  if (node.type === "orderedList")
    return (
      <LearnerRoot
        as="ol"
        contractKey="runtime.flow.lists"
        {...dom}
        start={typeof node.attrs?.start === "number" ? node.attrs.start : undefined}
      >
        {children}
      </LearnerRoot>
    )
  if (node.type === "listItem") return <li {...dom}>{children}</li>
  if (node.type === "tableBlock") {
    const title = stringAttr(node, "title")
    const description = inlineAttr(node, "description")
    return (
      <section {...dom} className="content-block content-table-block" data-type="table">
        {title || description.length > 0 ? (
          <header className="content-table-header">
            {title ? <h3 className="content-table-title">{title}</h3> : null}
            {description.length > 0 ? (
              <p className="content-table-description">
                <InlineAttribute
                  node={node}
                  attribute="description"
                  path={path}
                  services={services}
                />
              </p>
            ) : null}
          </header>
        ) : null}
        {children}
      </section>
    )
  }
  if (node.type === "table")
    return (
      <div className="tableWrapper">
        <LearnerRoot as="table" contractKey="runtime.flow.table" {...dom}>
          <tbody>{children}</tbody>
        </LearnerRoot>
      </div>
    )
  if (node.type === "tableRow") return <tr {...dom}>{children}</tr>
  if (node.type === "tableHeader")
    return (
      <th
        {...dom}
        colSpan={Number(node.attrs?.colspan) || 1}
        rowSpan={Number(node.attrs?.rowspan) || 1}
        style={tableCellStyle(node)}
      >
        {children}
      </th>
    )
  if (node.type === "tableCell")
    return (
      <td
        {...dom}
        colSpan={Number(node.attrs?.colspan) || 1}
        rowSpan={Number(node.attrs?.rowspan) || 1}
        style={tableCellStyle(node)}
      >
        {children}
      </td>
    )
  if (node.type === "horizontalRule")
    return <LearnerRoot as="hr" contractKey="runtime.flow.rule" {...dom} />
  if (node.type === "callout") return <CalloutView node={node}>{children}</CalloutView>
  if (node.type === "image") {
    const src = stringAttr(node, "src")
    if (!src) return null
    const width = typeof node.attrs?.width === "number" ? node.attrs.width : 100
    const title = stringAttr(node, "title")
    const description = inlineAttr(node, "description")
    return (
      <LearnerMediaRoot
        contractKey="runtime.media.image"
        {...dom}
        className="content-block content-image-node"
        data-type="image"
        style={{ "--learner-image-width": `${width}%` } as CSSProperties}
      >
        {title || description.length > 0 ? (
          <LearnerHeader
            icon={<ImageIcon aria-hidden="true" />}
            title={title}
            description={
              description.length > 0 ? (
                <InlineAttribute
                  node={node}
                  attribute="description"
                  path={path}
                  services={services}
                />
              ) : undefined
            }
          />
        ) : null}
        <div className="content-image-frame">
          <img
            className="content-image"
            src={src}
            alt={stringAttr(node, "alt") || inlineAttrText(node, "description")}
            title={title || undefined}
          />
        </div>
      </LearnerMediaRoot>
    )
  }
  if (node.type === "video") return <VideoView node={node} path={path} services={services} />
  if (node.type === "audio") {
    const src = stringAttr(node, "src")
    return src ? (
      <LearnerMediaRoot
        contractKey="runtime.media.audio"
        {...dom}
        className="content-block content-audio"
        data-type="audio"
      >
        <LearnerHeader
          icon={<AudioLines aria-hidden="true" />}
          title={stringAttr(node, "title") || editorMessage(services.messages, "audioLabel")}
          description={
            inlineAttr(node, "description").length > 0 ? (
              <InlineAttribute
                node={node}
                attribute="description"
                path={path}
                services={services}
              />
            ) : undefined
          }
        />
        <div className="content-audio-body">
          <ReaderAudioPlayer
            src={src}
            labels={{
              play: editorMessage(services.messages, "audioPlay"),
              pause: editorMessage(services.messages, "audioPause"),
              position: editorMessage(services.messages, "audioPosition"),
              unavailable: editorMessage(services.messages, "audioUnavailable"),
            }}
          />
        </div>
      </LearnerMediaRoot>
    ) : null
  }
  if (node.type === "embed") {
    const parsed = parseEmbedUrl(stringAttr(node, "src") || stringAttr(node, "url"))
    return parsed ? (
      <LearnerMediaRoot
        contractKey="runtime.media.embed"
        {...dom}
        className="content-block content-embed"
        data-type="embed"
      >
        <LearnerHeader
          icon={<Puzzle aria-hidden="true" />}
          title={stringAttr(node, "title") || parsed.label}
          description={
            inlineAttr(node, "description").length > 0 ? (
              <InlineAttribute
                node={node}
                attribute="description"
                path={path}
                services={services}
              />
            ) : undefined
          }
        />
        <iframe
          className="content-embed-frame"
          src={parsed.src}
          title={stringAttr(node, "title") || parsed.label}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          allow="clipboard-write"
          referrerPolicy="no-referrer"
        />
        <p className="content-embed-caption">{parsed.label}</p>
      </LearnerMediaRoot>
    ) : null
  }
  if (node.type === "fileAttachment")
    return <FileView node={node} path={path} services={services} />
  if (node.type === "reference")
    return <ReferenceView node={node} path={path} services={services} />
  if (node.type === "codeBlock") {
    const code = textContent(node)
    const highlighted = syntaxHighlighter.tokenize(code, node.attrs?.language)
    return (
      <LearnerTechnicalRoot
        contractKey="runtime.technical.code-block"
        {...dom}
        className="content-code-block"
        data-type="codeBlock"
        data-language={highlighted.language}
      >
        <div className="content-code-block-bar">
          <span className="content-code-block-label">
            <Code2 aria-hidden="true" />
            {highlighted.language === "plaintext"
              ? editorMessage(services.messages, "codeBlockPlainText")
              : highlighted.label}
          </span>
          <CopyButton value={code} messages={services.messages} />
        </div>
        <pre>
          <code>
            <HighlightedCode code={code} language={highlighted.language} />
          </code>
        </pre>
      </LearnerTechnicalRoot>
    )
  }
  if (node.type === "diagram") return <DiagramView node={node} path={path} services={services} />
  if (node.type === "mathBlock")
    return <MathView node={node} inline={false} path={path} services={services} />
  if (node.type === "mathInline") return <MathView node={node} inline />
  if (node.type === "glossaryTerm")
    return (
      <abbr {...dom} className="content-glossary-term" title={stringAttr(node, "definition")}>
        {stringAttr(node, "term")}
      </abbr>
    )
  if (node.type === "steps") {
    const title = stringAttr(node, "title")
    const description = inlineAttr(node, "description")
    return (
      <LearnerRoot
        as="section"
        contractKey="runtime.aside.steps"
        {...dom}
        className="content-block content-steps"
        data-type="steps"
      >
        {title || description.length > 0 ? (
          <LearnerHeader
            icon={<Blocks aria-hidden="true" />}
            title={title}
            description={
              description.length > 0 ? (
                <InlineAttribute
                  node={node}
                  attribute="description"
                  path={path}
                  services={services}
                />
              ) : undefined
            }
          />
        ) : null}
        <ol className="content-steps-content">
          {(node.content ?? []).map((step, index) => (
            <li key={stableKey(step, `${path}.${index}`)} className="content-step" data-type="step">
              <div className="content-step-content">
                {stringAttr(step, "title") ? (
                  <h3 className="content-step-title">{stringAttr(step, "title")}</h3>
                ) : null}
                <RenderChildren node={step} path={`${path}.${index}`} services={services} />
              </div>
            </li>
          ))}
        </ol>
      </LearnerRoot>
    )
  }
  if (node.type === "step") return children
  if (node.type === "poll") {
    const options = Array.isArray(node.attrs?.options)
      ? (node.attrs.options as Array<{ id: string; text: string }>)
      : []
    return (
      <div {...dom}>
        <PollView
          framing={{
            title: stringAttr(node, "title") || editorMessage(services.messages, "pollLabel"),
            description:
              inlineAttr(node, "description").length > 0 ? (
                <InlineAttribute
                  node={node}
                  attribute="description"
                  path={path}
                  services={services}
                />
              ) : undefined,
          }}
          pollId={stringAttr(node, "pollId") || null}
          question={stringAttr(node, "question")}
          options={options}
          vote={services.onPollVote ?? null}
          load={services.onPollLoad ?? null}
          messages={services.messages}
        />
      </div>
    )
  }
  if (node.type === "questionPool") {
    const questions = Array.isArray(node.attrs?.questions)
      ? (node.attrs.questions as PoolQuestion[])
      : []
    const activityId = stringAttr(node, "learnerAnchorId") || stringAttr(node, "id")
    const sectionId = services.sectionByAnchor.get(activityId) ?? null
    return (
      <div {...dom}>
        <QuizView
          framing={{
            title:
              stringAttr(node, "title") || editorMessage(services.messages, "questionPoolLabel"),
            description:
              inlineAttr(node, "description").length > 0 ? (
                <InlineAttribute
                  node={node}
                  attribute="description"
                  path={path}
                  services={services}
                />
              ) : undefined,
          }}
          questions={questions}
          grade={services.onGradeQuiz ?? null}
          saved={services.savedQuiz ?? null}
          onStart={() => {
            if (activityId && sectionId)
              services.onLearnerActivity?.({ type: "quiz_started", activityId, sectionId })
          }}
          messages={services.messages}
        />
      </div>
    )
  }
  return <Fragment>{children}</Fragment>
}

export function DirectDocumentRenderer({
  document,
  services,
}: {
  document: ContentNode
  services: DirectReaderServices
}) {
  const rendererServices = {
    ...services,
    videoHeadingByNode: videoHeadingByNode(document),
  }
  return (
    <div className="content-prose" data-renderer="cursare-reader">
      <DirectNodeRenderer node={document} services={rendererServices} />
    </div>
  )
}

export function DirectNodeRenderer({
  node,
  services,
  path = "0",
}: {
  node: ContentNode
  services: DirectReaderServices
  path?: string
}) {
  return <RenderNode node={node} path={path} services={services} />
}
