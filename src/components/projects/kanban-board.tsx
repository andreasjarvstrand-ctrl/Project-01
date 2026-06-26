"use client"

import { useState, useCallback } from "react"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { Plus, MessageSquare, Flag, Clock } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { CreateTaskDialog } from "./create-task-dialog"
import { TaskDetailDialog } from "./task-detail-dialog"
import { formatDate, getPriorityBg, getStatusBg, getInitials, cn } from "@/lib/utils"
import type { TaskPriority, TaskStatus } from "@/lib/types"

interface Task {
  id: string
  title: string
  status: string
  priority: string
  dueDate?: string | null
  sectionId?: string | null
  assignee?: { id: string; name: string; email: string } | null
  _count?: { comments: number }
  order: number
}

interface Section {
  id: string
  name: string
  tasks: Task[]
}

interface KanbanBoardProps {
  projectId: string
  sections: Section[]
  members: Array<{ userId: string; user: { id: string; name: string; email: string } }>
  onRefresh: () => void
}

export function KanbanBoard({ projectId, sections: initialSections, members, onRefresh }: KanbanBoardProps) {
  const [sections, setSections] = useState(initialSections)
  const [createTaskSectionId, setCreateTaskSectionId] = useState<string | null | "none">(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  const handleDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result
    if (!destination) return
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    const sourceSectionId = source.droppableId === "unsectioned" ? null : source.droppableId
    const destSectionId = destination.droppableId === "unsectioned" ? null : destination.droppableId

    // Optimistic update
    setSections((prev) => {
      const next = prev.map((s) => ({ ...s, tasks: [...s.tasks] }))
      const srcSec = next.find((s) => s.id === (source.droppableId))
      const destSec = next.find((s) => s.id === (destination.droppableId))
      if (!srcSec || !destSec) return prev

      const [movedTask] = srcSec.tasks.splice(source.index, 1)
      movedTask.sectionId = destSectionId
      destSec.tasks.splice(destination.index, 0, movedTask)
      return next
    })

    await fetch(`/api/projects/${projectId}/tasks/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: draggableId,
        sourceSectionId,
        destinationSectionId: destSectionId,
        newOrder: destination.index,
      }),
    })
  }

  const isOverdue = (dueDate: string | null | undefined, status: string) => {
    if (!dueDate || status === "DONE") return false
    return new Date(dueDate) < new Date()
  }

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 h-full overflow-x-auto pb-6">
          {sections.map((section) => (
            <div key={section.id} className="flex flex-col w-72 shrink-0">
              {/* Column header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-700">{section.name}</h3>
                  <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5">
                    {section.tasks.length}
                  </span>
                </div>
                <button
                  onClick={() => setCreateTaskSectionId(section.id)}
                  className="text-gray-400 hover:text-indigo-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Droppable */}
              <Droppable droppableId={section.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "flex-1 rounded-xl p-2 min-h-[100px] transition-colors",
                      snapshot.isDraggingOver ? "bg-indigo-50" : "bg-gray-100"
                    )}
                  >
                    {section.tasks.map((task, index) => (
                      <Draggable key={task.id} draggableId={task.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...(provided.draggableProps as any)}
                            {...(provided.dragHandleProps as any)}
                            className={cn(
                              "bg-white rounded-lg p-3 mb-2 shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition-all",
                              snapshot.isDragging && "shadow-lg rotate-1 scale-[1.02]"
                            )}
                            onClick={() => setSelectedTaskId(task.id)}
                          >
                            <p className={cn(
                              "text-sm font-medium mb-2",
                              task.status === "DONE" ? "line-through text-gray-400" : "text-gray-900"
                            )}>
                              {task.title}
                            </p>

                            <div className="flex flex-wrap gap-1 mb-2">
                              <Badge className={getPriorityBg(task.priority as TaskPriority)} variant="secondary">
                                <Flag className="w-2.5 h-2.5 mr-1" />
                                {task.priority}
                              </Badge>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {task.dueDate && (
                                  <span className={cn(
                                    "flex items-center gap-1 text-xs",
                                    isOverdue(task.dueDate, task.status) ? "text-red-500" : "text-gray-400"
                                  )}>
                                    <Clock className="w-3 h-3" />
                                    {formatDate(task.dueDate)}
                                  </span>
                                )}
                                {task._count?.comments ? (
                                  <span className="flex items-center gap-1 text-xs text-gray-400">
                                    <MessageSquare className="w-3 h-3" />
                                    {task._count.comments}
                                  </span>
                                ) : null}
                              </div>

                              {task.assignee && (
                                <Avatar className="h-6 w-6 shrink-0">
                                  <AvatarFallback className="text-[10px]">
                                    {getInitials(task.assignee.name)}
                                  </AvatarFallback>
                                </Avatar>
                              )}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}

                    {section.tasks.length === 0 && !snapshot.isDraggingOver && (
                      <div className="flex items-center justify-center h-16 text-xs text-gray-400">
                        Drop tasks here
                      </div>
                    )}
                  </div>
                )}
              </Droppable>

              <button
                onClick={() => setCreateTaskSectionId(section.id)}
                className="mt-2 flex items-center gap-1.5 text-sm text-gray-400 hover:text-indigo-600 transition-colors px-2 py-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add task
              </button>
            </div>
          ))}
        </div>
      </DragDropContext>

      <CreateTaskDialog
        open={createTaskSectionId !== null && createTaskSectionId !== "none"}
        projectId={projectId}
        sections={sections}
        members={members}
        defaultSectionId={typeof createTaskSectionId === "string" ? createTaskSectionId : null}
        onClose={() => setCreateTaskSectionId("none")}
        onCreated={() => { setCreateTaskSectionId("none"); onRefresh() }}
      />

      <TaskDetailDialog
        taskId={selectedTaskId}
        projectId={projectId}
        members={members}
        onClose={() => setSelectedTaskId(null)}
        onUpdate={onRefresh}
      />
    </>
  )
}
