import * as k from "../kit/iso-kit.mjs";
import { readFileSync } from "node:fs";
const html = readFileSync("crane.html", "utf8");
const P = JSON.parse(html.match(/"P":(\{[^}]*\})/)[1]);
for (const [n, p] of Object.entries({ yard: [40, -30, 0], far: [95, 95, 0], deck: [-85, 30, 30], ground: [-20, -80, 0] })) {
  const [x, y] = k.iso(p, P);
  console.log(n, (x / 640).toFixed(3), (y / 600).toFixed(3));
}
