"use client";

import { CheckIcon, ChevronDownIcon } from "lucide-react";
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  isPossiblePhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/min";
import * as React from "react";
import { Input } from "@/components/cursare/ui/input";
import {
  Popover,
  PopoverPopup,
  PopoverTrigger,
} from "@/components/cursare/ui/popover";
import { cn } from "@/lib/utils";

export interface PhoneCountryOption {
  value: CountryCode;
  name: string;
  callingCode: string;
  flag: string;
}

export type PhoneCountryCode = CountryCode;

const COUNTRIES = getCountries();
const COUNTRY_SET = new Set<string>(COUNTRIES);

export function countryFlag(country: CountryCode): string {
  return country.replace(/[A-Z]/g, (letter) =>
    String.fromCodePoint(127397 + letter.charCodeAt(0)),
  );
}

export function phoneCountryOptions(locale = "en"): PhoneCountryOption[] {
  const names = new Intl.DisplayNames([locale], { type: "region" });
  return COUNTRIES.map((country) => ({
    value: country,
    name: names.of(country) ?? country,
    callingCode: getCountryCallingCode(country),
    flag: countryFlag(country),
  })).sort((left, right) => left.name.localeCompare(right.name, locale));
}

export function phoneCountryFromLocale(locale: string): CountryCode | null {
  try {
    const region = new Intl.Locale(locale).maximize().region;
    return region && COUNTRY_SET.has(region) ? (region as CountryCode) : null;
  } catch {
    return null;
  }
}

export function phoneCountryFromValue(
  value: string,
  fallback: CountryCode,
): CountryCode {
  if (!value.startsWith("+")) return fallback;
  const parsed = parsePhoneNumberFromString(value);
  if (parsed?.country) return parsed.country;
  const formatter = new AsYouType();
  formatter.input(value);
  return formatter.getCountry() ?? fallback;
}

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

function nationalDigits(value: string, country: CountryCode): string {
  if (!value.startsWith("+")) return digits(value);
  const parsed = parsePhoneNumberFromString(value);
  if (parsed?.country === country) return parsed.nationalNumber;
  const allDigits = digits(value);
  const callingCode = getCountryCallingCode(country);
  return allDigits.startsWith(callingCode) ? allDigits.slice(callingCode.length) : allDigits;
}

export function normalizePhoneValue(country: CountryCode, value: string): string {
  const clean = value.trim();
  if (!clean) return "";
  const number = digits(clean);
  if (!number) return "";
  return clean.startsWith("+")
    ? `+${number}`
    : `+${getCountryCallingCode(country)}${number}`;
}

export function isPossiblePhoneValue(value: string): boolean {
  return value.startsWith("+") && isPossiblePhoneNumber(value);
}

function displayPhoneValue(value: string, country: CountryCode): string {
  const number = nationalDigits(value, country);
  return number ? new AsYouType(country).input(number) : "";
}

export interface PhoneInputProps
  extends Omit<
    React.ComponentProps<"input">,
    "defaultValue" | "onChange" | "size" | "type" | "value"
  > {
  value: string;
  onValueChange: (value: string) => void;
  defaultCountry?: CountryCode;
  locale?: string;
  countryLabel?: string;
  countrySearchPlaceholder?: string;
  countryNoResults?: string;
  ref?: React.Ref<HTMLInputElement>;
}

