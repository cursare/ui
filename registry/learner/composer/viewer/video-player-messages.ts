import type {
  DefaultLayoutTranslations,
  DefaultLayoutWord,
} from "@vidstack/react/player/layouts/default"

export const DEFAULT_VIDEO_PLAYER_MESSAGES = {
  videoPlayerTitle: "Video",
  videoPlayerSectionLabel: "{section} — video",
  videoPlayerLoading: "Loading video…",
  videoPlayerFailure: "This video couldn't be loaded.",
  videoPlayerShortcuts:
    "Keyboard shortcuts: Space or K plays and pauses, J and L seek 10 seconds, M mutes, and F toggles fullscreen.",
  videoPlayerResumePrompt: "Continue from {time}?",
  videoPlayerResumeAction: "Resume",
  videoPlayerStartOver: "Start over",
  videoPlayerTranscript: "Transcript",
  videoPlayerTranscriptSearch: "Search transcript",
  videoPlayerTranscriptEmpty: "No transcript lines match this search.",
  videoPlayerTranscriptFailure: "The transcript couldn't be loaded.",
  videoPlayerAnnouncements: "Announcements",
  videoPlayerAccessibility: "Accessibility",
  videoPlayerAirPlay: "AirPlay",
  videoPlayerAudio: "Audio",
  videoPlayerAuto: "Auto",
  videoPlayerBoost: "Boost",
  videoPlayerCaptions: "Captions",
  videoPlayerCaptionStyles: "Caption styles",
  videoPlayerCaptionsPreview: "Captions look like this",
  videoPlayerChapters: "Chapters",
  videoPlayerClosedCaptionsOff: "Closed captions off",
  videoPlayerClosedCaptionsOn: "Closed captions on",
  videoPlayerConnected: "Connected",
  videoPlayerContinue: "Continue",
  videoPlayerConnecting: "Connecting",
  videoPlayerDefault: "Default",
  videoPlayerDisabled: "Disabled",
  videoPlayerDisconnected: "Disconnected",
  videoPlayerDisplayBackground: "Display background",
  videoPlayerDownload: "Download",
  videoPlayerEnterFullscreen: "Enter fullscreen",
  videoPlayerEnterPip: "Enter picture in picture",
  videoPlayerExitFullscreen: "Exit fullscreen",
  videoPlayerExitPip: "Exit picture in picture",
  videoPlayerFont: "Font",
  videoPlayerFamily: "Family",
  videoPlayerFullscreen: "Fullscreen",
  videoPlayerGoogleCast: "Google Cast",
  videoPlayerKeyboardAnimations: "Keyboard animations",
  videoPlayerLive: "Live",
  videoPlayerLoop: "Loop",
  videoPlayerMute: "Mute",
  videoPlayerNormal: "Normal",
  videoPlayerOff: "Off",
  videoPlayerPause: "Pause",
  videoPlayerPlay: "Play",
  videoPlayerPlayback: "Playback",
  videoPlayerPip: "Picture in picture",
  videoPlayerQuality: "Quality",
  videoPlayerReplay: "Replay",
  videoPlayerReset: "Reset",
  videoPlayerSeekBackward: "Seek backward",
  videoPlayerSeekForward: "Seek forward",
  videoPlayerSeek: "Seek",
  videoPlayerSettings: "Settings",
  videoPlayerSkipToLive: "Skip to live",
  videoPlayerSpeed: "Speed",
  videoPlayerSize: "Size",
  videoPlayerColor: "Color",
  videoPlayerOpacity: "Opacity",
  videoPlayerShadow: "Shadow",
  videoPlayerText: "Text",
  videoPlayerTextBackground: "Text background",
  videoPlayerTrack: "Track",
  videoPlayerUnmute: "Unmute",
  videoPlayerVolume: "Volume",
} as const

export type VideoPlayerMessageKey = keyof typeof DEFAULT_VIDEO_PLAYER_MESSAGES

export const VIDEO_PLAYER_MESSAGE_KEYS = Object.keys(
  DEFAULT_VIDEO_PLAYER_MESSAGES,
) as VideoPlayerMessageKey[]

