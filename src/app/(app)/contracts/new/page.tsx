import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { createContract } from "@/lib/actions/contracts";
import { ErrorBanner, PageHeader } from "@/components/ui";

export default async function NewContractPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; supplierId?: string; projectId?: string }>;
}) {
  const auth = await requireAuth();
  if (auth.role === "VIEWER") redirect("/contracts");
  const { error, supplierId, projectId } = await searchParams;

  const [suppliers, projects] = await Promise.all([
    prisma.supplier.findMany({
      where: { workspaceId: auth.workspace.id },
      orderBy: { name: "asc" },
    }),
    prisma.project.findMany({
      where: { workspaceId: auth.workspace.id, status: { not: "ARCHIVED" } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="New contract"
        subtitle="A reference record — the signed document lives wherever your documents live"
      />
      <ErrorBanner error={error} />

      <form action={createContract} className="card space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Title *</label>
            <input name="title" className="input" required />
          </div>
          <div>
            <label className="label">Reference no.</label>
            <input name="reference" className="input" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Supplier *</label>
            <select name="supplierId" className="input" required defaultValue={supplierId ?? ""}>
              <option value="">Select…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Originating project</label>
            <select name="projectId" className="input" defaultValue={projectId ?? ""}>
              <option value="">None</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Start date *</label>
            <input name="startDate" type="date" className="input" required />
          </div>
          <div>
            <label className="label">End date *</label>
            <input name="endDate" type="date" className="input" required />
          </div>
          <div>
            <label className="label">Renewal notice (days)</label>
            <input
              name="renewalNoticeDays"
              type="number"
              min="0"
              className="input"
              defaultValue={90}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Value</label>
            <input name="value" type="number" min="0" className="input" />
          </div>
          <div>
            <label className="label">Currency</label>
            <input
              name="currency"
              className="input"
              maxLength={3}
              defaultValue={auth.workspace.currency}
            />
          </div>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea name="notes" className="input" rows={3} />
        </div>
        <div className="flex justify-end gap-2">
          <a href="/contracts" className="btn">
            Cancel
          </a>
          <button className="btn btn-primary">Create contract</button>
        </div>
      </form>
    </div>
  );
}
