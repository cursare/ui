import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "./number-field"

describe("number field", () => {
  test("keeps the compact input line height inside its control height", () => {
    const markup = renderToStaticMarkup(
      <NumberField size="sm" value={2}>
        <NumberFieldGroup>
          <NumberFieldDecrement />
          <NumberFieldInput />
          <NumberFieldIncrement />
        </NumberFieldGroup>
      </NumberField>,
    )

    expect(markup).toContain("sm:in-data-[size=sm]:h-6.5")
    expect(markup).toContain("sm:in-data-[size=sm]:leading-6.5")
    expect(markup).not.toContain("sm:in-data-[size=sm]:leading-8.5")
  })
})
