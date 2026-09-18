import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { PROJECT_TYPES, PROJECT_STATUSES } from "@/lib/domain";
import { fmtMoney } from "@/lib/format";
import {
  CategoryDot,
  ErrorBanner,
  EmptyState,
  KraljicBadge,
  PageHeader,
  PhaseBadge,
  RagBadge,
  TypeBadge,
} from "@/components/ui";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    categoryId?: string;
    status?: string;
    error?: string;
  }>;
}) {
  const auth = await requireAuth();
  const { type, categoryId, status, error } = await searchParams;

  const canCreate =
    auth.role === "ADMIN" ||
    (auth.role === "MEMBER" && auth.workspace.membersCanCreateProjects);

  const [projects, categories] = await Promise.all([
    prisma.project.findMany({
      where: {
        workspaceId: auth.workspace.id,
        ...(type ? { type } : {}),
        ...(categoryId ? { categoryId } : {}),
        status: status || "ACTIVE",
      },
      include: {
        category: true,
        stages: { orderBy: { order: "asc" } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.category.findMany({
      where: { workspaceId: auth.workspace.id },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle="All procurement initiatives in this workspace"
        action={
          canCreate ? (
            <Link href="/projects/new" className="btn btn-primary">
              New project
            </Link>
          ) : undefined
        }
      />
      <ErrorBanner error={error} />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="label">Type</label>
          <select name="type" className="input w-48" defaultValue={type ?? ""}>
            <option value="">All types</option>
            {Object.entries(PROJECT_TYPES).map(([k, v]) => (
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
            className="input w-44"
            defaultValue={categoryId ?? ""}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select name="status" className="input w-36" defaultValue={status ?? "ACTIVE"}>
            {Object.entries(PROJECT_STATUSES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <button className="btn">Filter</button>
      </form>

      {projects.length === 0 ? (
        <EmptyState message="No projects match these filters." />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="tbl">
            <thead>
              <tr>
                <th>Project</th>
                <th>Type</th>
                <th>Category</th>
                <th>Kraljic</th>
                <th>Phase</th>
                <th>Est. spend</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => {
                const current = p.stages.find((s) => s.enteredAt && !s.exitedAt);
                return (
                  <tr key={p.id}>
                    <td>
                      <Link
                        href={`/projects/${p.id}`}
                        className="font-medium hover:underline"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td>
                      <TypeBadge type={p.type} />
                    </td>
                    <td>
                      <CategoryDot category={p.category} />
                    </td>
                    <td>
                      <KraljicBadge kraljic={p.kraljic} />
                    </td>
                    <td>
                      {p.status === "ACTIVE" && current ? (
                        <PhaseBadge phase={current.canonicalPhase} />
                      ) : (
                        <span className="text-xs text-zinc-400">
                          {PROJECT_STATUSES[p.status as keyof typeof PROJECT_STATUSES]}
                        </span>
                      )}
                    </td>
                    <td>{fmtMoney(p.estimatedSpend, p.currency)}</td>
                    <td>
                      <RagBadge rag={p.rag} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
