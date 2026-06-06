#!/usr/bin/env node
/**
 * 防止从独立 IR 入口再次引入主插件 / 阅读器重型运行时。
 */
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const entryFiles = [
	path.join(repoRoot, "src", "main.ts"),
	path.join(repoRoot, "src", "utils", "i18n", "resources.ts"),
];
const srcRoot = path.join(repoRoot, "src");

const forbiddenPathFragments = [
	"/utils/i18n/resources/management-ui",
	"/utils/i18n/resources/management.ts",
	"/utils/i18n/resources/study.ts",
	"/utils/i18n/resources/app-shell.ts",
	"/utils/i18n/deck-analytics-overrides",
	"/services/ankiconnect/",
	"/services/deck/",
	"/services/progressive-cloze/",
	"/services/question-bank/",
	"/parsers/",
	"/parsing/",
	"/components/study/",
	"/components/question-bank/",
	"/EpubStorageService",
	"foliate-js/",
	"FoliateVaultPublicationParser",
	"IrEpubPublicationTocParser",
	"/epub-integration/vendor/",
	"/components/search/CardSearchInput",
];

const allowedLegacyImportPrefixes = ["legacy-main-plugin-archive/"];

function collectSourceFiles(dir, output = []) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (entry.name === "node_modules" || entry.name.startsWith(".")) {
			continue;
		}
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			collectSourceFiles(fullPath, output);
			continue;
		}
		if (/\.(ts|svelte|js|mjs|cjs)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) {
			output.push(fullPath);
		}
	}
	return output;
}

function resolveImport(fromFile, spec) {
	if (!spec.startsWith(".") && !spec.startsWith("/")) {
		return null;
	}
	const baseDir = path.dirname(fromFile);
	const raw = spec.startsWith("/") ? path.join(srcRoot, spec.slice(1)) : path.resolve(baseDir, spec);
	const candidates = [
		raw,
		`${raw}.ts`,
		`${raw}.svelte`,
		`${raw}.js`,
		path.join(raw, "index.ts"),
	];
	for (const candidate of candidates) {
		if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
			return candidate;
		}
	}
	return null;
}

function parseImports(filePath) {
	const content = fs.readFileSync(filePath, "utf8");
	const imports = [];
	const staticImport = /import\s+(?:type\s+)?[^'";]+['"]([^'"]+)['"]/g;
	const dynamicImport = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
	let match;
	while ((match = staticImport.exec(content))) {
		imports.push(match[1]);
	}
	while ((match = dynamicImport.exec(content))) {
		imports.push(match[1]);
	}
	return imports;
}

function isAllowed(spec) {
	return allowedLegacyImportPrefixes.some((prefix) => spec.includes(prefix));
}

function walkReachable(startFile) {
	const queue = [startFile];
	const visited = new Set();
	const violations = [];

	while (queue.length > 0) {
		const current = queue.pop();
		if (visited.has(current)) {
			continue;
		}
		visited.add(current);

		const normalized = current.split(path.sep).join("/");
		for (const fragment of forbiddenPathFragments) {
			if (normalized.includes(fragment)) {
				violations.push(normalized);
			}
		}

		for (const spec of parseImports(current)) {
			if (isAllowed(spec)) {
				continue;
			}
			const resolved = resolveImport(current, spec);
			if (resolved && !visited.has(resolved)) {
				queue.push(resolved);
			}
		}
	}

	return [...new Set(violations)];
}

const allViolations = [];
for (const entryFile of entryFiles) {
	if (!fs.existsSync(entryFile)) {
		console.error(`[check-main-entry-imports] Missing entry: ${entryFile}`);
		process.exit(1);
	}
	for (const file of walkReachable(entryFile)) {
		allViolations.push({ entry: path.relative(repoRoot, entryFile), file });
	}
}

if (allViolations.length > 0) {
	console.error("[check-main-entry-imports] Forbidden modules reachable from startup/i18n entries:");
	for (const violation of allViolations) {
		console.error(`  - ${violation.file} (via ${violation.entry})`);
	}
	process.exit(1);
}

console.log(
	"[check-main-entry-imports] OK: no forbidden modules reachable from src/main.ts or i18n/resources.ts"
);
