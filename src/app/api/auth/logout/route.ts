import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { SESSION_COOKIE } from "@/lib/auth"

export async function POST() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE)?.value

    if (token) {
      await prisma.session.deleteMany({ where: { token } }).catch(() => {})
    }

    const response = NextResponse.json({ message: "Logged out" })
    response.cookies.delete(SESSION_COOKIE)
    return response
  } catch {
    return NextResponse.json({ message: "Logged out" })
  }
}
