import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, isValid, parseISO } from "date-fns"
import type { TaskPriority, TaskStatus } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return ""
  const d = typeof date === "string" ? parseISO(date) : date
  if (!isValid(d)) return ""
  return format(d, "MMM d, yyyy")
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function getPriorityColor(priority: TaskPriority): string {
  const map: Record<TaskPriority, string> = {
    LOW: "text-gray-500",
    MEDIUM: "text-yellow-500",
    HIGH: "text-orange-500",
    URGENT: "text-red-500",
  }
  return map[priority] ?? "text-gray-500"
}

export function getPriorityBg(priority: TaskPriority): string {
  const map: Record<TaskPriority, string> = {
    LOW: "bg-gray-100 text-gray-700",
    MEDIUM: "bg-yellow-100 text-yellow-700",
    HIGH: "bg-orange-100 text-orange-700",
    URGENT: "bg-red-100 text-red-700",
  }
  return map[priority] ?? "bg-gray-100 text-gray-700"
}

export function getStatusBg(status: TaskStatus): string {
  const map: Record<TaskStatus, string> = {
    TODO: "bg-gray-100 text-gray-700",
    IN_PROGRESS: "bg-blue-100 text-blue-700",
    IN_REVIEW: "bg-purple-100 text-purple-700",
    DONE: "bg-green-100 text-green-700",
  }
  return map[status] ?? "bg-gray-100 text-gray-700"
}

export function getStatusLabel(status: TaskStatus): string {
  const map: Record<TaskStatus, string> = {
    TODO: "To Do",
    IN_PROGRESS: "In Progress",
    IN_REVIEW: "In Review",
    DONE: "Done",
  }
  return map[status] ?? status
}
