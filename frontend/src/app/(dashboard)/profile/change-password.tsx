"use client";

import { useState } from "react";
import { Alert, Button, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

export function ChangePassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [result, setResult] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setResult({ tone: "error", text: "Password must be at least 8 characters." });
    if (password !== confirm) return setResult({ tone: "error", text: "The passwords do not match." });
    setSaving(true);
    const { error } = await createClient().auth.updateUser({ password });
    setSaving(false);
    setResult(error ? { tone: "error", text: error.message } : { tone: "success", text: "Password changed." });
    if (!error) {
      setPassword("");
      setConfirm("");
    }
  };

  return (
    <form onSubmit={save} className="grid gap-4 p-5">
      {result && <Alert tone={result.tone}>{result.text}</Alert>}
      <Input label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <Input label="Confirm new password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <div>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Update password"}
        </Button>
      </div>
    </form>
  );
}
