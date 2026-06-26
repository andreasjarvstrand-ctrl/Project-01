import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyOtpCode } from "@/lib/otp"
import { signJwt, SESSION_COOKIE, SESSION_EXPIRY_DAYS } from "@/lib/auth"
import { VerifyOtpSchema } from "@/lib/validations"
import { ZodError } from "zod"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email, code } = VerifyOtpSchema.parse(body)

    const valid = await verifyOtpCode(email, code)
    if (!valid) {
      return NextResponse.json({ error: "Invalid or expired code. Please try again." }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.isActive) {
      return NextResponse.json({ error: "Account not found or deactivated." }, { status: 403 })
    }

    const sessionUser = { id: user.id, email: user.email, name: user.name, role: user.role as "ADMIN" | "MEMBER" }
    const token = await signJwt(sessionUser)

    const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
    await prisma.session.create({ data: { userId: user.id, token, expiresAt } })

    const response = NextResponse.json({ user: sessionUser })
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    })

    return response
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 400 })
    }
    console.error("verify-otp error:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
