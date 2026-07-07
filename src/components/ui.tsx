import Link from "next/link";
import {
  CANONICAL_PHASES,
  KRALJIC,
  PROJECT_TYPES,
  RAG,
  type CanonicalPhase,
  type Kraljic,
  type ProjectType,
  type Rag,
} from "@/lib/domain";

// Status colors follow the dataviz status palette and are always paired
// with a text label — color never carries meaning alone.
const RAG_STYLES: Record<Rag, string> = {
  GREEN: "bg-[#0ca30c]/10 text-[#067306]",
  AMBER: "bg-[#fab219]/15 text-[#8a6205]",
  RED: "bg-[#d03b3b]/10 text-[#a32020]",
};

export function RagBadge({ rag }: { rag: string }) {
  const key = (rag in RAG ? rag : "GREEN") as Rag;
  return (
    <span className={`badge ${RAG_STYLES[key]}`}>
      <span aria-hidden>{key === "GREEN" ? "●" : key === "AMBER" ? "◆" : "▲"}</span>
      {RAG[key]}
    </span>
  );
}

const PHASE_STYLES: Record<CanonicalPhase, string> = {
  INITIATE: "bg-zinc-100 text-zinc-700",
  RESEARCH: "bg-sky-100 text-sky-800",
  SOURCING: "bg-indigo-100 text-indigo-800",
  EVALUATION: "bg-violet-100 text-violet-800",
  AWARD: "bg-emerald-100 text-emerald-800",
  CLOSEOUT: "bg-zinc-200 text-zinc-600",
};

export function PhaseBadge({ phase }: { phase: string }) {
  const key = (phase in CANONICAL_PHASES ? phase : "INITIATE") as CanonicalPhase;
  return <span className={`badge ${PHASE_STYLES[key]}`}>{CANONICAL_PHASES[key]}</span>;
}

export function TypeBadge({ type }: { type: string }) {
  const label = PROJECT_TYPES[type as ProjectType] ?? type;
  return <span className="badge bg-zinc-100 text-zinc-600">{label}</span>;
}

export function KraljicBadge({ kraljic }: { kraljic: string | null }) {
  if (!kraljic || !(kraljic in KRALJIC)) return null;
  const k = KRALJIC[kraljic as Kraljic];
  return (
    <span className="badge bg-amber-50 text-amber-800" title={k.hint}>
      {k.label}
    </span>
  );
}

export function CategoryDot({
  category,
}: {
  category: { name: string; color: string } | null;
}) {
  if (!category) return <span className="text-zinc-400">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: category.color }}
        aria-hidden
      />
      {category.name}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
      {message}
    </p>
  );
}

export function ErrorBanner({ error }: { error?: string | string[] }) {
  if (!error) return null;
  const msg = Array.isArray(error) ? error[0] : error;
  return (
    <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      {msg}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
}) {
  const body = (
    <>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {hint ? <span className="text-xs text-zinc-500">{hint}</span> : null}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="stat-tile hover:border-indigo-300">
        {body}
      </Link>
    );
  }
  return <div className="stat-tile">{body}</div>;
}
