#!/usr/bin/env node
/**
 * Obsidian Community score report (2026 automated review model).
 *
 * Categories mirror the developer dashboard / ObsidianReviewBot:
 * - Required: must be zero to stay in search
 * - Optional: warnings that lower the safety scorecard
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

const REQUIRED_RULES = new Set([
	"obsidianmd/commands/no-command-in-command-id",
	"obsidianmd/commands/no-command-in-command-name",
	"obsidianmd/commands/no-default-hotkeys",
	"obsidianmd/commands/no-plugin-id-in-command-id",
	"obsidianmd/commands/no-plugin-name-in-command-name",
	"obsidianmd/settings-tab/no-manual-html-headings",
	"obsidianmd/settings-tab/no-problematic-settings-headings",
	"obsidianmd/vault/iterate",
	"obsidianmd/detach-leaves",
	"obsidianmd/editor-drop-paste",
	"obsidianmd/hardcoded-config-path",
	"obsidianmd/no-forbidden-elements",
	"obsidianmd/no-global-this",
	"obsidianmd/no-plugin-as-component",
	"obsidianmd/no-sample-code",
	"obsidianmd/no-tfile-tfolder-cast",
	"obsidianmd/no-view-references-in-plugin",
	"obsidianmd/no-static-styles-assignment",
	"obsidianmd/object-assign",
	"obsidianmd/platform",
	"obsidianmd/prefer-get-language",
	"obsidianmd/prefer-abstract-input-suggest",
	"obsidianmd/prefer-window-timers",
	"obsidianmd/prefer-instanceof",
	"obsidianmd/regex-lookbehind",
	"obsidianmd/sample-names",
	"obsidianmd/validate-manifest",
	"obsidianmd/validate-license",
	"obsidianmd/no-unsupported-api",
	"obsidianmd/ui/sentence-case",
	"obsidianmd/ui/sentence-case-json",
	"obsidianmd/rule-custom-message",
	"no-eval",
	"no-implied-eval",
	"no-alert",
	"no-restricted-globals",
	"no-restricted-imports",
	"@microsoft/sdl/no-document-write",
	"@microsoft/sdl/no-inner-html",
	"import/no-extraneous-dependencies",
	"import/no-nodejs-modules",
	"depend/ban-dependencies",
	"no-undef",
	"no-empty",
]);

const OPTIONAL_RULE_PREFIXES = [
	"obsidianmd/prefer-active-doc",
	"obsidianmd/prefer-file-manager-trash-file",
	"obsidianmd/ui/sentence-case-locale-module",
	"@typescript-eslint/no-unused-vars",
	"@typescript-eslint/no-unsafe-",
	"@typescript-eslint/no-misused-promises",
	"@typescript-eslint/no-floating-promises",
	"@typescript-eslint/restrict-template-expressions",
	"@typescript-eslint/no-base-to-string",
	"@typescript-eslint/no-unnecessary-type-assertion",
	"@typescript-eslint/await-thenable",
	"@typescript-eslint/no-redundant-type-constituents",
	"@typescript-eslint/only-throw-error",
	"@typescript-eslint/prefer-promise-reject-errors",
	"no-useless-escape",
	"no-self-compare",
];

function classify(ruleId) {
	if (!ruleId) return "other";
	if (REQUIRED_RULES.has(ruleId)) return "required";
	if (OPTIONAL_RULE_PREFIXES.some((prefix) => ruleId.startsWith(prefix) || ruleId === prefix)) {
		return "optional";
	}
	if (ruleId.startsWith("obsidianmd/")) return "required";
	if (ruleId.startsWith("@typescript-eslint/")) return "optional";
	return "other";
}

const result = spawnSync(
	"npx",
	["eslint", "-c", "eslint.community.config.mjs", "src", "--max-warnings", "99999", "-f", "json"],
	{ cwd: root, encoding: "utf8", shell: true, maxBuffer: 80 * 1024 * 1024 },
);

const stdout = result.stdout || "";
const start = stdout.indexOf("[");
if (start < 0) {
	console.error("Failed to run community ESLint.");
	if (result.stderr) console.error(result.stderr);
	process.exit(1);
}

const reports = JSON.parse(stdout.slice(start));
const buckets = { required: [], optional: [], other: [] };

for (const file of reports) {
	for (const msg of file.messages) {
		const bucket = classify(msg.ruleId);
		buckets[bucket].push({
			file: path.relative(root, file.filePath).replace(/\\/g, "/"),
			line: msg.line,
			severity: msg.severity === 2 ? "error" : "warning",
			rule: msg.ruleId,
			message: msg.message,
		});
	}
}

const requiredErrors = buckets.required.filter((item) => item.severity === "error");
const requiredWarnings = buckets.required.filter((item) => item.severity === "warning");

console.log("Obsidian Community Score Report");
console.log("===============================");
console.log(`Required errors:   ${requiredErrors.length}`);
console.log(`Required warnings: ${requiredWarnings.length}`);
console.log(`Optional warnings: ${buckets.optional.length}`);
console.log(`Other:             ${buckets.other.length}`);

// Heuristic aligned with the 2026 developer dashboard scorecard (not official API).
// Treat each optional warning as a small deduction; required errors dominate.
const estimatedScore = Math.max(
	0,
	Math.min(
		100,
		Math.round(100 - buckets.optional.length * 0.038 - requiredErrors.length * 12 - requiredWarnings.length * 6),
	),
);
console.log(`Estimated score:   ${estimatedScore}/100 (target: 90+)`);

if (requiredErrors.length > 0) {
	console.log("\nBlocking required errors:");
	for (const item of requiredErrors.slice(0, 40)) {
		console.log(`  - ${item.file}:${item.line} [${item.rule}] ${item.message}`);
	}
	if (requiredErrors.length > 40) {
		console.log(`  - ... and ${requiredErrors.length - 40} more`);
	}
}

const ruleCounts = new Map();
for (const item of [...requiredErrors, ...requiredWarnings, ...buckets.optional]) {
	ruleCounts.set(item.rule, (ruleCounts.get(item.rule) || 0) + 1);
}

console.log("\nTop rules:");
[...ruleCounts.entries()]
	.sort((a, b) => b[1] - a[1])
	.slice(0, 15)
	.forEach(([rule, count]) => {
		console.log(`  - ${rule}: ${count}`);
	});

process.exit(requiredErrors.length > 0 ? 1 : 0);
