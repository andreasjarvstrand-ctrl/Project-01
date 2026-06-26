"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Settings,
  Shield,
  ChevronDown,
  ChevronRight,
  Plus,
} from "lucide-react"
import { useCurrentUser } from "@/context/user-context"
import { cn } from "@/lib/utils"

interface Project {
  id: string
  name: string
  color: string
}

export function AppSidebar() {
  const pathname = usePathname()
  const { user } = useCurrentUser()
  const [projects, setProjects] = useState<Project[]>([])
  const [projectsOpen, setProjectsOpen] = useState(true)

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []))
      .catch(() => {})
  }, [])

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href)

  return (
    <aside className="sidebar flex flex-col w-64 min-h-screen shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5 border-b border-white/10">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500">
          <FolderKanban className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-white text-base">Productive</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <Link
          href="/dashboard"
          className={cn("sidebar-item", isActive("/dashboard") && "active")}
        >
          <LayoutDashboard className="w-4 h-4 shrink-0" />
          Dashboard
        </Link>

        {/* Projects */}
        <div>
          <button
            onClick={() => setProjectsOpen(!projectsOpen)}
            className="sidebar-item w-full"
          >
            <FolderKanban className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left">Projects</span>
            {projectsOpen ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>

          {projectsOpen && (
            <div className="ml-4 mt-1 space-y-0.5">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className={cn(
                    "sidebar-item text-xs",
                    pathname.startsWith(`/projects/${p.id}`) && "active"
                  )}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="truncate">{p.name}</span>
                </Link>
              ))}
              <Link href="/projects/new" className="sidebar-item text-xs opacity-60 hover:opacity-100">
                <Plus className="w-3 h-3" />
                New project
              </Link>
            </div>
          )}
        </div>

        <Link
          href="/team"
          className={cn("sidebar-item", isActive("/team") && "active")}
        >
          <Users className="w-4 h-4 shrink-0" />
          Team
        </Link>

        {user?.role === "ADMIN" && (
          <Link
            href="/admin/users"
            className={cn("sidebar-item", isActive("/admin") && "active")}
          >
            <Shield className="w-4 h-4 shrink-0" />
            Admin
          </Link>
        )}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-white/10">
        <Link
          href="/settings"
          className={cn("sidebar-item", isActive("/settings") && "active")}
        >
          <Settings className="w-4 h-4 shrink-0" />
          Settings
        </Link>
      </div>
    </aside>
  )
}
