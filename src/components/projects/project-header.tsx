"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Settings } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { getInitials, cn } from "@/lib/utils"

interface Member {
  userId: string
  user: { id: string; name: string; email: string }
}

interface ProjectHeaderProps {
  projectId: string
  projectName: string
  projectColor: string
  members: Member[]
}

export function ProjectHeader({ projectId, projectName, projectColor, members }: ProjectHeaderProps) {
  const pathname = usePathname()

  const tabs = [
    { label: "List", href: `/projects/${projectId}` },
    { label: "Board", href: `/projects/${projectId}/board` },
    { label: "Settings", href: `/projects/${projectId}/settings` },
  ]

  return (
    <div className="bg-white border-b border-gray-200 px-8 pt-6 pb-0">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-4 h-4 rounded-full shrink-0"
            style={{ backgroundColor: projectColor }}
          />
          <h1 className="text-xl font-bold text-gray-900">{projectName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {members.slice(0, 5).map((m) => (
              <Avatar key={m.userId} className="h-7 w-7 border-2 border-white">
                <AvatarFallback className="text-[10px]">{getInitials(m.user.name)}</AvatarFallback>
              </Avatar>
            ))}
            {members.length > 5 && (
              <div className="h-7 w-7 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[10px] font-semibold text-gray-600">
                +{members.length - 5}
              </div>
            )}
          </div>
          <Link
            href={`/projects/${projectId}/settings`}
            className="p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-500"
          >
            <Settings className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <nav className="flex gap-1">
        {tabs.map((tab) => {
          const isActive =
            tab.href === `/projects/${projectId}`
              ? pathname === tab.href
              : pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                isActive
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
