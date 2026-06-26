import { NextResponse } from "next/server"
import { requireAuth, AuthError } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UpdateTaskSchema } from "@/lib/validations"
import { ZodError } from "zod"

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const user = await requireAuth()
    const { id, taskId } = await params

    const isMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId: user.id } },
    })
    if (!isMember && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        section: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        comments: {
          include: { author: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    })
    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ task })
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const user = await requireAuth()
    const { id, taskId } = await params
    const body = await req.json()
    const data = UpdateTaskSchema.parse(body)

    const isMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId: user.id } },
    })
    if (!isMember && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : data.dueDate,
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        section: { select: { id: true, name: true } },
        _count: { select: { comments: true } },
      },
    })
    return NextResponse.json({ task })
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (e instanceof ZodError) return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const user = await requireAuth()
    const { id, taskId } = await params

    const isMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId: user.id } },
    })
    if (!isMember && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await prisma.task.delete({ where: { id: taskId } })
    return NextResponse.json({ message: "Task deleted" })
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
