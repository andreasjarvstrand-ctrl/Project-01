import { getSessionUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { getInitials, formatDate } from "@/lib/utils"
import { Users } from "lucide-react"

export default async function TeamPage() {
  const user = await getSessionUser()
  if (!user) return null

  let users
  if (user.role === "ADMIN") {
    users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      orderBy: { name: "asc" },
    })
  } else {
    const projectIds = await prisma.projectMember
      .findMany({ where: { userId: user.id }, select: { projectId: true } })
      .then((m) => m.map((x) => x.projectId))

    const userIds = await prisma.projectMember
      .findMany({ where: { projectId: { in: projectIds } }, select: { userId: true } })
      .then((m) => [...new Set(m.map((x) => x.userId))])

    users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      orderBy: { name: "asc" },
    })
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Team</h1>
        <span className="text-sm text-gray-500 bg-gray-100 rounded-full px-2.5 py-0.5">{users.length} member{users.length !== 1 ? "s" : ""}</span>
      </div>

      {users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Users className="w-12 h-12 text-gray-300 mb-4" />
          <p className="text-gray-500">No team members found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-6 py-3 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
            <div className="w-8" /><div>Name</div><div>Role</div><div>Status</div><div>Joined</div>
          </div>
          <div className="divide-y divide-gray-100">
            {users.map((u) => (
              <div key={u.id} className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 items-center px-6 py-4">
                <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{getInitials(u.name)}</AvatarFallback></Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{u.name}</p>
                    {u.id === user.id && <span className="text-xs text-indigo-600 font-medium">(you)</span>}
                  </div>
                  <p className="text-xs text-gray-500">{u.email}</p>
                </div>
                <Badge variant={u.role === "ADMIN" ? "default" : "secondary"} className="text-xs">{u.role}</Badge>
                <Badge variant={u.isActive ? "success" : "secondary"} className={`text-xs ${u.isActive ? "bg-green-100 text-green-700" : ""}`}>{u.isActive ? "Active" : "Inactive"}</Badge>
                <span className="text-xs text-gray-400">{formatDate(u.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
