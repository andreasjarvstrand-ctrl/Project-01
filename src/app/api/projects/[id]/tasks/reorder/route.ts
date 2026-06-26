import { NextResponse } from "next/server"
import { requireAuth, AuthError } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ReorderTaskSchema } from "@/lib/validations"
import { ZodError } from "zod"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const body = await req.json()
    const data = ReorderTaskSchema.parse(body)

    const isMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId: user.id } },
    })
    if (!isMember && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: data.taskId },
        data: { sectionId: data.destinationSectionId, order: data.newOrder },
      })

      const sourceTasks = await tx.task.findMany({
        where: { projectId: id, sectionId: data.sourceSectionId, id: { not: data.taskId } },
        orderBy: { order: "asc" },
        select: { id: true },
      })
      for (let i = 0; i < sourceTasks.length; i++) {
        await tx.task.update({ where: { id: sourceTasks[i].id }, data: { order: i } })
      }

      if (data.destinationSectionId !== data.sourceSectionId) {
        const destTasks = await tx.task.findMany({
          where: {
            projectId: id,
            sectionId: data.destinationSectionId,
            id: { not: data.taskId },
            order: { gte: data.newOrder },
          },
          orderBy: { order: "asc" },
          select: { id: true, order: true },
        })
        for (const t of destTasks) {
          await tx.task.update({ where: { id: t.id }, data: { order: t.order + 1 } })
        }
      }
    })

    return NextResponse.json({ message: "Reordered" })
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (e instanceof ZodError) return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
