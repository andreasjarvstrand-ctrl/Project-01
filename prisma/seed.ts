// Demo seed: a health-sector procurement workspace with projects across the
// lifecycle, suppliers, scorecards, and contracts in various renewal states.
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const daysAhead = (n: number) => new Date(Date.now() + n * DAY);

async function main() {
  // Wipe. Restrict relations (round→template, contract→supplier) mean the
  // workspace cascade alone can't clear everything — delete dependents first.
  await prisma.scoringRound.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.project.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.scorecardTemplate.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();
  await prisma.otpCode.deleteMany();

  // ---------- users ----------
  const [dana, sofia, marco, viktor] = await Promise.all([
    prisma.user.create({
      data: { email: "dana@productive.dev", name: "Dana Lindqvist" },
    }),
    prisma.user.create({
      data: { email: "sofia@productive.dev", name: "Sofia Berg" },
    }),
    prisma.user.create({
      data: { email: "marco@productive.dev", name: "Marco Rossi" },
    }),
    prisma.user.create({
      data: { email: "viktor@productive.dev", name: "Viktor Ek" },
    }),
  ]);

  const workspace = await prisma.workspace.create({
    data: {
      name: "Nordic Health Group Procurement",
      currency: "EUR",
      memberships: {
        create: [
          { userId: dana.id, role: "ADMIN" },
          { userId: sofia.id, role: "MEMBER" },
          { userId: marco.id, role: "MEMBER" },
          { userId: viktor.id, role: "VIEWER" }, // legal counsel: viewer + gate approver
        ],
      },
    },
  });
  const ws = workspace.id;

  // ---------- categories (colors: dataviz categorical slots) ----------
  const [itServices, facilities, clinical, marketing, logistics] =
    await Promise.all([
      prisma.category.create({
        data: { workspaceId: ws, name: "IT Services", color: "#2a78d6" },
      }),
      prisma.category.create({
        data: { workspaceId: ws, name: "Facilities", color: "#1baf7a" },
      }),
      prisma.category.create({
        data: { workspaceId: ws, name: "Clinical Supplies", color: "#eda100" },
      }),
      prisma.category.create({
        data: { workspaceId: ws, name: "Marketing", color: "#4a3aa7" },
      }),
      prisma.category.create({
        data: { workspaceId: ws, name: "Logistics", color: "#eb6834" },
      }),
    ]);

  // ---------- scorecard templates ----------
  const selectionTemplate = await prisma.scorecardTemplate.create({
    data: {
      workspaceId: ws,
      name: "Standard supplier selection",
      kind: "SELECTION",
      criteria: {
        create: [
          { name: "Price & value", weight: 30, order: 0 },
          { name: "Product / service quality", weight: 25, order: 1 },
          { name: "Delivery performance", weight: 15, order: 2 },
          { name: "Service & responsiveness", weight: 10, order: 3 },
          { name: "Financial & supply-chain risk", weight: 20, order: 4 },
          {
            name: "Regulatory compliance (mandatory)",
            weight: 0,
            isPassFail: true,
            order: 5,
          },
        ],
      },
    },
    include: { criteria: { orderBy: { order: "asc" } } },
  });

  const perfTemplate = await prisma.scorecardTemplate.create({
    data: {
      workspaceId: ws,
      name: "Quarterly performance review",
      kind: "PERFORMANCE",
      criteria: {
        create: [
          { name: "Quality", weight: 30, order: 0 },
          { name: "On-time delivery", weight: 30, order: 1 },
          { name: "Service & responsiveness", weight: 20, order: 2 },
          { name: "Innovation & improvement", weight: 20, order: 3 },
        ],
      },
    },
    include: { criteria: { orderBy: { order: "asc" } } },
  });

  // ---------- suppliers ----------
  const nimbus = await prisma.supplier.create({
    data: {
      workspaceId: ws,
      name: "Nimbus Cloud AB",
      tier: "STRATEGIC",
      status: "ACTIVE",
      ownerId: sofia.id,
      notes: "Incumbent IaaS provider. Strong on compliance, weak on cost transparency.",
      categories: { create: [{ categoryId: itServices.id }] },
      contacts: {
        create: [
          {
            name: "Elin Marklund",
            email: "elin.marklund@nimbus.example",
            role: "Account director",
          },
        ],
      },
    },
  });
  const helios = await prisma.supplier.create({
    data: {
      workspaceId: ws,
      name: "Helios Hosting GmbH",
      tier: "PREFERRED",
      status: "PROSPECTIVE",
      ownerId: sofia.id,
      categories: { create: [{ categoryId: itServices.id }] },
      contacts: {
        create: [
          {
            name: "Jonas Weber",
            email: "j.weber@helios.example",
            role: "Sales lead",
          },
        ],
      },
    },
  });
  const boreal = await prisma.supplier.create({
    data: {
      workspaceId: ws,
      name: "Boreal Datacenters Oy",
      tier: "TRANSACTIONAL",
      status: "PROSPECTIVE",
      categories: { create: [{ categoryId: itServices.id }] },
    },
  });
  const medtech = await prisma.supplier.create({
    data: {
      workspaceId: ws,
      name: "MedTech Servicing A/S",
      tier: "STRATEGIC",
      status: "ACTIVE",
      ownerId: marco.id,
      riskFlagged: true,
      riskNote:
        "Single-source for MRI maintenance in region — continuity risk if renewal fails.",
      categories: { create: [{ categoryId: clinical.id }] },
      contacts: {
        create: [
          {
            name: "Karin Holm",
            email: "k.holm@medtech.example",
            role: "Service manager",
            phone: "+45 20 11 22 33",
          },
        ],
      },
    },
  });
  const cleanCo = await prisma.supplier.create({
    data: {
      workspaceId: ws,
      name: "CleanCo Facility Services",
      tier: "PREFERRED",
      status: "ACTIVE",
      ownerId: marco.id,
      categories: { create: [{ categoryId: facilities.id }] },
    },
  });
  const brightAds = await prisma.supplier.create({
    data: {
      workspaceId: ws,
      name: "Bright Ideas Agency",
      tier: "TRANSACTIONAL",
      status: "UNDER_REVIEW",
      categories: { create: [{ categoryId: marketing.id }] },
    },
  });
  const swiftParcel = await prisma.supplier.create({
    data: {
      workspaceId: ws,
      name: "SwiftParcel Logistics",
      tier: "PREFERRED",
      status: "ACTIVE",
      ownerId: sofia.id,
      categories: { create: [{ categoryId: logistics.id }] },
    },
  });
  const nordicCourier = await prisma.supplier.create({
    data: {
      workspaceId: ws,
      name: "Nordic Courier Group",
      tier: "TRANSACTIONAL",
      status: "ACTIVE",
      categories: { create: [{ categoryId: logistics.id }] },
    },
  });

  // ---------- project 1: sourcing event mid-evaluation ----------
  const cloud = await prisma.project.create({
    data: {
      workspaceId: ws,
      name: "Cloud Hosting Sourcing 2027",
      description:
        "Re-source IaaS/PaaS hosting ahead of the 2027 contract expiry. RFP covering compute, storage, and managed Kubernetes for clinical and administrative workloads.",
      type: "SOURCING",
      sourcingType: "RFP",
      kraljic: "LEVERAGE",
      categoryId: itServices.id,
      rag: "AMBER",
      currency: "EUR",
      estimatedSpend: 1800000,
      savingsTarget: 250000,
      savingsType: "REDUCTION",
      baselineNote: "2026 run-rate with incumbent, normalised for volume growth",
      createdById: dana.id,
      createdAt: daysAgo(90),
      stages: {
        create: [
          {
            name: "Initiate",
            canonicalPhase: "INITIATE",
            order: 0,
            gateRequired: true,
            enteredAt: daysAgo(90),
            exitedAt: daysAgo(80),
          },
          {
            name: "Research",
            canonicalPhase: "RESEARCH",
            order: 1,
            enteredAt: daysAgo(80),
            exitedAt: daysAgo(55),
          },
          {
            name: "Sourcing Event",
            canonicalPhase: "SOURCING",
            order: 2,
            gateRequired: true,
            enteredAt: daysAgo(55),
            exitedAt: daysAgo(20),
          },
          {
            name: "Evaluation & Selection",
            canonicalPhase: "EVALUATION",
            order: 3,
            gateRequired: true,
            enteredAt: daysAgo(20),
          },
          {
            name: "Award & Onboarding",
            canonicalPhase: "AWARD",
            order: 4,
            gateRequired: true,
          },
          { name: "Close-out", canonicalPhase: "CLOSEOUT", order: 5 },
        ],
      },
      suppliers: {
        create: [
          { supplierId: nimbus.id },
          { supplierId: helios.id },
          { supplierId: boreal.id },
        ],
      },
    },
    include: { stages: { orderBy: { order: "asc" } } },
  });
  const evalStage = cloud.stages[3];

  // Gate approvers on the active evaluation gate: admin + legal (a Viewer).
  await prisma.gateApproval.createMany({
    data: [
      { stageId: evalStage.id, approverId: dana.id },
      { stageId: evalStage.id, approverId: viktor.id },
    ],
  });

  // Tasks with a dependency chain and a milestone.
  const shortlist = await prisma.task.create({
    data: {
      projectId: cloud.id,
      stageId: evalStage.id,
      title: "Confirm shortlist from RFP responses",
      status: "DONE",
      priority: "HIGH",
      assigneeId: sofia.id,
      completedAt: daysAgo(12),
      order: 1,
    },
  });
  const scoring = await prisma.task.create({
    data: {
      projectId: cloud.id,
      stageId: evalStage.id,
      title: "Complete evaluation scoring (blind round)",
      status: "IN_PROGRESS",
      priority: "HIGH",
      assigneeId: marco.id,
      dueDate: daysAhead(4),
      order: 2,
      dependsOn: { create: { dependsOnId: shortlist.id } },
    },
  });
  await prisma.task.create({
    data: {
      projectId: cloud.id,
      stageId: evalStage.id,
      title: "Negotiation strategy sign-off",
      status: "TODO",
      priority: "MEDIUM",
      assigneeId: dana.id,
      dueDate: daysAhead(10),
      order: 3,
      dependsOn: { create: { dependsOnId: scoring.id } },
    },
  });
  await prisma.task.create({
    data: {
      projectId: cloud.id,
      stageId: evalStage.id,
      title: "Award decision",
      isMilestone: true,
      status: "TODO",
      priority: "HIGH",
      dueDate: daysAhead(21),
      order: 4,
    },
  });
  await prisma.task.create({
    data: {
      projectId: cloud.id,
      title: "Reference calls with two Helios customers",
      status: "TODO",
      priority: "LOW",
      assigneeId: sofia.id,
      dueDate: daysAhead(7),
      order: 5,
    },
  });

  await prisma.raidEntry.createMany({
    data: [
      {
        projectId: cloud.id,
        type: "RISK",
        title: "Incumbent lock-in on proprietary backup format",
        detail:
          "Migration cost estimate pending; could erode the savings case by up to €80k.",
        ownerId: sofia.id,
        severity: "HIGH",
      },
      {
        projectId: cloud.id,
        type: "ISSUE",
        title: "Reference architecture docs missing from one bidder",
        ownerId: marco.id,
        severity: "MEDIUM",
      },
      {
        projectId: cloud.id,
        type: "ASSUMPTION",
        title: "Clinical workloads must stay in EU/EEA regions",
        ownerId: dana.id,
        severity: "LOW",
      },
      {
        projectId: cloud.id,
        type: "DECISION",
        title: "RFP over RFQ — solution variance too high for pure price comparison",
        ownerId: dana.id,
        status: "CLOSED",
      },
    ],
  });

  await prisma.stakeholder.createMany({
    data: [
      {
        projectId: cloud.id,
        name: "Dana Lindqvist",
        userId: dana.id,
        orgRole: "Category manager, IT",
        raci: "A",
        interest: "HIGH",
        influence: "HIGH",
      },
      {
        projectId: cloud.id,
        name: "Sofia Berg",
        userId: sofia.id,
        orgRole: "Sourcing specialist",
        raci: "R",
        interest: "HIGH",
        influence: "MEDIUM",
      },
      {
        projectId: cloud.id,
        name: "Viktor Ek",
        userId: viktor.id,
        orgRole: "Legal counsel",
        raci: "C",
        interest: "MEDIUM",
        influence: "HIGH",
        commsPreference: "Email, gate sign-offs only",
      },
      {
        projectId: cloud.id,
        name: "Head of Infrastructure (IT)",
        orgRole: "Business owner",
        raci: "C",
        interest: "HIGH",
        influence: "HIGH",
        commsPreference: "Weekly steering call",
      },
    ],
  });

  // Blind selection round, in progress: Sofia submitted, Marco has not.
  const crit = selectionTemplate.criteria;
  const blindRound = await prisma.scoringRound.create({
    data: {
      projectId: cloud.id,
      templateId: selectionTemplate.id,
      name: "RFP evaluation",
      blind: true,
      status: "OPEN",
      evaluators: {
        create: [
          { userId: sofia.id, submittedAt: daysAgo(2) },
          { userId: marco.id },
        ],
      },
      suppliers: {
        create: [
          { supplierId: nimbus.id },
          { supplierId: helios.id },
          { supplierId: boreal.id },
        ],
      },
    },
  });
  const sofiaScores = [
    { supplier: nimbus.id, values: [3, 4, 4, 3, 4], pass: true },
    { supplier: helios.id, values: [4, 4, 3, 4, 3], pass: true },
    { supplier: boreal.id, values: [5, 3, 3, 3, 2], pass: false },
  ];
  for (const s of sofiaScores) {
    for (let i = 0; i < 5; i++) {
      await prisma.score.create({
        data: {
          roundId: blindRound.id,
          supplierId: s.supplier,
          criterionId: crit[i].id,
          evaluatorId: sofia.id,
          value: s.values[i],
        },
      });
    }
    await prisma.score.create({
      data: {
        roundId: blindRound.id,
        supplierId: s.supplier,
        criterionId: crit[5].id,
        evaluatorId: sofia.id,
        passed: s.pass,
        comment: s.pass ? null : "ISO 27001 certificate expired, renewal unconfirmed",
      },
    });
  }

  // ---------- project 2: contract renewal in negotiation ----------
  const mriRenewal = await prisma.project.create({
    data: {
      workspaceId: ws,
      name: "MRI Service Contract Renewal",
      description:
        "Renew or re-tender the MRI maintenance agreement. Single-source risk — see supplier record.",
      type: "CONTRACT_RENEWAL",
      kraljic: "BOTTLENECK",
      categoryId: clinical.id,
      rag: "RED",
      currency: "EUR",
      estimatedSpend: 600000,
      savingsTarget: 40000,
      savingsType: "AVOIDANCE",
      createdById: marco.id,
      createdAt: daysAgo(45),
      stages: {
        create: [
          {
            name: "Initiate",
            canonicalPhase: "INITIATE",
            order: 0,
            gateRequired: true,
            enteredAt: daysAgo(45),
            exitedAt: daysAgo(38),
          },
          {
            name: "Review & Market Check",
            canonicalPhase: "RESEARCH",
            order: 1,
            enteredAt: daysAgo(38),
            exitedAt: daysAgo(15),
          },
          {
            name: "Negotiation",
            canonicalPhase: "EVALUATION",
            order: 2,
            gateRequired: true,
            enteredAt: daysAgo(15),
          },
          {
            name: "Renewal Decision",
            canonicalPhase: "AWARD",
            order: 3,
            gateRequired: true,
          },
          { name: "Close-out", canonicalPhase: "CLOSEOUT", order: 4 },
        ],
      },
      suppliers: { create: [{ supplierId: medtech.id }] },
    },
    include: { stages: { orderBy: { order: "asc" } } },
  });
  await prisma.gateApproval.create({
    data: { stageId: mriRenewal.stages[2].id, approverId: dana.id },
  });
  await prisma.task.create({
    data: {
      projectId: mriRenewal.id,
      stageId: mriRenewal.stages[2].id,
      title: "Counter-proposal on uptime SLA penalties",
      status: "IN_PROGRESS",
      priority: "HIGH",
      assigneeId: marco.id,
      dueDate: daysAhead(3),
      order: 1,
    },
  });
  await prisma.raidEntry.create({
    data: {
      projectId: mriRenewal.id,
      type: "RISK",
      title: "Renewal notice window already breached",
      detail: "Auto-renewal clause may trigger at current pricing.",
      ownerId: marco.id,
      severity: "HIGH",
    },
  });

  // ---------- project 3: closed tender with realized savings ----------
  const cleaning = await prisma.project.create({
    data: {
      workspaceId: ws,
      name: "Facilities Cleaning Tender 2026",
      description: "Public-style tender for cleaning services across three sites.",
      type: "SOURCING",
      sourcingType: "RFT",
      kraljic: "NON_CRITICAL",
      categoryId: facilities.id,
      status: "CLOSED",
      rag: "GREEN",
      currency: "EUR",
      estimatedSpend: 450000,
      savingsTarget: 50000,
      savingsRealized: 62000,
      savingsType: "REDUCTION",
      baselineNote: "Prior contract rates, 2025 volumes",
      createdById: sofia.id,
      createdAt: daysAgo(200),
      closedAt: daysAgo(30),
      stages: {
        create: [
          {
            name: "Initiate",
            canonicalPhase: "INITIATE",
            order: 0,
            gateRequired: true,
            enteredAt: daysAgo(200),
            exitedAt: daysAgo(190),
          },
          {
            name: "Research",
            canonicalPhase: "RESEARCH",
            order: 1,
            enteredAt: daysAgo(190),
            exitedAt: daysAgo(160),
          },
          {
            name: "Sourcing Event",
            canonicalPhase: "SOURCING",
            order: 2,
            gateRequired: true,
            enteredAt: daysAgo(160),
            exitedAt: daysAgo(110),
          },
          {
            name: "Evaluation & Selection",
            canonicalPhase: "EVALUATION",
            order: 3,
            gateRequired: true,
            enteredAt: daysAgo(110),
            exitedAt: daysAgo(75),
          },
          {
            name: "Award & Onboarding",
            canonicalPhase: "AWARD",
            order: 4,
            gateRequired: true,
            enteredAt: daysAgo(75),
            exitedAt: daysAgo(45),
          },
          {
            name: "Close-out",
            canonicalPhase: "CLOSEOUT",
            order: 5,
            enteredAt: daysAgo(45),
            exitedAt: daysAgo(30),
          },
        ],
      },
      suppliers: { create: [{ supplierId: cleanCo.id }] },
    },
  });

  // ---------- project 4: onboarding at gated due diligence ----------
  const onboarding = await prisma.project.create({
    data: {
      workspaceId: ws,
      name: "Bright Ideas Agency Onboarding",
      type: "SUPPLIER_ONBOARDING",
      categoryId: marketing.id,
      rag: "GREEN",
      currency: "EUR",
      createdById: sofia.id,
      createdAt: daysAgo(10),
      stages: {
        create: [
          {
            name: "Initiate",
            canonicalPhase: "INITIATE",
            order: 0,
            enteredAt: daysAgo(10),
            exitedAt: daysAgo(7),
          },
          {
            name: "Due Diligence",
            canonicalPhase: "RESEARCH",
            order: 1,
            gateRequired: true,
            enteredAt: daysAgo(7),
          },
          {
            name: "Setup & Integration",
            canonicalPhase: "AWARD",
            order: 2,
          },
          { name: "Close-out", canonicalPhase: "CLOSEOUT", order: 3 },
        ],
      },
      suppliers: { create: [{ supplierId: brightAds.id }] },
    },
    include: { stages: { orderBy: { order: "asc" } } },
  });
  await prisma.gateApproval.create({
    data: { stageId: onboarding.stages[1].id, approverId: sofia.id },
  });
  await prisma.task.createMany({
    data: [
      {
        projectId: onboarding.id,
        stageId: onboarding.stages[1].id,
        title: "Conflict-of-interest declarations collected",
        status: "DONE",
        assigneeId: sofia.id,
        completedAt: daysAgo(2),
        order: 1,
      },
      {
        projectId: onboarding.id,
        stageId: onboarding.stages[1].id,
        title: "ESG questionnaire returned and reviewed",
        status: "IN_PROGRESS",
        assigneeId: sofia.id,
        dueDate: daysAhead(5),
        order: 2,
      },
    ],
  });

  // ---------- project 5: category review in analysis ----------
  await prisma.project.create({
    data: {
      workspaceId: ws,
      name: "Logistics Category Strategy Review",
      type: "CATEGORY_REVIEW",
      kraljic: "LEVERAGE",
      categoryId: logistics.id,
      rag: "GREEN",
      currency: "EUR",
      createdById: dana.id,
      createdAt: daysAgo(20),
      stages: {
        create: [
          {
            name: "Initiate",
            canonicalPhase: "INITIATE",
            order: 0,
            enteredAt: daysAgo(20),
            exitedAt: daysAgo(14),
          },
          {
            name: "Analysis",
            canonicalPhase: "RESEARCH",
            order: 1,
            enteredAt: daysAgo(14),
          },
          {
            name: "Strategy Definition",
            canonicalPhase: "EVALUATION",
            order: 2,
            gateRequired: true,
          },
          { name: "Close-out", canonicalPhase: "CLOSEOUT", order: 3 },
        ],
      },
    },
  });

  // ---------- project 6: closed performance review with revealed round ----------
  const courierReview = await prisma.project.create({
    data: {
      workspaceId: ws,
      name: "Q2 Courier Performance Review",
      type: "PERFORMANCE_REVIEW",
      categoryId: logistics.id,
      status: "CLOSED",
      rag: "GREEN",
      currency: "EUR",
      createdById: sofia.id,
      createdAt: daysAgo(60),
      closedAt: daysAgo(14),
      stages: {
        create: [
          {
            name: "Initiate",
            canonicalPhase: "INITIATE",
            order: 0,
            enteredAt: daysAgo(60),
            exitedAt: daysAgo(55),
          },
          {
            name: "Data Collection",
            canonicalPhase: "RESEARCH",
            order: 1,
            enteredAt: daysAgo(55),
            exitedAt: daysAgo(35),
          },
          {
            name: "Review & Scoring",
            canonicalPhase: "EVALUATION",
            order: 2,
            enteredAt: daysAgo(35),
            exitedAt: daysAgo(18),
          },
          {
            name: "Close-out",
            canonicalPhase: "CLOSEOUT",
            order: 3,
            enteredAt: daysAgo(18),
            exitedAt: daysAgo(14),
          },
        ],
      },
      suppliers: {
        create: [
          { supplierId: swiftParcel.id },
          { supplierId: nordicCourier.id },
        ],
      },
    },
  });
  const perfRound = await prisma.scoringRound.create({
    data: {
      projectId: courierReview.id,
      templateId: perfTemplate.id,
      name: "Q2 review",
      status: "REVEALED",
      revealedAt: daysAgo(18),
      evaluators: {
        create: [
          { userId: sofia.id, submittedAt: daysAgo(20) },
          { userId: marco.id, submittedAt: daysAgo(19) },
        ],
      },
      suppliers: {
        create: [
          { supplierId: swiftParcel.id },
          { supplierId: nordicCourier.id },
        ],
      },
    },
  });
  const perfScores: [string, string, number[]][] = [
    [sofia.id, swiftParcel.id, [4, 5, 4, 3]],
    [marco.id, swiftParcel.id, [4, 4, 4, 3]],
    [sofia.id, nordicCourier.id, [3, 3, 4, 2]],
    [marco.id, nordicCourier.id, [3, 2, 3, 2]],
  ];
  for (const [evaluatorId, supplierId, values] of perfScores) {
    for (let i = 0; i < values.length; i++) {
      await prisma.score.create({
        data: {
          roundId: perfRound.id,
          supplierId,
          criterionId: perfTemplate.criteria[i].id,
          evaluatorId,
          value: values[i],
        },
      });
    }
  }

  // ---------- contracts ----------
  await prisma.contract.create({
    data: {
      workspaceId: ws,
      supplierId: medtech.id,
      projectId: mriRenewal.id,
      title: "MRI Maintenance Agreement",
      reference: "NHG-2023-114",
      startDate: daysAgo(3 * 365),
      endDate: daysAhead(85),
      renewalNoticeDays: 90, // notice deadline already passed → overdue banner
      value: 580000,
      currency: "EUR",
      status: "ACTIVE",
      notes: "Auto-renews for 12 months at +4% if notice is not given.",
      keyDates: {
        create: [
          {
            title: "Liability insurance certificate expiry",
            date: daysAhead(40),
          },
          { title: "Annual SLA review", date: daysAgo(20), done: true },
        ],
      },
    },
  });
  await prisma.contract.create({
    data: {
      workspaceId: ws,
      supplierId: cleanCo.id,
      projectId: cleaning.id,
      title: "Cleaning Services Contract 2026–2029",
      reference: "NHG-2026-031",
      startDate: daysAgo(45),
      endDate: daysAhead(3 * 365),
      renewalNoticeDays: 180,
      value: 388000,
      currency: "EUR",
      status: "ACTIVE",
      keyDates: {
        create: [
          { title: "Quarterly SLA review", date: daysAhead(50) },
          { title: "Price indexation review", date: daysAhead(320) },
        ],
      },
    },
  });
  await prisma.contract.create({
    data: {
      workspaceId: ws,
      supplierId: swiftParcel.id,
      title: "Courier Services Agreement",
      reference: "NHG-2024-078",
      startDate: daysAgo(2 * 365),
      endDate: daysAhead(146),
      renewalNoticeDays: 60, // notice due in ~86 days → shows on the radar
      value: 120000,
      currency: "EUR",
      status: "ACTIVE",
    },
  });

  // ---------- comments ----------
  await prisma.comment.createMany({
    data: [
      {
        workspaceId: ws,
        entityType: "PROJECT",
        entityId: cloud.id,
        authorId: viktor.id,
        body: "Legal: DPA templates for all three bidders reviewed — no blockers for the evaluation gate. Flag the Boreal certificate issue before award.",
        createdAt: daysAgo(3),
      },
      {
        workspaceId: ws,
        entityType: "PROJECT",
        entityId: cloud.id,
        authorId: dana.id,
        body: "Steering committee wants the award decision before end of month — keep the scoring round moving.",
        createdAt: daysAgo(1),
      },
      {
        workspaceId: ws,
        entityType: "SUPPLIER",
        entityId: medtech.id,
        authorId: marco.id,
        body: "Escalated the SLA penalty question to their regional director; response promised this week.",
        createdAt: daysAgo(2),
      },
    ],
  });

  // ---------- activity ----------
  const activity: {
    entityType: string;
    entityId: string;
    projectId?: string;
    actorId: string;
    action: string;
    detail?: string;
    at: Date;
  }[] = [
    {
      entityType: "PROJECT",
      entityId: cloud.id,
      projectId: cloud.id,
      actorId: dana.id,
      action: "created project",
      detail: "Sourcing Event",
      at: daysAgo(90),
    },
    {
      entityType: "STAGE",
      entityId: evalStage.id,
      projectId: cloud.id,
      actorId: sofia.id,
      action: "advanced to stage “Evaluation & Selection”",
      detail: "left “Sourcing Event”",
      at: daysAgo(20),
    },
    {
      entityType: "SCORING_ROUND",
      entityId: blindRound.id,
      projectId: cloud.id,
      actorId: sofia.id,
      action: "opened scoring round “RFP evaluation” (blind)",
      at: daysAgo(14),
    },
    {
      entityType: "SCORING_ROUND",
      entityId: blindRound.id,
      projectId: cloud.id,
      actorId: sofia.id,
      action: "submitted their scores",
      at: daysAgo(2),
    },
    {
      entityType: "PROJECT",
      entityId: mriRenewal.id,
      projectId: mriRenewal.id,
      actorId: marco.id,
      action: "created project",
      detail: "Contract Renewal",
      at: daysAgo(45),
    },
    {
      entityType: "PROJECT",
      entityId: cleaning.id,
      projectId: cleaning.id,
      actorId: sofia.id,
      action: "closed project",
      detail: "savings realized €62,000 vs €50,000 target",
      at: daysAgo(30),
    },
  ];
  for (const a of activity) {
    await prisma.activityLog.create({
      data: {
        workspaceId: ws,
        entityType: a.entityType,
        entityId: a.entityId,
        projectId: a.projectId,
        actorId: a.actorId,
        action: a.action,
        detail: a.detail,
        occurredAt: a.at,
        recordedAt: a.at,
      },
    });
  }

  console.log("Seeded:");
  console.log("  Workspace: Nordic Health Group Procurement");
  console.log("  Users (log in with any, OTP prints to console):");
  console.log("    dana@productive.dev   — Admin");
  console.log("    sofia@productive.dev  — Member");
  console.log("    marco@productive.dev  — Member");
  console.log("    viktor@productive.dev — Viewer (legal, gate approver)");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
