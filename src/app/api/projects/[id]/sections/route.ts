import { NextResponse } from "next/server"
import { requireAuth, AuthError } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CreateSectionSchema } from "@/lib/validations"
import { ZodError } from "zod"

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const isMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId: user.id } },
    })
    if (!isMember && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const sections = await prisma.section.findMany({
      where: { projectId: id },
      orderBy: { order: "asc" },
    })
    return NextResponse.json({ sections })
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
    const data = CreateSectionSchema.parse(body)

    const isMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId: user.id } },
    })
    if (!isMember && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const maxOrder = await prisma.section.findFirst({
      where: { projectId: id },
      orderBy: { order: "desc" },
      select: { order: true },
    })

    const section = await prisma.section.create({
      data: {
        name: data.name,
        projectId: id,
        order: data.order ?? (maxOrder?.order ?? 0) + 1,
      },
    })
    return NextResponse.json({ section }, { status: 201 })
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (e instanceof ZodError) return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
