import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import {
  addSupplierContact,
  removeSupplierContact,
  updateSupplier,
} from "@/lib/actions/suppliers";
import { SUPPLIER_STATUSES, SUPPLIER_TIERS } from "@/lib/domain";
import { fmtDate, fmtMoney } from "@/lib/format";
import { getWorkspaceMembers } from "@/lib/queries";
import { PageHeader, PhaseBadge } from "@/components/ui";
import { CommentsSection } from "@/components/comments";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const auth = await requireAuth();
  const { id } = await params;
  const isEditor = auth.role !== "VIEWER";

  const [supplier, categories, members] = await Promise.all([
    prisma.supplier.findFirst({
      where: { id, workspaceId: auth.workspace.id },
      include: {
        owner: true,
        contacts: true,
        categories: { include: { category: true } },
        projects: {
          include: {
            project: { include: { stages: { orderBy: { order: "asc" } } } },
          },
        },
        contracts: true,
      },
    }),
    prisma.category.findMany({
      where: { workspaceId: auth.workspace.id },
      orderBy: { name: "asc" },
    }),
    getWorkspaceMembers(auth.workspace.id),
  ]);
  if (!supplier) notFound();

  return (
    <div>
      <PageHeader
        title={supplier.name}
        subtitle={`${SUPPLIER_TIERS[supplier.tier as keyof typeof SUPPLIER_TIERS] ?? supplier.tier} · ${
          SUPPLIER_STATUSES[supplier.status as keyof typeof SUPPLIER_STATUSES] ??
          supplier.status
        }${supplier.owner ? ` · owned by ${supplier.owner.name}` : ""}`}
        action={
          supplier.riskFlagged ? (
            <span className="badge bg-red-50 text-red-700" title={supplier.riskNote ?? ""}>
              ⚑ risk flagged
            </span>
          ) : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {supplier.riskFlagged && supplier.riskNote ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <strong>Risk note:</strong> {supplier.riskNote}
            </div>
          ) : null}

          {supplier.notes ? (
            <section className="card">
              <h3 className="mb-2 text-sm font-semibold">Notes</h3>
              <p className="text-sm whitespace-pre-wrap text-zinc-700">
                {supplier.notes}
              </p>
            </section>
          ) : null}

          <section className="card">
            <h3 className="mb-2 text-sm font-semibold">Contacts</h3>
            {supplier.contacts.length === 0 ? (
              <p className="text-sm text-zinc-500">No contacts recorded.</p>
            ) : (
              <table className="tbl mb-2">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Email</th>
                    <th>Phone</th>
                    {isEditor ? <th /> : null}
                  </tr>
                </thead>
                <tbody>
                  {supplier.contacts.map((c) => (
                    <tr key={c.id}>
                      <td className="text-sm font-medium">{c.name}</td>
                      <td className="text-sm text-zinc-600">{c.role ?? "—"}</td>
                      <td className="text-sm text-zinc-600">{c.email ?? "—"}</td>
                      <td className="text-sm text-zinc-600">{c.phone ?? "—"}</td>
                      {isEditor ? (
                        <td>
                          <form action={removeSupplierContact}>
                            <input type="hidden" name="contactId" value={c.id} />
                            <button className="btn btn-sm btn-danger">✕</button>
                          </form>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {isEditor ? (
              <form action={addSupplierContact} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="supplierId" value={supplier.id} />
                <div>
                  <label className="label">Name</label>
                  <input name="name" className="input w-40" required />
                </div>
                <div>
                  <label className="label">Role</label>
                  <input name="role" className="input w-36" />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input name="email" type="email" className="input w-48" />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input name="phone" className="input w-36" />
                </div>
                <button className="btn btn-sm">Add contact</button>
              </form>
            ) : null}
          </section>

          <section className="card">
            <h3 className="mb-2 text-sm font-semibold">Linked projects</h3>
            {supplier.projects.length === 0 ? (
              <p className="text-sm text-zinc-500">
                This supplier hasn't been involved in any projects yet.
              </p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {supplier.projects.map((ps) => {
                  const current = ps.project.stages.find(
                    (s) => s.enteredAt && !s.exitedAt
                  );
                  return (
                    <li
                      key={ps.id}
                      className="flex items-center justify-between gap-2 py-1.5"
                    >
                      <Link
                        href={`/projects/${ps.projectId}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {ps.project.name}
                      </Link>
                      {ps.project.status === "ACTIVE" && current ? (
                        <PhaseBadge phase={current.canonicalPhase} />
                      ) : (
                        <span className="text-xs text-zinc-400">
                          {ps.project.status.toLowerCase()}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="card">
            <h3 className="mb-2 text-sm font-semibold">Contracts</h3>
            {supplier.contracts.length === 0 ? (
              <p className="text-sm text-zinc-500">No contracts recorded.</p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {supplier.contracts.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-2 py-1.5 text-sm"
                  >
                    <Link href={`/contracts/${c.id}`} className="font-medium hover:underline">
                      {c.title}
                    </Link>
                    <span className="text-zinc-500">
                      {fmtMoney(c.value, c.currency)} · ends {fmtDate(c.endDate)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <CommentsSection
            entityType="SUPPLIER"
            entityId={supplier.id}
            returnTo={`/suppliers/${supplier.id}`}
          />
        </div>

        <div>
          {isEditor ? (
            <details className="card">
              <summary className="cursor-pointer text-sm font-semibold">
                Edit supplier
              </summary>
              <form action={updateSupplier} className="mt-3 space-y-3">
                <input type="hidden" name="supplierId" value={supplier.id} />
                <div>
                  <label className="label">Name</label>
                  <input name="name" className="input" defaultValue={supplier.name} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">Tier</label>
                    <select name="tier" className="input" defaultValue={supplier.tier}>
                      {Object.entries(SUPPLIER_TIERS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Status</label>
                    <select name="status" className="input" defaultValue={supplier.status}>
                      {Object.entries(SUPPLIER_STATUSES).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">Relationship owner</label>
                  <select
                    name="ownerId"
                    className="input"
                    defaultValue={supplier.ownerId ?? ""}
                  >
                    <option value="">Unowned</option>
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.user.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="label">Categories</span>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((c) => (
                      <label key={c.id} className="flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          name="categoryIds"
                          value={c.id}
                          defaultChecked={supplier.categories.some(
                            (sc) => sc.categoryId === c.id
                          )}
                        />
                        {c.name}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label">Notes</label>
                  <textarea
                    name="notes"
                    className="input"
                    rows={3}
                    defaultValue={supplier.notes ?? ""}
                  />
                </div>
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    name="riskFlagged"
                    defaultChecked={supplier.riskFlagged}
                  />
                  Risk flagged
                </label>
                <div>
                  <label className="label">Risk note</label>
                  <input
                    name="riskNote"
                    className="input"
                    defaultValue={supplier.riskNote ?? ""}
                  />
                </div>
                <button className="btn btn-primary w-full justify-center">
                  Save changes
                </button>
              </form>
            </details>
          ) : null}
        </div>
      </div>
    </div>
  );
}