const DEFAULT_LAYOUT_MESSAGE_KEYS: Record<DefaultLayoutWord, VideoPlayerMessageKey> = {
  Announcements: "videoPlayerAnnouncements",
  Accessibility: "videoPlayerAccessibility",
  AirPlay: "videoPlayerAirPlay",
  Audio: "videoPlayerAudio",
  Auto: "videoPlayerAuto",
  Boost: "videoPlayerBoost",
  Captions: "videoPlayerCaptions",
  "Caption Styles": "videoPlayerCaptionStyles",
  "Captions look like this": "videoPlayerCaptionsPreview",
  Chapters: "videoPlayerChapters",
  "Closed-Captions Off": "videoPlayerClosedCaptionsOff",
  "Closed-Captions On": "videoPlayerClosedCaptionsOn",
  Connected: "videoPlayerConnected",
  Continue: "videoPlayerContinue",
  Connecting: "videoPlayerConnecting",
  Default: "videoPlayerDefault",
  Disabled: "videoPlayerDisabled",
  Disconnected: "videoPlayerDisconnected",
  "Display Background": "videoPlayerDisplayBackground",
  Download: "videoPlayerDownload",
  "Enter Fullscreen": "videoPlayerEnterFullscreen",
  "Enter PiP": "videoPlayerEnterPip",
  "Exit Fullscreen": "videoPlayerExitFullscreen",
  "Exit PiP": "videoPlayerExitPip",
  Font: "videoPlayerFont",
  Family: "videoPlayerFamily",
  Fullscreen: "videoPlayerFullscreen",
  "Google Cast": "videoPlayerGoogleCast",
  "Keyboard Animations": "videoPlayerKeyboardAnimations",
  LIVE: "videoPlayerLive",
  Loop: "videoPlayerLoop",
  Mute: "videoPlayerMute",
  Normal: "videoPlayerNormal",
  Off: "videoPlayerOff",
  Pause: "videoPlayerPause",
  Play: "videoPlayerPlay",
  Playback: "videoPlayerPlayback",
  PiP: "videoPlayerPip",
  Quality: "videoPlayerQuality",
  Replay: "videoPlayerReplay",
  Reset: "videoPlayerReset",
  "Seek Backward": "videoPlayerSeekBackward",
  "Seek Forward": "videoPlayerSeekForward",
  Seek: "videoPlayerSeek",
  Settings: "videoPlayerSettings",
  "Skip To Live": "videoPlayerSkipToLive",
  Speed: "videoPlayerSpeed",
  Size: "videoPlayerSize",
  Color: "videoPlayerColor",
  Opacity: "videoPlayerOpacity",
  Shadow: "videoPlayerShadow",
  Text: "videoPlayerText",
  "Text Background": "videoPlayerTextBackground",
  Track: "videoPlayerTrack",
  Unmute: "videoPlayerUnmute",
  Volume: "videoPlayerVolume",
}

type TranslateVideoPlayer = (
  key: VideoPlayerMessageKey,
  params?: Record<string, string | number>,
) => string

export interface VideoPlayerCopy {
  title: string
  sectionLabel: (section: string) => string
  loading: string
  failure: string
  shortcuts: string
  resumePrompt: (time: string) => string
  resumeAction: string
  startOver: string
  transcript: string
  transcriptSearch: string
  transcriptEmpty: string
  transcriptFailure: string
  translations: DefaultLayoutTranslations
}

export function videoPlayerCopy(t: TranslateVideoPlayer): VideoPlayerCopy {
  return {
    title: t("videoPlayerTitle"),
    sectionLabel: (section) => t("videoPlayerSectionLabel", { section }),
    loading: t("videoPlayerLoading"),
    failure: t("videoPlayerFailure"),
    shortcuts: t("videoPlayerShortcuts"),
    resumePrompt: (time) => t("videoPlayerResumePrompt", { time }),
    resumeAction: t("videoPlayerResumeAction"),
    startOver: t("videoPlayerStartOver"),
    transcript: t("videoPlayerTranscript"),
    transcriptSearch: t("videoPlayerTranscriptSearch"),
    transcriptEmpty: t("videoPlayerTranscriptEmpty"),
    transcriptFailure: t("videoPlayerTranscriptFailure"),
    translations: Object.fromEntries(
      Object.entries(DEFAULT_LAYOUT_MESSAGE_KEYS).map(([word, key]) => [word, t(key)]),
    ) as DefaultLayoutTranslations,
  }
}
