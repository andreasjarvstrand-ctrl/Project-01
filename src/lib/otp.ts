import { randomInt } from "crypto"
import { prisma } from "./prisma"
import { OTP_EXPIRY_MINUTES } from "./constants"

export function generateOtp(): string {
  return randomInt(100000, 999999).toString()
}

export async function createOtpRecord(email: string): Promise<string> {
  await prisma.otpCode.updateMany({
    where: { email, used: false },
    data: { used: true },
  })

  const code = generateOtp()
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)

  await prisma.otpCode.create({
    data: { email, code, expiresAt },
  })

  return code
}

export async function verifyOtpCode(email: string, code: string): Promise<boolean> {
  const otp = await prisma.otpCode.findFirst({
    where: {
      email,
      code,
      used: false,
      expiresAt: { gt: new Date() },
    },
  })

  if (!otp) return false

  await prisma.otpCode.update({
    where: { id: otp.id },
    data: { used: true },
  })

  return true
}
