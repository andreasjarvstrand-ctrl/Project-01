import { NextResponse } from "next/server"
import { requireAuth, AuthError } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CreateProjectSchema } from "@/lib/validations"
import { DEFAULT_SECTIONS } from "@/lib/constants"
import { ZodError } from "zod"

export async function GET() {
  try {
    const user = await requireAuth()

    const memberships = await prisma.projectMember.findMany({
      where: { userId: user.id },
      include: {
        project: {
          include: {
            members: { include: { user: { select: { id: true, name: true, email: true } } } },
            _count: { select: { tasks: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    const projects = memberships.map((m) => m.project)
    return NextResponse.json({ projects })
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const data = CreateProjectSchema.parse(body)

    const project = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          name: data.name,
          description: data.description,
          color: data.color ?? "#6366f1",
          createdById: user.id,
        },
      })

      await tx.projectMember.create({
        data: { projectId: project.id, userId: user.id, role: "OWNER" },
      })

      const sections = DEFAULT_SECTIONS.map((name, order) => ({ name, projectId: project.id, order }))
      await tx.section.createMany({ data: sections })

      return project
    })

    return NextResponse.json({ project }, { status: 201 })
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (e instanceof ZodError) return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
