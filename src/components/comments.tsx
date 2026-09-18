import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { addComment } from "@/lib/actions/misc";
import { fmtDateTime } from "@/lib/format";

// Comments on any entity (redline Q2: viewers can comment when the
// workspace toggle allows).
export async function CommentsSection({
  entityType,
  entityId,
  returnTo,
}: {
  entityType: string;
  entityId: string;
  returnTo: string;
}) {
  const auth = await getAuth();
  if (!auth) return null;

  const comments = await prisma.comment.findMany({
    where: { entityType, entityId },
    include: { author: true },
    orderBy: { createdAt: "asc" },
  });

  const canComment =
    auth.role !== "VIEWER" || auth.workspace.viewersCanComment;

  return (
    <section className="card">
      <h3 className="mb-3 text-sm font-semibold">Comments</h3>
      {comments.length === 0 ? (
        <p className="text-sm text-zinc-500">No comments yet.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="text-sm">
              <div className="mb-0.5 flex items-baseline gap-2">
                <span className="font-medium">{c.author.name}</span>
                <span className="text-xs text-zinc-400">
                  {fmtDateTime(c.createdAt)}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-zinc-700">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
      {canComment ? (
        <form action={addComment} className="mt-4 flex gap-2">
          <input type="hidden" name="entityType" value={entityType} />
          <input type="hidden" name="entityId" value={entityId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <input
            name="body"
            className="input"
            placeholder="Write a comment…"
            required
          />
          <button className="btn btn-primary">Post</button>
        </form>
      ) : (
        <p className="mt-3 text-xs text-zinc-400">
          Commenting is disabled for viewers in this workspace.
        </p>
      )}
    </section>
  );
}
