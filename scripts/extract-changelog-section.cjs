/**
 * Extract a version section from CHANGELOG.md for GitHub Release body.
 *
 * Usage:
 *   node scripts/extract-changelog-section.cjs 0.5.14
 */
const fs = require("fs");
const path = require("path");

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
	console.error("Usage: node scripts/extract-changelog-section.cjs <semver>");
	process.exit(1);
}

const changelogPath = path.join(__dirname, "..", "CHANGELOG.md");
if (!fs.existsSync(changelogPath)) {
	console.error("CHANGELOG.md is missing");
	process.exit(1);
}

const content = fs.readFileSync(changelogPath, "utf8");
const escapedVersion = version.replace(/\./g, "\\.");
const headerPattern = new RegExp(`^## \\[${escapedVersion}\\][^\\n]*\\n`, "m");
const match = content.match(headerPattern);
if (!match) {
	console.error(`No changelog entry found for ${version}`);
	process.exit(1);
}

const start = match.index + match[0].length;
const rest = content.slice(start);
const nextHeaderIndex = rest.search(/^## \[/m);
const section = (nextHeaderIndex === -1 ? rest : rest.slice(0, nextHeaderIndex)).trim();
if (!section) {
	console.error(`Changelog entry for ${version} is empty`);
	process.exit(1);
}

process.stdout.write(`${section}\n`);
