import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function RootPage() {
  const session = await getServerSession(authOptions);

  if (session?.user) {
    redirect("/documents");
  }

  return (
    <div className="landing-shell">
      <div className="landing-content">
        <div className="auth-eyebrow">Ledger</div>
        <h1 className="landing-title">
          Documents, discounts, and tax —<br />computed right, every time.
        </h1>
        <p className="landing-sub">
          Create quotes and invoices with per-line discounts and tax, lock them once
          they&apos;re final, and see exactly how every total was calculated.
        </p>
        <div className="landing-actions">
          <Link href="/signup" className="btn-accent">
            Create account
          </Link>
          <Link href="/login" className="btn-secondary">
            Sign in
          </Link>
        </div>

        <div className="landing-features">
          <div className="landing-feature">
            <span className="stamp-draft">Draft</span>
            <p>Fully editable — add, edit, and remove line items freely.</p>
          </div>
          <div className="landing-feature">
            <span className="stamp-finalized">Finalized</span>
            <p>Locked and immutable — the numbers are settled, permanently.</p>
          </div>
        </div>
      </div>
    </div>
  );
}