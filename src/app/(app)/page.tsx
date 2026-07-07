import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { decideGate } from "@/lib/actions/projects";
import {
  fmtDate,
  fmtDateTime,
  fmtMoney,
  daysUntil,
  renewalNoticeDeadline,
} from "@/lib/format";
import { TASK_STATUSES } from "@/lib/domain";
import { PageHeader, RagBadge, StatTile, EmptyState } from "@/components/ui";

export default async function DashboardPage() {
  const auth = await requireAuth();
  const workspaceId = auth.workspace.id;

  const [
    activeProjects,
    openRisks,
    contracts,
    savingsByCurrency,
    myTasks,
    myGates,
    activity,
  ] = await Promise.all([
    prisma.project.findMany({
      where: { workspaceId, status: "ACTIVE" },
      include: { category: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.raidEntry.count({
      where: {
        project: { workspaceId, status: "ACTIVE" },
        status: "OPEN",
        type: { in: ["RISK", "ISSUE"] },
      },
    }),
    prisma.contract.findMany({
      where: { workspaceId, status: "ACTIVE" },
      include: { supplier: true },
    }),
    prisma.project.groupBy({
      by: ["currency"],
      where: { workspaceId, status: { not: "ARCHIVED" } },
      _sum: { savingsTarget: true, savingsRealized: true },
    }),
    prisma.task.findMany({
      where: {
        assigneeId: auth.user.id,
        status: { not: "DONE" },
        project: { workspaceId, status: "ACTIVE" },
      },
      include: { project: true },
      orderBy: [{ dueDate: "asc" }],
      take: 8,
    }),
    prisma.gateApproval.findMany({
      where: {
        approverId: auth.user.id,
        status: "PENDING",
        stage: {
          enteredAt: { not: null },
          exitedAt: null,
          project: { workspaceId, status: "ACTIVE" },
        },
      },
      include: { stage: { include: { project: true } } },
    }),
    prisma.activityLog.findMany({
      where: { workspaceId },
      include: { actor: true },
      orderBy: { seq: "desc" },
      take: 10,
    }),
  ]);

  // Renewal-notice radar (§5.6): deadline = end date − notice window.
  const renewalsDue = contracts
    .map((c) => ({
      ...c,
      noticeDeadline: renewalNoticeDeadline(c.endDate, c.renewalNoticeDays),
    }))
    .filter((c) => daysUntil(c.noticeDeadline) <= 90)
    .sort((a, b) => a.noticeDeadline.getTime() - b.noticeDeadline.getTime());

  const atRisk = activeProjects.filter((p) => p.rag !== "GREEN").length;

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${auth.user.name.split(" ")[0]}`}
        subtitle={auth.workspace.name}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Active projects"
          value={activeProjects.length}
          hint={atRisk > 0 ? `${atRisk} at risk or off track` : "all on track"}
          href="/projects"
        />
        <StatTile
          label="Open risks & issues"
          value={openRisks}
          hint="across active projects"
        />
        <StatTile
          label="Renewal notices ≤ 90 days"
          value={renewalsDue.length}
          hint="contracts needing a decision"
          href="/contracts"
        />
        <StatTile
          label="Savings realized"
          value={
            savingsByCurrency.length
              ? savingsByCurrency
                  .map((s) =>
                    fmtMoney(s._sum.savingsRealized ?? 0, s.currency)
                  )
                  .join(" + ")
              : "—"
          }
          hint={`target ${savingsByCurrency
            .map((s) => fmtMoney(s._sum.savingsTarget ?? 0, s.currency))
            .join(" + ")}`}
          href="/reports"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 text-sm font-semibold">My open tasks</h2>
          {myTasks.length === 0 ? (
            <EmptyState message="Nothing assigned to you. Enjoy it while it lasts." />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {myTasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <Link
                      href={`/projects/${t.projectId}?tab=tasks`}
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {t.isMilestone ? "◆ " : ""}
                      {t.title}
                    </Link>
                    <span className="text-xs text-zinc-500">{t.project.name}</span>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-xs text-zinc-500">
                      {TASK_STATUSES[t.status as keyof typeof TASK_STATUSES]}
                    </div>
                    <div
                      className={`text-xs ${
                        t.dueDate && daysUntil(t.dueDate) < 0
                          ? "font-medium text-red-700"
                          : "text-zinc-400"
                      }`}
                    >
                      {t.dueDate ? fmtDate(t.dueDate) : "no due date"}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2 className="mb-3 text-sm font-semibold">Gates waiting on my sign-off</h2>
          {myGates.length === 0 ? (
            <EmptyState message="No gate approvals waiting on you." />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {myGates.map((g) => (
                <li key={g.id} className="py-2">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/projects/${g.stage.projectId}`}
                        className="block truncate text-sm font-medium hover:underline"
                      >
                        {g.stage.project.name}
                      </Link>
                      <span className="text-xs text-zinc-500">
                        Gate: {g.stage.name}
                      </span>
                    </div>
                  </div>
                  <form action={decideGate} className="flex items-center gap-2">
                    <input type="hidden" name="approvalId" value={g.id} />
                    <input
                      type="hidden"
                      name="projectId"
                      value={g.stage.projectId}
                    />
                    <input
                      name="note"
                      className="input"
                      placeholder="Sign-off note (optional)"
                    />
                    <button
                      name="decision"
                      value="APPROVED"
                      className="btn btn-sm btn-primary"
                    >
                      Approve
                    </button>
                    <button name="decision" value="REJECTED" className="btn btn-sm btn-danger">
                      Reject
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2 className="mb-3 text-sm font-semibold">Renewal-notice radar</h2>
          {renewalsDue.length === 0 ? (
            <EmptyState message="No renewal notices due in the next 90 days." />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Contract</th>
                  <th>Supplier</th>
                  <th>Notice by</th>
                  <th>Ends</th>
                </tr>
              </thead>
              <tbody>
                {renewalsDue.map((c) => {
                  const days = daysUntil(c.noticeDeadline);
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/contracts/${c.id}`} className="font-medium hover:underline">
                          {c.title}
                        </Link>
                      </td>
                      <td>{c.supplier.name}</td>
                      <td
                        className={
                          days < 0
                            ? "font-medium text-red-700"
                            : days <= 30
                              ? "font-medium text-amber-700"
                              : ""
                        }
                      >
                        {fmtDate(c.noticeDeadline)}{" "}
                        <span className="text-xs text-zinc-400">
                          ({days < 0 ? `${-days}d overdue` : `${days}d`})
                        </span>
                      </td>
                      <td>{fmtDate(c.endDate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section className="card">
          <h2 className="mb-3 text-sm font-semibold">Recent activity</h2>
          {activity.length === 0 ? (
            <EmptyState message="No activity yet." />
          ) : (
            <ul className="space-y-2">
              {activity.map((a) => (
                <li key={a.seq} className="text-sm">
                  <span className="font-medium">{a.actor?.name ?? "System"}</span>{" "}
                  <span className="text-zinc-600">{a.action}</span>
                  {a.detail ? (
                    <span className="text-zinc-400"> — {a.detail}</span>
                  ) : null}
                  <span className="ml-1 text-xs text-zinc-400">
                    {fmtDateTime(a.recordedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card mt-4">
        <h2 className="mb-3 text-sm font-semibold">Active projects</h2>
        <table className="tbl">
          <thead>
            <tr>
              <th>Project</th>
              <th>Category</th>
              <th>Status</th>
              <th>Last update</th>
            </tr>
          </thead>
          <tbody>
            {activeProjects.slice(0, 8).map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/projects/${p.id}`} className="font-medium hover:underline">
                    {p.name}
                  </Link>
                </td>
                <td>{p.category?.name ?? "—"}</td>
                <td>
                  <RagBadge rag={p.rag} />
                </td>
                <td className="text-zinc-500">{fmtDate(p.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
