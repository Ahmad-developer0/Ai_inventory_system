import { Globe, MessageCircle, Mic } from "lucide-react";
import { Card, PageHeader, StatCard, Table, Td } from "@/components/ui";
import { OutcomeBadge } from "@/components/status-badges";
import { conversations } from "@/lib/demo-data";

const channelIcon = { voice: Mic, whatsapp: MessageCircle, web: Globe };

export default function ConversationsPage() {
  return (
    <>
      <PageHeader demo title="AI Calls & Conversations" description="Every AI voice call and chat with summary and outcome." />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Voice calls (7 days)" value="41" hint="Avg 3m 55s" icon={Mic} tone="amber" />
        <StatCard label="Chats (7 days)" value="118" hint="WhatsApp + web" icon={MessageCircle} tone="green" />
        <StatCard label="Handoff rate" value="9%" hint="Safety-critical and unclear cases" icon={Globe} tone="blue" />
      </div>

      <Card>
        <Table head={["Time", "Customer", "Channel", "Language", "Summary", "Length", "Outcome"]}>
          {conversations.map((c) => {
            const Icon = channelIcon[c.channel];
            return (
              <tr key={c.id} className="hover:bg-slate-50">
                <Td className="text-slate-500">{c.time}</Td>
                <Td className="font-medium text-slate-900">{c.customer}</Td>
                <Td>
                  <span className="flex items-center gap-1.5 capitalize">
                    <Icon size={14} className="text-slate-400" />
                    {c.channel}
                  </span>
                </Td>
                <Td>{c.language}</Td>
                <Td className="max-w-md whitespace-normal text-slate-600">{c.summary}</Td>
                <Td className="tabular-nums">{c.duration}</Td>
                <Td>
                  <OutcomeBadge outcome={c.outcome} />
                </Td>
              </tr>
            );
          })}
        </Table>
      </Card>
    </>
  );
}
