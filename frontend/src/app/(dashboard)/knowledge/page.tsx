import { FileText, Upload } from "lucide-react";
import { Badge, Button, Card, PageHeader, Table, Td } from "@/components/ui";
import { DocStatusBadge } from "@/components/status-badges";
import { knowledgeDocs } from "@/lib/demo-data";

export default function KnowledgePage() {
  return (
    <>
      <PageHeader demo
        title="Technical Knowledge Base"
        description="The AI answers technical questions only from approved manuals, datasheets and FAQs (RAG)."
        actions={<Button icon={Upload}>Upload document</Button>}
      />

      <Card className="mb-6 border-dashed p-8 text-center">
        <Upload size={28} className="mx-auto text-slate-400" />
        <p className="mt-2 text-sm font-medium text-slate-700">Drop PDF manuals or datasheets here</p>
        <p className="text-xs text-slate-500">The AI uses them only after review and approval.</p>
      </Card>

      <Card>
        <Table head={["Document", "Type", "Linked product", "Pages", "Uploaded", "Status"]}>
          {knowledgeDocs.map((d) => (
            <tr key={d.id} className="hover:bg-slate-50">
              <Td>
                <span className="flex items-center gap-2 font-medium text-slate-900">
                  <FileText size={16} className="text-slate-400" />
                  {d.title}
                </span>
              </Td>
              <Td>
                <Badge>{d.type}</Badge>
              </Td>
              <Td className="font-mono text-xs">{d.product}</Td>
              <Td className="tabular-nums">{d.pages}</Td>
              <Td>{d.uploaded}</Td>
              <Td>
                <DocStatusBadge status={d.status} />
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
