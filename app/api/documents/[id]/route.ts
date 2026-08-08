import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import { documentUpdateSchema, zodErrorResponse } from "@/lib/validation";
import { calcDocument } from "@/lib/pricing";
import { getOwnedDocument, assertDraft, ApiError } from "@/lib/document-guards";

type Params = { params: Promise<{ id: string }> };

// GET /api/documents/:id — full document with computed line + document totals
export async function GET(request: Request, { params }: Params) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  try {
    const { id } = await params;
    const doc = await getOwnedDocument(id, userId);

    const calc = calcDocument(
      doc.lineItems.map((li) => ({
        quantity: li.quantity,
        unitPriceCents: li.unitPriceCents,
        discountType: li.discountType,
        discountValue: li.discountValue,
        taxPercent: li.taxPercent,
      }))
    );

    return NextResponse.json({
      document: {
        id: doc.id,
        title: doc.title,
        customer: doc.customer,
        issueDate: doc.issueDate,
        status: doc.status,
        finalizedAt: doc.finalizedAt,
        updatedAt: doc.updatedAt,
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
      },
    });
  } catch (err) {
    if (err instanceof ApiError) {
      const { body, status } = err.toResponse();
      return NextResponse.json(body, { status });
    }
    console.error("Document get error:", err);
    return NextResponse.json({ error: { message: "Something went wrong" } }, { status: 500 });
  }
}

// PATCH /api/documents/:id — update metadata (title/customer/issueDate). Draft only.
export async function PATCH(request: Request, { params }: Params) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  try {
    const { id } = await params;
    const doc = await getOwnedDocument(id, userId);
    assertDraft(doc);

    const body = await request.json();
    const parsed = documentUpdateSchema.parse(body);

    // Optimistic concurrency: if client sent an expectedUpdatedAt, enforce it.
    if (body.expectedUpdatedAt) {
      const expected = new Date(body.expectedUpdatedAt).getTime();
      if (expected !== doc.updatedAt.getTime()) {
        throw new ApiError(
          409,
          "STALE_UPDATE",
          "This document was modified elsewhere. Reload and try again."
        );
      }
    }

    const updated = await prisma.document.update({
      where: { id: doc.id },
      data: parsed,
      include: { lineItems: true },
    });

    return NextResponse.json({ document: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(zodErrorResponse(err), { status: 400 });
    }
    if (err instanceof ApiError) {
      const { body, status } = err.toResponse();
      return NextResponse.json(body, { status });
    }
    console.error("Document update error:", err);
    return NextResponse.json({ error: { message: "Something went wrong" } }, { status: 500 });
  }
}

// DELETE /api/documents/:id — draft only. Finalized documents are immutable, including deletion.
export async function DELETE(request: Request, { params }: Params) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  try {
    const { id } = await params;
    const doc = await getOwnedDocument(id, userId);
    assertDraft(doc);

    await prisma.document.delete({ where: { id: doc.id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ApiError) {
      const { body, status } = err.toResponse();
      return NextResponse.json(body, { status });
    }
    console.error("Document delete error:", err);
    return NextResponse.json({ error: { message: "Something went wrong" } }, { status: 500 });
  }
}