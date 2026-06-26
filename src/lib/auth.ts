import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import type { SessionUser } from "./types"

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "fallback-secret-change-in-production-32chars"
)

export const SESSION_COOKIE = "productive_session"
export const SESSION_EXPIRY_DAYS = 7

export async function signJwt(payload: SessionUser): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_EXPIRY_DAYS}d`)
    .sign(SECRET)
}

export async function verifyJwt(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as SessionUser
  } catch {
    return null
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE)?.value
    if (!token) return null
    return verifyJwt(token)
  } catch {
    return null
  }
}

export class AuthError extends Error {
  constructor(message = "Unauthorized") {
    super(message)
    this.name = "AuthError"
  }
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new AuthError()
  return user
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireAuth()
  if (user.role !== "ADMIN") throw new AuthError("Forbidden")
  return user
}
