// Doptelet (avatrombopag maleate) as a ball-and-stick model on a bench stand.
// node build.mjs [--light]  →  doptelet.html / doptelet-light.html
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";
import * as G from "./kit/lathe.mjs";
import { kitScript } from "./kit/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const M = JSON.parse(readFileSync(join(HERE, "molecule.json"), "utf8"));

const WIDTH = 640;
const HEIGHT = 400;
const ANG = 9.6; // world units per ångström: the ruler on the base reads true
const LIFT = 104; // height of the model's centre above the plate

const PLATE = { x: -170, y: -58, w: 368, d: 120, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;
const CARRIAGE_Z = 3;
const CARRIAGE_TOP = 9;
const TABLET = [-132, 30];

// Ball and rod sizes: a quarter of the van der Waals radius, rods 0.13 Å.
const VDW = { C: 1.7, N: 1.55, O: 1.52, S: 1.8, Cl: 1.75 };
const radiusOf = (el) => VDW[el] * 0.26 * ANG;
const ROD = 0.13 * ANG;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [-120, -10, LIFT + 50], [100, 0, LIFT + 50]],
  WIDTH,
  HEIGHT,
  { pad: 22, azimuth: 60 },
);
const V = G.viewOf(P);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

// Molecule frame: long axis along x, second axis up, third into the depth.
const place = ([a, b, c], origin) => [origin[0] + a * ANG, origin[1] + c * ANG, origin[2] + b * ANG];
const ATOMS = M.atoms.map((atom, i) => ({ ...atom, i, w: place(atom.p, [0, 0, LIFT]), r: radiusOf(atom.el) }));
const BONDS = M.bonds;

// The salt forms on the most basic nitrogen: the piperazine N that carries the cyclohexyl.
const BASIC = ATOMS.find((a) => a.el === "N" && a.frag === "piperazine" && BONDS.some(([p, q]) => [p, q].includes(a.i) && ATOMS[p + q - a.i].frag === "cyclohexyl"));
const MAL = M.maleate.atoms.map((atom, i) => ({ ...atom, i, r: radiusOf(atom.el) }));
// Maleate stands in front of the basic N; its nearest oxygen sits 2.7 Å from it when docked.
const malLocal = MAL.map((a) => place(a.p, [0, 0, 0]));
const hydroxyl = malLocal.reduce((best, p, i) => (MAL[i].el === "O" && p[0] < malLocal[best][0] ? i : best), 0);
// Docked, the acid's hydroxyl oxygen sits 2.7 Å from the nitrogen, in front of it. Of those
// spots, take the one where the maleate and its post cover the least of the molecule on screen.
const spin = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a), p[2]];
const DOCK = (() => {
  const flat = ATOMS.map((a) => ({ c: at(a.w), r: a.r * P.scale }));
  let best = null;
  for (let turn = 0; turn < 360; turn += 15) {
    const local = malLocal.map((p) => spin(p, (turn * Math.PI) / 180));
    for (const o of local.map((_, i) => i).filter((i) => MAL[i].el === "O"))
      for (let t = -1; t <= 1.001; t += 0.1)
        for (let u = 0.1; u <= 1.001; u += 0.1) {
          if (1 - t * t - u * u < 0) continue;
          const dir = [t, u, Math.sqrt(1 - t * t - u * u)];
          const shift = G.sub3(G.add3(BASIC.w, G.mul3(dir, 2.7 * ANG)), local[o]);
          const balls = local.map((p, i) => ({ w: G.add3(p, shift), r: MAL[i].r }));
          const low = balls.reduce((a, b) => (b.w[2] - b.r < a.w[2] - a.r ? b : a));
          const marks = [...balls.map((b) => ({ c: at(b.w), r: b.r * P.scale })), ...Array.from({ length: 12 }, (_, i) => ({ c: at([low.w[0], low.w[1], low.w[2] * (i / 12)]), r: 2.4 * P.scale }))];
          let cover = 0;
          for (const m of marks) for (const f of flat) cover += Math.max(0, m.r + f.r + 3 - Math.hypot(m.c[0] - f.c[0], m.c[1] - f.c[1]));
          if (!best || cover < best.cover) best = { cover, shift, turn };
        }
  }
  console.error("dock cover", best.cover.toFixed(1), "turn", best.turn, best.shift.map((v) => v.toFixed(1)).join(" "));
  malLocal.forEach((p, i) => (malLocal[i] = spin(p, (best.turn * Math.PI) / 180)));
  return best.shift;
})();
const DOCK_Y = DOCK[1];
const RAIL_Y = DOCK_Y;
const malZ = DOCK[2];
const DOCK_X = DOCK[0];
// Apart, the carriage runs right until the maleate clears the molecule on screen.
const coverAt = (dx) => {
  const balls = malLocal.map((p, i) => ({ c: at(G.add3(G.add3(p, DOCK), [dx, 0, 0])), r: MAL[i].r * P.scale }));
  let cover = 0;
  for (const b of balls) for (const a of ATOMS) { const c = at(a.w); cover += Math.max(0, b.r + a.r * P.scale + 4 - Math.hypot(b.c[0] - c[0], b.c[1] - c[1])); }
  return cover;
};
let reach = 40;
while (coverAt(reach) > 0 && DOCK[0] + reach < 158) reach += 2;
const APART_X = DOCK[0] + reach;
const CARRIAGE = { x: DOCK_X - 20, y: RAIL_Y - 12, w: 40, d: 24, r: 3 };
const RAIL_FROM = DOCK_X - 30;
const RAIL_TO = APART_X + 30;
const malAt = (p) => [p[0] + DOCK_X, p[1] + DOCK_Y, p[2] + malZ];

