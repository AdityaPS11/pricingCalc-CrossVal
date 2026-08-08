"use client";

import { useState, useMemo } from "react";
import { calcLine, PricingError, type DiscountType } from "@/lib/pricing";
import { toCents, toBasisPoints, centsToAmount } from "@/lib/money";

export interface LineItemFormValues {
  description: string;
  quantity: number;
  unitPrice: number;
  discountType: DiscountType;
  discountValue: number;
  taxPercent: number;
}

const emptyValues: LineItemFormValues = {
  description: "",
  quantity: 1,
  unitPrice: 0,
  discountType: "none",
  discountValue: 0,
  taxPercent: 0,
};

export function LineItemForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  initial?: LineItemFormValues;
  onSubmit: (values: LineItemFormValues) => Promise<string | void>;
  onCancel?: () => void;
  submitLabel: string;
}) {
  const [values, setValues] = useState<LineItemFormValues>(initial ?? emptyValues);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Live preview: run the same calc module client-side as the user types.
  // This is a preview only — the server always recomputes and validates on save.
  const preview = useMemo(() => {
    try {
      const line = calcLine({
        quantity: values.quantity,
        unitPriceCents: toCents(values.unitPrice),
        discountType: values.discountType,
        discountValue:
          values.discountType === "percent"
            ? toBasisPoints(values.discountValue)
            : toCents(values.discountValue),
        taxPercent: toBasisPoints(values.taxPercent),
      });
      return { result: line, error: null };
    } catch (err) {
      return { result: null, error: err instanceof PricingError ? err.message : "Invalid values" };
    }
  }, [values]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (preview.error) {
      setError(preview.error);
      return;
    }

    setSaving(true);
    const errMsg = await onSubmit(values);
    setSaving(false);

    if (errMsg) {
      setError(errMsg);
    } else if (!initial) {
      setValues(emptyValues); // clear the add-form after a successful add
    }
  }

  return (
    <form onSubmit={handleSubmit} className="line-form">
      {error && <div className="auth-error">{error}</div>}

      <div className="line-form-grid">
        <div className="field-group">
          <label className="field-label">Description</label>
          <input
            className="field-input"
            value={values.description}
            onChange={(e) => setValues({ ...values, description: e.target.value })}
            required
          />
        </div>

        <div className="field-group">
          <label className="field-label">Qty</label>
          <input
            type="number"
            min={1}
            step={1}
            className="field-input"
            value={values.quantity}
            onChange={(e) => setValues({ ...values, quantity: Number(e.target.value) })}
            required
          />
        </div>

        <div className="field-group">
          <label className="field-label">Unit price</label>
          <input
            type="number"
            min={0}
            step="0.01"
            className="field-input"
            value={values.unitPrice}
            onChange={(e) => setValues({ ...values, unitPrice: Number(e.target.value) })}
            required
          />
        </div>

        <div className="field-group">
          <label className="field-label">Discount type</label>
          <select
            className="field-input"
            value={values.discountType}
            onChange={(e) =>
              setValues({
                ...values,
                discountType: e.target.value as DiscountType,
                discountValue: 0,
              })
            }
          >
            <option value="none">None</option>
            <option value="percent">Percent</option>
            <option value="fixed">Fixed</option>
          </select>
        </div>

        <div className="field-group">
          <label className="field-label">
            Discount {values.discountType === "percent" ? "(%)" : values.discountType === "fixed" ? "(₹)" : ""}
          </label>
          <input
            type="number"
            min={0}
            step="0.01"
            className="field-input"
            value={values.discountValue}
            onChange={(e) => setValues({ ...values, discountValue: Number(e.target.value) })}
            disabled={values.discountType === "none"}
          />
        </div>

        <div className="field-group">
          <label className="field-label">Tax (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            step="0.01"
            className="field-input"
            value={values.taxPercent}
            onChange={(e) => setValues({ ...values, taxPercent: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="line-form-footer">
        <div className="line-preview mono">
          {preview.result ? (
            <>Line total: <strong>₹{centsToAmount(preview.result.lineTotalCents).toFixed(2)}</strong></>
          ) : (
            <span className="line-preview-error">{preview.error}</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {onCancel && (
            <button type="button" className="btn-secondary" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button type="submit" className="btn-accent" disabled={saving || !!preview.error}>
            {saving ? "Saving…" : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
