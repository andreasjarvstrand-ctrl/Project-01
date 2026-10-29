const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const low = svg.querySelector('[data-part="low"]');
const high = svg.querySelector('[data-part="high"]');
const marks = svg.querySelector('[data-part="marks"]');
const hookG = low.querySelector('[data-part="hook"]');
const loadG = low.querySelector('[data-part="load"]');
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const P = DATA.P;
const cam = cameraOf(P);
const statics = DATA.statics.map((s) => ({ ...s, el: low.querySelector(`[data-static="${s.id}"]`) }));
const buildingKey = statics.find((s) => s.id === "building").key;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const TAU = Math.PI * 2;

// Drives: rate-limited with braking, like a crane's frequency-controlled motors.
const slew = { x: Math.atan2(YARD_SPOT.y, YARD_SPOT.x), v: 0, target: 0, vmax: 0.42, amax: 0.55 };
const trolley = { x: Math.hypot(YARD_SPOT.x, YARD_SPOT.y), v: 0, target: 0, vmax: 15, amax: 20 };
const hoist = { x: C.travel, v: 0, target: C.travel, vmax: 22, amax: 30 };
slew.target = slew.x;
trolley.target = trolley.x;
const load = { x: YARD_SPOT.x, y: YARD_SPOT.y, z: 0, yaw: YARD_SPOT.yaw, carried: false, offset: 0, at: "yard" };
const sway = { x: 0, y: 0, vx: 0, vy: 0 };
let lastTrolley = null;
let lastVel = [0, 0];

function drive(s, dt, calm) {
  if (calm) {
    s.x = s.target;
    s.v = 0;
    return;
  }
  const d = s.target - s.x;
  const brake = Math.sign(d) * Math.sqrt(2 * s.amax * Math.abs(d));
  const want = clamp(brake, -s.vmax, s.vmax);
  s.v += clamp(want - s.v, -s.amax * dt, s.amax * dt);
  s.x += s.v * dt;
  if (Math.abs(s.target - s.x) < s.amax * 2e-3 && Math.abs(s.v) < s.amax * 0.06) {
    s.x = s.target;
    s.v = 0;
  }
}
const resting = (s) => s.x === s.target && s.v === 0;

const reach = () => (load.carried ? reachFor(LOAD.mass) * M : C.uMax);
let blocked = false;
function aim(x, y) {
  const want = Math.atan2(y, x);
  let delta = (want - slew.x) % TAU;
  if (delta > Math.PI) delta -= TAU;
  if (delta < -Math.PI) delta += TAU;
  slew.target = slew.x + delta;
  const r = Math.hypot(x, y);
  blocked = r > reach() + 0.01;
  trolley.target = clamp(r, C.uMin, Math.min(C.uMax, reach()));
}

function plumb() {
  const c = Math.cos(slew.x);
  const s = Math.sin(slew.x);
  return [trolley.x * c + sway.x, trolley.x * s + sway.y];
}

function inside(px, py, r, pad = 0) {
  return px > r.x + pad && px < r.x + r.w - pad && py > r.y + pad && py < r.y + r.d - pad;
}
function footprint(x, y, yaw) {
  const pts = [];
  for (const a of [-LOAD.half, -LOAD.half / 2, 0, LOAD.half / 2, LOAD.half]) {
    for (const b of [-2.2, 0, 2.2]) pts.push([x + a * Math.cos(yaw) - b * Math.sin(yaw), y + a * Math.sin(yaw) + b * Math.cos(yaw)]);
  }
  return pts;
}
// Where the load could land under the hook: on the deck, on clear ground, or nowhere.
function landing(x, y, yaw) {
  const pts = footprint(x, y, yaw);
  if (pts.every(([px, py]) => inside(px, py, BUILDING, 1))) return { z: BUILDING.deck, at: "deck" };
  const clear = pts.every(([px, py]) => inside(px, py, PLATE, 7) && !inside(px, py, BUILDING, -1) && !OBSTACLES.some((o) => inside(px, py, o, -1)));
  if (!clear) return null;
  return { z: 0, at: Math.hypot(x - YARD_SPOT.x, y - YARD_SPOT.y) < 4 ? "yard" : "ground" };
}

