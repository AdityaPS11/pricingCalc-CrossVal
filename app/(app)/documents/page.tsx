import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calcDocument } from "@/lib/pricing";
import { centsToAmount } from "@/lib/money";
import { formatDate } from "@/lib/format";

export default async function DocumentsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  const docs = await prisma.document.findMany({
    where: { userId: session.user.id },
    include: { lineItems: true },
    orderBy: { issueDate: "desc" },
  });

  const rows = docs.map((doc) => {
    const calc = calcDocument(
      doc.lineItems.map((li) => ({
        quantity: li.quantity,
        unitPriceCents: li.unitPriceCents,
        discountType: li.discountType,
        discountValue: li.discountValue,
        taxPercent: li.taxPercent,
      }))
    );
    return { ...doc, grandTotalCents: calc.grandTotalCents };
  });

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Documents</h1>
        <Link href="/documents/new" className="btn-accent">
          New document
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">No documents yet</div>
          <p>Create your first document to start building line items and totals.</p>
        </div>
      ) : (
        <div className="doc-list">
          {rows.map((doc) => (
            <Link key={doc.id} href={`/documents/${doc.id}`} className="doc-row">
              <div className="doc-row-main">
                <div className="doc-row-title">{doc.title}</div>
                <div className="doc-row-meta">
                  {doc.customer} · {formatDate(doc.issueDate)}
                </div>
              </div>
              <span className={doc.status === "finalized" ? "stamp-finalized" : "stamp-draft"}>
                {doc.status}
              </span>
              <div className="doc-row-total mono">
                ₹{centsToAmount(doc.grandTotalCents).toFixed(2)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
