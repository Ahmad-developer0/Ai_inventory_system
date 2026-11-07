import { isSupabaseConfigured } from "@/lib/supabase/env";

export default function SetupPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-slate-900">Supabase setup</h1>
      {isSupabaseConfigured ? (
        <p className="mt-4 text-emerald-700">Supabase is connected. <a href="/login" className="underline">Sign in</a>.</p>
      ) : (
        <>
          <p className="mt-2 text-slate-600">The app needs a database. Do these steps once:</p>
          <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm text-slate-700">
            <li>Create a free project on supabase.com.</li>
            <li>
              In the SQL Editor, run the files in <code className="rounded bg-slate-100 px-1">supabase/migrations</code> in order
              (0001 → 0005), then <code className="rounded bg-slate-100 px-1">supabase/seed.sql</code>.
            </li>
            <li>
              Copy the URL and anon key from Project Settings → API into <code className="rounded bg-slate-100 px-1">frontend/.env.local</code>
              (see <code className="rounded bg-slate-100 px-1">.env.example</code>).
            </li>
            <li>Create your admin account in Authentication → Users → Add user (the first user becomes admin).</li>
            <li>Restart the dev server.</li>
          </ol>
        </>
      )}
    </div>
  );
}
