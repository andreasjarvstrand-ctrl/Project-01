import { getSessionUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { FolderKanban, CheckSquare, Plus, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatDate, getStatusBg, getPriorityBg, getStatusLabel } from "@/lib/utils"
import type { TaskStatus, TaskPriority } from "@/lib/types"

export default async function DashboardPage() {
  const user = await getSessionUser()
  if (!user) return null

  const memberships = await prisma.projectMember.findMany({
    where: { userId: user.id },
    include: {
      project: {
        include: {
          members: { include: { user: { select: { id: true, name: true } } } },
          _count: { select: { tasks: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 6,
  })

  const myTasks = await prisma.task.findMany({
    where: { assigneeId: user.id, status: { not: "DONE" } },
    include: {
      project: { select: { id: true, name: true, color: true } },
      section: { select: { name: true } },
    },
    orderBy: { dueDate: "asc" },
    take: 10,
  })

  const projects = memberships.map((m) => m.project)

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user.name.split(" ")[0]}
          </h1>
          <p className="text-gray-500 mt-0.5">Here's what's happening today</p>
        </div>
        <Link href="/projects/new">
          <Button>
            <Plus className="w-4 h-4" /> New Project
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Projects</h2>
            <Link href="/projects" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
              View all
            </Link>
          </div>

          {projects.length === 0 ? (
            <div className="border border-dashed border-gray-200 rounded-xl p-10 text-center">
              <FolderKanban className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">No projects yet</p>
              <Link href="/projects/new">
                <Button size="sm">Create your first project</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {projects.map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`}>
                  <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-indigo-200 transition-all group">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: p.color }} />
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
                          {p.name}
                        </h3>
                        {p.description && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{p.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <CheckSquare className="w-3.5 h-3.5" />
                        {p._count.tasks} tasks
                      </span>
                      <div className="flex -space-x-1">
                        {p.members.slice(0, 4).map((m) => (
                          <div
                            key={m.userId}
                            className="w-5 h-5 rounded-full bg-indigo-100 border border-white flex items-center justify-center text-[9px] font-semibold text-indigo-700"
                            title={m.user.name}
                          >
                            {m.user.name[0]}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">My Tasks</h2>
            <span className="text-xs text-gray-400">{myTasks.length} open</span>
          </div>

          {myTasks.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <CheckSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No tasks assigned to you</p>
            </div>
          ) : (
            <div className="space-y-2">
              {myTasks.map((task) => (
                <Link key={task.id} href={`/projects/${task.projectId}`}>
                  <div className="bg-white rounded-lg border border-gray-200 p-3.5 hover:shadow-sm hover:border-indigo-200 transition-all">
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: task.project.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{task.project.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2">
                      <Badge className={getStatusBg(task.status as TaskStatus)} variant="secondary">
                        {getStatusLabel(task.status as TaskStatus)}
                      </Badge>
                      <Badge className={getPriorityBg(task.priority as TaskPriority)} variant="secondary">
                        {task.priority}
                      </Badge>
                      {task.dueDate && (
                        <span className="flex items-center gap-1 text-xs text-gray-400 ml-auto">
                          <Clock className="w-3 h-3" />
                          {formatDate(task.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
