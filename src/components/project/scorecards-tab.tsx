import Link from "next/link";
import { prisma } from "@/lib/db";
import type { Auth } from "@/lib/auth";
import type { ProjectDetail, WorkspaceMember } from "@/lib/queries";
import {
  createScoringRound,
  markScoresSubmitted,
  revealRound,
  submitScores,
} from "@/lib/actions/scorecards";
import { fmtDate } from "@/lib/format";
import { EmptyState } from "@/components/ui";

type Round = ProjectDetail["scoringRounds"][number];

// §5.5: blind scoring is a lifecycle on the round. While OPEN, an evaluator
// sees only their own scores (and, when blind, anonymised supplier names);
// non-evaluators see submission progress only. REVEALED shows the aggregate.
export async function ScorecardsTab({
  project,
  auth,
  members,
  selectedRoundId,
}: {
  project: ProjectDetail;
  auth: Auth;
  members: WorkspaceMember[];
  selectedRoundId?: string;
}) {
  const isEditor = auth.role !== "VIEWER";
  const rounds = project.scoringRounds;
  const round =
    rounds.find((r) => r.id === selectedRoundId) ?? rounds[0] ?? null;

  const [templates, allSuppliers] = await Promise.all([
    prisma.scorecardTemplate.findMany({
      where: { workspaceId: auth.workspace.id },
      include: { criteria: true },
      orderBy: { name: "asc" },
    }),
    prisma.supplier.findMany({
      where: { workspaceId: auth.workspace.id },
      orderBy: { name: "asc" },
    }),
  ]);
  const linkedSuppliers = project.suppliers.map((ps) => ps.supplier);
  const candidateSuppliers = linkedSuppliers.length
    ? linkedSuppliers
    : allSuppliers;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {rounds.map((r) => (
          <Link
            key={r.id}
            href={`/projects/${project.id}?tab=scorecards&round=${r.id}`}
            className={`badge ${
              r.id === round?.id
                ? "bg-indigo-600 text-white"
                : "bg-white text-zinc-600 ring-1 ring-zinc-200"
            }`}
          >
            {r.name}
            {r.status === "REVEALED" ? " ✓" : ""}
          </Link>
        ))}
      </div>

      {isEditor && templates.length > 0 ? (
        <details className="card">
          <summary className="cursor-pointer text-sm font-medium">
            New scoring round…
          </summary>
          <form action={createScoringRound} className="mt-3 space-y-3">
            <input type="hidden" name="projectId" value={project.id} />
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="label">Round name</label>
                <input
                  name="name"
                  className="input w-56"
                  placeholder="e.g. RFP technical evaluation"
                  required
                />
              </div>
              <div>
                <label className="label">Scorecard template</label>
                <select name="templateId" className="input w-64" required>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.kind.toLowerCase()},{" "}
                      {t.criteria.length} criteria)
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-1.5 pb-2 text-sm">
                <input type="checkbox" name="blind" /> Blind scoring
              </label>
            </div>
            <div>
              <span className="label">Evaluators</span>
              <div className="flex flex-wrap gap-3">
                {members.map((m) => (
                  <label key={m.id} className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" name="evaluatorIds" value={m.userId} />
                    {m.user.name}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <span className="label">
                Suppliers{" "}
                {linkedSuppliers.length
                  ? "(linked to this project)"
                  : "(none linked — showing all)"}
              </span>
              <div className="flex flex-wrap gap-3">
                {candidateSuppliers.map((s) => (
                  <label key={s.id} className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" name="supplierIds" value={s.id} />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>
            <button className="btn btn-primary">Open round</button>
          </form>
        </details>
      ) : null}

      {!round ? (
        <EmptyState message="No scoring rounds yet." />
      ) : (
        <RoundDetail round={round} project={project} auth={auth} />
      )}
    </div>
  );
}

function supplierLabel(round: Round, supplierId: string): string {
  if (round.status === "REVEALED" || !round.blind) {
    return (
      round.suppliers.find((s) => s.supplierId === supplierId)?.supplier.name ??
      "?"
    );
  }
  // Blind + open: anonymise, stable order.
  const idx = [...round.suppliers]
    .sort((a, b) => a.id.localeCompare(b.id))
    .findIndex((s) => s.supplierId === supplierId);
  return `Supplier ${String.fromCharCode(65 + idx)}`;
}

function RoundDetail({
  round,
  project,
  auth,
}: {
  round: Round;
  project: ProjectDetail;
  auth: Auth;
}) {
  const criteria = round.template.criteria;
  const me = round.evaluators.find((e) => e.userId === auth.user.id);
  const mayReveal =
    auth.role === "ADMIN" || project.createdById === auth.user.id;
  const unsubmitted = round.evaluators.filter((e) => !e.submittedAt);

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">
            {round.name}
            {round.blind ? (
              <span className="badge ml-2 bg-violet-100 text-violet-800">blind</span>
            ) : null}
            <span
              className={`badge ml-2 ${
                round.status === "REVEALED"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-800"
              }`}
            >
              {round.status === "REVEALED"
                ? `revealed ${fmtDate(round.revealedAt)}`
                : "open"}
            </span>
          </h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            Template: {round.template.name} · Evaluators:{" "}
            {round.evaluators
              .map((e) => `${e.user.name}${e.submittedAt ? " ✓" : ""}`)
              .join(", ")}
          </p>
        </div>
        {round.status === "OPEN" && mayReveal ? (
          <form action={revealRound} className="flex items-center gap-2">
            <input type="hidden" name="roundId" value={round.id} />
            {unsubmitted.length > 0 ? (
              <label className="flex items-center gap-1 text-xs text-zinc-500">
                <input type="checkbox" name="force" /> reveal anyway (
                {unsubmitted.length} unsubmitted)
              </label>
            ) : null}
            <button className="btn btn-sm btn-primary">Reveal results</button>
          </form>
        ) : null}
      </div>

      {round.status === "OPEN" ? (
        me ? (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500">
              Your scores are private until the round is revealed.
              {round.blind ? " Supplier identities are masked." : ""}
            </p>
            {round.suppliers.map((rs) => {
              const myScores = round.scores.filter(
                (s) =>
                  s.supplierId === rs.supplierId &&
                  s.evaluatorId === auth.user.id
              );
              return (
                <details key={rs.id} className="rounded-md border border-zinc-200 p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    {supplierLabel(round, rs.supplierId)}{" "}
                    <span className="text-xs text-zinc-400">
                      ({myScores.length}/{criteria.length} scored)
                    </span>
                  </summary>
                  <form action={submitScores} className="mt-3 space-y-2">
                    <input type="hidden" name="roundId" value={round.id} />
                    <input type="hidden" name="supplierId" value={rs.supplierId} />
                    {criteria.map((c) => {
                      const mine = myScores.find((s) => s.criterionId === c.id);
                      return (
                        <div key={c.id} className="flex flex-wrap items-center gap-2">
                          <span className="w-64 text-sm">
                            {c.name}{" "}
                            <span className="text-xs text-zinc-400">
                              {c.isPassFail ? "(pass/fail)" : `(${c.weight}%)`}
                            </span>
                          </span>
                          {c.isPassFail ? (
                            <label className="flex items-center gap-1.5 text-sm">
                              <input
                                type="checkbox"
                                name={`pass_${c.id}`}
                                defaultChecked={mine?.passed ?? false}
                              />
                              Pass
                            </label>
                          ) : (
                            <select
                              name={`score_${c.id}`}
                              className="input w-24"
                              defaultValue={mine?.value ?? ""}
                            >
                              <option value="">—</option>
                              {[1, 2, 3, 4, 5].map((v) => (
                                <option key={v} value={v}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          )}
                          <input
                            name={`comment_${c.id}`}
                            className="input flex-1"
                            placeholder="Comment (optional)"
                            defaultValue={mine?.comment ?? ""}
                          />
                        </div>
                      );
                    })}
                    <button className="btn btn-sm btn-primary">Save scores</button>
                  </form>
                </details>
              );
            })}
            {!me.submittedAt ? (
              <form action={markScoresSubmitted}>
                <input type="hidden" name="roundId" value={round.id} />
                <button className="btn">Mark my scores as submitted</button>
              </form>
            ) : (
              <p className="text-xs text-emerald-700">
                You submitted your scores {fmtDate(me.submittedAt)}.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">
            Scoring in progress. Scores are private to each evaluator until the
            round is revealed.
          </p>
        )
      ) : (
        <AggregateTable round={round} />
      )}
    </div>
  );
}

function AggregateTable({ round }: { round: Round }) {
  const criteria = round.template.criteria;
  const weighted = criteria.filter((c) => !c.isPassFail);
  const passFail = criteria.filter((c) => c.isPassFail);

  const avg = (supplierId: string, criterionId: string) => {
    const vals = round.scores
      .filter(
        (s) =>
          s.supplierId === supplierId &&
          s.criterionId === criterionId &&
          s.value != null
      )
      .map((s) => s.value as number);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  const passRate = (supplierId: string, criterionId: string) => {
    const vals = round.scores.filter(
      (s) =>
        s.supplierId === supplierId &&
        s.criterionId === criterionId &&
        s.passed != null
    );
    if (!vals.length) return null;
    return { passed: vals.filter((s) => s.passed).length, total: vals.length };
  };

  const totals = round.suppliers.map((rs) => {
    let total = 0;
    let weightUsed = 0;
    for (const c of weighted) {
      const a = avg(rs.supplierId, c.id);
      if (a != null) {
        total += a * c.weight;
        weightUsed += c.weight;
      }
    }
    const failed = passFail.some((c) => {
      const pr = passRate(rs.supplierId, c.id);
      return pr != null && pr.passed < pr.total;
    });
    return {
      supplierId: rs.supplierId,
      score: weightUsed > 0 ? total / weightUsed : null,
      failedGate: failed,
    };
  });
  const ranked = [...totals]
    .filter((t) => t.score != null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead>
          <tr>
            <th>Criterion</th>
            {round.suppliers.map((rs) => (
              <th key={rs.id}>{rs.supplier.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weighted.map((c) => (
            <tr key={c.id}>
              <td className="text-sm">
                {c.name} <span className="text-xs text-zinc-400">({c.weight}%)</span>
              </td>
              {round.suppliers.map((rs) => {
                const a = avg(rs.supplierId, c.id);
                return (
                  <td key={rs.id} className="text-sm">
                    {a != null ? a.toFixed(1) : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
          {passFail.map((c) => (
            <tr key={c.id}>
              <td className="text-sm">
                {c.name} <span className="text-xs text-zinc-400">(pass/fail)</span>
              </td>
              {round.suppliers.map((rs) => {
                const pr = passRate(rs.supplierId, c.id);
                return (
                  <td key={rs.id} className="text-sm">
                    {pr == null ? (
                      "—"
                    ) : pr.passed === pr.total ? (
                      <span className="text-emerald-700">pass</span>
                    ) : (
                      <span className="font-medium text-red-700">
                        fail ({pr.passed}/{pr.total})
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="bg-zinc-50">
            <td className="text-sm font-semibold">Weighted total (of 5)</td>
            {round.suppliers.map((rs) => {
              const t = totals.find((x) => x.supplierId === rs.supplierId)!;
              const rank = ranked.findIndex(
                (x) => x.supplierId === rs.supplierId
              );
              return (
                <td key={rs.id} className="text-sm font-semibold">
                  {t.score != null ? t.score.toFixed(2) : "—"}
                  {rank === 0 && t.score != null && !t.failedGate ? (
                    <span className="badge ml-1 bg-emerald-50 text-emerald-700">
                      leader
                    </span>
                  ) : null}
                  {t.failedGate ? (
                    <span className="badge ml-1 bg-red-50 text-red-700">
                      gate criterion failed
                    </span>
                  ) : null}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-zinc-500 hover:underline">
          Per-evaluator breakdown
        </summary>
        <table className="tbl mt-2">
          <thead>
            <tr>
              <th>Evaluator</th>
              <th>Supplier</th>
              <th>Criterion</th>
              <th>Score</th>
              <th>Comment</th>
            </tr>
          </thead>
          <tbody>
            {round.scores.map((s) => {
              const evaluator = round.evaluators.find(
                (e) => e.userId === s.evaluatorId
              );
              const supplier = round.suppliers.find(
                (rs) => rs.supplierId === s.supplierId
              );
              const criterion = round.template.criteria.find(
                (c) => c.id === s.criterionId
              );
              return (
                <tr key={s.id}>
                  <td className="text-sm">{evaluator?.user.name ?? "?"}</td>
                  <td className="text-sm">{supplier?.supplier.name ?? "?"}</td>
                  <td className="text-sm">{criterion?.name ?? "?"}</td>
                  <td className="text-sm">
                    {s.value ?? (s.passed != null ? (s.passed ? "pass" : "fail") : "—")}
                  </td>
                  <td className="text-sm text-zinc-500">{s.comment ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>
    </div>
  );
}
