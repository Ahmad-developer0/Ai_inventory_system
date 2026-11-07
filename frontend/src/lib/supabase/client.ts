import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

// Browser components ke liye. Saari likhai RLS aur database functions se guzarti hai.
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Supabase/Postgres error ko user ke liye saaf message mein badalta hai.
export function errorMessage(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return "";
  if (/failed to fetch|network|load failed/i.test(error.message ?? "")) {
    return "Could not reach the server. Check your internet connection and try again (nothing was saved).";
  }
  if (error.code === "23505") return "This record already exists (duplicate SKU or name).";
  if (error.code === "23503") return "This record is used by other entries (sales, stock history), so it cannot be deleted.";
  if (error.code === "42501") return "You do not have permission to do this.";
  if (error.message?.includes("min_price_not_above_selling")) return "Minimum price cannot be higher than the selling price.";
  return error.message ?? "Something went wrong.";
}
