import Link from "next/link";
import { prisma } from "@/lib/db";
import type { Auth } from "@/lib/auth";
import type { ProjectDetail } from "@/lib/queries";
import {
  archiveProject,
  deleteProject,
  linkSupplier,
  unlinkSupplier,
  updateProject,
} from "@/lib/actions/projects";
import {
  KRALJIC,
  RAG,
  SAVINGS_TYPES,
  SOURCING_TYPES,
  type Kraljic,
  type SourcingType,
} from "@/lib/domain";
import { fmtDate, fmtMoney } from "@/lib/format";
import { CategoryDot } from "@/components/ui";
import { CommentsSection } from "@/components/comments";

export async function OverviewTab({
  project,
  auth,
}: {
  project: ProjectDetail;
  auth: Auth;
}) {
  const isEditor = auth.role !== "VIEWER";
  const [categories, allSuppliers] = await Promise.all([
    prisma.category.findMany({
      where: { workspaceId: auth.workspace.id },
      orderBy: { name: "asc" },
    }),
    prisma.supplier.findMany({
      where: { workspaceId: auth.workspace.id },
      orderBy: { name: "asc" },
    }),
  ]);
  const unlinked = allSuppliers.filter(
    (s) => !project.suppliers.some((ps) => ps.supplierId === s.id)
  );

  const sourcing = project.sourcingType
    ? SOURCING_TYPES[project.sourcingType as SourcingType]
    : null;
  const kraljic = project.kraljic
    ? KRALJIC[project.kraljic as Kraljic]
    : null;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <section className="card">
          <h3 className="mb-2 text-sm font-semibold">Details</h3>
          {project.description ? (
            <p className="mb-3 text-sm whitespace-pre-wrap text-zinc-700">
              {project.description}
            </p>
          ) : null}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-3">
            <div>
              <dt className="text-xs text-zinc-400">Category</dt>
              <dd>
                <CategoryDot category={project.category} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-400">Sourcing event type</dt>
              <dd title={sourcing?.hint}>
                {sourcing ? sourcing.label : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-400">Kraljic quadrant</dt>
              <dd title={kraljic?.hint}>{kraljic ? kraljic.label : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-400">Estimated spend</dt>
              <dd>{fmtMoney(project.estimatedSpend, project.currency)}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-400">Created by</dt>
              <dd>
                {project.createdBy.name},{" "}
                <span className="text-zinc-500">{fmtDate(project.createdAt)}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-400">Owner sign-off note</dt>
              <dd className="text-zinc-500">
                {sourcing?.label === "RFT"
                  ? "Tender responses are binding — no negotiation stage."
                  : "—"}
              </dd>
            </div>
          </dl>
          {kraljic ? (
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {kraljic.hint}
            </p>
          ) : null}
        </section>

        <section className="card">
          <h3 className="mb-2 text-sm font-semibold">Savings</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-4">
            <div>
              <dt className="text-xs text-zinc-400">Target</dt>
              <dd className="font-medium">
                {fmtMoney(project.savingsTarget, project.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-400">Realized</dt>
              <dd className="font-medium">
                {fmtMoney(project.savingsRealized, project.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-400">Type</dt>
              <dd>
                {project.savingsType
                  ? SAVINGS_TYPES[
                      project.savingsType as keyof typeof SAVINGS_TYPES
                    ]
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-400">Baseline</dt>
              <dd className="text-zinc-500">{project.baselineNote ?? "—"}</dd>
            </div>
          </dl>
        </section>

        <section className="card">
          <h3 className="mb-2 text-sm font-semibold">Linked suppliers</h3>
          {project.suppliers.length === 0 ? (
            <p className="text-sm text-zinc-500">No suppliers linked yet.</p>
          ) : (
            <ul className="mb-2 divide-y divide-zinc-100">
              {project.suppliers.map((ps) => (
                <li key={ps.id} className="flex items-center justify-between py-1.5">
                  <Link
                    href={`/suppliers/${ps.supplierId}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {ps.supplier.name}
                  </Link>
                  {isEditor ? (
                    <form action={unlinkSupplier}>
                      <input type="hidden" name="linkId" value={ps.id} />
                      <input type="hidden" name="projectId" value={project.id} />
                      <button className="btn btn-sm">Unlink</button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {isEditor && unlinked.length > 0 ? (
            <form action={linkSupplier} className="flex items-center gap-2">
              <input type="hidden" name="projectId" value={project.id} />
              <select name="supplierId" className="input w-64">
                {unlinked.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button className="btn btn-sm">Link supplier</button>
            </form>
          ) : null}
        </section>

        {project.contracts.length > 0 ? (
          <section className="card">
            <h3 className="mb-2 text-sm font-semibold">Contracts from this project</h3>
            <ul className="divide-y divide-zinc-100">
              {project.contracts.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-1.5 text-sm">
                  <Link href={`/contracts/${c.id}`} className="font-medium hover:underline">
                    {c.title}
                  </Link>
                  <span className="text-zinc-500">
                    {c.supplier.name} · ends {fmtDate(c.endDate)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <CommentsSection
          entityType="PROJECT"
          entityId={project.id}
          returnTo={`/projects/${project.id}`}
        />
      </div>

      <div className="space-y-4">
        {isEditor ? (
          <details className="card" open={false}>
            <summary className="cursor-pointer text-sm font-semibold">
              Edit project
            </summary>
            <form action={updateProject} className="mt-3 space-y-3">
              <input type="hidden" name="projectId" value={project.id} />
              <div>
                <label className="label">Name</label>
                <input name="name" className="input" defaultValue={project.name} />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea
                  name="description"
                  className="input"
                  rows={3}
                  defaultValue={project.description ?? ""}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">RAG status</label>
                  <select name="rag" className="input" defaultValue={project.rag}>
                    {Object.entries(RAG).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Category</label>
                  <select
                    name="categoryId"
                    className="input"
                    defaultValue={project.categoryId ?? ""}
                  >
                    <option value="">None</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Kraljic</label>
                  <select
                    name="kraljic"
                    className="input"
                    defaultValue={project.kraljic ?? ""}
                  >
                    <option value="">Not classified</option>
                    {Object.entries(KRALJIC).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Est. spend</label>
                  <input
                    name="estimatedSpend"
                    type="number"
                    className="input"
                    defaultValue={project.estimatedSpend ?? ""}
                  />
                </div>
                <div>
                  <label className="label">Savings target</label>
                  <input
                    name="savingsTarget"
                    type="number"
                    className="input"
                    defaultValue={project.savingsTarget ?? ""}
                  />
                </div>
                <div>
                  <label className="label">Savings realized</label>
                  <input
                    name="savingsRealized"
                    type="number"
                    className="input"
                    defaultValue={project.savingsRealized ?? ""}
                  />
                </div>
                <div>
                  <label className="label">Savings type</label>
                  <select
                    name="savingsType"
                    className="input"
                    defaultValue={project.savingsType ?? ""}
                  >
                    <option value="">Not set</option>
                    {Object.entries(SAVINGS_TYPES).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Baseline note</label>
                  <input
                    name="baselineNote"
                    className="input"
                    defaultValue={project.baselineNote ?? ""}
                  />
                </div>
              </div>
              <button className="btn btn-primary w-full justify-center">
                Save changes
              </button>
            </form>
          </details>
        ) : null}

        {isEditor && project.status !== "ARCHIVED" ? (
          <div className="card">
            <h3 className="mb-2 text-sm font-semibold">Danger zone</h3>
            <div className="flex gap-2">
              <form action={archiveProject}>
                <input type="hidden" name="projectId" value={project.id} />
                <button className="btn btn-sm">Archive</button>
              </form>
              {auth.role === "ADMIN" ? (
                <form action={deleteProject}>
                  <input type="hidden" name="projectId" value={project.id} />
                  <button className="btn btn-sm btn-danger">
                    Delete permanently
                  </button>
                </form>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-zinc-400">
              Archiving hides the project from active views; hard delete is
              Admin-only.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
