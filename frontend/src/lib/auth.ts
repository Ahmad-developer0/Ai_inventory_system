import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

// Har request par aik dafa: logged-in user ki profile (role ke saath)
export const getProfile = cache(async (): Promise<Profile> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!data || !data.active) redirect("/login?disabled=1");
  return data as Profile;
});

export const isManagerRole = (p: Profile) => p.role === "admin" || p.role === "manager";

// Manager/admin-only pages: salesperson ko dashboard par wapas bhej do (asal hifazat RLS karta hai)
export async function requireManager(): Promise<Profile> {
  const profile = await getProfile();
  if (!isManagerRole(profile)) redirect("/?denied=1");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await getProfile();
  if (profile.role !== "admin") redirect("/?denied=1");
  return profile;
}
