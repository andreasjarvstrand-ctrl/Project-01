import type { Auth } from "@/lib/auth";
import type { ProjectDetail, WorkspaceMember } from "@/lib/queries";
import {
  advanceStage,
  decideGate,
  rollbackStage,
  setGateApprovers,
} from "@/lib/actions/projects";
import { fmtDate } from "@/lib/format";

// Stage-gate strip + gate panel for the current stage. Gates block the
// stage transition only (redline §4); approvers are named per gate (A5).
export function StageStrip({
  project,
  auth,
  members,
}: {
  project: ProjectDetail;
  auth: Auth;
  members: WorkspaceMember[];
}) {
  const stages = project.stages;
  const current = stages.find((s) => s.enteredAt && !s.exitedAt);
  const isEditor = auth.role !== "VIEWER";
  const isLast = current ? current.order === stages.length - 1 : false;

  const gateReady =
    !current?.gateRequired ||
    (current.approvals.length > 0 &&
      current.approvals.every((a) => a.status === "APPROVED"));

  return (
    <div className="card mb-4">
      <ol className="flex flex-wrap items-center gap-1">
        {stages.map((s, i) => {
          const state = s.exitedAt
            ? "done"
            : s.enteredAt
              ? "current"
              : "upcoming";
          return (
            <li key={s.id} className="flex items-center gap-1">
              {i > 0 ? <span className="text-zinc-300">→</span> : null}
              <span
                className={`badge ${
                  state === "done"
                    ? "bg-emerald-50 text-emerald-700"
                    : state === "current"
                      ? "bg-indigo-600 text-white"
                      : "bg-zinc-100 text-zinc-400"
                }`}
                title={
                  s.enteredAt
                    ? `Entered ${fmtDate(s.enteredAt)}${
                        s.exitedAt ? `, exited ${fmtDate(s.exitedAt)}` : ""
                      }`
                    : "Not started"
                }
              >
                {s.gateRequired ? "⛩ " : ""}
                {s.name}
              </span>
            </li>
          );
        })}
        {project.status === "CLOSED" ? (
          <li className="ml-1">
            <span className="badge bg-zinc-800 text-white">
              Closed {fmtDate(project.closedAt)}
            </span>
          </li>
        ) : null}
      </ol>

      {current ? (
        <div className="mt-4 border-t border-zinc-100 pt-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">
                Current stage: {current.name}
                {current.gateRequired ? " (gated)" : ""}
              </h3>
              {current.gateRequired ? (
                <ul className="mt-2 space-y-1">
                  {current.approvals.length === 0 ? (
                    <li className="text-sm text-amber-700">
                      No approvers named yet — the gate cannot be passed.
                    </li>
                  ) : (
                    current.approvals.map((a) => (
                      <li key={a.id} className="flex items-center gap-2 text-sm">
                        <span
                          className={`badge ${
                            a.status === "APPROVED"
                              ? "bg-emerald-50 text-emerald-700"
                              : a.status === "REJECTED"
                                ? "bg-red-50 text-red-700"
                                : "bg-zinc-100 text-zinc-500"
                          }`}
                        >
                          {a.status.toLowerCase()}
                        </span>
                        <span>{a.approver.name}</span>
                        {a.note ? (
                          <span className="text-xs text-zinc-400">— {a.note}</span>
                        ) : null}
                        {a.status === "PENDING" &&
                        a.approverId === auth.user.id ? (
                          <form action={decideGate} className="ml-2 flex items-center gap-1">
                            <input type="hidden" name="approvalId" value={a.id} />
                            <input type="hidden" name="projectId" value={project.id} />
                            <input
                              name="note"
                              className="input w-40"
                              placeholder="Note (optional)"
                            />
                            <button
                              name="decision"
                              value="APPROVED"
                              className="btn btn-sm btn-primary"
                            >
                              Approve
                            </button>
                            <button
                              name="decision"
                              value="REJECTED"
                              className="btn btn-sm btn-danger"
                            >
                              Reject
                            </button>
                          </form>
                        ) : null}
                      </li>
                    ))
                  )}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-zinc-500">
                  No sign-off required for this stage.
                </p>
              )}
            </div>

            {isEditor && project.status === "ACTIVE" ? (
              <div className="flex shrink-0 flex-col items-end gap-2">
                <form action={advanceStage}>
                  <input type="hidden" name="projectId" value={project.id} />
                  <button
                    className={`btn ${gateReady ? "btn-primary" : ""}`}
                    title={
                      gateReady
                        ? undefined
                        : "Gate sign-off incomplete — advancing will be refused"
                    }
                  >
                    {isLast ? "Complete & close project" : "Advance stage →"}
                  </button>
                </form>
                {current.order > 0 ? (
                  <details>
                    <summary className="cursor-pointer text-xs text-zinc-500 hover:underline">
                      Roll back a stage…
                    </summary>
                    <form action={rollbackStage} className="mt-2 flex items-center gap-2">
                      <input type="hidden" name="projectId" value={project.id} />
                      <input
                        name="reason"
                        className="input w-56"
                        placeholder="Reason (required, audited)"
                        required
                      />
                      <button className="btn btn-sm btn-danger">Roll back</button>
                    </form>
                  </details>
                ) : null}
              </div>
            ) : null}
          </div>

          {isEditor && current.gateRequired ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-zinc-500 hover:underline">
                Name gate approvers…
              </summary>
              <form action={setGateApprovers} className="mt-2 flex flex-wrap items-end gap-3">
                <input type="hidden" name="stageId" value={current.id} />
                <input type="hidden" name="projectId" value={project.id} />
                <div className="flex flex-wrap gap-3">
                  {members.map((m) => (
                    <label key={m.id} className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        name="approverIds"
                        value={m.userId}
                        defaultChecked={current.approvals.some(
                          (a) => a.approverId === m.userId
                        )}
                      />
                      {m.user.name}
                      <span className="text-xs text-zinc-400">
                        ({m.role.toLowerCase()})
                      </span>
                    </label>
                  ))}
                </div>
                <button className="btn btn-sm">Save approvers</button>
              </form>
              <p className="mt-1 text-xs text-zinc-400">
                Any workspace user can be named — including viewers (e.g. legal
                sign-off). Decided approvals are kept for audit.
              </p>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
