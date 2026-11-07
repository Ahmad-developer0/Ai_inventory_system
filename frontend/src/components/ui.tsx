import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  demo,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  demo?: boolean;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold text-slate-900">
          {title}
          {demo && (
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600" title="This page is not connected to the database yet">
              Demo data
            </span>
          )}
        </h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white ${className}`}>
      {title && (
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "slate",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: "slate" | "amber" | "green" | "red" | "blue";
}) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    amber: "bg-amber-100 text-amber-700",
    green: "bg-emerald-100 text-emerald-700",
    red: "bg-red-100 text-red-700",
    blue: "bg-blue-100 text-blue-700",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        <span className={`rounded-lg p-2 ${tones[tone]}`}>
          <Icon size={16} />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

const badgeTones: Record<string, string> = {
  gray: "bg-slate-100 text-slate-700",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  blue: "bg-blue-50 text-blue-700 ring-blue-600/20",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/20",
};

export function Badge({ tone = "gray", children }: { tone?: keyof typeof badgeTones; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center whitespace-normal rounded-xl px-2 py-0.5 text-center text-xs font-medium leading-tight ring-1 ring-inset ring-slate-500/10 ${badgeTones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  variant = "primary",
  icon: Icon,
  type = "button",
  onClick,
  disabled,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger";
  icon?: LucideIcon;
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
}) {
  const styles = {
    primary: "bg-amber-500 text-slate-950 hover:bg-amber-400",
    secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
    danger: "bg-red-600 text-white hover:bg-red-500",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles}`}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  children,
  variant = "primary",
  icon: Icon,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "teal" | "red";
  icon?: LucideIcon;
}) {
  const styles = {
    primary: "bg-amber-500 text-slate-950 hover:bg-amber-400",
    secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
    teal: "bg-teal-700 text-white hover:bg-teal-600",
    red: "bg-red-500 text-white hover:bg-red-400",
  };
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${styles[variant]}`}
    >
      {Icon && <Icon size={16} />}
      {children}
    </Link>
  );
}

// colWidths diye hon to table fixed layout use karta hai: columns ki width tay rehti hai aur lamba text "…" ban jata hai.
export function Table({ head, children, colWidths, minWidth }: { head: string[]; children: ReactNode; colWidths?: string[]; minWidth?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-left text-sm ${colWidths ? "table-fixed" : ""}`} style={minWidth ? { minWidth } : undefined}>
        {colWidths && (
          <colgroup>
            {colWidths.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
        )}
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {head.map((h, i) => (
              <th key={`${i}-${h}`} className="truncate px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className = "", title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <td title={title} className={`whitespace-nowrap px-4 py-3 text-slate-700 ${className}`}>
      {children}
    </td>
  );
}

// Lamba text aik line mein "…" ke saath; hover par poora text
export function Truncate({ children }: { children: string }) {
  return (
    <span className="block truncate" title={children}>
      {children}
    </span>
  );
}

export const fieldClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 disabled:bg-slate-100";

export function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input {...props} className={fieldClass} />
    </label>
  );
}

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

export function Alert({ tone, children }: { tone: "error" | "success" | "info"; children: ReactNode }) {
  const styles = {
    error: "bg-red-50 text-red-700 ring-red-600/20",
    success: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
    info: "bg-amber-50 text-amber-800 ring-amber-600/20",
  }[tone];
  return <div className={`rounded-lg px-3 py-2 text-sm ring-1 ring-inset ${styles}`}>{children}</div>;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-xl leading-none text-slate-400 hover:text-slate-700" aria-label="Close">
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function EmptyRow({ children }: { children: ReactNode }) {
  return <p className="p-8 text-center text-sm text-slate-500">{children}</p>;
}
