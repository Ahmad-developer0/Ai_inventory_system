import { Check, Minus } from "lucide-react";
import { Alert, Card, PageHeader, Table, Td } from "@/components/ui";
import { UsersManager } from "./users-manager";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

const permissionMatrix: [string, boolean, boolean, boolean, boolean][] = [
  // [permission, admin, manager, salesperson, AI agent]
  ["View products, selling prices, stock and photos", true, true, true, true],
  ["View minimum price", true, true, true, true],
  ["View purchase cost", true, true, false, false],
  ["Edit products and prices", true, true, false, false],
  ["Stock IN / OUT / adjust", true, true, false, false],
  ["Create quotations", true, true, true, true],
  ["Quote below minimum price", true, true, false, false],
  ["Approve quotations below minimum price", true, true, false, false],
  ["Record sales", true, true, true, false],
  ["Any discount / less on a sale", true, true, false, false],
  ["Receive customer payments", true, true, true, false],
  ["Purchases, payables and supplier payments", true, true, false, false],
  ["See sales, payments and stock history", true, true, true, false],
  ["Manage users and roles, read the audit log", true, false, false, false],
];

export default async function UsersPage() {
  const me = await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("*").order("created_at");

  return (
    <>
      <PageHeader title="User Permissions" description="Staff accounts and roles. These rules are enforced in the database (RLS), not just on screen. Accounts created outside this page start disabled until you enable them." />
      {error ? <Alert tone="error">{error.message}</Alert> : <UsersManager users={(data ?? []) as Profile[]} myId={me.id} />}

      <Card title="Permission matrix" className="mt-6">
        <Table head={["Permission", "Admin", "Manager", "Salesperson", "AI agent"]}>
          {permissionMatrix.map(([label, ...allowed]) => (
            <tr key={label}>
              <Td className="text-slate-800">{label}</Td>
              {allowed.map((ok, i) => (
                <Td key={i}>{ok ? <Check size={16} className="text-emerald-600" /> : <Minus size={16} className="text-slate-300" />}</Td>
              ))}
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
