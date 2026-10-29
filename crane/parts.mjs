import { iso, depthOf, pathOf, cameraOf, extrude, roundedPlan, solidSvg, lineSvg, dotsSvg } from "./kit/iso-kit.mjs";

// World units: 2.5 per metre. x, y on the site plate, z up, mast axis at the origin.
export const M = 2.5;

export const C = {
  mast: 4,
  mastBase: 6,
  mastTop: 106,
  section: 12.5,
  ringR: 6.4,
  ttZ: 110,
  ttTop: 113.2,
  jibZ: 114,
  jibTop: 122,
  jibV: 3.6,
  jibRoot: 7,
  jibTip: 157,
  panel: 6.25,
  apex: 154,
  cjEnd: -52,
  uMin: 10,
  uMax: 150,
  trolleyLow: 109.6,
  sheaveZ: 108.2,
  sling: 8,
  travel: 74,
};

// Load chart of an 8 t flat-top crane with a 60 m jib: 8 t out to 22.6 m, 1.9 t at the tip.
export const CHART = { max: 8, full: 22.6, k: 93.2, c: 10.95, tip: 60 };
export const capacityAt = (metres) => (metres <= CHART.full ? CHART.max : CHART.k / (metres - CHART.c));
export const reachFor = (tonnes) => (tonnes >= CHART.max ? CHART.full : Math.min(CHART.tip, CHART.c + CHART.k / tonnes));

// The load: three HEB 320 beams, 8 m long, 127 kg/m, on two timber bearers.
export const LOAD = { mass: 3.05, half: 10, beam: 0.8, gap: 0.95, bearer: 0.7, top: 1.5, lift: 6 };

// Site layout.
export const PLATE = { x: -120, y: -120, w: 240, d: 240, r: 6 };
export const BUILDING = { x: -108, y: 12, w: 46, d: 36, deck: 30 };
export const YARD_SPOT = { x: 40, y: -30, yaw: -0.35 };
export const DECK_SPOT = { x: -85, y: 30 };
export const OBSTACLES = [
  { x: -16, y: -16, w: 32, d: 32 },
  { x: 54, y: -72, w: 24, d: 22 },
  { x: 8, y: 74, w: 30, d: 16 },
];

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => mul(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));
const mean = (points) => mul(points.reduce(add, [0, 0, 0]), 1 / points.length);
const lerp = (a, b, t) => add(a, mul(sub(b, a), t));

export function viewOf(P) {
  const c = cameraOf(P);
  return [c.cosA * c.cosE, c.sinA * c.cosE, c.sinE];
}

