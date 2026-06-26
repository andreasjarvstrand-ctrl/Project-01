import { NextResponse } from "next/server"
import { requireAuth, AuthError } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CreateTaskSchema } from "@/lib/validations"
import { ZodError } from "zod"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const url = new URL(req.url)
    const sectionId = url.searchParams.get("sectionId")

    const isMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId: user.id } },
    })
    if (!isMember && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const tasks = await prisma.task.findMany({
      where: { projectId: id, ...(sectionId ? { sectionId } : {}) },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        section: { select: { id: true, name: true } },
        _count: { select: { comments: true } },
      },
      orderBy: [{ sectionId: "asc" }, { order: "asc" }],
    })
    return NextResponse.json({ tasks })
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const body = await req.json()
    const data = CreateTaskSchema.parse(body)

    const isMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId: user.id } },
    })
    if (!isMember && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const maxOrder = await prisma.task.findFirst({
      where: { projectId: id, sectionId: data.sectionId ?? null },
      orderBy: { order: "desc" },
      select: { order: true },
    })

    const task = await prisma.task.create({
      data: {
        title: data.title,
        description: data.description,
        projectId: id,
        sectionId: data.sectionId ?? null,
        assigneeId: data.assigneeId ?? null,
        priority: data.priority,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        order: (maxOrder?.order ?? 0) + 1,
        createdById: user.id,
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        section: { select: { id: true, name: true } },
        _count: { select: { comments: true } },
      },
    })
    return NextResponse.json({ task }, { status: 201 })
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (e instanceof ZodError) return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
