import { NextResponse } from "next/server"
import { requireAuth, AuthError } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { ZodError } from "zod"

const UpdateSectionSchema = z.object({ name: z.string().min(1).max(100) })

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  try {
    const user = await requireAuth()
    const { sectionId } = await params
    const body = await req.json()
    const data = UpdateSectionSchema.parse(body)

    const section = await prisma.section.findUnique({ where: { id: sectionId } })
    if (!section) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const isMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: section.projectId, userId: user.id } },
    })
    if (!isMember && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const updated = await prisma.section.update({ where: { id: sectionId }, data: { name: data.name } })
    return NextResponse.json({ section: updated })
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (e instanceof ZodError) return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  try {
    const user = await requireAuth()
    const { sectionId } = await params

    const section = await prisma.section.findUnique({ where: { id: sectionId } })
    if (!section) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const isMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: section.projectId, userId: user.id } },
    })
    if (!isMember && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await prisma.task.updateMany({ where: { sectionId }, data: { sectionId: null } })
    await prisma.section.delete({ where: { id: sectionId } })
    return NextResponse.json({ message: "Section deleted" })
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
