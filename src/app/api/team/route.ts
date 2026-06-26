import { NextResponse } from "next/server"
import { requireAuth, AuthError } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const user = await requireAuth()

    let users
    if (user.role === "ADMIN") {
      users = await prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
        orderBy: { name: "asc" },
      })
    } else {
      const projectIds = await prisma.projectMember
        .findMany({ where: { userId: user.id }, select: { projectId: true } })
        .then((m) => m.map((x) => x.projectId))

      const userIds = await prisma.projectMember
        .findMany({ where: { projectId: { in: projectIds } }, select: { userId: true } })
        .then((m) => [...new Set(m.map((x) => x.userId))])

      users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
        orderBy: { name: "asc" },
      })
    }

    return NextResponse.json({ users })
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
