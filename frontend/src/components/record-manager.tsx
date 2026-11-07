"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Alert, Badge, Button, Card, EmptyRow, Field, fieldClass, Modal, Table, Td } from "@/components/ui";
import { createClient, errorMessage } from "@/lib/supabase/client";

// Simple tables (categories, customers, suppliers) ke liye add / edit / delete / search.

export interface FieldSpec {
  key: string;
  label: string;
  type?: "text" | "tel" | "textarea" | "select" | "checkbox";
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
}

export interface ColumnSpec {
  key: string;
  label: string;
  badge?: Record<string, "gray" | "green" | "amber" | "red" | "blue" | "violet">;
  bool?: [string, string]; // [true label, false label]
}

type Row = { id: number } & Record<string, unknown>;

export function RecordManager({
  table,
  rows,
  fields,
  columns,
  noun,
  canEdit,
  canDelete,
  searchPlaceholder,
  linkPrefix,
  filters = [],
}: {
  table: string;
  rows: Row[];
  fields: FieldSpec[];
  columns: ColumnSpec[];
  noun: string;
  canEdit: boolean;
  canDelete: boolean;
  searchPlaceholder?: string;
  linkPrefix?: string; // diya ho to pehla column `${linkPrefix}/${id}` ka link
  filters?: { key: string; label: string; options: string[] }[]; // list ke upar dropdown filters
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return rows.filter(
      (r) =>
        filters.every((f) => !filterValues[f.key] || String(r[f.key]) === filterValues[f.key]) &&
        columns.some((c) => String(r[c.key] ?? "").toLowerCase().includes(q)),
    );
  }, [rows, columns, query, filters, filterValues]);

  const remove = async (r: Row) => {
    if (!confirm(`Delete "${String(r.name ?? r.id)}"?`)) return;
    const { error } = await createClient().from(table).delete().eq("id", r.id);
    setMessage(error ? { tone: "error", text: errorMessage(error) } : { tone: "success", text: `${noun} deleted.` });
    router.refresh();
  };

  return (
    <>
      {message && (
        <div className="mb-4">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder ?? "Search…"} className={`${fieldClass} pl-9`} />
          </div>
          {filters.map((f) => (
            <select
              key={f.key}
              value={filterValues[f.key] ?? ""}
              onChange={(e) => setFilterValues((v) => ({ ...v, [f.key]: e.target.value }))}
              className={`${fieldClass} sm:w-44`}
              aria-label={f.label}
            >
              <option value="">{f.label}: all</option>
              {f.options.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          ))}
          {canEdit && (
            <Button icon={Plus} onClick={() => setEditing("new")}>
              Add {noun.toLowerCase()}
            </Button>
          )}
        </div>
        <Table head={[...columns.map((c) => c.label), ...(canEdit ? [""] : [])]}>
          {filtered.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              {columns.map((c, i) => {
                const v = r[c.key];
                let content: React.ReactNode = v === null || v === undefined || v === "" ? <span className="text-slate-300">—</span> : String(v);
                if (c.badge && v) content = <Badge tone={c.badge[String(v)] ?? "gray"}>{String(v)}</Badge>;
                if (c.bool) content = v ? <Badge tone="red">{c.bool[0]}</Badge> : <Badge tone="green">{c.bool[1]}</Badge>;
                if (i === 0 && linkPrefix)
                  content = (
                    <Link href={`${linkPrefix}/${r.id}`} className="text-teal-700 hover:underline">
                      {content}
                    </Link>
                  );
                return (
                  <Td key={c.key} className={i === 0 ? "font-medium text-slate-900" : ""}>
                    {content}
                  </Td>
                );
              })}
              {canEdit && (
                <Td>
                  <div className="flex gap-2">
                    <button onClick={() => setEditing(r)} className="text-slate-400 hover:text-slate-800" aria-label="Edit">
                      <Pencil size={16} />
                    </button>
                    {canDelete && (
                      <button onClick={() => remove(r)} className="text-slate-400 hover:text-red-600" aria-label="Delete">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </Td>
              )}
            </tr>
          ))}
        </Table>
        {filtered.length === 0 && <EmptyRow>{rows.length === 0 ? `No ${noun.toLowerCase()} records yet.` : "Nothing found."}</EmptyRow>}
      </Card>

      {editing && (
        <RecordForm
          table={table}
          fields={fields}
          noun={noun}
          row={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(text) => {
            setEditing(null);
            setMessage({ tone: "success", text });
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function RecordForm({
  table,
  fields,
  noun,
  row,
  onClose,
  onSaved,
}: {
  table: string;
  fields: FieldSpec[];
  noun: string;
  row: Row | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [values, setValues] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(
      fields.map((f) => [f.key, f.type === "checkbox" ? Boolean(row?.[f.key]) : row?.[f.key] == null ? (f.options?.[0]?.value ?? "") : String(row[f.key])]),
    ),
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = Object.fromEntries(
      fields.map((f) => {
        const v = values[f.key];
        return [f.key, typeof v === "string" ? v.trim() || null : v];
      }),
    );
    const supabase = createClient();
    const { error } = row ? await supabase.from(table).update(payload).eq("id", row.id) : await supabase.from(table).insert(payload);
    setSaving(false);
    if (error) return setError(errorMessage(error));
    onSaved(`${noun} ${row ? "updated" : "saved"}.`);
  };

  return (
    <Modal title={row ? `Edit ${noun.toLowerCase()}` : `Add ${noun.toLowerCase()}`} onClose={onClose}>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        {error && (
          <div className="sm:col-span-2">
            <Alert tone="error">{error}</Alert>
          </div>
        )}
        {fields.map((f) => {
          const v = values[f.key];
          const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
            setValues((s) => ({ ...s, [f.key]: f.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));
          if (f.type === "checkbox") {
            return (
              <label key={f.key} className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
                <input type="checkbox" checked={Boolean(v)} onChange={onChange} /> {f.label}
              </label>
            );
          }
          return (
            <Field key={f.key} label={f.label + (f.required ? " *" : "")} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
              {f.type === "select" ? (
                <select value={String(v)} onChange={onChange} className={fieldClass} required={f.required}>
                  {f.options!.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea rows={3} value={String(v)} onChange={onChange} className={fieldClass} placeholder={f.placeholder} />
              ) : (
                <input type={f.type ?? "text"} value={String(v)} onChange={onChange} className={fieldClass} required={f.required} placeholder={f.placeholder} />
              )}
            </Field>
          );
        })}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
