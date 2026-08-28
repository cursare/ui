export interface VideoResumeRecord {
  seconds: number
  updatedAt: number
}

export async function continueVideoPlayback(
  player: { currentTime: number; play: () => Promise<void> },
  seconds: number,
): Promise<void> {
  player.currentTime = seconds
  await player.play()
}

const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000

export function videoResumeStorageKey(identity: string): string {
  let hash = 2166136261
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `cursare:video:v1:${(hash >>> 0).toString(36)}`
}

export function parseVideoResume(value: string | null, now = Date.now()): VideoResumeRecord | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Partial<VideoResumeRecord>
    if (
      typeof parsed.seconds !== "number" ||
      !Number.isFinite(parsed.seconds) ||
      parsed.seconds < 10 ||
      typeof parsed.updatedAt !== "number" ||
      now - parsed.updatedAt < 0 ||
      now - parsed.updatedAt > MAX_AGE_MS
    ) {
      return null
    }
    return { seconds: parsed.seconds, updatedAt: parsed.updatedAt }
  } catch {
    return null
  }
}

export function formatVideoTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const rest = whole % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
    : `${minutes}:${String(rest).padStart(2, "0")}`
}
