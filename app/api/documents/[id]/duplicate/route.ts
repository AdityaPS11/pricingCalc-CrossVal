import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import { getOwnedDocument, ApiError } from "@/lib/document-guards";

type Params = { params: Promise<{ id: string }> };

// POST /api/documents/:id/duplicate — clone a finalized document into a new draft.
// Only makes sense for finalized documents (a draft can just be edited directly).
export async function POST(request: Request, { params }: Params) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  try {
    const { id } = await params;
    const doc = await getOwnedDocument(id, userId);

    if (doc.status !== "finalized") {
      throw new ApiError(
        409,
        "NOT_FINALIZED",
        "Only finalized documents can be duplicated"
      );
    }

    const duplicate = await prisma.document.create({
      data: {
        title: `${doc.title} (Copy)`,
        customer: doc.customer,
        issueDate: new Date(), // new draft gets today's date, not the original issue date
        status: "draft",
        userId,
        lineItems: {
          create: doc.lineItems.map((li) => ({
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

    return NextResponse.json({ document: duplicate }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) {
      const { body, status } = err.toResponse();
      return NextResponse.json(body, { status });
    }
    console.error("Duplicate error:", err);
    return NextResponse.json({ error: { message: "Something went wrong" } }, { status: 500 });
  }
}