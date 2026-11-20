/* Territory Manager alignment engine. Pure functions, no DOM, no storage.
 *
 * Precedence per field force, per account:
 *  1. Eligibility: the field force's targeting conditions must match
 *     (otherwise only manual includes apply).
 *  2. Manual include: always applies.
 *  3. Account rules: every matching rule at the best (lowest) priority assigns;
 *     if any matches, geography is skipped.
 *  4. Geo rules: longest matching postal-code prefix wins; ties share the account.
 *  5. Manual exclude: removes a territory, whatever assigned it.
 */
var TMEngine = (function () {
  "use strict";

  const OPS = ["eq", "ne", "in", "not_in", "starts_with", "contains", "gte", "lte"];

  const norm = v => (typeof v === "string" ? v.trim().toLowerCase() : v == null ? null : v);
  const normPostal = v => String(v ?? "").replace(/\s+/g, "").toUpperCase();

  function validateCondition(c) {
    if (!c || typeof c.field !== "string" || !c.field.trim()) throw new Error("condition needs a field");
    if (!OPS.includes(c.op)) throw new Error(`unknown operator "${c.op}"; use one of ${OPS.join(", ")}`);
    if ((c.op === "in" || c.op === "not_in") && !Array.isArray(c.value)) throw new Error(`operator "${c.op}" needs a list of values`);
    if ((c.op === "gte" || c.op === "lte") && !Number.isFinite(Number(c.value))) throw new Error(`operator "${c.op}" needs a number`);
    return c;
  }

  function matches(c, account) {
    const actual = account[c.field];
    const expected = c.value;
    switch (c.op) {
      case "eq": return norm(actual) === norm(expected);
      case "ne": return norm(actual) !== norm(expected);
      case "in": return expected.map(norm).includes(norm(actual));
      case "not_in": return !expected.map(norm).includes(norm(actual));
    }
    if (actual == null || actual === "") return false;
    if (c.op === "starts_with") return String(actual).toLowerCase().startsWith(String(expected).toLowerCase());
    if (c.op === "contains") return String(actual).toLowerCase().includes(String(expected).toLowerCase());
    const a = Number(actual), e = Number(expected);
    if (!Number.isFinite(a) || !Number.isFinite(e)) return false;
    return c.op === "gte" ? a >= e : a <= e;
  }

  const allMatch = (conds, account) => (conds || []).every(c => matches(c, account));

  /**
   * @param {object} d
   *   fieldForces [{code, target:[cond]}], territories [{code, fieldForce, parent}],
   *   accounts [{id, postal_code, ...}], accountRules [{id, territory, priority, conditions, name}],
   *   geoRules [{id, territory, prefix}], manual [{id, account, territory, action, note}]
   * @returns [{account, fieldForce, territory, source, ruleId, detail}]
   */
  function runAlignment(d) {
    const terrFF = new Map(d.territories.map(t => [t.code, t.fieldForce]));

    const rulesByFF = new Map();
    for (const r of d.accountRules || []) {
      const ff = terrFF.get(r.territory);
      if (!ff) continue;
      if (!rulesByFF.has(ff)) rulesByFF.set(ff, []);
      rulesByFF.get(ff).push(r);
    }
    for (const list of rulesByFF.values()) list.sort((a, b) => a.priority - b.priority || a.id - b.id);

    const geoByFF = new Map();
    for (const g of d.geoRules || []) {
      const ff = terrFF.get(g.territory);
      if (!ff) continue;
      if (!geoByFF.has(ff)) geoByFF.set(ff, new Map());
      const m = geoByFF.get(ff), p = normPostal(g.prefix);
      if (!m.has(p)) m.set(p, []);
      m.get(p).push(g);
    }

    const includes = new Map(), excludes = new Set();
    for (const m of d.manual || []) {
      const ff = terrFF.get(m.territory);
      if (!ff) continue;
      if (m.action === "include") {
        const k = m.account + "\u0000" + ff;
        if (!includes.has(k)) includes.set(k, []);
        includes.get(k).push(m);
      } else if (m.action === "exclude") excludes.add(m.account + "\u0000" + m.territory);
    }

    const out = [];
    for (const acct of d.accounts) {
      const postal = normPostal(acct.postal_code);
      for (const ff of d.fieldForces) {
        const found = new Map();
        const add = (territory, source, ruleId, detail) => {
          if (!found.has(territory)) found.set(territory, { account: acct.id, fieldForce: ff.code, territory, source, ruleId, detail });
        };
        for (const m of includes.get(acct.id + "\u0000" + ff.code) || []) add(m.territory, "manual", m.id, m.note || "manual include");

        if (allMatch(ff.target, acct)) {
          let best = null;
          for (const r of rulesByFF.get(ff.code) || []) {
            if (best !== null && r.priority > best) break;
            if (allMatch(r.conditions, acct)) {
              best = r.priority;
              add(r.territory, "account_rule", r.id, r.name || `account rule #${r.id}`);
            }
          }
          if (best === null && postal) {
            const geo = geoByFF.get(ff.code);
            if (geo) {
              for (let n = postal.length; n > 0; n--) {
                const hits = geo.get(postal.slice(0, n));
                if (hits) { hits.forEach(g => add(g.territory, "geo_rule", g.id, `postal code starts ${postal.slice(0, n)}`)); break; }
              }
            }
          }
        }
        for (const [t, a] of found) if (!excludes.has(acct.id + "\u0000" + t)) out.push(a);
      }
    }
    return out;
  }

  /** Accounts whose territory set changed, per field force. */
  function diffAlignments(base, target) {
    const index = rows => {
      const m = new Map();
      for (const a of rows) {
        const k = a.account + "\u0000" + a.fieldForce;
        if (!m.has(k)) m.set(k, new Set());
        m.get(k).add(a.territory);
      }
      return m;
    };
    const b = index(base), t = index(target);
    const keys = [...new Set([...b.keys(), ...t.keys()])].sort();
    const changes = [];
    for (const k of keys) {
      const before = [...(b.get(k) || [])].sort(), after = [...(t.get(k) || [])].sort();
      if (before.join("|") !== after.join("|")) {
        const [account, fieldForce] = k.split("\u0000");
        changes.push({ account, fieldForce, before, after });
      }
    }
    return changes;
  }

  /** Account count and summed workload per territory, rolled up the hierarchy. */
  function territoryMetrics(territories, assignments, accounts, weightField = "potential") {
    const weight = new Map(accounts.map(a => [a.id, Number(a[weightField]) || 0]));
    const parent = new Map(territories.map(t => [t.code, t.parent || null]));
    const m = new Map(territories.map(t => [t.code, { accounts: new Set(), direct: 0 }]));
    for (const a of assignments) {
      if (m.has(a.territory)) m.get(a.territory).direct++;
      const seen = new Set();
      for (let node = a.territory; node && m.has(node) && !seen.has(node); node = parent.get(node)) {
        seen.add(node);
        m.get(node).accounts.add(a.account);
      }
    }
    const out = {};
    for (const [code, v] of m) {
      let w = 0;
      for (const id of v.accounts) w += weight.get(id) || 0;
      out[code] = { accounts: v.accounts.size, directAccounts: v.direct, workload: Math.round(w * 100) / 100 };
    }
    return out;
  }

  // ---- CSV (handles quotes, Excel BOM, comma or semicolon) ----
  function parseCSV(text) {
    text = String(text).replace(/^﻿/, "");
    const firstLine = text.split(/\r?\n/, 1)[0];
    const delim = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";
    const rows = [];
    let row = [], field = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (ch === '"') q = false;
        else field += ch;
      } else if (ch === '"') q = true;
      else if (ch === delim) { row.push(field); field = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(field); rows.push(row); row = []; field = "";
      } else field += ch;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    const nonEmpty = rows.filter(r => r.some(c => c.trim() !== ""));
    if (!nonEmpty.length) return [];
    const header = nonEmpty[0].map(h => h.trim());
    return nonEmpty.slice(1).map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()]).filter(([h]) => h)));
  }

  function toCSV(header, rows) {
    const cell = v => {
      const s = String(v ?? "");
      return /[",;\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return [header, ...rows].map(r => r.map(cell).join(",")).join("\r\n") + "\r\n";
  }

  return { OPS, validateCondition, matches, allMatch, runAlignment, diffAlignments, territoryMetrics, parseCSV, toCSV, normPostal };
})();

if (typeof module !== "undefined") module.exports = TMEngine;
