import { prisma } from "./db";

// Append-only audit trail (redline §5.7). occurredAt is the client-claimed
// time (equal to server time until the offline client lands); recordedAt and
// seq are server-assigned.
export async function logActivity(entry: {
  workspaceId: string;
  projectId?: string | null;
  entityType: string;
  entityId: string;
  actorId?: string | null;
  action: string;
  detail?: string | null;
}) {
  await prisma.activityLog.create({
    data: {
      workspaceId: entry.workspaceId,
      projectId: entry.projectId ?? null,
      entityType: entry.entityType,
      entityId: entry.entityId,
      actorId: entry.actorId ?? null,
      action: entry.action,
      detail: entry.detail ?? null,
    },
  });
}
