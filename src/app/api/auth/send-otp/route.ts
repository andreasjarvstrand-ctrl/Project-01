import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createOtpRecord } from "@/lib/otp"
import { sendOtpEmail } from "@/lib/email"
import { LoginEmailSchema } from "@/lib/validations"
import { ZodError } from "zod"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email } = LoginEmailSchema.parse(body)

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ error: "No account found with this email address." }, { status: 404 })
    }
    if (!user.isActive) {
      return NextResponse.json({ error: "Your account has been deactivated." }, { status: 403 })
    }

    const code = await createOtpRecord(email)
    const emailSent = await sendOtpEmail(email, code)

    const isDev = process.env.NODE_ENV === "development"
    return NextResponse.json({
      message: "Verification code sent",
      ...(isDev && !emailSent ? { devCode: code } : {}),
    })
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 400 })
    }
    console.error("send-otp error:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
