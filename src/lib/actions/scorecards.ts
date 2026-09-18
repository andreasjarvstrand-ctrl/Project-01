"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth, requireEditor } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { errRedirect, parseIntOrNull, str, strOrNull } from "@/lib/format";

function revalidateAll() {
  revalidatePath("/", "layout");
}

export async function createScoringRound(formData: FormData) {
  const auth = await requireEditor();
  const projectId = str(formData.get("projectId"));
  const templateId = str(formData.get("templateId"));
  const name = str(formData.get("name"));
  const evaluatorIds = formData.getAll("evaluatorIds").map(String).filter(Boolean);
  const supplierIds = formData.getAll("supplierIds").map(String).filter(Boolean);

  if (!templateId || !name || evaluatorIds.length === 0 || supplierIds.length === 0) {
    redirect(
      `/projects/${projectId}?tab=scorecards&error=A+round+needs+a+template,+a+name,+at+least+one+evaluator+and+one+supplier`
    );
  }

  const round = await prisma.scoringRound.create({
    data: {
      projectId,
      templateId,
      name,
      blind: formData.get("blind") === "on",
      evaluators: { create: evaluatorIds.map((userId) => ({ userId })) },
      suppliers: { create: supplierIds.map((supplierId) => ({ supplierId })) },
    },
  });

  await logActivity({
    workspaceId: auth.workspace.id,
    projectId,
    entityType: "SCORING_ROUND",
    entityId: round.id,
    actorId: auth.user.id,
    action: `opened scoring round “${name}”${round.blind ? " (blind)" : ""}`,
  });

  revalidateAll();
  redirect(`/projects/${projectId}?tab=scorecards&round=${round.id}`);
}

// Score entry: any designated evaluator, regardless of workspace role.
// Entries are private to the evaluator until the round is revealed (§5.5).
export async function submitScores(formData: FormData) {
  const auth = await requireAuth();
  const roundId = str(formData.get("roundId"));
  const supplierId = str(formData.get("supplierId"));

  const round = await prisma.scoringRound.findUniqueOrThrow({
    where: { id: roundId },
    include: {
      evaluators: true,
      template: { include: { criteria: true } },
      project: true,
    },
  });
  const evaluator = round.evaluators.find((e) => e.userId === auth.user.id);
  if (!evaluator) throw new Error("You are not an evaluator on this round.");
  if (round.status !== "OPEN") {
    throw new Error("This round has been revealed and is locked.");
  }

  for (const criterion of round.template.criteria) {
    const value = criterion.isPassFail
      ? null
      : parseIntOrNull(formData.get(`score_${criterion.id}`));
    const passed = criterion.isPassFail
      ? formData.get(`pass_${criterion.id}`) === "on"
      : null;
    const comment = strOrNull(formData.get(`comment_${criterion.id}`));
    if (value == null && passed == null && comment == null) continue;

    await prisma.score.upsert({
      where: {
        roundId_supplierId_criterionId_evaluatorId: {
          roundId,
          supplierId,
          criterionId: criterion.id,
          evaluatorId: auth.user.id,
        },
      },
      update: { value, passed, comment },
      create: {
        roundId,
        supplierId,
        criterionId: criterion.id,
        evaluatorId: auth.user.id,
        value,
        passed,
        comment,
      },
    });
  }

  await logActivity({
    workspaceId: auth.workspace.id,
    projectId: round.projectId,
    entityType: "SCORING_ROUND",
    entityId: roundId,
    actorId: auth.user.id,
    action: "entered scores",
  });

  revalidateAll();
  redirect(`/projects/${round.projectId}?tab=scorecards&round=${roundId}`);
}

export async function markScoresSubmitted(formData: FormData) {
  const auth = await requireAuth();
  const roundId = str(formData.get("roundId"));
  const round = await prisma.scoringRound.findUniqueOrThrow({
    where: { id: roundId },
    include: { evaluators: true },
  });
  const evaluator = round.evaluators.find((e) => e.userId === auth.user.id);
  if (!evaluator) throw new Error("You are not an evaluator on this round.");

  await prisma.roundEvaluator.update({
    where: { id: evaluator.id },
    data: { submittedAt: new Date() },
  });

  await logActivity({
    workspaceId: auth.workspace.id,
    projectId: round.projectId,
    entityType: "SCORING_ROUND",
    entityId: roundId,
    actorId: auth.user.id,
    action: "submitted their scores",
  });

  revalidateAll();
  redirect(`/projects/${round.projectId}?tab=scorecards&round=${roundId}`);
}

// Reveal is privileged and server-authoritative (redline D2): Admin or the
// project's creator only.
export async function revealRound(formData: FormData) {
  const auth = await requireAuth();
  const roundId = str(formData.get("roundId"));

  const round = await prisma.scoringRound.findUniqueOrThrow({
    where: { id: roundId },
    include: { project: true, evaluators: true },
  });
  const mayReveal =
    auth.role === "ADMIN" || round.project.createdById === auth.user.id;
  if (!mayReveal) {
    throw new Error("Only an Admin or the project owner can reveal a round.");
  }

  const unsubmitted = round.evaluators.filter((e) => !e.submittedAt);
  if (unsubmitted.length > 0 && formData.get("force") !== "on") {
    redirect(
      errRedirect(
        `/projects/${round.projectId}?tab=scorecards&round=${roundId}`,
        `${unsubmitted.length} evaluator(s) have not submitted — tick "reveal anyway" to override`
      )
    );
  }

  await prisma.scoringRound.update({
    where: { id: roundId },
    data: { status: "REVEALED", revealedAt: new Date() },
  });

  await logActivity({
    workspaceId: auth.workspace.id,
    projectId: round.projectId,
    entityType: "SCORING_ROUND",
    entityId: roundId,
    actorId: auth.user.id,
    action: `revealed scoring round “${round.name}”`,
  });

  revalidateAll();
  redirect(`/projects/${round.projectId}?tab=scorecards&round=${roundId}`);
}
