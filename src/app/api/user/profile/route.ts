import { NextResponse } from "next/server"
import { requireAuth, AuthError } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UpdateProfileSchema } from "@/lib/validations"
import { ZodError } from "zod"

export async function GET() {
  try {
    const session = await requireAuth()
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    })
    return NextResponse.json({ user })
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireAuth()
    const body = await req.json()
    const data = UpdateProfileSchema.parse(body)

    const user = await prisma.user.update({
      where: { id: session.id },
      data: { name: data.name },
      select: { id: true, name: true, email: true, role: true },
    })
    return NextResponse.json({ user })
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (e instanceof ZodError) return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
