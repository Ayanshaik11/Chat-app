// Forces EVERY Expo package that is installed (even indirectly) to the exact version
// range the installed Expo SDK expects. `expo install --fix` only checks packages listed
// in package.json, so a mismatched indirect package (e.g. expo-asset) can slip through
// and crash the app the moment it opens (NoClassDefFoundError ... AnyTypeCache).

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = process.cwd();
const bundledPath = path.join(root, "node_modules", "expo", "bundledNativeModules.json");

if (!fs.existsSync(bundledPath)) {
  console.error("node_modules/expo/bundledNativeModules.json not found - run npm install first.");
  process.exit(1);
}

const bundled = JSON.parse(fs.readFileSync(bundledPath, "utf8"));
const wanted = [];

for (const [name, range] of Object.entries(bundled)) {
  const pkgJson = path.join(root, "node_modules", name, "package.json");
  if (!fs.existsSync(pkgJson)) continue;

  const installed = JSON.parse(fs.readFileSync(pkgJson, "utf8")).version;
  wanted.push({ name, expected: range, installed });
}

console.log(`Aligning ${wanted.length} installed packages with the Expo SDK:`);
console.table(wanted);

const specs = wanted.map((w) => JSON.stringify(`${w.name}@${w.expected}`));

if (process.env.DRY_RUN) {
  console.log("DRY_RUN: npm install --legacy-peer-deps " + specs.join(" "));
} else if (specs.length) {
  execSync(`npm install --legacy-peer-deps ${specs.join(" ")}`, { stdio: "inherit" });
}
