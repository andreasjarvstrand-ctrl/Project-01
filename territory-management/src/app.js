/* Territory Manager user interface. Everything runs in the browser; nothing is sent anywhere. */
(function (E, S, Demo, TMMap) {
  "use strict";

  const LS_KEY = "territory-manager.data.v1";
  const TABS = { territories: "Territories", map: "Map", accounts: "Accounts", rules: "Rules", scenarios: "Scenarios", feedback: "Field requests" };
  const ui = { tab: "territories", sid: S.MASTER, data: null, fileHandle: null, fileName: null, dirty: false, saving: null };

  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const formData = f => Object.fromEntries(new FormData(f));
  const today = () => new Date().toISOString().slice(0, 10);
  const condText = c => `${esc(c.field)} <b>${esc(c.op)}</b> ${esc(Array.isArray(c.value) ? c.value.join(" | ") : c.value)}`;
  const parseValue = (op, v) => (op === "in" || op === "not_in") ? String(v).split("|").map(x => x.trim()).filter(Boolean)
    : (op === "gte" || op === "lte") ? Number(String(v).replace(",", ".")) : v;

  function toast(msg, isError = false) {
    const t = $("#toast");
    t.textContent = msg; t.className = isError ? "err" : ""; t.style.display = "block";
    clearTimeout(t._h); t._h = setTimeout(() => (t.style.display = "none"), isError ? 6000 : 3500);
  }

  // ---------- persistence ----------
  // 1) Always kept in this browser (localStorage) so nothing is lost on close.
  // 2) Optionally linked to a data file: in Edge/Chrome changes save straight to it;
  //    elsewhere "Save" downloads a copy.
  const canLinkFiles = typeof window.showSaveFilePicker === "function";

  // Browser copy lives in IndexedDB (room for large map files), falling back to localStorage.
  let idbPromise = null, lastGeo, storeWarning = "";
  function idb() {
    if (!idbPromise) idbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error("no IndexedDB"));
      const req = indexedDB.open("territory-manager", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("kv");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return idbPromise;
  }
  const idbGet = (db, key) => new Promise((res, rej) => { const r = db.transaction("kv").objectStore("kv").get(key); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

  async function persistLocal() {
    const data = ui.data;
    if (!data) return;
    const { geo, ...rest } = data;
    try {
      const db = await idb();
      await new Promise((res, rej) => {
        const tx = db.transaction("kv", "readwrite"), store = tx.objectStore("kv");
        store.put(JSON.stringify(rest), "data");
        if (geo !== lastGeo) store.put(geo ? JSON.stringify(geo) : null, "geo");
        tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
      });
      lastGeo = geo;
      try { localStorage.removeItem(LS_KEY); } catch {}
      storeWarning = "";
    } catch {
      try { localStorage.setItem(LS_KEY, JSON.stringify(data)); storeWarning = ""; }
      catch { storeWarning = "Could not keep a copy in this browser: use File → Save to keep your work."; }
    }
    renderFileStatus();
  }

  async function loadLocal() {
    try {
      const db = await idb();
      const [d, g] = await Promise.all([idbGet(db, "data"), idbGet(db, "geo")]);
      if (d) { const obj = JSON.parse(d); if (g) obj.geo = JSON.parse(g); return obj; }
    } catch {}
    try { const t = localStorage.getItem(LS_KEY); if (t) return JSON.parse(t); } catch {}
    return null;
  }

  async function forgetLocal() {
    try { const db = await idb(); await new Promise(r => { const tx = db.transaction("kv", "readwrite"); tx.objectStore("kv").clear(); tx.oncomplete = tx.onerror = r; }); } catch {}
    try { localStorage.removeItem(LS_KEY); } catch {}
    lastGeo = undefined;
  }

  function changed() {
    ui.dirty = true;
    persistLocal();
    if (ui.fileHandle) scheduleFileSave();
    renderFileStatus();
  }

  function scheduleFileSave() {
    clearTimeout(ui.saving);
    ui.saving = setTimeout(() => writeHandle(ui.fileHandle).catch(err => toast("Could not save to the file: " + err.message, true)), 400);
  }

  async function writeHandle(handle) {
    const w = await handle.createWritable();
    await w.write(JSON.stringify(ui.data, null, 1));
    await w.close();
    ui.dirty = false;
    renderFileStatus();
  }

  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function saveAs() {
    const name = ui.fileName || `territory-data-${today()}.json`;
    if (canLinkFiles) {
      try {
        const h = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: "Territory Manager data", accept: { "application/json": [".json"] } }] });
        ui.fileHandle = h; ui.fileName = h.name;
        await writeHandle(h);
        toast(`Saved. Changes now save automatically to ${h.name}.`);
        return;
      } catch (err) {
        if (err.name === "AbortError") return;
        // fall through to a plain download (e.g. blocked by policy)
      }
    }
    download(name, JSON.stringify(ui.data, null, 1), "application/json");
    ui.fileName = name; ui.dirty = false; renderFileStatus();
    toast(`Downloaded ${name}. Open it later with File → Open.`);
  }

  const save = () => (ui.fileHandle ? writeHandle(ui.fileHandle).then(() => toast("Saved.")) : saveAs()).catch(err => toast(err.message, true));

  function useData(data, { fileName = null, handle = null, dirty = false } = {}) {
    ui.data = data; ui.fileHandle = handle; ui.fileName = fileName; ui.sid = S.MASTER; ui.dirty = dirty;
    persistLocal();
    renderShell();
  }

  async function openFile() {
    if (canLinkFiles && typeof window.showOpenFilePicker === "function") {
      try {
        const [h] = await window.showOpenFilePicker({ types: [{ description: "Territory Manager data", accept: { "application/json": [".json"] } }] });
        const file = await h.getFile();
        let writable = h;
        try { if ((await h.requestPermission({ mode: "readwrite" })) !== "granted") writable = null; } catch { writable = null; }
        useData(S.load(JSON.parse(await file.text())), { fileName: file.name, handle: writable });
        toast(`Opened ${file.name}${writable ? "; changes save to it automatically" : ""}.`);
        return;
      } catch (err) {
        if (err.name === "AbortError") return;
        if (err instanceof SyntaxError || /Territory Manager|version|master/.test(err.message)) return toast(err.message, true);
      }
    }
    pickFile(".json,application/json", async file => {
      useData(S.load(JSON.parse(await file.text())), { fileName: file.name });
      toast(`Opened ${file.name}.`);
    });
  }

  function pickFile(accept, onFile) {
    const input = Object.assign(document.createElement("input"), { type: "file", accept });
    input.onchange = async () => {
      if (!input.files[0]) return;
      try { await onFile(input.files[0]); } catch (err) { toast(err instanceof SyntaxError ? "That file is not valid: " + err.message : err.message, true); }
    };
    input.click();
  }

  function confirmReplace() {
    return !ui.data || !ui.dirty || ui.fileHandle || confirm("Your current data has changes that are not saved to a file. Replace it anyway?");
  }

  /** Run a change, report errors, save, re-render. */
  function act(fn, after) {
    try {
      const result = fn(ui.data);
      changed();
      if (after) after(result);
      render();
      return result;
    } catch (err) { toast(err.message, true); }
  }

  // ---------- shell ----------
  const MENU = [
    ["new", "New, empty data"], ["demo", "New, with demo data"], ["open", "Open data file…"], "-",
    ["save", "Save"], ["saveas", "Save as…"], "-",
    ["import", "Import accounts (CSV)…"], ["importMap", "Import map areas (GeoJSON)…"], ["exportAccounts", "Export accounts (CSV)"], ["exportAlign", "Export alignment (CSV)"], "-",
    ["forget", "Remove data from this browser"],
  ];
  const MENU_ACTIONS = {
    new: () => confirmReplace() && useData(S.create(), { dirty: true }),
    demo: () => confirmReplace() && useData(Demo.build(), { dirty: true }),
    open: () => confirmReplace() && openFile(),
    save, saveas: saveAs,
    import: () => pickFile(".csv,.txt,text/csv", async f => {
      const text = await f.text();
      act(d => S.importAccountsCSV(d, text), r => toast(`Accounts: ${r.added} added, ${r.updated} updated.`));
    }),
    importMap: () => TMMap.startImport(),
    exportAccounts: () => download(`accounts-${today()}.csv`, "﻿" + S.exportAccountsCSV(ui.data), "text/csv"),
    exportAlign: () => download(`alignment-${S.scenario(ui.data, ui.sid).name.replace(/\W+/g, "-")}-${today()}.csv`, "﻿" + S.exportCSV(ui.data, ui.sid), "text/csv"),
    forget: () => {
      if (!confirm("Remove the data kept in this browser? Saved data files are not affected.")) return;
      forgetLocal();
      ui.data = null; ui.fileHandle = null; ui.fileName = null; renderShell();
    },
  };

  function renderShell() {
    const has = !!ui.data;
    $("#tabs").classList.toggle("hidden", !has);
    $("#scenarioPick").classList.toggle("hidden", !has);
    $("#menuBox").classList.toggle("hidden", !has);
    if (!has) return renderWelcome();
    renderScenarioPicker();
    renderFileStatus();
    render();
  }

  function renderFileStatus() {
    const warning = storeWarning;
    const el = $("#file");
    if (!ui.data) { el.innerHTML = ""; return; }
    const where = ui.fileHandle ? `Saving to ${esc(ui.fileName)}` : ui.fileName ? `From ${esc(ui.fileName)}` : "Not saved to a file yet";
    const state = ui.fileHandle ? (ui.dirty ? " · saving…" : " · saved") : ui.dirty ? ` · <span class="dirty">unsaved changes (kept in this browser)</span>` : "";
    el.innerHTML = where + state + (warning ? ` · <span class="dirty">${esc(warning)}</span>` : "");
  }

  function renderScenarioPicker() {
    if (!ui.data.scenarios.some(s => s.id === ui.sid)) ui.sid = S.MASTER;
    $("#scenario").innerHTML = ui.data.scenarios.map(s => `<option value="${s.id}" ${s.id === ui.sid ? "selected" : ""}>${esc(s.name)} (${s.status})</option>`).join("");
  }

  function renderWelcome() {
    $("#view").onclick = null;
    $("#view").innerHTML = `<div class="welcome"><h2 style="font-size:22px">Territory Manager</h2>
      <p>Build and test sales territory alignments. Everything stays on this computer: nothing is uploaded and no internet is needed.</p>
      <div class="choices">
        <button class="btn" data-m="demo">Try it with demo data</button>
        <button class="btn ghost" data-m="new">Start empty</button>
        <button class="btn ghost" data-m="open">Open a data file…</button>
      </div>
      <p class="muted" style="margin-top:28px">Your work is kept in this browser automatically. Use <b>File → Save</b> to keep it in a file you can back up or share with colleagues.</p></div>`;
    $("#view").onclick = e => { const m = e.target.dataset.m; if (m) MENU_ACTIONS[m](); };
  }

  const readonly = () => S.scenario(ui.data, ui.sid).status === "published";

  function render() {
    document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === ui.tab));
    renderScenarioPicker();
    $("#ro").textContent = readonly() ? "read-only (published)" : "";
    $("#view").onclick = null; $("#view").onsubmit = null;
    VIEWS[ui.tab]();
  }

  // Delegated handlers so re-rendered markup needs no rebinding.
  function on(clicks, submits = {}) {
    $("#view").onclick = e => {
      const el = e.target.closest("[data-a]");
      if (el && clicks[el.dataset.a]) clicks[el.dataset.a](el.dataset, el);
    };
    $("#view").onsubmit = e => {
      const f = e.target;
      if (submits[f.id]) { e.preventDefault(); submits[f.id](formData(f), f); }
    };
  }

  const ffOptions = () => ui.data.fieldForces.map(f => `<option value="${esc(f.code)}">${esc(f.code)}: ${esc(f.name)}</option>`).join("");
  const terrOptions = (sid = ui.sid) => S.scenario(ui.data, sid).territories.map(t => `<option value="${esc(t.code)}">${esc(t.code)}</option>`).join("");
  const opOptions = () => E.OPS.map(o => `<option>${o}</option>`).join("");
  const del = (a, attrs) => readonly() ? "" : `<button class="btn danger small" data-a="${a}" ${attrs}>Delete</button>`;

  // ---------- views ----------
  const VIEWS = {
    map() {
      TMMap.render({ ui, data: ui.data, view: $("#view"), esc, toast, act, pickFile, readonly, rerender: render });
    },

    territories() {
      const d = ui.data, rows = S.territorySummary(d, ui.sid), byCode = new Map(rows.map(r => [r.code, r]));
      const depth = c => { let n = 0; for (let p = byCode.get(c)?.parent; p && n < 50; p = byCode.get(p)?.parent) n++; return n; };
      const ordered = [], visit = (p, ff) => rows.filter(r => (r.parent || null) === p && r.fieldForce === ff).forEach(r => { ordered.push(r); visit(r.code, ff); });
      d.fieldForces.forEach(f => visit(null, f.code));
      const isLeaf = r => !rows.some(c => c.parent === r.code);
      const max = Math.max(1, ...rows.filter(isLeaf).map(r => r.workload));
      const isMaster = ui.sid === S.MASTER;

      $("#view").innerHTML = `
      <section><h2>Territory hierarchy</h2>
        ${ordered.length ? `<table><tr><th>Territory</th><th>Field force</th><th class="num">Accounts</th><th class="num">Workload</th><th style="width:16%"></th>${isMaster ? "<th>People</th>" : ""}<th></th></tr>
        ${ordered.map(r => `<tr><td style="padding-left:${8 + depth(r.code) * 20}px"><b>${esc(r.code)}</b> <span class="muted">${esc(r.name)}</span></td>
          <td>${esc(r.fieldForce)}</td><td class="num">${r.accounts}</td><td class="num">${r.workload}</td>
          <td>${isLeaf(r) ? `<div class="bar" style="width:${(r.workload / max) * 100}%"></div>` : ""}</td>
          ${isMaster ? `<td>${r.roster.map(p => `${esc(p.person)} <span class="muted">${esc(p.role)}</span> <button class="btn ghost small" data-a="unroster" data-id="${p.id}" title="Remove">×</button>`).join("<br>") || "<span class='muted'>vacant</span>"}</td>` : ""}
          <td>${del("delTerr", `data-code="${esc(r.code)}"`)}</td></tr>`).join("")}</table>
          <p class="muted">Workload = summed account potential. Bars compare the lowest-level territories so you can see balance at a glance.</p>`
        : `<p class="muted">${d.fieldForces.length ? "No territories yet. Add one below." : "Start by adding a field force (a sales team) below, then add its territories."}</p>`}
        ${readonly() || !d.fieldForces.length ? "" : `<form class="row" id="fTerr">
          <input name="code" placeholder="Code, e.g. HEM-EAST" required size="14"><input name="name" placeholder="Name" required>
          <select name="fieldForce">${ffOptions()}</select>
          <select name="parent"><option value="">(top level)</option>${terrOptions()}</select>
          <button class="btn">Add territory</button></form>`}
      </section>
      ${isMaster && rows.length ? `<section><h2>Assign a person</h2><form class="row" id="fRoster">
        <select name="territory">${terrOptions()}</select><input name="person" placeholder="Name" required><input name="email" placeholder="Email" type="email">
        <select name="role"><option>rep</option><option>key account manager</option><option>manager</option></select>
        <button class="btn">Add</button></form></section>` : ""}
      <section><h2>Field forces</h2>
        <table><tr><th>Code</th><th>Name</th><th>Covers accounts where</th><th></th></tr>
        ${d.fieldForces.map(f => `<tr><td><b>${esc(f.code)}</b></td><td>${esc(f.name)}</td><td>${f.target.map(condText).join(" and ") || "<span class='muted'>all accounts</span>"}</td>
          <td><button class="btn danger small" data-a="delFF" data-code="${esc(f.code)}">Delete</button></td></tr>`).join("") || "<tr><td colspan=4 class='muted'>None yet.</td></tr>"}</table>
        <form class="row" id="fFF"><input name="code" placeholder="Code, e.g. HEM" required size="8"><input name="name" placeholder="Name, e.g. Hematology" required>
          <span class="muted">covers accounts where</span><input name="field" placeholder="field (optional)" size="12"><select name="op">${opOptions()}</select>
          <input name="value" placeholder="value (| between options)"><button class="btn">Add field force</button></form>
      </section>`;

      on({
        delTerr: ({ code }) => confirm(`Delete territory ${code} and its rules?`) && act(x => S.deleteTerritory(x, ui.sid, code)),
        delFF: ({ code }) => confirm(`Delete field force ${code}?`) && act(x => S.deleteFieldForce(x, code)),
        unroster: ({ id }) => act(x => S.deleteRoster(x, id)),
      }, {
        fTerr: v => act(x => S.addTerritory(x, ui.sid, v)),
        fRoster: v => act(x => S.addRoster(x, v)),
        fFF: v => act(x => S.upsertFieldForce(x, { code: v.code, name: v.name, target: v.field ? [{ field: v.field.trim(), op: v.op, value: parseValue(v.op, v.value) }] : [] })),
      });
    },

    accounts() {
      const q = ui.accountQuery || "";
      $("#view").innerHTML = `<section><h2>Accounts and where they are aligned</h2>
        <input id="q" placeholder="Search name, city, specialty, territory…" style="width:min(380px,100%)" value="${esc(q)}">
        <div id="list"></div></section>
        <section><h2>Add or import accounts</h2>
          <p class="muted">Import a CSV from Excel with <b>File → Import accounts</b>. Columns: id, name, type, specialty, segment, postal_code, city, potential. Any extra column (e.g. tier) can be used in rules. Existing ids are updated.</p>
          <form class="row" id="fAcct"><input name="id" placeholder="Id" required size="8"><input name="name" placeholder="Name" required><input name="specialty" placeholder="Specialty">
          <input name="segment" placeholder="Segment" size="10"><input name="postal_code" placeholder="Postal code" size="9"><input name="city" placeholder="City" size="10">
          <input name="potential" placeholder="Potential" size="7"><button class="btn">Add account</button></form></section>`;
      const draw = () => {
        const term = $("#q").value.trim().toLowerCase();
        ui.accountQuery = $("#q").value;
        const by = new Map();
        for (const a of S.align(ui.data, ui.sid)) { if (!by.has(a.account)) by.set(a.account, []); by.get(a.account).push(a); }
        const rows = ui.data.accounts.filter(a => !term || (Object.values(a).join(" ") + " " + (by.get(a.id) || []).map(x => x.territory).join(" ")).toLowerCase().includes(term))
          .sort((a, b) => a.name.localeCompare(b.name));
        const shown = rows.slice(0, 500);
        $("#list").innerHTML = `<p class="muted">${rows.length} of ${ui.data.accounts.length} accounts${rows.length > shown.length ? " (first 500 shown; search to narrow)" : ""}</p>
          <table><tr><th>Account</th><th>Specialty</th><th>Segment</th><th>Postal code</th><th class="num">Potential</th><th>Territories and why</th><th></th></tr>
          ${shown.map(a => `<tr><td><b>${esc(a.name)}</b><br><span class="muted">${esc(a.id)} · ${esc(a.city)}</span></td><td>${esc(a.specialty)}</td><td>${esc(a.segment)}</td>
            <td>${esc(a.postal_code)}</td><td class="num">${esc(a.potential)}</td>
            <td>${(by.get(a.id) || []).map(x => `<span class="tag ${x.source === "manual" ? "src-manual" : ""}">${esc(x.territory)}</span> <span class="muted">${esc(x.detail)}</span>`).join("<br>") || "<span class='muted'>not aligned</span>"}</td>
            <td><button class="btn danger small" data-a="delAcct" data-id="${esc(a.id)}">Delete</button></td></tr>`).join("")}</table>`;
      };
      let timer; $("#q").oninput = () => { clearTimeout(timer); timer = setTimeout(draw, 150); };
      on({ delAcct: ({ id }) => confirm(`Delete account ${id}?`) && act(x => S.deleteAccount(x, id)) },
         { fAcct: v => act(x => S.upsertAccounts(x, [v]), r => toast(r.added ? "Account added." : "Account updated.")) });
      draw();
    },

    rules() {
      const sc = S.scenario(ui.data, ui.sid), t = terrOptions();
      const noTerr = !sc.territories.length;
      $("#view").innerHTML = `
      <section><h2>How an account gets its territory</h2><ol class="muted" style="margin:0;padding-left:20px">
        <li>It must fit the field force (${ui.data.fieldForces.map(f => `${esc(f.code)}: ${f.target.map(condText).join(" and ") || "all accounts"}`).join("; ") || "no field forces yet"}).</li>
        <li>Manual includes always apply.</li>
        <li>Account rules: every match at the best (lowest) priority number assigns, and geography is then skipped.</li>
        <li>Geography rules: the longest matching postal-code start wins.</li>
        <li>Manual excludes remove a territory.</li></ol>
        ${noTerr ? `<p class="rem">Add territories on the Territories tab before creating rules.</p>` : ""}</section>
      <section><h2>Account rules</h2><table><tr><th class="num">Priority</th><th>Name</th><th>Conditions (all must match)</th><th>Territory</th><th></th></tr>
        ${[...sc.accountRules].sort((a, b) => a.priority - b.priority || a.id - b.id).map(r => `<tr><td class="num">${r.priority}</td><td>${esc(r.name)}</td><td>${r.conditions.map(condText).join("<br>")}</td>
          <td><span class="tag">${esc(r.territory)}</span></td><td>${del("delRule", `data-kind="account" data-id="${r.id}"`)}</td></tr>`).join("") || "<tr><td colspan=5 class='muted'>None.</td></tr>"}</table>
        ${readonly() || noTerr ? "" : `<form class="row" id="fRule"><input name="name" placeholder="Rule name"><input name="field" placeholder="Field, e.g. segment" required size="12">
          <select name="op">${opOptions()}</select><input name="value" placeholder="Value (| between options)" required>
          <input name="field2" placeholder="and field (optional)" size="12"><select name="op2">${opOptions()}</select><input name="value2" placeholder="value">
          <label class="muted">priority <input name="priority" type="number" value="100" style="width:70px"></label><select name="territory">${t}</select><button class="btn">Add rule</button></form>`}</section>
      <section><h2>Geography rules</h2><table><tr><th>Postal code starts with</th><th>Territory</th><th></th></tr>
        ${[...sc.geoRules].sort((a, b) => a.prefix.localeCompare(b.prefix)).map(r => `<tr><td>${esc(r.prefix)}</td><td><span class="tag">${esc(r.territory)}</span></td><td>${del("delRule", `data-kind="geo" data-id="${r.id}"`)}</td></tr>`).join("") || "<tr><td colspan=3 class='muted'>None.</td></tr>"}</table>
        ${readonly() || noTerr ? "" : `<form class="row" id="fGeo"><input name="prefix" placeholder="e.g. 41 or 113,114,115" required size="16"><select name="territory">${t}</select><button class="btn">Add</button></form>
          <p class="muted">Tip: enter several prefixes separated by commas.</p>`}</section>
      <section><h2>Manual assignments</h2><table><tr><th>Account</th><th>Action</th><th>Territory</th><th>Note</th><th></th></tr>
        ${sc.manual.map(r => `<tr><td>${esc(r.account)} <span class="muted">${esc(ui.data.accounts.find(a => a.id === r.account)?.name)}</span></td><td>${esc(r.action)}</td><td><span class="tag">${esc(r.territory)}</span></td>
          <td class="muted">${esc(r.note)}</td><td>${del("delRule", `data-kind="manual" data-id="${r.id}"`)}</td></tr>`).join("") || "<tr><td colspan=5 class='muted'>None.</td></tr>"}</table>
        ${readonly() || noTerr ? "" : `<form class="row" id="fMan"><input name="account" placeholder="Account id" required size="10" list="acctIds"><datalist id="acctIds">${ui.data.accounts.slice(0, 2000).map(a => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join("")}</datalist>
          <select name="action"><option>include</option><option>exclude</option></select><select name="territory">${t}</select><input name="note" placeholder="Note"><button class="btn">Add</button></form>`}</section>`;

      on({ delRule: ({ kind, id }) => act(x => S.deleteRule(x, ui.sid, kind, id)) }, {
        fRule: v => act(x => {
          const conditions = [{ field: v.field.trim(), op: v.op, value: parseValue(v.op, v.value) }];
          if (v.field2.trim()) conditions.push({ field: v.field2.trim(), op: v.op2, value: parseValue(v.op2, v.value2) });
          return S.addAccountRule(x, ui.sid, { name: v.name, territory: v.territory, priority: Number(v.priority), conditions });
        }),
        fGeo: v => act(x => v.prefix.split(/[,;]/).map(p => p.trim()).filter(Boolean).forEach(prefix => S.addGeoRule(x, ui.sid, { territory: v.territory, prefix }))),
        fMan: v => act(x => S.addManual(x, ui.sid, v)),
      });
    },

    scenarios() {
      const d = ui.data;
      $("#view").innerHTML = `<section><h2>Scenarios</h2>
        <p class="muted">A scenario is a copy of the alignment you can change freely. Compare it with master, then publish to make it the live alignment.</p>
        <table><tr><th>Name</th><th>Status</th><th>Created</th><th></th></tr>
        ${d.scenarios.map(s => `<tr><td><b>${esc(s.name)}</b></td><td>${s.status}</td><td class="muted">${esc(s.createdAt.slice(0, 16).replace("T", " "))}</td><td>
          ${s.status === "draft" ? `<button class="btn ghost small" data-a="edit" data-id="${s.id}">Edit</button> <button class="btn ghost small" data-a="diff" data-id="${s.id}">Compare</button>
          <button class="btn small" data-a="publish" data-id="${s.id}">Publish</button> <button class="btn danger small" data-a="del" data-id="${s.id}">Delete</button>` : ""}</td></tr>`).join("")}</table>
        <form class="row" id="fScen"><input name="name" placeholder="Scenario name, e.g. 2027 realignment" required>
          <select name="baseId">${d.scenarios.map(s => `<option value="${s.id}">copy of ${esc(s.name)}</option>`).join("")}</select><button class="btn">Create scenario</button></form></section>
        <section id="diff"><h2>Compare with master</h2><p class="muted">Choose Compare on a draft scenario.</p></section>`;
      const showDiff = id => {
        const ch = S.diff(d, S.MASTER, id), names = new Map(d.accounts.map(a => [a.id, a.name]));
        $("#diff").innerHTML = `<h2>${esc(S.scenario(d, id).name)} vs master: ${ch.length} account${ch.length === 1 ? "" : "s"} move</h2>
          ${ch.length ? `<table><tr><th>Account</th><th>Field force</th><th>Now</th><th>In scenario</th></tr>
          ${ch.map(c => `<tr><td>${esc(c.account)} <span class="muted">${esc(names.get(c.account))}</span></td><td>${esc(c.fieldForce)}</td>
            <td class="rem">${esc(c.before.join(", ") || "—")}</td><td class="add">${esc(c.after.join(", ") || "—")}</td></tr>`).join("")}</table>` : "<p class='muted'>No account moves.</p>"}`;
      };
      on({
        edit: ({ id }) => { ui.sid = Number(id); ui.tab = "rules"; render(); },
        diff: ({ id }) => showDiff(Number(id)),
        publish: ({ id }) => confirm("Make this scenario the live (master) alignment?") &&
          act(x => S.publishScenario(x, id), ch => { ui.sid = S.MASTER; toast(`Published: ${ch.length} account moves.`); }),
        del: ({ id }) => confirm("Delete this scenario?") && act(x => S.deleteScenario(x, id)),
      }, {
        fScen: v => act(x => S.createScenario(x, v.name, Number(v.baseId)), sc => { ui.sid = sc.id; ui.tab = "rules"; toast(`Now editing "${sc.name}". Switch scenarios at the top right.`); }),
      });
    },

    feedback() {
      const d = ui.data, items = [...d.feedback].reverse();
      $("#view").innerHTML = `<section><h2>Request a change</h2>
        <p class="muted">Reps ask to add or drop an account in a live territory. Approving turns the request into a manual assignment on master.
        To collect requests from colleagues, they can make them in their copy and send you the data file, or simply email you the details.</p>
        ${S.scenario(d, S.MASTER).territories.length ? `<form class="row" id="fFb"><input name="requestedBy" placeholder="Your name" required>
          <select name="action"><option value="add">add</option><option value="drop">drop</option></select>
          <input name="account" placeholder="Account id" required size="10" list="acctIds2"><datalist id="acctIds2">${d.accounts.slice(0, 2000).map(a => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join("")}</datalist>
          <select name="territory">${terrOptions(S.MASTER)}</select><input name="comment" placeholder="Reason"><button class="btn">Submit</button></form>` : "<p class='muted'>Add territories first.</p>"}</section>
        <section><h2>Requests</h2><table><tr><th>#</th><th>Request</th><th>By</th><th>Reason</th><th>Status</th><th></th></tr>
        ${items.map(f => `<tr><td>${f.id}</td><td>${f.action} <b>${esc(f.account)}</b> ${f.action === "add" ? "to" : "from"} <span class="tag">${esc(f.territory)}</span></td>
          <td>${esc(f.requestedBy)}</td><td class="muted">${esc(f.comment)}</td><td>${f.status}${f.resolvedBy ? ` <span class="muted">by ${esc(f.resolvedBy)}</span>` : ""}</td>
          <td>${f.status === "pending" ? `<button class="btn small" data-a="ok" data-id="${f.id}">Approve</button> <button class="btn danger small" data-a="no" data-id="${f.id}">Reject</button>` : ""}</td></tr>`).join("")
          || "<tr><td colspan=6 class='muted'>No requests yet.</td></tr>"}</table></section>`;
      on({
        ok: ({ id }) => act(x => S.resolveFeedback(x, id, true)),
        no: ({ id }) => act(x => S.resolveFeedback(x, id, false)),
      }, { fFb: v => act(x => S.submitFeedback(x, v), () => toast("Request submitted.")) });
    },
  };

  // ---------- start ----------
  function start() {
    $("#tabs").innerHTML = Object.entries(TABS).map(([k, v]) => `<button data-tab="${k}">${v}</button>`).join("");
    $("#tabs").onclick = e => { const k = e.target.dataset.tab; if (k) { ui.tab = k; try { localStorage.setItem(LS_KEY + ".tab", k); } catch {} render(); } };
    $("#scenario").onchange = e => { ui.sid = Number(e.target.value); render(); };
    $("#menuItems").innerHTML = MENU.map(m => m === "-" ? "<hr>" : `<button data-m="${m[0]}">${m[1]}</button>`).join("");
    $("#menuBtn").onclick = e => { e.stopPropagation(); $("#menuBox").classList.toggle("open"); };
    $("#menuItems").onclick = e => { const m = e.target.dataset.m; if (m) { $("#menuBox").classList.remove("open"); MENU_ACTIONS[m](); } };
    document.addEventListener("click", () => $("#menuBox").classList.remove("open"));
    document.addEventListener("keydown", e => { if ((e.ctrlKey || e.metaKey) && e.key === "s" && ui.data) { e.preventDefault(); save(); } });
    window.addEventListener("beforeunload", e => { if (ui.data && ui.dirty && !ui.fileHandle && storeWarning) { e.preventDefault(); e.returnValue = ""; } });

    try { ui.tab = localStorage.getItem(LS_KEY + ".tab") || ui.tab; } catch {}
    if (!TABS[ui.tab]) ui.tab = "territories";
    $("#view").innerHTML = "<p class='muted'>Loading…</p>";
    loadLocal().then(saved => {
      if (saved) {
        try { ui.data = S.load(saved); ui.dirty = true; lastGeo = ui.data.geo; }
        catch (err) { toast("Could not read the data kept in this browser: " + err.message, true); }
      }
      renderShell();
    });
  }

  start();
})(TMEngine, TMStore, TMDemo, TMMap);
