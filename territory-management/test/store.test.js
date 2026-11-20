const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/store.js");
const Demo = require("../src/demo.js");

const terr = (s, sid, acct) => new Set(S.align(s, sid).filter(a => a.account === acct).map(a => a.territory));
const M = S.MASTER;

test("demo alignment", () => {
  const s = Demo.build();
  assert.deepEqual(terr(s, M, "A001"), new Set(["HEM-KAM"]));
  assert.deepEqual(terr(s, M, "A002"), new Set(["HEM-EAST"]));
  assert.deepEqual(terr(s, M, "A007"), new Set(["HEM-WEST"]));
  assert.deepEqual(terr(s, M, "A008"), new Set(["IMM-NORTH"]));
  assert.equal(terr(s, M, "A012").size, 0);
  const sum = Object.fromEntries(S.territorySummary(s, M).map(t => [t.code, t]));
  assert.equal(sum["HEM-SE"].accounts, 9);
  assert.equal(sum["HEM-KAM"].roster[0].person, "Alex Berg");
});

test("scenario isolation, diff and publish", () => {
  const s = Demo.build();
  const sc = S.createScenario(s, "Split north");
  S.addTerritory(s, sc.id, { code: "HEM-NORTH", name: "Hematology North", fieldForce: "HEM", parent: "HEM-SE" });
  S.addGeoRule(s, sc.id, { territory: "HEM-NORTH", prefix: "90" });
  assert.deepEqual(terr(s, sc.id, "A010"), new Set(["HEM-NORTH"]));
  assert.deepEqual(terr(s, M, "A010"), new Set(["HEM-EAST"]));
  assert.deepEqual(S.diff(s, M, sc.id), [{ account: "A010", fieldForce: "HEM", before: ["HEM-EAST"], after: ["HEM-NORTH"] }]);
  assert.equal(S.publishScenario(s, sc.id).length, 1);
  assert.deepEqual(terr(s, M, "A010"), new Set(["HEM-NORTH"]));
  assert.throws(() => S.addGeoRule(s, sc.id, { territory: "HEM-NORTH", prefix: "7" }), /read-only/);
  // master edits after publishing must not leak into the old scenario
  S.addGeoRule(s, M, { territory: "HEM-NORTH", prefix: "83" });
  assert.equal(S.scenario(s, sc.id).geoRules.length + 1, S.scenario(s, M).geoRules.length);
});

test("feedback flow", () => {
  const s = Demo.build();
  const f1 = S.submitFeedback(s, { account: "A012", territory: "HEM-EAST", action: "add", requestedBy: "Sam Lind" });
  S.resolveFeedback(s, f1, true, "Charlie");
  assert.deepEqual(terr(s, M, "A012"), new Set(["HEM-EAST"]));
  const f2 = S.submitFeedback(s, { account: "A002", territory: "HEM-EAST", action: "drop", requestedBy: "Sam Lind" });
  S.resolveFeedback(s, f2, false, "Charlie");
  assert.deepEqual(terr(s, M, "A002"), new Set(["HEM-EAST"]));
  assert.throws(() => S.resolveFeedback(s, f2, true));
});

test("validation", () => {
  const s = Demo.build();
  assert.throws(() => S.addTerritory(s, M, { code: "X", name: "X", fieldForce: "NOPE" }), /Unknown field force/);
  assert.throws(() => S.addTerritory(s, M, { code: "X", name: "X", fieldForce: "IMM", parent: "HEM-SE" }), /another field force/);
  assert.throws(() => S.addTerritory(s, M, { code: "HEM-SE", name: "X", fieldForce: "HEM" }), /already exists/);
  assert.throws(() => S.addAccountRule(s, M, { territory: "HEM-KAM", conditions: [{ field: "a", op: "bad", value: 1 }] }));
  assert.throws(() => S.deleteTerritory(s, M, "HEM-SE"), /child/);
  assert.throws(() => S.deleteScenario(s, M));
  assert.throws(() => S.updateTerritory(s, M, "HEM-SE", { parent: "HEM-EAST" }), /under itself/);
  assert.throws(() => S.deleteFieldForce(s, "HEM"), /territories first/);
});

test("delete territory removes its rules and roster", () => {
  const s = Demo.build();
  S.deleteTerritory(s, M, "HEM-WEST");
  assert.ok(!S.scenario(s, M).geoRules.some(g => g.territory === "HEM-WEST"));
  assert.ok(!s.roster.some(r => r.territory === "HEM-WEST"));
});

test("account CSV import: Excel style, updates keep manual assignments, all-or-nothing", () => {
  const s = Demo.build();
  S.addManual(s, M, { account: "A012", territory: "IMM-NORTH", action: "include" });
  const res = S.importAccountsCSV(s, "﻿id;name;specialty;postal_code;potential;tier\nA012;Meadow;General practice;118 20;7;B\nA099;Åsa Klinik;Hematology;211 50;12,5;A\n");
  assert.deepEqual(res, { added: 1, updated: 1 });
  assert.deepEqual(terr(s, M, "A012"), new Set(["IMM-NORTH"]));
  assert.deepEqual(terr(s, M, "A099"), new Set(["HEM-WEST"]));
  const a = s.accounts.find(x => x.id === "A099");
  assert.equal(a.potential, 12.5); assert.equal(a.tier, "A");
  const n = s.accounts.length;
  assert.throws(() => S.importAccountsCSV(s, "id,name,potential\nA300,X,1\nA301,Y,lots\n"), /not a number/);
  assert.equal(s.accounts.length, n);
});

