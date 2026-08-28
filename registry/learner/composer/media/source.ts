import type { VideoProvider } from "@/components/cursare/foundation/model/learner-runtime"
import type { PlayerSrc } from "@vidstack/react"

export function videoPlayerSource(provider: VideoProvider, src: string): PlayerSrc {
  if (provider === "youtube") return { src, type: "video/youtube" }
  if (provider === "vimeo") return { src, type: "video/vimeo" }
  if (provider === "hls") return { src, type: "application/x-mpegurl" }
  return src
}