function rod(a, b, r, style) {
  const axis = G.sub3(b, a);
  const len = G.len3(axis);
  return S(G.disc(0, len, r, G.frameAlong(a, G.unit3(axis)), P), style);
}

// A bond runs rim-on-sphere: each end stops where the rod's rim meets its ball.
function bondItems(atoms, bonds, owner) {
  return bonds.flatMap(([p, q, order]) => {
    const A = atoms[p];
    const B = atoms[q];
    const axis = G.unit3(G.sub3(B.w, A.w));
    const side = G.unit3(G.cross3(axis, V));
    const offsets = order === 2 ? [-0.62, 0.62].map((o) => o * ROD * 1.9) : [0];
    const r = order === 2 ? ROD * 0.78 : ROD;
    return offsets.map((o) => {
      const shift = G.mul3(side, o);
      const a = G.add3(G.add3(A.w, G.mul3(axis, Math.sqrt(A.r * A.r - (Math.abs(o) + r) ** 2))), shift);
      const b = G.add3(G.add3(B.w, G.mul3(axis, -Math.sqrt(B.r * B.r - (Math.abs(o) + r) ** 2))), shift);
      const frag = A.frag === B.frag ? A.frag : "";
      return {
        depth: k.depthOf(G.lerp3(a, b, 0.5), P),
        svg: `<g class="bond"${frag ? ` data-frag="${frag}"` : ""}>${rod(a, b, r, { tone: "mid", crease: "none" })}</g>`,
        owner,
      };
    });
  });
}

const atomItem = (atom, extra = "") => ({
  depth: k.depthOf(atom.w, P),
  svg: `<g class="atom el-${atom.el}"${extra}>${S(G.sphereOf(atom.w, atom.r, P), { tone: "hi" })}</g>`,
});

function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -5, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // Ångström ruler: minor tick per ångström, major every 5 Å, zero under the acid end.
  const zero = Math.min(...ATOMS.map((a) => a.w[0] - a.r));
  const strip = { x: -136, y: PLATE.y + PLATE.d - 14, w: 272, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const from = zero - Math.floor((zero - strip.x - 3) / ANG) * ANG;
  const ticks = k.topTicks(from, strip.x + strip.w - 3, ANG, 5, strip.y + 0.8, 0.6, [2, 3.8], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(L(k.lineOnTop([zero, strip.y + 0.8], [zero, strip.y + 5.6], 0.6, P), { tone: "hi" }));
  out.push(D([at([strip.x + 1.6, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 1.6, strip.y + 3.5, 0.6])], { size: 0.45 }));
  // Label plate, back left: three rule lines for the printed specification.
  const label = { x: -138, y: -50, w: 46, d: 22, r: 1.5 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 4), { tone: "faint" }));
  [[30, 6], [22, 11], [26, 16]].forEach(([len, y]) => out.push(L(k.lineOnTop([label.x + 6, label.y + y], [label.x + 6 + len, label.y + y], 0.8, P), { tone: "lo", free: true })));
  out.push(D([at([label.x + 3, label.y + 3, 0.8]), at([label.x + label.w - 3, label.y + label.d - 3, 0.8])], { size: 0.45 }));
  return out.join("");
}

