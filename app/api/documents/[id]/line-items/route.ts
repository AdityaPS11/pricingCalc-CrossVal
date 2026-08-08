import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import { lineItemCreateSchema, lineItemInputSchema, zodErrorResponse } from "@/lib/validation";
import { calcLine, PricingError } from "@/lib/pricing";
import { getOwnedDocument, assertDraft, ApiError } from "@/lib/document-guards";

type Params = { params: Promise<{ id: string }> };

// POST /api/documents/:id/line-items — add a line item. Draft only.
export async function POST(request: Request, { params }: Params) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  try {
    const { id } = await params;
    const doc = await getOwnedDocument(id, userId);
    assertDraft(doc);

    const body = await request.json();
    const rawParsed = lineItemCreateSchema.parse(body);
    const transformed = lineItemInputSchema.parse(rawParsed);

    // Validate through the calc module before persisting (catches discount>subtotal etc.)
    calcLine(transformed);

    const lineItem = await prisma.lineItem.create({
      data: {
        documentId: doc.id,
        description: transformed.description,
        quantity: transformed.quantity,
        unitPriceCents: transformed.unitPriceCents,
        discountType: transformed.discountType,
        discountValue: transformed.discountValue,
        taxPercent: transformed.taxPercent,
      },
    });

    // Touch the document's updatedAt so optimistic concurrency stays accurate
    await prisma.document.update({ where: { id: doc.id }, data: {} });

    return NextResponse.json({ lineItem }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(zodErrorResponse(err), { status: 400 });
    }
    if (err instanceof PricingError) {
      return NextResponse.json(
        { error: { field: err.field, message: err.message } },
        { status: 400 }
      );
    }
    if (err instanceof ApiError) {
      const { body, status } = err.toResponse();
      return NextResponse.json(body, { status });
    }
    console.error("Line item create error:", err);
    return NextResponse.json({ error: { message: "Something went wrong" } }, { status: 500 });
  }
}