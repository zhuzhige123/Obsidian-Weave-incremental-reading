/**
 * Push open-source Obsidian community submission tree to public GitHub main.
 *
 * Includes: src/, build configs, community README/LICENSE, release workflow.
 * Excludes: internal docs, AI configs, sensitive scripts, activation secrets.
 *
 * Usage:
 *   node scripts/sync-obsidian-community-open.cjs
 *   node scripts/sync-obsidian-community-open.cjs --version 0.5.5
 *   node scripts/sync-obsidian-community-open.cjs --dry-run
 */
const fs = require("fs");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const TEMPLATE_DIR = path.join(PROJECT_ROOT, "obsidian-community");
const STAGING_DIR = path.join(PROJECT_ROOT, ".obsidian-community-staging");
const PUBLISH_DIR = path.join(PROJECT_ROOT, ".obsidian-community-publish");
const REMOTE = "origin";
const DEFAULT_BRANCH = "main";
const DEFAULT_GITHUB_REPO = "zhuzhige123/Obsidian-Weave-incremental-reading";

const ROOT_INCLUDE_FILES = new Set([
	".npmrc",
	"CHANGELOG.md",
	"manifest.json",
	"package.json",
	"package-lock.json",
	"versions.json",
	"vite.config.ts",
	"tsconfig.json",
	"svelte.config.js",
	"biome.json",
	"eslint.obsidian.config.mjs",
	"eslint.community.config.mjs",
	".mojibake-baseline.json",
	"vitest.config.ts",
]);

const SCRIPT_ALLOWLIST = new Set([
	"extract-changelog-section.cjs",
	"copy-manifest.cjs",
	"kill-vite.cjs",
	"hot-reload-utils.cjs",
	"check-mojibake.cjs",
	"check-main-entry-imports.cjs",
	"check-native-browser-dialogs.cjs",
	"ensure-public-versions.cjs",
]);

const TEMPLATE_FILES = [
	"README.md",
	"README.en.md",
	"LICENSE",
	".gitignore",
	".github/workflows/release.yml",
];

const FORBIDDEN_STAGED_SEGMENTS = [
	"/docs/",
	"/.cursor/",
	"/.codex/",
	"/.augment/",
	"/backend/",
	"/design/",
	"/obsidian-review/",
	"/obsidian-community/",
	"/非常重要的文档",
	"/public-repo-github-workflows/",
	"generate-activation-codes",
	"generateMatchingCode",
];

const FORBIDDEN_CONTENT_PATTERNS = [
	/BEGIN (RSA )?PRIVATE KEY/,
	/generate-activation-codes\.cjs/,
];

function fail(message) {
	console.error(`[sync-obsidian-community-open] ${message}`);
	process.exit(1);
}

function gitIdentityEnv() {
	return {
		GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME || "Rabbit (zhuzhige)",
		GIT_COMMITTER_NAME: process.env.GIT_COMMITTER_NAME || "Rabbit (zhuzhige)",
		GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL || "zhuzhige123@users.noreply.github.com",
		GIT_COMMITTER_EMAIL:
			process.env.GIT_COMMITTER_EMAIL || "zhuzhige123@users.noreply.github.com",
	};
}

function run(command, args, options = {}) {
	return runInDir(PROJECT_ROOT, command, args, options);
}

function runInDir(cwd, command, args, options = {}) {
	const result = execFileSync(command, args, {
		cwd,
		encoding: "utf8",
		stdio: options.stdio ?? "inherit",
		env: command === "git" ? { ...process.env, ...gitIdentityEnv() } : process.env,
	});
	return typeof result === "string" ? result.trim() : "";
}

function runCapture(command, args) {
	return run(command, args, { stdio: "pipe" });
}

function runCaptureInDir(cwd, command, args) {
	return runInDir(cwd, command, args, { stdio: "pipe" });
}

function parseArgs(argv) {
	const args = { dryRun: false, version: null };
	for (let index = 0; index < argv.length; index += 1) {
		const token = argv[index];
		if (token === "--dry-run") {
			args.dryRun = true;
		} else if (token === "--version") {
			args.version = argv[index + 1];
			index += 1;
		} else if (token === "--help" || token === "-h") {
			console.log(
				"Usage: node scripts/sync-obsidian-community-open.cjs [--version x.y.z] [--dry-run]"
			);
			process.exit(0);
		} else {
			fail(`Unknown argument: ${token}`);
		}
	}
	return args;
}

function readJson(relativePath) {
	return JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, relativePath), "utf8"));
}

