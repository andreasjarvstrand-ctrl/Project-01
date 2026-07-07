import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { PROJECT_TYPES, CANONICAL_PHASES } from "@/lib/domain";

function csvCell(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

// CSV export (redline §5.8: CSV/Excel in v1, PDF packs deferred). Viewers
// may export what they can view (redline A6).
export async function GET() {
  const auth = await getAuth();
  if (!auth) return new Response("Unauthorized", { status: 401 });

  const projects = await prisma.project.findMany({
    where: { workspaceId: auth.workspace.id },
    include: { category: true, stages: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "asc" },
  });

  const header = [
    "Name",
    "Type",
    "Category",
    "Status",
    "Current phase",
    "Kraljic",
    "Currency",
    "Estimated spend",
    "Savings target",
    "Savings realized",
    "Created",
    "Closed",
  ];
  const rows = projects.map((p) => {
    const current = p.stages.find((s) => s.enteredAt && !s.exitedAt);
    return [
      p.name,
      PROJECT_TYPES[p.type as keyof typeof PROJECT_TYPES] ?? p.type,
      p.category?.name ?? "",
      p.status,
      current
        ? (CANONICAL_PHASES[
            current.canonicalPhase as keyof typeof CANONICAL_PHASES
          ] ?? current.canonicalPhase)
        : "",
      p.kraljic ?? "",
      p.currency,
      p.estimatedSpend,
      p.savingsTarget,
      p.savingsRealized,
      p.createdAt.toISOString().slice(0, 10),
      p.closedAt ? p.closedAt.toISOString().slice(0, 10) : "",
    ];
  });

  const csv = [header, ...rows]
    .map((r) => r.map(csvCell).join(","))
    .join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="projects-export.csv"`,
    },
  });
}
