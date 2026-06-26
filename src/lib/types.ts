export type UserRole = "ADMIN" | "MEMBER"
export type ProjectStatus = "ACTIVE" | "ARCHIVED"
export type ProjectMemberRole = "OWNER" | "MEMBER"
export type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE"
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT"

export interface SessionUser {
  id: string
  email: string
  name: string
  role: UserRole
}

export interface ApiResponse<T> {
  data?: T
  error?: string | object
}
