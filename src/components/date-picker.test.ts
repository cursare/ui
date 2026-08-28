import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Calendar } from "@cursare/ui/components/calendar";
import {
  parseDateValue,
  toDateValue,
} from "@cursare/ui/components/date-picker";

describe("date picker values", () => {
  test("parses valid ISO dates as local calendar dates", () => {
    const date = parseDateValue("2026-07-29");

    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(6);
    expect(date?.getDate()).toBe(29);
  });

  test("rejects malformed and impossible dates", () => {
    expect(parseDateValue("29/07/2026")).toBeUndefined();
    expect(parseDateValue("2026-02-29")).toBeUndefined();
    expect(parseDateValue("")).toBeUndefined();
  });

  test("serializes without UTC timezone shifts", () => {
    expect(toDateValue(new Date(2026, 6, 29, 23, 59))).toBe("2026-07-29");
  });

  test("calendar year navigation includes future years", () => {
    const markup = renderToStaticMarkup(
      createElement(Calendar, {
        mode: "single",
        month: new Date(2026, 6, 29),
        captionLayout: "dropdown",
        navLayout: "after",
        startMonth: new Date(2026, 6, 29),
        endMonth: new Date(2076, 11, 31),
      }),
    );

    expect(markup).toContain('<option value="2026"');
    expect(markup).toContain('<option value="2076"');
  });
});
