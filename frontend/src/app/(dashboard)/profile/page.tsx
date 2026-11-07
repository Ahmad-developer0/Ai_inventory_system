import { Card, PageHeader } from "@/components/ui";
import { ChangePassword } from "./change-password";
import { getProfile } from "@/lib/auth";

export default async function ProfilePage() {
  const profile = await getProfile();
  return (
    <>
      <PageHeader title="Profile" description="Your account details and password." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Account">
          <dl className="grid gap-3 p-5 text-sm">
            {[
              ["Name", profile.full_name || "—"],
              ["Email", profile.email],
              ["Role", profile.role],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-medium capitalize text-slate-900">{v}</dd>
              </div>
            ))}
            <p className="mt-2 text-xs text-slate-500">Ask an admin to change your name or role.</p>
          </dl>
        </Card>
        <Card title="Change password">
          <ChangePassword />
        </Card>
      </div>
    </>
  );
}
