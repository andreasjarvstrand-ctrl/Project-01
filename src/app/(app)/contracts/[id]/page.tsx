import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import {
  addKeyDate,
  deleteKeyDate,
  toggleKeyDate,
  updateContract,
} from "@/lib/actions/contracts";
import { CONTRACT_STATUSES } from "@/lib/domain";
import {
  daysUntil,
  fmtDate,
  fmtMoney,
  renewalNoticeDeadline,
} from "@/lib/format";
import { ErrorBanner, PageHeader } from "@/components/ui";
import { CommentsSection } from "@/components/comments";

export default async function ContractDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const auth = await requireAuth();
  const { id } = await params;
  const { error } = await searchParams;
  const isEditor = auth.role !== "VIEWER";

  const contract = await prisma.contract.findFirst({
    where: { id, workspaceId: auth.workspace.id },
    include: {
      supplier: true,
      project: true,
      keyDates: { orderBy: { date: "asc" } },
    },
  });
  if (!contract) notFound();

  const noticeDeadline = renewalNoticeDeadline(
    contract.endDate,
    contract.renewalNoticeDays
  );
  const days = daysUntil(noticeDeadline);

  return (
    <div>
      <PageHeader
        title={contract.title}
        subtitle={`${contract.supplier.name}${contract.reference ? ` · ref ${contract.reference}` : ""}`}
        action={
          <span
            className={`badge ${
              contract.status === "ACTIVE"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-zinc-100 text-zinc-500"
            }`}
          >
            {CONTRACT_STATUSES[
              contract.status as keyof typeof CONTRACT_STATUSES
            ] ?? contract.status}
          </span>
        }
      />
      <ErrorBanner error={error} />

      {contract.status === "ACTIVE" && days <= 90 ? (
        <div
          className={`mb-4 rounded-md border px-3 py-2 text-sm ${
            days < 0
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          <strong>Renewal notice {days < 0 ? "overdue" : "approaching"}:</strong>{" "}
          notice must be given by {fmtDate(noticeDeadline)} (
          {days < 0 ? `${-days} days overdue` : `${days} days from now`}).
          Consider opening a Contract Renewal project.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="card">
            <h3 className="mb-2 text-sm font-semibold">Terms</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-4">
              <div>
                <dt className="text-xs text-zinc-400">Start</dt>
                <dd>{fmtDate(contract.startDate)}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-400">End</dt>
                <dd>{fmtDate(contract.endDate)}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-400">Notice window</dt>
                <dd>{contract.renewalNoticeDays} days</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-400">Value</dt>
                <dd>{fmtMoney(contract.value, contract.currency)}</dd>
              </div>
            </dl>
            {contract.project ? (
              <p className="mt-3 text-sm text-zinc-500">
                From project{" "}
                <Link
                  href={`/projects/${contract.projectId}`}
                  className="font-medium text-zinc-700 hover:underline"
                >
                  {contract.project.name}
                </Link>
              </p>
            ) : null}
            {contract.notes ? (
              <p className="mt-3 text-sm whitespace-pre-wrap text-zinc-700">
                {contract.notes}
              </p>
            ) : null}
          </section>

          <section className="card">
            <h3 className="mb-2 text-sm font-semibold">
              Key dates & obligations
            </h3>
            {contract.keyDates.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No key dates tracked (SLA reviews, certificate expiry, price
                reviews…).
              </p>
            ) : (
              <ul className="mb-3 divide-y divide-zinc-100">
                {contract.keyDates.map((kd) => {
                  const overdue = !kd.done && daysUntil(kd.date) < 0;
                  return (
                    <li
                      key={kd.id}
                      className="flex items-center justify-between gap-2 py-1.5"
                    >
                      <span
                        className={`text-sm ${
                          kd.done ? "text-zinc-400 line-through" : ""
                        }`}
                      >
                        {kd.title}
                      </span>
                      <span className="flex items-center gap-2">
                        <span
                          className={`text-sm ${
                            overdue ? "font-medium text-red-700" : "text-zinc-500"
                          }`}
                        >
                          {fmtDate(kd.date)}
                        </span>
                        {isEditor ? (
                          <>
                            <form action={toggleKeyDate}>
                              <input type="hidden" name="keyDateId" value={kd.id} />
                              <button className="btn btn-sm">
                                {kd.done ? "Reopen" : "Done"}
                              </button>
                            </form>
                            <form action={deleteKeyDate}>
                              <input type="hidden" name="keyDateId" value={kd.id} />
                              <button className="btn btn-sm btn-danger">✕</button>
                            </form>
                          </>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {isEditor ? (
              <form action={addKeyDate} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="contractId" value={contract.id} />
                <div className="min-w-52 flex-1">
                  <label className="label">Title</label>
                  <input
                    name="title"
                    className="input"
                    placeholder="e.g. Quarterly SLA review"
                    required
                  />
                </div>
                <div>
                  <label className="label">Date</label>
                  <input name="date" type="date" className="input" required />
                </div>
                <button className="btn btn-sm">Add key date</button>
              </form>
            ) : null}
          </section>

          <CommentsSection
            entityType="CONTRACT"
            entityId={contract.id}
            returnTo={`/contracts/${contract.id}`}
          />
        </div>

        <div>
          {isEditor ? (
            <details className="card">
              <summary className="cursor-pointer text-sm font-semibold">
                Edit contract
              </summary>
              <form action={updateContract} className="mt-3 space-y-3">
                <input type="hidden" name="contractId" value={contract.id} />
                <div>
                  <label className="label">Title</label>
                  <input name="title" className="input" defaultValue={contract.title} />
                </div>
                <div>
                  <label className="label">Reference</label>
                  <input
                    name="reference"
                    className="input"
                    defaultValue={contract.reference ?? ""}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">Start</label>
                    <input
                      name="startDate"
                      type="date"
                      className="input"
                      defaultValue={contract.startDate.toISOString().slice(0, 10)}
                    />
                  </div>
                  <div>
                    <label className="label">End</label>
                    <input
                      name="endDate"
                      type="date"
                      className="input"
                      defaultValue={contract.endDate.toISOString().slice(0, 10)}
                    />
                  </div>
                  <div>
                    <label className="label">Notice days</label>
                    <input
                      name="renewalNoticeDays"
                      type="number"
                      className="input"
                      defaultValue={contract.renewalNoticeDays}
                    />
                  </div>
                  <div>
                    <label className="label">Value</label>
                    <input
                      name="value"
                      type="number"
                      className="input"
                      defaultValue={contract.value ?? ""}
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select name="status" className="input" defaultValue={contract.status}>
                    {Object.entries(CONTRACT_STATUSES).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Notes</label>
                  <textarea
                    name="notes"
                    className="input"
                    rows={3}
                    defaultValue={contract.notes ?? ""}
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
