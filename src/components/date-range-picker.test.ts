import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DateRangePicker,
  inclusiveDateRangeDays,
  nextDateRangeDraft,
} from "@cursare/ui/components/date-range-picker";

describe("date range picker", () => {
  test("counts both calendar boundary dates", () => {
    expect(
      inclusiveDateRangeDays({ from: new Date(2026, 6, 1), to: new Date(2026, 6, 31) }),
    ).toBe(31);
  });

  test("counts calendar dates without daylight-saving drift", () => {
    expect(
      inclusiveDateRangeDays({ from: new Date(2026, 2, 7), to: new Date(2026, 2, 9) }),
    ).toBe(3);
  });

  test("requires both range boundaries", () => {
    expect(inclusiveDateRangeDays({ from: new Date(2026, 6, 1) })).toBeNull();
  });

  test("starts a new draft when a complete range is edited", () => {
    const trigger = new Date(2026, 7, 1);
    expect(
      nextDateRangeDraft(
        { from: new Date(2026, 6, 1), to: new Date(2026, 6, 31) },
        undefined,
        trigger,
      ),
    ).toEqual({ from: trigger, to: undefined });
  });

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
    );

    expect(markup).toContain('aria-label="Período do relatório"');
    expect(markup).toContain("Período selecionado: 1–11 ago 2026");
  });
});
