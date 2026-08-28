export type VideoProgressMilestone = 25 | 50 | 75

export function reachedVideoMilestones(
  currentTime: number,
  duration: number,
  emitted: ReadonlySet<number>,
): VideoProgressMilestone[] {
  if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0) return []
  const percent = (Math.max(0, currentTime) / duration) * 100
  return ([25, 50, 75] as const).filter(
    (threshold) => percent >= threshold && !emitted.has(threshold),
  )
}
