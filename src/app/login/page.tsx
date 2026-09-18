import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { requestOtp, verifyOtp } from "@/lib/actions/auth";
import { ErrorBanner } from "@/components/ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; error?: string }>;
}) {
  const auth = await getAuth();
  if (auth) redirect("/");

  const { email, error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Productive</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Procurement project management
          </p>
        </div>
        <div className="card">
          <ErrorBanner error={error} />
          {!email ? (
            <form action={requestOtp} className="space-y-3">
              <div>
                <label className="label" htmlFor="email">
                  Work email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className="input"
                  placeholder="you@example.com"
                  required
                  autoFocus
                />
              </div>
              <button className="btn btn-primary w-full justify-center">
                Send login code
              </button>
            </form>
          ) : (
            <form action={verifyOtp} className="space-y-3">
              <input type="hidden" name="email" value={email} />
              <p className="text-sm text-zinc-600">
                A 6-digit code was sent to <strong>{email}</strong>.
              </p>
              <p className="text-xs text-zinc-400">
                Dev mode: the code is printed to the server console.
              </p>
              <div>
                <label className="label" htmlFor="code">
                  Login code
                </label>
                <input
                  id="code"
                  name="code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  className="input text-center text-lg tracking-[0.4em]"
                  required
                  autoFocus
                />
              </div>
              <button className="btn btn-primary w-full justify-center">
                Sign in
              </button>
              <a
                href="/login"
                className="block text-center text-xs text-zinc-500 hover:underline"
              >
                Use a different email
              </a>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
