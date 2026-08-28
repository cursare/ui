import {
  isSafeVideoSource,
  isVideoProvider,
  resolveVideoUrl,
  type VideoProvider,
} from "@/components/cursare/foundation/model/learner-runtime"

export interface VideoPlaybackSource {
  provider: VideoProvider
  src: string
}

// A known provider keeps its stored URL; a missing or unknown one is inferred only
// through the same strict parser and host policy.
export function videoPlaybackSource(
  rawSrc: unknown,
  rawProvider: unknown,
): VideoPlaybackSource | null {
  if (typeof rawSrc !== "string" || !rawSrc) return null
  if (isVideoProvider(rawProvider)) {
    return isSafeVideoSource(rawSrc, rawProvider) ? { provider: rawProvider, src: rawSrc } : null
  }
  const resolved = resolveVideoUrl(rawSrc)
  return resolved.status === "supported" ? { provider: resolved.provider, src: resolved.src } : null
}
