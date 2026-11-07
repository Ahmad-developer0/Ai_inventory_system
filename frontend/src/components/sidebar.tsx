"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Role } from "@/lib/types";
import {
  BarChart3,
  LogOut,
  Bot,
  Boxes,
  ChevronDown,
  DatabaseBackup,
  LayoutDashboard,
  Menu,
  RefreshCw,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sun,
  Upload,
  UserRound,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  roles?: Role[]; // khali = sab staff
}

interface NavGroup {
  label: string;
  icon: LucideIcon;
  href?: string;
  roles?: Role[];
  children?: NavItem[];
}

const MANAGERS: Role[] = ["admin", "manager"];

const fullNav: NavGroup[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/" },
  {
    label: "Sales",
    icon: ShoppingCart,
    children: [
      { href: "/sales/invoices", label: "Sales Invoices" },
      { href: "/quotations", label: "Quotations" },
      { href: "/sales/proforma", label: "Proforma Invoice" },
      { href: "/sales/walk-in", label: "Walk-in Customers" },
      { href: "/sales/returns", label: "Cr. Note / Sales Return" },
      { href: "/customers", label: "Customers" },
    ],
  },
  {
    label: "Purchases",
    icon: ShoppingBag,
    roles: MANAGERS,
    children: [
      { href: "/purchases", label: "Purchase Invoices" },
      { href: "/purchases/returns", label: "Dr. Note / Purchase Return" },
      { href: "/suppliers", label: "Suppliers" },
    ],
  },
  {
    label: "Accounts",
    icon: Wallet,
    children: [
      { href: "/accounts/receivables", label: "Receivables" },
      { href: "/accounts/payables", label: "Payables", roles: MANAGERS },
      { href: "/accounts/payments", label: "Payments" },
      { href: "/accounts/expenses", label: "Expenses", roles: MANAGERS },
    ],
  },
  {
    label: "Stocks & Services",
    icon: Boxes,
    children: [
      { href: "/products", label: "Products" },
      { href: "/categories", label: "Categories" },
      { href: "/inventory", label: "Inventory" },
      { href: "/services", label: "Services" },
    ],
  },
  {
    label: "AI Assistant",
    icon: Bot,
    children: [
      { href: "/conversations", label: "AI Calls & Chats" },
      { href: "/whatsapp", label: "WhatsApp Inbox" },
      { href: "/followups", label: "Follow-ups" },
      { href: "/knowledge", label: "Knowledge Base" },
    ],
  },
  {
    label: "Tax & Reports",
    icon: BarChart3,
    roles: MANAGERS,
    children: [
      { href: "/reports", label: "Sales & Profit" },
      { href: "/reports/tax", label: "Sales Tax Report" },
    ],
  },
  { label: "Roles & Users", icon: ShieldCheck, href: "/users", roles: ["admin"] },
];

const bottomNav: (NavItem & { icon: LucideIcon })[] = [
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/bulk-upload", label: "Bulk Uploads", icon: Upload, roles: MANAGERS },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["admin"] },
  { href: "/sync", label: "Sync Data", icon: RefreshCw },
  { href: "/backup", label: "Backup & Restore", icon: DatabaseBackup, roles: ["admin"] },
  { href: "/audit", label: "Audit Log", icon: ScrollText, roles: ["admin"] },
];

const allowed = (role: Role, roles?: Role[]) => !roles || roles.includes(role);

// Sab se lamba matching href active hai, taake /reports aur /reports/tax dono ek saath active na hon.
function activeHref(pathname: string, hrefs: string[]): string | undefined {
  return hrefs
    .filter((h) => (h === "/" ? pathname === "/" : pathname === h || pathname.startsWith(h + "/")))
    .sort((a, b) => b.length - a.length)[0];
}

export function Sidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const router = useRouter();
  const nav = fullNav
    .filter((g) => allowed(profile.role, g.roles))
    .map((g) => ({ ...g, children: g.children?.filter((c) => allowed(profile.role, c.roles)) }));
  const bottom = bottomNav.filter((b) => allowed(profile.role, b.roles));
  const active = activeHref(pathname, [
    ...nav.flatMap((g) => (g.href ? [g.href] : g.children!.map((c) => c.href))),
    ...bottom.map((b) => b.href),
  ]);
  const [open, setOpen] = useState(false);

  const signOut = async () => {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  };
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(nav.filter((g) => g.children?.some((c) => c.href === active)).map((g) => [g.label, true])),
  );

  const linkClass = (isActive: boolean) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
      isActive ? "bg-amber-500/15 font-medium text-amber-400" : "text-slate-400 hover:bg-slate-900 hover:text-slate-100"
    }`;

  return (
    <>
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-3 lg:hidden">
        <Brand />
        <button onClick={() => setOpen(true)} className="text-slate-300" aria-label="Open menu">
          <Menu size={22} />
        </button>
      </div>

      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-950 transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <Brand />
          <button onClick={() => setOpen(false)} className="text-slate-400 lg:hidden" aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {nav.map((group) => {
            const Icon = group.icon;
            if (group.href) {
              return (
                <Link key={group.label} href={group.href} onClick={() => setOpen(false)} className={`mb-0.5 ${linkClass(active === group.href)}`}>
                  <Icon size={18} />
                  {group.label}
                </Link>
              );
            }
            const isOpen = expanded[group.label];
            const hasActive = group.children!.some((c) => c.href === active);
            return (
              <div key={group.label} className="mb-0.5">
                <button
                  onClick={() => setExpanded((e) => ({ ...e, [group.label]: !e[group.label] }))}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-slate-900 ${
                    hasActive ? "text-slate-100" : "text-slate-400 hover:text-slate-100"
                  }`}
                >
                  <Icon size={18} />
                  <span className="flex-1 text-left">{group.label}</span>
                  <ChevronDown size={16} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="ml-5 mt-0.5 border-l border-slate-800 pl-3">
                    {group.children!.map((c) => (
                      <Link key={c.href} href={c.href} onClick={() => setOpen(false)} className={`mb-0.5 ${linkClass(active === c.href)} py-1.5`}>
                        {c.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div className="my-3 border-t border-slate-800" />

          {bottom.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={() => setOpen(false)} className={`mb-0.5 ${linkClass(active === href)}`}>
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center justify-between gap-2 border-t border-slate-800 px-5 py-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-200">{profile.full_name || profile.email}</p>
            <p className="text-xs capitalize text-slate-500">{profile.role}</p>
          </div>
          <button onClick={signOut} className="rounded-lg p-2 text-slate-400 hover:bg-slate-900 hover:text-slate-100" aria-label="Sign out" title="Sign out">
            <LogOut size={18} />
          </button>
        </div>
      </aside>
    </>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <span className="rounded-lg bg-amber-500 p-1.5 text-slate-950">
        <Sun size={18} />
      </span>
      <span className="font-semibold text-white">SolarSales AI</span>
    </Link>
  );
}