function rails() {
  const out = [];
  for (const y of [RAIL_Y - 9, RAIL_Y + 5]) {
    out.push(S(k.slabOf({ x: RAIL_FROM, y, w: RAIL_TO - RAIL_FROM, d: 4, r: 1 }, 0, 3, P, 3, 0.4), { tone: "mid" }));
    out.push(D([RAIL_FROM + 6, RAIL_TO - 6].map((x) => at([x, y + 2, 3])), { size: 0.4 }));
  }
  for (const x of [RAIL_FROM - 5, RAIL_TO]) {
    out.push(S(k.slabOf({ x, y: RAIL_Y - 12, w: 5, d: 24, r: 1.2 }, 0, 7, P, 3, 0.5), { tone: "mid" }));
    out.push(D([at([x + 2.5, RAIL_Y - 8, 7]), at([x + 2.5, RAIL_Y + 8, 7])], { size: 0.45 }));
  }
  return out.join("");
}

// Three stands hold the model under its lowest balls, one per region.
const STANDS = [
  ["acid", "pyridine"],
  ["thiazole", "thiophene"],
  ["cyclohexyl", "piperazine"],
].map((frags) => ATOMS.filter((a) => frags.includes(a.frag)).reduce((low, a) => (a.w[2] - a.r < low.w[2] - low.r ? a : low)));

function standItems() {
  return STANDS.map((atom) => {
    const [x, y, z] = atom.w;
    const pin = 1.3;
    const top = z - Math.sqrt(atom.r * atom.r - pin * pin);
    const out = [];
    out.push(S(k.cylinder(x, y, 7, 0, 3, P, 28), { tone: "lo" }));
    out.push(D(k.corners({ x: x - 7, y: y - 7, w: 14, d: 14, r: 7 }, 2.4).map(([px, py]) => at([px, py, 3])).slice(0, 0), { size: 0.4 }));
    out.push(S(k.cylinder(x, y, 4.4, 3, 6, P, 28), { tone: "mid" }));
    out.push(L(k.knurl(x, y, 4.4, 4, 8, 24, P), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 2.4, 9, top - 12 - 9, P, 20), { tone: "mid", crease: "none", inner: L(k.sideArc(x, y, 2.4, (top - 3) / 2, P, 16), { tone: "faint" }) }));
    out.push(S(k.cylinder(x, y, 3.2, top - 12, 4, P, 20), { tone: "mid" }));
    out.push(S(k.cylinder(x, y, pin, top - 8, 8, P, 12), { tone: "hi", crease: "none" }));
    return { depth: k.depthOf([x, y, top - 4], P) - 6, svg: `<g class="stand">${out.join("")}</g>` };
  });
}

