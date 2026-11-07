"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, UserPlus } from "lucide-react";
import { Alert, Badge, Button, Card, Field, fieldClass, Modal, Table, Td } from "@/components/ui";
import { createClient, errorMessage } from "@/lib/supabase/client";
import { formatDate } from "@/lib/format";
import type { Profile, Role } from "@/lib/types";
import { createStaffUser, deleteStaffUser } from "./actions";

const ROLES: Role[] = ["admin", "manager", "salesperson", "agent"];

export function UsersManager({ users, myId }: { users: Profile[]; myId: string }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState<Profile | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const update = async (u: Profile, patch: Partial<Pick<Profile, "role" | "active" | "full_name">>) => {
    const { error } = await createClient().from("profiles").update(patch).eq("id", u.id);
    setMessage(error ? { tone: "error", text: errorMessage(error) } : { tone: "success", text: `${patch.full_name ?? u.full_name ?? u.email} updated.` });
    router.refresh();
    return !error;
  };

  const remove = async (u: Profile) => {
    if (!confirm(`Permanently delete the account of ${u.full_name || u.email}?`)) return;
    const res = await deleteStaffUser(u.id);
    setMessage(res.error ? { tone: "error", text: res.error } : { tone: "success", text: `${u.email} deleted.` });
    router.refresh();
  };

  return (
    <>
      {message && (
        <div className="mb-4">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}
      <Card title="Staff" action={<Button icon={UserPlus} onClick={() => setAdding(true)}>Add user</Button>}>
        <Table head={["Name", "Email", "Role", "Status", "Joined", ""]}>
          {users.map((u) => {
            const isMe = u.id === myId;
            return (
              <tr key={u.id} className="hover:bg-slate-50">
                <Td className="font-medium text-slate-900">
                  {u.full_name || "—"} {isMe && <Badge tone="blue">You</Badge>}
                </Td>
                <Td>{u.email}</Td>
                <Td>
                  <select
                    value={u.role}
                    disabled={isMe}
                    onChange={(e) => update(u, { role: e.target.value as Role })}
                    className={`${fieldClass} w-36 py-1`}
                    title={isMe ? "You cannot change your own role" : undefined}
                  >
                    {ROLES.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </Td>
                <Td>
                  <button
                    disabled={isMe}
                    onClick={() => update(u, { active: !u.active })}
                    className="disabled:cursor-not-allowed"
                    title={isMe ? undefined : u.active ? "Disable" : "Enable"}
                  >
                    {u.active ? <Badge tone="green">Active</Badge> : <Badge>Disabled</Badge>}
                  </button>
                </Td>
                <Td className="text-slate-500">{formatDate(u.created_at)}</Td>
                <Td>
                  <div className="flex gap-3">
                    <button onClick={() => setRenaming(u)} className="text-slate-400 hover:text-slate-800" aria-label="Edit name" title="Edit name">
                      <Pencil size={16} />
                    </button>
                    {!isMe && (
                      <button onClick={() => remove(u)} className="text-slate-400 hover:text-red-600" aria-label="Delete user" title="Delete user">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </Td>
              </tr>
            );
          })}
        </Table>
      </Card>

      {adding && (
        <AddUserModal
          onClose={() => setAdding(false)}
          onSaved={(text) => {
            setAdding(false);
            setMessage({ tone: "success", text });
            router.refresh();
          }}
        />
      )}

      {renaming && (
        <RenameModal
          user={renaming}
          onClose={() => setRenaming(null)}
          onSave={async (name) => {
            if (await update(renaming, { full_name: name })) setRenaming(null);
          }}
        />
      )}
    </>
  );
}

function RenameModal({ user, onClose, onSave }: { user: Profile; onClose: () => void; onSave: (name: string) => Promise<void> }) {
  const [name, setName] = useState(user.full_name);
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave(name.trim());
    setSaving(false);
  };

  return (
    <Modal title={`Edit name: ${user.email}`} onClose={onClose}>
      <form onSubmit={save} className="grid gap-4">
        <Field label="Full name">
          <input required autoFocus value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !name.trim()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function AddUserModal({ onClose, onSaved }: { onClose: () => void; onSaved: (m: string) => void }) {
  const [form, setForm] = useState({ fullName: "", email: "", password: "", role: "salesperson" as Role });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await createStaffUser(form);
    setSaving(false);
    if (res.error) return setError(res.error);
    onSaved(`Account created for ${form.email} (${form.role}). Share the password with them.`);
  };

  return (
    <Modal title="Add staff user" onClose={onClose}>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        {error && (
          <div className="sm:col-span-2">
            <Alert tone="error">{error}</Alert>
          </div>
        )}
        <Field label="Full name">
          <input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className={fieldClass} />
        </Field>
        <Field label="Email">
          <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={fieldClass} />
        </Field>
        <Field label="Temporary password (8+)">
          <input required minLength={8} type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={fieldClass} />
        </Field>
        <Field label="Role">
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} className={fieldClass}>
            {ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create user"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
