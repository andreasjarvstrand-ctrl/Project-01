"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth, requireEditor, requireAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { STAGE_TEMPLATES } from "@/lib/templates";
import { PROJECT_TYPES, type ProjectType } from "@/lib/domain";
import { errRedirect, parseIntOrNull, str, strOrNull } from "@/lib/format";

function revalidateAll() {
  revalidatePath("/", "layout");
}

export async function createProject(formData: FormData) {
  const auth = await requireAuth();
  if (auth.role === "VIEWER") throw new Error("Viewers cannot create projects.");
  if (auth.role === "MEMBER" && !auth.workspace.membersCanCreateProjects) {
    throw new Error("Project creation is restricted to Admins in this workspace.");
  }

  const name = str(formData.get("name"));
  const type = str(formData.get("type")) as ProjectType;
  if (!name || !(type in PROJECT_TYPES)) {
    redirect("/projects/new?error=Name+and+project+type+are+required");
  }

  const template = STAGE_TEMPLATES[type];
  const project = await prisma.project.create({
    data: {
      workspaceId: auth.workspace.id,
      name,
      description: strOrNull(formData.get("description")),
      type,
      sourcingType: strOrNull(formData.get("sourcingType")),
      kraljic: strOrNull(formData.get("kraljic")),
      categoryId: strOrNull(formData.get("categoryId")),
      currency: str(formData.get("currency")) || auth.workspace.currency,
      estimatedSpend: parseIntOrNull(formData.get("estimatedSpend")),
      savingsTarget: parseIntOrNull(formData.get("savingsTarget")),
      savingsType: strOrNull(formData.get("savingsType")),
      baselineNote: strOrNull(formData.get("baselineNote")),
      createdById: auth.user.id,
      stages: {
        create: template.map((s, i) => ({
          name: s.name,
          canonicalPhase: s.canonicalPhase,
          order: i,
          gateRequired: s.gateRequired,
          // The first stage is entered at creation.
          enteredAt: i === 0 ? new Date() : null,
        })),
      },
    },
  });

  await logActivity({
    workspaceId: auth.workspace.id,
    projectId: project.id,
    entityType: "PROJECT",
    entityId: project.id,
    actorId: auth.user.id,
    action: "created project",
    detail: PROJECT_TYPES[type],
  });

  revalidateAll();
  redirect(`/projects/${project.id}`);
}

export async function updateProject(formData: FormData) {
  const auth = await requireEditor();
  const id = str(formData.get("projectId"));
  const project = await prisma.project.findUniqueOrThrow({ where: { id } });

  await prisma.project.update({
    where: { id },
    data: {
      name: str(formData.get("name")) || project.name,
      description: strOrNull(formData.get("description")),
      kraljic: strOrNull(formData.get("kraljic")),
      categoryId: strOrNull(formData.get("categoryId")),
      rag: str(formData.get("rag")) || project.rag,
      estimatedSpend: parseIntOrNull(formData.get("estimatedSpend")),
      savingsTarget: parseIntOrNull(formData.get("savingsTarget")),
      savingsRealized: parseIntOrNull(formData.get("savingsRealized")),
      savingsType: strOrNull(formData.get("savingsType")),
      baselineNote: strOrNull(formData.get("baselineNote")),
    },
  });

  await logActivity({
    workspaceId: auth.workspace.id,
    projectId: id,
    entityType: "PROJECT",
    entityId: id,
    actorId: auth.user.id,
    action: "updated project details",
  });

  revalidateAll();
  redirect(`/projects/${id}`);
}

// Stage-gate transition. Gate rules per redline §4: a gate blocks the stage
// transition only; when the last stage exits, the project closes.
export async function advanceStage(formData: FormData) {
  const auth = await requireEditor();
  const projectId = str(formData.get("projectId"));

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      stages: { orderBy: { order: "asc" }, include: { approvals: true } },
    },
  });

  const current = project.stages.find((s) => s.enteredAt && !s.exitedAt);
  if (!current) {
    redirect(`/projects/${projectId}?error=No+active+stage+to+advance`);
  }

  if (current.gateRequired) {
    if (current.approvals.length === 0) {
      redirect(
        `/projects/${projectId}?error=This+gate+needs+at+least+one+named+approver+before+the+project+can+advance`
      );
    }
    const undecided = current.approvals.filter((a) => a.status !== "APPROVED");
    if (undecided.length > 0) {
      redirect(
        errRedirect(
          `/projects/${projectId}`,
          `Gate sign-off incomplete — ${undecided.length} approval(s) outstanding`
        )
      );
    }
  }

  const now = new Date();
  const next = project.stages.find((s) => s.order === current.order + 1);

  await prisma.stage.update({
    where: { id: current.id },
    data: { exitedAt: now },
  });

  if (next) {
    await prisma.stage.update({
      where: { id: next.id },
      data: { enteredAt: now },
    });
  } else {
    await prisma.project.update({
      where: { id: projectId },
      data: { status: "CLOSED", closedAt: now },
    });
  }

  await logActivity({
    workspaceId: auth.workspace.id,
    projectId,
    entityType: "STAGE",
    entityId: current.id,
    actorId: auth.user.id,
    action: next ? `advanced to stage “${next.name}”` : "closed project",
    detail: `left “${current.name}”`,
  });

  revalidateAll();
  redirect(`/projects/${projectId}`);
}

