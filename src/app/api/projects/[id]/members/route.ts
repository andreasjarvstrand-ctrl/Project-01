import { NextResponse } from "next/server"
import { requireAuth, AuthError } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AddProjectMemberSchema } from "@/lib/validations"
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

    const members = await prisma.projectMember.findMany({
      where: { projectId: id },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    })
    return NextResponse.json({ members })
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
    const data = AddProjectMemberSchema.parse(body)

    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId: user.id } },
    })
    if ((!member || member.role !== "OWNER") && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const newMember = await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: id, userId: data.userId } },
      create: { projectId: id, userId: data.userId, role: data.role },
      update: { role: data.role },
      include: { user: { select: { id: true, name: true, email: true } } },
    })
    return NextResponse.json({ member: newMember }, { status: 201 })
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (e instanceof ZodError) return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
