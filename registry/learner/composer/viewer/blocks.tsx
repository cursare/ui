"use client"

import type { LucideIcon } from "lucide-react"
import { type KeyboardEventHandler, type ReactNode, useCallback, useId, useState } from "react"
import type { LearnerComponentKey } from "./learner-component-registry"
import { LearnerHeader, LearnerRoot } from "./learner-primitives"

export function ViewBlock({
  name,
  children,
  inline = false,
  className,
  tabIndex,
  onKeyDown,
  learnerContract,
}: {
  name: string
  children?: ReactNode
  inline?: boolean
  className?: string
  tabIndex?: number
  onKeyDown?: KeyboardEventHandler<HTMLElement>
  learnerContract?: LearnerComponentKey
}) {
  const Tag = inline ? "span" : "div"
  const resolvedClassName = `content-block content-${name}${className ? ` ${className}` : ""}`
  if (learnerContract) {
    return (
      <LearnerRoot
        as={Tag}
        contractKey={learnerContract}
        className={resolvedClassName}
        data-type={name}
        tabIndex={tabIndex}
        onKeyDown={onKeyDown}
      >
        {children}
      </LearnerRoot>
    )
  }
  return (
    <Tag className={resolvedClassName} data-type={name} tabIndex={tabIndex} onKeyDown={onKeyDown}>
      {children}
    </Tag>
  )
}

export function ViewCard({ children, className }: { children?: ReactNode; className?: string }) {
  return <div className={`content-block-card${className ? ` ${className}` : ""}`}>{children}</div>
}

export function ReaderBlock({
  name,
  icon: Icon,
  label,
  description,
  actions,
  children,
  bodyClassName,
  className,
  learnerContract,
}: {
  name: string
  icon?: LucideIcon
  label?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  bodyClassName?: string
  className?: string
  learnerContract?: LearnerComponentKey
}) {
  return (
    <ViewBlock name={name} className={className} learnerContract={learnerContract}>
      <ReaderBlockContent
        icon={Icon}
        label={label}
        description={description}
        actions={actions}
        bodyClassName={bodyClassName}
      >
        {children}
      </ReaderBlockContent>
    </ViewBlock>
  )
}

export function ReaderBlockContent({
  icon: Icon,
  label,
  description,
  actions,
  children,
  bodyClassName,
}: {
  icon?: LucideIcon
  label?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  bodyClassName?: string
}) {
  return (
    <>
      {label ? (
        <LearnerHeader
          icon={Icon ? <Icon aria-hidden="true" /> : undefined}
          title={label}
          description={description}
          actions={actions}
        />
      ) : null}
      {bodyClassName ? <div className={bodyClassName}>{children}</div> : children}
    </>
  )
}

export function useActiveChild(total: number) {
  const uid = useId()
  const [active, setActive] = useState(0)
  const current = Math.min(active, Math.max(0, total - 1))
  const goTo = useCallback(
    (index: number) => setActive(Math.min(Math.max(0, index), Math.max(0, total - 1))),
    [total],
  )
  return { uid, active: current, goTo }
}