// Redline §4: rollback with a required reason — without it teams abandon
// projects and clone new ones, destroying the audit trail.
export async function rollbackStage(formData: FormData) {
  const auth = await requireEditor();
  const projectId = str(formData.get("projectId"));
  const reason = str(formData.get("reason"));

  if (!reason) {
    redirect(`/projects/${projectId}?error=A+rollback+reason+is+required`);
  }

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { stages: { orderBy: { order: "asc" } } },
  });

  const current = project.stages.find((s) => s.enteredAt && !s.exitedAt);
  if (!current || current.order === 0) {
    redirect(`/projects/${projectId}?error=Nothing+to+roll+back+to`);
  }
  const prev = project.stages.find((s) => s.order === current.order - 1)!;

  await prisma.stage.update({
    where: { id: current.id },
    data: { enteredAt: null },
  });
  await prisma.stage.update({
    where: { id: prev.id },
    data: { exitedAt: null },
  });
  // The gate that let the project out of the previous stage must be re-earned.
  await prisma.gateApproval.updateMany({
    where: { stageId: prev.id },
    data: { status: "PENDING", decidedAt: null },
  });

  await logActivity({
    workspaceId: auth.workspace.id,
    projectId,
    entityType: "STAGE",
    entityId: prev.id,
    actorId: auth.user.id,
    action: `rolled back to stage “${prev.name}”`,
    detail: reason,
  });

  revalidateAll();
  redirect(`/projects/${projectId}`);
}

// Redline A5: approvers are named per gate, independent of workspace role.
export async function setGateApprovers(formData: FormData) {
  const auth = await requireEditor();
  const stageId = str(formData.get("stageId"));
  const projectId = str(formData.get("projectId"));
  const userIds = formData.getAll("approverIds").map(String).filter(Boolean);

  const existing = await prisma.gateApproval.findMany({ where: { stageId } });
  // Remove undecided approvers no longer listed; decided rows stay for audit.
  await prisma.gateApproval.deleteMany({
    where: {
      stageId,
      status: "PENDING",
      approverId: { notIn: userIds.length ? userIds : ["-"] },
    },
  });
  for (const userId of userIds) {
    if (!existing.some((a) => a.approverId === userId)) {
      await prisma.gateApproval.create({
        data: { stageId, approverId: userId },
      });
    }
  }

  await logActivity({
    workspaceId: auth.workspace.id,
    projectId,
    entityType: "STAGE",
    entityId: stageId,
    actorId: auth.user.id,
    action: "updated gate approvers",
  });

  revalidateAll();
  redirect(`/projects/${projectId}`);
}

// Any named approver may decide — including Viewers (redline A5). This is a
// server-authoritative action (redline D2).
export async function decideGate(formData: FormData) {
  const auth = await requireAuth();
  const approvalId = str(formData.get("approvalId"));
  const projectId = str(formData.get("projectId"));
  const decision = str(formData.get("decision"));
  const note = strOrNull(formData.get("note"));

  const approval = await prisma.gateApproval.findUniqueOrThrow({
    where: { id: approvalId },
    include: { stage: true },
  });
  if (approval.approverId !== auth.user.id) {
    throw new Error("Only the named approver can decide this gate.");
  }
  if (!approval.stage.enteredAt || approval.stage.exitedAt) {
    redirect(`/projects/${projectId}?error=This+stage+is+not+currently+active`);
  }
  if (decision !== "APPROVED" && decision !== "REJECTED") {
    throw new Error("Invalid decision.");
  }

  await prisma.gateApproval.update({
    where: { id: approvalId },
    data: { status: decision, note, decidedAt: new Date() },
  });

  await logActivity({
    workspaceId: auth.workspace.id,
    projectId,
    entityType: "GATE",
    entityId: approvalId,
    actorId: auth.user.id,
    action:
      decision === "APPROVED"
        ? `approved gate on “${approval.stage.name}”`
        : `rejected gate on “${approval.stage.name}”`,
    detail: note,
  });

  revalidateAll();
  redirect(`/projects/${projectId}`);
}

// §6: hard delete is Admin-only; archive is the normal path.
export async function archiveProject(formData: FormData) {
  const auth = await requireEditor();
  const projectId = str(formData.get("projectId"));
  await prisma.project.update({
    where: { id: projectId },
    data: { status: "ARCHIVED" },
  });
  await logActivity({
    workspaceId: auth.workspace.id,
    projectId,
    entityType: "PROJECT",
    entityId: projectId,
    actorId: auth.user.id,
    action: "archived project",
  });
  revalidateAll();
  redirect("/projects");
}

export async function deleteProject(formData: FormData) {
  const auth = await requireAdmin();
  const projectId = str(formData.get("projectId"));
  await prisma.project.delete({ where: { id: projectId } });
  await logActivity({
    workspaceId: auth.workspace.id,
    entityType: "PROJECT",
    entityId: projectId,
    actorId: auth.user.id,
    action: "deleted project",
  });
  revalidateAll();
  redirect("/projects");
}

export async function linkSupplier(formData: FormData) {
  const auth = await requireEditor();
  const projectId = str(formData.get("projectId"));
  const supplierId = str(formData.get("supplierId"));
  if (!supplierId) redirect(`/projects/${projectId}`);

  await prisma.projectSupplier.upsert({
    where: { projectId_supplierId: { projectId, supplierId } },
    update: {},
    create: { projectId, supplierId },
  });
  await logActivity({
    workspaceId: auth.workspace.id,
    projectId,
    entityType: "PROJECT",
    entityId: projectId,
    actorId: auth.user.id,
    action: "linked supplier",
  });
  revalidateAll();
  redirect(`/projects/${projectId}`);
}

export async function unlinkSupplier(formData: FormData) {
  const auth = await requireEditor();
  const id = str(formData.get("linkId"));
  const projectId = str(formData.get("projectId"));
  await prisma.projectSupplier.delete({ where: { id } });
  await logActivity({
    workspaceId: auth.workspace.id,
    projectId,
    entityType: "PROJECT",
    entityId: projectId,
    actorId: auth.user.id,
    action: "unlinked supplier",
  });
  revalidateAll();
  redirect(`/projects/${projectId}`);
}
