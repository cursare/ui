export type VideoShortcutAction =
  | "togglePaused"
  | "seekBackward"
  | "seekForward"
  | "toggleMuted"
  | "toggleFullscreen"

interface ClosestTarget {
  closest: (selector: string) => unknown
}

const EDITABLE_OR_MODAL_SELECTOR = [
  "input",
  "textarea",
  "select",
  '[contenteditable]:not([contenteditable="false"])',
  '[role="dialog"]',
  '[role="menu"]',
  '[role="menuitem"]',
  '[role="slider"]',
  '[data-video-shortcuts="ignore"]',
].join(",")

const SPACE_OWNED_CONTROL_SELECTOR = "button,a,[role=button],[role=checkbox],[role=radio]"

function closestTarget(target: EventTarget | null): ClosestTarget | null {
  if (!target || typeof (target as Partial<ClosestTarget>).closest !== "function") return null
  return target as unknown as ClosestTarget
}

export function shouldIgnoreVideoShortcut(target: EventTarget | null): boolean {
  return Boolean(closestTarget(target)?.closest(EDITABLE_OR_MODAL_SELECTOR))
}

// Never steals input from a native control.
export function videoShortcutAction(event: {
  key: string
  target: EventTarget | null
  defaultPrevented?: boolean
  isComposing?: boolean
  altKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
}): VideoShortcutAction | null {
  if (
    event.defaultPrevented ||
    event.isComposing ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    shouldIgnoreVideoShortcut(event.target)
  ) {
    return null
  }

  const key = event.key.toLowerCase()
  if (key === " " && closestTarget(event.target)?.closest(SPACE_OWNED_CONTROL_SELECTOR)) {
    return null
  }
  if (key === " " || key === "k") return "togglePaused"
  if (key === "j") return "seekBackward"
  if (key === "l") return "seekForward"
  if (key === "m") return "toggleMuted"
  if (key === "f") return "toggleFullscreen"
  return null
}
