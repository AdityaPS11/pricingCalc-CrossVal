import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import { documentCreateSchema, lineItemInputSchema, zodErrorResponse } from "@/lib/validation";
import { calcDocument, PricingError } from "@/lib/pricing";
import { ApiError } from "@/lib/document-guards";

// GET /api/documents — list the current user's documents with computed totals
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  const docs = await prisma.document.findMany({
    where: { userId },
    include: { lineItems: true },
    orderBy: { issueDate: "desc" },
  });

  const withTotals = docs.map((doc) => {
    const calc = calcDocument(
      doc.lineItems.map((li) => ({
        quantity: li.quantity,
        unitPriceCents: li.unitPriceCents,
        discountType: li.discountType,
        discountValue: li.discountValue,
        taxPercent: li.taxPercent,
      }))
    );
    return {
      id: doc.id,
      title: doc.title,
      customer: doc.customer,
      issueDate: doc.issueDate,
      status: doc.status,
      grandTotalCents: calc.grandTotalCents,
    };
  });

  return NextResponse.json({ documents: withTotals });
}

// POST /api/documents — create a new draft document, optionally with line items
export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = documentCreateSchema.parse(body);

    // Validate each line item through the calc module before persisting anything —
    // this is where "fixed discount exceeds subtotal" etc. gets caught.
    const transformedLines = parsed.lineItems.map((li) => lineItemInputSchema.parse(li));
    calcDocument(transformedLines); // throws PricingError on invalid combinations

    const doc = await prisma.document.create({
      data: {
        title: parsed.title,
        customer: parsed.customer,
        issueDate: parsed.issueDate,
        userId,
        lineItems: {
          create: transformedLines.map((li) => ({
            description: li.description,
            quantity: li.quantity,
            unitPriceCents: li.unitPriceCents,
            discountType: li.discountType,
            discountValue: li.discountValue,
            taxPercent: li.taxPercent,
          })),
        },
      },
      include: { lineItems: true },
    });

    return NextResponse.json({ document: doc }, { status: 201 });
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
    console.error("Document create error:", err);
    return NextResponse.json({ error: { message: "Something went wrong" } }, { status: 500 });
  }
}