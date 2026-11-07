"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, Plus, ShoppingCart } from "lucide-react";
import { LinkButton } from "@/components/ui";
import type { CatalogProduct } from "@/lib/types";
import { qtyWithUnit } from "@/lib/units";

export function Topbar({ canPurchase, alerts }: { canPurchase: boolean; alerts: CatalogProduct[] }) {
  const [open, setOpen] = useState(false);
  const outCount = alerts.filter((a) => a.stock_status === "out").length;

  return (
    <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold text-slate-800">Precision Digi Electronics</p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setOpen((o) => !o)}
              className="relative rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50"
              aria-label="Stock alerts"
            >
              <Bell size={18} />
              {alerts.length > 0 && (
                <span
                  className={`absolute -right-1.5 -top-1.5 min-w-5 rounded-full px-1 text-center text-xs font-semibold text-white ${
                    outCount > 0 ? "bg-red-600" : "bg-amber-500"
                  }`}
                >
                  {alerts.length}
                </span>
              )}
            </button>
            {open && (
              <div className="absolute right-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white shadow-lg">
                <p className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800">Stock alerts</p>
                {alerts.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-slate-500">All stock levels are fine.</p>
                ) : (
                  <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
                    {alerts.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-slate-800">{a.name}</p>
                          <p className="text-xs text-slate-500">Reorder level: {a.reorder_level}</p>
                        </div>
                        <span className={`shrink-0 text-xs font-semibold ${a.stock_status === "out" ? "text-red-600" : "text-amber-700"}`}>
                          {a.stock_status === "out" ? "Out of stock" : `${qtyWithUnit(a.stock, a.unit)} left`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <Link href="/inventory" onClick={() => setOpen(false)} className="block border-t border-slate-100 px-4 py-2.5 text-center text-sm text-amber-600 hover:bg-slate-50">
                  Open inventory →
                </Link>
              </div>
            )}
          </div>
          <LinkButton href="/sales/pos" variant="teal" icon={ShoppingCart}>
            POS Sales
          </LinkButton>
          {canPurchase && (
            <LinkButton href="/purchases/new" variant="red" icon={Plus}>
              Add Purchase
            </LinkButton>
          )}
          <LinkButton href="/sales/new" variant="teal" icon={Plus}>
            Add Sale
          </LinkButton>
        </div>
      </div>
    </div>
  );
}