function carriage() {
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(CARRIAGE, 3), CARRIAGE_Z, 0.1, P)}" style="filter:blur(4px)"/>`];
  out.push(S(k.slabOf(CARRIAGE, CARRIAGE_Z, CARRIAGE_TOP - CARRIAGE_Z, P, 5, 0.6), { tone: "mid", inner: L(k.sideSeam(CARRIAGE, 6, P, 5), { tone: "faint" }) }));
  out.push(D([-14, -5, 5, 14].map((x) => at([DOCK_X + x, CARRIAGE.y + CARRIAGE.d - 2.4, CARRIAGE_TOP])), { size: 0.4, tone: "lo" }));
  const handle = [CARRIAGE.x + CARRIAGE.w - 8, CARRIAGE.y + CARRIAGE.d + 3];
  out.push(S(k.slabOf({ x: handle[0] - 2, y: CARRIAGE.y + CARRIAGE.d - 1, w: 4, d: 4, r: 1 }, CARRIAGE_Z + 1, 3, P, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(handle[0], handle[1] + 1, 3, CARRIAGE_Z, 5, P, 20), { tone: "mid" }));
  out.push(L(k.knurl(handle[0], handle[1] + 1, 3, CARRIAGE_Z, CARRIAGE_Z + 5, 18, P), { tone: "lo" }));
  // Post up to the maleate's lowest ball.
  const low = MAL.reduce((best, a, i) => (malAt(malLocal[i])[2] - a.r < malAt(malLocal[best])[2] - MAL[best].r ? i : best), 0);
  const [x, y, z] = malAt(malLocal[low]);
  const pin = 1.2;
  const top = z - Math.sqrt(MAL[low].r ** 2 - pin * pin);
  out.push(S(k.cylinder(x, y, 5, CARRIAGE_TOP, 4, P, 24), { tone: "mid" }));
  out.push(L(k.knurl(x, y, 5, CARRIAGE_TOP + 0.6, CARRIAGE_TOP + 3.4, 24, P), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, 2.2, CARRIAGE_TOP + 4, top - 10 - CARRIAGE_TOP - 4, P, 20), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(x, y, 3, top - 10, 3, P, 20), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, pin, top - 7, 7, P, 12), { tone: "hi", crease: "none" }));
  const balls = MAL.map((a, i) => ({ ...a, w: malAt(malLocal[i]) }));
  const items = [...balls.map((a) => atomItem(a, ` data-frag="maleate"`)), ...bondItems(balls, M.maleate.bonds, "mal").map((b) => ({ ...b, svg: b.svg.replace('class="bond"', 'class="bond" data-frag="maleate"') }))];
  out.push(items.sort((a, b) => a.depth - b.depth).map((i) => i.svg).join(""));
  return out.join("");
}

function tablet() {
  const [x, y] = TABLET;
  const out = [];
  out.push(S(k.cylinder(x, y, 15, 0, 2, P, 40), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, 12.5, 2, 9, P, 40, 0.5), { tone: "mid", inner: L(k.sideArc(x, y, 12.5, 4, P, 32), { tone: "faint" }) }));
  out.push(L(k.ring(x, y, 9.5, 11, P, 40), { tone: "faint" }));
  // Round, biconvex, film-coated: a cup on each face and a straight band between.
  const F = G.frameAlong([x, y, 11], [0, 0, 1]);
  const R = 10.5;
  const cup = (s0, s1) => Array.from({ length: 7 }, (_, i) => {
    const t = i / 6;
    return [s0 + (s1 - s0) * t, Math.sqrt(1 - (1 - t) ** 2) * (R - 0.8) + 0.8 * t, 1];
  });
  const lower = cup(0, 2.2).map(([s, r]) => [s, r, 1]);
  const upper = cup(6.6, 4.4).map(([s, r]) => [s, r, 1]).reverse();
  const meridian = [[0, 0], ...lower.slice(1, -1), [2.2, R], [4.4, R], ...upper.slice(1, -1), [6.6, 0]];
  out.push(`<g class="tablet">${S(G.lathe(meridian, F, P, { rims: "none" }), { tone: "hi", inner: L(G.arcOf(F, 3.3, R, P), { tone: "faint" }) })}</g>`);
  out.push(k.faceTextSvg(k.topMatrix([x, y + 2.2], 17.6, P, "x"), "AVA", { size: 4.4, tone: "lo", anchor: "middle" }));
  return out.join("");
}

const items = [
  ...standItems(),
  ...ATOMS.map((a) => atomItem(a, ` data-frag="${a.frag}"`)),
  ...bondItems(ATOMS, BONDS, "ava"),
].sort((a, b) => a.depth - b.depth);

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A ball-and-stick model of avatrombopag, the active ingredient of Doptelet, held on three stands above a bench plate with an ångström ruler. A small carriage on rails carries a maleic acid model that docks against the piperazine nitrogen to form the maleate salt. A yellow tablet stamped AVA sits on a pedestal in front.",
  body: [
    plate(),
    rails(),
    `<g data-part="model">${items.map((i) => i.svg).join("")}</g>`,
    `<g data-part="carriage" transform="${k.translateAlong(P, [APART_X - DOCK_X, 0, 0])}">${carriage()}</g>`,
    tablet(),
  ],
});

const formulaOf = (count) =>
  ["C", "H", "Cl", "N", "O", "S"]
    .filter((el) => count[el])
    .map((el) => el + (count[el] > 1 ? String(count[el]).replace(/\d/g, (d) => "₀₁₂₃₄₅₆₇₈₉"[d]) : ""))
    .join("");
