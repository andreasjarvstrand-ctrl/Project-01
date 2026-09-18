import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getProjectDetail, getWorkspaceMembers } from "@/lib/queries";
import { fmtDateTime } from "@/lib/format";
import {
  ErrorBanner,
  KraljicBadge,
  PageHeader,
  RagBadge,
  TypeBadge,
} from "@/components/ui";
import { StageStrip } from "@/components/project/stage-strip";
import { OverviewTab } from "@/components/project/overview-tab";
import { TasksTab } from "@/components/project/tasks-tab";
import { RaidTab } from "@/components/project/raid-tab";
import { StakeholdersTab } from "@/components/project/stakeholders-tab";
import { ScorecardsTab } from "@/components/project/scorecards-tab";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "tasks", label: "Tasks" },
  { key: "raid", label: "RAID log" },
  { key: "stakeholders", label: "Stakeholders" },
  { key: "scorecards", label: "Scorecards" },
  { key: "activity", label: "Activity" },
] as const;

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; error?: string; round?: string }>;
}) {
  const auth = await requireAuth();
  const { id } = await params;
  const { tab = "overview", error, round } = await searchParams;

  const [project, members] = await Promise.all([
    getProjectDetail(id, auth.workspace.id),
    getWorkspaceMembers(auth.workspace.id),
  ]);
  if (!project) notFound();

  const openTasks = project.tasks.filter((t) => t.status !== "DONE").length;
  const openRaid = project.raidEntries.filter((r) => r.status === "OPEN").length;

  return (
    <div>
      <PageHeader
        title={project.name}
        subtitle={`${openTasks} open task${openTasks === 1 ? "" : "s"} · ${openRaid} open RAID entr${openRaid === 1 ? "y" : "ies"}`}
        action={
          <div className="flex items-center gap-2">
            <TypeBadge type={project.type} />
            <KraljicBadge kraljic={project.kraljic} />
            <RagBadge rag={project.rag} />
          </div>
        }
      />
      <ErrorBanner error={error} />

      <StageStrip project={project} auth={auth} members={members} />

      <nav className="mb-4 flex gap-1 border-b border-zinc-200">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/projects/${project.id}?tab=${t.key}`}
            className={`tab ${tab === t.key ? "tab-active" : ""}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "overview" ? (
        <OverviewTab project={project} auth={auth} />
      ) : tab === "tasks" ? (
        <TasksTab project={project} auth={auth} members={members} />
      ) : tab === "raid" ? (
        <RaidTab project={project} auth={auth} members={members} />
      ) : tab === "stakeholders" ? (
        <StakeholdersTab project={project} auth={auth} members={members} />
      ) : tab === "scorecards" ? (
        <ScorecardsTab
          project={project}
          auth={auth}
          members={members}
          selectedRoundId={round}
        />
      ) : tab === "activity" ? (
        <ActivityTab projectId={project.id} workspaceId={auth.workspace.id} />
      ) : null}
    </div>
  );
}

// Per-project slice of the append-only audit trail (§5.7).
async function ActivityTab({
  projectId,
  workspaceId,
}: {
  projectId: string;
  workspaceId: string;
}) {
  const entries = await prisma.activityLog.findMany({
    where: { workspaceId, projectId },
    include: { actor: true },
    orderBy: { seq: "desc" },
    take: 100,
  });

  return (
    <div className="card">
      <h3 className="mb-3 text-sm font-semibold">Activity log</h3>
      <p className="mb-3 text-xs text-zinc-400">
        Append-only. Entries carry both the time the action occurred and the
        time the server recorded it.
      </p>
      {entries.length === 0 ? (
        <p className="text-sm text-zinc-500">No activity yet.</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((e) => (
            <li key={e.seq} className="text-sm">
              <span className="font-medium">{e.actor?.name ?? "System"}</span>{" "}
              <span className="text-zinc-600">{e.action}</span>
              {e.detail ? <span className="text-zinc-400"> — {e.detail}</span> : null}
              <span className="ml-2 text-xs text-zinc-400">
                {fmtDateTime(e.recordedAt)} · #{e.seq}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
