/* Fictional demo data. All names are made up. */
var TMDemo = (function (S) {
  "use strict";
  const ACCOUNTS = [
    ["A001", "Northgate University Hospital", "Hospital", "Hematology", "Centre of Excellence", "171 64", "Solna", 95],
    ["A002", "Lakeside Hematology Clinic", "Clinic", "Hematology", "High", "113 45", "Stockholm", 60],
    ["A003", "Birchwood Children's Hospital", "Hospital", "Pediatric hematology", "High", "141 86", "Huddinge", 70],
    ["A004", "Uppland Regional Hospital", "Hospital", "Hematology", "Medium", "751 85", "Uppsala", 50],
    ["A005", "Southcoast University Hospital", "Hospital", "Hematology", "Centre of Excellence", "221 85", "Lund", 90],
    ["A006", "Harbour Blood Disorders Unit", "Clinic", "Hematology", "Medium", "211 20", "Malmö", 40],
    ["A007", "Westbay Hospital", "Hospital", "Hematology", "High", "413 45", "Göteborg", 65],
    ["A008", "Riverside Rheumatology", "Clinic", "Rheumatology", "High", "114 28", "Stockholm", 55],
    ["A009", "Pinecrest Immunology Centre", "Clinic", "Immunology", "Medium", "416 50", "Göteborg", 45],
    ["A010", "Northern Lights Hospital", "Hospital", "Hematology", "Medium", "901 85", "Umeå", 35],
    ["A011", "Fjällgården Clinic", "Clinic", "Rheumatology", "Low", "831 30", "Östersund", 15],
    ["A012", "Meadow Family Practice", "Clinic", "General practice", "Low", "118 20", "Stockholm", 5],
    ["A013", "Coastline Rheumatology", "Clinic", "Rheumatology", "Medium", "252 21", "Helsingborg", 30],
    ["A014", "Ironworks County Hospital", "Hospital", "Immunology", "Medium", "702 10", "Örebro", 40],
    ["A015", "Linden Pediatric Centre", "Clinic", "Pediatric hematology", "Medium", "582 25", "Linköping", 30],
  ];

  function build() {
    const s = S.create();
    S.upsertAccounts(s, ACCOUNTS.map(a => Object.fromEntries(S.ACCOUNT_COLS.map((c, i) => [c, a[i]]))));
    S.upsertFieldForce(s, { code: "HEM", name: "Hematology", target: [{ field: "specialty", op: "in", value: ["Hematology", "Pediatric hematology"] }] });
    S.upsertFieldForce(s, { code: "IMM", name: "Immunology & Rheumatology", target: [{ field: "specialty", op: "in", value: ["Immunology", "Rheumatology"] }] });
    const M = S.MASTER, t = (code, name, fieldForce, parent) => S.addTerritory(s, M, { code, name, fieldForce, parent });
    t("HEM-SE", "Hematology Sweden", "HEM");
    t("HEM-KAM", "Hematology Key Accounts", "HEM", "HEM-SE");
    t("HEM-EAST", "Hematology East", "HEM", "HEM-SE");
    t("HEM-WEST", "Hematology West & South", "HEM", "HEM-SE");
    t("IMM-SE", "Immunology Sweden", "IMM");
    t("IMM-NORTH", "Immunology North", "IMM", "IMM-SE");
    t("IMM-SOUTH", "Immunology South", "IMM", "IMM-SE");
    S.addAccountRule(s, M, { territory: "HEM-KAM", priority: 10, name: "Centres of excellence",
      conditions: [{ field: "segment", op: "eq", value: "Centre of Excellence" }] });
    ["1", "5", "6", "7", "8", "9"].forEach(prefix => S.addGeoRule(s, M, { territory: "HEM-EAST", prefix }));
    ["2", "3", "4"].forEach(prefix => S.addGeoRule(s, M, { territory: "HEM-WEST", prefix }));
    ["1", "7", "8", "9"].forEach(prefix => S.addGeoRule(s, M, { territory: "IMM-NORTH", prefix }));
    ["2", "3", "4", "5", "6"].forEach(prefix => S.addGeoRule(s, M, { territory: "IMM-SOUTH", prefix }));
    const r = (territory, person, email, role = "rep") => S.addRoster(s, { territory, person, email, role });
    r("HEM-SE", "Charlie Nyberg", "charlie.nyberg@example.com", "manager");
    r("HEM-KAM", "Alex Berg", "alex.berg@example.com", "key account manager");
    r("HEM-EAST", "Sam Lind", "sam.lind@example.com");
    r("HEM-WEST", "Robin Ek", "robin.ek@example.com");
    r("IMM-NORTH", "Kim Holm", "kim.holm@example.com");
    r("IMM-SOUTH", "Jo Strand", "jo.strand@example.com");
    return s;
  }

  return { build };
})(typeof TMStore !== "undefined" ? TMStore : require("./store.js"));

if (typeof module !== "undefined") module.exports = TMDemo;
