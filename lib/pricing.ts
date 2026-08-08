// All money in integer cents. All percentages in basis points (10000 = 100%).

export type DiscountType = "none" | "percent" | "fixed";

export interface LineItemInput {
  quantity: number;
  unitPriceCents: number;
  discountType: DiscountType;
  discountValue: number; // cents if fixed, basis points if percent
  taxPercent: number; // basis points
}

export interface LineCalcResult {
  subtotalCents: number;
  discountAmountCents: number;
  afterDiscountCents: number;
  taxAmountCents: number;
  lineTotalCents: number;
}

export interface DocumentCalcResult {
  subtotalCents: number;
  totalDiscountCents: number;
  totalTaxCents: number;
  grandTotalCents: number;
  lines: LineCalcResult[];
}

export class PricingError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = "PricingError";
  }
}

// Round-half-up to nearest cent. Applied once, at the point each derived
// amount (discount, tax) is computed — not at the very end. This matches
// the spec's "round to 2 decimal places per line" policy.
function roundCents(value: number): number {
  return Math.round(value);
}

export function calcLine(line: LineItemInput): LineCalcResult {
  if (line.quantity < 1) {
    throw new PricingError("Quantity must be at least 1", "quantity");
  }
  if (line.unitPriceCents < 0) {
    throw new PricingError("Unit price cannot be negative", "unitPriceCents");
  }
  if (line.taxPercent < 0 || line.taxPercent > 10000) {
    throw new PricingError("Tax percent must be between 0 and 100", "taxPercent");
  }

  const subtotalCents = line.quantity * line.unitPriceCents;

  let discountAmountCents = 0;

  if (line.discountType === "percent") {
    if (line.discountValue < 0 || line.discountValue > 10000) {
      throw new PricingError("Discount percent must be between 0 and 100", "discountValue");
    }
    discountAmountCents = roundCents((subtotalCents * line.discountValue) / 10000);
  } else if (line.discountType === "fixed") {
    if (line.discountValue < 0) {
      throw new PricingError("Discount amount cannot be negative", "discountValue");
    }
    if (line.discountValue > subtotalCents) {
      // Reject rather than clamp — see README rationale.
      throw new PricingError(
        `Fixed discount (${line.discountValue}) cannot exceed line subtotal (${subtotalCents})`,
        "discountValue"
      );
    }
    discountAmountCents = line.discountValue;
  }
  // discountType "none" -> discountAmountCents stays 0

  const afterDiscountCents = subtotalCents - discountAmountCents;

  const taxAmountCents = roundCents((afterDiscountCents * line.taxPercent) / 10000);

  const lineTotalCents = afterDiscountCents + taxAmountCents;

  return {
    subtotalCents,
    discountAmountCents,
    afterDiscountCents,
    taxAmountCents,
    lineTotalCents,
  };
}

export function calcDocument(lines: LineItemInput[]): DocumentCalcResult {
  const results = lines.map(calcLine);

  return {
    subtotalCents: results.reduce((sum, r) => sum + r.subtotalCents, 0),
    totalDiscountCents: results.reduce((sum, r) => sum + r.discountAmountCents, 0),
    totalTaxCents: results.reduce((sum, r) => sum + r.taxAmountCents, 0),
    grandTotalCents: results.reduce((sum, r) => sum + r.lineTotalCents, 0),
    lines: results,
  };
}