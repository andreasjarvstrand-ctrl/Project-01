/* Territory Manager data model and operations. Works on a plain JSON-able object,
 * so the whole database can be saved to and opened from a single file. */
var TMStore = (function (E) {
  "use strict";

  const FORMAT = "territory-manager";
  const FORMAT_VERSION = 1;
  const MASTER = 1;
  const ACCOUNT_COLS = ["id", "name", "type", "specialty", "segment", "postal_code", "city", "potential"];

  const now = () => new Date().toISOString().slice(0, 19) + "Z";
  const fail = msg => { throw new Error(msg); };
  const emptyScope = () => ({ territories: [], accountRules: [], geoRules: [], manual: [] });
  const clone = o => JSON.parse(JSON.stringify(o));

  function create() {
    return {
      format: FORMAT, version: FORMAT_VERSION, nextId: 2,
      fieldForces: [], accounts: [], roster: [], feedback: [],
      scenarios: [{ id: MASTER, name: "Master", status: "master", baseId: null, createdAt: now(), ...emptyScope() }],
    };
  }

  /** Validate a loaded file and fill in anything missing. */
  function load(obj) {
    if (!obj || obj.format !== FORMAT) fail("This is not a Territory Manager data file.");
    if (obj.version > FORMAT_VERSION) fail("This file was made by a newer version of Territory Manager.");
    const s = { ...create(), ...obj };
    if (!s.scenarios.some(x => x.id === MASTER)) fail("The data file has no master alignment.");
    let max = 1;
    const seeIds = list => list.forEach(x => { if (typeof x.id === "number") max = Math.max(max, x.id); });
    seeIds(s.scenarios); seeIds(s.roster); seeIds(s.feedback);
    for (const sc of s.scenarios) {
      Object.assign(sc, { ...emptyScope(), ...sc });
      seeIds(sc.accountRules); seeIds(sc.geoRules); seeIds(sc.manual);
    }
    s.nextId = Math.max(s.nextId || 0, max + 1);
    return s;
  }

  const newId = s => s.nextId++;

  // ---- reference data ----
  function upsertFieldForce(s, { code, name, target = [] }) {
    code = String(code || "").trim();
    if (!code || !String(name || "").trim()) fail("A field force needs a code and a name.");
    target.forEach(E.validateCondition);
    const ff = s.fieldForces.find(f => f.code === code);
    if (ff) Object.assign(ff, { name, target });
    else s.fieldForces.push({ code, name, target });
  }

  function deleteFieldForce(s, code) {
    if (s.scenarios.some(sc => sc.territories.some(t => t.fieldForce === code))) fail("Delete this field force's territories first.");
    s.fieldForces = s.fieldForces.filter(f => f.code !== code);
  }

  function cleanAccount(raw) {
    const id = String(raw.id ?? "").trim(), name = String(raw.name ?? "").trim();
    if (!id || !name) fail("Every account needs an id and a name.");
    const acct = {};
    for (const [k, v] of Object.entries(raw)) if (k) acct[k.trim()] = typeof v === "string" ? v.trim() : v;
    acct.id = id; acct.name = name;
    const p = String(acct.potential ?? "").replace(/\s/g, "").replace(",", ".");
    if (p === "") acct.potential = 0;
    else if (Number.isFinite(Number(p))) acct.potential = Number(p);
    else fail(`Account ${id}: potential "${acct.potential}" is not a number.`);
    return acct;
  }

  function upsertAccounts(s, rows) {
    const cleaned = rows.map(cleanAccount);  // validate all first: all or nothing
    const byId = new Map(s.accounts.map((a, i) => [a.id, i]));
    let added = 0, updated = 0;
    for (const a of cleaned) {
      if (byId.has(a.id)) { s.accounts[byId.get(a.id)] = { ...s.accounts[byId.get(a.id)], ...a }; updated++; }
      else { byId.set(a.id, s.accounts.length); s.accounts.push(a); added++; }
    }
    return { added, updated };
  }

  const importAccountsCSV = (s, text) => upsertAccounts(s, E.parseCSV(text));

  function deleteAccount(s, id) {
    s.accounts = s.accounts.filter(a => a.id !== id);
    s.scenarios.forEach(sc => { sc.manual = sc.manual.filter(m => m.account !== id); });
  }

  // ---- scenarios ----
  function scenario(s, id) {
    return s.scenarios.find(x => x.id === Number(id)) || fail(`Scenario ${id} not found.`);
  }

  function editable(s, id) {
    const sc = scenario(s, id);
    if (sc.status === "published") fail("Published scenarios are read-only.");
    return sc;
  }

  function createScenario(s, name, baseId = MASTER) {
    const base = scenario(s, baseId);
    const sc = { id: newId(s), name: String(name || "").trim() || "Untitled scenario", status: "draft", baseId: base.id, createdAt: now(), ...clone({
      territories: base.territories, accountRules: base.accountRules, geoRules: base.geoRules, manual: base.manual }) };
    s.scenarios.push(sc);
    return sc;
  }

  function deleteScenario(s, id) {
    if (Number(id) === MASTER) fail("The master alignment cannot be deleted.");
    scenario(s, id);
    s.scenarios = s.scenarios.filter(x => x.id !== Number(id));
  }

  function publishScenario(s, id) {
    if (Number(id) === MASTER) fail("Master is already live.");
    const sc = editable(s, id);
    const changes = diff(s, MASTER, sc.id);
    Object.assign(scenario(s, MASTER), clone({ territories: sc.territories, accountRules: sc.accountRules, geoRules: sc.geoRules, manual: sc.manual }));
    sc.status = "published";
    return changes;
  }

  // ---- territories & rules ----
  function territory(sc, code) {
    return sc.territories.find(t => t.code === code) || fail(`Territory "${code}" does not exist in scenario "${sc.name}".`);
  }

  function addTerritory(s, sid, { code, name, fieldForce, parent }) {
    const sc = editable(s, sid);
    code = String(code || "").trim(); name = String(name || "").trim();
    if (!code || !name) fail("A territory needs a code and a name.");
    if (!s.fieldForces.some(f => f.code === fieldForce)) fail(`Unknown field force "${fieldForce}".`);
    if (sc.territories.some(t => t.code === code)) fail(`Territory "${code}" already exists.`);
    if (parent && territory(sc, parent).fieldForce !== fieldForce) fail("The parent territory belongs to another field force.");
    sc.territories.push({ code, name, fieldForce, parent: parent || null });
  }

  function updateTerritory(s, sid, code, { name, parent }) {
    const sc = editable(s, sid), t = territory(sc, code);
    if (parent) {
      const p = territory(sc, parent);
      if (p.fieldForce !== t.fieldForce) fail("The parent territory belongs to another field force.");
      for (let n = p; n; n = n.parent ? territory(sc, n.parent) : null) if (n.code === code) fail("A territory cannot sit under itself.");
    }
    if (name !== undefined) t.name = String(name).trim() || t.name;
    if (parent !== undefined) t.parent = parent || null;
  }

  function deleteTerritory(s, sid, code) {
    const sc = editable(s, sid);
    territory(sc, code);
    if (sc.territories.some(t => t.parent === code)) fail("This territory has child territories. Move or delete them first.");
    sc.territories = sc.territories.filter(t => t.code !== code);
    for (const k of ["accountRules", "geoRules", "manual"]) sc[k] = sc[k].filter(r => r.territory !== code);
    if (sc.id === MASTER) s.roster = s.roster.filter(r => r.territory !== code);
  }

  function addAccountRule(s, sid, { territory: code, conditions, priority = 100, name = "" }) {
    const sc = editable(s, sid);
    territory(sc, code);
    if (!conditions || !conditions.length) fail("An account rule needs at least one condition.");
    conditions.forEach(E.validateCondition);
    const r = { id: newId(s), territory: code, name, priority: Number(priority) || 0, conditions };
    sc.accountRules.push(r);
    return r.id;
  }

  function addGeoRule(s, sid, { territory: code, prefix, kind = "postal" }) {
    const sc = editable(s, sid);
    territory(sc, code);
    prefix = E.normPostal(prefix);
    if (!prefix) fail(kind === "brick" ? "A brick code is required." : "A postal-code prefix is required.");
    const r = { id: newId(s), territory: code, prefix };
    if (kind === "brick") r.kind = "brick";
    sc.geoRules.push(r);
    return r.id;
  }

  function addManual(s, sid, { account, territory: code, action, note = "" }) {
    const sc = editable(s, sid);
    territory(sc, code);
    if (action !== "include" && action !== "exclude") fail("Action must be include or exclude.");
    if (!s.accounts.some(a => a.id === account)) fail(`Unknown account "${account}".`);
    sc.manual = sc.manual.filter(m => !(m.account === account && m.territory === code));
    const r = { id: newId(s), account, territory: code, action, note };
    sc.manual.push(r);
    return r.id;
  }

  function deleteRule(s, sid, kind, id) {
    const key = { account: "accountRules", geo: "geoRules", manual: "manual" }[kind] || fail("Unknown rule type.");
    const sc = editable(s, sid), before = sc[key].length;
    sc[key] = sc[key].filter(r => r.id !== Number(id));
    if (sc[key].length === before) fail("Rule not found.");
  }

  // ---- map areas (bricks or postal-code areas with boundaries) ----
  const AREA_KINDS = ["postal", "brick"];

  /** Validate and store map areas. units: [{code, name, geometry: GeoJSON Polygon|MultiPolygon}] */
  function setGeography(s, { kind, units, source = "" }) {
    if (!AREA_KINDS.includes(kind)) fail("Areas must be postal-code areas or bricks.");
    const seen = new Set(), clean = [];
    const round = ring => ring.map(([x, y]) => [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4]);
    for (const u of units) {
      const code = E.normPostal(u.code);
      const g = u.geometry;
      if (!code || !g || !Array.isArray(g.coordinates)) continue;
      let polys;
      if (g.type === "Polygon") polys = [g.coordinates];
      else if (g.type === "MultiPolygon") polys = g.coordinates;
      else continue;
      polys = polys.map(p => p.map(round)).filter(p => p.length && p[0].length >= 3);
      if (!polys.length) continue;
      for (const p of polys) for (const ring of p) for (const [x, y] of ring)
        if (!(Math.abs(x) <= 180 && Math.abs(y) <= 90)) fail("The map file must use longitude/latitude (WGS84, EPSG:4326). Re-export it in that coordinate system.");
      if (seen.has(code)) {  // same code in several features: merge them
        clean.find(c => c.code === code).polygons.push(...polys);
        continue;
      }
      seen.add(code);
      clean.push({ code, name: String(u.name ?? "").trim(), polygons: polys });
    }
    if (!clean.length) fail("No usable areas found. The file needs Polygon or MultiPolygon features with a code property.");
    s.geo = { kind, source, units: clean };
    return clean.length;
  }

  const clearGeography = s => { delete s.geo; };

  /** Read a GeoJSON FeatureCollection into units using the chosen property names. */
  function unitsFromGeoJSON(gj, codeProp, nameProp) {
    const feats = gj && (gj.type === "FeatureCollection" ? gj.features : gj.type === "Feature" ? [gj] : null);
    if (!feats) fail("This is not a GeoJSON file (expected a FeatureCollection).");
    return feats.map(f => ({ code: f.properties?.[codeProp], name: nameProp ? f.properties?.[nameProp] : "", geometry: f.geometry }));
  }

  function ffTerritoryCodes(sc, fieldForce) {
    return new Set(sc.territories.filter(t => t.fieldForce === fieldForce).map(t => t.code));
  }

  /** Assign map areas to a territory (or with territory = null remove their own rule) in one field force. */
  function assignAreas(s, sid, fieldForce, codes, territoryCode) {
    if (!s.geo) fail("Import map areas first.");
    const sc = editable(s, sid), kind = s.geo.kind;
    const inFF = ffTerritoryCodes(sc, fieldForce);
    if (territoryCode && !inFF.has(territoryCode)) fail(`Territory "${territoryCode}" is not in field force ${fieldForce}.`);
    const set = new Set(codes.map(E.normPostal));
    const isKind = r => (r.kind === "brick") === (kind === "brick");
    sc.geoRules = sc.geoRules.filter(r => !(isKind(r) && inFF.has(r.territory) && set.has(r.prefix)));
    if (territoryCode) for (const c of set) addGeoRule(s, sid, { territory: territoryCode, prefix: c, kind });
    return set.size;
  }

  /** Per area: territories, the rule that decides it, and account totals for one field force. */
  function areaStatus(s, sid, fieldForce) {
    const out = new Map();
    if (!s.geo) return out;
    const sc = scenario(s, sid), kind = s.geo.kind, inFF = ffTerritoryCodes(sc, fieldForce);
    const byPrefix = new Map();
    for (const r of sc.geoRules) {
      if (!inFF.has(r.territory) || (r.kind === "brick") !== (kind === "brick")) continue;
      if (!byPrefix.has(r.prefix)) byPrefix.set(r.prefix, []);
      byPrefix.get(r.prefix).push(r.territory);
    }
    const codes = new Set(s.geo.units.map(u => u.code));
    for (const code of codes) {
      let territories = [], via = null;
      if (kind === "brick") { territories = byPrefix.get(code) || []; via = territories.length ? code : null; }
      else for (let n = code.length; n > 0; n--) {
        const hit = byPrefix.get(code.slice(0, n));
        if (hit) { territories = hit; via = code.slice(0, n); break; }
      }
      const partial = kind === "brick" ? [] : [...byPrefix].filter(([p]) => p.length > code.length && p.startsWith(code)).map(([p, t]) => ({ prefix: p, territories: t }));
      out.set(code, { code, territories: [...new Set(territories)], via, own: via === code, partial, accounts: 0, eligible: 0, workload: 0 });
    }
    const ff = s.fieldForces.find(f => f.code === fieldForce);
    for (const a of s.accounts) {
      const code = areaOfAccount(a, codes, kind);
      if (!code) continue;
      const st = out.get(code);
      st.accounts++;
      if (!ff || E.allMatch(ff.target, a)) { st.eligible++; st.workload += Number(a.potential) || 0; }
    }
    return out;
  }

  function areaOfAccount(a, codes, kind) {
    if (kind === "brick") { const b = E.normPostal(a.brick); return b && codes.has(b) ? b : null; }
    const p = E.normPostal(a.postal_code);
    for (let n = p.length; n > 0; n--) if (codes.has(p.slice(0, n))) return p.slice(0, n);
    return null;
  }

  // ---- alignment ----
  function align(s, sid) {
    const sc = scenario(s, sid);
    return E.runAlignment({ fieldForces: s.fieldForces, territories: sc.territories, accounts: s.accounts,
      accountRules: sc.accountRules, geoRules: sc.geoRules, manual: sc.manual });
  }

  const diff = (s, baseId, targetId) => E.diffAlignments(align(s, baseId), align(s, targetId));

  function territorySummary(s, sid) {
    const sc = scenario(s, sid);
    const metrics = E.territoryMetrics(sc.territories, align(s, sid), s.accounts);
    return sc.territories.map(t => ({ ...t, ...metrics[t.code], roster: sc.id === MASTER ? s.roster.filter(r => r.territory === t.code) : [] }));
  }

  // ---- roster ----
  function addRoster(s, { territory: code, person, email = "", role = "rep" }) {
    territory(scenario(s, MASTER), code);
    if (!String(person || "").trim()) fail("A name is required.");
    const r = { id: newId(s), territory: code, person: person.trim(), email, role };
    s.roster.push(r);
    return r.id;
  }

  const deleteRoster = (s, id) => { s.roster = s.roster.filter(r => r.id !== Number(id)); };

  // ---- feedback ----
  function submitFeedback(s, { account, territory: code, action, requestedBy, comment = "" }) {
    territory(scenario(s, MASTER), code);
    if (action !== "add" && action !== "drop") fail("Action must be add or drop.");
    if (!String(requestedBy || "").trim()) fail("Please give your name.");
    if (!s.accounts.some(a => a.id === account)) fail(`Unknown account "${account}".`);
    const f = { id: newId(s), account, territory: code, action, requestedBy, comment, status: "pending", createdAt: now() };
    s.feedback.push(f);
    return f.id;
  }

  function resolveFeedback(s, id, approve, resolvedBy = "manager") {
    const f = s.feedback.find(x => x.id === Number(id)) || fail("Request not found.");
    if (f.status !== "pending") fail("This request was already resolved.");
    if (approve) addManual(s, MASTER, { account: f.account, territory: f.territory,
      action: f.action === "add" ? "include" : "exclude", note: `request #${f.id} from ${f.requestedBy}` });
    Object.assign(f, { status: approve ? "approved" : "rejected", resolvedBy, resolvedAt: now() });
  }

  // ---- export ----
  function exportCSV(s, sid) {
    const names = new Map(s.accounts.map(a => [a.id, a.name]));
    const rows = align(s, sid)
      .sort((a, b) => (a.fieldForce + a.territory + a.account).localeCompare(b.fieldForce + b.territory + b.account))
      .map(a => [a.account, names.get(a.account) || "", a.fieldForce, a.territory, a.source, a.ruleId ?? "", a.detail]);
    return E.toCSV(["account_id", "account_name", "field_force", "territory", "source", "rule_id", "reason"], rows);
  }

  const accountColumns = s => [...new Set([...ACCOUNT_COLS, ...s.accounts.flatMap(Object.keys)])];
  const exportAccountsCSV = s => {
    const cols = accountColumns(s);
    return E.toCSV(cols, s.accounts.map(a => cols.map(c => a[c] ?? "")));
  };

  return { MASTER, ACCOUNT_COLS, create, load, upsertFieldForce, deleteFieldForce, upsertAccounts, importAccountsCSV,
    deleteAccount, scenario, createScenario, deleteScenario, publishScenario, addTerritory, updateTerritory, deleteTerritory,
    addAccountRule, addGeoRule, addManual, deleteRule, align, diff, territorySummary, addRoster, deleteRoster,
    submitFeedback, resolveFeedback, exportCSV, exportAccountsCSV, accountColumns,
    setGeography, clearGeography, unitsFromGeoJSON, assignAreas, areaStatus, areaOfAccount };
})(typeof TMEngine !== "undefined" ? TMEngine : require("./engine.js"));

if (typeof module !== "undefined") module.exports = TMStore;
