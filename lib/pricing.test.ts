import { describe, it, expect } from "vitest";
import { calcLine, calcDocument, PricingError, LineItemInput } from "./pricing";

describe("calcLine — sample table verification", () => {
  it("Widget A: qty 2, price 100.00, 10% discount, 5% tax", () => {
    const line: LineItemInput = {
      quantity: 2,
      unitPriceCents: 10000, // 100.00
      discountType: "percent",
      discountValue: 1000, // 10%
      taxPercent: 500, // 5%
    };
    const result = calcLine(line);
    expect(result.subtotalCents).toBe(20000); // 200.00
    expect(result.discountAmountCents).toBe(2000); // 20.00
    expect(result.afterDiscountCents).toBe(18000); // 180.00
    expect(result.taxAmountCents).toBe(900); // 9.00 (5% of 180, not 200)
    expect(result.lineTotalCents).toBe(18900); // 189.00
  });

  it("Widget B: qty 1, price 50.00, no discount, 5% tax", () => {
    const line: LineItemInput = {
      quantity: 1,
      unitPriceCents: 5000, // 50.00
      discountType: "none",
      discountValue: 0,
      taxPercent: 500, // 5%
    };
    const result = calcLine(line);
    expect(result.subtotalCents).toBe(5000); // 50.00
    expect(result.discountAmountCents).toBe(0);
    expect(result.afterDiscountCents).toBe(5000); // 50.00
    expect(result.taxAmountCents).toBe(250); // 2.50
    expect(result.lineTotalCents).toBe(5250); // 52.50
  });

  it("Service fee: qty 1, price 200.00, $20 fixed discount, no tax", () => {
    const line: LineItemInput = {
      quantity: 1,
      unitPriceCents: 20000, // 200.00
      discountType: "fixed",
      discountValue: 2000, // $20.00
      taxPercent: 0,
    };
    const result = calcLine(line);
    expect(result.subtotalCents).toBe(20000); // 200.00
    expect(result.discountAmountCents).toBe(2000); // 20.00
    expect(result.afterDiscountCents).toBe(18000); // 180.00
    expect(result.taxAmountCents).toBe(0);
    expect(result.lineTotalCents).toBe(18000); // 180.00
  });
});

describe("calcDocument — full sample document", () => {
  const lines: LineItemInput[] = [
    { quantity: 2, unitPriceCents: 10000, discountType: "percent", discountValue: 1000, taxPercent: 500 },
    { quantity: 1, unitPriceCents: 5000, discountType: "none", discountValue: 0, taxPercent: 500 },
    { quantity: 1, unitPriceCents: 20000, discountType: "fixed", discountValue: 2000, taxPercent: 0 },
  ];

  it("matches document-level expected totals", () => {
    const result = calcDocument(lines);
    expect(result.subtotalCents).toBe(45000); // 450.00
    expect(result.totalDiscountCents).toBe(4000); // 40.00
    expect(result.totalTaxCents).toBe(1150); // 11.50
    expect(result.grandTotalCents).toBe(42150); // 421.50
  });
});

describe("validation and edge cases", () => {
  it("rejects quantity < 1", () => {
    expect(() =>
      calcLine({ quantity: 0, unitPriceCents: 1000, discountType: "none", discountValue: 0, taxPercent: 0 })
    ).toThrow(PricingError);
  });

  it("rejects negative unit price", () => {
    expect(() =>
      calcLine({ quantity: 1, unitPriceCents: -100, discountType: "none", discountValue: 0, taxPercent: 0 })
    ).toThrow(PricingError);
  });

  it("rejects fixed discount exceeding subtotal", () => {
    expect(() =>
      calcLine({
        quantity: 1,
        unitPriceCents: 1000, // 10.00
        discountType: "fixed",
        discountValue: 1500, // 15.00 — exceeds subtotal
        taxPercent: 0,
      })
    ).toThrow(PricingError);
  });

  it("rejects discount percent over 100%", () => {
    expect(() =>
      calcLine({
        quantity: 1,
        unitPriceCents: 1000,
        discountType: "percent",
        discountValue: 10001, // >100%
        taxPercent: 0,
      })
    ).toThrow(PricingError);
  });

  it("rejects tax percent over 100%", () => {
    expect(() =>
      calcLine({
        quantity: 1,
        unitPriceCents: 1000,
        discountType: "none",
        discountValue: 0,
        taxPercent: 10001,
      })
    ).toThrow(PricingError);
  });

  it("handles zero-price line without crashing", () => {
    const result = calcLine({
      quantity: 3,
      unitPriceCents: 0,
      discountType: "none",
      discountValue: 0,
      taxPercent: 500,
    });
    expect(result.lineTotalCents).toBe(0);
  });

  it("calcDocument with empty lines returns all zeros", () => {
    const result = calcDocument([]);
    expect(result.subtotalCents).toBe(0);
    expect(result.grandTotalCents).toBe(0);
    expect(result.lines).toEqual([]);
  });
});