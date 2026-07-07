import type { CanonicalPhase, ProjectType } from "./domain";

// Redline §4: default lifecycles ship per project type — a Contract Renewal
// never passes through "Sourcing Event". The six-stage model is the Sourcing
// Event default (A4: no "Contract & Relationship Management" stage; ongoing
// obligations live on the Contract record).

export type StageTemplate = {
  name: string;
  canonicalPhase: CanonicalPhase;
  gateRequired: boolean;
};

export const STAGE_TEMPLATES: Record<ProjectType, StageTemplate[]> = {
  SOURCING: [
    { name: "Initiate", canonicalPhase: "INITIATE", gateRequired: true },
    { name: "Research", canonicalPhase: "RESEARCH", gateRequired: false },
    { name: "Sourcing Event", canonicalPhase: "SOURCING", gateRequired: true },
    { name: "Evaluation & Selection", canonicalPhase: "EVALUATION", gateRequired: true },
    { name: "Award & Onboarding", canonicalPhase: "AWARD", gateRequired: true },
    { name: "Close-out", canonicalPhase: "CLOSEOUT", gateRequired: false },
  ],
  CONTRACT_RENEWAL: [
    { name: "Initiate", canonicalPhase: "INITIATE", gateRequired: true },
    { name: "Review & Market Check", canonicalPhase: "RESEARCH", gateRequired: false },
    { name: "Negotiation", canonicalPhase: "EVALUATION", gateRequired: true },
    { name: "Renewal Decision", canonicalPhase: "AWARD", gateRequired: true },
    { name: "Close-out", canonicalPhase: "CLOSEOUT", gateRequired: false },
  ],
  SUPPLIER_ONBOARDING: [
    { name: "Initiate", canonicalPhase: "INITIATE", gateRequired: false },
    { name: "Due Diligence", canonicalPhase: "RESEARCH", gateRequired: true },
    { name: "Setup & Integration", canonicalPhase: "AWARD", gateRequired: false },
    { name: "Close-out", canonicalPhase: "CLOSEOUT", gateRequired: false },
  ],
  CATEGORY_REVIEW: [
    { name: "Initiate", canonicalPhase: "INITIATE", gateRequired: false },
    { name: "Analysis", canonicalPhase: "RESEARCH", gateRequired: false },
    { name: "Strategy Definition", canonicalPhase: "EVALUATION", gateRequired: true },
    { name: "Close-out", canonicalPhase: "CLOSEOUT", gateRequired: false },
  ],
  PERFORMANCE_REVIEW: [
    { name: "Initiate", canonicalPhase: "INITIATE", gateRequired: false },
    { name: "Data Collection", canonicalPhase: "RESEARCH", gateRequired: false },
    { name: "Review & Scoring", canonicalPhase: "EVALUATION", gateRequired: false },
    { name: "Close-out", canonicalPhase: "CLOSEOUT", gateRequired: false },
  ],
  RISK_ASSESSMENT: [
    { name: "Initiate", canonicalPhase: "INITIATE", gateRequired: false },
    { name: "Assessment", canonicalPhase: "RESEARCH", gateRequired: false },
    { name: "Mitigation Plan", canonicalPhase: "EVALUATION", gateRequired: true },
    { name: "Close-out", canonicalPhase: "CLOSEOUT", gateRequired: false },
  ],
};
