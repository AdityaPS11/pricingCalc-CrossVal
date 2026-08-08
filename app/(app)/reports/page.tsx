"use client";

import { useState } from "react";
import { centsToAmount } from "@/lib/money";

interface ReportData {
  from: string;
  to: string;
  documentCount: number;
  sumGrandTotalCents: number;
  sumTaxCents: number;
  sumDiscountCents: number;
}

function firstOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [report, setReport] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function runReport(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch(`/api/reports/summary?from=${from}&to=${to}`);
    const data = await res.json();

    setLoading(false);

    if (!res.ok) {
      setError(data.error?.message ?? "Failed to load report");
      setReport(null);
      return;
    }

    setReport(data.report);
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
      </div>

      <form onSubmit={runReport} className="report-filter">
        <div className="field-group" style={{ marginBottom: 0 }}>
          <label className="field-label">From</label>
          <input
            type="date"
            className="field-input"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            required
          />
        </div>
        <div className="field-group" style={{ marginBottom: 0 }}>
          <label className="field-label">To</label>
          <input
            type="date"
            className="field-input"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn-accent" disabled={loading}>
          {loading ? "Running…" : "Run report"}
        </button>
      </form>

      {error && <div className="auth-error" style={{ marginTop: 20 }}>{error}</div>}

      {report && (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-label">Documents</div>
            <div className="stat-value">{report.documentCount}</div>
          </div>
          <div className="stat-card stat-card-accent">
            <div className="stat-label">Grand total</div>
            <div className="stat-value">₹{centsToAmount(report.sumGrandTotalCents).toFixed(2)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total tax</div>
            <div className="stat-value">₹{centsToAmount(report.sumTaxCents).toFixed(2)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total discount</div>
            <div className="stat-value">₹{centsToAmount(report.sumDiscountCents).toFixed(2)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
