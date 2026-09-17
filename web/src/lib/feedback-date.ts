/** Postgres returns Date objects; report filters compare canonical ISO strings. */
export function feedbackDateIso(value: unknown): string {
  if (!(value instanceof Date) && typeof value !== "string") return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}
