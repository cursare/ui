"use client";

import type { DateRange } from "@daypicker/react";
import { enUS } from "@daypicker/react/locale/en-US";
import { es } from "@daypicker/react/locale/es";
import { ptBR } from "@daypicker/react/locale/pt-BR";
import { CalendarDaysIcon, ChevronDownIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@cursare/ui/components/button";
import { Calendar } from "@cursare/ui/components/calendar";
import {
  parseDateValue,
  toDateValue,
} from "@cursare/ui/components/date-picker";
import {
  Popover,
  PopoverPopup,
  PopoverTrigger,
} from "@cursare/ui/components/popover";
import { cn } from "@cursare/ui/lib/utils";

export type DateRangeValue = { from: string; to: string };

export interface DateRangePickerLabels {
  trigger: string;
  presets: string;
  custom: string;
  apply: string;
  cancel: string;
  incomplete: string;
  tooLong: string;
}

export interface DateRangePickerProps {
  value: DateRangeValue;
  valueLabel: string;
  activePreset?: number;
  presets: readonly { days: number; label: string }[];
  labels: DateRangePickerLabels;
  locale?: string;
  max?: string;
  maxDays?: number;
  className?: string;
  onPresetSelect: (days: number) => void;
  onRangeApply: (value: DateRangeValue) => void;
}

function localeConfig(locale: string) {
  const normalized = locale.toLowerCase();
  if (normalized.startsWith("pt")) return ptBR;
  if (normalized.startsWith("es")) return es;
  return enUS;
}

export function inclusiveDateRangeDays(range: DateRange | undefined): number | null {
  if (!range?.from || !range.to) return null;
  const from = Date.UTC(range.from.getFullYear(), range.from.getMonth(), range.from.getDate());
  const to = Date.UTC(range.to.getFullYear(), range.to.getMonth(), range.to.getDate());
  return Math.floor((to - from) / 86_400_000) + 1;
}

export function nextDateRangeDraft(
  current: DateRange | undefined,
  next: DateRange | undefined,
  triggerDate: Date,
): DateRange | undefined {
  return current?.from && current.to ? { from: triggerDate, to: undefined } : next;
}

function toSelected(value: DateRangeValue): DateRange | undefined {
  const from = parseDateValue(value.from);
  const to = parseDateValue(value.to);
  return from && to ? { from, to } : undefined;
}

export function DateRangePicker({
  value,
  valueLabel,
  activePreset,
  presets,
  labels,
  locale = "en-US",
  max,
  maxDays = 366,
  className,
  onPresetSelect,
  onRangeApply,
}: DateRangePickerProps) {
  const selected = useMemo(() => toSelected(value), [value.from, value.to]);
  const maximum = useMemo(() => parseDateValue(max), [max]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(selected);
  const [month, setMonth] = useState(selected?.from ?? maximum ?? new Date());
  const days = inclusiveDateRangeDays(draft);
  const complete = days !== null;
  const valid = complete && days <= maxDays;

  useEffect(() => {
    if (!open) return;
    setDraft(selected);
    setMonth(selected?.from ?? maximum ?? new Date());
  }, [maximum, open, selected]);

  const close = () => setOpen(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            aria-label={labels.trigger}
            className={cn("min-w-40 justify-between", className)}
            variant="outline"
          />
        }
      >
        <span className="flex min-w-0 items-center gap-2">
          <CalendarDaysIcon aria-hidden="true" />
          <span className="truncate">{valueLabel}</span>
        </span>
        <ChevronDownIcon aria-hidden="true" />
      </PopoverTrigger>
      <PopoverPopup align="end" className="w-[min(22rem,calc(100vw-2rem))]">
        <div className="flex flex-col">
          <div aria-label={labels.presets} className="grid grid-cols-3 gap-1 p-1" role="group">
            {presets.map((preset) => (
              <Button
                aria-pressed={activePreset === preset.days}
                key={preset.days}
                onClick={() => {
                  onPresetSelect(preset.days);
                  close();
                }}
                size="sm"
                variant={activePreset === preset.days ? "secondary" : "ghost"}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div className="border-t px-2 pt-3">
            <p className="px-1 font-medium text-sm">{labels.custom}</p>
            <Calendar
              captionLayout="dropdown"
              disabled={maximum ? [{ after: maximum }] : undefined}
              endMonth={maximum}
              locale={localeConfig(locale)}
              mode="range"
              month={month}
              navLayout="after"
              onMonthChange={setMonth}
              onSelect={(next, triggerDate) =>
                setDraft((current) => nextDateRangeDraft(current, next, triggerDate))
              }
              selected={draft}
              startMonth={new Date(2000, 0, 1)}
            />
          </div>
          <div className="flex items-center justify-between gap-3 border-t px-3 py-2">
            <p aria-live="polite" className="text-muted-foreground text-xs">
              {!complete ? labels.incomplete : !valid ? labels.tooLong : `${days}d`}
            </p>
            <div className="flex items-center gap-1">
              <Button onClick={close} size="sm" variant="ghost">
                {labels.cancel}
              </Button>
              <Button
                disabled={!valid || !draft?.from || !draft.to}
                onClick={() => {
                  if (!valid || !draft?.from || !draft.to) return;
                  onRangeApply({ from: toDateValue(draft.from), to: toDateValue(draft.to) });
                  close();
                }}
                size="sm"
              >
                {labels.apply}
              </Button>
            </div>
          </div>
        </div>
      </PopoverPopup>
    </Popover>
  );
}