function hull2(points) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of sorted) {
    while (lower.length >= 2 && turn(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && turn(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

// Any convex polyhedron given as faces of 3D points: the kit's SolidPaths, shaded like extrude.
export function polySolid(faces, P) {
  const V = viewOf(P);
  const c = cameraOf(P);
  const centre = mean(faces.flat());
  const key = (p) => p.map((v) => v.toFixed(3)).join(",");
  const edges = new Map();
  const shades = [[], [], [], []];
  const tops = [];
  for (const face of faces) {
    let n = unit(cross(sub(face[1], face[0]), sub(face[2], face[0])));
    if (dot(n, sub(mean(face), centre)) < 0) n = mul(n, -1);
    const seen = dot(n, V) > 1e-6;
    face.forEach((p, i) => {
      const q = face[(i + 1) % face.length];
      const id = [key(p), key(q)].sort().join("|");
      const edge = edges.get(id) ?? { p, q, seen: 0 };
      if (seen) edge.seen++;
      edges.set(id, edge);
    });
    if (!seen) continue;
    const d = pathOf(face.map((p) => iso(p, P)), true);
    if (n[2] > 0.6) tops.push(d);
    else {
      const h = Math.hypot(n[0], n[1]) || 1;
      const lit = n[2] < -0.2 ? 0 : ((n[0] / h) * -c.sinA + (n[1] / h) * c.cosA + 1) / 2;
      shades[Math.min(3, Math.max(0, Math.floor(lit * 4)))].push(d);
    }
  }
  const outline = [];
  const crease = [];
  for (const { p, q, seen } of edges.values()) {
    if (seen === 1) outline.push(pathOf([iso(p, P), iso(q, P)]));
    if (seen === 2) crease.push(pathOf([iso(p, P), iso(q, P)]));
  }
  return {
    fill: pathOf(hull2(faces.flat().map((p) => iso(p, P))), true),
    outline: outline.join(""),
    crease: crease.join(""),
    top: tops.join(""),
    shades: shades.map((list) => list.join("")),
  };
}

// A box from its centre and three half-axes.
export function boxFaces(o, a, b, h) {
  const at = (i, j, k) => add(add(add(o, mul(a, i)), mul(b, j)), mul(h, k));
  return [
    [at(-1, -1, 1), at(1, -1, 1), at(1, 1, 1), at(-1, 1, 1)],
    [at(-1, -1, -1), at(-1, 1, -1), at(1, 1, -1), at(1, -1, -1)],
    [at(1, -1, -1), at(1, 1, -1), at(1, 1, 1), at(1, -1, 1)],
    [at(-1, -1, -1), at(-1, -1, 1), at(-1, 1, 1), at(-1, 1, -1)],
    [at(-1, 1, -1), at(-1, 1, 1), at(1, 1, 1), at(1, 1, -1)],
    [at(-1, -1, -1), at(1, -1, -1), at(1, -1, 1), at(-1, -1, 1)],
  ];
}

// A short cylinder on any axis: n-gon caps and side quads.
export function drumFaces(o, axis, r, half, n = 18) {
  const a = unit(axis);
  const u = unit(Math.abs(a[2]) > 0.9 ? cross(a, [1, 0, 0]) : cross(a, [0, 0, 1]));
  const v = cross(a, u);
  const ring = (s) => Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    return add(add(o, mul(a, s)), add(mul(u, Math.cos(t) * r), mul(v, Math.sin(t) * r)));
  });
  const p = ring(-half);
  const q = ring(half);
  const faces = [p, q];
  for (let i = 0; i < n; i++) faces.push([p[i], p[(i + 1) % n], q[(i + 1) % n], q[i]]);
  return { faces, u, v, a };
}

// A slender member: an outline stroke under a paper stroke, both in viewBox units.
export function barSvg(a, b, w, P, tone = "mid", butt = false) {
  const d = pathOf([iso(a, P), iso(b, P)]);
  const k = cameraOf(P).k;
  return `<g class="cr-bar" data-tone="${tone}"${butt ? " data-butt" : ""}><path class="cr-o" d="${d}" stroke-width="${(w * k + 0.9).toFixed(2)}"/><path class="cr-i" d="${d}" stroke-width="${(w * k).toFixed(2)}"/></g>`;
}

export function polyBarSvg(points, w, P, tone = "mid") {
  const d = pathOf(points.map((p) => iso(p, P)));
  const k = cameraOf(P).k;
  return `<g class="cr-bar" data-tone="${tone}"><path class="cr-o" d="${d}" stroke-width="${(w * k + 0.9).toFixed(2)}"/><path class="cr-i" d="${d}" stroke-width="${(w * k).toFixed(2)}"/></g>`;
}

// The slewing frame: local u along the jib, v across it, z up.
export function frameOf(theta, origin = [0, 0, 0]) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return {
    theta,
    at: ([u, v, z]) => [origin[0] + u * c - v * s, origin[1] + u * s + v * c, origin[2] + z],
    dir: ([u, v, z]) => [u * c - v * s, u * s + v * c, z],
  };
}

// A vertical prism in the local frame: a rounded plan rotated onto the floor.
function localSlab(F, plan, z, h, P, steps = 2, bevel = 0) {
  return extrude(roundedPlan(plan, steps).map(([u, v]) => F.at([u, v, 0]).slice(0, 2)), F.at([0, 0, z])[2], h, P, { bevel });
}

const quad = (F, list, P) => pathOf(list.map((p) => iso(F.at(p), P)), true);
const segL = (F, a, b, P) => pathOf([iso(F.at(a), P), iso(F.at(b), P)]);

export function trolleyItems(P, F, t) {
  const items = [];
  const put = (at, svg, bias = 0) => items.push({ key: depthOf(F.at(at), P) + bias, svg });
  for (const side of [-1, 1]) {
    const v0 = side * 4.3;
    const plate = localSlab(F, { x: t - 3.6, y: Math.min(v0, v0 + side * 0.6), w: 7.2, d: 0.6, r: 0 }, C.trolleyLow, 5.6, P, 0);
    const wheels = [-2.2, 2.2].map((du) => polySolid(drumFaces(F.at([t + du, side * 3.6, C.jibZ + 0.9]), F.dir([0, 1, 0]), 0.9, 0.3, 12).faces, P));
    put([t, side * 4.3, C.trolleyLow + 3], wheels.map((w) => solidSvg(w, { tone: "mid", crease: "none" })).join("") + solidSvg(plate, { tone: "mid" }) +
      dotsSvg([-2.2, 2.2].map((du) => iso(F.at([t + du, side * (4.3 + (side > 0 ? 0.6 : 0)) , C.jibZ + 0.9]), P)), { size: 0.45, tone: "hi" }));
  }
  const body = localSlab(F, { x: t - 3.2, y: -4.3, w: 6.4, d: 8.6, r: 0.6 }, C.trolleyLow, 2.2, P, 2, 0.3);
  const sheaves = [-1.3, 1.3].map((v) => polySolid(drumFaces(F.at([t, v, C.sheaveZ + 0.2]), F.dir([0, 1, 0]), 1.5, 0.35, 16).faces, P));
  const drops = lineSvg(pathOf([iso(F.at([t - 1.6, -1.3, C.jibZ + 1.1]), P), iso(F.at([t - 1.6, -1.3, C.trolleyLow + 1]), P)]) + pathOf([iso(F.at([t + 1.6, 1.3, C.jibZ + 1.1]), P), iso(F.at([t + 1.6, 1.3, C.trolleyLow + 1]), P)]), { tone: "lit", className: "cr-rope" });
  put([t, 0, C.trolleyLow], drops + sheaves.map((s) => solidSvg(s, { tone: "mid", crease: "none" })).join("") + solidSvg(body, { tone: "mid" }) +
    dotsSvg([[-2.4, -3.4], [2.4, -3.4], [-2.4, 3.4], [2.4, 3.4]].map(([du, v]) => iso(F.at([t + du, v, C.trolleyLow + 2.2]), P)), { size: 0.4, tone: "mid" }), 0.2);
  return items;
}

// Everything that turns with the slewing ring, as depth-keyed items.
export function superItems(P, theta, t) {
  const F = frameOf(theta);
  const items = [];
  const put = (at, svg, bias = 0) => items.push({ key: depthOf(F.at(at), P) + bias, svg });
  const bar = (a, b, w, tone = "mid", bias = 0, butt = false) => put(mean([a, b]), barSvg(F.at(a), F.at(b), w, P, tone, butt), bias);

  // Slewing ring (upper race) and turntable.
  const race = polySolid(drumFaces(F.at([0, 0, 108.2]), [0, 0, 1], C.ringR, 1, 40).faces, P);
  const bolts = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return F.at([Math.cos(a) * (C.ringR - 0.9), Math.sin(a) * (C.ringR - 0.9), 109.2]);
  }).filter(([x, y]) => depthOf([x, y, 0], P) > -2.5);
  put([0, 0, 106], solidSvg(race, { tone: "mid" }) + dotsSvg(bolts.map((p) => iso(p, P)), { size: 0.4, tone: "mid" }), -30);
  const deck = localSlab(F, { x: -9, y: -6, w: 18, d: 12, r: 1.2 }, C.ttZ, C.ttTop - C.ttZ, P, 3, 0.5);
  put([0, 0, C.ttZ], solidSvg(deck, { tone: "mid" }) +
    dotsSvg([[-7.6, -4.6], [7.6, -4.6], [-7.6, 4.6], [7.6, 4.6]].map((p) => iso(F.at([p[0], p[1], C.ttTop]), P)), { size: 0.45, tone: "mid" }), -20);

  // Operator's cab hung off the turntable.
  const cab = localSlab(F, { x: 1, y: 6, w: 7.8, d: 6, r: 0.8 }, 106.4, 7.6, P, 2, 0.4);
  const glass = [
    quad(F, [[8.8, 6.9, 108], [8.8, 11.2, 108], [8.8, 11.2, 113.2], [8.8, 6.9, 113.2]], P),
    quad(F, [[2, 12, 109.2], [7.9, 12, 109.2], [7.9, 12, 113.2], [2, 12, 113.2]], P),
    quad(F, [[2, 6, 109.2], [7.9, 6, 109.2], [7.9, 6, 113.2], [2, 6, 113.2]], P),
  ];
  const cabSeen = [F.dir([1, 0, 0]), F.dir([0, 1, 0]), F.dir([0, -1, 0])].map((n) => dot(n, viewOf(P)) > 0.02);
  const panes = glass.filter((_, i) => cabSeen[i]).map((d) => `<path class="cr-glass" d="${d}"/>`).join("");
  const mullion = cabSeen[0] ? lineSvg(segL(F, [8.8, 9.05, 108], [8.8, 9.05, 113.2], P), { tone: "lo" }) : "";
  put([4.9, 9, 110], solidSvg(cab, { tone: "mid", inner: panes + mullion }), 1);

  // Tower head: four legs to the apex, two belts of bracing.
  const legBase = [[6, 5], [6, -5], [-6, -5], [-6, 5]];
  const apex = [0, 0, C.apex];
  const legAt = ([u, v], z) => {
    const s = (z - C.ttTop) / (C.apex - C.ttTop);
    return [u * (1 - s), v * (1 - s), z];
  };
  legBase.forEach((base) => bar([base[0], base[1], C.ttTop], legAt(base, C.apex - 2.4), 1.2));
  for (const z of [122, 136]) {
    legBase.forEach((base, i) => {
      const next = legBase[(i + 1) % 4];
      bar(legAt(base, z), legAt(next, z), 0.55);
    });
  }
  legBase.forEach((base, i) => {
    const next = legBase[(i + 1) % 4];
    bar(legAt(base, 122), legAt(next, 136), 0.4, "lo");
  });
  const head = polySolid(boxFaces(F.at([0, 0, C.apex - 1.2]), F.dir([1.6, 0, 0]), F.dir([0, 1.6, 0]), [0, 0, 1.6]), P);
  const sheave = polySolid(drumFaces(F.at([0, 0, C.apex + 1.3]), F.dir([0, 1, 0]), 1.4, 0.4, 14).faces, P);
  put(apex, solidSvg(head, { tone: "mid" }) + solidSvg(sheave, { tone: "mid", crease: "faint" }), 2);
  bar([4.7, 0, C.jibTop], [C.jibRoot, 0, C.jibTop], 0.9);
  bar(legAt([6, -5], C.jibTop), legAt([6, 5], C.jibTop), 0.7);

  // Jib: two bottom chords and a top chord, Warren bracing, a strut every second panel.
  const panels = Math.round((C.jibTip - C.jibRoot) / C.panel);
  const uOf = (i) => C.jibRoot + i * C.panel;
  const B = (i, side) => [uOf(i), side * C.jibV, C.jibZ];
  const T = (i) => [uOf(i), 0, C.jibTop - (i > panels - 2 ? (i - (panels - 2)) * 2.5 : 0)];
  for (let i = 0; i < panels; i++) {
    for (const side of [-1, 1]) {
      bar(B(i, side), B(i + 1, side), 1.1, "mid", 0, true);
      const [a, b] = i % 2 ? [T(i), B(i + 1, side)] : [B(i, side), T(i + 1)];
      bar(a, b, 0.5, "mid", -0.05);
    }
    bar(T(i), T(i + 1), 1.0, "mid", 0.05, true);
    if (i % 2 === 0) bar(B(i, -1), B(i, 1), 0.45, "lo", -0.1);
    else bar(B(i - 1, 1), B(i + 1, -1), 0.4, "lo", -0.1);
  }
  bar(B(panels, -1), B(panels, 1), 0.6);
  for (const side of [-1, 1]) bar(B(panels, side), T(panels), 0.6);
  const tip = polySolid(boxFaces(F.at([C.jibTip + 0.7, 0, C.jibZ + 1.6]), F.dir([0.7, 0, 0]), F.dir([0, 4.2, 0]), [0, 0, 2.2]), P);
  const tail = lineSvg(pathOf([iso(F.at([C.jibTip - 4, 1.3, C.jibZ + 1.1]), P), iso(F.at([C.jibTip + 0.7, 1.3, C.jibZ + 1.1]), P)]), { tone: "lit", className: "cr-rope" });
  put([C.jibTip + 0.7, 0, C.jibZ], tail + solidSvg(tip, { tone: "mid" }), 0.3);
  for (const side of [-1, 1]) {
    const lug = polySolid(boxFaces(F.at([C.jibRoot - 0.6, side * C.jibV, C.jibZ - 0.4]), F.dir([1.4, 0, 0]), F.dir([0, 1, 0]), [0, 0, 1.2]), P);
    put([C.jibRoot - 0.6, side * C.jibV, C.jibZ], solidSvg(lug, { tone: "mid" }), 0.3);
  }

  // Trolley drive winch at the jib root.
  const tw = localSlab(F, { x: 8.4, y: -2.4, w: 4.6, d: 4.8, r: 0.5 }, C.jibZ + 0.6, 3, P, 2, 0.3);
  put([10.7, 0, C.jibZ + 1], solidSvg(tw, { tone: "mid" }) + lineSvg(segL(F, [13, -2.4, C.jibZ + 2.1], [13, 2.4, C.jibZ + 2.1], P), { tone: "faint" }), 0.4);

  // Ties from the apex to the jib and the counter-jib.
  for (const u of [62, 118]) {
    const p = [u, 0, C.jibTop];
    items.push({ key: depthOf(F.at([u * 0.5, 0, C.jibTop + 10]), P), svg: barSvg(F.at([1.2, 0, C.apex - 0.6]), F.at(p), 0.45, P, "hi") });
    put(p, solidSvg(polySolid(boxFaces(F.at([u, 0, C.jibTop + 0.6]), F.dir([1, 0, 0]), F.dir([0, 0.8, 0]), [0, 0, 0.6]), P), { tone: "mid" }), 0.3);
  }
  for (const side of [-1, 1]) {
    items.push({ key: depthOf(F.at([-22, side * 2.4, 136]), P), svg: barSvg(F.at([-1.2, side * 0.9, C.apex - 0.6]), F.at([-44, side * 4.4, 114.4]), 0.45, P, "hi") });
  }

  // Counter-jib: two box girders, a grated walkway, rails, the hoist winch, the cabinet and the ballast.
  for (const side of [-1, 1]) {
    const girder = localSlab(F, { x: C.cjEnd, y: side * 4.4 - 0.6, w: -C.cjEnd - 8, d: 1.2, r: 0 }, 110.6, 3.4, P, 0, 0.2);
    put([-30, side * 4.4, 112], solidSvg(girder, { tone: "mid" }), -0.5);
  }
  const grate = localSlab(F, { x: -43, y: -3.8, w: 34, d: 7.6, r: 0 }, 113.2, 0.6, P, 0);
  const slats = Array.from({ length: 13 }, (_, i) => segL(F, [-42 + i * 2.6, -3.8, 113.8], [-42 + i * 2.6, 3.8, 113.8], P)).join("");
  put([-26, 0, 113], solidSvg(grate, { tone: "lo", inner: lineSvg(slats, { tone: "faint" }) }), -0.2);
  for (const side of [-1, 1]) {
    const posts = [-12, -19, -26, -33, -40, -47];
    posts.forEach((u) => bar([u, side * 4.4, 114], [u, side * 4.4, 119], 0.35, "mid", 0.4));
    bar([-47, side * 4.4, 119], [-12, side * 4.4, 119], 0.3, "mid", 0.5);
    bar([-47, side * 4.4, 116.6], [-12, side * 4.4, 116.6], 0.25, "lo", 0.5);
  }

  // Hoist winch: drum with flanges and wraps, gearbox and motor.
  const drumAt = [-27, 0, 117.4];
  const drum = drumFaces(F.at(drumAt), F.dir([0, 1, 0]), 2.4, 2.3, 22);
  const flanges = [-2.5, 2.5].map((s) => polySolid(drumFaces(F.at([drumAt[0], s, drumAt[2]]), F.dir([0, 1, 0]), 3.1, 0.2, 22).faces, P));
  const V = viewOf(P);
  const wraps = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const n = add(mul(drum.u, Math.cos(a)), mul(drum.v, Math.sin(a)));
    if (dot(n, V) < 0.15) continue;
    const p = add(F.at(drumAt), mul(n, 2.4));
    wraps.push(pathOf([iso(add(p, mul(drum.a, -2.3)), P), iso(add(p, mul(drum.a, 2.3)), P)]));
  }
  const frame = localSlab(F, { x: -34, y: -3.6, w: 12, d: 7.2, r: 0.4 }, 113.8, 0.8, P, 2, 0.3);
  const motor = localSlab(F, { x: -34.4, y: -2.6, w: 3.8, d: 5.2, r: 1.4 }, 114.6, 4.6, P, 4, 0.3);
  const gear = localSlab(F, { x: -23.4, y: -3.2, w: 2.6, d: 6.4, r: 0.4 }, 114.6, 5, P, 2, 0.3);
  const fins = [0.8, 1.6, 2.4, 3.2, 4.0].map((h) => segL(F, [-34.4, -2.6, 114.6 + h], [-34.4, 2.6, 114.6 + h], P)).join("");
  put([-28, 0, 114], solidSvg(frame, { tone: "mid" }) + solidSvg(motor, { tone: "mid", inner: lineSvg(fins, { tone: "faint" }) }), 0.1);
  const flangeOrder = [-2.5, 2.5].map((s, i) => ({ s, i, d: dot(F.dir([0, s, 0]), V) })).sort((a, b) => a.d - b.d);
  const headAt = [0, 0, C.apex + 1.3];
  const off = [drumAt[0] - headAt[0], 0, drumAt[2] + 2.4 - headAt[2]];
  const offN = Math.hypot(off[0], off[2]);
  const lead = lineSvg(pathOf([iso(F.at(drumAt), P), iso(F.at([drumAt[0], 0, drumAt[2] + 2.4]), P), iso(F.at([headAt[0] + (off[0] / offN) * 1.4, 0, headAt[2] + (off[2] / offN) * 1.4]), P)]), { tone: "lit", className: "cr-rope" });
  const drumSvg = lead + solidSvg(flanges[flangeOrder[0].i], { tone: "mid", crease: "none" }) + solidSvg(polySolid(drum.faces, P), { tone: "hi", crease: "none", inner: lineSvg(wraps.join(""), { tone: "lo" }) }) +
    solidSvg(flanges[flangeOrder[1].i], { tone: "mid", crease: "none" });
  put(drumAt, drumSvg, 0.2);
  put([-22, 0, 115], solidSvg(gear, { tone: "mid" }) + dotsSvg([iso(F.at([-22.1, 0, 119.6]), P)], { size: 0.5, tone: "hi" }), 0.3);
  const cabinet = localSlab(F, { x: -19, y: -3.4, w: 5, d: 3, r: 0.3 }, 113.8, 5.6, P, 2, 0.3);
  const louvres = [1.2, 1.8, 2.4].map((h) => segL(F, [-14, -3.1, 113.8 + h], [-14, -0.7, 113.8 + h], P)).join("");
  put([-16.5, -1.9, 116], solidSvg(cabinet, { tone: "mid", inner: dot(F.dir([1, 0, 0]), V) > 0 ? lineSvg(louvres, { tone: "lo" }) : "" }), 0.2);

  // Ballast: four concrete blocks hung between the girders on two hangers and a cross beam.
  for (const side of [-1, 1]) {
    for (const u of [-50.6, -44.6]) bar([u, side * 4.4, 110.6], [u, side * 4.4, 99.6], 0.6, "mid", side * 0.3);
  }
  const hanger = localSlab(F, { x: -51.4, y: -5, w: 7.6, d: 10, r: 0.3 }, 98.6, 1.2, P, 2, 0.3);
  put([-47.6, 0, 99], solidSvg(hanger, { tone: "mid" }), -0.6);
  for (let i = 0; i < 4; i++) {
    const z = 99.8 + i * 3.6;
    const block = localSlab(F, { x: -51, y: -3.6, w: 7, d: 7.2, r: 0.5 }, z, 3.5, P, 3, 0.5);
    put([-47.5, 0, z], solidSvg(block, { tone: "mid" }) + (i === 3 ? dotsSvg([[-49.6, -1.8], [-45.4, 1.8]].map(([u, v]) => iso(F.at([u, v, z + 3.5]), P)), { size: 0.5, tone: "hi" }) : ""), 0.01 * i);
  }

  // Ropes in the jib: hoist rope from the head sheave to the trolley and on to the tip; it leaves the drum in the winch item.
  const yTop = C.jibZ + 1.1;
  const sheaveAt = [0, 0, C.apex + 1.3];
  const rim = (toward) => {
    const d = [toward[0] - sheaveAt[0], 0, toward[2] - sheaveAt[2]];
    const n = Math.hypot(d[0], d[2]);
    return [sheaveAt[0] + (d[0] / n) * 1.4, 0, sheaveAt[2] + (d[2] / n) * 1.4];
  };
  const hoist = [rim([C.jibRoot + 1, 0, yTop]), [C.jibRoot + 1, -1.3, yTop], [t - 1.6, -1.3, yTop]].map(F.at);
  items.push({ key: depthOf(F.at([t * 0.5, 0, yTop]), P) - 0.3, svg: lineSvg(pathOf(hoist.map((p) => iso(p, P))), { tone: "lit", className: "cr-rope" }) });
  items.push({ key: depthOf(F.at([(t + C.jibTip) / 2, 0, yTop]), P) - 0.3, svg: lineSvg(pathOf([iso(F.at([t + 1.6, 1.3, yTop]), P), iso(F.at([C.jibTip - 4, 1.3, yTop]), P)]), { tone: "lit", className: "cr-rope" }) });
  items.push(...trolleyItems(P, F, t));
  return items;
}

