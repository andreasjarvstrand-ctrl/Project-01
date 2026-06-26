import { NextResponse } from "next/server"
import { requireAuth, AuthError } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CreateCommentSchema } from "@/lib/validations"
import { ZodError } from "zod"

export async function GET(_: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const user = await requireAuth()
    const { taskId } = await params

    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { projectId: true } })
    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const isMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: task.projectId, userId: user.id } },
    })
    if (!isMember && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const comments = await prisma.comment.findMany({
      where: { taskId },
      include: { author: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    })
    return NextResponse.json({ comments })
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const user = await requireAuth()
    const { taskId } = await params
    const body = await req.json()
    const data = CreateCommentSchema.parse(body)

    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { projectId: true } })
    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const isMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: task.projectId, userId: user.id } },
    })
    if (!isMember && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const comment = await prisma.comment.create({
      data: { content: data.content, taskId, authorId: user.id },
      include: { author: { select: { id: true, name: true, email: true } } },
    })
    return NextResponse.json({ comment }, { status: 201 })
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (e instanceof ZodError) return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
