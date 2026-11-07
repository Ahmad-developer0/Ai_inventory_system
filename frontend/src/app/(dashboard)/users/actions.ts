"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Role } from "@/lib/types";

const ROLES: Role[] = ["admin", "manager", "salesperson", "agent"];

// Naya staff account. Sirf admin; service role key sirf server par rehti hai.
export async function createStaffUser(input: { email: string; password: string; fullName: string; role: Role }): Promise<{ error?: string }> {
  const me = await getProfile();
  if (me.role !== "admin") return { error: "Only an admin can create users." };
  if (!ROLES.includes(input.role)) return { error: "Invalid role." };
  if (input.password.length < 8) return { error: "Password must be at least 8 characters." };

  const admin = createAdminClient();
  if (!admin) return { error: "SUPABASE_SERVICE_ROLE_KEY is not set in .env.local. Until then, use Supabase Dashboard → Authentication → Add user." };

  const { data, error } = await admin.auth.admin.createUser({
    email: input.email.trim(),
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName.trim() },
  });
  if (error) return { error: error.message };

  // Trigger ne profile disabled salesperson banayi; admin ka banaya account active aur chuna hua role
  const { error: roleError } = await admin.from("profiles").update({ role: input.role, full_name: input.fullName.trim(), active: true }).eq("id", data.user.id);
  if (roleError) return { error: `User created, but the role was not set: ${roleError.message}` };

  revalidatePath("/users");
  return {};
}

// User delete. Jis user ki entries (sales, stock waghera) hain use delete nahi karte, taake record rahe; wahan disable karein.
export async function deleteStaffUser(userId: string): Promise<{ error?: string }> {
  const me = await getProfile();
  if (me.role !== "admin") return { error: "Only an admin can delete users." };
  if (userId === me.id) return { error: "You cannot delete your own account." };

  const admin = createAdminClient();
  if (!admin) return { error: "SUPABASE_SERVICE_ROLE_KEY is not set in .env.local." };

  const refs: [string, string][] = [
    ["sales", "created_by"],
    ["purchases", "created_by"],
    ["quotations", "created_by"],
    ["quotations", "approved_by"],
    ["stock_movements", "created_by"],
    ["payments", "created_by"],
  ];
  for (const [table, column] of refs) {
    const { count, error } = await admin.from(table).select("id", { count: "exact", head: true }).eq(column, userId);
    if (error) return { error: error.message };
    if (count) {
      return { error: `This user has ${count} ${table.replace("_", " ")} records, so they cannot be deleted without breaking history. Click their status to disable them instead.` };
    }
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };
  revalidatePath("/users");
  return {};
}
