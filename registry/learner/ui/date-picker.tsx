"use client";

import { enUS } from "@daypicker/react/locale/en-US";
import { es } from "@daypicker/react/locale/es";
import { ptBR } from "@daypicker/react/locale/pt-BR";
import { CalendarIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Button,
  type ButtonProps,
} from "@/components/cursare/ui/button";
import { Calendar } from "@/components/cursare/ui/calendar";
import {
  Popover,
  PopoverPopup,
  PopoverTrigger,
} from "@/components/cursare/ui/popover";
import { cn } from "@/lib/utils";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDateValue(value?: string | null): Date | undefined {
  if (!value) return undefined;
  const match = ISO_DATE.exec(value);
  if (!match) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : undefined;
}

export function toDateValue(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localeConfig(locale: string) {
  const normalized = locale.toLowerCase();
  if (normalized.startsWith("pt")) return { calendar: ptBR, intl: "pt-BR" };
  if (normalized.startsWith("es")) return { calendar: es, intl: "es" };
  return { calendar: enUS, intl: "en-US" };
}

function isWithinBounds(date: Date, min?: Date, max?: Date): boolean {
  return (!min || date >= min) && (!max || date <= max);
}

export interface DatePickerProps
  extends Omit<
    ButtonProps,
    "children" | "defaultValue" | "onChange" | "onClick" | "value"
  > {
  value?: string;
  onValueChange?: (value: string) => void;
  locale?: string;
  placeholder?: string;
  clearLabel?: string;
  todayLabel?: string;
  min?: string;
  max?: string;
  name?: string;
  clearable?: boolean;
  disablePast?: boolean;
}

export function DatePicker({
  value = "",
  onValueChange,
  locale = "en-US",
  placeholder = "Select date",
  clearLabel = "Clear",
  todayLabel = "Today",
  min,
  max,
  name,
  clearable = true,
  disablePast = false,
  className,
  disabled,
  ...buttonProps
}: DatePickerProps) {
  const selected = parseDateValue(value);
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);
  const minimumFromProp = parseDateValue(min);
  const minimum =
    disablePast && (!minimumFromProp || minimumFromProp < today)
      ? today
      : minimumFromProp;
  const maximum = parseDateValue(max);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(selected ?? today);
  const resolvedLocale = localeConfig(locale);
  const calendarStart =
    minimum ?? new Date(today.getFullYear() - 100, 0, 1);
  const calendarEnd =
    maximum ?? new Date(today.getFullYear() + 50, 11, 31);

  useEffect(() => {
    const next = parseDateValue(value);
    if (next) setMonth(next);
  }, [value]);

  const formatted = selected
    ? new Intl.DateTimeFormat(resolvedLocale.intl, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(selected)
    : null;

  const choose = (date: Date | undefined) => {
    if (!date) return;
    onValueChange?.(toDateValue(date));
    setOpen(false);
  };

  return (
    <>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              {...buttonProps}
              className={cn(
                "w-full justify-between font-normal",
                !formatted && "text-muted-foreground",
                className,
              )}
              disabled={disabled}
              variant="outline"
            />
          }
        >
          <span className="truncate">{formatted ?? placeholder}</span>
          <CalendarIcon className="size-4 shrink-0" aria-hidden="true" />
        </PopoverTrigger>
        <PopoverPopup align="start">
          <div className="flex flex-col">
            <Calendar
              mode="single"
              selected={selected}
              month={month}
              onMonthChange={setMonth}
              onSelect={choose}
              locale={resolvedLocale.calendar}
              captionLayout="dropdown"
              navLayout="after"
              startMonth={calendarStart}
              endMonth={calendarEnd}
              disabled={[
                ...(minimum ? [{ before: minimum }] : []),
                ...(maximum ? [{ after: maximum }] : []),
              ]}
            />
            <div className="flex items-center justify-between border-t px-1 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={!clearable || !value}
                onClick={() => {
                  onValueChange?.("");
                  setOpen(false);
                }}
              >
                {clearLabel}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={!isWithinBounds(today, minimum, maximum)}
                onClick={() => choose(today)}
              >
                {todayLabel}
              </Button>
            </div>
          </div>
        </PopoverPopup>
      </Popover>
    </>
  );
}
