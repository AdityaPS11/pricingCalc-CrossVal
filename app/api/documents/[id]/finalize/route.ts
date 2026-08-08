import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import { calcDocument, PricingError } from "@/lib/pricing";
import { getOwnedDocument, ApiError } from "@/lib/document-guards";

type Params = { params: Promise<{ id: string }> };

// POST /api/documents/:id/finalize — lock a draft document. Idempotent.
export async function POST(request: Request, { params }: Params) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  try {
    const { id } = await params;
    const doc = await getOwnedDocument(id, userId);

    // Idempotent: finalizing an already-finalized document is a no-op success,
    // not an error — calling finalize twice shouldn't crash a client that retries.
    if (doc.status === "finalized") {
      return NextResponse.json({ document: doc, alreadyFinalized: true });
    }

    if (doc.lineItems.length === 0) {
      throw new ApiError(
        422,
        "EMPTY_DOCUMENT",
        "Cannot finalize a document with no line items"
      );
    }

    // Re-validate every line through the calc module — catches any bad state that
    // might have slipped in some other way (stretch goal: "finalize validation").
    try {
      calcDocument(
        doc.lineItems.map((li) => ({
          quantity: li.quantity,
          unitPriceCents: li.unitPriceCents,
          discountType: li.discountType,
          discountValue: li.discountValue,
          taxPercent: li.taxPercent,
        }))
      );
    } catch (err) {
      if (err instanceof PricingError) {
        throw new ApiError(422, "INVALID_LINE_ITEM", err.message, err.field);
      }
      throw err;
    }

    const finalized = await prisma.document.update({
      where: { id: doc.id },
      data: {
        status: "finalized",
        finalizedAt: new Date(),
        finalizedBy: userId,
      },
      include: { lineItems: true },
    });

    return NextResponse.json({ document: finalized });
  } catch (err) {
    if (err instanceof ApiError) {
      const { body, status } = err.toResponse();
      return NextResponse.json(body, { status });
    }
    console.error("Finalize error:", err);
    return NextResponse.json({ error: { message: "Something went wrong" } }, { status: 500 });
  }
}