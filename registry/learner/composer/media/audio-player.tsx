"use client"

import "@vidstack/react/player/styles/default/theme.css"
import "@vidstack/react/player/styles/default/layouts/audio.css"

import {
  MediaPlayer,
  type MediaPlayerInstance,
  type MediaPlayerProps,
  MediaProvider,
} from "@vidstack/react"
import {
  DefaultAudioLayout,
  type DefaultLayoutTranslations,
  defaultLayoutIcons,
} from "@vidstack/react/player/layouts/default"
import { forwardRef } from "react"

export interface CursareAudioPlayerProps
  extends Omit<MediaPlayerProps, "ariaLabel" | "children" | "src" | "title"> {
  ariaLabel?: string
  src: string
  title: string
  translations?: DefaultLayoutTranslations
}

export const CursareAudioPlayer = forwardRef<MediaPlayerInstance, CursareAudioPlayerProps>(
  function CursareAudioPlayer(
    {
      ariaLabel,
      autoPlay = false,
      load = "visible",
      preload = "metadata",
      src,
      storage = null,
      streamType = "on-demand",
      title,
      translations,
      viewType = "audio",
      ...props
    },
    ref,
  ) {
    return (
      <MediaPlayer
        {...props}
        ref={ref}
        src={src}
        title={title}
        ariaLabel={ariaLabel ?? title}
        viewType={viewType}
        streamType={streamType}
        load={load}
        preload={preload}
        autoPlay={autoPlay}
        storage={storage}
      >
        <MediaProvider />
        <DefaultAudioLayout
          icons={defaultLayoutIcons}
          translations={translations}
          noKeyboardAnimations
          slots={{ airPlayButton: null, googleCastButton: null }}
        />
      </MediaPlayer>
    )
  },
)
