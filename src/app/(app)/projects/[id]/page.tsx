"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { ProjectHeader } from "@/components/projects/project-header"
import { ProjectListView } from "@/components/projects/project-list-view"
import { LoadingSpinner } from "@/components/common/loading-spinner"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Task {
  id: string
  title: string
  status: string
  priority: string
  dueDate?: string | null
  sectionId?: string | null
  assignee?: { id: string; name: string; email: string } | null
  _count?: { comments: number }
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
  description?: string | null
  sections: Section[]
  members: Member[]
}

export default function ProjectPage() {
  const params = useParams()
  const projectId = params.id as string
  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [addingSection, setAddingSection] = useState(false)
  const [newSectionName, setNewSectionName] = useState("")

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

  const handleAddSection = async () => {
    if (!newSectionName.trim()) return
    await fetch(`/api/projects/${projectId}/sections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newSectionName.trim() }),
    })
    setNewSectionName("")
    setAddingSection(false)
    fetchData()
  }

  if (isLoading || !project) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  const sectionsWithTasks = project.sections.map((s) => ({
    ...s,
    tasks: tasks.filter((t) => t.sectionId === s.id),
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
        <ProjectListView
          projectId={projectId}
          sections={sectionsWithTasks}
          members={project.members}
          onRefresh={fetchData}
        />

        {/* Add section */}
        <div className="mt-4">
          {addingSection ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                className="flex-1 h-9 px-3 text-sm rounded-lg border border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Section name..."
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddSection()
                  if (e.key === "Escape") { setAddingSection(false); setNewSectionName("") }
                }}
              />
              <Button size="sm" onClick={handleAddSection} disabled={!newSectionName.trim()}>
                Add
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setAddingSection(false); setNewSectionName("") }}>
                Cancel
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setAddingSection(true)}
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-indigo-600 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add section
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
