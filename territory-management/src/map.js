/* Map tab: draws bricks / postal-code areas as SVG (no online map tiles, works offline),
 * colours them by territory, and lets the user select areas and assign them. */
var TMMap = (function (E, S) {
  "use strict";

  const PALETTE = ["#4e79a7", "#f28e2b", "#59a14f", "#e15759", "#76b7b2", "#edc948", "#b07aa1", "#ff9da7", "#9c755f", "#86bcb6", "#d37295", "#a0cbe8"];
  const NS = "http://www.w3.org/2000/svg";
  let cache = null;   // { geo, svg, paths: Map(code -> [path]), centroids, bounds, labels }
  let h = null;       // helpers from app.js for the current render

  const st = () => h.ui.map;
  const esc = s => h.esc(s);

  // ---------- geometry ----------
  function projector(geo) {
    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const u of geo.units) for (const p of u.polygons) for (const [x, y] of p[0]) {
      if (x < minLon) minLon = x; if (x > maxLon) maxLon = x; if (y < minLat) minLat = y; if (y > maxLat) maxLat = y;
    }
    const k = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180) * 1000;
    const proj = ([lon, lat]) => [(lon - minLon) * k, (maxLat - lat) * 1000];
    return { proj, bounds: { x: 0, y: 0, w: (maxLon - minLon) * k || 1, h: (maxLat - minLat) * 1000 || 1 } };
  }

  function build(geo) {
    const { proj, bounds } = projector(geo);
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("id", "mapSvg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Map of areas coloured by territory");
    const areas = document.createElementNS(NS, "g"), labels = document.createElementNS(NS, "g"), dots = document.createElementNS(NS, "g");
    areas.setAttribute("class", "areas"); labels.setAttribute("class", "labels"); dots.setAttribute("class", "dots");
    const box = document.createElementNS(NS, "rect");
    box.setAttribute("class", "selbox"); box.style.display = "none";
    const paths = new Map(), centroids = new Map();
    for (const u of geo.units) {
      let d = "", cx = 0, cy = 0, area = 0;
      for (const poly of u.polygons) for (const [ri, ring] of poly.entries()) {
        const pts = ring.map(proj);
        d += "M" + pts.map(([x, y]) => x.toFixed(1) + " " + y.toFixed(1)).join("L") + "Z";
        if (ri === 0) for (let i = 0, n = pts.length - 1; i < n; i++) {  // area-weighted centroid of outer rings
          const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], c = x0 * y1 - x1 * y0;
          area += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c;
        }
      }
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", d); p.setAttribute("fill-rule", "evenodd"); p.dataset.code = u.code;
      areas.appendChild(p);
      paths.set(u.code, p);
      const fb = u.polygons[0][0].map(proj)[0];
      centroids.set(u.code, area ? [cx / (3 * area), cy / (3 * area)] : fb);
    }
    if (geo.units.length <= 400) for (const [code, [x, y]] of centroids) {
      const t = document.createElementNS(NS, "text");
      t.setAttribute("x", x); t.setAttribute("y", y); t.textContent = code;
      labels.appendChild(t);
    }
    svg.append(areas, dots, labels, box);
    cache = { geo, svg, paths, centroids, bounds, proj, labels, dots, box, names: new Map(geo.units.map(u => [u.code, u.name])) };
    attachEvents(svg);
    return cache;
  }

  // ---------- view box (pan & zoom) ----------
  function setViewBox(vb) {
    st().vb = vb;
    cache.svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    const fs = vb.w / 70;
    cache.labels.setAttribute("font-size", fs.toFixed(2));
    cache.labels.style.display = vb.w / cache.bounds.w > 0.9 && cache.geo.units.length > 120 ? "none" : "";
    cache.dots.querySelectorAll("circle").forEach(c => c.setAttribute("r", (vb.w / 260 * Number(c.dataset.s)).toFixed(2)));
  }

  function fit() {
    const b = cache.bounds, pad = Math.max(b.w, b.h) * 0.03;
    const box = cache.svg.getBoundingClientRect();
    const aspect = box.width && box.height ? box.width / box.height : 0.8;
    let w = b.w + 2 * pad, hgt = b.h + 2 * pad;
    if (w / hgt < aspect) w = hgt * aspect; else hgt = w / aspect;
    setViewBox({ x: b.x + b.w / 2 - w / 2, y: b.y + b.h / 2 - hgt / 2, w, h: hgt });
  }

  function zoom(factor, cx, cy) {
    const vb = st().vb;
    if (cx === undefined) { cx = vb.x + vb.w / 2; cy = vb.y + vb.h / 2; }
    const w = Math.min(Math.max(vb.w * factor, cache.bounds.w / 400), cache.bounds.w * 4), f = w / vb.w;
    setViewBox({ x: cx - (cx - vb.x) * f, y: cy - (cy - vb.y) * f, w, h: vb.h * f });
  }

  function toSvg(evt) {
    const r = cache.svg.getBoundingClientRect(), vb = st().vb;
    // preserveAspectRatio "xMidYMid meet": work out the drawn scale and offset
    const s = Math.min(r.width / vb.w, r.height / vb.h);
    const ox = (r.width - vb.w * s) / 2, oy = (r.height - vb.h * s) / 2;
    return [vb.x + (evt.clientX - r.left - ox) / s, vb.y + (evt.clientY - r.top - oy) / s, s];
  }

  // ---------- interaction ----------
  function attachEvents(svg) {
    let drag = null;
    svg.addEventListener("wheel", e => {
      e.preventDefault();
      const [x, y] = toSvg(e);
      zoom(e.deltaY > 0 ? 1.2 : 1 / 1.2, x, y);
    }, { passive: false });
    svg.addEventListener("pointerdown", e => {
      if (e.button !== 0) return;
      const [x, y, s] = toSvg(e);
      drag = { x0: e.clientX, y0: e.clientY, sx: x, sy: y, s, vb: { ...st().vb }, box: e.shiftKey, moved: false };
      svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener("pointermove", e => {
      if (!drag) return hover(e);
      const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      drag.moved = true;
      hideTip();
      if (drag.box) {
        const [x, y] = toSvg(e), b = cache.box;
        b.style.display = "";
        b.setAttribute("x", Math.min(x, drag.sx)); b.setAttribute("y", Math.min(y, drag.sy));
        b.setAttribute("width", Math.abs(x - drag.sx)); b.setAttribute("height", Math.abs(y - drag.sy));
      } else {
        setViewBox({ ...drag.vb, x: drag.vb.x - dx / drag.s, y: drag.vb.y - dy / drag.s });
      }
    });
    const end = e => {
      if (!drag) return;
      const d = drag; drag = null;
      if (d.box && d.moved) {
        cache.box.style.display = "none";
        const [x, y] = toSvg(e), x0 = Math.min(x, d.sx), x1 = Math.max(x, d.sx), y0 = Math.min(y, d.sy), y1 = Math.max(y, d.sy);
        let n = 0;
        for (const [code, [cx, cy]] of cache.centroids) if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) { st().selected.add(code); n++; }
        h.rerender();
        if (!n) h.toast("No area centres inside that box.");
      } else if (!d.moved) {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const code = el && el.dataset && el.dataset.code;
        if (code) clickArea(code, e);
      }
    };
    svg.addEventListener("pointerup", end);
    svg.addEventListener("pointercancel", () => { drag = null; cache.box.style.display = "none"; });
    svg.addEventListener("pointerleave", hideTip);
  }

  function clickArea(code, e) {
    const m = st();
    if (m.paint && m.target && !h.readonly()) {
      h.act(d => S.assignAreas(d, h.ui.sid, m.ff, [code], m.target === "__none__" ? null : m.target));
      return;
    }
    // Ctrl/Shift+click adds to the selection; on touch screens every tap does.
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.pointerType === "touch") { m.selected.has(code) ? m.selected.delete(code) : m.selected.add(code); }
    else if (m.selected.size === 1 && m.selected.has(code)) m.selected.clear();
    else { m.selected.clear(); m.selected.add(code); }
    h.rerender();
  }

  function hover(e) {
    const tip = document.getElementById("mapTip");
    const code = e.target && e.target.dataset && e.target.dataset.code;
    if (!tip || !code || !h.status) return hideTip();
    const a = h.status.get(code), name = cache.names.get(code);
    const terr = a.territories.length ? a.territories.map(t => `<b>${esc(t)}</b>`).join(", ") + (a.own ? "" : ` <span class="muted">(via rule ${esc(a.via)})</span>`) : "<i>unassigned</i>";
    tip.innerHTML = `<b>${esc(code)}</b> ${esc(name)}<br>${terr}<br>${a.eligible} account${a.eligible === 1 ? "" : "s"} in this field force · workload ${round(a.workload)}`
      + (a.partial.length ? `<br><span class="muted">Parts assigned elsewhere: ${a.partial.map(p => esc(p.prefix) + "→" + esc(p.territories.join("/"))).join(", ")}</span>` : "");
    const box = tip.parentElement.getBoundingClientRect();
    tip.style.display = "block";
    tip.style.left = Math.min(e.clientX - box.left + 14, box.width - tip.offsetWidth - 4) + "px";
    tip.style.top = Math.min(e.clientY - box.top + 14, box.height - tip.offsetHeight - 4) + "px";
  }
  function hideTip() { const t = document.getElementById("mapTip"); if (t) t.style.display = "none"; }
  const round = n => Math.round(n * 10) / 10;

  // ---------- colours ----------
  function colours(sc, ff) {
    const m = new Map();
    sc.territories.filter(t => t.fieldForce === ff).forEach((t, i) => m.set(t.code, PALETTE[i % PALETTE.length]));
    return m;
  }

  function paint(sc) {
    const m = st(), col = colours(sc, m.ff);
    for (const [code, els] of [...cache.paths].map(([c, p]) => [c, [p]])) {
      const a = h.status.get(code);
      const p = els[0];
      p.setAttribute("fill", a.territories.length ? col.get(a.territories[0]) : "var(--unassigned)");
      p.setAttribute("fill-opacity", a.territories.length ? (a.own ? "0.9" : "0.55") : "1");
      p.classList.toggle("sel", m.selected.has(code));
      p.classList.toggle("shared", a.territories.length > 1);
    }
    // keep selected outlines on top
    const g = cache.svg.querySelector(".areas");
    for (const code of m.selected) { const p = cache.paths.get(code); if (p) g.appendChild(p); }
    // account dots
    cache.dots.textContent = "";
    if (m.dots) {
      const ff = h.data.fieldForces.find(f => f.code === m.ff), by = new Map();
      for (const a of S.align(h.data, h.ui.sid)) if (a.fieldForce === m.ff) by.set(a.account, a.territory);
      const vbw = (m.vb || cache.bounds).w;
      for (const a of h.data.accounts) {
        const lon = Number(a.lon ?? a.longitude), lat = Number(a.lat ?? a.latitude);
        if (!Number.isFinite(lon) || !Number.isFinite(lat) || (ff && !E.allMatch(ff.target, a))) continue;
        const [x, y] = cache.proj([lon, lat]), c = document.createElementNS(NS, "circle");
        const s = 0.8 + Math.min(1.6, Math.sqrt(Number(a.potential) || 0) / 6);
        c.setAttribute("cx", x.toFixed(1)); c.setAttribute("cy", y.toFixed(1)); c.dataset.s = s.toFixed(2);
        c.setAttribute("r", (vbw / 260 * s).toFixed(2));
        c.setAttribute("fill", by.has(a.id) ? col.get(by.get(a.id)) || "#555" : "#fff");
        const title = document.createElementNS(NS, "title");
        title.textContent = `${a.name} (${a.id})${by.has(a.id) ? " → " + by.get(a.id) : " · not aligned"}`;
        c.appendChild(title);
        cache.dots.appendChild(c);
      }
    }
    return col;
  }

  // ---------- render ----------
  function render(helpers) {
    h = helpers;
    const d = h.data, view = h.view;
    const m = (h.ui.map ||= { ff: null, target: "", selected: new Set(), paint: false, dots: true, vb: null });
    if (!d.geo) return renderEmpty(view);
    if (!d.fieldForces.length) {
      view.innerHTML = `<section><h2>Map</h2><p class="muted">Add a field force and its territories on the Territories tab first.</p></section>${areasSection()}`;
      return bindAreas();
    }
    if (!d.fieldForces.some(f => f.code === m.ff)) m.ff = d.fieldForces[0].code;
    const sc = S.scenario(d, h.ui.sid);
    const terrs = sc.territories.filter(t => t.fieldForce === m.ff);
    if (m.target && m.target !== "__none__" && !terrs.some(t => t.code === m.target)) m.target = "";
    for (const c of [...m.selected]) if (!d.geo.units.some(u => u.code === c)) m.selected.delete(c);
    h.status = S.areaStatus(d, h.ui.sid, m.ff);
    const summary = new Map(S.territorySummary(d, h.ui.sid).map(t => [t.code, t]));
    const kindWord = d.geo.kind === "brick" ? "brick" : "postal area";
    const ro = h.readonly();

    let selAcc = 0, selWork = 0;
    for (const c of m.selected) { const a = h.status.get(c); if (a) { selAcc += a.eligible; selWork += a.workload; } }
    let unassigned = 0, unassignedAcc = 0;
    for (const a of h.status.values()) if (!a.territories.length) { unassigned++; unassignedAcc += a.eligible; }

    const col = colours(sc, m.ff);
    view.innerHTML = `
    <section class="mapsec">
      <div class="maptools">
        <label>Field force <select id="mFF">${d.fieldForces.map(f => `<option value="${esc(f.code)}" ${f.code === m.ff ? "selected" : ""}>${esc(f.code)}: ${esc(f.name)}</option>`).join("")}</select></label>
        <label>Assign to <select id="mTarget"><option value="">choose territory…</option>${terrs.map(t => `<option value="${esc(t.code)}" ${t.code === m.target ? "selected" : ""}>${esc(t.code)}</option>`).join("")}
          <option value="__none__" ${m.target === "__none__" ? "selected" : ""}>(remove area rule)</option></select></label>
        <label title="When on, clicking an area assigns it straight away"><input type="checkbox" id="mPaint" ${m.paint ? "checked" : ""} ${ro ? "disabled" : ""}> Paint mode</label>
        <label><input type="checkbox" id="mDots" ${m.dots ? "checked" : ""}> Accounts</label>
        <form id="mFind" class="inline"><input name="q" placeholder="Find ${kindWord} code" size="14"><button class="btn ghost small">Find</button></form>
      </div>
      <div class="mapgrid">
        <div class="mapbox" id="mapBox">
          <div class="zoombtns"><button class="btn ghost small" data-z="in" title="Zoom in">+</button><button class="btn ghost small" data-z="out" title="Zoom out">−</button><button class="btn ghost small" data-z="fit" title="Show everything">Fit</button></div>
          <div id="mapTip" class="maptip"></div>
        </div>
        <aside class="legend">
          <div class="selpanel">
            ${m.selected.size ? `<b>${m.selected.size} ${kindWord}${m.selected.size === 1 ? "" : "s"} selected</b>
              <div class="muted codes">${[...m.selected].slice(0, 40).map(esc).join(", ")}${m.selected.size > 40 ? "…" : ""}</div>
              <div>${selAcc} accounts · workload ${round(selWork)}</div>
              ${ro ? "" : `<div class="row2"><button class="btn small" id="mAssign" ${m.target ? "" : "disabled"}>${m.target === "__none__" ? "Remove area rule" : m.target ? "Assign to " + esc(m.target) : "Choose a territory above"}</button>
              <button class="btn ghost small" id="mClear">Clear selection</button></div>`}`
            : `<span class="muted">Click an area to select it. Ctrl+click adds more. Shift+drag selects a box. Drag to move, scroll or +/− to zoom. On a touch screen, tap areas to add them.</span>`}
          </div>
          <table class="legtable"><tr><th></th><th>Territory</th><th class="num">Accts</th><th class="num">Work</th></tr>
            ${terrs.map(t => { const s = summary.get(t.code) || {}; return `<tr data-t="${esc(t.code)}" class="${t.code === m.target ? "on" : ""}" title="Click to assign to ${esc(t.code)}">
              <td><span class="sw" style="background:${col.get(t.code)}"></span></td><td>${esc(t.code)}<br><span class="muted">${esc(t.name)}</span></td>
              <td class="num">${s.accounts ?? 0}</td><td class="num">${round(s.workload ?? 0)}</td></tr>`; }).join("")}
            <tr><td><span class="sw" style="background:var(--unassigned)"></span></td><td>Unassigned<br><span class="muted">${unassigned} areas</span></td><td class="num">${unassignedAcc}</td><td></td></tr>
          </table>
          <p class="muted small">Solid colour: the area has its own rule. Lighter: covered by a broader rule (e.g. "1" covers 11, 14…). Assigning an area adds its own rule, which takes priority.</p>
        </aside>
      </div>
    </section>
    ${areasSection()}`;

    if (!cache || cache.geo !== d.geo) build(d.geo);
    $("#mapBox").prepend(cache.svg);
    paint(sc);
    if (m.vb && m.geoRef === d.geo) setViewBox(m.vb); else { m.geoRef = d.geo; requestAnimationFrame(fit); }

    $("#mFF").onchange = e => { m.ff = e.target.value; m.selected.clear(); m.target = ""; h.rerender(); };
    $("#mTarget").onchange = e => { m.target = e.target.value; h.rerender(); };
    $("#mPaint").onchange = e => { m.paint = e.target.checked; if (m.paint && !m.target) h.toast("Choose a territory in “Assign to”, then click areas."); };
    $("#mDots").onchange = e => { m.dots = e.target.checked; paint(sc); };
    $("#mFind").onsubmit = e => {
      e.preventDefault();
      const q = E.normPostal(new FormData(e.target).get("q"));
      const hits = d.geo.units.filter(u => u.code === q || (q && u.code.startsWith(q)) || (q.length > 1 && E.normPostal(u.name).includes(q)));
      if (!hits.length) return h.toast(`No ${kindWord} matches “${q}”.`, true);
      m.selected = new Set(hits.map(u => u.code));
      h.rerender();
      const pts = hits.map(u => cache.centroids.get(u.code)), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      const w = Math.max(Math.max(...xs) - Math.min(...xs), cache.bounds.w / 12) * 1.6, ht = w * (m.vb.h / m.vb.w);
      setViewBox({ x: (Math.max(...xs) + Math.min(...xs)) / 2 - w / 2, y: (Math.max(...ys) + Math.min(...ys)) / 2 - ht / 2, w, h: ht });
    };
    view.querySelector(".zoombtns").onclick = e => { const z = e.target.dataset.z; if (z === "in") zoom(1 / 1.5); if (z === "out") zoom(1.5); if (z === "fit") fit(); };
    view.querySelector(".legtable").onclick = e => { const tr = e.target.closest("tr[data-t]"); if (tr) { m.target = tr.dataset.t; h.rerender(); } };
    const assign = $("#mAssign");
    if (assign) assign.onclick = () => {
      const codes = [...m.selected];
      h.act(x => S.assignAreas(x, h.ui.sid, m.ff, codes, m.target === "__none__" ? null : m.target),
        () => { m.selected.clear(); h.toast(`${codes.length} area${codes.length === 1 ? "" : "s"} ${m.target === "__none__" ? "cleared" : "assigned to " + m.target}.`); });
    };
    const clear = $("#mClear");
    if (clear) clear.onclick = () => { m.selected.clear(); h.rerender(); };
    bindAreas();
  }

  const $ = s => h.view.querySelector(s);

  function areasSection() {
    const g = h.data.geo;
    return `<section><h2>Map areas</h2>
      ${g ? `<p>${g.units.length} ${g.kind === "brick" ? "bricks" : "postal-code areas"} from <b>${esc(g.source || "imported file")}</b>.
        ${g.kind === "brick" ? "Accounts are placed in a brick by their <code>brick</code> column." : "Accounts are placed in an area by the start of their postal code."}</p>` : ""}
      <p class="muted">Import boundaries as a GeoJSON file in longitude/latitude (WGS84). Brick files usually come from your data provider; postal-code areas from a map data supplier or your GIS team.
        Accounts can also have <code>lat</code> and <code>lon</code> columns to show as dots.</p>
      <div class="row2"><button class="btn" data-g="import">Import map areas (GeoJSON)…</button>
        <button class="btn ghost" data-g="demo">Use demo map of Sweden</button>
        ${g ? `<button class="btn danger" data-g="remove">Remove map areas</button>` : ""}</div>
      <div id="geoImport"></div></section>`;
  }

  function renderEmpty(view) {
    view.innerHTML = `<section><h2>Map</h2><p>No map areas yet. Import bricks or postal-code areas to see your territories on a map and assign areas by clicking them.</p>
      <p class="muted">The map is drawn from the boundaries you import, so it works offline and nothing is sent anywhere.</p></section>${areasSection()}`;
    bindAreas();
  }

  function bindAreas() {
    h.view.querySelectorAll("[data-g]").forEach(b => b.onclick = () => {
      const g = b.dataset.g;
      if (g === "demo") h.act(x => S.setGeography(x, TMDemo.geography()), () => h.toast("Demo map loaded. The shapes are approximate."));
      if (g === "remove" && confirm("Remove the map areas? Territory rules are kept.")) h.act(x => S.clearGeography(x));
      if (g === "import") startImport();
    });
    if (h.ui.pendingGeo) showImportForm();
  }

  function startImport() {
    h.pickFile(".geojson,.json,application/geo+json,application/json", async f => {
      const gj = JSON.parse(await f.text());
      const feats = gj.type === "FeatureCollection" ? gj.features : gj.type === "Feature" ? [gj] : null;
      if (!feats || !feats.length) throw new Error("This is not a GeoJSON file with features.");
      h.ui.pendingGeo = { gj, name: f.name, feats };
      h.ui.tab = "map";
      h.rerender();
    });
  }

  function showImportForm() {
    const p = h.ui.pendingGeo, el = $("#geoImport");
    if (!el) return;
    const keys = [...new Set(p.feats.slice(0, 200).flatMap(f => Object.keys(f.properties || {})))];
    if (!keys.length) { h.ui.pendingGeo = null; return h.toast("The features in this file have no properties to use as codes.", true); }
    const guess = re => keys.find(k => re.test(k)) || "";
    const codeKey = guess(/brick/i) || guess(/post|zip|plz|nr|code|kod|id/i) || keys[0];
    const nameKey = guess(/name|namn|ort|city|label/i);
    const sample = k => p.feats.slice(0, 3).map(f => f.properties?.[k]).filter(v => v != null).map(v => String(v).slice(0, 20)).join(", ");
    el.innerHTML = `<div class="importbox"><h2>Import ${esc(p.name)}: ${p.feats.length} features</h2>
      <form id="fGeoImp" class="row">
        <label>Code is in <select name="code">${keys.map(k => `<option ${k === codeKey ? "selected" : ""} value="${esc(k)}">${esc(k)} (${esc(sample(k))})</option>`).join("")}</select></label>
        <label>Name is in <select name="name"><option value="">(none)</option>${keys.map(k => `<option ${k === nameKey ? "selected" : ""} value="${esc(k)}">${esc(k)} (${esc(sample(k))})</option>`).join("")}</select></label>
        <label>These are <select name="kind"><option value="postal" ${/brick/i.test(codeKey) ? "" : "selected"}>postal-code areas</option><option value="brick" ${/brick/i.test(codeKey) ? "selected" : ""}>bricks</option></select></label>
        <button class="btn">Import</button> <button type="button" class="btn ghost" id="geoCancel">Cancel</button></form>
      <p class="muted">Importing replaces the current map areas. Your territories and rules are kept.</p></div>`;
    $("#geoCancel").onclick = () => { h.ui.pendingGeo = null; h.rerender(); };
    $("#fGeoImp").onsubmit = e => {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(e.target));
      h.act(x => S.setGeography(x, { kind: v.kind, source: p.name, units: S.unitsFromGeoJSON(p.gj, v.code, v.name) }),
        n => { h.ui.pendingGeo = null; if (h.ui.map) { h.ui.map.vb = null; h.ui.map.selected.clear(); } h.toast(`Imported ${n} areas.`); });
    };
  }

  return { render, startImport };
})(TMEngine, TMStore);
