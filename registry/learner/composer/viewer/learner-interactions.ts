"use client"

import { type SyntheticEvent, useCallback, useRef } from "react"

export function ownLearnerEvent(event: Pick<SyntheticEvent, "stopPropagation">): void {
  event.stopPropagation()
}

export function useFocusReturn() {
  const returnTarget = useRef<HTMLElement | null>(null)
  const captureFocus = useCallback(() => {
    returnTarget.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
  }, [])
  const restoreFocus = useCallback(() => {
    returnTarget.current?.focus({ preventScroll: true })
    returnTarget.current = null
  }, [])
  return { captureFocus, restoreFocus }
}
