import { Badge } from "@/components/ui";
import type { Conversation, Followup, KnowledgeDoc } from "@/lib/demo-data";
import type { PaymentStatus, QuotationStatus, StockStatus } from "@/lib/types";

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const tone = status === "paid" ? "green" : status === "partial" ? "amber" : "red";
  return <Badge tone={tone}>{status[0].toUpperCase() + status.slice(1)}</Badge>;
}

export function QuotationStatusBadge({ status }: { status: QuotationStatus }) {
  const map = {
    draft: { tone: "gray", label: "Draft" },
    pending_approval: { tone: "amber", label: "Pending approval" },
    approved: { tone: "blue", label: "Approved" },
    sent: { tone: "violet", label: "Sent" },
    accepted: { tone: "green", label: "Accepted" },
    rejected: { tone: "red", label: "Rejected" },
  } as const;
  const { tone, label } = map[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function StockBadge({ status }: { status: StockStatus }) {
  if (status === "out") return <Badge tone="red">Out of stock</Badge>;
  if (status === "low") return <Badge tone="amber">Low stock</Badge>;
  return <Badge tone="green">In stock</Badge>;
}

export function OutcomeBadge({ outcome }: { outcome: Conversation["outcome"] }) {
  const map = {
    quotation: { tone: "green", label: "Quotation" },
    info: { tone: "blue", label: "Info given" },
    handoff: { tone: "amber", label: "Human handoff" },
    no_stock: { tone: "red", label: "Out of stock" },
  } as const;
  const { tone, label } = map[outcome];
  return <Badge tone={tone}>{label}</Badge>;
}

export function FollowupStatusBadge({ status }: { status: Followup["status"] }) {
  const tone = status === "pending" ? "amber" : status === "completed" ? "green" : "gray";
  return <Badge tone={tone}>{status[0].toUpperCase() + status.slice(1)}</Badge>;
}

export function DocStatusBadge({ status }: { status: KnowledgeDoc["status"] }) {
  const map = {
    approved: { tone: "green", label: "Approved" },
    processing: { tone: "blue", label: "Processing" },
    pending_review: { tone: "amber", label: "Pending review" },
  } as const;
  const { tone, label } = map[status];
  return <Badge tone={tone}>{label}</Badge>;
}
