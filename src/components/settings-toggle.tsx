"use client"

import {
  Frame,
  FrameDescription,
  FramePanel,
  FrameTitle,
} from "@cursare/ui/components/frame"
import { Skeleton } from "@cursare/ui/components/skeleton"
import { Switch } from "@cursare/ui/components/switch"

interface SettingsToggleProps {
  title: string
  description: string
  defaultChecked?: boolean
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  loading?: boolean
  "data-testid"?: string
}

/** A one-line boolean setting: title + description with the switch on the right
 * (the Cal.com settings anatomy). Saves immediately — no footer button. */
export function SettingsToggle({
  title,
  description,
  defaultChecked = false,
  checked,
  onCheckedChange,
  disabled,
  loading = false,
  "data-testid": dataTestId,
}: SettingsToggleProps) {
  const isControlled = checked !== undefined
  return (
    <Frame>
      <FramePanel className="flex items-center justify-between gap-4">
        <div>
            <FrameTitle>{title}</FrameTitle>
            <FrameDescription>{description}</FrameDescription>
        </div>
        {loading ? (
          <Skeleton className="h-5.5 w-9.5 shrink-0 rounded-full sm:h-4.5 sm:w-7.5" />
        ) : (
          <Switch
            checked={isControlled ? checked : undefined}
            defaultChecked={isControlled ? undefined : defaultChecked}
            onCheckedChange={onCheckedChange}
            disabled={disabled}
            data-testid={dataTestId}
          />
        )}
      </FramePanel>
    </Frame>
  )
}
