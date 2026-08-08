import { prisma } from "./db";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public field?: string) {
    super(message);
  }

  toResponse() {
    return {
      body: { error: { code: this.code, message: this.message, field: this.field } },
      status: this.status,
    };
  }
}

// Fetches a document (with line items) scoped to the given user.
// Throws 404 if it doesn't exist or belongs to someone else — same response either way,
// so we never leak whether a document id exists for another user.
export async function getOwnedDocument(documentId: string, userId: string) {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, userId },
    include: { lineItems: true },
  });

  if (!doc) {
    throw new ApiError(404, "NOT_FOUND", "Document not found");
  }

  return doc;
}

export function assertDraft(doc: { status: string }) {
  if (doc.status !== "draft") {
    throw new ApiError(
      409,
      "DOCUMENT_FINALIZED",
      "This document is finalized and cannot be edited"
    );
  }
}