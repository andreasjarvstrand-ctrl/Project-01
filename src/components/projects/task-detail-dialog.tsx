"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { Calendar, User, Flag, Tag, Trash2, MessageSquare, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getStatusBg, getStatusLabel, getPriorityBg, getInitials, formatDate } from "@/lib/utils"
import { TASK_STATUSES, TASK_PRIORITIES } from "@/lib/constants"
import type { TaskStatus, TaskPriority } from "@/lib/types"

interface TaskDetailDialogProps {
  taskId: string | null
  projectId: string
  members: Array<{ userId: string; user: { id: string; name: string; email: string } }>
  onClose: () => void
  onUpdate: () => void
}

interface Task {
  id: string
  title: string
  description?: string | null
  status: string
  priority: string
  dueDate?: string | null
  assignee?: { id: string; name: string; email: string } | null
  section?: { id: string; name: string } | null
  createdBy: { id: string; name: string }
  createdAt: string
  comments: Array<{
    id: string
    content: string
    createdAt: string
    author: { id: string; name: string; email: string }
  }>
}

export function TaskDetailDialog({ taskId, projectId, members, onClose, onUpdate }: TaskDetailDialogProps) {
  const [task, setTask] = useState<Task | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [editTitle, setEditTitle] = useState(false)
  const [title, setTitle] = useState("")
  const [editDesc, setEditDesc] = useState(false)
  const [description, setDescription] = useState("")
  const [comment, setComment] = useState("")
  const [submittingComment, setSubmittingComment] = useState(false)

  useEffect(() => {
    if (!taskId) return
    setIsLoading(true)
    fetch(`/api/projects/${projectId}/tasks/${taskId}`)
      .then((r) => r.json())
      .then((d) => {
        setTask(d.task)
        setTitle(d.task?.title ?? "")
        setDescription(d.task?.description ?? "")
      })
      .finally(() => setIsLoading(false))
  }, [taskId, projectId])

  const updateTask = async (updates: Record<string, unknown>) => {
    if (!taskId) return
    const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
    const data = await res.json()
    if (res.ok) {
      setTask((prev) => prev ? { ...prev, ...data.task } : null)
      onUpdate()
    }
  }

  const handleDeleteTask = async () => {
    if (!taskId || !confirm("Delete this task?")) return
    await fetch(`/api/projects/${projectId}/tasks/${taskId}`, { method: "DELETE" })
    onClose()
    onUpdate()
  }

  const handleAddComment = async () => {
    if (!comment.trim() || !taskId) return
    setSubmittingComment(true)
    const res = await fetch(`/api/tasks/${taskId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: comment }),
    })
    if (res.ok) {
      const data = await res.json()
      setTask((prev) => prev ? { ...prev, comments: [...prev.comments, data.comment] } : null)
      setComment("")
    }
    setSubmittingComment(false)
  }

  return (
    <Dialog open={!!taskId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {isLoading || !task ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle asChild>
                <div>
                  {editTitle ? (
                    <input
                      className="w-full text-lg font-semibold border-b border-indigo-300 focus:outline-none pb-1"
                      value={title}
                      autoFocus
                      onChange={(e) => setTitle(e.target.value)}
                      onBlur={() => {
                        setEditTitle(false)
                        if (title.trim() && title !== task.title) {
                          updateTask({ title: title.trim() })
                        }
                      }}
                      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
                    />
                  ) : (
                    <h2
                      className="text-lg font-semibold cursor-pointer hover:text-indigo-600 transition-colors"
                      onClick={() => setEditTitle(true)}
                    >
                      {task.title}
                    </h2>
                  )}
                </div>
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-3 gap-6 mt-2">
              {/* Main content */}
              <div className="col-span-2 space-y-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1.5">Description</p>
                  {editDesc ? (
                    <Textarea
                      value={description}
                      autoFocus
                      onChange={(e) => setDescription(e.target.value)}
                      onBlur={() => {
                        setEditDesc(false)
                        if (description !== (task.description ?? "")) {
                          updateTask({ description: description || null })
                        }
                      }}
                      rows={4}
                      placeholder="Add a description..."
                    />
                  ) : (
                    <p
                      className={`text-sm cursor-pointer rounded p-2 hover:bg-gray-50 transition-colors min-h-[60px] ${!task.description ? "text-gray-400 italic" : "text-gray-700"}`}
                      onClick={() => setEditDesc(true)}
                    >
                      {task.description || "Click to add a description..."}
                    </p>
                  )}
                </div>

                {/* Comments */}
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-3 flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Comments ({task.comments.length})
                  </p>
                  <div className="space-y-3 mb-4">
                    {task.comments.map((c) => (
                      <div key={c.id} className="flex gap-2">
                        <Avatar className="h-6 w-6 shrink-0">
                          <AvatarFallback className="text-[10px]">{getInitials(c.author.name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 bg-gray-50 rounded-lg p-2.5">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium">{c.author.name}</span>
                            <span className="text-xs text-gray-400">
                              {format(new Date(c.createdAt), "MMM d, h:mm a")}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <Textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Write a comment..."
                      rows={2}
                    />
                    <Button
                      size="sm"
                      onClick={handleAddComment}
                      disabled={!comment.trim() || submittingComment}
                    >
                      {submittingComment ? "Posting..." : "Post comment"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
                    <Tag className="w-3 h-3" /> Status
                  </p>
                  <Select
                    value={task.status}
                    onValueChange={(v) => updateTask({ status: v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_STATUSES.map((s) => (
                        <SelectItem key={s} value={s} className="text-xs">
                          <span className={`px-1.5 py-0.5 rounded-full ${getStatusBg(s as TaskStatus)}`}>
                            {getStatusLabel(s as TaskStatus)}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
                    <Flag className="w-3 h-3" /> Priority
                  </p>
                  <Select
                    value={task.priority}
                    onValueChange={(v) => updateTask({ priority: v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p} className="text-xs">
                          <span className={`px-1.5 py-0.5 rounded-full ${getPriorityBg(p as TaskPriority)}`}>
                            {p}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
                    <User className="w-3 h-3" /> Assignee
                  </p>
                  <Select
                    value={task.assignee?.id ?? "unassigned"}
                    onValueChange={(v) => updateTask({ assigneeId: v === "unassigned" ? null : v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned" className="text-xs">Unassigned</SelectItem>
                      {members.map((m) => (
                        <SelectItem key={m.user.id} value={m.user.id} className="text-xs">
                          {m.user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Due Date
                  </p>
                  <input
                    type="date"
                    className="w-full h-8 px-2 text-xs rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={task.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd") : ""}
                    onChange={(e) => updateTask({ dueDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  />
                </div>

                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-1">
                    Created by {task.createdBy.name}
                  </p>
                  <p className="text-xs text-gray-400">{formatDate(task.createdAt)}</p>
                </div>

                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={handleDeleteTask}
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete task
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
