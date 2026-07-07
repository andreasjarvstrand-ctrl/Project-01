import type { Auth } from "@/lib/auth";
import type { ProjectDetail, WorkspaceMember } from "@/lib/queries";
import { createRaidEntry, toggleRaidStatus } from "@/lib/actions/misc";
import { RAID_TYPES, type RaidType } from "@/lib/domain";
import { fmtDate } from "@/lib/format";
import { EmptyState } from "@/components/ui";

const TYPE_STYLES: Record<RaidType, string> = {
  RISK: "bg-red-50 text-red-700",
  ASSUMPTION: "bg-sky-100 text-sky-800",
  ISSUE: "bg-amber-50 text-amber-800",
  DECISION: "bg-emerald-50 text-emerald-700",
};

// RAID log (§5.7): risks, assumptions, issues, decisions — one place,
// each with a named owner.
export function RaidTab({
  project,
  auth,
  members,
}: {
  project: ProjectDetail;
  auth: Auth;
  members: WorkspaceMember[];
}) {
  const isEditor = auth.role !== "VIEWER";

  return (
    <div className="space-y-4">
      {isEditor ? (
        <form action={createRaidEntry} className="card flex flex-wrap items-end gap-2">
          <input type="hidden" name="projectId" value={project.id} />
          <div>
            <label className="label">Type</label>
            <select name="type" className="input w-36" defaultValue="RISK">
              {Object.entries(RAID_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-52 flex-1">
            <label className="label">Title</label>
            <input name="title" className="input" required />
          </div>
          <div className="min-w-52 flex-1">
            <label className="label">Detail</label>
            <input name="detail" className="input" />
          </div>
          <div>
            <label className="label">Owner</label>
            <select name="ownerId" className="input w-36">
              <option value="">Unowned</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Severity</label>
            <select name="severity" className="input w-28">
              <option value="">—</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>
          <button className="btn btn-primary">Log it</button>
        </form>
      ) : null}

      {project.raidEntries.length === 0 ? (
        <EmptyState message="Nothing logged yet — no risks, assumptions, issues, or decisions." />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="tbl">
            <thead>
              <tr>
                <th>Type</th>
                <th>Entry</th>
                <th>Owner</th>
                <th>Severity</th>
                <th>Logged</th>
                <th>Status</th>
                {isEditor ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {project.raidEntries.map((e) => (
                <tr key={e.id} className={e.status === "CLOSED" ? "opacity-60" : ""}>
                  <td>
                    <span className={`badge ${TYPE_STYLES[e.type as RaidType] ?? ""}`}>
                      {RAID_TYPES[e.type as RaidType] ?? e.type}
                    </span>
                  </td>
                  <td>
                    <span className="text-sm font-medium">{e.title}</span>
                    {e.detail ? (
                      <p className="mt-0.5 text-xs text-zinc-500">{e.detail}</p>
                    ) : null}
                  </td>
                  <td className="text-sm">{e.owner?.name ?? "—"}</td>
                  <td className="text-sm text-zinc-500">
                    {e.severity ? e.severity.toLowerCase() : "—"}
                  </td>
                  <td className="text-sm text-zinc-500">{fmtDate(e.createdAt)}</td>
                  <td>
                    <span
                      className={`badge ${
                        e.status === "OPEN"
                          ? "bg-amber-50 text-amber-800"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {e.status.toLowerCase()}
                    </span>
                  </td>
                  {isEditor ? (
                    <td>
                      <form action={toggleRaidStatus}>
                        <input type="hidden" name="raidId" value={e.id} />
                        <button className="btn btn-sm">
                          {e.status === "OPEN" ? "Close" : "Reopen"}
                        </button>
                      </form>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
