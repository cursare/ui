"use client"

import "@vidstack/react/player/styles/default/theme.css"
import "@vidstack/react/player/styles/default/layouts/video.css"

import type { VideoProvider, VideoTextTrack } from "@/components/cursare/foundation/model/learner-runtime"
import {
  MediaPlayer,
  type MediaPlayerInstance,
  type MediaPlayerProps,
  MediaProvider,
  Track,
} from "@vidstack/react"
import {
  type DefaultLayoutTranslations,
  DefaultVideoLayout,
  defaultLayoutIcons,
} from "@vidstack/react/player/layouts/default"
import { forwardRef } from "react"
import { videoPlayerSource } from "./source"

export interface CursareVideoPlayerProps
  extends Omit<MediaPlayerProps, "ariaLabel" | "children" | "src" | "title"> {
  ariaLabel?: string
  provider: VideoProvider
  src: string
  title: string
  tracks?: readonly VideoTextTrack[]
  translations?: DefaultLayoutTranslations
}

export const CursareVideoPlayer = forwardRef<MediaPlayerInstance, CursareVideoPlayerProps>(
  function CursareVideoPlayer(
    {
      ariaLabel,
      autoPlay = false,
      load = "visible",
      playsInline = true,
      posterLoad = "visible",
      preload = "metadata",
      provider,
      src,
      storage = null,
      streamType = "on-demand",
      title,
      tracks = [],
      translations,
      viewType = "video",
      ...props
    },
    ref,
  ) {
    return (
      <MediaPlayer
        {...props}
        ref={ref}
        src={videoPlayerSource(provider, src)}
        title={title}
        ariaLabel={ariaLabel ?? title}
        viewType={viewType}
        streamType={streamType}
        load={load}
        posterLoad={posterLoad}
        preload={preload}
        playsInline={playsInline}
        autoPlay={autoPlay}
        storage={storage}
      >
        <MediaProvider>
          {tracks.map((track) => (
            <Track
              key={`${track.kind}:${track.lang}:${track.src}`}
              src={track.src}
              kind={track.kind}
              label={track.label}
              lang={track.lang}
              default={track.default}
            />
          ))}
        </MediaProvider>
        <DefaultVideoLayout
          icons={defaultLayoutIcons}
          translations={translations}
          noKeyboardAnimations
          slots={{ airPlayButton: null, googleCastButton: null, pipButton: null }}
        />
      </MediaPlayer>
    )
  },
)
