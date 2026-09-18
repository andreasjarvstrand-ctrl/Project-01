import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { CANONICAL_PHASES, PHASE_ORDER, type CanonicalPhase } from "@/lib/domain";
import { fmtMoney } from "@/lib/format";
import {
  CategoryDot,
  KraljicBadge,
  PageHeader,
  RagBadge,
  TypeBadge,
} from "@/components/ui";

// The portfolio sourcing-pipeline board (§5.3) — the answer to the
// cross-team duplicate-sourcing visibility gap. Columns are canonical
// phases; a project sits in the column of its current stage's canonical
// phase (redline A1: a view over stage-gate data, never a second field).
export default async function PipelinePage() {
  const auth = await requireAuth();

  const projects = await prisma.project.findMany({
    where: { workspaceId: auth.workspace.id, status: "ACTIVE" },
    include: {
      category: true,
      stages: { orderBy: { order: "asc" } },
      suppliers: { include: { supplier: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const byPhase = new Map<CanonicalPhase, typeof projects>();
  for (const phase of PHASE_ORDER) byPhase.set(phase, []);
  for (const p of projects) {
    const current = p.stages.find((s) => s.enteredAt && !s.exitedAt);
    const phase = (current?.canonicalPhase ?? "INITIATE") as CanonicalPhase;
    byPhase.get(phase)?.push(p);
  }

  return (
    <div>
      <PageHeader
        title="Portfolio pipeline"
        subtitle="Every active procurement project across all categories, by lifecycle phase"
      />
      <div className="overflow-x-auto">
        <div className="flex min-w-[1100px] gap-3">
          {PHASE_ORDER.map((phase) => {
            const items = byPhase.get(phase) ?? [];
            return (
              <div key={phase} className="w-56 shrink-0">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                    {CANONICAL_PHASES[phase]}
                  </span>
                  <span className="text-xs text-zinc-400">{items.length}</span>
                </div>
                <div className="space-y-2 rounded-lg bg-zinc-200/50 p-2">
                  {items.length === 0 ? (
                    <p className="px-1 py-3 text-center text-xs text-zinc-400">
                      Empty
                    </p>
                  ) : (
                    items.map((p) => {
                      const current = p.stages.find(
                        (s) => s.enteredAt && !s.exitedAt
                      );
                      return (
                        <Link
                          key={p.id}
                          href={`/projects/${p.id}`}
                          className="block rounded-md border border-zinc-200 bg-white p-2.5 shadow-sm hover:border-indigo-300"
                        >
                          <div className="mb-1 text-sm leading-snug font-medium">
                            {p.name}
                          </div>
                          <div className="mb-1.5 flex flex-wrap gap-1">
                            <TypeBadge type={p.type} />
                            <KraljicBadge kraljic={p.kraljic} />
                          </div>
                          <div className="flex items-center justify-between gap-1 text-xs text-zinc-500">
                            <CategoryDot category={p.category} />
                            <RagBadge rag={p.rag} />
                          </div>
                          {current && current.name !== CANONICAL_PHASES[phase] ? (
                            <div className="mt-1 text-xs text-zinc-400">
                              Stage: {current.name}
                            </div>
                          ) : null}
                          {p.estimatedSpend ? (
                            <div className="mt-1 text-xs text-zinc-500">
                              Est. {fmtMoney(p.estimatedSpend, p.currency)}
                            </div>
                          ) : null}
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
