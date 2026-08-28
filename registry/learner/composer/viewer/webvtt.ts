export interface TranscriptCue {
  start: number
  end: number
  text: string
}

function timestampSeconds(value: string): number | null {
  const parts = value.trim().split(":")
  if (parts.length < 2 || parts.length > 3) return null
  const seconds = Number(parts.pop()?.replace(",", "."))
  const minutes = Number(parts.pop())
  const hours = parts.length === 1 ? Number(parts[0]) : 0
  if (![hours, minutes, seconds].every(Number.isFinite)) return null
  return hours * 3600 + minutes * 60 + seconds
}

export function parseWebVtt(value: string): TranscriptCue[] {
  const blocks = value.replace(/\r/g, "").split(/\n{2,}/)
  const cues: TranscriptCue[] = []
  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
    const timingIndex = lines.findIndex((line) => line.includes(" --> "))
    if (timingIndex < 0) continue
    const timingLine = lines[timingIndex]
    if (!timingLine) continue
    const [rawStart, rawEnd] = timingLine.split(" --> ")
    const start = rawStart ? timestampSeconds(rawStart) : null
    const end = rawEnd ? timestampSeconds(rawEnd.split(/\s+/)[0] ?? "") : null
    const text = lines
      .slice(timingIndex + 1)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim()
    if (start != null && end != null && end >= start && text) cues.push({ start, end, text })
  }
  return cues
}

export function filterTranscriptCues(
  cues: readonly TranscriptCue[],
  query: string,
): TranscriptCue[] {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return [...cues]
  return cues.filter((cue) => cue.text.toLocaleLowerCase().includes(needle))
}