const SHORT = { acid: "Piperidine acid", pyridine: "Chloropyridine amide", thiazole: "Thiazole", thiophene: "Chlorothiophene", piperazine: "Piperazine", cyclohexyl: "Cyclohexyl" };
const PARTS = [
  ...M.fragments.map((f) => ({ key: f.key, name: f.name, short: SHORT[f.key], formula: formulaOf(f.count), mass: f.mass })),
  { key: "maleate", name: "Maleic acid (counter-ion)", short: "Maleate", formula: "C₄H₄O₄", mass: M.maleate.mass },
];
const BASE_MASS = M.mass;
const SALT_MASS = +(M.mass + M.maleate.mass).toFixed(2);

const STYLE = `<style>
.iso{--el-c0:var(--anatomy-shade-0);--el-c1:var(--anatomy-shade-1);--el-c2:var(--anatomy-shade-2);--el-c3:var(--anatomy-shade-3)}
.el-N{--anatomy-shade-0:#b4c2da;--anatomy-shade-1:#c3cfe4;--anatomy-shade-2:#d2dcee;--anatomy-shade-3:#e2e9f6}
.el-O{--anatomy-shade-0:#dcb6b0;--anatomy-shade-1:#e6c5c0;--anatomy-shade-2:#eed4d0;--anatomy-shade-3:#f6e4e1}
.el-S{--anatomy-shade-0:#ddca8c;--anatomy-shade-1:#e7d6a0;--anatomy-shade-2:#efe1b5;--anatomy-shade-3:#f6ecce}
.el-Cl{--anatomy-shade-0:#b2d0ac;--anatomy-shade-1:#c2dbbd;--anatomy-shade-2:#d2e6ce;--anatomy-shade-3:#e2f0df}
.tablet{--anatomy-shade-0:#e3c766;--anatomy-shade-1:#ebd37f;--anatomy-shade-2:#f2df9a;--anatomy-shade-3:#f8eab6}
.iso[data-theme="dark"] .el-N{--anatomy-shade-0:#18202c;--anatomy-shade-1:#1d2635;--anatomy-shade-2:#232d3f;--anatomy-shade-3:#29354a}
.iso[data-theme="dark"] .el-O{--anatomy-shade-0:#2c1b19;--anatomy-shade-1:#35211f;--anatomy-shade-2:#3e2724;--anatomy-shade-3:#482e2b}
.iso[data-theme="dark"] .el-S{--anatomy-shade-0:#2b2512;--anatomy-shade-1:#342d16;--anatomy-shade-2:#3e361b;--anatomy-shade-3:#493f20}
.iso[data-theme="dark"] .el-Cl{--anatomy-shade-0:#172619;--anatomy-shade-1:#1c2e1e;--anatomy-shade-2:#223724;--anatomy-shade-3:#28412b}
.iso[data-theme="dark"] .tablet{--anatomy-shade-0:#2e2710;--anatomy-shade-1:#383014;--anatomy-shade-2:#433a19;--anatomy-shade-3:#4f451f}
${PARTS.map((p) => `svg[data-show="${p.key}"] [data-frag="${p.key}"] .iso-edge{stroke:var(--anatomy-lit);stroke-width:1}`).join("\n")}
.iso-edge{transition:stroke .25s}
@media (max-width:560px){.iso-plate-corner[data-corner="readout"]{white-space:normal;max-width:72%;text-align:right;line-height:1.3}.iso-plate-corner[data-corner="hint"]{display:none}}
</style>`;

