"use server";

import { randomBytes, randomInt } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, SESSION_DAYS } from "@/lib/auth";
import { str } from "@/lib/format";

const OTP_MINUTES = 10;

export async function requestOtp(formData: FormData) {
  const email = str(formData.get("email")).toLowerCase();
  if (!email) redirect("/login?error=Enter+your+email+address");

  const user = await prisma.user.findUnique({ where: { email } });
  // Do not reveal whether the account exists; only create a code when it does.
  if (user) {
    const code = String(randomInt(100000, 1000000));
    await prisma.otpCode.create({
      data: {
        email,
        code,
        expiresAt: new Date(Date.now() + OTP_MINUTES * 60 * 1000),
      },
    });
    // Dev mode: no mailer configured — the code is printed to the server
    // console (see README).
    console.log(`[OTP] Login code for ${email}: ${code}`);
  }
  redirect(`/login?email=${encodeURIComponent(email)}`);
}

export async function verifyOtp(formData: FormData) {
  const email = str(formData.get("email")).toLowerCase();
  const code = str(formData.get("code"));

  const otp = await prisma.otpCode.findFirst({
    where: { email, code, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) {
    redirect(
      `/login?email=${encodeURIComponent(email)}&error=Invalid+or+expired+code`
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    redirect(`/login?error=No+account+for+that+email`);
  }

  await prisma.otpCode.update({
    where: { id: otp.id },
    data: { usedAt: new Date() },
  });

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: { token, userId: user.id, expiresAt },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
  redirect("/");
}

export async function logout() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
    store.delete(SESSION_COOKIE);
  }
  redirect("/login");
}
