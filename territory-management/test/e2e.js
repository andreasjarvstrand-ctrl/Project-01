// Browser check of the built file, opened from disk with all network access blocked.
// Needs Playwright (not required to use the app):  node test/e2e.js [screenshot-dir]
const path = require("path");
const fs = require("fs");
const os = require("os");
const assert = require("assert/strict");
const { chromium } = require("playwright");

(async () => {
  const shots = process.argv[2];
  const file = "file://" + path.resolve(__dirname, "..", "territory-manager.html");
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
  // Simulate browsers without direct file access, so Save falls back to a download.
  await ctx.addInitScript(() => { delete window.showSaveFilePicker; delete window.showOpenFilePicker; });
  const network = [];
  await ctx.route("**/*", r => (r.request().url().startsWith("file:") ? r.continue() : (network.push(r.request().url()), r.abort())));
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => m.type() === "error" && errors.push(m.text()));
  page.on("dialog", d => d.accept());
  const snap = async n => shots && page.screenshot({ path: path.join(shots, n + ".png"), fullPage: true });
  const text = () => page.locator("#view").innerText();

  await page.goto(file);
  await page.waitForSelector(".welcome");
  assert.match(await text(), /Try it with demo data/);
  await snap("1-welcome");
  await page.click("text=Try it with demo data");
  assert.match(await text(), /HEM-KAM/);
  await snap("2-territories");

  // scenario: move Umeå to West, compare, publish
  await page.click("nav >> text=Scenarios");
  await page.fill("#fScen input[name=name]", "Move north");
  await page.click("#fScen button");
  await page.fill("#fGeo input[name=prefix]", "90, 91");
  await page.selectOption("#fGeo select", "HEM-WEST");
  await page.click("#fGeo button");
  await page.click("nav >> text=Scenarios");
  await page.click("[data-a=diff]");
  assert.match(await page.locator("#diff").innerText(), /1 account move/);
  await snap("3-scenario-diff");
  await page.click("[data-a=publish]");
  assert.match(await page.locator("#scenario").innerText(), /Master \(master\)/);

  // import accounts CSV (Excel style)
  const csv = path.join(os.tmpdir(), "tm-accounts.csv");
  fs.writeFileSync(csv, "﻿id;name;specialty;postal_code;potential\nA500;Åsa Vårdcentral;Hematology;411 01;12,5\n");
  await page.click("#menuBtn");
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("text=Import accounts (CSV)…")]);
  await chooser.setFiles(csv);
  await page.click("nav >> text=Accounts");
  await page.fill("#q", "Åsa");
  await page.waitForTimeout(300);
  assert.match(await text(), /HEM-WEST/);
  await snap("4-accounts");

  // data survives closing and reopening the file
  await page.reload();
  await page.click("nav >> text=Accounts");
  assert.match(await text(), /Åsa Vårdcentral/);

  // save to a file, start empty, open the file again
  await page.click("#menuBtn");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#menuItems >> text=Save as…")]);
  const saved = path.join(os.tmpdir(), dl.suggestedFilename());
  await dl.saveAs(saved);
  await page.click("#menuBtn");
  await page.click("text=New, empty data");
  await page.click("nav >> text=Territories");
  assert.match(await text(), /adding a field force/);
  await page.click("#menuBtn");
  const [ch2] = await Promise.all([page.waitForEvent("filechooser"), page.click("text=Open data file…")]);
  await ch2.setFiles(saved);
  await page.click("nav >> text=Accounts");
  assert.match(await text(), /Åsa Vårdcentral/);

  // alignment export
  await page.click("#menuBtn");
  const [dl2] = await Promise.all([page.waitForEvent("download"), page.click("text=Export alignment (CSV)")]);
  const exported = fs.readFileSync(await dl2.path(), "utf8");
  assert.ok(exported.startsWith("﻿account_id") && exported.includes("A010,Northern Lights Hospital,HEM,HEM-WEST"));

  // map: select, assign, paint, box select, find
  await page.click("nav >> text=Map");
  assert.equal(await page.locator("#mapSvg path").count(), 57);
  await page.waitForTimeout(200);
  const fill = code => page.getAttribute(`#mapSvg path[data-code="${code}"]`, "fill");
  const swatch = code => page.locator(`tr[data-t="${code}"] .sw`).evaluate(e => e.style.background);
  const sameColour = async (code, terr) => {
    const a = await fill(code), b = await swatch(terr);
    const hex = a.replace("#", "").match(/../g).map(x => parseInt(x, 16)).join(", ");
    assert.equal(b, `rgb(${hex})`, `${code} should be coloured as ${terr}`);
  };
  await page.click('#mapSvg path[data-code="91"]');
  assert.match(await page.locator(".selpanel").innerText(), /1 postal area selected/);
  await page.click('#mapSvg path[data-code="92"]', { modifiers: ["Control"] });
  assert.match(await page.locator(".selpanel").innerText(), /2 postal areas selected/);
  await page.selectOption("#mTarget", "HEM-WEST");
  await page.click("#mAssign");
  await sameColour("91", "HEM-WEST");
  await sameColour("92", "HEM-WEST");
  await page.check("#mPaint");
  await page.click('tr[data-t="HEM-KAM"]');
  await page.click('#mapSvg path[data-code="84"]');
  await sameColour("84", "HEM-KAM");
  await page.uncheck("#mPaint");
  const box = await page.locator("#mapSvg").boundingBox();
  await page.keyboard.down("Shift");
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.75);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.95, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  assert.match(await page.locator(".selpanel").innerText(), /\d+ postal areas selected/);
  await page.fill("#mFind input", "41");
  await page.click("#mFind button");
  assert.match(await page.locator(".selpanel").innerText(), /1 postal area selected[\s\S]*41/);
  await page.click("[data-z=fit]");
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.hover('#mapSvg path[data-code="84"]');
  assert.match(await page.locator("#mapTip").innerText(), /HEM-KAM/);
  await snap("6-map");
  // map state survives reopening
  await page.reload();
  await page.click("nav >> text=Map");
  await sameColour("84", "HEM-KAM");

  // import a brick GeoJSON
  const sq = (x, y) => ({ type: "Polygon", coordinates: [[[x, y], [x + 2, y], [x + 2, y + 2], [x, y + 2], [x, y]]] });
  const gjFile = path.join(os.tmpdir(), "bricks.geojson");
  fs.writeFileSync(gjFile, JSON.stringify({ type: "FeatureCollection", features: [
    { type: "Feature", properties: { BRICK_ID: "B1", BRICK_NAME: "North brick" }, geometry: sq(17, 62) },
    { type: "Feature", properties: { BRICK_ID: "B2", BRICK_NAME: "South brick" }, geometry: sq(13, 56) }] }));
  const [ch3] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-g=import]")]);
  await ch3.setFiles(gjFile);
  await page.waitForSelector("#fGeoImp");
  assert.match(await page.locator("#geoImport").innerText(), /2 features/);
  assert.equal(await page.inputValue("#fGeoImp select[name=kind]"), "brick");
  await page.click("#fGeoImp button.btn:not(.ghost)");
  assert.equal(await page.locator("#mapSvg path").count(), 2);
  await page.click("[data-g=demo]");
  assert.equal(await page.locator("#mapSvg path").count(), 57);

  // phone width: no sideways page scroll
  await page.setViewportSize({ width: 390, height: 800 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "horizontal scroll on map at phone width");
  await snap("7-map-phone");
  await page.setViewportSize({ width: 390, height: 800 });
  await page.click("nav >> text=Territories");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "horizontal scroll at phone width");
  await snap("5-phone");

  assert.deepEqual(errors, [], "page errors");
  assert.deepEqual(network, [], "network requests");
  console.log("Browser check passed: works from disk with no network access.");
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
