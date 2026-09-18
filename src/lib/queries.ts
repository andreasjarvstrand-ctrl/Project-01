import { prisma } from "./db";

// Single fetch for the project detail page; components type their props
// from this payload.
export async function getProjectDetail(id: string, workspaceId: string) {
  return prisma.project.findFirst({
    where: { id, workspaceId },
    include: {
      category: true,
      createdBy: true,
      stages: {
        orderBy: { order: "asc" },
        include: { approvals: { include: { approver: true } } },
      },
      tasks: {
        orderBy: { order: "asc" },
        include: {
          assignee: true,
          stage: true,
          dependsOn: { include: { dependsOn: true } },
        },
      },
      raidEntries: {
        orderBy: { createdAt: "desc" },
        include: { owner: true },
      },
      stakeholders: { include: { user: true } },
      suppliers: { include: { supplier: true } },
      scoringRounds: {
        orderBy: { createdAt: "desc" },
        include: {
          template: { include: { criteria: { orderBy: { order: "asc" } } } },
          evaluators: { include: { user: true } },
          suppliers: { include: { supplier: true } },
          scores: true,
        },
      },
      contracts: { include: { supplier: true } },
    },
  });
}

export type ProjectDetail = NonNullable<
  Awaited<ReturnType<typeof getProjectDetail>>
>;

export async function getWorkspaceMembers(workspaceId: string) {
  return prisma.membership.findMany({
    where: { workspaceId },
    include: { user: true },
    orderBy: { user: { name: "asc" } },
  });
}

export type WorkspaceMember = Awaited<
  ReturnType<typeof getWorkspaceMembers>
>[number];
