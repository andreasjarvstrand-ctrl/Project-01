import { z } from "zod"

export const LoginEmailSchema = z.object({
  email: z.string().email("Invalid email address"),
})

export const VerifyOtpSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6, "Code must be 6 digits"),
})

export const CreateProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid color").optional(),
})

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
})

export const CreateTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional(),
  sectionId: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  dueDate: z.string().datetime().optional().nullable(),
  order: z.number().int().default(0),
})

export const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  sectionId: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  status: z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  dueDate: z.string().datetime().optional().nullable(),
  order: z.number().int().optional(),
})

export const CreateSectionSchema = z.object({
  name: z.string().min(1).max(100),
  order: z.number().int().optional(),
})

export const CreateCommentSchema = z.object({
  content: z.string().min(1).max(2000),
})

export const CreateUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
})

export const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(100),
})

export const AddProjectMemberSchema = z.object({
  userId: z.string(),
  role: z.enum(["OWNER", "MEMBER"]).default("MEMBER"),
})

export const ReorderTaskSchema = z.object({
  taskId: z.string(),
  sourceSectionId: z.string().nullable(),
  destinationSectionId: z.string().nullable(),
  newOrder: z.number().int(),
})