// Jobs: a queue of steps, each with a start and a test for done.
let queue = [];
let step = null;
let job = "";
let message = "";
let messageUntil = 0;
const say = (text, ms = 1800) => {
  message = text;
  messageUntil = performance.now() + ms;
};
const steps = {
  go: (x, y) => ({ start: () => aim(x, y), done: () => resting(slew) && resting(trolley) && resting(hoist) }),
  settle: () => ({ start: () => {}, done: () => Math.hypot(sway.x, sway.y) < 0.5 }),
  hoist: (z) => ({ start: () => { hoist.target = z; }, done: () => resting(hoist) }),
  attach: () => ({ start: () => {
    const [x, y] = plumb();
    load.carried = true;
    load.offset = load.yaw - slew.x;
    load.dx = load.x - x;
    load.dy = load.y - y;
  }, done: () => true }),
  detach: (at) => ({ start: () => {
    load.carried = false;
    load.at = at;
  }, done: () => true }),
  wait: (s) => {
    let until = 0;
    return { start: () => { until = performance.now() + s * 1000; }, done: () => performance.now() >= until };
  },
};
function run(list, name) {
  queue = list;
  step = null;
  job = name;
}

function pickJob() {
  return [
    steps.go(load.x, load.y),
    steps.settle(),
    steps.hoist(load.z + LOAD.top + C.sling),
    steps.attach(),
    steps.hoist(C.travel),
  ];
}
function dropJob(z, at) {
  return [steps.settle(), steps.hoist(z + LOAD.top + C.sling), steps.detach(at), steps.wait(0.4), steps.hoist(C.travel)];
}

function act() {
  if (job) return;
  const x = trolley.target * Math.cos(slew.target);
  const y = trolley.target * Math.sin(slew.target);
  if (!load.carried) {
    if (Math.hypot(load.x - x, load.y - y) < 7) run(pickJob(), "lift");
    else say("nothing under the hook to lift");
    return;
  }
  const spot = landing(x, y, slew.target + load.offset);
  if (!spot) {
    say("no clear place to set down here");
    return;
  }
  const z = spot.at === "deck" ? BUILDING.deck : 0;
  run([steps.go(x, y), ...dropJob(z, spot.at)], "set down");
}

// The idle tour: carry the beams up to the deck, wait, bring them back to the yard.
let touring = !still.matches;
function tourJob() {
  if (load.carried) {
    const to = load.from === "deck" ? YARD_SPOT : DECK_SPOT;
    const z = to === DECK_SPOT ? BUILDING.deck : 0;
    return [steps.hoist(C.travel), steps.go(to.x, to.y), ...dropJob(z, to === DECK_SPOT ? "deck" : "yard"), steps.wait(1.6)];
  }
  const from = load.at;
  const to = from === "deck" ? YARD_SPOT : DECK_SPOT;
  return [
    steps.hoist(C.travel),
    ...pickJob(),
    { start: () => { load.from = from; }, done: () => true },
    steps.go(to.x, to.y),
    ...dropJob(to === DECK_SPOT ? BUILDING.deck : 0, to === DECK_SPOT ? "deck" : "yard"),
    steps.wait(1.6),
  ];
}

function advance() {
  for (let guard = 0; guard < 8; guard++) {
    if (step && !step.done()) return;
    step = queue.shift() ?? null;
    if (!step) {
      job = "";
      if (touring) run(tourJob(), "tour");
      else return;
      step = queue.shift();
    }
    step.start();
  }
}

