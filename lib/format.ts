// Explicit locale (not the runtime default) so server-rendered and client-rendered
// dates always match — avoids hydration mismatches caused by differing default
// locales between the Node server and the browser.
export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}