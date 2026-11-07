export function formatPKR(n: number | string | null | undefined): string {
  return "Rs " + Math.round(Number(n ?? 0)).toLocaleString("en-PK");
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(d: string): string {
  return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
