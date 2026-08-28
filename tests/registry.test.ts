import { describe, expect, test } from "bun:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import {
  parseDateValue,
  toDateValue,
} from "@/components/ui/date-picker"
import {
  DateRangePicker,
  inclusiveDateRangeDays,
  nextDateRangeDraft,
} from "@/components/ui/date-range-picker"
import {
  countryFlag,
  isPossiblePhoneValue,
  normalizePhoneValue,
  phoneCountryFromLocale,
  phoneCountryFromValue,
  phoneCountryOptions,
} from "@/components/ui/phone-input"

describe("date picker values", () => {
  test("parses valid ISO dates as local calendar dates", () => {
    const date = parseDateValue("2026-07-29")

    expect(date?.getFullYear()).toBe(2026)
    expect(date?.getMonth()).toBe(6)
    expect(date?.getDate()).toBe(29)
  })

  test("rejects malformed and impossible dates", () => {
    expect(parseDateValue("29/07/2026")).toBeUndefined()
    expect(parseDateValue("2026-02-29")).toBeUndefined()
    expect(parseDateValue("")).toBeUndefined()
  })

  test("serializes without UTC timezone shifts", () => {
    expect(toDateValue(new Date(2026, 6, 29, 23, 59))).toBe("2026-07-29")
  })
})

describe("date range picker", () => {
  test("counts both calendar boundary dates", () => {
    expect(
      inclusiveDateRangeDays({
        from: new Date(2026, 6, 1),
        to: new Date(2026, 6, 31),
      }),
    ).toBe(31)
  })

  test("counts calendar dates without daylight-saving drift", () => {
    expect(
      inclusiveDateRangeDays({
        from: new Date(2026, 2, 7),
        to: new Date(2026, 2, 9),
      }),
    ).toBe(3)
  })

  test("requires both range boundaries", () => {
    expect(inclusiveDateRangeDays({ from: new Date(2026, 6, 1) })).toBeNull()
  })

  test("starts a new draft when a complete range is edited", () => {
    const trigger = new Date(2026, 7, 1)
    expect(
      nextDateRangeDraft(
        { from: new Date(2026, 6, 1), to: new Date(2026, 6, 31) },
        undefined,
        trigger,
      ),
    ).toEqual({ from: trigger, to: undefined })
  })

  test("renders a localized, labeled trigger", () => {
    const markup = renderToStaticMarkup(
      createElement(DateRangePicker, {
        value: { from: "2026-08-01", to: "2026-08-11" },
        valueLabel: "Período selecionado: 1–11 ago 2026",
        activePreset: undefined,
        presets: [
          { days: 7, label: "7d" },
          { days: 30, label: "30d" },
          { days: 90, label: "90d" },
        ],
        labels: {
          trigger: "Período do relatório",
          presets: "Períodos rápidos",
          custom: "Período personalizado",
          apply: "Aplicar",
          cancel: "Cancelar",
          incomplete: "Escolha as datas",
          tooLong: "Escolha no máximo 366 dias",
        },
        onPresetSelect: () => {},
        onRangeApply: () => {},
      }),
    )

    expect(markup).toContain('aria-label="Período do relatório"')
    expect(markup).toContain("Período selecionado: 1–11 ago 2026")
  })
})

describe("phone input model", () => {
  test("normalizes national input into an international value", () => {
    expect(normalizePhoneValue("BR", "(11) 99999-9999")).toBe(
      "+5511999999999",
    )
    expect(normalizePhoneValue("US", "202 555 0123")).toBe("+12025550123")
    expect(normalizePhoneValue("DE", "")).toBe("")
    expect(isPossiblePhoneValue("+5511999999999")).toBe(true)
    expect(isPossiblePhoneValue("+5511")).toBe(false)
  })

  test("detects the country from locale and international values", () => {
    expect(phoneCountryFromLocale("pt-BR")).toBe("BR")
    expect(phoneCountryFromLocale("en-US")).toBe("US")
    expect(phoneCountryFromLocale("es")).toBe("ES")
    expect(phoneCountryFromValue("+4930123456", "BR")).toBe("DE")
  })

  test("builds localized searchable country metadata", () => {
    const brazil = phoneCountryOptions("pt-BR").find(
      (country) => country.value === "BR",
    )
    expect(brazil).toMatchObject({
      name: "Brasil",
      callingCode: "55",
      flag: "🇧🇷",
    })
    expect(countryFlag("US")).toBe("🇺🇸")
  })
})
