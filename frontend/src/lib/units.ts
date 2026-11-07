// Units of measure (must match the products.unit check in supabase/migrations/0005_sales_update.sql)
export const UNITS = [
  { value: "pcs", label: "Pieces (pcs)", short: "pcs" },
  { value: "ft", label: "Feet (ft)", short: "ft" },
  { value: "yard", label: "Yards (gaz)", short: "yd" },
  { value: "meter", label: "Meters (m)", short: "m" },
  { value: "roll", label: "Rolls", short: "roll" },
  { value: "set", label: "Sets", short: "set" },
  { value: "box", label: "Boxes", short: "box" },
] as const;

export type Unit = (typeof UNITS)[number]["value"];

export function unitShort(unit: string | null | undefined): string {
  return UNITS.find((u) => u.value === unit)?.short ?? "pcs";
}

// "50 ft", "3 pcs"
export function qtyWithUnit(qty: number, unit: string | null | undefined): string {
  return `${qty.toLocaleString("en-PK")} ${unitShort(unit)}`;
}
