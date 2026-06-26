"use client"

import { useEffect, useState } from "react"
import { useCurrentUser } from "@/context/user-context"
import { useRouter } from "next/navigation"
import { Plus, Shield, ToggleLeft, ToggleRight, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getInitials, formatDate } from "@/lib/utils"

interface User {
  id: string; name: string; email: string; role: string; isActive: boolean; createdAt: string
}

export default function AdminUsersPage() {
  const { user: currentUser } = useCurrentUser()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newRole, setNewRole] = useState("MEMBER")
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState("")

  useEffect(() => {
    if (currentUser && currentUser.role !== "ADMIN") router.push("/dashboard")
  }, [currentUser, router])

  const fetchUsers = async () => {
    const res = await fetch("/api/admin/users")
    const data = await res.json()
    setUsers(data.users ?? [])
    setIsLoading(false)
  }

  useEffect(() => { fetchUsers() }, [])

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    await fetch(`/api/admin/users/${userId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !isActive }) })
    fetchUsers()
  }

  const handleDelete = async (userId: string, userName: string) => {
    if (!confirm(`Delete user "${userName}"? This cannot be undone.`)) return
    await fetch(`/api/admin/users/${userId}`, { method: "DELETE" })
    fetchUsers()
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError("")
    setCreating(true)
    const res = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName, email: newEmail, role: newRole }) })
    const data = await res.json()
    if (!res.ok) { setCreateError(data.error ?? "Failed to create user") }
    else { setCreateOpen(false); setNewName(""); setNewEmail(""); setNewRole("MEMBER"); fetchUsers() }
    setCreating(false)
  }

  if (currentUser?.role !== "ADMIN") return null

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-5 h-5 text-indigo-600" />
            <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          </div>
          <p className="text-gray-500">{users.length} user{users.length !== 1 ? "s" : ""} in the system</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" /> Create User</Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-6 py-3 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
            <div className="w-8" /><div>User</div><div>Role</div><div>Status</div><div>Joined</div><div>Actions</div>
          </div>
          <div className="divide-y divide-gray-100">
            {users.map((u) => (
              <div key={u.id} className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 items-center px-6 py-4">
                <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{getInitials(u.name)}</AvatarFallback></Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{u.name}</p>
                    {u.id === currentUser?.id && <span className="text-xs text-indigo-600 font-medium">(you)</span>}
                  </div>
                  <p className="text-xs text-gray-500">{u.email}</p>
                </div>
                <Badge variant={u.role === "ADMIN" ? "default" : "secondary"} className="text-xs">{u.role}</Badge>
                <Badge className={`text-xs ${u.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`} variant="secondary">{u.isActive ? "Active" : "Inactive"}</Badge>
                <span className="text-xs text-gray-400">{formatDate(u.createdAt)}</span>
                <div className="flex items-center gap-1">
                  {u.id !== currentUser?.id && (
                    <>
                      <button onClick={() => handleToggleActive(u.id, u.isActive)} className={`p-1.5 rounded-md transition-colors ${u.isActive ? "text-green-600 hover:bg-green-50" : "text-gray-400 hover:bg-gray-50"}`} title={u.isActive ? "Deactivate" : "Activate"}>
                        {u.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      </button>
                      <button onClick={() => handleDelete(u.id, u.name)} className="p-1.5 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete user"><Trash2 className="w-4 h-4" /></button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Create New User</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-name">Full name *</Label>
              <Input id="new-name" placeholder="John Smith" value={newName} onChange={(e) => setNewName(e.target.value)} required autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-email">Email address *</Label>
              <Input id="new-email" type="email" placeholder="john@company.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEMBER">Member</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {createError && <p className="text-sm text-red-600">{createError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={!newName.trim() || !newEmail.trim() || creating}>{creating ? "Creating..." : "Create User"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
