import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import {
  addCategory,
  createScorecardTemplate,
  deleteCategory,
  deleteScorecardTemplate,
  inviteUser,
  setUserRole,
  updateWorkspaceSettings,
} from "@/lib/actions/admin";
import { ROLES, ROLE_LABELS } from "@/lib/domain";
import { ErrorBanner, PageHeader } from "@/components/ui";

// Category palette follows the dataviz categorical slot order.
const CATEGORY_COLORS = [
  "#2a78d6",
  "#1baf7a",
  "#eda100",
  "#008300",
  "#4a3aa7",
  "#e34948",
  "#e87ba4",
  "#eb6834",
];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const auth = await requireAuth();
  if (auth.role !== "ADMIN") redirect("/");
  const { error } = await searchParams;

  const [workspace, categories, memberships, templates] = await Promise.all([
    prisma.workspace.findUniqueOrThrow({ where: { id: auth.workspace.id } }),
    prisma.category.findMany({
      where: { workspaceId: auth.workspace.id },
      include: { projects: true },
      orderBy: { name: "asc" },
    }),
    prisma.membership.findMany({
      where: { workspaceId: auth.workspace.id },
      include: { user: true },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.scorecardTemplate.findMany({
      where: { workspaceId: auth.workspace.id },
      include: { criteria: { orderBy: { order: "asc" } }, rounds: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="max-w-4xl">
      <PageHeader title="Workspace settings" subtitle={workspace.name} />
      <ErrorBanner error={error} />

      <div className="space-y-4">
        <section className="card">
          <h2 className="mb-3 text-sm font-semibold">General</h2>
          <form action={updateWorkspaceSettings} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Workspace name</label>
                <input name="name" className="input" defaultValue={workspace.name} />
              </div>
              <div>
                <label className="label">Default currency (ISO code)</label>
                <input
                  name="currency"
                  className="input"
                  maxLength={3}
                  defaultValue={workspace.currency}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="viewersCanComment"
                defaultChecked={workspace.viewersCanComment}
              />
              Viewers can comment
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="membersCanCreateProjects"
                defaultChecked={workspace.membersCanCreateProjects}
              />
              Members can create projects (off = Admin-only governance
              checkpoint)
            </label>
            <button className="btn btn-primary">Save settings</button>
          </form>
        </section>

        <section className="card">
          <h2 className="mb-3 text-sm font-semibold">Users & roles</h2>
          <table className="tbl mb-3">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {memberships.map((m) => (
                <tr key={m.id}>
                  <td className="text-sm font-medium">{m.user.name}</td>
                  <td className="text-sm text-zinc-500">{m.user.email}</td>
                  <td>
                    <form action={setUserRole} className="flex items-center gap-2">
                      <input type="hidden" name="membershipId" value={m.id} />
                      <select
                        name="role"
                        className="input w-32"
                        defaultValue={m.role}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                      <button className="btn btn-sm">Update</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <details>
            <summary className="cursor-pointer text-sm font-medium">
              Invite user…
            </summary>
            <form action={inviteUser} className="mt-3 flex flex-wrap items-end gap-2">
              <div>
                <label className="label">Name</label>
                <input name="name" className="input w-44" required />
              </div>
              <div>
                <label className="label">Email</label>
                <input name="email" type="email" className="input w-56" required />
              </div>
              <div>
                <label className="label">Role</label>
                <select name="role" className="input w-32" defaultValue="MEMBER">
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn btn-primary">Invite</button>
            </form>
          </details>
        </section>

        <section className="card">
          <h2 className="mb-3 text-sm font-semibold">Categories</h2>
          <ul className="mb-3 flex flex-wrap gap-2">
            {categories.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-2 rounded-full bg-zinc-100 py-1 pr-2 pl-3 text-sm"
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: c.color }}
                  aria-hidden
                />
                {c.name}
                <span className="text-xs text-zinc-400">
                  ({c.projects.length})
                </span>
                {c.projects.length === 0 ? (
                  <form action={deleteCategory}>
                    <input type="hidden" name="categoryId" value={c.id} />
                    <button
                      className="text-zinc-400 hover:text-red-600"
                      title="Delete category"
                    >
                      ×
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
          <form action={addCategory} className="flex items-end gap-2">
            <div>
              <label className="label">New category</label>
              <input name="name" className="input w-56" required />
            </div>
            <div>
              <label className="label">Color</label>
              <select name="color" className="input w-36">
                {CATEGORY_COLORS.map((c, i) => (
                  <option key={c} value={c}>
                    Slot {i + 1}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn">Add</button>
          </form>
        </section>

        <section className="card">
          <h2 className="mb-3 text-sm font-semibold">Scorecard templates</h2>
          <ul className="mb-3 space-y-2">
            {templates.map((t) => (
              <li key={t.id} className="rounded-md border border-zinc-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {t.name}{" "}
                    <span className="badge ml-1 bg-zinc-100 text-zinc-500">
                      {t.kind.toLowerCase()}
                    </span>
                  </span>
                  {t.rounds.length === 0 ? (
                    <form action={deleteScorecardTemplate}>
                      <input type="hidden" name="templateId" value={t.id} />
                      <button className="btn btn-sm btn-danger">Delete</button>
                    </form>
                  ) : (
                    <span className="text-xs text-zinc-400">
                      used by {t.rounds.length} round(s)
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {t.criteria
                    .map((c) =>
                      c.isPassFail ? `${c.name} (pass/fail)` : `${c.name} ${c.weight}%`
                    )
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
          <details>
            <summary className="cursor-pointer text-sm font-medium">
              New template…
            </summary>
            <form action={createScorecardTemplate} className="mt-3 space-y-3">
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="label">Template name</label>
                  <input name="name" className="input w-64" required />
                </div>
                <div>
                  <label className="label">Kind</label>
                  <select name="kind" className="input w-40" defaultValue="SELECTION">
                    <option value="SELECTION">Selection (one-off)</option>
                    <option value="PERFORMANCE">Performance (recurring)</option>
                  </select>
                </div>
              </div>
              <p className="text-xs text-zinc-500">
                Weighted criteria must sum to 100. Tick pass/fail for mandatory
                gate criteria (kept separate from weighted scoring).
              </p>
              <div className="space-y-1.5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      name={`crit_name_${i}`}
                      className="input w-72"
                      placeholder={`Criterion ${i + 1}`}
                    />
                    <input
                      name={`crit_weight_${i}`}
                      type="number"
                      min="0"
                      max="100"
                      className="input w-24"
                      placeholder="Weight"
                    />
                    <label className="flex items-center gap-1 text-xs">
                      <input type="checkbox" name={`crit_pass_${i}`} /> pass/fail
                    </label>
                  </div>
                ))}
              </div>
              <button className="btn btn-primary">Create template</button>
            </form>
          </details>
        </section>
      </div>
    </div>
  );
}
