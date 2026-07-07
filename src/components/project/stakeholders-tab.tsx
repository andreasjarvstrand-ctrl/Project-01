import type { Auth } from "@/lib/auth";
import type { ProjectDetail, WorkspaceMember } from "@/lib/queries";
import { addStakeholder, removeStakeholder } from "@/lib/actions/misc";
import { RACI } from "@/lib/domain";
import { EmptyState } from "@/components/ui";

// Stakeholder register + RACI (§5.7). RACI is distinct from the RAID log.
export function StakeholdersTab({
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
        <form action={addStakeholder} className="card flex flex-wrap items-end gap-2">
          <input type="hidden" name="projectId" value={project.id} />
          <div className="min-w-44 flex-1">
            <label className="label">Name</label>
            <input name="name" className="input" required />
          </div>
          <div>
            <label className="label">Workspace user (optional)</label>
            <select name="userId" className="input w-40">
              <option value="">External / none</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Role / function</label>
            <input name="orgRole" className="input w-40" placeholder="e.g. Legal counsel" />
          </div>
          <div>
            <label className="label">RACI</label>
            <select name="raci" className="input w-36" defaultValue="C">
              {Object.entries(RACI).map(([k, v]) => (
                <option key={k} value={k}>
                  {k} — {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Interest</label>
            <select name="interest" className="input w-24">
              <option value="">—</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Med</option>
              <option value="HIGH">High</option>
            </select>
          </div>
          <div>
            <label className="label">Influence</label>
            <select name="influence" className="input w-24">
              <option value="">—</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Med</option>
              <option value="HIGH">High</option>
            </select>
          </div>
          <div>
            <label className="label">Comms preference</label>
            <input name="commsPreference" className="input w-36" placeholder="e.g. weekly email" />
          </div>
          <button className="btn btn-primary">Add</button>
        </form>
      ) : null}

      {project.stakeholders.length === 0 ? (
        <EmptyState message="No stakeholders registered yet." />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="tbl">
            <thead>
              <tr>
                <th>Stakeholder</th>
                <th>Role / function</th>
                <th>RACI</th>
                <th>Interest</th>
                <th>Influence</th>
                <th>Comms</th>
                {isEditor ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {project.stakeholders.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span className="text-sm font-medium">{s.name}</span>
                    {s.user ? (
                      <span className="ml-1 text-xs text-zinc-400">
                        ({s.user.email})
                      </span>
                    ) : null}
                  </td>
                  <td className="text-sm text-zinc-600">{s.orgRole ?? "—"}</td>
                  <td>
                    <span
                      className="badge bg-indigo-50 text-indigo-700"
                      title={RACI[s.raci as keyof typeof RACI]}
                    >
                      {s.raci} — {RACI[s.raci as keyof typeof RACI]}
                    </span>
                  </td>
                  <td className="text-sm text-zinc-500">
                    {s.interest?.toLowerCase() ?? "—"}
                  </td>
                  <td className="text-sm text-zinc-500">
                    {s.influence?.toLowerCase() ?? "—"}
                  </td>
                  <td className="text-sm text-zinc-500">{s.commsPreference ?? "—"}</td>
                  {isEditor ? (
                    <td>
                      <form action={removeStakeholder}>
                        <input type="hidden" name="stakeholderId" value={s.id} />
                        <button className="btn btn-sm btn-danger">✕</button>
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
