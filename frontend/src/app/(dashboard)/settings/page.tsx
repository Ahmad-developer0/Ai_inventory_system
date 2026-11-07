import { Button, Card, Input, PageHeader } from "@/components/ui";

function Toggle({ label, hint, on = true }: { label: string; hint: string; on?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>
      <span className={`mt-1 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 ${on ? "bg-amber-500" : "bg-slate-300"}`}>
        <span className={`size-4 rounded-full bg-white transition-transform ${on ? "translate-x-4" : ""}`} />
      </span>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <>
      <PageHeader demo title="Settings" description="Business profile, AI agent rules and integrations." />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Business profile">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Input label="Business name" defaultValue="Precision Digi Electronics" />
            <Input label="NTN / STRN" defaultValue="1234567-8" />
            <Input label="Phone" defaultValue="+92 42 3700 0000" />
            <Input label="City" defaultValue="Lahore" />
            <div className="sm:col-span-2">
              <Input label="Quotation validity (days)" type="number" defaultValue={7} />
            </div>
          </div>
        </Card>

        <Card title="AI agent rules">
          <div className="divide-y divide-slate-100 px-5">
            <Toggle label="Prices only from the database" hint="The agent never makes up a price." />
            <Toggle label="Max discount without approval: 5%" hint="A bigger discount creates a manager approval request." />
            <Toggle label="Safety-critical questions go to a technician" hint="Wiring, earthing and supply mismatch cases are handed off." />
            <Toggle label="Languages: Urdu, English, Punjabi" hint="Replies in the language the customer uses." />
          </div>
        </Card>

        <Card title="Integrations">
          <div className="grid gap-4 p-5">
            <Input label="WhatsApp Phone Number ID" placeholder="From Meta Business" />
            <Input label="Claude API key" type="password" placeholder="sk-ant-…" />
            <p className="text-xs text-slate-500">In production, keys live in the server .env file, never in the browser.</p>
          </div>
        </Card>

        <Card title="Follow-up automation">
          <div className="divide-y divide-slate-100 px-5">
            <Toggle label="Auto follow-up on Day 3" hint="Send a WhatsApp template if the quotation gets no reply." />
            <Toggle label="Second follow-up on Day 7" hint="If there is still no reply after the first follow-up." on={false} />
            <Toggle label="Respect opt-out" hint="Opted-out customers get no marketing messages." />
          </div>
        </Card>
      </div>

      <div className="mt-6 flex justify-end">
        <Button>Save settings</Button>
      </div>
    </>
  );
}
