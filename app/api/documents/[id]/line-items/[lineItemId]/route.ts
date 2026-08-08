import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import { lineItemUpdateSchema, zodErrorResponse } from "@/lib/validation";
import { calcLine, PricingError } from "@/lib/pricing";
import { getOwnedDocument, assertDraft, ApiError } from "@/lib/document-guards";
import { toCents, toBasisPoints } from "@/lib/money";

type Params = { params: Promise<{ id: string; lineItemId: string }> };

// PATCH /api/documents/:id/line-items/:lineItemId — edit a line item. Draft only.
export async function PATCH(request: Request, { params }: Params) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  try {
    const { id, lineItemId } = await params;
    const doc = await getOwnedDocument(id, userId);
    assertDraft(doc);

    const existing = doc.lineItems.find((li) => li.id === lineItemId);
    if (!existing) {
      throw new ApiError(404, "NOT_FOUND", "Line item not found");
    }

    const body = await request.json();
    const rawParsed = lineItemUpdateSchema.parse(body);

    // Merge partial update onto existing values (in human units) before transforming,
    // so calcLine always sees a complete, consistent line item.
    const discountType = rawParsed.discountType ?? existing.discountType;
    const merged = {
      description: rawParsed.description ?? existing.description,
      quantity: rawParsed.quantity ?? existing.quantity,
      unitPriceCents:
        rawParsed.unitPrice !== undefined ? toCents(rawParsed.unitPrice) : existing.unitPriceCents,
      discountType,
      discountValue:
        rawParsed.discountValue !== undefined
          ? discountType === "percent"
            ? toBasisPoints(rawParsed.discountValue)
            : toCents(rawParsed.discountValue)
          : existing.discountValue,
      taxPercent:
        rawParsed.taxPercent !== undefined ? toBasisPoints(rawParsed.taxPercent) : existing.taxPercent,
    };

    calcLine(merged); // validate before persisting

    const updated = await prisma.lineItem.update({
      where: { id: lineItemId },
      data: merged,
    });

    await prisma.document.update({ where: { id: doc.id }, data: {} });

    return NextResponse.json({ lineItem: updated });
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
    console.error("Line item update error:", err);
    return NextResponse.json({ error: { message: "Something went wrong" } }, { status: 500 });
  }
}

// DELETE /api/documents/:id/line-items/:lineItemId — remove a line item. Draft only.
export async function DELETE(request: Request, { params }: Params) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  try {
    const { id, lineItemId } = await params;
    const doc = await getOwnedDocument(id, userId);
    assertDraft(doc);

    const existing = doc.lineItems.find((li) => li.id === lineItemId);
    if (!existing) {
      throw new ApiError(404, "NOT_FOUND", "Line item not found");
    }

    await prisma.lineItem.delete({ where: { id: lineItemId } });
    await prisma.document.update({ where: { id: doc.id }, data: {} });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ApiError) {
      const { body, status } = err.toResponse();
      return NextResponse.json(body, { status });
    }
    console.error("Line item delete error:", err);
    return NextResponse.json({ error: { message: "Something went wrong" } }, { status: 500 });
  }
}