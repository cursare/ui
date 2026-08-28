export type ReferenceReaderStatus = "unavailable" | "enrollment-required" | "completed" | "open"

export interface ReferenceReaderState {
  disabled: boolean
  href: string | null
  status: ReferenceReaderStatus
}

export interface ResolveReferenceReaderStateInput {
  base: string | null
  completed: boolean
  navigationEnabled: boolean
  routeSegment: string
  unavailable: boolean
}

// Access semantics stay uncoupled from the URL.
export function resolveReferenceReaderState({
  base,
  completed,
  navigationEnabled,
  routeSegment,
  unavailable,
}: ResolveReferenceReaderStateInput): ReferenceReaderState {
  if (unavailable) {
    return { disabled: true, href: null, status: "unavailable" }
  }
  if (!navigationEnabled) {
    return { disabled: true, href: null, status: "enrollment-required" }
  }
  return {
    disabled: false,
    href: base ? `${base}/${routeSegment}` : null,
    status: completed ? "completed" : "open",
  }
}
