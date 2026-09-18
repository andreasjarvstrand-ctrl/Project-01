"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireEditor } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { parseDateOrNull, parseIntOrNull, str, strOrNull } from "@/lib/format";

function revalidateAll() {
  revalidatePath("/", "layout");
}

export async function createContract(formData: FormData) {
  const auth = await requireEditor();
  const title = str(formData.get("title"));
  const supplierId = str(formData.get("supplierId"));
  const startDate = parseDateOrNull(formData.get("startDate"));
  const endDate = parseDateOrNull(formData.get("endDate"));

  if (!title || !supplierId || !startDate || !endDate) {
    redirect("/contracts/new?error=Title,+supplier+and+dates+are+required");
  }

  const contract = await prisma.contract.create({
    data: {
      workspaceId: auth.workspace.id,
      supplierId,
      projectId: strOrNull(formData.get("projectId")),
      title,
      reference: strOrNull(formData.get("reference")),
      startDate,
      endDate,
      renewalNoticeDays: parseIntOrNull(formData.get("renewalNoticeDays")) ?? 90,
      value: parseIntOrNull(formData.get("value")),
      currency: str(formData.get("currency")) || auth.workspace.currency,
      notes: strOrNull(formData.get("notes")),
    },
  });

  await logActivity({
    workspaceId: auth.workspace.id,
    projectId: contract.projectId,
    entityType: "CONTRACT",
    entityId: contract.id,
    actorId: auth.user.id,
    action: `created contract “${title}”`,
  });

  revalidateAll();
  redirect(`/contracts/${contract.id}`);
}

export async function updateContract(formData: FormData) {
  const auth = await requireEditor();
  const id = str(formData.get("contractId"));
  const contract = await prisma.contract.findUniqueOrThrow({ where: { id } });

  await prisma.contract.update({
    where: { id },
    data: {
      title: str(formData.get("title")) || contract.title,
      reference: strOrNull(formData.get("reference")),
      startDate: parseDateOrNull(formData.get("startDate")) ?? contract.startDate,
      endDate: parseDateOrNull(formData.get("endDate")) ?? contract.endDate,
      renewalNoticeDays:
        parseIntOrNull(formData.get("renewalNoticeDays")) ??
        contract.renewalNoticeDays,
      value: parseIntOrNull(formData.get("value")),
      status: str(formData.get("status")) || contract.status,
      notes: strOrNull(formData.get("notes")),
    },
  });

  await logActivity({
    workspaceId: auth.workspace.id,
    projectId: contract.projectId,
    entityType: "CONTRACT",
    entityId: id,
    actorId: auth.user.id,
    action: `updated contract “${contract.title}”`,
  });

  revalidateAll();
  redirect(`/contracts/${id}`);
}

export async function addKeyDate(formData: FormData) {
  const auth = await requireEditor();
  const contractId = str(formData.get("contractId"));
  const title = str(formData.get("title"));
  const date = parseDateOrNull(formData.get("date"));
  if (!title || !date) redirect(`/contracts/${contractId}`);

  await prisma.contractKeyDate.create({
    data: { contractId, title, date },
  });

  await logActivity({
    workspaceId: auth.workspace.id,
    entityType: "CONTRACT",
    entityId: contractId,
    actorId: auth.user.id,
    action: `added key date “${title}”`,
  });

  revalidateAll();
  redirect(`/contracts/${contractId}`);
}

export async function toggleKeyDate(formData: FormData) {
  const auth = await requireEditor();
  const id = str(formData.get("keyDateId"));
  const kd = await prisma.contractKeyDate.findUniqueOrThrow({ where: { id } });
  await prisma.contractKeyDate.update({
    where: { id },
    data: { done: !kd.done },
  });

  await logActivity({
    workspaceId: auth.workspace.id,
    entityType: "CONTRACT",
    entityId: kd.contractId,
    actorId: auth.user.id,
    action: `${kd.done ? "reopened" : "completed"} key date “${kd.title}”`,
  });

  revalidateAll();
  redirect(`/contracts/${kd.contractId}`);
}

export async function deleteKeyDate(formData: FormData) {
  const auth = await requireEditor();
  const id = str(formData.get("keyDateId"));
  const kd = await prisma.contractKeyDate.findUniqueOrThrow({ where: { id } });
  await prisma.contractKeyDate.delete({ where: { id } });

  await logActivity({
    workspaceId: auth.workspace.id,
    entityType: "CONTRACT",
    entityId: kd.contractId,
    actorId: auth.user.id,
    action: `removed key date “${kd.title}”`,
  });

  revalidateAll();
  redirect(`/contracts/${kd.contractId}`);
}
