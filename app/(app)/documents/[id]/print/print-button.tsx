"use client";

export function PrintButton() {
  return (
    <button className="btn-accent" onClick={() => window.print()}>
      Print / Save as PDF
    </button>
  );
}
