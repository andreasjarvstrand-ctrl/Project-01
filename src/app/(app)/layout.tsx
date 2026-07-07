import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { logout } from "@/lib/actions/auth";
import { ROLE_LABELS } from "@/lib/domain";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/projects", label: "Projects" },
  { href: "/suppliers", label: "Suppliers" },
  { href: "/contracts", label: "Contracts" },
  { href: "/reports", label: "Reports" },
];

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const auth = await requireAuth();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-52 shrink-0 flex-col border-r border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-4 py-4">
          <div className="text-base font-semibold tracking-tight">Productive</div>
          <div className="mt-0.5 truncate text-xs text-zinc-500">
            {auth.workspace.name}
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            >
              {item.label}
            </Link>
          ))}
          {auth.role === "ADMIN" ? (
            <Link
              href="/settings"
              className="block rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            >
              Settings
            </Link>
          ) : null}
        </nav>
        <div className="border-t border-zinc-200 p-3">
          <div className="mb-1 text-sm font-medium">{auth.user.name}</div>
          <div className="mb-2 flex items-center gap-2">
            <span className="badge bg-indigo-50 text-indigo-700">
              {ROLE_LABELS[auth.role]}
            </span>
          </div>
          <form action={logout}>
            <button className="text-xs text-zinc-500 hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-6">{children}</main>
    </div>
  );
}
