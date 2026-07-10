#!/usr/bin/env node
/**
 * Fail only on Obsidian community review blocking rules (not type-safety noise).
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const BLOCKING_RULE_PREFIXES = [
	"obsidianmd/",
	"import/no-extraneous-dependencies",
	"import/no-nodejs-modules",
	"@microsoft/sdl/",
	"depend/",
	"no-irregular-whitespace",
];

const root = path.resolve(__dirname, "..");
const result = spawnSync(
	"npx",
	["eslint", "-c", "eslint.community.config.mjs", "src", "--max-warnings", "99999", "-f", "json"],
	{ cwd: root, encoding: "utf8", shell: true, maxBuffer: 50 * 1024 * 1024 },
);

const stdout = result.stdout || "";
const start = stdout.indexOf("[");
if (start < 0) {
	console.error("Failed to run community ESLint.");
	if (result.stderr) console.error(result.stderr);
	process.exit(1);
}

const reports = JSON.parse(stdout.slice(start));
const blocking = [];

for (const file of reports) {
	for (const msg of file.messages) {
		if (msg.severity !== 2) continue;
		const rule = msg.ruleId || "";
		if (!BLOCKING_RULE_PREFIXES.some((prefix) => rule.startsWith(prefix) || rule === prefix)) {
			continue;
		}
		blocking.push({
			file: file.filePath,
			line: msg.line,
			rule,
			message: msg.message,
		});
	}
}

if (blocking.length > 0) {
	console.error(`Obsidian community blocking lint failed (${blocking.length} error(s)):\n`);
	for (const item of blocking) {
		const rel = path.relative(root, item.file).replace(/\\/g, "/");
		console.error(`- ${rel}:${item.line} [${item.rule}] ${item.message}`);
	}
	process.exit(1);
}

console.log("Obsidian community blocking lint passed.");
