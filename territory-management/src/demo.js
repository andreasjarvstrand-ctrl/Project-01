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

  // Approximate outline of mainland Sweden (lon, lat) and 2-digit postal areas placed at
  // their main towns. Shapes are generated, not real boundaries: for demonstration only.
  const OUTLINE = [[12.6,56.0],[12.9,55.4],[14.2,55.4],[14.4,56.0],[16.0,56.2],[16.6,57.0],[16.5,57.9],[16.8,58.6],[18.0,59.0],
    [19.0,59.8],[17.6,60.6],[17.3,61.5],[17.4,62.3],[18.6,63.2],[20.3,63.7],[21.5,64.6],[21.2,65.3],[22.4,65.8],[24.1,65.8],
    [23.6,66.4],[24.0,67.2],[23.4,68.0],[21.0,69.0],[20.0,68.5],[18.1,68.5],[16.5,67.5],[15.4,66.3],[14.5,65.4],[13.7,64.5],
    [12.1,63.8],[12.2,62.5],[12.9,61.6],[12.4,61.0],[12.6,60.4],[11.8,59.8],[11.5,59.0],[11.3,58.5],[11.8,57.6],[12.2,57.2],[12.9,56.6]];
  const AREAS = [
    ["11", "Stockholm", 18.06, 59.34], ["14", "Huddinge", 17.95, 59.15], ["15", "Södertälje", 17.55, 59.2], ["17", "Solna", 17.85, 59.45],
    ["18", "Täby & Norrtälje", 18.55, 59.62], ["19", "Sigtuna", 17.7, 59.65], ["21", "Malmö", 13.0, 55.6], ["22", "Lund", 13.3, 55.75],
    ["23", "Trelleborg", 13.15, 55.42], ["24", "Höör", 13.6, 55.95], ["25", "Helsingborg", 12.75, 56.05], ["26", "Ängelholm", 12.95, 56.3],
    ["27", "Ystad", 13.9, 55.5], ["29", "Kristianstad", 14.2, 56.05], ["30", "Halmstad", 12.9, 56.7], ["31", "Varberg", 12.3, 57.1],
    ["33", "Värnamo", 14.0, 57.2], ["35", "Växjö", 14.8, 56.9], ["37", "Karlskrona", 15.5, 56.25], ["38", "Kalmar", 16.2, 56.75],
    ["41", "Göteborg", 11.97, 57.71], ["43", "Kungsbacka", 12.15, 57.45], ["44", "Kungälv", 11.95, 58.0], ["45", "Uddevalla", 11.8, 58.45],
    ["46", "Trollhättan", 12.35, 58.3], ["50", "Borås", 12.95, 57.72], ["53", "Lidköping", 13.15, 58.5], ["54", "Skövde", 13.85, 58.4],
    ["55", "Jönköping", 14.16, 57.78], ["57", "Västervik", 15.9, 57.6], ["58", "Linköping", 15.62, 58.41], ["60", "Norrköping", 16.18, 58.59],
    ["61", "Nyköping", 17.0, 58.8], ["63", "Eskilstuna", 16.5, 59.37], ["65", "Karlstad", 13.5, 59.4], ["68", "Arvika", 12.6, 60.0],
    ["70", "Örebro", 15.2, 59.27], ["72", "Västerås", 16.55, 59.61], ["75", "Uppsala", 17.64, 59.86], ["74", "Östhammar", 18.2, 60.2],
    ["77", "Ludvika", 15.2, 60.15], ["79", "Mora", 14.5, 61.0], ["80", "Gävle", 17.14, 60.67], ["82", "Hudiksvall", 16.6, 61.7],
    ["84", "Sveg", 13.8, 62.2], ["83", "Östersund", 14.64, 63.18], ["85", "Sundsvall", 17.3, 62.39], ["87", "Härnösand", 17.9, 62.9],
    ["89", "Örnsköldsvik", 18.7, 63.3], ["90", "Umeå", 20.26, 63.83], ["91", "Lycksele", 18.7, 64.6], ["92", "Storuman", 16.6, 65.2],
    ["93", "Skellefteå", 20.95, 64.75], ["94", "Piteå", 21.4, 65.35], ["95", "Luleå", 22.9, 65.9], ["96", "Jokkmokk", 20.0, 66.6],
    ["98", "Kiruna", 20.2, 67.85],
  ];

  function geography() {
    const k = Math.cos(62 * Math.PI / 180);  // shrink longitude so the cells look right at Swedish latitudes
    const P = ([lon, lat]) => [lon * k, lat];
    const outline = OUTLINE.map(P);
    // Clip the outline by the perpendicular bisector to every other town: a Voronoi cell.
    const clip = (poly, a, b) => {
      const d = [b[0] - a[0], b[1] - a[1]], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const side = p => (p[0] - m[0]) * d[0] + (p[1] - m[1]) * d[1];
      const out = [];
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i], q = poly[(i + 1) % poly.length], sp = side(p), sq = side(q);
        if (sp <= 0) out.push(p);
        if ((sp <= 0) !== (sq <= 0)) { const t = sp / (sp - sq); out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); }
      }
      return out;
    };
    const units = AREAS.map(([code, name, lon, lat], i) => {
      const a = P([lon, lat]);
      let cell = outline;
      AREAS.forEach(([, , lon2, lat2], j) => { if (j !== i && cell.length) cell = clip(cell, a, P([lon2, lat2])); });
      const ring = cell.map(([x, y]) => [x / k, y]);
      ring.push(ring[0]);
      return { code, name, geometry: { type: "Polygon", coordinates: [ring] } };
    });
    return { kind: "postal", units, source: "Demo map (approximate shapes)" };
  }

  // Approximate town positions for the demo accounts, so they show as dots on the map.
  const PLACES = { Solna: [18.0, 59.36], Stockholm: [18.07, 59.33], Huddinge: [17.98, 59.24], Uppsala: [17.64, 59.86], Lund: [13.19, 55.7],
    "Malmö": [13.0, 55.6], "Göteborg": [11.97, 57.71], "Umeå": [20.26, 63.83], "Östersund": [14.64, 63.18], Helsingborg: [12.7, 56.05],
    "Örebro": [15.21, 59.27], "Linköping": [15.62, 58.41] };

  function build() {
    const s = S.create();
    S.upsertAccounts(s, ACCOUNTS.map(a => {
      const acct = Object.fromEntries(S.ACCOUNT_COLS.map((c, i) => [c, a[i]]));
      const pl = PLACES[acct.city];
      if (pl) { acct.lon = pl[0] + ((acct.id.charCodeAt(3) % 5) - 2) * 0.03; acct.lat = pl[1] + ((acct.id.charCodeAt(3) % 3) - 1) * 0.02; }
      return acct;
    }));
    S.setGeography(s, geography());
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

  return { build, geography };
})(typeof TMStore !== "undefined" ? TMStore : require("./store.js"));

if (typeof module !== "undefined") module.exports = TMDemo;
