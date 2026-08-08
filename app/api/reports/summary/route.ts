import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import { reportQuerySchema, zodErrorResponse } from "@/lib/validation";
import { calcDocument } from "@/lib/pricing";

// GET /api/reports/summary?from=2026-01-01&to=2026-01-31
export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const parsed = reportQuerySchema.parse({
      from: searchParams.get("from"),
      to: searchParams.get("to"),
    });

    if (parsed.from > parsed.to) {
      return NextResponse.json(
        { error: { field: "from", message: "'from' date must be before 'to' date" } },
        { status: 400 }
      );
    }

    // Include the whole 'to' day, not just midnight
    const toInclusive = new Date(parsed.to);
    toInclusive.setHours(23, 59, 59, 999);

    const docs = await prisma.document.findMany({
      where: {
        userId,
        issueDate: { gte: parsed.from, lte: toInclusive },
      },
      include: { lineItems: true },
    });

    // Totals aren't stored, so we recompute per document from the same calc module
    // used everywhere else — guarantees the report can never disagree with a
    // document's own detail view.
    let sumGrandTotalCents = 0;
    let sumTaxCents = 0;
    let sumDiscountCents = 0;

    for (const doc of docs) {
      const calc = calcDocument(
        doc.lineItems.map((li) => ({
          quantity: li.quantity,
          unitPriceCents: li.unitPriceCents,
          discountType: li.discountType,
          discountValue: li.discountValue,
          taxPercent: li.taxPercent,
        }))
      );
      sumGrandTotalCents += calc.grandTotalCents;
      sumTaxCents += calc.totalTaxCents;
      sumDiscountCents += calc.totalDiscountCents;
    }

    return NextResponse.json({
      report: {
        from: parsed.from,
        to: parsed.to,
        documentCount: docs.length,
        sumGrandTotalCents,
        sumTaxCents,
        sumDiscountCents,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(zodErrorResponse(err), { status: 400 });
    }
    console.error("Report error:", err);
    return NextResponse.json({ error: { message: "Something went wrong" } }, { status: 500 });
  }
}