// Rebuilds scripts/index.json from the .md and .txt files in scripts/.
// The app reads the index to find new and edited scripts.
// Run after adding or editing a script: npm run scripts
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const dir = path.join(__dirname, "..", "scripts");
const hashOf = text => crypto.createHash("sha1").update(text.replace(/\r/g, "").trim()).digest("hex").slice(0, 10);

function build() {
  const files = fs.readdirSync(dir).filter(f => /\.(md|txt)$/i.test(f)).sort().reverse();
  return { scripts: files.map(file => ({ file, hash: hashOf(fs.readFileSync(path.join(dir, file), "utf8")) })) };
}

if (require.main === module) {
  fs.mkdirSync(dir, { recursive: true });
  const index = build();
  fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify(index, null, 2) + "\n");
  console.log(`scripts/index.json lists ${index.scripts.length} script${index.scripts.length === 1 ? "" : "s"}`);
}

module.exports = { build };
