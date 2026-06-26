"use client"

import { useState, useEffect } from "react"
import { useCurrentUser } from "@/context/user-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { getInitials } from "@/lib/utils"

export default function SettingsPage() {
  const { user, refresh } = useCurrentUser()
  const [name, setName] = useState(user?.name ?? "")
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => { if (user) setName(user.name) }, [user])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setMessage("")
    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
    if (res.ok) { setMessage("Profile updated successfully"); refresh() }
    else { setMessage("Failed to update profile") }
    setIsSaving(false)
    setTimeout(() => setMessage(""), 3000)
  }

  if (!user) return null

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Settings</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-xl">{getInitials(user.name)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-lg font-semibold text-gray-900">{user.name}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
            <Badge variant={user.role === "ADMIN" ? "default" : "secondary"} className="mt-1">{user.role}</Badge>
          </div>
        </div>
        <hr className="border-gray-100" />
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Display name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Email address</Label>
            <Input value={user.email} readOnly className="bg-gray-50 cursor-not-allowed" />
            <p className="text-xs text-gray-400">Email cannot be changed. Contact your admin.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Input value={user.role} readOnly className="bg-gray-50 cursor-not-allowed" />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={isSaving || name === user.name}>{isSaving ? "Saving..." : "Save changes"}</Button>
            {message && <span className={`text-sm ${message.includes("success") ? "text-green-600" : "text-red-600"}`}>{message}</span>}
          </div>
        </form>
      </div>
    </div>
  )
}
