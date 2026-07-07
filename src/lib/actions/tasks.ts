"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireEditor } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { TASK_STATUSES } from "@/lib/domain";
import { parseDateOrNull, str, strOrNull } from "@/lib/format";

function revalidateAll() {
  revalidatePath("/", "layout");
}

export async function createTask(formData: FormData) {
  const auth = await requireEditor();
  const projectId = str(formData.get("projectId"));
  const title = str(formData.get("title"));
  if (!title) redirect(`/projects/${projectId}?tab=tasks`);

  const last = await prisma.task.findFirst({
    where: { projectId },
    orderBy: { order: "desc" },
  });

  const task = await prisma.task.create({
    data: {
      projectId,
      title,
      stageId: strOrNull(formData.get("stageId")),
      parentId: strOrNull(formData.get("parentId")),
      assigneeId: strOrNull(formData.get("assigneeId")),
      priority: str(formData.get("priority")) || "MEDIUM",
      dueDate: parseDateOrNull(formData.get("dueDate")),
      isMilestone: formData.get("isMilestone") === "on",
      order: (last?.order ?? 0) + 1,
    },
  });

  await logActivity({
    workspaceId: auth.workspace.id,
    projectId,
    entityType: "TASK",
    entityId: task.id,
    actorId: auth.user.id,
    action: `created task “${title}”`,
  });

  revalidateAll();
  redirect(`/projects/${projectId}?tab=tasks`);
}

export async function setTaskStatus(formData: FormData) {
  const auth = await requireEditor();
  const taskId = str(formData.get("taskId"));
  const status = str(formData.get("status"));
  if (!(status in TASK_STATUSES)) throw new Error("Invalid status.");

  const task = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    include: { dependsOn: { include: { dependsOn: true } } },
  });

  // Finish-to-start dependency: cannot complete before prerequisites are done.
  if (status === "DONE") {
    const openPrereqs = task.dependsOn.filter(
      (d) => d.dependsOn.status !== "DONE"
    );
    if (openPrereqs.length > 0) {
      redirect(
        `/projects/${task.projectId}?tab=tasks&error=Blocked+by+incomplete+prerequisite:+${encodeURIComponent(
          openPrereqs[0].dependsOn.title
        )}`
      );
    }
  }

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status,
      completedAt: status === "DONE" ? new Date() : null,
    },
  });

  await logActivity({
    workspaceId: auth.workspace.id,
    projectId: task.projectId,
    entityType: "TASK",
    entityId: taskId,
    actorId: auth.user.id,
    action: `moved task “${task.title}” to ${TASK_STATUSES[status as keyof typeof TASK_STATUSES]}`,
  });

  revalidateAll();
  redirect(`/projects/${task.projectId}?tab=tasks`);
}

export async function updateTask(formData: FormData) {
  const auth = await requireEditor();
  const taskId = str(formData.get("taskId"));
  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });

  await prisma.task.update({
    where: { id: taskId },
    data: {
      title: str(formData.get("title")) || task.title,
      description: strOrNull(formData.get("description")),
      stageId: strOrNull(formData.get("stageId")),
      assigneeId: strOrNull(formData.get("assigneeId")),
      priority: str(formData.get("priority")) || task.priority,
      dueDate: parseDateOrNull(formData.get("dueDate")),
      isMilestone: formData.get("isMilestone") === "on",
    },
  });

  await logActivity({
    workspaceId: auth.workspace.id,
    projectId: task.projectId,
    entityType: "TASK",
    entityId: taskId,
    actorId: auth.user.id,
    action: `updated task “${task.title}”`,
  });

  revalidateAll();
  redirect(`/projects/${task.projectId}?tab=tasks`);
}

export async function deleteTask(formData: FormData) {
  const auth = await requireEditor();
  const taskId = str(formData.get("taskId"));
  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });

  // Reparent subtasks rather than orphaning them, then remove the task.
  await prisma.task.updateMany({
    where: { parentId: taskId },
    data: { parentId: null },
  });
  await prisma.task.delete({ where: { id: taskId } });

  await logActivity({
    workspaceId: auth.workspace.id,
    projectId: task.projectId,
    entityType: "TASK",
    entityId: taskId,
    actorId: auth.user.id,
    action: `deleted task “${task.title}”`,
  });

  revalidateAll();
  redirect(`/projects/${task.projectId}?tab=tasks`);
}

export async function addDependency(formData: FormData) {
  const auth = await requireEditor();
  const taskId = str(formData.get("taskId"));
  const dependsOnId = str(formData.get("dependsOnId"));
  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });

  if (!dependsOnId || dependsOnId === taskId) {
    redirect(`/projects/${task.projectId}?tab=tasks`);
  }

  // Reject cycles: walk the prerequisite graph from the proposed prerequisite.
  const visited = new Set<string>();
  let frontier = [dependsOnId];
  while (frontier.length) {
    const deps = await prisma.taskDependency.findMany({
      where: { taskId: { in: frontier } },
    });
    frontier = [];
    for (const d of deps) {
      if (d.dependsOnId === taskId) {
        redirect(
          `/projects/${task.projectId}?tab=tasks&error=That+dependency+would+create+a+cycle`
        );
      }
      if (!visited.has(d.dependsOnId)) {
        visited.add(d.dependsOnId);
        frontier.push(d.dependsOnId);
      }
    }
  }

  await prisma.taskDependency.upsert({
    where: { taskId_dependsOnId: { taskId, dependsOnId } },
    update: {},
    create: { taskId, dependsOnId },
  });

  await logActivity({
    workspaceId: auth.workspace.id,
    projectId: task.projectId,
    entityType: "TASK",
    entityId: taskId,
    actorId: auth.user.id,
    action: "added task dependency",
  });

  revalidateAll();
  redirect(`/projects/${task.projectId}?tab=tasks`);
}

export async function removeDependency(formData: FormData) {
  const auth = await requireEditor();
  const id = str(formData.get("dependencyId"));
  const dep = await prisma.taskDependency.findUniqueOrThrow({
    where: { id },
    include: { task: true },
  });
  await prisma.taskDependency.delete({ where: { id } });

  await logActivity({
    workspaceId: auth.workspace.id,
    projectId: dep.task.projectId,
    entityType: "TASK",
    entityId: dep.taskId,
    actorId: auth.user.id,
    action: "removed task dependency",
  });

  revalidateAll();
  redirect(`/projects/${dep.task.projectId}?tab=tasks`);
}
