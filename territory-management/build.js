// Builds the single self-contained file: node build.js  ->  territory-manager.html
// No dependencies. The output works offline by double-clicking it.
const fs = require("fs");
const path = require("path");

const VERSION = "2.0.0";
const src = f => fs.readFileSync(path.join(__dirname, "src", f), "utf8");
const scripts = ["engine.js", "store.js", "demo.js", "app.js"]
  .map(f => `// ---- ${f} ----\n` + src(f).replace(/^if \(typeof module !== "undefined"\).*$/m, ""))
  .join("\n")
  .replace(/<\/script/gi, "<\\/script");

const html = src("index.html")
  .replace(/\{\{VERSION\}\}/g, VERSION)
  .replace("{{STYLE}}", () => src("style.css"))
  .replace("{{SCRIPTS}}", () => scripts);

const out = path.join(__dirname, "territory-manager.html");
fs.writeFileSync(out, html);
console.log(`Built ${path.basename(out)} (${(html.length / 1024).toFixed(0)} KB, version ${VERSION})`);
