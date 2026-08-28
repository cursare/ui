import { cn } from "@/lib/utils"
import {
  type ComponentPropsWithoutRef,
  type CSSProperties,
  cloneElement,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react"
import {
  type LearnerComponentKey,
  type LearnerEffect,
  type LearnerMeasure as LearnerMeasureRole,
  type LearnerSurface as LearnerSurfaceRole,
  learnerComponentAttributes,
} from "./learner-component-registry"

export type LearnerRootElement =
  | "a"
  | "article"
  | "aside"
  | "blockquote"
  | "div"
  | "figure"
  | "footer"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "header"
  | "hr"
  | "li"
  | "main"
  | "nav"
  | "ol"
  | "p"
  | "section"
  | "span"
  | "table"
  | "ul"

export interface LearnerRootProps extends HTMLAttributes<HTMLElement> {
  as?: LearnerRootElement
  contractKey: LearnerComponentKey
  download?: boolean | string
  href?: string
  rel?: string
  render?: ReactElement
  start?: number
  target?: string
}

export function LearnerRoot({ as, contractKey, className, render, ...props }: LearnerRootProps) {
  const contractProps = learnerComponentAttributes(contractKey)
  if (render) {
    const renderedRoot = render as ReactElement<{
      className?: string
      "data-learner-visual-owner"?: "host"
    }>
    return cloneElement(renderedRoot, {
      ...props,
      ...contractProps,
      "data-learner-visual-owner": "host",
      className: cn("learner-component", renderedRoot.props.className, className),
    })
  }

  const Component = as ?? "div"
  return <Component {...props} {...contractProps} className={cn("learner-component", className)} />
}

interface LearnerSurfaceProps extends ComponentPropsWithoutRef<"div"> {
  surface: LearnerSurfaceRole
}

export function LearnerSurfaceRegion({ surface, className, ...props }: LearnerSurfaceProps) {
  return (
    <div data-learner-surface={surface} className={cn("learner-surface", className)} {...props} />
  )
}

interface LearnerMeasureProps extends ComponentPropsWithoutRef<"div"> {
  measure: LearnerMeasureRole
}

export function LearnerMeasureRegion({ measure, className, ...props }: LearnerMeasureProps) {
  return (
    <div data-learner-measure={measure} className={cn("learner-measure", className)} {...props} />
  )
}

interface LearnerEffectRegionProps extends ComponentPropsWithoutRef<"div"> {
  effect: LearnerEffect
}

export function LearnerEffectRegion({ effect, className, ...props }: LearnerEffectRegionProps) {
  return <div data-learner-effect={effect} className={cn("learner-effect", className)} {...props} />
}

interface LearnerHeaderProps extends Omit<ComponentPropsWithoutRef<"header">, "title"> {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  metadata?: ReactNode
  actions?: ReactNode
}

export function LearnerHeader({
  icon,
  title,
  description,
  metadata,
  actions,
  className,
  ...props
}: LearnerHeaderProps) {
  return (
    <header className={cn("learner-component-header", className)} {...props}>
      {icon ? <span className="learner-component-icon">{icon}</span> : null}
      <div className="learner-component-heading">
        <div className="learner-component-title">{title}</div>
        {description ? <div className="learner-component-description">{description}</div> : null}
        {metadata ? <div className="learner-component-metadata">{metadata}</div> : null}
      </div>
      {actions ? <div className="learner-component-actions">{actions}</div> : null}
    </header>
  )
}

interface LearnerBlockShellProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  actions?: ReactNode
  bodyClassName?: string
  description?: ReactNode
  icon?: ReactNode
  title?: ReactNode
}

export function LearnerBlockShell({
  actions,
  bodyClassName,
  children,
  className,
  description,
  icon,
  title,
  ...props
}: LearnerBlockShellProps) {
  const hasHeader = Boolean(title || description)
  return (
    <div className={cn("learner-block-shell", className)} {...props}>
      {hasHeader ? (
        <LearnerHeader
          actions={actions}
          className="learner-block-shell-header"
          description={description}
          icon={icon}
          title={title ?? ""}
        />
      ) : null}
      <div className={cn("learner-block-shell-body", bodyClassName)}>{children}</div>
    </div>
  )
}

const learnerVisuallyHiddenStyle: CSSProperties = {
  position: "absolute",
  inlineSize: 1,
  blockSize: 1,
  overflow: "hidden",
  margin: -1,
  padding: 0,
  border: 0,
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
}

export function LearnerVisuallyHidden({ style, ...props }: ComponentPropsWithoutRef<"span">) {
  return <span {...props} style={{ ...style, ...learnerVisuallyHiddenStyle }} />
}

export function LearnerInstruction({ className, ...props }: ComponentPropsWithoutRef<"p">) {
  return <p className={cn("learner-component-instruction", className)} {...props} />
}

interface LearnerProgressProps extends ComponentPropsWithoutRef<"div"> {
  label: ReactNode
  value: number
  max?: number
}

export function LearnerProgress({
  label,
  value,
  max = 100,
  className,
  ...props
}: LearnerProgressProps) {
  const range = Math.max(1, max)
  const bounded = Math.max(0, Math.min(range, value))
  return (
    <div className={cn("learner-component-progress", className)} {...props}>
      <div className="learner-component-progress-label">{label}</div>
      <div
        className="learner-component-progress-track"
        role="progressbar"
        aria-valuemax={range}
        aria-valuemin={0}
        aria-valuenow={bounded}
      >
        <span style={{ "--learner-progress": `${(bounded / range) * 100}%` } as CSSProperties} />
      </div>
    </div>
  )
}

export function LearnerActions({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("learner-component-action-row", className)} {...props} />
}

interface LearnerStatusProps extends ComponentPropsWithoutRef<"div"> {
  kind?: "status" | "alert"
}

export function LearnerStatus({ kind = "status", className, ...props }: LearnerStatusProps) {
  return (
    <div
      aria-atomic="true"
      aria-live={kind === "alert" ? "assertive" : "polite"}
      role={kind}
      className={cn("learner-component-feedback", className)}
      {...props}
    />
  )
}

export function LearnerEmptyState({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("learner-component-empty", className)} {...props} />
}
