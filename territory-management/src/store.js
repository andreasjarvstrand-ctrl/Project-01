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

  function addGeoRule(s, sid, { territory: code, prefix }) {
    const sc = editable(s, sid);
    territory(sc, code);
    prefix = E.normPostal(prefix);
    if (!prefix) fail("A postal-code prefix is required.");
    const r = { id: newId(s), territory: code, prefix };
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
    submitFeedback, resolveFeedback, exportCSV, exportAccountsCSV, accountColumns };
})(typeof TMEngine !== "undefined" ? TMEngine : require("./engine.js"));

if (typeof module !== "undefined") module.exports = TMStore;
