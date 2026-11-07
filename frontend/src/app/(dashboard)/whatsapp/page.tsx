"use client";

import { useState } from "react";
import { Bot, Send, UserRound } from "lucide-react";
import { Badge, Card, PageHeader } from "@/components/ui";
import { whatsappThreads } from "@/lib/demo-data";

export default function WhatsAppInboxPage() {
  const [activeId, setActiveId] = useState(whatsappThreads[0].id);
  const active = whatsappThreads.find((t) => t.id === activeId)!;

  return (
    <>
      <PageHeader demo title="WhatsApp Inbox" description="Chats handled by the AI. A salesperson can take over at any time." />

      <Card className="grid overflow-hidden md:h-[600px] md:grid-cols-[300px_1fr]">
        <ul className="divide-y divide-slate-100 border-b border-slate-200 md:overflow-y-auto md:border-b-0 md:border-r">
          {whatsappThreads.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => setActiveId(t.id)}
                className={`w-full px-4 py-3 text-left ${t.id === activeId ? "bg-amber-50" : "hover:bg-slate-50"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-slate-900">{t.customer}</p>
                  <span className="text-xs text-slate-400">{t.time}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="truncate text-xs text-slate-500">{t.lastMessage}</p>
                  {t.unread > 0 && (
                    <span className="rounded-full bg-emerald-500 px-1.5 text-xs font-medium text-white">{t.unread}</span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>

        <div className="flex min-h-[480px] flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3">
            <div>
              <p className="font-medium text-slate-900">{active.customer}</p>
              <p className="text-xs text-slate-500">{active.phone}</p>
            </div>
            <div className="flex items-center gap-2">
              {active.windowOpen ? (
                <Badge tone="green">24h window open</Badge>
              ) : (
                <Badge tone="amber">Window closed: template only</Badge>
              )}
              <Badge tone={active.assignedTo === "AI Agent" ? "violet" : "blue"}>{active.assignedTo}</Badge>
              <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50">Take over</button>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-5">
            {active.messages.map((m, i) => (
              <div key={i} className={`flex ${m.from === "customer" ? "justify-start" : "justify-end"}`}>
                <div
                  className={`max-w-[80%] rounded-xl px-3.5 py-2 text-sm ${
                    m.from === "customer" ? "bg-white text-slate-800 ring-1 ring-slate-200" : "bg-emerald-100 text-slate-900"
                  }`}
                >
                  {m.from !== "customer" && (
                    <p className="mb-0.5 flex items-center gap-1 text-xs font-medium text-emerald-800">
                      {m.from === "ai" ? <Bot size={12} /> : <UserRound size={12} />}
                      {m.from === "ai" ? "AI Agent" : "Staff"}
                    </p>
                  )}
                  <p>{m.text}</p>
                  <p className="mt-1 text-right text-[10px] text-slate-400">{m.time}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 border-t border-slate-200 p-3">
            <input
              disabled={!active.windowOpen}
              placeholder={active.windowOpen ? "Type a message…" : "The 24h window is closed. Send an approved template."}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500 disabled:bg-slate-100"
            />
            <button className="rounded-lg bg-emerald-600 px-3 text-white hover:bg-emerald-500" aria-label="Send">
              <Send size={16} />
            </button>
          </div>
        </div>
      </Card>
    </>
  );
}
