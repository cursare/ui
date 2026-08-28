"use client"

import {
  CursareVideoPlayer,
  type DefaultLayoutTranslations,
  type MediaPlayerInstance,
  type MediaTimeUpdateEvent,
} from "@/components/cursare/composer/media"
import type { VideoProvider, VideoTextTrack } from "@/components/cursare/foundation/model/learner-runtime"
import { Button } from "@/components/cursare/ui/button"
import { Input } from "@/components/cursare/ui/input"
import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react"
import type { VideoPlaybackHandle } from "./contracts"
import { LearnerVisuallyHidden } from "./learner-primitives"
import { reachedVideoMilestones } from "./video-milestones"
import {
  continueVideoPlayback,
  formatVideoTime,
  parseVideoResume,
  videoResumeStorageKey,
} from "./video-resume"
import { videoShortcutAction } from "./video-shortcuts"
import { filterTranscriptCues, parseWebVtt, type TranscriptCue } from "./webvtt"

function controlledVideoPlaybackHandle(player: MediaPlayerInstance): VideoPlaybackHandle {
  let ready = player.state.canPlay
  let destroyed = false
  const waiters = new Set<(available: boolean) => void>()
  const resolveWaiters = (available: boolean) => {
    for (const resolve of waiters) resolve(available)
    waiters.clear()
  }
  return {
    capabilities: () => ({
      playPause: true,
      currentTime: player.state.canPlay,
      seek: player.state.canPlay && player.state.canSeek,
      duration:
        player.state.canPlay && Number.isFinite(player.state.duration) && player.state.duration > 0,
      playbackRate: player.state.canSetPlaybackRate,
      quality: player.state.canSetQuality && player.state.qualities.length > 0,
      fullscreen: player.state.canFullscreen,
      pictureInPicture: player.state.canPictureInPicture,
      events: { readiness: true, ended: true },
    }),
    ready: () => {
      if (destroyed) return
      ready = true
      resolveWaiters(true)
    },
    currentTime: async () => {
      const value = player.currentTime
      return Number.isFinite(value) && value >= 0 ? value : null
    },
    seek: async (seconds) => {
      if (destroyed || !Number.isFinite(seconds) || seconds < 0) return false
      if (!ready && !player.state.canPlay) {
        const available = await new Promise<boolean>((resolve) => waiters.add(resolve))
        if (!available) return false
      }
      try {
        await player.pause()
        player.currentTime = seconds
        await player.pause()
        return true
      } catch {
        return false
      }
    },
    destroy: () => {
      if (destroyed) return
      destroyed = true
      resolveWaiters(false)
    },
  }
}

export interface AccessibleVideoPlayerProps {
  src: string
  provider: VideoProvider
  tracks: VideoTextTrack[]
  title: string
  loadingLabel: string
  failureLabel: string
  shortcutHelp: string
  resumeIdentity: string
  resumePrompt: (time: string) => string
  resumeAction: string
  startOver: string
  transcriptLabel: string
  transcriptSearchLabel: string
  transcriptEmptyLabel: string
  transcriptFailureLabel: string
  translations: DefaultLayoutTranslations
  onPlaybackHandle: (handle: VideoPlaybackHandle) => void
  onMilestone?: (percent: 0 | 25 | 50 | 75 | 100) => void
}

function applyShortcut(event: KeyboardEvent<HTMLElement>, player: MediaPlayerInstance) {
  const action = videoShortcutAction(event)
  if (!action) return
  event.preventDefault()

  if (action === "togglePaused") {
    void (player.state.paused ? player.play() : player.pause()).catch(() => undefined)
    return
  }
  if (action === "toggleMuted") {
    player.muted = !player.muted
    return
  }
  if (action === "seekBackward" || action === "seekForward") {
    if (!player.state.canSeek) return
    const offset = action === "seekBackward" ? -10 : 10
    const end = Number.isFinite(player.duration) && player.duration > 0 ? player.duration : Infinity
    player.currentTime = Math.min(end, Math.max(0, player.currentTime + offset))
    return
  }
  if (!player.state.canFullscreen) return
  void (player.state.fullscreen ? player.exitFullscreen() : player.enterFullscreen()).catch(
    () => undefined,
  )
}

