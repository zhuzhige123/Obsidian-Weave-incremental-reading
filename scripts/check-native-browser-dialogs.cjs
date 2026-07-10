#!/usr/bin/env node
/**
 * 禁止在 Obsidian 插件运行时代码中使用浏览器原生对话框。
 * window.confirm / alert / prompt 会劫持 Electron 焦点，导致编辑器无法立即恢复编辑。
 */
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const srcRoot = path.join(repoRoot, "src");

const forbiddenPatterns = [
	{ id: "window.confirm", regex: /\bwindow\.confirm\s*\(/g },
	{ id: "window.alert", regex: /\bwindow\.alert\s*\(/g },
	{ id: "window.prompt", regex: /\bwindow\.prompt\s*\(/g },
	{ id: "globalThis.confirm", regex: /\bglobalThis\.confirm\s*\(/g },
	{ id: "globalThis.alert", regex: /\bglobalThis\.alert\s*\(/g },
	{ id: "globalThis.prompt", regex: /\bglobalThis\.prompt\s*\(/g },
];

const skipDirNames = new Set(["__tests__", "demo", "tests"]);
const skipFilePattern = /\.(test|spec)\.(ts|js)$/;

function shouldScanFile(relativePath) {
	if (skipFilePattern.test(relativePath)) {
		return false;
	}
	return /\.(ts|svelte|js|mjs|cjs)$/.test(relativePath);
}

function collectFiles(dir, output = []) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (entry.name === "node_modules" || entry.name.startsWith(".")) {
			continue;
		}
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (skipDirNames.has(entry.name)) {
				continue;
			}
			collectFiles(fullPath, output);
			continue;
		}
		const relativePath = path.relative(srcRoot, fullPath).replace(/\\/g, "/");
		if (shouldScanFile(relativePath)) {
			output.push(fullPath);
		}
	}
	return output;
}

function scanFile(filePath) {
	const content = fs.readFileSync(filePath, "utf8");
	const lines = content.split(/\r?\n/u);
	const relativePath = path.relative(repoRoot, filePath).replace(/\\/g, "/");
	const hits = [];

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
		const line = lines[lineIndex];
		for (const pattern of forbiddenPatterns) {
			pattern.regex.lastIndex = 0;
			if (pattern.regex.test(line)) {
				hits.push({
					relativePath,
					line: lineIndex + 1,
					pattern: pattern.id,
					text: line.trim(),
				});
			}
		}
	}

	return hits;
}

function main() {
	if (!fs.existsSync(srcRoot)) {
		console.error("[check-native-browser-dialogs] src/ not found.");
		process.exit(1);
	}

	const files = collectFiles(srcRoot);
	const violations = files.flatMap((filePath) => scanFile(filePath));

	if (violations.length === 0) {
		console.log(
			`[check-native-browser-dialogs] OK: no native browser dialogs in ${files.length} scanned files.`
		);
		return;
	}

	console.error("[check-native-browser-dialogs] Forbidden native browser dialog usage detected:");
	for (const hit of violations) {
		console.error(`  - ${hit.relativePath}:${hit.line} (${hit.pattern})`);
		console.error(`    ${hit.text}`);
	}
	console.error("");
	console.error("Use Obsidian Modal helpers instead:");
	console.error("  - src/utils/obsidian-confirm.ts -> showObsidianConfirm / showDeleteConfirm / showObsidianInput");
	console.error("  - See .codex/skills/obsidian-native-dialogs/SKILL.md");
	process.exit(1);
}

main();
