"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireEditor } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { str, strOrNull } from "@/lib/format";

function revalidateAll() {
  revalidatePath("/", "layout");
}

// §6 redline: all Members edit all supplier records — shared asset,
// edit-anxiety handled by the activity log, not locks.

export async function createSupplier(formData: FormData) {
  const auth = await requireEditor();
  const name = str(formData.get("name"));
  if (!name) redirect("/suppliers?error=Supplier+name+is+required");

  const categoryIds = formData.getAll("categoryIds").map(String).filter(Boolean);

  const supplier = await prisma.supplier.create({
    data: {
      workspaceId: auth.workspace.id,
      name,
      tier: str(formData.get("tier")) || "TRANSACTIONAL",
      status: str(formData.get("status")) || "PROSPECTIVE",
      ownerId: strOrNull(formData.get("ownerId")),
      notes: strOrNull(formData.get("notes")),
      categories: {
        create: categoryIds.map((categoryId) => ({ categoryId })),
      },
    },
  });

  await logActivity({
    workspaceId: auth.workspace.id,
    entityType: "SUPPLIER",
    entityId: supplier.id,
    actorId: auth.user.id,
    action: `created supplier “${name}”`,
  });

  revalidateAll();
  redirect(`/suppliers/${supplier.id}`);
}

export async function updateSupplier(formData: FormData) {
  const auth = await requireEditor();
  const id = str(formData.get("supplierId"));
  const supplier = await prisma.supplier.findUniqueOrThrow({ where: { id } });

  const categoryIds = formData.getAll("categoryIds").map(String).filter(Boolean);

  await prisma.supplier.update({
    where: { id },
    data: {
      name: str(formData.get("name")) || supplier.name,
      tier: str(formData.get("tier")) || supplier.tier,
      status: str(formData.get("status")) || supplier.status,
      ownerId: strOrNull(formData.get("ownerId")),
      notes: strOrNull(formData.get("notes")),
      riskFlagged: formData.get("riskFlagged") === "on",
      riskNote: strOrNull(formData.get("riskNote")),
      categories: {
        deleteMany: {},
        create: categoryIds.map((categoryId) => ({ categoryId })),
      },
    },
  });

  await logActivity({
    workspaceId: auth.workspace.id,
    entityType: "SUPPLIER",
    entityId: id,
    actorId: auth.user.id,
    action: `updated supplier “${supplier.name}”`,
  });

  revalidateAll();
  redirect(`/suppliers/${id}`);
}

export async function addSupplierContact(formData: FormData) {
  const auth = await requireEditor();
  const supplierId = str(formData.get("supplierId"));
  const name = str(formData.get("name"));
  if (!name) redirect(`/suppliers/${supplierId}`);

  await prisma.supplierContact.create({
    data: {
      supplierId,
      name,
      email: strOrNull(formData.get("email")),
      phone: strOrNull(formData.get("phone")),
      role: strOrNull(formData.get("role")),
    },
  });

  await logActivity({
    workspaceId: auth.workspace.id,
    entityType: "SUPPLIER",
    entityId: supplierId,
    actorId: auth.user.id,
    action: `added contact “${name}”`,
  });

  revalidateAll();
  redirect(`/suppliers/${supplierId}`);
}

export async function removeSupplierContact(formData: FormData) {
  const auth = await requireEditor();
  const id = str(formData.get("contactId"));
  const contact = await prisma.supplierContact.findUniqueOrThrow({
    where: { id },
  });
  await prisma.supplierContact.delete({ where: { id } });

  await logActivity({
    workspaceId: auth.workspace.id,
    entityType: "SUPPLIER",
    entityId: contact.supplierId,
    actorId: auth.user.id,
    action: `removed contact “${contact.name}”`,
  });

  revalidateAll();
  redirect(`/suppliers/${contact.supplierId}`);
}
