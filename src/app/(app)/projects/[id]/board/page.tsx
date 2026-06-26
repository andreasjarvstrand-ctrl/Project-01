"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { ProjectHeader } from "@/components/projects/project-header"
import { KanbanBoard } from "@/components/projects/kanban-board"
import { LoadingSpinner } from "@/components/common/loading-spinner"

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
  order: number
}

interface Member {
  userId: string
  user: { id: string; name: string; email: string }
}

interface Project {
  id: string
  name: string
  color: string
  sections: Section[]
  members: Member[]
}

export default function ProjectBoardPage() {
  const params = useParams()
  const projectId = params.id as string
  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const [projectRes, tasksRes] = await Promise.all([
      fetch(`/api/projects/${projectId}`),
      fetch(`/api/projects/${projectId}/tasks`),
    ])
    const projectData = await projectRes.json()
    const tasksData = await tasksRes.json()
    setProject(projectData.project)
    setTasks(tasksData.tasks ?? [])
    setIsLoading(false)
  }, [projectId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (isLoading || !project) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  const sectionsWithTasks = project.sections.map((s) => ({
    ...s,
    tasks: tasks
      .filter((t) => t.sectionId === s.id)
      .sort((a, b) => a.order - b.order),
  }))

  return (
    <div className="flex flex-col h-full">
      <ProjectHeader
        projectId={project.id}
        projectName={project.name}
        projectColor={project.color}
        members={project.members}
      />
      <div className="flex-1 overflow-auto p-6">
        <KanbanBoard
          projectId={projectId}
          sections={sectionsWithTasks}
          members={project.members}
          onRefresh={fetchData}
        />
      </div>
    </div>
  )
}