// Learner-only, and loaded lazily.
export function AccessibleVideoPlayer({
  src,
  provider,
  tracks,
  title,
  loadingLabel,
  failureLabel,
  shortcutHelp,
  resumeIdentity,
  resumePrompt,
  resumeAction,
  startOver,
  transcriptLabel,
  transcriptSearchLabel,
  transcriptEmptyLabel,
  transcriptFailureLabel,
  translations,
  onPlaybackHandle,
  onMilestone,
}: AccessibleVideoPlayerProps) {
  const playerRef = useRef<MediaPlayerInstance>(null)
  const handleRef = useRef<VideoPlaybackHandle | null>(null)
  const lastStoredBucket = useRef(-1)
  const transcriptRequestRef = useRef<{ src: string; status: "loading" | "done" } | null>(null)
  const milestonesRef = useRef(new Set<number>())
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [resumeSeconds, setResumeSeconds] = useState<number | null>(null)
  const [transcriptOpen, setTranscriptOpen] = useState(false)
  const [transcriptStatus, setTranscriptStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  )
  const [transcriptCues, setTranscriptCues] = useState<TranscriptCue[]>([])
  const [transcriptQuery, setTranscriptQuery] = useState("")
  const helpId = `video-shortcuts-${useId().replaceAll(":", "")}`
  const resumeKey = videoResumeStorageKey(resumeIdentity)
  const milestoneKey = `${resumeKey}:milestones`
  const transcriptTrack = tracks.find((track) => track.default) ?? tracks[0] ?? null
  const transcriptSrc = transcriptTrack?.src ?? null
  const visibleCues = useMemo(
    () => filterTranscriptCues(transcriptCues, transcriptQuery),
    [transcriptCues, transcriptQuery],
  )

  useEffect(() => {
    const player = playerRef.current
    if (!player) return
    const handle = controlledVideoPlaybackHandle(player)
    handleRef.current = handle
    onPlaybackHandle(handle)
    return () => {
      handle.destroy?.()
      if (handleRef.current === handle) handleRef.current = null
    }
  }, [onPlaybackHandle])

  useEffect(() => {
    const record = parseVideoResume(window.localStorage.getItem(resumeKey))
    if (!record) {
      window.localStorage.removeItem(resumeKey)
      return
    }
    setResumeSeconds(record.seconds)
  }, [resumeKey])

  useEffect(() => {
    try {
      const stored = JSON.parse(window.sessionStorage.getItem(milestoneKey) ?? "[]")
      if (Array.isArray(stored)) milestonesRef.current = new Set(stored.map(Number))
    } catch {
      try {
        window.sessionStorage.removeItem(milestoneKey)
      } catch {}
    }
  }, [milestoneKey])

  const emitMilestone = (percent: 0 | 25 | 50 | 75 | 100) => {
    if (milestonesRef.current.has(percent)) return
    milestonesRef.current.add(percent)
    try {
      window.sessionStorage.setItem(milestoneKey, JSON.stringify([...milestonesRef.current]))
    } catch {}
    onMilestone?.(percent)
  }

  useEffect(() => {
    if (!transcriptOpen || !transcriptSrc) return
    const existingRequest = transcriptRequestRef.current
    if (existingRequest?.src === transcriptSrc) return

    const controller = new AbortController()
    transcriptRequestRef.current = { src: transcriptSrc, status: "loading" }
    setTranscriptStatus("loading")
    fetch(transcriptSrc, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Transcript request failed")
        const cues = parseWebVtt(await response.text())
        if (cues.length === 0) throw new Error("Transcript is empty")
        transcriptRequestRef.current = { src: transcriptSrc, status: "done" }
        setTranscriptCues(cues)
        setTranscriptStatus("ready")
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          if (transcriptRequestRef.current?.src === transcriptSrc) {
            transcriptRequestRef.current = null
          }
          return
        }
        transcriptRequestRef.current = { src: transcriptSrc, status: "done" }
        setTranscriptStatus("error")
      })
    return () => {
      controller.abort()
      if (
        transcriptRequestRef.current?.src === transcriptSrc &&
        transcriptRequestRef.current.status === "loading"
      ) {
        transcriptRequestRef.current = null
      }
    }
  }, [transcriptOpen, transcriptSrc])

  const clearResume = () => {
    window.localStorage.removeItem(resumeKey)
    setResumeSeconds(null)
  }

  const storeProgress = (detail: MediaTimeUpdateEvent["detail"]) => {
    const currentTime = detail.currentTime
    const duration = playerRef.current?.duration ?? 0
    for (const threshold of reachedVideoMilestones(currentTime, duration, milestonesRef.current)) {
      emitMilestone(threshold)
    }
    if (currentTime < 10 || (duration > 0 && duration - currentTime <= 15)) {
      if (duration > 0 && duration - currentTime <= 15) clearResume()
      return
    }
    const bucket = Math.floor(currentTime / 5)
    if (bucket === lastStoredBucket.current) return
    lastStoredBucket.current = bucket
    window.localStorage.setItem(
      resumeKey,
      JSON.stringify({ seconds: currentTime, updatedAt: Date.now() }),
    )
  }

  const seekTo = (seconds: number) => {
    const player = playerRef.current
    if (!player?.state.canSeek) return
    player.currentTime = seconds
    setResumeSeconds(null)
  }

  const continueFrom = (seconds: number) => {
    const player = playerRef.current
    if (!player?.state.canSeek) return
    clearResume()
    void continueVideoPlayback(player, seconds)
  }

  return (
    <div className="content-video-accessible">
      <div className="content-video-frame">
        <div
          className="content-video-controlled"
          data-provider={provider}
          data-player-state={status}
        >
          <CursareVideoPlayer
            ref={playerRef}
            className="content-video-player"
            src={src}
            provider={provider}
            title={title}
            ariaLabel={title}
            aria-describedby={helpId}
            viewType="video"
            streamType="on-demand"
            load="visible"
            posterLoad="visible"
            preload="metadata"
            playsInline
            autoPlay={false}
            storage={null}
            keyDisabled
            keyTarget="player"
            onCanPlay={() => {
              setStatus("ready")
              const duration = playerRef.current?.duration ?? 0
              if (resumeSeconds != null && duration > 0 && duration - resumeSeconds <= 15) {
                clearResume()
              }
              handleRef.current?.ready?.()
            }}
            onTimeUpdate={storeProgress}
            onPlay={() => {
              emitMilestone(0)
            }}
            onEnded={() => {
              clearResume()
              emitMilestone(100)
            }}
            onError={() => {
              setStatus("error")
              handleRef.current?.destroy?.()
            }}
            onKeyDownCapture={(event) => {
              const player = playerRef.current
              if (player) applyShortcut(event, player)
            }}
            tracks={tracks}
            translations={translations}
          />
          {resumeSeconds != null && status === "ready" ? (
            <div className="content-video-resume" role="status">
              <p className="content-video-resume-message">
                {resumePrompt(formatVideoTime(resumeSeconds))}
              </p>
              <div className="content-video-resume-actions">
                <Button
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation()
                    continueFrom(resumeSeconds)
                  }}
                >
                  {resumeAction}
                </Button>
                <Button
                  variant="secondary"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation()
                    continueFrom(0)
                  }}
                >
                  {startOver}
                </Button>
              </div>
            </div>
          ) : null}
          {status === "loading" ? (
            <div className="content-video-status" role="status">
              {loadingLabel}
            </div>
          ) : null}
          {status === "error" ? (
            <div className="content-video-status is-error" role="alert">
              {failureLabel}
            </div>
          ) : null}
          <LearnerVisuallyHidden id={helpId}>{shortcutHelp}</LearnerVisuallyHidden>
        </div>
      </div>
      {transcriptTrack ? (
        <details
          className="content-video-transcript"
          onToggle={(event) => setTranscriptOpen(event.currentTarget.open)}
        >
          <summary>{transcriptLabel}</summary>
          <div className="content-video-transcript-panel">
            <Input
              type="search"
              value={transcriptQuery}
              onChange={(event) => setTranscriptQuery(event.target.value)}
              placeholder={transcriptSearchLabel}
              aria-label={transcriptSearchLabel}
            />
            {transcriptStatus === "loading" ? (
              <p className="content-video-transcript-state" role="status">
                {loadingLabel}
              </p>
            ) : transcriptStatus === "error" ? (
              <p className="content-video-transcript-state" role="alert">
                {transcriptFailureLabel}
              </p>
            ) : transcriptStatus === "ready" && visibleCues.length === 0 ? (
              <p className="content-video-transcript-state">{transcriptEmptyLabel}</p>
            ) : (
              <div className="content-video-transcript-cues">
                {visibleCues.map((cue) => (
                  <Button
                    type="button"
                    variant="ghost"
                    key={`${cue.start}:${cue.end}:${cue.text}`}
                    className="content-video-transcript-cue w-full justify-start text-left"
                    onClick={() => seekTo(cue.start)}
                  >
                    <time>{formatVideoTime(cue.start)}</time>
                    <span>{cue.text}</span>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </details>
      ) : null}
    </div>
  )
}