// Pendulum sway of the hook under the trolley's acceleration (time-lapsed with the drives).
function swing(dt, calm) {
  const c = Math.cos(slew.x);
  const s = Math.sin(slew.x);
  const T = [trolley.x * c, trolley.x * s];
  if (calm || !lastTrolley) {
    lastTrolley = T;
    lastVel = [0, 0];
    if (calm) Object.assign(sway, { x: 0, y: 0, vx: 0, vy: 0 });
    return;
  }
  const vel = [(T[0] - lastTrolley[0]) / dt, (T[1] - lastTrolley[1]) / dt];
  const acc = [(vel[0] - lastVel[0]) / dt, (vel[1] - lastVel[1]) / dt];
  lastTrolley = T;
  lastVel = vel;
  const length = Math.max(8, C.sheaveZ - hoist.x);
  const g = 24.5 * 25;
  const w2 = g / length;
  const damp = 2 * 0.16 * Math.sqrt(w2);
  const n = 4;
  for (let i = 0; i < n; i++) {
    const h = dt / n;
    sway.vx += (-w2 * sway.x - damp * sway.vx - clamp(acc[0], -400, 400)) * h;
    sway.vy += (-w2 * sway.y - damp * sway.vy - clamp(acc[1], -400, 400)) * h;
    sway.x += sway.vx * h;
    sway.y += sway.vy * h;
  }
  const r = Math.hypot(sway.x, sway.y);
  if (r > 6) {
    sway.x *= 6 / r;
    sway.y *= 6 / r;
  }
}

let order = "";
let lastHigh = "";
function draw() {
  const theta = slew.x;
  const t = trolley.x;
  const hook = hoist.x;
  const highKey = `${theta.toFixed(4)}|${t.toFixed(2)}`;
  if (highKey !== lastHigh) {
    lastHigh = highKey;
    high.innerHTML = superItems(P, theta, t).sort((a, b) => a.key - b.key).map((item) => item.svg).join("");
  }
  const [hx, hy] = plumb();
  const apex = [hx, hy, hook];
  if (load.carried) {
    load.yaw = theta + load.offset;
    load.x = hx + (load.dx ?? 0);
    load.y = hy + (load.dy ?? 0);
    load.z = hook - C.sling - LOAD.top;
    load.dx = (load.dx ?? 0) * 0.9;
    load.dy = (load.dy ?? 0) * 0.9;
  }
  hookG.innerHTML = (load.carried ? loadSvg(P, [load.x, load.y, load.z], load.yaw, { slung: apex }) : "") + hookSvg(P, theta, t, hook, [sway.x, sway.y]);
  loadG.innerHTML = load.carried ? "" : loadSvg(P, [load.x, load.y, load.z], load.yaw);

  // Painter's order for the low layer: floor depth, and anything over the deck goes after the building.
  const overDeck = (x, y, z) => inside(x, y, BUILDING, -1) && z >= BUILDING.deck - 0.5;
  const keyOf = (x, y, z) => (overDeck(x, y, z) ? buildingKey + 0.5 + depthOf([x, y, 0], P) * 1e-3 : depthOf([x, y, 0], P));
  const items = statics.map((s) => ({ el: s.el, key: s.key, id: s.id }));
  items.push({ el: hookG, key: keyOf(hx, hy, load.carried ? load.z : hook) + 0.01, id: "hook" });
  if (!load.carried) items.push({ el: loadG, key: keyOf(load.x, load.y, load.z), id: "load" });
  items.sort((a, b) => a.key - b.key);
  const next = items.map((i) => i.id).join(",");
  if (next !== order) {
    order = next;
    items.forEach((i) => low.appendChild(i.el));
  }

  // Marks on the ground: where the hook would land, and the limiter's radius while loaded.
  const z = groundAt(hx, hy);
  const plumbMark = lineSvg(ring(hx, hy, 2.4, z, P, 24) + lineOnTop([hx - 2.4, hy], [hx + 2.4, hy], z, P) + lineOnTop([hx, hy - 2.4], [hx, hy + 2.4], z, P), { tone: "lit" });
  const limit = load.carried ? lineSvg(ring(0, 0, reachFor(LOAD.mass) * M, 0, P, 180), { tone: blocked ? "lit" : "hi", dashed: true, className: "cr-limit" }) : "";
  marks.innerHTML = limit + (z === 0 ? plumbMark : "");
  if (z !== 0) hookG.insertAdjacentHTML("afterbegin", plumbMark);

  const metres = t / M;
  const cap = capacityAt(metres);
  let text;
  if (performance.now() < messageUntil) text = message;
  else if (load.carried && blocked && trolley.x >= reach() - 0.05) text = `limiter: ${LOAD.mass.toFixed(2)} t stops at ${reachFor(LOAD.mass).toFixed(1)} m`;
  else if (load.carried) text = `R ${metres.toFixed(1)} m · H ${(hook / M).toFixed(1)} m · ${LOAD.mass.toFixed(2)} of ${cap.toFixed(2)} t (${Math.round((100 * LOAD.mass) / cap)}%)`;
  else text = `R ${metres.toFixed(1)} m · H ${(hook / M).toFixed(1)} m · hook free · ${cap.toFixed(1)} t here`;
  if (readout.textContent !== text) readout.textContent = text;
  const deg = ((((theta * 180) / Math.PI) % 360) + 360) % 360;
  stage.dataset.state = `${deg.toFixed(0)}|${metres.toFixed(1)}|${(hook / M).toFixed(1)}|${load.carried ? "carried" : load.at}|${job}`;
}