test("save and reopen a data file", () => {
  const s = Demo.build();
  const sc = S.createScenario(s, "Draft");
  const reopened = S.load(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(S.align(reopened, M), S.align(s, M));
  const id = S.addGeoRule(reopened, sc.id, { territory: "HEM-WEST", prefix: "99" });
  const allIds = [...reopened.roster, ...reopened.scenarios.flatMap(x => [...x.accountRules, ...x.geoRules])].map(x => x.id);
  assert.equal(allIds.filter(x => x === id).length, 1);
  assert.throws(() => S.load({ hello: 1 }), /not a Territory Manager/);
  assert.throws(() => S.load({ ...s, version: 99 }), /newer version/);
});

test("export CSV", () => {
  const lines = S.exportCSV(Demo.build(), M).split("\r\n");
  assert.ok(lines[0].startsWith("account_id,account_name,field_force,territory"));
  assert.ok(lines.some(l => l.startsWith("A001,Northgate University Hospital,HEM,HEM-KAM,account_rule")));
});

test("map areas: assign by clicking areas overrides broader postal rules", () => {
  const s = Demo.build();
  assert.equal(s.geo.units.length, 57);
  let st = S.areaStatus(s, M, "HEM");
  assert.deepEqual(st.get("90").territories, ["HEM-EAST"]);
  assert.equal(st.get("90").own, false);                      // covered by the broad rule "9"
  assert.deepEqual([st.get("11").eligible, st.get("11").accounts], [1, 3]);
  S.assignAreas(s, M, "HEM", ["90", "91"], "HEM-WEST");
  st = S.areaStatus(s, M, "HEM");
  assert.deepEqual(st.get("90").territories, ["HEM-WEST"]);
  assert.equal(st.get("90").own, true);
  assert.deepEqual(terr(s, M, "A010"), new Set(["HEM-WEST"]));
  assert.deepEqual(terr(s, M, "A008"), new Set(["IMM-NORTH"]));  // other field force untouched
  S.assignAreas(s, M, "HEM", ["90"], "HEM-KAM");             // reassign replaces, no duplicates
  assert.equal(S.scenario(s, M).geoRules.filter(r => r.prefix === "90").length, 1);
  S.assignAreas(s, M, "HEM", ["90"], null);                   // remove own rule: falls back to "9"
  assert.deepEqual(terr(s, M, "A010"), new Set(["HEM-EAST"]));
  assert.throws(() => S.assignAreas(s, M, "HEM", ["90"], "IMM-NORTH"), /not in field force/);
  // a more specific rule inside an area is reported as a partial assignment
  S.addGeoRule(s, M, { territory: "HEM-WEST", prefix: "113" });
  assert.deepEqual(S.areaStatus(s, M, "HEM").get("11").partial, [{ prefix: "113", territories: ["HEM-WEST"] }]);
});

test("map areas: bricks match the account brick column", () => {
  const s = Demo.build();
  const sq = (x, y) => ({ type: "Polygon", coordinates: [[[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1], [x, y]]] });
  const gj = { type: "FeatureCollection", features: [
    { type: "Feature", properties: { BRICK: "b-100", NAME: "North" }, geometry: sq(18, 59) },
    { type: "Feature", properties: { BRICK: "B-200", NAME: "South" }, geometry: sq(13, 55) },
    { type: "Feature", properties: { BRICK: "B-200" }, geometry: sq(14, 55) },             // merged into B-200
    { type: "Feature", properties: { BRICK: "B-300" }, geometry: { type: "Point", coordinates: [1, 2] } }] };
  assert.equal(S.setGeography(s, { kind: "brick", source: "test", units: S.unitsFromGeoJSON(gj, "BRICK", "NAME") }), 2);
  assert.equal(s.geo.units.find(u => u.code === "B-200").polygons.length, 2);
  S.upsertAccounts(s, [{ id: "A001", name: "Northgate University Hospital", segment: "High", brick: "B-100" }]);
  S.assignAreas(s, M, "HEM", ["B-100"], "HEM-WEST");
  assert.deepEqual(terr(s, M, "A001"), new Set(["HEM-WEST"]));    // brick beats the postal rule "1"
  assert.equal(S.areaStatus(s, M, "HEM").get("B-100").eligible, 1);
  assert.deepEqual(terr(s, M, "A002"), new Set(["HEM-EAST"]));    // no brick: postal rules still apply
  assert.throws(() => S.setGeography(s, { kind: "brick", units: [{ code: "X", geometry: sq(500, 3000) }] }), /WGS84/);
  assert.throws(() => S.unitsFromGeoJSON({ foo: 1 }, "a"), /GeoJSON/);
  const reopened = S.load(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(S.align(reopened, M), S.align(s, M));
});