export function PhoneInput({
  value,
  onValueChange,
  defaultCountry = "BR",
  locale = "en",
  countryLabel = "Country calling code",
  countrySearchPlaceholder = "Search country…",
  countryNoResults = "No countries found.",
  className,
  disabled,
  id,
  ref,
  ...props
}: PhoneInputProps): React.ReactElement {
  const options = React.useMemo(() => phoneCountryOptions(locale), [locale]);
  const [country, setCountry] = React.useState<CountryCode>(() =>
    phoneCountryFromValue(value, defaultCountry),
  );
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    setCountry((current) =>
      value ? phoneCountryFromValue(value, current) : defaultCountry,
    );
  }, [defaultCountry, value]);

  const selected = options.find((option) => option.value === country) ?? options[0];
  const normalizedQuery = query.trim().toLocaleLowerCase(locale);
  const filtered = normalizedQuery
    ? options.filter((option) =>
        `${option.name} ${option.value} +${option.callingCode}`
          .toLocaleLowerCase(locale)
          .includes(normalizedQuery),
      )
    : options;

  const chooseCountry = (next: CountryCode) => {
    const currentNational = nationalDigits(value, country);
    setCountry(next);
    setQuery("");
    setOpen(false);
    onValueChange(currentNational ? normalizePhoneValue(next, currentNational) : "");
  };

  const changeNumber = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    if (raw.trimStart().startsWith("+")) {
      const next = normalizePhoneValue(country, raw.trimStart());
      const detected = phoneCountryFromValue(next, country);
      if (detected !== country) setCountry(detected);
      onValueChange(next);
      return;
    }
    onValueChange(normalizePhoneValue(country, raw));
  };

  return (
    <div
      className={cn(
        "relative inline-flex h-8.5 w-full min-w-0 rounded-lg border border-input bg-background not-dark:bg-clip-padding text-base text-foreground shadow-xs/5 ring-ring/24 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] not-has-disabled:not-focus-within:not-has-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] pointer-coarse:min-h-11 focus-within:border-ring focus-within:ring-[3px] has-aria-invalid:border-destructive/36 focus-within:has-aria-invalid:border-destructive/64 focus-within:has-aria-invalid:ring-destructive/16 has-disabled:opacity-64 sm:h-7.5 sm:text-sm dark:bg-input/32 dark:has-aria-invalid:ring-destructive/24 dark:not-has-disabled:not-focus-within:not-has-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)]",
        className,
      )}
      data-slot="phone-input-control"
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          aria-label={
            selected
              ? `${countryLabel}: ${selected.name}, +${selected.callingCode}`
              : countryLabel
          }
          className="relative z-10 inline-flex shrink-0 items-center gap-1.5 rounded-s-[inherit] border-e px-2.5 outline-none hover:bg-muted/64 focus-visible:bg-muted/64 disabled:pointer-events-none"
          disabled={disabled}
          type="button"
        >
          <span className="text-base leading-none" aria-hidden="true">
            {selected?.flag}
          </span>
          <span className="font-medium tabular-nums">+{selected?.callingCode}</span>
          <ChevronDownIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
        </PopoverTrigger>
        <PopoverPopup
          align="start"
          className="w-[min(22rem,var(--available-width))]"
          sideOffset={6}
        >
          <div className="flex w-full flex-col gap-2">
            <Input
              autoFocus
              aria-label={countrySearchPlaceholder}
              placeholder={countrySearchPlaceholder}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="max-h-64 overflow-y-auto" role="listbox" aria-label={countryLabel}>
              {filtered.length ? (
                filtered.map((option) => (
                  <button
                    aria-selected={option.value === country}
                    className="grid min-h-9 w-full grid-cols-[1.5rem_1fr_auto_1rem] items-center gap-2 rounded-md px-2 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent"
                    key={option.value}
                    onClick={() => chooseCountry(option.value)}
                    role="option"
                    type="button"
                  >
                    <span className="text-base" aria-hidden="true">
                      {option.flag}
                    </span>
                    <span className="truncate">{option.name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      +{option.callingCode}
                    </span>
                    {option.value === country ? (
                      <CheckIcon className="size-4" aria-hidden="true" />
                    ) : null}
                  </button>
                ))
              ) : (
                <p className="px-2 py-6 text-center text-muted-foreground text-sm">
                  {countryNoResults}
                </p>
              )}
            </div>
          </div>
        </PopoverPopup>
      </Popover>
      <input
        {...props}
        autoComplete={props.autoComplete ?? "tel"}
        className="relative z-10 min-w-0 flex-1 rounded-e-[inherit] bg-transparent px-3 leading-8.5 outline-none placeholder:text-muted-foreground/72 sm:leading-7.5"
        disabled={disabled}
        id={id}
        inputMode="tel"
        onChange={changeNumber}
        ref={ref}
        type="tel"
        value={displayPhoneValue(value, country)}
      />
    </div>
  );
}
