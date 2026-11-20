const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../src/engine.js");

const C = (field, op, value) => ({ field, op, value });
const FF = [{ code: "HEM", target: [C("specialty", "eq", "Hematology")] }, { code: "ALL", target: [] }];
const TERR = [
  { code: "NAT", fieldForce: "HEM", parent: null }, { code: "KAM", fieldForce: "HEM", parent: "NAT" },
  { code: "EAST", fieldForce: "HEM", parent: "NAT" }, { code: "EAST-1", fieldForce: "HEM", parent: "EAST" },
  { code: "WEST", fieldForce: "HEM", parent: "NAT" }, { code: "A1", fieldForce: "ALL" }, { code: "A2", fieldForce: "ALL" },
];
const ACCTS = [
  { id: "x", specialty: "Hematology", segment: "COE", postal_code: "171 64", potential: 10 },
  { id: "y", specialty: "Hematology", segment: "High", postal_code: "113 45", potential: 5 },
  { id: "z", specialty: "Cardiology", segment: "High", postal_code: "113 45", potential: 1 },
  { id: "w", specialty: "Hematology", segment: "Low", postal_code: "41345", potential: 2 },
];
const run = (extra = {}) => {
  const out = new Map();
  for (const a of E.runAlignment({ fieldForces: FF, territories: TERR, accounts: ACCTS, ...extra })) out.set(a.account + "|" + a.territory, a);
  return out;
};

test("conditions", () => {
  const a = { a: "Foo", n: "12", none: null };
  assert.ok(E.matches(C("a", "eq", " foo"), a));
  assert.ok(E.matches(C("a", "in", ["bar", "FOO"]), a));
  assert.ok(E.matches(C("a", "not_in", ["bar"]), a));
  assert.ok(E.matches(C("a", "starts_with", "f"), a));
  assert.ok(E.matches(C("a", "contains", "oo"), a));
  assert.ok(E.matches(C("n", "gte", 12), a) && !E.matches(C("n", "lte", 11), a));
  assert.ok(!E.matches(C("none", "gte", 0), a));
  assert.ok(!E.matches(C("missing", "starts_with", "x"), a));
  assert.throws(() => E.validateCondition(C("a", "like", "x")));
  assert.throws(() => E.validateCondition(C("a", "in", "x")));
  assert.throws(() => E.validateCondition(C("a", "gte", "many")));
});

test("geo: longest prefix wins, spaces ignored, eligibility applies", () => {
  const r = run({ geoRules: [{ id: 1, territory: "EAST", prefix: "1" }, { id: 2, territory: "EAST-1", prefix: "113" }, { id: 3, territory: "WEST", prefix: "4" }] });
  assert.equal(r.get("x|EAST").source, "geo_rule");
  assert.ok(r.has("y|EAST-1") && !r.has("y|EAST"));
  assert.ok(r.has("w|WEST"));
  assert.ok(![...r.keys()].some(k => k.startsWith("z|")));
});

test("account rule beats geo; priority respected", () => {
  const r = run({
    accountRules: [{ id: 1, territory: "KAM", priority: 10, conditions: [C("segment", "eq", "COE")] },
                   { id: 2, territory: "WEST", priority: 20, conditions: [C("segment", "eq", "COE")] }],
    geoRules: [{ id: 1, territory: "EAST", prefix: "1" }],
  });
  assert.equal(r.get("x|KAM").source, "account_rule");
  assert.ok(!r.has("x|EAST") && !r.has("x|WEST"));
  assert.ok(r.has("y|EAST"));
});

test("equal priority and shared geo share the account", () => {
  let r = run({ accountRules: [{ id: 1, territory: "KAM", priority: 10, conditions: [C("segment", "eq", "COE")] },
                               { id: 2, territory: "WEST", priority: 10, conditions: [C("segment", "eq", "COE")] }] });
  assert.ok(r.has("x|KAM") && r.has("x|WEST"));
  r = run({ geoRules: [{ id: 1, territory: "A1", prefix: "1" }, { id: 2, territory: "A2", prefix: "1" }] });
  assert.ok(r.has("z|A1") && r.has("z|A2"));
});

test("manual include bypasses eligibility; exclude removes", () => {
  const r = run({ geoRules: [{ id: 1, territory: "EAST", prefix: "1" }],
    manual: [{ id: 1, account: "z", territory: "WEST", action: "include" }, { id: 2, account: "y", territory: "EAST", action: "exclude" }] });
  assert.equal(r.get("z|WEST").source, "manual");
  assert.ok(!r.has("y|EAST") && r.has("x|EAST"));
});

test("rules pointing at missing territories are ignored", () => {
  const r = run({ geoRules: [{ id: 1, territory: "GONE", prefix: "1" }], manual: [{ id: 1, account: "x", territory: "GONE", action: "include" }] });
  assert.ok(![...r.keys()].some(k => k.endsWith("|GONE")));
});

test("diff", () => {
  const A = (account, territory) => ({ account, fieldForce: "HEM", territory });
  assert.deepEqual(E.diffAlignments([A("x", "EAST"), A("y", "EAST")], [A("x", "WEST"), A("y", "EAST"), A("z", "EAST")]), [
    { account: "x", fieldForce: "HEM", before: ["EAST"], after: ["WEST"] },
    { account: "z", fieldForce: "HEM", before: [], after: ["EAST"] }]);
});

test("metrics roll up without double counting", () => {
  const m = E.territoryMetrics(TERR, [{ account: "x", territory: "KAM" }, { account: "y", territory: "EAST-1" }, { account: "x", territory: "EAST" }], ACCTS);
  assert.deepEqual(m["EAST-1"], { accounts: 1, directAccounts: 1, workload: 5 });
  assert.equal(m.EAST.accounts, 2);
  assert.deepEqual(m.NAT, { accounts: 2, directAccounts: 0, workload: 15 });
});

test("CSV parse and write", () => {
  const rows = E.parseCSV('﻿id;name;note\r\nA1;"Klinik; Åre";"say ""hi"""\r\n\r\nA2;B;\n');
  assert.deepEqual(rows, [{ id: "A1", name: "Klinik; Åre", note: 'say "hi"' }, { id: "A2", name: "B", note: "" }]);
  assert.equal(E.toCSV(["a", "b"], [["x,y", 'q"']]), 'a,b\r\n"x,y","q"""\r\n');
});