// The trolley's hoist falls, the bottom block, the hook, and the load while it hangs.
export function hookSvg(P, theta, t, hook, sway) {
  const F = frameOf(theta);
  const top = F.at([t, 0, 0]);
  const hx = top[0] + sway[0];
  const hy = top[1] + sway[1];
  const H = frameOf(theta, [hx, hy, hook]);
  const blockLow = 4.6;
  const falls = [-1.3, 1.3].map((v) => {
    const a = F.at([t, v, C.sheaveZ + 0.2]);
    const b = H.at([0, v, blockLow + 4.8]);
    return pathOf([iso(a, P), iso(b, P)]);
  });
  const ropes = lineSvg(falls.join(""), { tone: "lit", className: "cr-rope" });
  const sheave = polySolid(drumFaces(H.at([0, 0, blockLow + 3.4]), H.dir([1, 0, 0]), 2.1, 0.7, 20).faces, P);
  const body = polySolid(boxFaces(H.at([0, 0, blockLow + 2.4]), H.dir([1.3, 0, 0]), H.dir([0, 2.7, 0]), [0, 0, 2.4]), P);
  const V = viewOf(P);
  const face = dot(H.dir([1, 0, 0]), V) > 0 ? 1.3 : -1.3;
  const pin = iso(H.at([face, 0, blockLow + 3.2]), P);
  const plate = pathOf([[face, -2.1, blockLow + 0.6], [face, 2.1, blockLow + 0.6], [face, 2.1, blockLow + 4.4], [face, -2.1, blockLow + 4.4]].map((p) => iso(H.at(p), P)), true);
  const cross = polySolid(boxFaces(H.at([0, 0, blockLow - 0.45]), H.dir([1.1, 0, 0]), H.dir([0, 1.6, 0]), [0, 0, 0.45]), P);
  const shank = polySolid(drumFaces(H.at([0, 0, 3.1]), [0, 0, 1], 0.5, 1.0, 10).faces, P);
  const hookPath = [[0, 0, 3.9], [0, 0, 2.9], [-0.8, 0, 2.5], [-1.6, 0, 1.5], [-1.4, 0, 0.45], [-0.6, 0, 0], [0.4, 0, 0.05], [1.3, 0, 0.6], [1.7, 0, 1.4]].map((p) => H.at(p));
  return ropes +
    solidSvg(sheave, { tone: "hi", crease: "none" }) +
    solidSvg(body, { tone: "mid", inner: `<path class="cr-plate" d="${plate}"/>` }) +
    dotsSvg([pin], { size: 0.6, tone: "hi" }) +
    solidSvg(cross, { tone: "mid" }) + solidSvg(shank, { tone: "mid", crease: "none" }) +
    polyBarSvg(hookPath, 0.75, P, "lit") + dotsSvg([iso(hookPath[hookPath.length - 1], P)], { size: 0.5, tone: "hi" });
}

