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

  // phone width: no sideways page scroll
  await page.setViewportSize({ width: 390, height: 800 });
  await page.click("nav >> text=Territories");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "horizontal scroll at phone width");
  await snap("5-phone");

  assert.deepEqual(errors, [], "page errors");
  assert.deepEqual(network, [], "network requests");
  console.log("Browser check passed: works from disk with no network access.");
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
