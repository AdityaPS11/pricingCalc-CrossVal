"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LineItemForm, type LineItemFormValues } from "./line-item-form";
import { ConfirmDialog } from "./confirm-dialog";
import { centsToAmount } from "@/lib/money";
import { formatDate } from "@/lib/format";
import type { DiscountType } from "@/lib/pricing";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  discountType: DiscountType;
  discountValue: number;
  taxPercent: number;
  subtotalCents: number;
  discountAmountCents: number;
  afterDiscountCents: number;
  taxAmountCents: number;
  lineTotalCents: number;
}

interface DocumentData {
  id: string;
  title: string;
  customer: string;
  issueDate: string;
  status: "draft" | "finalized";
  finalizedAt: string | null;
  updatedAt: string;
  lineItems: LineItem[];
  subtotalCents: number;
  totalDiscountCents: number;
  totalTaxCents: number;
  grandTotalCents: number;
}

function centsToFormValue(cents: number): number {
  return centsToAmount(cents);
}

function basisPointsToFormValue(bps: number): number {
  return Math.round(bps) / 100;
}

export function DocumentEditor({
  initialDocument,
}: {
  initialDocument: DocumentData;
}) {
  const router = useRouter();
  const [doc, setDoc] = useState<DocumentData>(initialDocument);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);

  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const isDraft = doc.status === "draft";

  async function refetch() {
    const res = await fetch(`/api/documents/${doc.id}`);
    const data = await res.json();
    if (res.ok) {
      setDoc(data.document);
    }
  }

  async function handleAddLine(
    values: LineItemFormValues,
  ): Promise<string | void> {
    const res = await fetch(`/api/documents/${doc.id}/line-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json();
    if (!res.ok) {
      return data.error?.message ?? "Failed to add line item";
    }
    await refetch();
    setShowAddForm(false);
  }

  async function handleUpdateLine(
    lineItemId: string,
    values: LineItemFormValues,
  ): Promise<string | void> {
    const res = await fetch(
      `/api/documents/${doc.id}/line-items/${lineItemId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      },
    );
    const data = await res.json();
    if (!res.ok) {
      return data.error?.message ?? "Failed to update line item";
    }
    await refetch();
    setEditingId(null);
  }

  async function confirmDeleteLine() {
    if (!confirmDeleteId) return;
    const res = await fetch(
      `/api/documents/${doc.id}/line-items/${confirmDeleteId}`,
      {
        method: "DELETE",
      },
    );
    setConfirmDeleteId(null);
    if (res.ok) {
      await refetch();
    }
  }

  async function confirmFinalizeAction() {
    setConfirmFinalize(false);
    setFinalizing(true);
    setActionError(null);
    const res = await fetch(`/api/documents/${doc.id}/finalize`, {
      method: "POST",
    });
    const data = await res.json();
    setFinalizing(false);
    if (!res.ok) {
      setActionError(data.error?.message ?? "Failed to finalize");
      return;
    }
    await refetch();
  }

  async function handleDuplicate() {
    const res = await fetch(`/api/documents/${doc.id}/duplicate`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      setActionError(data.error?.message ?? "Failed to duplicate");
      return;
    }
    router.push(`/documents/${data.document.id}`);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <Link href="/documents" className="back-link mono">
            ← Documents
          </Link>
          <h1 className="page-title" style={{ marginTop: 8 }}>
            {doc.title}
          </h1>
          <div className="doc-row-meta" style={{ marginTop: 4 }}>
            {doc.customer} · {formatDate(doc.issueDate)}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className={isDraft ? "stamp-draft" : "stamp-finalized"}>
            {doc.status}
          </span>
          {isDraft ? (
            <button
              className="btn-accent"
              onClick={() => setConfirmFinalize(true)}
              disabled={finalizing}
            >
              {finalizing ? "Finalizing…" : "Finalize"}
            </button>
          ) : (
            <button className="btn-secondary" onClick={handleDuplicate}>
              Duplicate to draft
            </button>
          )}
          <Link href={`/documents/${doc.id}/print`} className="btn-secondary">
            Print
          </Link>
        </div>
      </div>

      {actionError && <div className="auth-error">{actionError}</div>}

      <div className="line-table">
        <div className="line-table-header mono">
          <span>Description</span>
          <span>Qty</span>
          <span>Unit price</span>
          <span>Discount</span>
          <span>Tax</span>
          <span>Line total</span>
          <span></span>
        </div>

        {doc.lineItems.map((li) =>
          editingId === li.id ? (
            <div key={li.id} className="line-edit-wrap">
              <LineItemForm
                submitLabel="Save"
                initial={{
                  description: li.description,
                  quantity: li.quantity,
                  unitPrice: centsToFormValue(li.unitPriceCents),
                  discountType: li.discountType,
                  discountValue:
                    li.discountType === "percent"
                      ? basisPointsToFormValue(li.discountValue)
                      : centsToFormValue(li.discountValue),
                  taxPercent: basisPointsToFormValue(li.taxPercent),
                }}
                onSubmit={(values) => handleUpdateLine(li.id, values)}
                onCancel={() => setEditingId(null)}
              />
            </div>
          ) : (
            <div key={li.id} className="line-table-row mono">
              <span>{li.description}</span>
              <span>{li.quantity}</span>
              <span>₹{centsToAmount(li.unitPriceCents).toFixed(2)}</span>
              <span>
                {li.discountType === "none"
                  ? "—"
                  : li.discountType === "percent"
                    ? `${basisPointsToFormValue(li.discountValue)}%`
                    : `₹${centsToAmount(li.discountValue).toFixed(2)}`}
              </span>
              <span>
                {li.taxPercent > 0
                  ? `${basisPointsToFormValue(li.taxPercent)}%`
                  : "—"}
              </span>
              <span>₹{centsToAmount(li.lineTotalCents).toFixed(2)}</span>
              <span className="line-row-actions">
                {isDraft && (
                  <>
                    <button
                      className="link-btn"
                      onClick={() => setEditingId(li.id)}
                    >
                      Edit
                    </button>
                    <button
                      className="link-btn danger"
                      onClick={() => setConfirmDeleteId(li.id)}
                    >
                      Remove
                    </button>
                  </>
                )}
              </span>
            </div>
          ),
        )}

        {doc.lineItems.length === 0 && !showAddForm && (
          <div className="empty-state" style={{ padding: "32px 0" }}>
            No line items yet.
          </div>
        )}
      </div>

      {isDraft && (
        <div style={{ marginTop: 16 }}>
          {showAddForm ? (
            <div className="line-edit-wrap">
              <LineItemForm
                submitLabel="Add line"
                onSubmit={handleAddLine}
                onCancel={() => setShowAddForm(false)}
              />
            </div>
          ) : (
            <button
              className="btn-secondary"
              onClick={() => setShowAddForm(true)}
            >
              + Add line item
            </button>
          )}
        </div>
      )}

      <div className="totals-summary">
        <div className="totals-row">
          <span>Subtotal</span>
          <span className="mono">
            ₹{centsToAmount(doc.subtotalCents).toFixed(2)}
          </span>
        </div>
        <div className="totals-row">
          <span>Total discount</span>
          <span className="mono">
            −₹{centsToAmount(doc.totalDiscountCents).toFixed(2)}
          </span>
        </div>
        <div className="totals-row">
          <span>Total tax</span>
          <span className="mono">
            +₹{centsToAmount(doc.totalTaxCents).toFixed(2)}
          </span>
        </div>
        <div className="totals-row totals-grand">
          <span>Grand total</span>
          <span className="mono">
            ₹{centsToAmount(doc.grandTotalCents).toFixed(2)}
          </span>
        </div>
      </div>

      <ConfirmDialog
        open={confirmFinalize}
        title="Finalize document?"
        message="This document will become read-only. Line items cannot be added, edited, or removed after finalizing."
        confirmLabel="Finalize"
        onConfirm={confirmFinalizeAction}
        onCancel={() => setConfirmFinalize(false)}
      />

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Remove line item?"
        message="This will permanently remove the line item from this document."
        confirmLabel="Remove"
        danger
        onConfirm={confirmDeleteLine}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
