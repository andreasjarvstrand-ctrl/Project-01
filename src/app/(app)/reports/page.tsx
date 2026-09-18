import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import {
  CANONICAL_PHASES,
  PHASE_ORDER,
  type CanonicalPhase,
} from "@/lib/domain";
import { daysBetween, fmtMoney } from "@/lib/format";
import { EmptyState, PageHeader, StatTile } from "@/components/ui";

// Fixed, purpose-built dashboards (redline §5.8) — a custom dashboard
// builder is deliberately deferred. Viewers can export what they can view
// (redline A6).
export default async function ReportsPage() {
  const auth = await requireAuth();
  const workspaceId = auth.workspace.id;

  const [projects, categories, revealedRounds] = await Promise.all([
    prisma.project.findMany({
      where: { workspaceId, status: { not: "ARCHIVED" } },
      include: { category: true, stages: true },
    }),
    prisma.category.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
    }),
    prisma.scoringRound.findMany({
      where: {
        status: "REVEALED",
        project: { workspaceId },
        template: { kind: "PERFORMANCE" },
      },
      include: {
        suppliers: { include: { supplier: true } },
        scores: true,
        template: { include: { criteria: true } },
      },
    }),
  ]);

  // --- Savings roll-up by category, grouped by currency (redline Q8:
  // no FX engine — currencies are reported side by side). ---
  const currencies = [...new Set(projects.map((p) => p.currency))].sort();
  const savingsRows = categories.map((cat) => {
    const inCat = projects.filter((p) => p.categoryId === cat.id);
    return {
      category: cat,
      byCurrency: currencies.map((cur) => {
        const ps = inCat.filter((p) => p.currency === cur);
        return {
          currency: cur,
          target: ps.reduce((s, p) => s + (p.savingsTarget ?? 0), 0),
          realized: ps.reduce((s, p) => s + (p.savingsRealized ?? 0), 0),
        };
      }),
    };
  });

  // --- Cycle time: average days spent in each canonical phase, from stage
  // entered/exited timestamps (§4). ---
  const phaseDurations = new Map<CanonicalPhase, number[]>();
  for (const phase of PHASE_ORDER) phaseDurations.set(phase, []);
  for (const p of projects) {
    for (const s of p.stages) {
      if (s.enteredAt && s.exitedAt) {
        phaseDurations
          .get(s.canonicalPhase as CanonicalPhase)
          ?.push(daysBetween(s.enteredAt, s.exitedAt));
      }
    }
  }

  // --- Pipeline counts ---
  const activeProjects = projects.filter((p) => p.status === "ACTIVE");
  const phaseCounts = PHASE_ORDER.map((phase) => ({
    phase,
    count: activeProjects.filter((p) => {
      const current = p.stages.find((s) => s.enteredAt && !s.exitedAt);
      return current?.canonicalPhase === phase;
    }).length,
  }));

  // --- Supplier performance (revealed performance rounds only) ---
  const supplierPerf = new Map<
    string,
    { name: string; values: number[] }
  >();
  for (const round of revealedRounds) {
    for (const rs of round.suppliers) {
      const vals = round.scores
        .filter((s) => s.supplierId === rs.supplierId && s.value != null)
        .map((s) => s.value as number);
      if (!vals.length) continue;
      const entry = supplierPerf.get(rs.supplierId) ?? {
        name: rs.supplier.name,
        values: [],
      };
      entry.values.push(...vals);
      supplierPerf.set(rs.supplierId, entry);
    }
  }

  const totalTarget = currencies.map((cur) => ({
    cur,
    target: projects
      .filter((p) => p.currency === cur)
      .reduce((s, p) => s + (p.savingsTarget ?? 0), 0),
    realized: projects
      .filter((p) => p.currency === cur)
      .reduce((s, p) => s + (p.savingsRealized ?? 0), 0),
  }));

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Savings, cycle time, and pipeline across the portfolio"
        action={
          <a href="/reports/export" className="btn">
            Export projects CSV
          </a>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Projects (non-archived)" value={projects.length} />
        <StatTile label="Active" value={activeProjects.length} />
        {totalTarget.slice(0, 2).map((t) => (
          <StatTile
            key={t.cur}
            label={`Savings realized (${t.cur})`}
            value={fmtMoney(t.realized, t.cur)}
            hint={`of ${fmtMoney(t.target, t.cur)} target`}
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 text-sm font-semibold">Savings by category</h2>
          <table className="tbl">
            <thead>
              <tr>
                <th>Category</th>
                <th>Currency</th>
                <th>Target</th>
                <th>Realized</th>
                <th>Attainment</th>
              </tr>
            </thead>
            <tbody>
              {savingsRows.flatMap((row) =>
                row.byCurrency
                  .filter((bc) => bc.target > 0 || bc.realized > 0)
                  .map((bc) => (
                    <tr key={`${row.category.id}-${bc.currency}`}>
                      <td className="text-sm">
                        <span
                          className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: row.category.color }}
                          aria-hidden
                        />
                        {row.category.name}
                      </td>
                      <td className="text-sm text-zinc-500">{bc.currency}</td>
                      <td className="text-sm">{fmtMoney(bc.target, bc.currency)}</td>
                      <td className="text-sm">{fmtMoney(bc.realized, bc.currency)}</td>
                      <td className="text-sm">
                        {bc.target > 0
                          ? `${Math.round((bc.realized / bc.target) * 100)}%`
                          : "—"}
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </section>

        <section className="card">
          <h2 className="mb-3 text-sm font-semibold">
            Cycle time by phase (completed stages)
          </h2>
          <table className="tbl">
            <thead>
              <tr>
                <th>Phase</th>
                <th>Stages completed</th>
                <th>Avg days</th>
                <th>Max days</th>
              </tr>
            </thead>
            <tbody>
              {PHASE_ORDER.map((phase) => {
                const durations = phaseDurations.get(phase) ?? [];
                const avg =
                  durations.length > 0
                    ? durations.reduce((a, b) => a + b, 0) / durations.length
                    : null;
                return (
                  <tr key={phase}>
                    <td className="text-sm">{CANONICAL_PHASES[phase]}</td>
                    <td className="text-sm text-zinc-500">{durations.length}</td>
                    <td className="text-sm">
                      {avg != null ? avg.toFixed(1) : "—"}
                    </td>
                    <td className="text-sm text-zinc-500">
                      {durations.length ? Math.max(...durations) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="card">
          <h2 className="mb-3 text-sm font-semibold">Active pipeline by phase</h2>
          <table className="tbl">
            <thead>
              <tr>
                <th>Phase</th>
                <th>Projects</th>
              </tr>
            </thead>
            <tbody>
              {phaseCounts.map((pc) => (
                <tr key={pc.phase}>
                  <td className="text-sm">{CANONICAL_PHASES[pc.phase]}</td>
                  <td className="text-sm font-medium">{pc.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card">
          <h2 className="mb-3 text-sm font-semibold">
            Supplier performance (revealed performance rounds)
          </h2>
          {supplierPerf.size === 0 ? (
            <EmptyState message="No revealed performance scoring rounds yet." />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Scores recorded</th>
                  <th>Average (of 5)</th>
                </tr>
              </thead>
              <tbody>
                {[...supplierPerf.entries()]
                  .map(([id, e]) => ({
                    id,
                    name: e.name,
                    count: e.values.length,
                    avg: e.values.reduce((a, b) => a + b, 0) / e.values.length,
                  }))
                  .sort((a, b) => b.avg - a.avg)
                  .map((row) => (
                    <tr key={row.id}>
                      <td className="text-sm font-medium">{row.name}</td>
                      <td className="text-sm text-zinc-500">{row.count}</td>
                      <td className="text-sm">{row.avg.toFixed(2)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
