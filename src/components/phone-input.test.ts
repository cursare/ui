import { describe, expect, test } from "bun:test";
import {
  countryFlag,
  isPossiblePhoneValue,
  normalizePhoneValue,
  phoneCountryFromLocale,
  phoneCountryFromValue,
  phoneCountryOptions,
} from "./phone-input";

describe("phone input model", () => {
  test("normalizes national input into an international value", () => {
    expect(normalizePhoneValue("BR", "(11) 99999-9999")).toBe("+5511999999999");
    expect(normalizePhoneValue("US", "202 555 0123")).toBe("+12025550123");
    expect(normalizePhoneValue("DE", "")).toBe("");
    expect(isPossiblePhoneValue("+5511999999999")).toBe(true);
    expect(isPossiblePhoneValue("+5511")).toBe(false);
  });

  test("detects the country from locale and international values", () => {
    expect(phoneCountryFromLocale("pt-BR")).toBe("BR");
    expect(phoneCountryFromLocale("en-US")).toBe("US");
    expect(phoneCountryFromLocale("es")).toBe("ES");
    expect(phoneCountryFromValue("+4930123456", "BR")).toBe("DE");
  });

  test("builds localized searchable country metadata", () => {
    const brazil = phoneCountryOptions("pt-BR").find((country) => country.value === "BR");
    expect(brazil).toMatchObject({ name: "Brasil", callingCode: "55", flag: "🇧🇷" });
    expect(countryFlag("US")).toBe("🇺🇸");
  });
});