const keyColour = (el) => `<span class="el-key el-${el}"></span>`;
const live = `
const P = ${JSON.stringify(P)};
const PARTS = ${JSON.stringify(PARTS)};
const BASE = ${BASE_MASS}, SALT = ${SALT_MASS};
const SPAN = ${APART_X - DOCK_X};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const carriage = svg.querySelector('[data-part="carriage"]');
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const atoms = [...svg.querySelectorAll(".atom[data-frag]")];
let show = 0, docked = false, place = 1, rate = 0, frame = 0, last = 0, clock = 0, touring = !still.matches, visible = false, idle = 0;
const fmt = (v) => v.toFixed(2);
function say() {
  const part = PARTS[show];
  const total = docked ? SALT : BASE;
  const text = part.short + " " + part.formula + " · " + (100 * part.mass / total).toFixed(1) + "% of " + fmt(total) + (docked ? " salt" : " base");
  if (readout.textContent !== text) readout.textContent = text;
  svg.setAttribute("data-show", part.key);
  stage.setAttribute("aria-valuenow", String(show));
  stage.setAttribute("aria-valuetext", text);
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (touring) {
    clock += dt;
    const step = Math.floor(clock / 2.4);
    show = step % PARTS.length;
    docked = Math.floor(step / PARTS.length) % 2 === 0 ? show >= 3 : show < 3;
  }
  const want = docked ? 0 : 1;
  if (still.matches) { place = want; rate = 0; }
  else for (let i = 0; i < 4; i++) { rate += ((want - place) * 60 - rate * 14) * dt / 4; place += rate * dt / 4; }
  if (Math.abs(want - place) < 0.0005 && Math.abs(rate) < 0.0005) { place = want; rate = 0; }
  carriage.setAttribute("transform", translateAlong(P, [place * SPAN, 0, 0]));
  say();
  const settled = !touring && place === want;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const hold = () => { touring = false; clearTimeout(idle); idle = setTimeout(() => { touring = !still.matches; clock = 0; run(); }, 5000); run(); };
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointermove", (event) => {
  let best = null, far = Infinity;
  for (const el of atoms) {
    const box = el.getBoundingClientRect();
    const d = Math.hypot(box.left + box.width / 2 - event.clientX, box.top + box.height / 2 - event.clientY);
    if (d < far) { far = d; best = el; }
  }
  if (!best || far > 60) return;
  show = PARTS.findIndex((p) => p.key === best.dataset.frag);
  if (show === PARTS.length - 1) docked = true;
  hold();
});
stage.addEventListener("click", () => { docked = !docked; hold(); });
stage.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight" || event.key === "ArrowDown") show = (show + 1) % PARTS.length;
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") show = (show + PARTS.length - 1) % PARTS.length;
  else if (event.key === "Enter" || event.key === " " || event.key === "m") docked = !docked;
  else return;
  event.preventDefault();
  hold();
});
say();
`;

const body =
  STYLE +
  k.plateHtml({
    fig: "Fig 1",
    title: "Doptelet · avatrombopag maleate",
    hint: "Hover a ring · click: salt",
    readout: `${PARTS[0].short} ${PARTS[0].formula}`,
    keys: [
      { mark: "lit", label: "The building block under the pointer" },
      { mark: "raised", label: "Balls tinted by element: N blue, O red, S yellow, Cl green, C grey" },
      { mark: "flat", label: "Ruler: one tick per ångström" },
    ],
    caption: `Doptelet's active ingredient is avatrombopag, ${M.formula.replace(/(\d+)/g, (d) => d.replace(/\d/g, (c) => "₀₁₂₃₄₅₆₇₈₉"[c]))}, ${BASE_MASS} g/mol, a small-molecule thrombopoietin receptor agonist built from six rings: a piperidine-4-carboxylic acid, a 3-chloropyridine carboxamide, a 1,3-thiazole, a 4-chlorothiophene, a piperazine and a cyclohexyl group. It is supplied as the maleate salt (${SALT_MASS} g/mol), the maleic acid pairing with the basic piperazine nitrogen. Each yellow film-coated tablet holds 23.6 mg avatrombopag maleate, equal to 20 mg avatrombopag; the excipients (lactose monohydrate, microcrystalline cellulose, crospovidone, colloidal silicon dioxide, magnesium stearate; coating of polyvinyl alcohol, talc, macrogol, titanium dioxide and yellow iron oxide) are not drawn. Hydrogens are omitted; geometry is an MMFF-optimised conformer. Tablet not to scale.`,
    body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Avatrombopag model: arrow keys step through the building blocks, Enter docks the maleate" aria-valuemin="0" aria-valuemax="${PARTS.length - 1}" aria-valuenow="0">${svg}</div>`,
  });

const file = theme === "light" ? "doptelet-light.html" : "doptelet.html";
writeFileSync(join(HERE, file), k.pageHtml({ title: "Doptelet molecule", theme, body, script: kitScript() + live, width: 700 }));
console.log("wrote", file, items.length, "items");
