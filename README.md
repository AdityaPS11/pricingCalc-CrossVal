# Multi-Rate Pricing Calculator

A small web app for creating documents (quotes/invoices) with line items, per-line discounts and tax, computed totals, a draft/finalized lifecycle, and a summary report.

**Live URL:** https://multi-pricingcalc.vercel.app
**Repo:** https://github.com/AdityaPS11/pricingCalc-CrossVal

---

## Tech stack

- **Framework:** Next.js 15+ (App Router), TypeScript — single monolith serving both frontend and API routes
- **Database:** PostgreSQL (Neon), via Prisma ORM
- **Auth:** NextAuth (credentials provider), bcrypt password hashing, JWT sessions
- **Validation:** Zod
- **Tests:** Vitest
- **Deployment:** Vercel

### Why a monolith, not a separate backend

This is a single-consumer app (one frontend, no external API clients) with contained scope and a short timeline. A Next.js monolith avoids the overhead of a second deployment, CORS configuration, and duplicated env/auth setup, letting more of the available time go into the calculation engine and its tests — which is where this assignment's grading weight sits. In a system with multiple consumers, independent scaling needs, or separate team ownership of frontend/backend, I would split it into a dedicated backend service instead.

---

## Prerequisites

- Node.js 18+
- A PostgreSQL database (this project was built against [Neon](https://neon.tech), free tier)
- npm

## Setup

1. **Clone and install**
   ```bash
   git clone <repo-url>
   cd pricing-calculator
   npm install
   ```

2. **Environment variables** — create a `.env` file in the project root:
   ```
   DATABASE_URL="postgresql://<user>:<password>@<host>/<db>?sslmode=require"
   NEXTAUTH_SECRET="<random 32+ character string>"
   NEXTAUTH_URL="http://localhost:3000"
   ```
   Generate a secret with `openssl rand -base64 32`.

3. **Run the database migration**
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

4. **Run the tests** (calculation module — highest-value test surface in this assignment)
   ```bash
   npm test
   ```
   All 11 tests should pass, verified against the assignment's exact sample table.

5. **Start the dev server**
   ```bash
   npm run dev
   ```
   Visit `http://localhost:3000`, sign up, and start creating documents.

---

## Calculation and rounding policy

All money is stored as **integer cents** internally, and all percentages as **integer basis points** (10000 = 100%) — this avoids floating-point drift entirely. The client sends and displays human units (rupees, percent); conversion happens once at the API boundary (`lib/money.ts`).

**Per-line calculation** (`lib/pricing.ts`, `calcLine()`):
1. `subtotal = quantity × unitPrice`
2. Apply discount:
   - **Percent**: `discountAmount = round(subtotal × discountPercent)`
   - **Fixed**: `discountAmount = discountValue` (rejected if it exceeds the subtotal — see below)
   - **None**: `discountAmount = 0`
3. `afterDiscount = subtotal − discountAmount`
4. `taxAmount = round(afterDiscount × taxPercent)` — **tax is computed on the discounted amount, not the raw subtotal**
5. `lineTotal = afterDiscount + taxAmount`

**Rounding policy:** round-half-up to the nearest cent, applied twice per line — once for the discount amount, once for the tax amount. This matches "round to 2 decimal places per line" and keeps every intermediate figure exact rather than only rounding the final total.

**Document totals** (`calcDocument()`): sum of each line's subtotal, discount amount, tax amount, and line total, respectively. Never recomputed with a different rounding rule — literally a sum of the already-rounded per-line figures, so document totals always tie out to the sum of what's shown on each line.

### Worked example (the assignment's sample document)

| Line | Qty | Unit price | Discount | Tax | Subtotal | Discount amt | After discount | Tax amt | Line total |
|---|---|---|---|---|---|---|---|---|---|
| Widget A | 2 | 100.00 | 10% | 5% | 200.00 | 20.00 | 180.00 | 9.00 | **189.00** |
| Widget B | 1 | 50.00 | — | 5% | 50.00 | 0.00 | 50.00 | 2.50 | **52.50** |
| Service fee | 1 | 200.00 | $20 fixed | — | 200.00 | 20.00 | 180.00 | 0.00 | **180.00** |

**Document totals:** Subtotal 450.00 · Total discount 40.00 · Total tax 11.50 · **Grand total 421.50**

Note Widget A's tax is 5% of **180** (the discounted amount), not 5% of 200 — this is the calculation the assignment specifically flags as a common mistake, and it's covered by a dedicated unit test in `lib/pricing.test.ts`.

### Fixed discount vs. subtotal

If a fixed discount exceeds the line's subtotal, the API **rejects** the request with a 400 error rather than silently clamping it to the subtotal. Rationale: clamping changes the number the user actually typed without telling them, which is worse UX for a billing tool where every figure should be traceable to what was entered. A clear rejection with the exact subtotal in the error message lets the user correct the input themselves.

### Discount exclusivity

A line can have a percent discount, a fixed discount, or neither — never both. This is enforced at the **Zod validation layer** (API request validation), not as a database constraint. A DB-level `CHECK` constraint would be the more airtight production answer; validating at the API layer was the faster path for this scope, and the calc module's own type (`discountType: "none" | "percent" | "fixed"`) makes the two states structurally exclusive anyway, reducing the risk of the DB layer alone.

---

## Document lifecycle

| Status | Behavior |
|---|---|
| `draft` | Fully editable — add, edit, remove line items; edit title/customer/issue date |
| `finalized` | Read-only — every mutating endpoint (line item create/edit/delete, document metadata update, delete) rejects with `409 DOCUMENT_FINALIZED` |

**Finalize** (`POST /api/documents/:id/finalize`):
- Re-validates every line item through the same calc module used everywhere else, so nothing invalid can be locked in
- Rejects finalizing a document with zero line items (`422 EMPTY_DOCUMENT`) — not explicitly required by the spec, but seemed like a reasonable guard against creating a meaningless finalized record
- **Idempotent** — calling finalize on an already-finalized document returns `200` with `alreadyFinalized: true` rather than an error, so a client retry (e.g. a flaky network) can't produce a false failure
- Sets `finalizedAt` and `finalizedBy` (the user id), so there's an audit trail of who locked the document and when

**Duplicate** (`POST /api/documents/:id/duplicate`, stretch goal):
- Only available on **finalized** documents — a draft is already editable, so duplicating one doesn't add value
- Copies all line items into a fresh document with `status: draft`, `finalizedAt`/`finalizedBy` reset to `null`
- The new draft's issue date defaults to **today**, not the original document's issue date — assumption: a duplicate is typically used to create a *new* document based on an old template, not to re-date the same transaction

---

## API overview

All endpoints are scoped to the authenticated user (via session) and return `404` for documents belonging to another user (never `403`, to avoid confirming whether an id exists).

| Method | Endpoint | Notes |
|---|---|---|
| POST | `/api/signup` | Create account |
| POST | `/api/auth/callback/credentials` | Login (NextAuth) |
| GET | `/api/documents` | List documents with computed totals |
| POST | `/api/documents` | Create a document (optionally with line items) |
| GET | `/api/documents/:id` | Full document with per-line and document totals |
| PATCH | `/api/documents/:id` | Update metadata — draft only |
| DELETE | `/api/documents/:id` | Delete — draft only |
| POST | `/api/documents/:id/line-items` | Add a line item — draft only |
| PATCH | `/api/documents/:id/line-items/:lineItemId` | Edit a line item — draft only |
| DELETE | `/api/documents/:id/line-items/:lineItemId` | Remove a line item — draft only |
| POST | `/api/documents/:id/finalize` | Lock the document — idempotent |
| POST | `/api/documents/:id/duplicate` | Clone a finalized document into a new draft |
| GET | `/api/reports/summary?from=&to=` | Date-range aggregation |

**Error shape**, consistent across every endpoint:
```json
{ "error": { "code": "DOCUMENT_FINALIZED", "message": "This document is finalized and cannot be edited", "field": "quantity" } }
```
`code` and `field` are omitted where not applicable (e.g. generic validation errors only include `message` and `field`).

**Optimistic concurrency:** `PATCH /api/documents/:id` accepts an optional `expectedUpdatedAt`. If the document was modified since the client last loaded it, the request is rejected with `409 STALE_UPDATE` instead of silently overwriting a concurrent edit.

---

## Summary report

`GET /api/reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD` filters documents by `issueDate` within the (inclusive) range and returns document count plus summed grand total, tax, and discount.

**Design note:** totals are **never persisted** — every read (document detail, list, report) recomputes from the stored line items via the same `calcDocument()` function. This guarantees the database can never drift out of sync with the calculation logic; there's exactly one source of truth for "what a document is worth." The tradeoff is that the report aggregates in application code (fetch matching documents, run calc on each, sum in JS) rather than a SQL `SUM()` — fine at this scale, but see "what I'd improve" below.

---

## Assumptions and tradeoffs

- **Rounding:** half-up, to the cent, applied at the discount-amount and tax-amount steps per line (documented above)
- **Fixed discount > subtotal:** rejected, not clamped
- **Discount exclusivity:** enforced at the Zod layer, not a DB constraint
- **Architecture:** Next.js monolith rather than a separate backend service
- **Totals:** computed live, never stored, to guarantee consistency
- **Duplicate:** only allowed on finalized documents; new draft's issue date defaults to today
- **Finalize:** rejects documents with zero line items
- **Delete:** only permitted on drafts — finalized documents are immutable, including deletion, to preserve them as an audit-safe record
- **Print view:** browser-rendered "Print / Save as PDF" (no PDF library) — one known limitation is that some browsers' own header/footer print option (URL, page number) can push a short document onto a second page; this is a browser setting outside the app's control, not a bug in the print layout itself

---

## What I'd improve before production

- **Database-level discount exclusivity** — a `CHECK` constraint as a second line of defense behind the Zod validation
- **SQL-level report aggregation** — replace the per-document JS loop with a `SUM()`/`GROUP BY` query once document volume grows past a few thousand rows
- **Rate limiting** on auth endpoints (signup, login)
- **Row-level locking on finalize** under concurrent requests — the current idempotency check handles the common case (client retry) but a true race (two finalize requests landing at the exact same moment) isn't fully guarded against
- **Soft-delete** instead of hard delete on draft documents, for recoverability
- **Audit log** beyond `finalizedAt`/`finalizedBy` — track all status transitions and metadata edits, not just the finalize event
- **Multi-currency support** — currently hardcoded to a single currency display (₹)

---

## Testing

Unit tests cover the calculation module exclusively (`lib/pricing.test.ts`) — per the assignment's own guidance, this is the highest-value test surface. Tests verify:
- Every line and document total from the assignment's sample table, exactly
- Rejection of invalid quantity, negative price, fixed-discount-exceeds-subtotal, discount/tax percent over 100%
- Edge cases: zero-price line, empty document

Run with `npm test`.
