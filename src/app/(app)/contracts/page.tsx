import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { CONTRACT_STATUSES } from "@/lib/domain";
import {
  daysUntil,
  fmtDate,
  fmtMoney,
  renewalNoticeDeadline,
} from "@/lib/format";
import { EmptyState, ErrorBanner, PageHeader } from "@/components/ui";

// Contract & obligation tracking (§5.6) — lightweight, not CLM. The
// renewal-notice column is the point of this page.
export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; status?: string }>;
}) {
  const auth = await requireAuth();
  const { error, status } = await searchParams;
  const isEditor = auth.role !== "VIEWER";

  const contracts = await prisma.contract.findMany({
    where: {
      workspaceId: auth.workspace.id,
      ...(status ? { status } : {}),
    },
    include: { supplier: true, project: true },
  });

  const rows = contracts
    .map((c) => ({
      ...c,
      noticeDeadline: renewalNoticeDeadline(c.endDate, c.renewalNoticeDays),
    }))
    .sort((a, b) => a.noticeDeadline.getTime() - b.noticeDeadline.getTime());

  return (
    <div>
      <PageHeader
        title="Contracts"
        subtitle="Reference records with renewal-notice tracking — sorted by notice deadline"
        action={
          isEditor ? (
            <Link href="/contracts/new" className="btn btn-primary">
              New contract
            </Link>
          ) : undefined
        }
      />
      <ErrorBanner error={error} />

      <form method="get" className="mb-4 flex items-end gap-2">
        <div>
          <label className="label">Status</label>
          <select name="status" className="input w-40" defaultValue={status ?? ""}>
            <option value="">All</option>
            {Object.entries(CONTRACT_STATUSES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <button className="btn">Filter</button>
      </form>

      {rows.length === 0 ? (
        <EmptyState message="No contracts recorded." />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="tbl">
            <thead>
              <tr>
                <th>Contract</th>
                <th>Supplier</th>
                <th>Value</th>
                <th>Start</th>
                <th>End</th>
                <th>Notice by</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const days = daysUntil(c.noticeDeadline);
                const urgent = c.status === "ACTIVE" && days <= 30;
                const soon = c.status === "ACTIVE" && days > 30 && days <= 90;
                return (
                  <tr key={c.id}>
                    <td>
                      <Link
                        href={`/contracts/${c.id}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {c.title}
                      </Link>
                      {c.reference ? (
                        <span className="ml-1 text-xs text-zinc-400">
                          ({c.reference})
                        </span>
                      ) : null}
                    </td>
                    <td className="text-sm">
                      <Link
                        href={`/suppliers/${c.supplierId}`}
                        className="hover:underline"
                      >
                        {c.supplier.name}
                      </Link>
                    </td>
                    <td className="text-sm">{fmtMoney(c.value, c.currency)}</td>
                    <td className="text-sm text-zinc-500">{fmtDate(c.startDate)}</td>
                    <td className="text-sm text-zinc-500">{fmtDate(c.endDate)}</td>
                    <td
                      className={`text-sm ${
                        urgent
                          ? "font-semibold text-red-700"
                          : soon
                            ? "font-medium text-amber-700"
                            : ""
                      }`}
                    >
                      {fmtDate(c.noticeDeadline)}
                      {c.status === "ACTIVE" ? (
                        <span className="ml-1 text-xs text-zinc-400">
                          ({days < 0 ? `${-days}d overdue` : `${days}d`})
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          c.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {CONTRACT_STATUSES[
                          c.status as keyof typeof CONTRACT_STATUSES
                        ] ?? c.status}
                      </span>
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
