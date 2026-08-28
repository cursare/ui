export type VideoProvider = "file" | "hls" | "youtube" | "vimeo"

export type VideoUrlResult =
  | { status: "supported"; provider: VideoProvider; src: string }
  | { status: "unsupported-provider"; provider: "loom" }
  | { status: "invalid" }

const VIDEO_FILE_EXTENSION = /\.(?:m4v|mov|mp4|ogv|webm)$/i
const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/
const VIMEO_VIDEO_ID = /^\d+$/

function normalizedHost(url: URL): string {
  return url.hostname.toLowerCase().replace(/^www\./, "")
}

function isHost(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`)
}

function youtubeVideoId(url: URL): string | null {
  const host = normalizedHost(url)
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0]
    return id && YOUTUBE_VIDEO_ID.test(id) ? id : null
  }
  if (!isHost(host, "youtube.com") && !isHost(host, "youtube-nocookie.com")) return null
  const segments = url.pathname.split("/").filter(Boolean)
  const candidate =
    url.pathname === "/watch"
      ? url.searchParams.get("v")
      : ["embed", "live", "shorts", "v"].includes(segments[0] ?? "")
        ? segments[1]
        : null
  return candidate && YOUTUBE_VIDEO_ID.test(candidate) ? candidate : null
}

function vimeoVideo(url: URL): { id: string; hash: string | null } | null {
  const host = normalizedHost(url)
  if (!isHost(host, "vimeo.com")) return null
  const segments = url.pathname.split("/").filter(Boolean)
  const idIndex =
    segments[0] === "video" ? 1 : segments.findIndex((part) => VIMEO_VIDEO_ID.test(part))
  const id = segments[idIndex]
  if (!id || !VIMEO_VIDEO_ID.test(id)) return null
  const candidateHash =
    url.searchParams.get("h") ?? url.searchParams.get("hash") ?? segments[idIndex + 1]
  const hash = candidateHash && /^[A-Za-z0-9]+$/.test(candidateHash) ? candidateHash : null
  return { id, hash }
}

function parsedUrl(value: string): { persisted: string; url: URL } | null {
  if (value.startsWith("/") && !value.startsWith("//")) {
    return { persisted: value, url: new URL(value, "https://cursare.invalid") }
  }
  try {
    const url = new URL(value)
    return url.protocol === "https:" ? { persisted: url.href, url } : null
  } catch {
    return null
  }
}

export function resolveVideoUrl(raw: string): VideoUrlResult {
  const value = raw.trim()
  if (!value || value.length > 2_048) return { status: "invalid" }
  const parsed = parsedUrl(value)
  if (!parsed) return { status: "invalid" }

  const youtubeId = youtubeVideoId(parsed.url)
  if (youtubeId) {
    return {
      status: "supported",
      provider: "youtube",
      src: `https://www.youtube.com/watch?v=${youtubeId}`,
    }
  }
  const vimeo = vimeoVideo(parsed.url)
  if (vimeo) {
    return {
      status: "supported",
      provider: "vimeo",
      src: `https://vimeo.com/${vimeo.id}${vimeo.hash ? `?h=${vimeo.hash}` : ""}`,
    }
  }
  if (isHost(normalizedHost(parsed.url), "loom.com")) {
    return { status: "unsupported-provider", provider: "loom" }
  }

  const path = parsed.url.pathname.toLowerCase()
  if (path.endsWith(".m3u8")) {
    return { status: "supported", provider: "hls", src: parsed.persisted }
  }
  if (VIDEO_FILE_EXTENSION.test(path)) {
    return { status: "supported", provider: "file", src: parsed.persisted }
  }
  return { status: "invalid" }
}

export function isVideoProvider(value: unknown): value is VideoProvider {
  return value === "file" || value === "hls" || value === "youtube" || value === "vimeo"
}

export function isSafeVideoSource(src: unknown, provider: unknown): boolean {
  if (src === null || src === "") return isVideoProvider(provider)
  if (typeof src !== "string" || !isVideoProvider(provider)) return false
  const resolved = resolveVideoUrl(src)
  return resolved.status === "supported" && resolved.provider === provider
}
