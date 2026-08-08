import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calcDocument } from "@/lib/pricing";
import { centsToAmount } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { PrintButton } from "./print-button";
import Link from "next/link";

type Params = { params: Promise<{ id: string }> };

export default async function PrintPage({ params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;

  const doc = await prisma.document.findFirst({
    where: { id, userId: session.user.id },
    include: { lineItems: true },
  });

  if (!doc) {
    notFound();
  }

  const calc = calcDocument(
    doc.lineItems.map((li) => ({
      quantity: li.quantity,
      unitPriceCents: li.unitPriceCents,
      discountType: li.discountType,
      discountValue: li.discountValue,
      taxPercent: li.taxPercent,
    })),
  );

  return (
    <div className="print-page">
      <div className="print-toolbar no-print">
        <Link href={`/documents/${doc.id}`} className="btn-secondary">
          ← Back
        </Link>
        <PrintButton />
      </div>

      <div className="print-sheet">
        <div className="print-header">
          <div>
            <div className="print-brand">Ledger</div>
            <div className="print-status">{doc.status.toUpperCase()}</div>
          </div>
          <div className="print-meta">
            <div>{doc.title}</div>
            <div>{doc.customer}</div>
            <div>{formatDate(doc.issueDate)}</div>
          </div>
        </div>

        <table className="print-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit price</th>
              <th>Discount</th>
              <th>Tax</th>
              <th>Line total</th>
            </tr>
          </thead>
          <tbody>
            {doc.lineItems.map((li, i) => (
              <tr key={li.id}>
                <td>{li.description}</td>
                <td>{li.quantity}</td>
                <td>₹{centsToAmount(li.unitPriceCents).toFixed(2)}</td>
                <td>
                  {li.discountType === "none"
                    ? "—"
                    : li.discountType === "percent"
                      ? `${Math.round(li.discountValue) / 100}%`
                      : `₹${centsToAmount(li.discountValue).toFixed(2)}`}
                </td>
                <td>
                  {li.taxPercent > 0
                    ? `${Math.round(li.taxPercent) / 100}%`
                    : "—"}
                </td>
                <td>
                  ₹{centsToAmount(calc.lines[i].lineTotalCents).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="print-totals">
          <div className="print-totals-row">
            <span>Subtotal</span>
            <span>₹{centsToAmount(calc.subtotalCents).toFixed(2)}</span>
          </div>
          <div className="print-totals-row">
            <span>Total discount</span>
            <span>−₹{centsToAmount(calc.totalDiscountCents).toFixed(2)}</span>
          </div>
          <div className="print-totals-row">
            <span>Total tax</span>
            <span>+₹{centsToAmount(calc.totalTaxCents).toFixed(2)}</span>
          </div>
          <div className="print-totals-row print-totals-grand">
            <span>Grand total</span>
            <span>₹{centsToAmount(calc.grandTotalCents).toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
