import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";
import { C, M, CHART, LOAD, PLATE, BUILDING, YARD_SPOT, DECK_SPOT, OBSTACLES, barSvg, polySolid, boxFaces, superItems, hookSvg, loadSvg, capacityAt, reachFor } from "./parts.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const strip = (file) => readFileSync(join(HERE, file), "utf8").replace(/^import .*$/gm, "").replace(/^export /gm, "");

const WIDTH = 640;
const HEIGHT = 600;
const AZIMUTH = 45;

const extremes = [];
for (const [x, y] of k.corners(PLATE)) extremes.push([x, y, -16], [x, y, 0]);
for (let i = 0; i < 36; i++) {
  const a = (i / 36) * Math.PI * 2;
  extremes.push([C.jibTip * Math.cos(a), C.jibTip * Math.sin(a), C.jibTop], [C.jibTip * Math.cos(a), C.jibTip * Math.sin(a), C.jibZ - 4]);
}
extremes.push([0, 0, C.apex + 4]);
const P = k.fitProjection(extremes, WIDTH, HEIGHT, { pad: 14, azimuth: AZIMUTH });

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const bar = (a, b, w, tone = "mid") => barSvg(a, b, w, P, tone);
const box = (min, max) => polySolid(boxFaces([(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2], [(max[0] - min[0]) / 2, 0, 0], [0, (max[1] - min[1]) / 2, 0], [0, 0, (max[2] - min[2]) / 2]), P);

// Site plate on feet, with radius rings painted on it, a ruler and a label plate.
function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -16, 10, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 18))) {
    out.push(S(k.cylinder(x, y, 7, -16, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -14.4, 4.4, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -10, 10, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -4, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  return out.join("");
}

function rings() {
  const out = [];
  const inside = (x, y) => x > PLATE.x + 6 && x < PLATE.x + PLATE.w - 6 && y > PLATE.y + 6 && y < PLATE.y + PLATE.d - 6;
  for (const metres of [10, 20, 30, 40]) {
    const r = metres * M;
    out.push(L(k.ring(0, 0, r, 0, P, 160), { tone: metres % 20 ? "faint" : "lo" }));
  }
  // The 8 t radius: full rated load out to 22.6 m.
  out.push(L(k.ring(0, 0, CHART.full * M, 0, P, 160), { tone: "mid", dashed: true }));
  // Radial index every 30°, from the 10 m ring out to the 40 m ring.
  const spokes = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const from = [Math.cos(a) * 10 * M, Math.sin(a) * 10 * M];
    const to = [Math.cos(a) * 40 * M, Math.sin(a) * 40 * M];
    if (inside(...to)) spokes.push(k.lineOnTop(from, to, 0, P));
  }
  out.push(L(spokes.join(""), { tone: "faint" }));
  return out.join("");
}

function ruler() {
  const out = [];
  const bar0 = { x: 0, y: PLATE.y + PLATE.d - 13, w: 104, d: 6, r: 1 };
  out.push(S(k.slabOf(bar0, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(bar0.x + 2, bar0.x + 102, M, 10, bar0.y + 0.6, 0.6, [1.6, 3.4], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([bar0.x + 1, bar0.y + 4.6, 0.6]), at([bar0.x + bar0.w - 1, bar0.y + 4.6, 0.6])], { size: 0.4 }));
  const label = { x: PLATE.x + PLATE.w - 40, y: PLATE.y + PLATE.d - 30, w: 26, d: 16, r: 1.2 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 4), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([label.x + 3.6, label.y + 5.6], 0.8, P, "x"), "8 t · 60 m", { size: 2.6, tone: "mid" }));
  out.push(L([9, 11.6].map((dy, i) => k.lineOnTop([label.x + 3.6, label.y + dy], [label.x + (i ? 15 : 20), label.y + dy], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([label.x + 2, label.y + 14, 0.8]), at([label.x + label.w - 2, label.y + 14, 0.8])], { size: 0.4 }));
  return out.join("");
}

// Mast: foundation block, four chords, Warren bracing per face, splices, inner ladder and rest platforms.
function mast() {
  const h = C.mast;
  const out = [];
  const pad = { x: -15, y: -15, w: 30, d: 30, r: 1.5 };
  out.push(`<path class="iso-halo" d="${k.haloOf(pad, 0, 6, P)}" style="filter:blur(5px)"/>`);
  out.push(S(k.slabOf(pad, 0, C.mastBase, P, 3, 1), { tone: "mid", inner: L(k.sideSeam(pad, 2, P, 3), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(pad, 3), C.mastBase, P, 3), { tone: "faint" }));
  const joints = Array.from({ length: Math.round((C.mastTop - C.mastBase) / C.section) + 1 }, (_, i) => C.mastBase + i * C.section);
  const corner = ([x, y]) => {
    const parts = [];
    const anchor = { x: x - 1.8, y: y - 1.8, w: 3.6, d: 3.6, r: 0.4 };
    parts.push(bar([x, y, C.mastBase], [x, y, C.mastTop], 1.3));
    parts.push(S(k.slabOf(anchor, C.mastBase, 2.6, P, 2, 0.3), { tone: "mid" }));
    parts.push(D([at([x - 1.1, y + 1.1, C.mastBase + 2.6]), at([x + 1.1, y - 1.1, C.mastBase + 2.6])], { size: 0.4, tone: "mid" }));
    for (const z of joints.slice(1, -1)) {
      parts.push(S(k.slabOf({ x: x - 0.95, y: y - 0.95, w: 1.9, d: 1.9, r: 0.2 }, z - 0.6, 1.2, P, 2), { tone: "mid" }));
    }
    return parts.join("");
  };
  const corners = [[-h, -h], [h, -h], [h, h], [-h, h]];
  const face = (a, b) => {
    const parts = [];
    joints.forEach((z, i) => {
      parts.push(bar([a[0], a[1], z], [b[0], b[1], z], 0.55));
      if (i === joints.length - 1) return;
      const mid = z + C.section / 2;
      parts.push(bar([a[0], a[1], z], [b[0], b[1], mid], 0.5));
      parts.push(bar([b[0], b[1], mid], [a[0], a[1], z + C.section], 0.5));
    });
    return parts.join("");
  };
  const V = [Math.cos((AZIMUTH * Math.PI) / 180), Math.sin((AZIMUTH * Math.PI) / 180)];
  const faces = corners.map((a, i) => {
    const b = corners[(i + 1) % 4];
    const n = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    return { a, b, facing: n[0] * V[0] + n[1] * V[1] };
  });
  const sortedCorners = byDepth(corners);
  out.push(corner(sortedCorners[0]));
  faces.filter((f) => f.facing < 0).forEach((f) => out.push(face(f.a, f.b)));
  out.push(corner(sortedCorners[1]), corner(sortedCorners[2]));
  // Ladder and rest platforms inside the mast.
  for (let i = 0; i < joints.length - 1; i++) {
    const z0 = joints[i];
    const z1 = joints[i + 1];
    if (i % 2 === 1) {
      const deck = { x: -h + 0.8, y: -h + 0.8, w: 2 * h - 1.6, d: 2 * h - 1.6, r: 0.2 };
      const hatch = { x: 0.6, y: -1.8, w: 2.6, d: 3.6, r: 0.2 };
      out.push(S(k.slabOf(deck, z0 - 0.3, 0.3, P, 1), { tone: "lo", inner: L(k.planOutline(hatch, z0, P, 1), { tone: "faint" }) }));
    }
    const rungs = [];
    for (let z = z0 + 1.25; z < z1 - 0.1; z += 1.25) rungs.push(k.segment([1.9, -1.1, z], [1.9, 1.1, z], P));
    out.push(L(rungs.join(""), { tone: "lo" }));
    out.push(L(k.segment([1.9, -1.1, z0], [1.9, -1.1, z1], P) + k.segment([1.9, 1.1, z0], [1.9, 1.1, z1], P), { tone: "mid" }));
  }
  faces.filter((f) => f.facing > 0).forEach((f) => out.push(face(f.a, f.b)));
  out.push(corner(sortedCorners[3]));
  // Mast head: a slewing support frame and the lower race of the slewing ring.
  out.push(S(k.slabOf({ x: -h - 1.5, y: -h - 1.5, w: 2 * h + 3, d: 2 * h + 3, r: 0.6 }, C.mastTop - 1, 2.6, P, 2, 0.4), { tone: "mid" }));
  out.push(D(k.corners({ x: -h - 1.5, y: -h - 1.5, w: 2 * h + 3, d: 2 * h + 3 }, 1).map(([x, y]) => at([x, y, C.mastTop + 1.6])), { size: 0.4, tone: "mid" }));
  out.push(S(k.cylinder(0, 0, C.ringR + 0.4, C.mastTop + 1.6, 1.6, P, 48), { tone: "mid" }));
  return out.join("");
}

// A two-storey concrete frame under construction: slabs, columns, starter bars, edge protection.
function building() {
  const b = BUILDING;
  const plan = { x: b.x, y: b.y, w: b.w, d: b.d, r: 0.6 };
  const out = [`<path class="iso-halo" d="${k.haloOf(plan, 0, b.deck, P)}"/>`];
  const cols = [];
  for (const x of [b.x + 2, b.x + b.w / 2, b.x + b.w - 2]) for (const y of [b.y + 2, b.y + b.d / 2, b.y + b.d - 2]) cols.push([x, y]);
  const levels = [[0, 1.6], [14, 1.6], [28.4, 1.6]];
  levels.forEach(([z, t], i) => {
    out.push(S(k.slabOf(plan, z, t, P, 2, 0.4), { tone: "mid", inner: i ? L(k.sideSeam(plan, z + 0.6, P, 2), { tone: "faint" }) : "" }));
    if (i === levels.length - 1) return;
    const top = z + t;
    const next = levels[i + 1][0];
    for (const [x, y] of byDepth(cols)) {
      const col = { x: x - 1.2, y: y - 1.2, w: 2.4, d: 2.4, r: 0.2 };
      out.push(S(k.slabOf(col, top, next - top, P, 1), { tone: "mid" }));
    }
    if (i === 0) {
      // Back-propping under the first-floor slab.
      for (const [x, y] of byDepth([[b.x + 12, b.y + 9], [b.x + 34, b.y + 9], [b.x + 12, b.y + 27], [b.x + 34, b.y + 27]])) {
        out.push(L(k.rise([x, y], top, next, P), { tone: "lo" }));
        out.push(D([at([x, y, top]), at([x, y, next])], { size: 0.45, tone: "mid" }));
      }
    }
  });
  const deck = b.deck;
  // Formwork joints on the fresh deck, edge to edge.
  const joints = [];
  for (let x = b.x + 9.2; x < b.x + b.w - 1; x += 9.2) joints.push(k.lineOnTop([x, b.y], [x, b.y + b.d], deck, P));
  out.push(L(joints.join(""), { tone: "faint" }));
  // Starter bars out of the columns, ending on a dot.
  const tips = [];
  const bars = [];
  for (const [x, y] of byDepth(cols)) {
    for (const [dx, dy] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) {
      bars.push(k.rise([x + dx, y + dy], deck, deck + 3.4, P));
      tips.push(at([x + dx, y + dy, deck + 3.4]));
    }
  }
  out.push(L(bars.join(""), { tone: "mid" }), D(tips, { size: 0.35, tone: "mid" }));
  // Edge protection on the far edges, posts and two rails.
  const rail = [[b.x + 0.8, b.y + b.d - 0.8], [b.x + 0.8, b.y + 0.8], [b.x + b.w - 0.8, b.y + 0.8]];
  const posts = [];
  for (let i = 0; i < rail.length - 1; i++) {
    const [a, c] = [rail[i], rail[i + 1]];
    const n = Math.round(Math.hypot(c[0] - a[0], c[1] - a[1]) / 9);
    for (let j = 0; j <= n; j++) posts.push([a[0] + ((c[0] - a[0]) * j) / n, a[1] + ((c[1] - a[1]) * j) / n]);
  }
  for (const [x, y] of byDepth(posts.filter((p, i, list) => list.findIndex((q) => q[0] === p[0] && q[1] === p[1]) === i))) out.push(bar([x, y, deck], [x, y, deck + 5], 0.4));
  out.push(k.lineSvg(k.onTop(rail, deck + 5, P) + k.onTop(rail, deck + 2.6, P), { tone: "mid" }));
  return out.join("");
}

// Yard: brick pallets on timber, and a site cabin.
function pallets() {
  const out = [];
  const spots = byDepth([[59, -66], [70, -66], [59, -56], [70, -56]]);
  for (const [x, y] of spots) {
    const base = { x: x - 4.4, y: y - 3.6, w: 8.8, d: 7.2, r: 0.3 };
    out.push(S(k.slabOf(base, 0, 1, P, 1), { tone: "lo", inner: L(k.sideSeam(base, 0.5, P, 1), { tone: "faint" }) }));
    const stack = { x: x - 4, y: y - 3.2, w: 8, d: 6.4, r: 0.3 };
    const courses = [1.8, 2.6, 3.4, 4.2].map((z) => L(k.sideSeam(stack, z, P, 1), { tone: "faint" })).join("");
    out.push(S(k.slabOf(stack, 1, 4, P, 1, 0.3), { tone: "mid", inner: courses }));
    out.push(L(k.lineOnTop([x - 1.6, y - 3.2], [x - 1.6, y + 3.2], 5, P) + k.lineOnTop([x + 1.6, y - 3.2], [x + 1.6, y + 3.2], 5, P), { tone: "lo" }));
  }
  return out.join("");
}

function cabin() {
  const plan = { x: 10, y: 76, w: 26, d: 12, r: 0.4 };
  const out = [`<path class="iso-halo" d="${k.haloOf(plan, 0, 10, P)}" style="filter:blur(5px)"/>`];
  const ribs = [];
  for (let x = plan.x + 2; x < plan.x + plan.w - 1; x += 2) ribs.push(k.segment([x, plan.y + plan.d, 0.6], [x, plan.y + plan.d, 9.4], P));
  for (let y = plan.y + 2; y < plan.y + plan.d - 1; y += 2) ribs.push(k.segment([plan.x + plan.w, y, 0.6], [plan.x + plan.w, y, 9.4], P));
  out.push(S(k.slabOf(plan, 0, 10, P, 1, 0.4), { tone: "mid", inner: L(ribs.join(""), { tone: "faint" }) + L(k.sideSeam(plan, 0.6, P, 1) + k.sideSeam(plan, 9.4, P, 1), { tone: "lo" }) }));
  const door = [[plan.x + 4, plan.y + plan.d, 0.6], [plan.x + 4, plan.y + plan.d, 7.6], [plan.x + 8, plan.y + plan.d, 7.6], [plan.x + 8, plan.y + plan.d, 0.6]];
  const win = (x0, x1) => [[x0, plan.y + plan.d, 4], [x0, plan.y + plan.d, 7.4], [x1, plan.y + plan.d, 7.4], [x1, plan.y + plan.d, 4]];
  out.push(`<path class="cr-glass" d="${k.pathOf(win(plan.x + 12, plan.x + 18).map(at), true)}"/><path class="cr-glass" d="${k.pathOf(win(plan.x + 20, plan.x + 24).map(at), true)}"/>`);
  out.push(`<path class="cr-door" d="${k.pathOf(door.map(at), true)}"/>`);
  out.push(D([at([plan.x + 7.2, plan.y + plan.d, 4])], { size: 0.45, tone: "hi" }));
  const step = { x: plan.x + 3.4, y: plan.y + plan.d, w: 5.2, d: 2.4, r: 0.2 };
  out.push(S(k.slabOf(step, 0, 0.8, P, 1), { tone: "lo" }));
  // Roof with a small overhang and a vent box.
  out.push(S(k.slabOf(k.insetPlan(plan, -0.5), 10, 0.6, P, 1, 0.2), { tone: "mid" }));
  out.push(S(k.slabOf({ x: plan.x + 18, y: plan.y + 3, w: 3, d: 3, r: 0.3 }, 10.6, 1.4, P, 1), { tone: "mid" }));
  return out.join("");
}

// Static items that sort against the hook and the load, keyed by floor depth.
const statics = [
  { id: "mast", key: k.depthOf([0, 0, 0], P), svg: mast() },
  { id: "building", key: k.depthOf([BUILDING.x + BUILDING.w / 2, BUILDING.y + BUILDING.d / 2, 0], P), svg: building() },
  { id: "pallets", key: k.depthOf([64.5, -61, 0], P), svg: pallets() },
  { id: "cabin", key: k.depthOf([23, 82, 0], P), svg: cabin() },
];

// Rest pose for the first paint: the tour's opening position over the yard.
const theta0 = Math.atan2(YARD_SPOT.y, YARD_SPOT.x);
const u0 = Math.hypot(YARD_SPOT.x, YARD_SPOT.y);
const supers = superItems(P, theta0, u0).sort((a, b) => a.key - b.key).map((item) => item.svg).join("");

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A flat-top tower crane on a site plate, drawn as a model. A lattice mast on a concrete foundation carries the slewing ring, the turntable with the operator's cab, a tower head with ties, a 60 metre jib with a trolley, and a counter-jib with the hoist winch and four ballast blocks. The trolley's hook lifts a bundle of steel beams from the yard onto the deck of a two-storey concrete frame.",
  body: [
    `<g class="cr-ground">${plate()}${rings()}${ruler()}</g>`,
    `<g class="cr-marks" data-part="marks"></g>`,
    `<g class="cr-low" data-part="low">${statics.map((s) => `<g data-static="${s.id}">${s.svg}</g>`).join("")}<g data-part="load"></g><g data-part="hook"></g></g>`,
    `<g class="cr-high" data-part="high">${supers}</g>`,
  ],
});

const DATA = {
  P,
  C,
  M,
  CHART,
  LOAD,
  BUILDING,
  YARD_SPOT,
  DECK_SPOT,
  OBSTACLES,
  PLATE,
  statics: statics.map(({ id, key }) => ({ id, key })),
};

const live = `${strip("parts.mjs")}
const DATA = ${JSON.stringify(DATA)};
${readFileSync(join(HERE, "live.js"), "utf8")}`;

const css = `
.cr-bar path{fill:none;stroke-linecap:round;stroke-linejoin:round;vector-effect:none}
.cr-bar .cr-o{stroke:var(--anatomy-mid)}
.cr-bar[data-tone="hi"] .cr-o{stroke:var(--anatomy-hi)}
.cr-bar[data-tone="lo"] .cr-o{stroke:var(--anatomy-lo)}
.cr-bar[data-tone="lit"] .cr-o{stroke:var(--anatomy-lit)}
.cr-bar .cr-i{stroke:var(--anatomy-top)}
.cr-bar[data-butt] path{stroke-linecap:butt}
.cr-bar[data-tone="lit"] .cr-i{stroke:var(--anatomy-lit-top)}
.cr-glass{fill:var(--anatomy-shade-0);stroke:var(--anatomy-lo);stroke-width:var(--anatomy-weight);stroke-linejoin:round;vector-effect:non-scaling-stroke}
.cr-door{fill:var(--anatomy-shade-1);stroke:var(--anatomy-mid);stroke-width:var(--anatomy-weight);stroke-linejoin:round;vector-effect:non-scaling-stroke}
.iso-line.cr-rope{stroke-width:.8}
.cr-plate{fill:none;stroke:var(--anatomy-lo);stroke-width:var(--anatomy-weight);stroke-linejoin:round;vector-effect:non-scaling-stroke}
.cr-limit{transition:opacity .4s var(--anatomy-ease)}
.iso-stage{outline:none;touch-action:none;cursor:crosshair}
.iso-stage:focus-visible{box-shadow:0 0 0 1px var(--anatomy-mid)}
`;

const body = `<style>${css}</style>` + k.plateHtml({
  fig: "Fig 1",
  title: "Tower crane",
  hint: "Point to slew · click to lift or set down",
  readout: `R ${(u0 / M).toFixed(1)} m · hook free · ${capacityAt(u0 / M).toFixed(1)} t here`,
  keys: [
    { mark: "lit", label: "Hoist rope and hook: what you steer" },
    { mark: "raised", label: `Load: three steel beams, ${LOAD.mass.toFixed(2)} t` },
    { mark: "dashed", label: `Rings every 10 m; dashed, the 8 t radius (${CHART.full} m)` },
  ],
  caption:
    `An 8 t flat-top tower crane with a 60 m jib, 40 m under the hook block. It lifts 8 t out to ${CHART.full} m; beyond that the rated load falls as the moment grows, to 1.9 t at the tip. With the ${LOAD.mass.toFixed(2)} t beams on, the load-moment limiter stops the trolley at ${reachFor(LOAD.mass).toFixed(1)} m, drawn as a lit ring. Motion runs about five times faster than a real crane.`,
  body: `<div class="iso-stage" tabindex="0" role="application" aria-label="Tower crane. Arrow keys slew and move the trolley, Enter lifts or sets down the load.">${svg}</div>`,
});

const name = theme === "light" ? "crane-light.html" : "crane.html";
writeFileSync(join(HERE, name), k.pageHtml({ title: "Tower crane", theme, body, script: strip("kit/iso-kit.mjs") + live, width: 760 }));
console.log("wrote", name, (readFileSync(join(HERE, name)).length / 1024).toFixed(0) + " KB");
