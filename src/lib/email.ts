import nodemailer from "nodemailer"

async function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })
}

/** Returns true if email was sent via SMTP, false if falling back to console/dev mode. */
export async function sendOtpEmail(email: string, code: string): Promise<boolean> {
  const transporter = await getTransporter()

  if (!transporter) {
    console.log(`\n========================================`)
    console.log(`OTP for ${email}: ${code}`)
    console.log(`(Configure SMTP env vars to send real emails)`)
    console.log(`========================================\n`)
    return false
  }

  const from = process.env.SMTP_FROM ?? "noreply@productive-clone.com"

  await transporter.sendMail({
    from,
    to: email,
    subject: "Your login code for Productive",
    text: `Your login code is: ${code}\n\nThis code expires in 10 minutes.`,
    html: `
      <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #111; margin-bottom: 8px;">Your login code</h2>
        <p style="color: #666; margin-bottom: 24px;">Enter this code to sign in to Productive.</p>
        <div style="background: #f4f4f5; border-radius: 8px; padding: 24px; text-align: center; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #111;">
          ${code}
        </div>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
      </div>
    `,
  })

  return true
}
