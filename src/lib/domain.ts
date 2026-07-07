// Enum-like domain vocabulary. SQLite has no enums, so values are validated
// strings; this module is the single source of truth for them.

export const ROLES = ["ADMIN", "MEMBER", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  MEMBER: "Member",
  VIEWER: "Viewer",
};

export const PROJECT_TYPES = {
  SOURCING: "Sourcing Event",
  CONTRACT_RENEWAL: "Contract Renewal",
  SUPPLIER_ONBOARDING: "Supplier Onboarding",
  CATEGORY_REVIEW: "Category Strategy Review",
  PERFORMANCE_REVIEW: "Vendor Performance Review",
  RISK_ASSESSMENT: "Risk Assessment",
} as const;
export type ProjectType = keyof typeof PROJECT_TYPES;

// Inline definitions per feature map §5.3.
export const SOURCING_TYPES = {
  RFI: {
    label: "RFI",
    hint: "Request for Information — market/supplier information gathering, no pricing commitment.",
  },
  RFQ: {
    label: "RFQ",
    hint: "Request for Quotation — competitive pricing for a well-defined requirement.",
  },
  RFP: {
    label: "RFP",
    hint: "Request for Proposal — combined information gathering and detailed pricing; proposals are negotiable.",
  },
  RFT: {
    label: "RFT",
    hint: "Request for Tender — formal tender; responses are typically binding offers evaluated against published criteria with little or no negotiation.",
  },
  RFS: {
    label: "RFS",
    hint: "Request for Solution — open-ended; suppliers propose the approach.",
  },
} as const;
export type SourcingType = keyof typeof SOURCING_TYPES;

export const KRALJIC = {
  STRATEGIC: {
    label: "Strategic",
    hint: "High supply risk, high profit impact — partner closely, full-rigor governance.",
  },
  LEVERAGE: {
    label: "Leverage",
    hint: "Low supply risk, high profit impact — exploit competition.",
  },
  BOTTLENECK: {
    label: "Bottleneck",
    hint: "High supply risk, low profit impact — secure supply, manage risk.",
  },
  NON_CRITICAL: {
    label: "Non-critical",
    hint: "Low supply risk, low profit impact — minimise effort, lightweight process.",
  },
} as const;
export type Kraljic = keyof typeof KRALJIC;

// Redline A1: fixed canonical phases behind custom stage names. The
// portfolio pipeline board renders these columns.
export const CANONICAL_PHASES = {
  INITIATE: "Initiate",
  RESEARCH: "Research",
  SOURCING: "Sourcing Event",
  EVALUATION: "Evaluation & Selection",
  AWARD: "Award & Onboarding",
  CLOSEOUT: "Close-out",
} as const;
export type CanonicalPhase = keyof typeof CANONICAL_PHASES;
export const PHASE_ORDER = Object.keys(CANONICAL_PHASES) as CanonicalPhase[];

export const TASK_STATUSES = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  DONE: "Done",
} as const;
export type TaskStatus = keyof typeof TASK_STATUSES;

export const PRIORITIES = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
} as const;

export const RAID_TYPES = {
  RISK: "Risk",
  ASSUMPTION: "Assumption",
  ISSUE: "Issue",
  DECISION: "Decision",
} as const;
export type RaidType = keyof typeof RAID_TYPES;

export const RACI = {
  R: "Responsible",
  A: "Accountable",
  C: "Consulted",
  I: "Informed",
} as const;

export const SUPPLIER_TIERS = {
  STRATEGIC: "Strategic",
  PREFERRED: "Preferred",
  TRANSACTIONAL: "Transactional",
} as const;

export const SUPPLIER_STATUSES = {
  PROSPECTIVE: "Prospective",
  ACTIVE: "Active",
  UNDER_REVIEW: "Under review",
  DO_NOT_USE: "Do not use",
} as const;

export const CONTRACT_STATUSES = {
  ACTIVE: "Active",
  EXPIRED: "Expired",
  TERMINATED: "Terminated",
  RENEWED: "Renewed",
} as const;

export const SAVINGS_TYPES = {
  REDUCTION: "Cost reduction",
  AVOIDANCE: "Cost avoidance",
  INCENTIVE: "Incentive value",
} as const;

export const RAG = {
  GREEN: "On track",
  AMBER: "At risk",
  RED: "Off track",
} as const;
export type Rag = keyof typeof RAG;

export const PROJECT_STATUSES = {
  ACTIVE: "Active",
  CLOSED: "Closed",
  ARCHIVED: "Archived",
} as const;

// Kraljic quadrant → suggested rigor: which stages default to gated.
export const KRALJIC_GATE_HINT: Record<Kraljic, string> = {
  STRATEGIC: "Full stage-gate rigor suggested — sign-off at every gate.",
  LEVERAGE: "Standard rigor — gate the evaluation and award stages.",
  BOTTLENECK: "Risk-focused rigor — gate research and award stages.",
  NON_CRITICAL: "Lightweight process — gates optional.",
};
