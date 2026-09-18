import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { createSupplier } from "@/lib/actions/suppliers";
import { SUPPLIER_STATUSES, SUPPLIER_TIERS } from "@/lib/domain";
import { getWorkspaceMembers } from "@/lib/queries";
import {
  EmptyState,
  ErrorBanner,
  PageHeader,
} from "@/components/ui";

const STATUS_STYLES: Record<string, string> = {
  PROSPECTIVE: "bg-zinc-100 text-zinc-600",
  ACTIVE: "bg-emerald-50 text-emerald-700",
  UNDER_REVIEW: "bg-amber-50 text-amber-800",
  DO_NOT_USE: "bg-red-50 text-red-700",
};

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; q?: string }>;
}) {
  const auth = await requireAuth();
  const { error, q } = await searchParams;
  const isEditor = auth.role !== "VIEWER";

  const [suppliers, categories, members] = await Promise.all([
    prisma.supplier.findMany({
      where: {
        workspaceId: auth.workspace.id,
        ...(q ? { name: { contains: q } } : {}),
      },
      include: {
        owner: true,
        categories: { include: { category: true } },
        projects: true,
        contracts: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: { workspaceId: auth.workspace.id },
      orderBy: { name: "asc" },
    }),
    getWorkspaceMembers(auth.workspace.id),
  ]);

  return (
    <div>
      <PageHeader
        title="Supplier directory"
        subtitle="Workspace-level, shared across projects — a relationship record, not a purchasing master record"
      />
      <ErrorBanner error={error} />

      <form method="get" className="mb-4 flex items-end gap-2">
        <div>
          <label className="label">Search</label>
          <input
            name="q"
            className="input w-64"
            placeholder="Supplier name…"
            defaultValue={q ?? ""}
          />
        </div>
        <button className="btn">Search</button>
      </form>

      {isEditor ? (
        <details className="card mb-4">
          <summary className="cursor-pointer text-sm font-medium">
            Add supplier…
          </summary>
          <form action={createSupplier} className="mt-3 flex flex-wrap items-end gap-3">
            <div className="min-w-52 flex-1">
              <label className="label">Name *</label>
              <input name="name" className="input" required />
            </div>
            <div>
              <label className="label">Tier</label>
              <select name="tier" className="input w-36" defaultValue="TRANSACTIONAL">
                {Object.entries(SUPPLIER_TIERS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select name="status" className="input w-36" defaultValue="PROSPECTIVE">
                {Object.entries(SUPPLIER_STATUSES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Relationship owner</label>
              <select name="ownerId" className="input w-40">
                <option value="">Unowned</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full">
              <span className="label">Categories</span>
              <div className="flex flex-wrap gap-3">
                {categories.map((c) => (
                  <label key={c.id} className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" name="categoryIds" value={c.id} />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>
            <button className="btn btn-primary">Add supplier</button>
          </form>
        </details>
      ) : null}

      {suppliers.length === 0 ? (
        <EmptyState message="No suppliers found." />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="tbl">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Tier</th>
                <th>Status</th>
                <th>Categories</th>
                <th>Owner</th>
                <th>Projects</th>
                <th>Contracts</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link
                      href={`/suppliers/${s.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {s.name}
                    </Link>
                    {s.riskFlagged ? (
                      <span
                        className="badge ml-2 bg-red-50 text-red-700"
                        title={s.riskNote ?? "Risk flagged"}
                      >
                        ⚑ risk
                      </span>
                    ) : null}
                  </td>
                  <td className="text-sm text-zinc-600">
                    {SUPPLIER_TIERS[s.tier as keyof typeof SUPPLIER_TIERS] ?? s.tier}
                  </td>
                  <td>
                    <span className={`badge ${STATUS_STYLES[s.status] ?? ""}`}>
                      {SUPPLIER_STATUSES[
                        s.status as keyof typeof SUPPLIER_STATUSES
                      ] ?? s.status}
                    </span>
                  </td>
                  <td className="text-sm text-zinc-600">
                    {s.categories.map((c) => c.category.name).join(", ") || "—"}
                  </td>
                  <td className="text-sm">{s.owner?.name ?? "—"}</td>
                  <td className="text-sm text-zinc-500">{s.projects.length}</td>
                  <td className="text-sm text-zinc-500">{s.contracts.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
