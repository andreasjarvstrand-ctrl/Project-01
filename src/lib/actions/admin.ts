"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ROLES } from "@/lib/domain";
import { parseIntOrNull, str, strOrNull } from "@/lib/format";

function revalidateAll() {
  revalidatePath("/", "layout");
}

export async function addCategory(formData: FormData) {
  const auth = await requireAdmin();
  const name = str(formData.get("name"));
  if (!name) redirect("/settings");

  await prisma.category.create({
    data: {
      workspaceId: auth.workspace.id,
      name,
      color: str(formData.get("color")) || "#2a78d6",
    },
  });

  await logActivity({
    workspaceId: auth.workspace.id,
    entityType: "WORKSPACE",
    entityId: auth.workspace.id,
    actorId: auth.user.id,
    action: `added category “${name}”`,
  });

  revalidateAll();
  redirect("/settings");
}

export async function deleteCategory(formData: FormData) {
  const auth = await requireAdmin();
  const id = str(formData.get("categoryId"));
  const inUse = await prisma.project.count({ where: { categoryId: id } });
  if (inUse > 0) {
    redirect("/settings?error=Category+is+in+use+by+projects+and+cannot+be+deleted");
  }
  await prisma.category.delete({ where: { id } });
  revalidateAll();
  redirect("/settings");
}

export async function inviteUser(formData: FormData) {
  const auth = await requireAdmin();
  const email = str(formData.get("email")).toLowerCase();
  const name = str(formData.get("name"));
  const role = str(formData.get("role"));
  if (!email || !name || !ROLES.includes(role as (typeof ROLES)[number])) {
    redirect("/settings?error=Name,+email+and+role+are+required");
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name },
  });
  await prisma.membership.upsert({
    where: {
      workspaceId_userId: { workspaceId: auth.workspace.id, userId: user.id },
    },
    update: { role },
    create: { workspaceId: auth.workspace.id, userId: user.id, role },
  });

  await logActivity({
    workspaceId: auth.workspace.id,
    entityType: "WORKSPACE",
    entityId: auth.workspace.id,
    actorId: auth.user.id,
    action: `invited ${name} as ${role.toLowerCase()}`,
  });

  revalidateAll();
  redirect("/settings");
}

// Server-authoritative action (redline D2): role changes apply immediately.
export async function setUserRole(formData: FormData) {
  const auth = await requireAdmin();
  const membershipId = str(formData.get("membershipId"));
  const role = str(formData.get("role"));
  if (!ROLES.includes(role as (typeof ROLES)[number])) {
    throw new Error("Invalid role.");
  }

  const membership = await prisma.membership.findUniqueOrThrow({
    where: { id: membershipId },
    include: { user: true },
  });

  // Never demote the last Admin.
  if (membership.role === "ADMIN" && role !== "ADMIN") {
    const adminCount = await prisma.membership.count({
      where: { workspaceId: auth.workspace.id, role: "ADMIN" },
    });
    if (adminCount <= 1) {
      redirect("/settings?error=Cannot+demote+the+last+Admin");
    }
  }

  await prisma.membership.update({
    where: { id: membershipId },
    data: { role },
  });

  await logActivity({
    workspaceId: auth.workspace.id,
    entityType: "WORKSPACE",
    entityId: auth.workspace.id,
    actorId: auth.user.id,
    action: `changed ${membership.user.name}’s role to ${role.toLowerCase()}`,
  });

  revalidateAll();
  redirect("/settings");
}

export async function updateWorkspaceSettings(formData: FormData) {
  const auth = await requireAdmin();

  await prisma.workspace.update({
    where: { id: auth.workspace.id },
    data: {
      name: str(formData.get("name")) || auth.workspace.name,
      currency: str(formData.get("currency")) || auth.workspace.currency,
      viewersCanComment: formData.get("viewersCanComment") === "on",
      membersCanCreateProjects:
        formData.get("membersCanCreateProjects") === "on",
    },
  });

  await logActivity({
    workspaceId: auth.workspace.id,
    entityType: "WORKSPACE",
    entityId: auth.workspace.id,
    actorId: auth.user.id,
    action: "updated workspace settings",
  });

  revalidateAll();
  redirect("/settings");
}

const MAX_CRITERIA = 10;

export async function createScorecardTemplate(formData: FormData) {
  const auth = await requireAdmin();
  const name = str(formData.get("name"));
  if (!name) redirect("/settings?error=Template+name+is+required");

  const criteria: {
    name: string;
    weight: number;
    isPassFail: boolean;
    order: number;
  }[] = [];
  for (let i = 0; i < MAX_CRITERIA; i++) {
    const critName = str(formData.get(`crit_name_${i}`));
    if (!critName) continue;
    const isPassFail = formData.get(`crit_pass_${i}`) === "on";
    criteria.push({
      name: critName,
      weight: isPassFail ? 0 : (parseIntOrNull(formData.get(`crit_weight_${i}`)) ?? 0),
      isPassFail,
      order: i,
    });
  }
  if (criteria.length === 0) {
    redirect("/settings?error=A+template+needs+at+least+one+criterion");
  }

  const weightSum = criteria
    .filter((c) => !c.isPassFail)
    .reduce((sum, c) => sum + c.weight, 0);
  if (weightSum !== 100) {
    redirect(
      `/settings?error=Weighted+criteria+must+sum+to+100+(currently+${weightSum})`
    );
  }

  await prisma.scorecardTemplate.create({
    data: {
      workspaceId: auth.workspace.id,
      name,
      kind: str(formData.get("kind")) || "SELECTION",
      criteria: { create: criteria },
    },
  });

  await logActivity({
    workspaceId: auth.workspace.id,
    entityType: "WORKSPACE",
    entityId: auth.workspace.id,
    actorId: auth.user.id,
    action: `created scorecard template “${name}”`,
  });

  revalidateAll();
  redirect("/settings");
}

export async function deleteScorecardTemplate(formData: FormData) {
  const auth = await requireAdmin();
  const id = str(formData.get("templateId"));
  const inUse = await prisma.scoringRound.count({ where: { templateId: id } });
  if (inUse > 0) {
    redirect("/settings?error=Template+is+used+by+scoring+rounds+and+cannot+be+deleted");
  }
  await prisma.scorecardTemplate.delete({ where: { id } });

  await logActivity({
    workspaceId: auth.workspace.id,
    entityType: "WORKSPACE",
    entityId: auth.workspace.id,
    actorId: auth.user.id,
    action: "deleted a scorecard template",
  });

  revalidateAll();
  redirect("/settings");
}
