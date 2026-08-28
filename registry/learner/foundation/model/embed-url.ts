export const EMBED_PROVIDER_LABELS = [
  "StackBlitz",
  "CodeSandbox",
  "CodePen",
  "Figma",
  "Desmos",
  "GeoGebra",
] as const

export type EmbedProvider =
  | "stackblitz"
  | "codesandbox"
  | "codepen"
  | "figma"
  | "desmos"
  | "geogebra"

export interface ParsedEmbedUrl {
  provider: EmbedProvider
  label: (typeof EMBED_PROVIDER_LABELS)[number]
  src: string
}

const ID_RE = /^[\w-]+$/

function hostIs(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`)
}

export function parseEmbedUrl(raw: string): ParsedEmbedUrl | null {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  if (url.protocol !== "https:") return null
  const host = url.hostname.toLowerCase()
  const segments = url.pathname.split("/").filter(Boolean)

  if (hostIs(host, "stackblitz.com")) {
    if (!url.searchParams.has("embed")) url.searchParams.set("embed", "1")
    return { provider: "stackblitz", label: "StackBlitz", src: url.toString() }
  }

  if (hostIs(host, "codesandbox.io")) {
    let id: string | undefined
    if (segments[0] === "p" && segments[1] === "sandbox") id = segments[2]
    else if (segments[0] === "s" || segments[0] === "embed") id = segments[1]
    if (!id || !ID_RE.test(id)) return null
    return {
      provider: "codesandbox",
      label: "CodeSandbox",
      src: `https://codesandbox.io/embed/${id}`,
    }
  }

  if (hostIs(host, "codepen.io")) {
    const [user, kind, id] = segments
    if (!user || !id || (kind !== "pen" && kind !== "embed")) return null
    if (!ID_RE.test(user) || !ID_RE.test(id)) return null
    return { provider: "codepen", label: "CodePen", src: `https://codepen.io/${user}/embed/${id}` }
  }

  if (hostIs(host, "figma.com")) {
    const kind = segments[0] ?? ""
    if (kind !== "file" && kind !== "proto" && kind !== "design") return null
    return {
      provider: "figma",
      label: "Figma",
      src: `https://www.figma.com/embed?embed_host=cursare&url=${encodeURIComponent(url.toString())}`,
    }
  }

  if (hostIs(host, "desmos.com")) {
    if (segments[0] !== "calculator") return null
    return { provider: "desmos", label: "Desmos", src: url.toString() }
  }

  if (hostIs(host, "geogebra.org")) {
    if (segments[0] === "m" && segments[1]) {
      if (!ID_RE.test(segments[1])) return null
      return {
        provider: "geogebra",
        label: "GeoGebra",
        src: `https://www.geogebra.org/material/iframe/id/${segments[1]}`,
      }
    }
    if (segments.length === 0) return null
    return { provider: "geogebra", label: "GeoGebra", src: url.toString() }
  }

  return null
}
