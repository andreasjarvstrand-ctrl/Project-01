"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { FolderKanban, Mail, ArrowRight, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Step = "email" | "otp"

export default function LoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("email")
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState(["", "", "", "", "", ""])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to send code")
      setStep("otp")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setIsLoading(false)
    }
  }

  const handleOtpChange = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(-1)
    const next = [...otp]
    next[index] = cleaned
    setOtp(next)
    if (cleaned && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
    if (pasted.length === 6) {
      setOtp(pasted.split(""))
      inputRefs.current[5]?.focus()
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = otp.join("")
    if (code.length !== 6) {
      setError("Please enter all 6 digits")
      return
    }
    setError("")
    setIsLoading(true)
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Invalid code")
      router.push("/dashboard")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setOtp(["", "", "", "", "", ""])
      inputRefs.current[0]?.focus()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="flex items-center justify-center gap-2 mb-8">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-600">
          <FolderKanban className="w-5 h-5 text-white" />
        </div>
        <span className="text-2xl font-bold text-gray-900">Productive</span>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        {step === "email" ? (
          <form onSubmit={handleEmailSubmit} className="space-y-5">
            <div className="text-center mb-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-indigo-50 mx-auto mb-3">
                <Mail className="w-6 h-6 text-indigo-600" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900">Sign in to Productive</h1>
              <p className="text-sm text-gray-500 mt-1">Enter your email to receive a login code</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Sending..." : (
                <>Send code <ArrowRight className="w-4 h-4" /></>
              )}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-5">
            <div className="text-center mb-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-indigo-50 mx-auto mb-3">
                <Mail className="w-6 h-6 text-indigo-600" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900">Check your email</h1>
              <p className="text-sm text-gray-500 mt-1">
                We sent a 6-digit code to <strong>{email}</strong>
              </p>
            </div>

            <div>
              <Label className="mb-3 block text-center">Enter verification code</Label>
              <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="w-11 h-12 text-center text-lg font-semibold rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    autoFocus={i === 0}
                  />
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-600 text-center">{error}</p>}

            <Button type="submit" className="w-full" disabled={isLoading || otp.join("").length !== 6}>
              {isLoading ? "Verifying..." : "Sign in"}
            </Button>

            <button
              type="button"
              onClick={() => { setStep("email"); setOtp(["", "", "", "", "", ""]); setError("") }}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mx-auto"
            >
              <RotateCcw className="w-3 h-3" /> Try a different email
            </button>
          </form>
        )}
      </div>

      <p className="text-center text-xs text-gray-400 mt-6">
        Access is by invitation only. Contact your administrator.
      </p>
    </div>
  )
}
