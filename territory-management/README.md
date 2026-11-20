# Territory Manager

Build and test sales territory alignments: territory hierarchies per field force, account and
geography rules, manual overrides, what-if scenarios, field requests, and CSV import/export.

**One file. Nothing to install.** `territory-manager.html` runs in any modern browser (Edge,
Chrome, Firefox, Safari), offline. No server, no internet, no admin rights; nothing is uploaded.

## Using it

1. Download [`territory-manager.html`](territory-manager.html) (or get it by email or Teams from a colleague).
2. Double-click it. It opens in your browser.
3. Choose **Try it with demo data**, **Start empty**, or **Open a data file**.

### Where your work is kept

- **Automatically in your browser** (IndexedDB, with room for large map files), so closing and reopening the file brings your work back
  (same computer, same browser).
- **In a data file** (`.json`) when you use **File → Save**. Use this for backups, for moving to
  another computer, and for sharing with colleagues.
  - In **Edge and Chrome**, after the first save, every change is written to that file automatically.
  - In Firefox and Safari, **Save** downloads an up-to-date copy each time.

Each person runs their own copy. To share an alignment, send the data file; the colleague opens
it with **File → Open data file**. *Remove data from this browser* in the File menu clears the
browser copy (for example on a shared computer). Saved data files are not affected.

### Getting your accounts in

**File → Import accounts (CSV)** with columns
`id, name, type, specialty, segment, postal_code, city, potential`. CSVs saved from Excel work,
including Swedish ones that use semicolons and decimal commas. Any extra column (e.g. `tier`)
can be used in rules. Importing again updates accounts with the same id.

**File → Export alignment (CSV)** gives one row per account and territory, with the reason. Use
it to load into a CRM or to check in Excel.

## Map

The **Map** tab shows bricks or postal-code areas coloured by territory, with live account and
workload totals per territory for balancing.

- **Select:** click an area; Ctrl+click adds more; Shift+drag selects a box; *Find* jumps to a code.
- **Assign:** pick a territory in *Assign to* (or click it in the legend), then *Assign*. Turn on
  **Paint mode** to assign each area as you click it. *(remove area rule)* takes an area's own rule away.
- **Move around:** drag to pan, scroll or +/− to zoom, *Fit* to see everything.
- Solid colour means the area has its own rule; lighter means a broader rule covers it
  (e.g. rule `1` covers areas 11, 14, 17…). An area's own rule always wins.

**Your boundaries:** *File → Import map areas (GeoJSON)*, then choose which property holds the
code (and name) and whether the areas are **postal-code areas** or **bricks**.

- The file must be in longitude/latitude (WGS84 / EPSG:4326). In QGIS: *Export → Save Features As →
  GeoJSON, CRS EPSG:4326*. Simplifying very detailed shapes first keeps the data file small.
- Postal-code areas match accounts by the start of their `postal_code`. Bricks match an account's
  `brick` column exactly, so add a `brick` column to your account CSV.
- Accounts with `lat` and `lon` columns are drawn as dots.

The map is drawn from your own boundary file, with no online map service, so it works offline.
The built-in **demo map of Sweden** uses generated, approximate shapes and is for trying the app only.

## How an account gets its territory

Per field force, per account:

1. The account must fit the field force's targeting (e.g. specialty is Hematology); otherwise only
   manual includes apply.
2. Manual includes always apply.
3. Account rules: every matching rule at the best (lowest) priority assigns, and geography is skipped.
4. Geography rules: a brick rule matching the account's `brick`, otherwise the longest matching
   postal-code start; territories sharing one share the account.
5. Manual excludes remove a territory.

Every assignment shows its reason on the Accounts tab.

Condition operators: `eq ne in not_in starts_with contains gte lte`.

## For developers

Plain JavaScript, no dependencies. Sources are in `src/`, and `node build.js` inlines them into
`territory-manager.html`. Commit the rebuilt file, since that is what people download.

```
src/engine.js   alignment rules, diff, metrics, CSV (pure functions)
src/store.js    data model and operations; the whole state is one JSON object
src/demo.js     fictional demo data and demo map
src/map.js      map tab: SVG rendering, pan/zoom, selection, GeoJSON import
src/app.js      user interface, browser storage, file open/save
src/index.html  page template; src/style.css styles
```

```bash
npm test          # unit tests (Node 18+)
npm run build     # rebuild territory-manager.html
node test/e2e.js  # browser check from disk with network blocked (needs Playwright)
```

GitHub Actions (`.github/workflows/territory-manager.yml`) runs the tests, checks the HTML file is
rebuilt, and on a `tm-v*` tag attaches `territory-manager.html` to a release.