function writeJson(relativePath, value) {
	const absolutePath = path.join(PROJECT_ROOT, relativePath);
	fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
	fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`);
}

function normalizeRelativePath(relativePath) {
	return relativePath.replace(/\\/g, "/");
}

function shouldExcludeDevPath(relativePath) {
	const normalized = normalizeRelativePath(relativePath);
	const segments = normalized.split("/");
	const fileName = segments[segments.length - 1];

	if (normalized.startsWith("node_modules/")) return true;
	if (normalized.startsWith("dist/")) return true;
	if (normalized.startsWith(".git/")) return true;
	if (normalized.startsWith(".obsidian-community-staging/")) return true;
	if (normalized.startsWith(".desktop-hot-reload/")) return true;
	if (normalized.startsWith(".mobile-hot-reload/")) return true;
	if (normalized.startsWith("docs/")) return true;
	if (normalized.startsWith("obsidian-review/")) return true;
	if (normalized.startsWith("obsidian-community/")) return true;
	if (normalized.startsWith("backend/")) return true;
	if (normalized.startsWith("design/")) return true;
	if (normalized.startsWith("test-vault/")) return true;
	if (normalized.includes("非常重要的文档")) return true;

	if (/[\u4e00-\u9fff]/.test(normalized) && !normalized.startsWith("src/")) {
		return true;
	}

	const denyNames = [
		"AGENTS.md",
		".mcp.json",
		".mobile-config.json",
		"public-repo.gitignore",
		"celebration-messages.json",
	];
	if (denyNames.includes(fileName)) return true;

	if (/\.(pem|key|p12|pfx)$/i.test(fileName)) return true;
	if (/generated-.*\.(json|txt)$/i.test(fileName)) return true;
	if (/codes-.*\.(json|txt)$/i.test(fileName)) return true;
	if (/activation-code/i.test(fileName)) return true;
	if (/激活码|发卡|密钥管理/.test(normalized)) return true;

	if (normalized.startsWith("scripts/")) {
		return !SCRIPT_ALLOWLIST.has(fileName);
	}

	return false;
}

function copyFileEnsuringDir(sourcePath, destPath) {
	fs.mkdirSync(path.dirname(destPath), { recursive: true });
	fs.copyFileSync(sourcePath, destPath);
}

function copyTemplate(relativePath, stagingRoot) {
	const sourcePath = path.join(TEMPLATE_DIR, relativePath);
	if (!fs.existsSync(sourcePath)) {
		fail(`Missing community template: obsidian-community/${relativePath}`);
	}
	copyFileEnsuringDir(sourcePath, path.join(stagingRoot, relativePath));
}

function walkCopyDirectory(relativeDir, stagingRoot, stats) {
	const absoluteDir = path.join(PROJECT_ROOT, relativeDir);
	if (!fs.existsSync(absoluteDir)) return;

	for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
		const relativePath = normalizeRelativePath(
			relativeDir ? `${relativeDir}/${entry.name}` : entry.name
		);

		if (shouldExcludeDevPath(relativePath)) {
			stats.excluded += 1;
			continue;
		}

		const sourcePath = path.join(PROJECT_ROOT, relativePath);
		const destPath = path.join(stagingRoot, relativePath);

		if (entry.isDirectory()) {
			walkCopyDirectory(relativePath, stagingRoot, stats);
			continue;
		}

		copyFileEnsuringDir(sourcePath, destPath);
		stats.copied += 1;
	}
}

function buildVersionMetadata(version, { write = true } = {}) {
	const manifest = readJson("manifest.json");
	const minAppVersion = manifest.minAppVersion || "1.7.0";
	const versions = readJson("versions.json");
	const packageJson = readJson("package.json");

	manifest.version = version;
	packageJson.version = version;
	versions[version] = minAppVersion;

	if (write) {
		writeJson("manifest.json", manifest);
		writeJson("package.json", packageJson);
		writeJson("versions.json", versions);
		writeJson("public/versions.json", versions);
	}

	return { manifest, versions, packageJson };
}

function buildStagingTree(version, { writeLocalVersions = true } = {}) {
	const metadata = buildVersionMetadata(version, { write: writeLocalVersions });
	const stats = { copied: 0, excluded: 0 };

	if (fs.existsSync(STAGING_DIR)) {
		fs.rmSync(STAGING_DIR, { recursive: true, force: true });
	}
	fs.mkdirSync(STAGING_DIR, { recursive: true });

	for (const fileName of ROOT_INCLUDE_FILES) {
		const sourcePath = path.join(PROJECT_ROOT, fileName);
		if (!fs.existsSync(sourcePath)) {
			fail(`Missing required root file: ${fileName}`);
		}
		copyFileEnsuringDir(sourcePath, path.join(STAGING_DIR, fileName));
		stats.copied += 1;
	}

	writeJson(path.join(".obsidian-community-staging", "manifest.json"), metadata.manifest);
	writeJson(path.join(".obsidian-community-staging", "package.json"), metadata.packageJson);
	writeJson(path.join(".obsidian-community-staging", "versions.json"), metadata.versions);
	fs.mkdirSync(path.join(STAGING_DIR, "public"), { recursive: true });
	writeJson(path.join(".obsidian-community-staging", "public/versions.json"), metadata.versions);

	for (const scriptName of SCRIPT_ALLOWLIST) {
		const relativePath = `scripts/${scriptName}`;
		copyFileEnsuringDir(
			path.join(PROJECT_ROOT, relativePath),
			path.join(STAGING_DIR, relativePath)
		);
		stats.copied += 1;
	}

	walkCopyDirectory("src", STAGING_DIR, stats);

	for (const templateFile of TEMPLATE_FILES) {
		copyTemplate(templateFile, STAGING_DIR);
		stats.copied += 1;
	}

	scanStagingForViolations(STAGING_DIR);
	return { stats, metadata };
}

function scanStagingForViolations(stagingRoot) {
	const violations = [];

	function walk(currentDir) {
		for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
			const absolutePath = path.join(currentDir, entry.name);
			const relativePath = normalizeRelativePath(
				path.relative(stagingRoot, absolutePath)
			);

			if (entry.isDirectory()) {
				walk(absolutePath);
				continue;
			}

			for (const segment of FORBIDDEN_STAGED_SEGMENTS) {
				if (relativePath.includes(segment.replace(/^\//, ""))) {
					violations.push(`forbidden path: ${relativePath}`);
				}
			}

			if (!/\.(ts|js|svelte|json|md|mjs|cjs)$/i.test(entry.name)) {
				continue;
			}

			const content = fs.readFileSync(absolutePath, "utf8");
			for (const pattern of FORBIDDEN_CONTENT_PATTERNS) {
				if (pattern.test(content)) {
					violations.push(`forbidden content in ${relativePath}`);
				}
			}
		}
	}

	walk(stagingRoot);

	if (violations.length > 0) {
		fail(`Staging security check failed:\n  - ${violations.join("\n  - ")}`);
	}
}

function resolveRemoteUrl() {
	try {
		return runCapture("git", ["remote", "get-url", REMOTE]);
	} catch {
		return `https://github.com/${DEFAULT_GITHUB_REPO}.git`;
	}
}

