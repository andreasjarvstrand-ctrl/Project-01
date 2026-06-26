"use client"

import { useState, useCallback } from "react"
import { Plus, ChevronDown, ChevronRight, CheckSquare, Square, MessageSquare, Flag, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { CreateTaskDialog } from "./create-task-dialog"
import { TaskDetailDialog } from "./task-detail-dialog"
import { formatDate, getStatusBg, getPriorityBg, getInitials, cn } from "@/lib/utils"
import type { TaskStatus, TaskPriority } from "@/lib/types"

interface Task {
  id: string
  title: string
  status: string
  priority: string
  dueDate?: string | null
  assignee?: { id: string; name: string; email: string } | null
  _count?: { comments: number }
}

interface Section {
  id: string
  name: string
  tasks: Task[]
}

interface ProjectListViewProps {
  projectId: string
  sections: Section[]
  members: Array<{ userId: string; user: { id: string; name: string; email: string } }>
  onRefresh: () => void
}

export function ProjectListView({ projectId, sections, members, onRefresh }: ProjectListViewProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [createTaskOpen, setCreateTaskOpen] = useState(false)
  const [createTaskSectionId, setCreateTaskSectionId] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  const toggleSection = (id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const toggleTaskDone = async (task: Task) => {
    const newStatus = task.status === "DONE" ? "TODO" : "DONE"
    await fetch(`/api/projects/${projectId}/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
    onRefresh()
  }

  const isOverdue = (dueDate: string | null | undefined) => {
    if (!dueDate) return false
    return new Date(dueDate) < new Date()
  }

  const allSections: Section[] = [
    ...sections,
    ...(sections.length === 0
      ? [{ id: "unsectioned", name: "Tasks", tasks: [] }]
      : []),
  ]

  return (
    <div className="space-y-2">
      {allSections.map((section) => (
        <div key={section.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Section header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
            <button
              onClick={() => toggleSection(section.id)}
              className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 hover:text-gray-900"
            >
              {collapsed[section.id] ? (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
              {section.name}
            </button>
            <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-1.5 py-0.5">
              {section.tasks.length}
            </span>
            <div className="ml-auto">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-gray-500"
                onClick={() => { setCreateTaskSectionId(section.id === "unsectioned" ? null : section.id); setCreateTaskOpen(true) }}
              >
                <Plus className="w-3.5 h-3.5" /> Add task
              </Button>
            </div>
          </div>

          {/* Tasks */}
          {!collapsed[section.id] && (
            <div>
              {section.tasks.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-gray-400">
                  No tasks in this section
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {section.tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 group cursor-pointer"
                      onClick={() => setSelectedTaskId(task.id)}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleTaskDone(task) }}
                        className="shrink-0 text-gray-300 hover:text-indigo-600 transition-colors"
                      >
                        {task.status === "DONE" ? (
                          <CheckSquare className="w-4 h-4 text-green-500" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>

                      {/* Title */}
                      <span className={cn(
                        "flex-1 text-sm font-medium truncate",
                        task.status === "DONE" ? "line-through text-gray-400" : "text-gray-900"
                      )}>
                        {task.title}
                      </span>

                      {/* Meta */}
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Badge className={getPriorityBg(task.priority as TaskPriority)} variant="secondary">
                          <Flag className="w-2.5 h-2.5 mr-1" />
                          {task.priority}
                        </Badge>
                        <Badge className={getStatusBg(task.status as TaskStatus)} variant="secondary">
                          {task.status.replace("_", " ")}
                        </Badge>
                      </div>

                      {task._count?.comments ? (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <MessageSquare className="w-3.5 h-3.5" />
                          {task._count.comments}
                        </span>
                      ) : null}

                      {task.dueDate && (
                        <span className={cn(
                          "flex items-center gap-1 text-xs",
                          isOverdue(task.dueDate) && task.status !== "DONE" ? "text-red-500" : "text-gray-400"
                        )}>
                          <Clock className="w-3.5 h-3.5" />
                          {formatDate(task.dueDate)}
                        </span>
                      )}

                      {task.assignee && (
                        <Avatar className="h-6 w-6 shrink-0">
                          <AvatarFallback className="text-[10px]">
                            {getInitials(task.assignee.name)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="px-4 py-2">
                <button
                  onClick={() => { setCreateTaskSectionId(section.id === "unsectioned" ? null : section.id); setCreateTaskOpen(true) }}
                  className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-indigo-600 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add a task
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      <CreateTaskDialog
        open={createTaskOpen}
        projectId={projectId}
        sections={sections}
        members={members}
        defaultSectionId={createTaskSectionId}
        onClose={() => setCreateTaskOpen(false)}
        onCreated={onRefresh}
      />

      <TaskDetailDialog
        taskId={selectedTaskId}
        projectId={projectId}
        members={members}
        onClose={() => setSelectedTaskId(null)}
        onUpdate={onRefresh}
      />
    </div>
  )
}