// The beam bundle at a world position and yaw: bearers, three beams with their end profiles, two straps.
export function loadSvg(P, at, yaw, { slung = null } = {}) {
  const F = frameOf(yaw, at);
  const V = viewOf(P);
  const parts = [];
  for (const a of [-6.5, 6.5]) {
    const bearer = localSlab(F, { x: a - 0.9, y: -2.2, w: 1.8, d: 4.4, r: 0.2 }, 0, LOAD.bearer, P, 1);
    parts.push({ key: depthOf(F.at([a, 0, 0]), P), svg: solidSvg(bearer, { tone: "lo" }) });
  }
  const endSign = dot(F.dir([1, 0, 0]), V) > 0 ? 1 : -1;
  const beams = [-1, 0, 1].map((j) => {
    const b = j * LOAD.gap;
    const z0 = LOAD.bearer;
    const z1 = z0 + LOAD.beam;
    const slab = localSlab(F, { x: -LOAD.half, y: b - 0.4, w: LOAD.half * 2, d: 0.8, r: 0 }, z0, LOAD.beam, P, 0);
    const e = endSign * LOAD.half;
    const web = pathOf([[e, b - 0.07, z0 + 0.12], [e, b - 0.07, z1 - 0.12]].map((p) => iso(F.at(p), P))) +
      pathOf([[e, b - 0.4, z0 + 0.12], [e, b + 0.4, z0 + 0.12]].map((p) => iso(F.at(p), P))) +
      pathOf([[e, b - 0.4, z1 - 0.12], [e, b + 0.4, z1 - 0.12]].map((p) => iso(F.at(p), P)));
    return { key: depthOf(F.at([0, b, 0]), P) + 1, svg: solidSvg(slab, { tone: "hi", inner: lineSvg(web, { tone: "lo" }) }) };
  });
  parts.push(...beams);
  parts.sort((a, b) => a.key - b.key);
  const top = LOAD.top;
  const strapLines = [-LOAD.lift - 1.6, LOAD.lift + 1.6].map((a) => {
    const near = dot(F.dir([0, 1, 0]), V) > 0 ? 1 : -1;
    return pathOf([[a, -near * 1.35, top], [a, near * 1.35, top], [a, near * 1.35, LOAD.bearer]].map((p) => iso(F.at(p), P)));
  }).join("");
  let slings = "";
  if (slung) {
    const apex = slung;
    slings = lineSvg([-LOAD.lift, LOAD.lift].map((a) => pathOf([iso(F.at([a, 0, top]), P), iso(apex, P)])).join(""), { tone: "hi" });
  } else {
    slings = lineSvg([-LOAD.lift, LOAD.lift].map((a) => pathOf([iso(F.at([a, 0, top]), P), iso(F.at([a * 0.35, 0.5, top]), P)])).join(""), { tone: "hi" });
  }
  const eyes = dotsSvg([-LOAD.lift, LOAD.lift].map((a) => iso(F.at([a, 0, top]), P)), { size: 0.55, tone: "hi" });
  return parts.map((p) => p.svg).join("") + lineSvg(strapLines, { tone: "mid" }) + slings + eyes;
}

// Where the hook would land: a plumb mark on the ground or the deck.
export function groundAt(x, y) {
  const b = BUILDING;
  if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.d) return b.deck;
  return 0;
}
