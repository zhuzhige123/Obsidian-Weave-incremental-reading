/**
 * Regenerate root LICENSE and obsidian-community/LICENSE from .gpl-3.0.txt.
 * Run: node scripts/generate-gpl-license.cjs
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const gplPath = path.join(ROOT, ".gpl-3.0.txt");

if (!fs.existsSync(gplPath)) {
	console.error("Missing .gpl-3.0.txt — download from https://www.gnu.org/licenses/gpl-3.0.txt");
	process.exit(1);
}

const gpl = fs.readFileSync(gplPath, "utf8");
const header = [
	"Weave Incremental Reading - Standalone incremental reading plugin for Obsidian.",
	"Copyright (C) 2025-2026 Rabbit (zhuzhige)",
	"",
].join("\n");

const body = gpl.replace(
	" Copyright (C) 2007 Free Software Foundation, Inc. <https://fsf.org/>",
	" Copyright (C) 2025-2026 Rabbit (zhuzhige)"
);

const license = `${header}\n${body}`;

for (const target of ["LICENSE", "obsidian-community/LICENSE"]) {
	fs.writeFileSync(path.join(ROOT, target), license, "utf8");
	console.log(`Wrote ${target} (${license.length} bytes)`);
}
