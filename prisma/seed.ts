import path from "path"
import { PrismaClient } from "@prisma/client"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"

const dbPath = path.resolve(process.cwd(), "dev.db")
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` })
const prisma = new PrismaClient({ adapter } as any)

async function main() {
  console.log("Seeding database...")

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: { name: "Admin User", email: "admin@example.com", role: "ADMIN" },
  })

  const member = await prisma.user.upsert({
    where: { email: "member@example.com" },
    update: {},
    create: { name: "Jane Doe", email: "member@example.com", role: "MEMBER" },
  })

  const project = await prisma.project.upsert({
    where: { id: "seed-project-1" },
    update: {},
    create: {
      id: "seed-project-1",
      name: "Website Redesign",
      description: "Complete overhaul of the company website",
      color: "#6366f1",
      createdById: admin.id,
    },
  })

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: admin.id } },
    update: {},
    create: { projectId: project.id, userId: admin.id, role: "OWNER" },
  })

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: member.id } },
    update: {},
    create: { projectId: project.id, userId: member.id, role: "MEMBER" },
  })

  const sections = [
    { id: "seed-section-1", name: "To Do", order: 0 },
    { id: "seed-section-2", name: "In Progress", order: 1 },
    { id: "seed-section-3", name: "Done", order: 2 },
  ]

  for (const s of sections) {
    await prisma.section.upsert({
      where: { id: s.id },
      update: {},
      create: { ...s, projectId: project.id },
    })
  }

  const tasks = [
    { title: "Design new homepage mockups", sectionId: "seed-section-1", priority: "HIGH", assigneeId: member.id },
    { title: "Set up CI/CD pipeline", sectionId: "seed-section-2", priority: "MEDIUM", assigneeId: admin.id },
    { title: "Write API documentation", sectionId: "seed-section-1", priority: "LOW", assigneeId: null as string | null },
    { title: "Migrate legacy data", sectionId: "seed-section-2", priority: "URGENT", assigneeId: admin.id },
    { title: "Logo redesign approved", sectionId: "seed-section-3", priority: "MEDIUM", assigneeId: member.id },
  ]

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i]
    const taskId = `seed-task-${i + 1}`
    await prisma.task.upsert({
      where: { id: taskId },
      update: {},
      create: {
        id: taskId,
        title: t.title,
        projectId: project.id,
        sectionId: t.sectionId,
        priority: t.priority,
        status: t.sectionId === "seed-section-3" ? "DONE" : t.sectionId === "seed-section-2" ? "IN_PROGRESS" : "TODO",
        assigneeId: t.assigneeId,
        order: i,
        createdById: admin.id,
      },
    })
  }

  console.log("\nSeed completed!")
  console.log("  Admin: admin@example.com")
  console.log("  Member: member@example.com")
  console.log("  Use the OTP login — the code will appear in the terminal.\n")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
