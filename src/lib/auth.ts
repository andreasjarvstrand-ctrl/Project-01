import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "./db";
import type { Role } from "./domain";

export const SESSION_COOKIE = "productive_session";
export const SESSION_DAYS = 30;

export type Auth = {
  user: { id: string; email: string; name: string };
  role: Role;
  workspace: {
    id: string;
    name: string;
    currency: string;
    viewersCanComment: boolean;
    membersCanCreateProjects: boolean;
  };
};

// Cached per request. Returns null when not authenticated.
export const getAuth = cache(async (): Promise<Auth | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: { include: { memberships: { include: { workspace: true } } } },
    },
  });
  if (!session || session.expiresAt < new Date()) return null;
  const membership = session.user.memberships[0];
  if (!membership) return null;
  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    },
    role: membership.role as Role,
    workspace: membership.workspace,
  };
});

export async function requireAuth(): Promise<Auth> {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  return auth;
}

// ADMIN or MEMBER — anyone who can create/edit work product.
export async function requireEditor(): Promise<Auth> {
  const auth = await requireAuth();
  if (auth.role === "VIEWER") {
    throw new Error("Your role is view-only for this action.");
  }
  return auth;
}

export async function requireAdmin(): Promise<Auth> {
  const auth = await requireAuth();
  if (auth.role !== "ADMIN") {
    throw new Error("This action requires the Admin role.");
  }
  return auth;
}
