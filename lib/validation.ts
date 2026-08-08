import { z } from "zod";
import { toCents, toBasisPoints } from "./money";

// ---------- Line item ----------

// Base object shape (no refinements) — kept separate so .partial() can be used on it.
const lineItemBaseSchema = z.object({
  description: z.string().trim().min(1, "Description is required"),
  quantity: z
    .number({ message: "Quantity is required" })
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1"),
  unitPrice: z
    .number({ message: "Unit price is required" })
    .min(0, "Unit price cannot be negative"),
  discountType: z.enum(["none", "percent", "fixed"]).default("none"),
  discountValue: z.number().min(0, "Discount cannot be negative").default(0),
  taxPercent: z
    .number()
    .min(0, "Tax percent cannot be negative")
    .max(100, "Tax percent cannot exceed 100")
    .default(0),
});

function refineLineItem(data: {
  discountType: string;
  discountValue: number;
}, ctx: z.RefinementCtx) {
  if (data.discountType === "percent" && data.discountValue > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Discount percent cannot exceed 100",
      path: ["discountValue"],
    });
  }
  if (data.discountType === "none" && data.discountValue !== 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "discountValue must be 0 when discountType is 'none'",
      path: ["discountValue"],
    });
  }
  // Fixed discount vs subtotal is checked in the calc module (needs quantity*unitPrice),
  // not here — kept as a single source of truth rather than duplicating the rule.
}

// Full (create) schema: all fields required/defaulted, with refinement.
export const lineItemRawSchema = lineItemBaseSchema.superRefine(refineLineItem);

// Partial (update/PATCH) schema: all fields optional, refinement skips fields that are undefined.
export const lineItemUpdateSchema = lineItemBaseSchema.partial().superRefine((data, ctx) => {
  if (data.discountType === "percent" && data.discountValue !== undefined && data.discountValue > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Discount percent cannot exceed 100",
      path: ["discountValue"],
    });
  }
});

// Transformed shape: internal units (cents / basis points), matches pricing.ts's LineItemInput.
export const lineItemInputSchema = lineItemRawSchema.transform((data) => ({
  description: data.description,
  quantity: data.quantity,
  unitPriceCents: toCents(data.unitPrice),
  discountType: data.discountType,
  discountValue:
    data.discountType === "percent" ? toBasisPoints(data.discountValue) : toCents(data.discountValue),
  taxPercent: toBasisPoints(data.taxPercent),
}));

export type LineItemRawInput = z.infer<typeof lineItemRawSchema>;

export const lineItemCreateSchema = lineItemRawSchema;

// ---------- Document ----------

export const documentCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  customer: z.string().trim().min(1, "Customer is required"),
  issueDate: z.coerce.date({ message: "Issue date is required" }),
  lineItems: z.array(lineItemBaseSchema.superRefine(refineLineItem)).default([]),
});

export const documentUpdateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").optional(),
  customer: z.string().trim().min(1, "Customer is required").optional(),
  issueDate: z.coerce.date().optional(),
});

// ---------- Report ----------

export const reportQuerySchema = z.object({
  from: z.coerce.date({ message: "from date is required" }),
  to: z.coerce.date({ message: "to date is required" }),
});

// ---------- Error formatting ----------

export function zodErrorResponse(error: z.ZodError) {
  const firstIssue = error.issues[0];
  return {
    error: {
      field: firstIssue.path.join(".") || undefined,
      message: firstIssue.message,
    },
  };
}