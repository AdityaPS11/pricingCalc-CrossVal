"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewDocumentPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [customer, setCustomer] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, customer, issueDate, lineItems: [] }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error?.message ?? "Something went wrong.");
      return;
    }

    router.push(`/documents/${data.document.id}`);
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <div className="page-header">
        <h1 className="page-title">New document</h1>
      </div>

      <div className="auth-card" style={{ maxWidth: "none" }}>
        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field-group">
            <label className="field-label" htmlFor="title">Title</label>
            <input
              id="title"
              className="field-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Invoice #1042"
              required
            />
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="customer">Customer</label>
            <input
              id="customer"
              className="field-input"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="e.g. Acme Corp"
              required
            />
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="issueDate">Issue date</label>
            <input
              id="issueDate"
              type="date"
              className="field-input"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              required
            />
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button type="submit" className="btn-accent" disabled={loading} style={{ flex: 1 }}>
              {loading ? "Creating…" : "Create document"}
            </button>
            <Link href="/documents" className="btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
