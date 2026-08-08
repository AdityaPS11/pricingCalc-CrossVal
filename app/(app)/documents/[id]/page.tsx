import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calcDocument } from "@/lib/pricing";
import { DocumentEditor } from "./document-editor";

type Params = { params: Promise<{ id: string }> };

export default async function DocumentDetailPage({ params }: Params) {
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
    }))
  );

  const initialDocument = {
    id: doc.id,
    title: doc.title,
    customer: doc.customer,
    issueDate: doc.issueDate.toISOString(),
    status: doc.status,
    finalizedAt: doc.finalizedAt?.toISOString() ?? null,
    updatedAt: doc.updatedAt.toISOString(),
    lineItems: doc.lineItems.map((li, i) => ({
      id: li.id,
      description: li.description,
      quantity: li.quantity,
      unitPriceCents: li.unitPriceCents,
      discountType: li.discountType,
      discountValue: li.discountValue,
      taxPercent: li.taxPercent,
      ...calc.lines[i],
    })),
    subtotalCents: calc.subtotalCents,
    totalDiscountCents: calc.totalDiscountCents,
    totalTaxCents: calc.totalTaxCents,
    grandTotalCents: calc.grandTotalCents,
  };

  return <DocumentEditor initialDocument={initialDocument} />;
}
