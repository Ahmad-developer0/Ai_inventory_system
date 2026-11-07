"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sun } from "lucide-react";
import { Alert, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(params.get("disabled") ? "Your account is disabled. Contact an admin." : "");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message === "Invalid login credentials" ? "Wrong email or password." : error.message);
      return;
    }
    router.replace("/");
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Sign in</h1>
        <p className="mt-1 text-sm text-slate-500">Sign in with your staff account.</p>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      <Input label="Email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input label="Password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-amber-500 py-2.5 text-sm font-medium text-slate-950 hover:bg-amber-400 disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-center text-xs text-slate-500">Only an admin can create new accounts.</p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-slate-950 p-12 lg:flex">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-amber-500 p-1.5 text-slate-950">
            <Sun size={20} />
          </span>
          <span className="text-lg font-semibold text-white">SolarSales AI</span>
        </div>
        <div>
          <h2 className="text-3xl font-semibold leading-tight text-white">Sales for inverters, VFDs, batteries and cables in one place.</h2>
          <p className="mt-4 text-slate-400">Live stock, pricing rules, quotations and accounts. AI agent coming next.</p>
        </div>
        <p className="text-sm text-slate-500">Precision Digi Electronics</p>
      </div>
      <div className="flex items-center justify-center px-4 py-12">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
