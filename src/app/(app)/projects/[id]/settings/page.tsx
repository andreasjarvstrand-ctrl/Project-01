"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Trash2, Plus, X } from "lucide-react"
import { ProjectHeader } from "@/components/projects/project-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PROJECT_COLORS } from "@/lib/constants"
import { getInitials } from "@/lib/utils"

interface Member {
  userId: string
  role: string
  user: { id: string; name: string; email: string; role: string }
}

interface Project {
  id: string
  name: string
  description?: string | null
  color: string
  status: string
  members: Member[]
}

interface TeamUser {
  id: string
  name: string
  email: string
}

export default function ProjectSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const [project, setProject] = useState<Project | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [color, setColor] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState("")
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([])
  const [selectedUserId, setSelectedUserId] = useState("")

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}`)
    const data = await res.json()
    setProject(data.project)
    setName(data.project?.name ?? "")
    setDescription(data.project?.description ?? "")
    setColor(data.project?.color ?? "#6366f1")
  }, [projectId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: description || null, color }),
    })
    if (res.ok) {
      setSaveMsg("Saved!")
      fetchData()
    }
    setIsSaving(false)
    setTimeout(() => setSaveMsg(""), 2000)
  }

  const handleRemoveMember = async (userId: string) => {
    if (!confirm("Remove this member from the project?")) return
    await fetch(`/api/projects/${projectId}/members/${userId}`, { method: "DELETE" })
    fetchData()
  }

  const handleAddMember = async () => {
    if (!selectedUserId) return
    await fetch(`/api/projects/${projectId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedUserId, role: "MEMBER" }),
    })
    setAddMemberOpen(false)
    setSelectedUserId("")
    fetchData()
  }

  const handleOpenAddMember = async () => {
    const res = await fetch("/api/team")
    const data = await res.json()
    setTeamUsers(data.users ?? [])
    setAddMemberOpen(true)
  }

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this project? This action cannot be undone.")) return
    const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" })
    if (res.ok) router.push("/projects")
  }

  const handleArchive = async () => {
    const newStatus = project?.status === "ARCHIVED" ? "ACTIVE" : "ARCHIVED"
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
    fetchData()
  }

  if (!project) return null

  const memberUserIds = new Set(project.members.map((m) => m.userId))
  const availableUsers = teamUsers.filter((u) => !memberUserIds.has(u.id))

  return (
    <div className="flex flex-col h-full">
      <ProjectHeader
        projectId={project.id}
        projectName={project.name}
        projectColor={project.color}
        members={project.members}
      />

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* General */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">General</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Project name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </div>
              <div className="space-y-1.5">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {PROJECT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                      style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : "none" }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button type="submit" size="sm" disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save changes"}
                </Button>
                {saveMsg && <span className="text-sm text-green-600">{saveMsg}</span>}
              </div>
            </form>
          </div>

          {/* Members */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Members</h2>
              <Button size="sm" variant="outline" onClick={handleOpenAddMember}>
                <Plus className="w-3.5 h-3.5" /> Add member
              </Button>
            </div>
            <div className="space-y-3">
              {project.members.map((m) => (
                <div key={m.userId} className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">{getInitials(m.user.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{m.user.name}</p>
                    <p className="text-xs text-gray-500">{m.user.email}</p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">{m.role}</Badge>
                  {m.role !== "OWNER" && (
                    <button
                      onClick={() => handleRemoveMember(m.userId)}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Danger zone */}
          <div className="bg-white rounded-xl border border-red-200 p-6">
            <h2 className="text-base font-semibold text-red-600 mb-4">Danger Zone</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{project.status === "ARCHIVED" ? "Unarchive" : "Archive"} project</p>
                  <p className="text-xs text-gray-500">
                    {project.status === "ARCHIVED" ? "Make this project active again." : "Archive this project to hide it from the main list."}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={handleArchive}>
                  {project.status === "ARCHIVED" ? "Unarchive" : "Archive"}
                </Button>
              </div>
              <div className="border-t border-red-100 pt-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-600">Delete project</p>
                  <p className="text-xs text-gray-500">Permanently delete this project and all its data.</p>
                </div>
                <Button size="sm" variant="destructive" onClick={handleDelete}>
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add member</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a user..." />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </SelectItem>
                ))}
                {availableUsers.length === 0 && (
                  <div className="px-2 py-4 text-sm text-gray-400 text-center">All team members are already in this project</div>
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMemberOpen(false)}>Cancel</Button>
            <Button onClick={handleAddMember} disabled={!selectedUserId}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
