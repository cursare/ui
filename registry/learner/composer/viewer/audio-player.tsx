"use client"

import { Button } from "@/components/cursare/ui/button"
import { Pause, Play, Volume2 } from "lucide-react"
import { useRef, useState } from "react"

export interface ReaderAudioPlayerLabels {
  play: string
  pause: string
  position: string
  unavailable: string
}

export function ReaderAudioPlayer({
  src,
  labels,
}: {
  src: string
  labels: ReaderAudioPlayerLabels
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [unavailable, setUnavailable] = useState(false)

  const toggle = async () => {
    const audio = audioRef.current
    if (!audio || unavailable) return
    if (audio.paused) {
      try {
        await audio.play()
      } catch {
        setUnavailable(true)
      }
    } else {
      audio.pause()
    }
  }

  return (
    <div className="content-audio-player" data-unavailable={unavailable || undefined}>
      {/* biome-ignore lint/a11y/useMediaCaption: the authored transcript belongs in the surrounding lesson. */}
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onCanPlay={() => setUnavailable(false)}
        onLoadedMetadata={(event) =>
          setDuration(
            Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0,
          )
        }
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setUnavailable(true)}
      />
      <Button
        type="button"
        variant="outline"
        className="content-audio-toggle"
        disabled={unavailable}
        onClick={toggle}
        aria-label={playing ? labels.pause : labels.play}
      >
        {playing ? <Pause /> : <Play />}
      </Button>
      <Volume2 className="content-audio-volume" aria-hidden />
      <input
        className="content-audio-seek"
        type="range"
        min={0}
        max={duration || 0}
        step="0.1"
        value={Math.min(currentTime, duration || 0)}
        disabled={unavailable || duration === 0}
        aria-label={labels.position}
        onChange={(event) => {
          const next = Number(event.currentTarget.value)
          if (audioRef.current) audioRef.current.currentTime = next
          setCurrentTime(next)
        }}
      />
      <span className="content-audio-time">
        {unavailable
          ? labels.unavailable
          : `${formatAudioTime(currentTime)} / ${formatAudioTime(duration)}`}
      </span>
    </div>
  )
}

function formatAudioTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0:00"
  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60)
  return `${minutes}:${String(seconds).padStart(2, "0")}`
}
