// Human-facing units (rupees, percent) <-> internal units (cents, basis points)

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function centsToAmount(cents: number): number {
  return Math.round(cents) / 100;
}

export function toBasisPoints(percent: number): number {
  return Math.round(percent * 100);
}

export function basisPointsToPercent(bps: number): number {
  return Math.round(bps) / 100;
}