"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth, requireEditor } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { RAID_TYPES } from "@/lib/domain";
import { str, strOrNull } from "@/lib/format";

function revalidateAll() {
  revalidatePath("/", "layout");
}

// ---------- RAID log ----------

export async function createRaidEntry(formData: FormData) {
  const auth = await requireEditor();
  const projectId = str(formData.get("projectId"));
  const type = str(formData.get("type"));
  const title = str(formData.get("title"));
  if (!title || !(type in RAID_TYPES)) {
    redirect(`/projects/${projectId}?tab=raid`);
  }

  const entry = await prisma.raidEntry.create({
    data: {
      projectId,
      type,
      title,
      detail: strOrNull(formData.get("detail")),
      ownerId: strOrNull(formData.get("ownerId")),
      severity: strOrNull(formData.get("severity")),
    },
  });

  await logActivity({
    workspaceId: auth.workspace.id,
    projectId,
    entityType: "RAID",
    entityId: entry.id,
    actorId: auth.user.id,
    action: `logged ${RAID_TYPES[type as keyof typeof RAID_TYPES].toLowerCase()} “${title}”`,
  });

  revalidateAll();
  redirect(`/projects/${projectId}?tab=raid`);
}

export async function toggleRaidStatus(formData: FormData) {
  const auth = await requireEditor();
  const id = str(formData.get("raidId"));
  const entry = await prisma.raidEntry.findUniqueOrThrow({ where: { id } });
  const status = entry.status === "OPEN" ? "CLOSED" : "OPEN";
  await prisma.raidEntry.update({ where: { id }, data: { status } });

  await logActivity({
    workspaceId: auth.workspace.id,
    projectId: entry.projectId,
    entityType: "RAID",
    entityId: id,
    actorId: auth.user.id,
    action: `${status === "CLOSED" ? "closed" : "reopened"} “${entry.title}”`,
  });

  revalidateAll();
  redirect(`/projects/${entry.projectId}?tab=raid`);
}

// ---------- stakeholders / RACI ----------

export async function addStakeholder(formData: FormData) {
  const auth = await requireEditor();
  const projectId = str(formData.get("projectId"));
  const name = str(formData.get("name"));
  if (!name) redirect(`/projects/${projectId}?tab=stakeholders`);

  await prisma.stakeholder.create({
    data: {
      projectId,
      name,
      userId: strOrNull(formData.get("userId")),
      orgRole: strOrNull(formData.get("orgRole")),
      raci: str(formData.get("raci")) || "I",
      interest: strOrNull(formData.get("interest")),
      influence: strOrNull(formData.get("influence")),
      commsPreference: strOrNull(formData.get("commsPreference")),
    },
  });

  await logActivity({
    workspaceId: auth.workspace.id,
    projectId,
    entityType: "PROJECT",
    entityId: projectId,
    actorId: auth.user.id,
    action: `added stakeholder “${name}”`,
  });

  revalidateAll();
  redirect(`/projects/${projectId}?tab=stakeholders`);
}

export async function removeStakeholder(formData: FormData) {
  const auth = await requireEditor();
  const id = str(formData.get("stakeholderId"));
  const s = await prisma.stakeholder.findUniqueOrThrow({ where: { id } });
  await prisma.stakeholder.delete({ where: { id } });

  await logActivity({
    workspaceId: auth.workspace.id,
    projectId: s.projectId,
    entityType: "PROJECT",
    entityId: s.projectId,
    actorId: auth.user.id,
    action: `removed stakeholder “${s.name}”`,
  });

  revalidateAll();
  redirect(`/projects/${s.projectId}?tab=stakeholders`);
}

// ---------- comments ----------

// Redline Q2: Viewers may comment when the workspace toggle allows it.
export async function addComment(formData: FormData) {
  const auth = await requireAuth();
  if (auth.role === "VIEWER" && !auth.workspace.viewersCanComment) {
    throw new Error("Viewers cannot comment in this workspace.");
  }

  const entityType = str(formData.get("entityType"));
  const entityId = str(formData.get("entityId"));
  const returnTo = str(formData.get("returnTo")) || "/";
  const body = str(formData.get("body"));
  if (!body) redirect(returnTo);

  await prisma.comment.create({
    data: {
      workspaceId: auth.workspace.id,
      entityType,
      entityId,
      authorId: auth.user.id,
      body,
    },
  });

  await logActivity({
    workspaceId: auth.workspace.id,
    projectId: entityType === "PROJECT" ? entityId : null,
    entityType,
    entityId,
    actorId: auth.user.id,
    action: "commented",
  });

  revalidateAll();
  redirect(returnTo);
}
