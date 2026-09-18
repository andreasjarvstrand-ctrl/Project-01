import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { createProject } from "@/lib/actions/projects";
import {
  KRALJIC,
  KRALJIC_GATE_HINT,
  PROJECT_TYPES,
  SAVINGS_TYPES,
  SOURCING_TYPES,
} from "@/lib/domain";
import { STAGE_TEMPLATES } from "@/lib/templates";
import { ErrorBanner, PageHeader } from "@/components/ui";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const auth = await requireAuth();
  const canCreate =
    auth.role === "ADMIN" ||
    (auth.role === "MEMBER" && auth.workspace.membersCanCreateProjects);
  if (!canCreate) redirect("/projects");

  const { error } = await searchParams;
  const categories = await prisma.category.findMany({
    where: { workspaceId: auth.workspace.id },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="New project"
        subtitle="The project type sets the default stage-gate lifecycle"
      />
      <ErrorBanner error={error} />

      <form action={createProject} className="card space-y-4">
        <div>
          <label className="label">Project name *</label>
          <input name="name" className="input" required placeholder="e.g. Cloud Hosting Sourcing 2027" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Project type *</label>
            <select name="type" className="input" required defaultValue="SOURCING">
              {Object.entries(PROJECT_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Category (required at creation)</label>
            <select name="categoryId" className="input" required>
              <option value="">Select…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Sourcing event type (for sourcing projects)</label>
            <select name="sourcingType" className="input">
              <option value="">None</option>
              {Object.entries(SOURCING_TYPES).map(([k, v]) => (
                <option key={k} value={k} title={v.hint}>
                  {v.label} — {v.hint.split("—")[0].trim()}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Kraljic quadrant</label>
            <select name="kraljic" className="input">
              <option value="">Not classified</option>
              {Object.entries(KRALJIC).map(([k, v]) => (
                <option key={k} value={k} title={`${v.hint} ${KRALJIC_GATE_HINT[k as keyof typeof KRALJIC_GATE_HINT]}`}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Description</label>
          <textarea name="description" className="input" rows={3} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Estimated spend</label>
            <input name="estimatedSpend" type="number" min="0" className="input" />
          </div>
          <div>
            <label className="label">Currency</label>
            <input
              name="currency"
              className="input"
              defaultValue={auth.workspace.currency}
              maxLength={3}
            />
          </div>
          <div>
            <label className="label">Savings target</label>
            <input name="savingsTarget" type="number" min="0" className="input" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Savings type</label>
            <select name="savingsType" className="input">
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
              placeholder="What the savings are measured against"
            />
          </div>
        </div>

        <details className="rounded-md border border-zinc-200 p-3">
          <summary className="cursor-pointer text-sm font-medium text-zinc-600">
            Default lifecycles by project type
          </summary>
          <div className="mt-2 space-y-2 text-xs text-zinc-500">
            {Object.entries(STAGE_TEMPLATES).map(([type, stages]) => (
              <p key={type}>
                <strong className="text-zinc-700">
                  {PROJECT_TYPES[type as keyof typeof PROJECT_TYPES]}:
                </strong>{" "}
                {stages
                  .map((s) => `${s.name}${s.gateRequired ? " ⛩" : ""}`)
                  .join(" → ")}{" "}
                <span className="text-zinc-400">(⛩ = gated)</span>
              </p>
            ))}
          </div>
        </details>

        <div className="flex justify-end gap-2">
          <a href="/projects" className="btn">
            Cancel
          </a>
          <button className="btn btn-primary">Create project</button>
        </div>
      </form>
    </div>
  );
}
