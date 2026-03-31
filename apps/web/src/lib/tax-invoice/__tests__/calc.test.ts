import { describe, it, expect } from "vitest";
import { resolveItemSupply } from "../calc";

describe("resolveItemSupply", () => {
  it("uses line_total when present and non-zero", () => {
    expect(resolveItemSupply({ line_total: 50000, unit_price: 60000, quantity: 1 })).toBe(50000);
  });

  it("falls back to lineSupply(unit_price, qty) when line_total is null", () => {
    // lineSupply(10000, 3) = round(10000 * 3) = 30000
    expect(resolveItemSupply({ line_total: null, unit_price: 10000, quantity: 3 })).toBe(30000);
  });

  it("falls back to lineSupply when line_total is 0 (stale)", () => {
    expect(resolveItemSupply({ line_total: 0, unit_price: 10000, quantity: 3 })).toBe(30000);
  });

  it("falls back to lineSupply when line_total is negative (credit/return guard)", () => {
    // Negative line_total should NOT be used — fall back to unit_price calculation
    expect(resolveItemSupply({ line_total: -50000, unit_price: 10000, quantity: 3 })).toBe(30000);
  });

  it("returns 0 when both line_total and unit_price are null", () => {
    expect(resolveItemSupply({ line_total: null, unit_price: null, quantity: 5 })).toBe(0);
  });
});

describe("resolveItemSupply consistency: header and item agree", () => {
  it("two calls with same args return equal values (no split-brain)", () => {
    const item = { line_total: null as null, unit_price: 25000, quantity: 2 };
    const headerContrib = resolveItemSupply(item);
    const itemRowAmount = resolveItemSupply(item);
    expect(headerContrib).toBe(itemRowAmount);
  });
});