function ensurePublishClone(remoteUrl) {
	if (!fs.existsSync(PUBLISH_DIR)) {
		fs.mkdirSync(PUBLISH_DIR, { recursive: true });
	}

	if (!fs.existsSync(path.join(PUBLISH_DIR, ".git"))) {
		const publishEntries = fs.readdirSync(PUBLISH_DIR);
		if (publishEntries.length > 0) {
			fail(`Publish directory is not empty: ${PUBLISH_DIR}`);
		}
		runInDir(PUBLISH_DIR, "git", ["clone", remoteUrl, "."]);
	}

	runInDir(PUBLISH_DIR, "git", ["fetch", REMOTE]);
	try {
		runInDir(PUBLISH_DIR, "git", ["checkout", DEFAULT_BRANCH]);
		runInDir(PUBLISH_DIR, "git", ["pull", "--ff-only", REMOTE, DEFAULT_BRANCH]);
	} catch {
		runInDir(PUBLISH_DIR, "git", ["checkout", "-B", DEFAULT_BRANCH]);
	}
}

function replacePublishTreeFromStaging(stagingRoot) {
	// Node recursive rm/cp can abort on Windows with STATUS_STACK_BUFFER_OVERRUN
	// for large trees; prefer robocopy / shell-assisted delete when available.
	if (process.platform === "win32") {
		for (const entry of fs.readdirSync(PUBLISH_DIR, { withFileTypes: true })) {
			if (entry.name === ".git") continue;
			const absolutePath = path.join(PUBLISH_DIR, entry.name);
			try {
				fs.rmSync(absolutePath, { recursive: true, force: true });
			} catch {
				// Fall through to robocopy mirror cleanup if needed.
			}
		}
		const result = spawnSync(
			"robocopy",
			[
				stagingRoot,
				PUBLISH_DIR,
				"/E",
				"/PURGE",
				"/XD",
				".git",
				"/NFL",
				"/NDL",
				"/NJH",
				"/NJS",
				"/nc",
				"/ns",
				"/np",
			],
			{ cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true }
		);
		// robocopy: 0-7 success, >=8 failure
		if ((result.status ?? 0) >= 8) {
			fail(`robocopy failed with exit code ${result.status}`);
		}
		return;
	}

	for (const entry of fs.readdirSync(PUBLISH_DIR, { withFileTypes: true })) {
		if (entry.name === ".git") continue;
		fs.rmSync(path.join(PUBLISH_DIR, entry.name), { recursive: true, force: true });
	}

	for (const entry of fs.readdirSync(stagingRoot, { withFileTypes: true })) {
		fs.cpSync(
			path.join(stagingRoot, entry.name),
			path.join(PUBLISH_DIR, entry.name),
			{ recursive: true }
		);
	}
}

