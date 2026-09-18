import type { Auth } from "@/lib/auth";
import type { ProjectDetail, WorkspaceMember } from "@/lib/queries";
import {
  addDependency,
  createTask,
  deleteTask,
  removeDependency,
  setTaskStatus,
} from "@/lib/actions/tasks";
import { PRIORITIES, TASK_STATUSES } from "@/lib/domain";
import { daysUntil, fmtDate } from "@/lib/format";
import { EmptyState } from "@/components/ui";

const STATUS_STYLES: Record<string, string> = {
  TODO: "bg-zinc-100 text-zinc-600",
  IN_PROGRESS: "bg-sky-100 text-sky-800",
  BLOCKED: "bg-red-50 text-red-700",
  DONE: "bg-emerald-50 text-emerald-700",
};

export function TasksTab({
  project,
  auth,
  members,
}: {
  project: ProjectDetail;
  auth: Auth;
  members: WorkspaceMember[];
}) {
  const isEditor = auth.role !== "VIEWER";
  const topLevel = project.tasks.filter((t) => !t.parentId);
  const childrenOf = (id: string) =>
    project.tasks.filter((t) => t.parentId === id);

  return (
    <div className="space-y-4">
      {isEditor ? (
        <form action={createTask} className="card flex flex-wrap items-end gap-2">
          <input type="hidden" name="projectId" value={project.id} />
          <div className="min-w-56 flex-1">
            <label className="label">New task</label>
            <input name="title" className="input" placeholder="Task title" required />
          </div>
          <div>
            <label className="label">Stage</label>
            <select name="stageId" className="input w-40">
              <option value="">None</option>
              {project.stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Assignee</label>
            <select name="assigneeId" className="input w-36">
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Due</label>
            <input name="dueDate" type="date" className="input w-36" />
          </div>
          <div>
            <label className="label">Priority</label>
            <select name="priority" className="input w-28" defaultValue="MEDIUM">
              {Object.entries(PRIORITIES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-1.5 pb-2 text-sm">
            <input type="checkbox" name="isMilestone" /> Milestone
          </label>
          <button className="btn btn-primary">Add</button>
        </form>
      ) : null}

      {topLevel.length === 0 ? (
        <EmptyState message="No tasks yet." />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="tbl">
            <thead>
              <tr>
                <th>Task</th>
                <th>Stage</th>
                <th>Assignee</th>
                <th>Due</th>
                <th>Priority</th>
                <th>Status</th>
                {isEditor ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {topLevel.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  subtasks={childrenOf(t.id)}
                  project={project}
                  isEditor={isEditor}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task,
  subtasks,
  project,
  isEditor,
  indent = false,
}: {
  task: ProjectDetail["tasks"][number];
  subtasks: ProjectDetail["tasks"];
  project: ProjectDetail;
  isEditor: boolean;
  indent?: boolean;
}) {
  const overdue =
    task.dueDate && task.status !== "DONE" && daysUntil(task.dueDate) < 0;
  const blockedBy = task.dependsOn.filter((d) => d.dependsOn.status !== "DONE");
  const others = project.tasks.filter((t) => t.id !== task.id);

  return (
    <>
      <tr className={task.status === "DONE" ? "opacity-60" : ""}>
        <td>
          <div className={indent ? "pl-5" : ""}>
            <span className="text-sm font-medium">
              {task.isMilestone ? "◆ " : ""}
              {task.title}
            </span>
            {task.description ? (
              <p className="mt-0.5 text-xs text-zinc-500">{task.description}</p>
            ) : null}
            {task.dependsOn.length > 0 ? (
              <p className="mt-0.5 text-xs text-zinc-400">
                depends on:{" "}
                {task.dependsOn.map((d, i) => (
                  <span key={d.id}>
                    {i > 0 ? ", " : ""}
                    <span
                      className={
                        d.dependsOn.status !== "DONE" ? "text-amber-700" : ""
                      }
                    >
                      {d.dependsOn.title}
                    </span>
                    {isEditor ? (
                      <form action={removeDependency} className="inline">
                        <input type="hidden" name="dependencyId" value={d.id} />
                        <button
                          className="ml-0.5 text-zinc-400 hover:text-red-600"
                          title="Remove dependency"
                        >
                          ×
                        </button>
                      </form>
                    ) : null}
                  </span>
                ))}
              </p>
            ) : null}
            {isEditor && others.length > 0 ? (
              <details className="mt-0.5">
                <summary className="cursor-pointer text-xs text-zinc-400 hover:underline">
                  + dependency
                </summary>
                <form action={addDependency} className="mt-1 flex items-center gap-1">
                  <input type="hidden" name="taskId" value={task.id} />
                  <select name="dependsOnId" className="input w-56 text-xs">
                    {others.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.title}
                      </option>
                    ))}
                  </select>
                  <button className="btn btn-sm">Add</button>
                </form>
              </details>
            ) : null}
          </div>
        </td>
        <td className="text-sm text-zinc-500">{task.stage?.name ?? "—"}</td>
        <td className="text-sm">{task.assignee?.name ?? "—"}</td>
        <td className={`text-sm ${overdue ? "font-medium text-red-700" : ""}`}>
          {fmtDate(task.dueDate)}
        </td>
        <td className="text-sm text-zinc-500">
          {PRIORITIES[task.priority as keyof typeof PRIORITIES] ?? task.priority}
        </td>
        <td>
          <span className={`badge ${STATUS_STYLES[task.status] ?? ""}`}>
            {TASK_STATUSES[task.status as keyof typeof TASK_STATUSES] ??
              task.status}
          </span>
          {blockedBy.length > 0 && task.status !== "DONE" ? (
            <span className="ml-1 text-xs text-amber-700" title="Prerequisites incomplete">
              ⧗
            </span>
          ) : null}
        </td>
        {isEditor ? (
          <td>
            <div className="flex items-center gap-1">
              {task.status !== "DONE" ? (
                <>
                  {task.status !== "IN_PROGRESS" ? (
                    <form action={setTaskStatus}>
                      <input type="hidden" name="taskId" value={task.id} />
                      <button name="status" value="IN_PROGRESS" className="btn btn-sm" title="Start">
                        Start
                      </button>
                    </form>
                  ) : null}
                  <form action={setTaskStatus}>
                    <input type="hidden" name="taskId" value={task.id} />
                    <button name="status" value="DONE" className="btn btn-sm" title="Mark done">
                      Done
                    </button>
                  </form>
                </>
              ) : (
                <form action={setTaskStatus}>
                  <input type="hidden" name="taskId" value={task.id} />
                  <button name="status" value="TODO" className="btn btn-sm" title="Reopen">
                    Reopen
                  </button>
                </form>
              )}
              <form action={deleteTask}>
                <input type="hidden" name="taskId" value={task.id} />
                <button className="btn btn-sm btn-danger" title="Delete">
                  ✕
                </button>
              </form>
            </div>
          </td>
        ) : null}
      </tr>
      {subtasks.map((s) => (
        <TaskRow
          key={s.id}
          task={s}
          subtasks={[]}
          project={project}
          isEditor={isEditor}
          indent
        />
      ))}
    </>
  );
}
