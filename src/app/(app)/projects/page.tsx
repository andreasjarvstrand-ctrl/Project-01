import { getSessionUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Plus, FolderKanban, CheckSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default async function ProjectsPage() {
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
  })

  const projects = memberships.map((m) => ({ ...m.project, memberRole: m.role }))

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-500 mt-0.5">{projects.length} project{projects.length !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/projects/new">
          <Button><Plus className="w-4 h-4" /> New Project</Button>
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="border border-dashed border-gray-300 rounded-2xl p-16 text-center">
          <FolderKanban className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No projects yet</h3>
          <p className="text-gray-500 mb-6">Create your first project to get started</p>
          <Link href="/projects/new"><Button>Create Project</Button></Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="group">
              <div className="bg-white rounded-xl border border-gray-200 hover:shadow-md hover:border-indigo-200 transition-all overflow-hidden h-full">
                <div className="h-1.5 w-full" style={{ backgroundColor: p.color }} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-1">{p.name}</h3>
                    <Badge variant={p.status === "ARCHIVED" ? "secondary" : "default"} className="shrink-0 text-xs">{p.memberRole}</Badge>
                  </div>
                  {p.description && <p className="text-sm text-gray-500 line-clamp-2 mb-4">{p.description}</p>}
                  <div className="flex items-center justify-between mt-auto">
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <CheckSquare className="w-3.5 h-3.5" />{p._count.tasks} tasks
                    </span>
                    <div className="flex -space-x-1.5">
                      {p.members.slice(0, 5).map((m) => (
                        <div key={m.userId} className="w-6 h-6 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-[10px] font-semibold text-indigo-700" title={m.user.name}>
                          {m.user.name[0]}
                        </div>
                      ))}
                      {p.members.length > 5 && (
                        <div className="w-6 h-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[10px] font-semibold text-gray-600">+{p.members.length - 5}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
          <Link href="/projects/new" className="group">
            <div className="border border-dashed border-gray-300 rounded-xl p-5 hover:border-indigo-300 hover:bg-indigo-50 transition-all flex flex-col items-center justify-center min-h-[160px] text-center cursor-pointer">
              <Plus className="w-8 h-8 text-gray-300 group-hover:text-indigo-400 mb-2 transition-colors" />
              <span className="text-sm font-medium text-gray-400 group-hover:text-indigo-600 transition-colors">New Project</span>
            </div>
          </Link>
        </div>
      )}
    </div>
  )
}
