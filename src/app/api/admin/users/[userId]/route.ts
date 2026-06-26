import { NextResponse } from "next/server"
import { requireAdmin, AuthError } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z, ZodError } from "zod"

const UpdateUserSchema = z.object({
  isActive: z.boolean().optional(),
  name: z.string().min(1).max(100).optional(),
  role: z.enum(["ADMIN", "MEMBER"]).optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    await requireAdmin()
    const { userId } = await params
    const body = await req.json()
    const data = UpdateUserSchema.parse(body)

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, name: true, email: true, role: true, isActive: true },
    })
    return NextResponse.json({ user })
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (e instanceof ZodError) return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const admin = await requireAdmin()
    const { userId } = await params

    if (userId === admin.id) {
      return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 })
    }

    await prisma.user.delete({ where: { id: userId } })
    return NextResponse.json({ message: "User deleted" })
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