let frame = 0;
let last = 0;
let visible = false;
let idleTimer = 0;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  advance();
  drive(slew, dt, calm);
  drive(trolley, dt, calm);
  drive(hoist, dt, calm);
  swing(dt, calm);
  draw();
  const quiet = !job && resting(slew) && resting(trolley) && resting(hoist) && Math.hypot(sway.x, sway.y, sway.vx, sway.vy) < 0.02 && performance.now() > messageUntil;
  frame = visible && !quiet ? requestAnimationFrame(tick) : 0;
}
const wake = () => {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
};
function interrupt() {
  touring = false;
  if (job === "tour") {
    queue = [];
    step = null;
    job = "";
    hoist.target = C.travel;
  }
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    touring = !still.matches;
    wake();
  }, 9000);
}

new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  if (visible) wake();
}, { rootMargin: "120px 0px" }).observe(stage);

function floorAt(event) {
  const m = svg.getScreenCTM();
  if (!m) return null;
  const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(m.inverse());
  const at = (z) => {
    const a = (p.x - P.origin[0]) / cam.k;
    const b = ((p.y - P.origin[1]) / cam.k + z * cam.cosE) / cam.sinE;
    return [a * cam.sinA + b * cam.cosA, -a * cam.cosA + b * cam.sinA];
  };
  const up = at(BUILDING.deck);
  return inside(up[0], up[1], BUILDING) ? up : at(0);
}

stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch" && event.buttons === 0) return;
  interrupt();
  if (job) return;
  const spot = floorAt(event);
  if (!spot) return;
  aim(spot[0], spot[1]);
  hoist.target = C.travel;
  wake();
});
stage.addEventListener("pointerdown", (event) => {
  interrupt();
  if (event.pointerType === "touch") {
    const spot = floorAt(event);
    if (spot && !job) aim(spot[0], spot[1]);
    clearTimeout(stage.tapTimer);
    stage.tapTimer = setTimeout(() => { act(); wake(); }, 0);
  }
  wake();
});
stage.addEventListener("click", (event) => {
  if (event.pointerType === "touch") return;
  interrupt();
  act();
  wake();
});
stage.addEventListener("keydown", (event) => {
  const [x, y] = [trolley.target * Math.cos(slew.target), trolley.target * Math.sin(slew.target)];
  const r = Math.hypot(x, y);
  const a = Math.atan2(y, x);
  let to = null;
  if (event.key === "ArrowLeft") to = [r, a + Math.PI / 12];
  if (event.key === "ArrowRight") to = [r, a - Math.PI / 12];
  if (event.key === "ArrowUp") to = [r + 2.5 * M, a];
  if (event.key === "ArrowDown") to = [r - 2.5 * M, a];
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    interrupt();
    act();
    wake();
    return;
  }
  if (!to) return;
  event.preventDefault();
  interrupt();
  if (job) return;
  aim(to[0] * Math.cos(to[1]), to[0] * Math.sin(to[1]));
  hoist.target = C.travel;
  wake();
});
draw();
