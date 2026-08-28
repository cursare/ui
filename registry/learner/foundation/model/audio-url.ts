export type AudioUrlResult = { status: "supported"; src: string } | { status: "invalid" }

const AUDIO_FILE_EXTENSION = /\.(?:aac|flac|m4a|mp3|mp4|oga|ogg|opus|wav|weba|webm)$/i

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

export function resolveAudioUrl(raw: string): AudioUrlResult {
  const value = raw.trim()
  if (!value || value.length > 2_048) return { status: "invalid" }
  const parsed = parsedUrl(value)
  if (!parsed || !AUDIO_FILE_EXTENSION.test(parsed.url.pathname)) {
    return { status: "invalid" }
  }
  return { status: "supported", src: parsed.persisted }
}

export function isSafeAudioSource(value: unknown): boolean {
  if (value === null || value === "") return true
  return typeof value === "string" && resolveAudioUrl(value).status === "supported"
}