function assertStagedFiles(stagingRoot) {
	const stagedFiles = [];
	function walk(currentDir, prefix = "") {
		for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
			const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
			const absolutePath = path.join(currentDir, entry.name);
			if (entry.isDirectory()) {
				walk(absolutePath, relativePath);
			} else {
				stagedFiles.push(relativePath);
			}
		}
	}
	walk(stagingRoot);

	if (!stagedFiles.some((file) => file.startsWith("src/"))) {
		fail("Refusing push: staged tree is missing src/ — open-source sync failed.");
	}
	for (const file of stagedFiles) {
		for (const segment of FORBIDDEN_STAGED_SEGMENTS) {
			if (file.includes(segment.replace(/^\//, ""))) {
				fail(`Refusing push: forbidden staged file: ${file}`);
			}
		}
	}
}

function resolveTargetVersion(explicitVersion) {
	if (explicitVersion) {
		if (!/^\d+\.\d+\.\d+$/.test(explicitVersion)) {
			fail(`Invalid version format: ${explicitVersion}`);
		}
		return explicitVersion;
	}
	const manifest = readJson("manifest.json");
	if (!manifest.version) {
		fail("manifest.json is missing version");
	}
	return manifest.version;
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const targetVersion = resolveTargetVersion(args.version);
	const githubRepo = process.env.IR_OBSIDIAN_GITHUB_REPO || DEFAULT_GITHUB_REPO;
	const remoteUrl = resolveRemoteUrl();

	console.log(`[sync-obsidian-community-open] Target version: ${targetVersion}`);
	console.log(`[sync-obsidian-community-open] Remote: ${remoteUrl}`);
	console.log(`[sync-obsidian-community-open] Public repo: https://github.com/${githubRepo}`);

	const { stats } = buildStagingTree(targetVersion, {
		writeLocalVersions: !args.dryRun,
	});

	console.log(
		`[sync-obsidian-community-open] Staging ready: copied=${stats.copied}, excluded=${stats.excluded}`
	);

	if (args.dryRun) {
		console.log("[sync-obsidian-community-open] Dry run only. Planned actions:");
		console.log(`  - clone/fetch into ${PUBLISH_DIR}`);
		console.log("  - replace publish tree with staged open-source submission files");
		console.log(`  - git commit + git push ${REMOTE} ${DEFAULT_BRANCH}`);
		console.log(`  - staging preview kept at: ${STAGING_DIR}`);
		return;
	}

	assertStagedFiles(STAGING_DIR);
	ensurePublishClone(remoteUrl);
	replacePublishTreeFromStaging(STAGING_DIR);
	runInDir(PUBLISH_DIR, "git", ["add", "-A", "-f"]);
	console.log(runCaptureInDir(PUBLISH_DIR, "git", ["diff", "--cached", "--stat"]));
	runInDir(PUBLISH_DIR, "git", [
		"commit",
		"-m",
		`Sync open-source community submission tree for ${targetVersion}.`,
	]);
	runInDir(PUBLISH_DIR, "git", ["push", REMOTE, DEFAULT_BRANCH]);
	fs.rmSync(STAGING_DIR, { recursive: true, force: true });

	console.log(
		`[sync-obsidian-community-open] Done. Verify: https://github.com/${githubRepo}/tree/${DEFAULT_BRANCH}`
	);
	console.log("[sync-obsidian-community-open] Open-source src/ synced; internal docs were excluded.");
}

main();
