"use client";

import { useState } from "react";
import { Card, PageHeader, Table, Td } from "@/components/ui";
import { FollowupStatusBadge } from "@/components/status-badges";
import { followups, type Followup } from "@/lib/demo-data";

const tabs: Followup["status"][] = ["pending", "completed", "cancelled"];

export default function FollowupsPage() {
  const [tab, setTab] = useState<Followup["status"]>("pending");
  const rows = followups.filter((f) => f.status === tab);

  return (
    <>
      <PageHeader demo
        title="Follow-ups"
        description="Automatic follow-up on day 3–4 after a quotation. Cancelled automatically on accept, reject or opt-out."
      />

      <div className="mb-4 flex gap-1 rounded-lg bg-slate-200/60 p-1 sm:w-fit">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-4 py-1.5 text-sm capitalize sm:flex-none ${
              tab === t ? "bg-white font-medium text-slate-900 shadow-sm" : "text-slate-600"
            }`}
          >
            {t} ({followups.filter((f) => f.status === t).length})
          </button>
        ))}
      </div>

      <Card>
        <Table head={["Customer", "Quotation", "Due date", "Channel", "Note", "Status"]}>
          {rows.map((f) => (
            <tr key={f.id} className="hover:bg-slate-50">
              <Td className="font-medium text-slate-900">{f.customer}</Td>
              <Td>{f.quotation}</Td>
              <Td>{f.dueDate}</Td>
              <Td className="capitalize">{f.channel}</Td>
              <Td className="text-slate-500">{f.note}</Td>
              <Td>
                <FollowupStatusBadge status={f.status} />
              </Td>
            </tr>
          ))}
        </Table>
        {rows.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No follow-ups in this tab.</p>}
      </Card>
    </>
  );
}
