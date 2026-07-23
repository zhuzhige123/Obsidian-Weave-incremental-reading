/**
 * Open-source Obsidian community release pipeline.
 *
 * 1. audit + local build verification
 * 2. sync full src tree to public main
 * 3. push version tag (triggers GitHub Actions release workflow)
 *
 * Usage:
 *   node scripts/push-obsidian-community-release.cjs
 *   node scripts/push-obsidian-community-release.cjs --version 0.5.5
 *   node scripts/push-obsidian-community-release.cjs --dry-run
 */
const fs = require("fs");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SYNC_SCRIPT = path.join(PROJECT_ROOT, "scripts", "sync-obsidian-community-open.cjs");
const DEFAULT_GITHUB_REPO = "zhuzhige123/Obsidian-Weave-incremental-reading";
const REMOTE = "origin";
const RELEASE_ASSETS = ["dist/main.js", "dist/manifest.json", "dist/styles.css"];

function fail(message) {
	console.error(`[push-obsidian-community-release] ${message}`);
	process.exit(1);
}

function run(command, args, options = {}) {
	const result = execFileSync(command, args, {
		cwd: PROJECT_ROOT,
		encoding: "utf8",
		stdio: options.stdio ?? "inherit",
	});
	return typeof result === "string" ? result.trim() : "";
}

function runCapture(command, args) {
	return run(command, args, { stdio: "pipe" });
}

function parseArgs(argv) {
	const args = { dryRun: false, version: null, skipSync: false };
	for (let index = 0; index < argv.length; index += 1) {
		const token = argv[index];
		if (token === "--dry-run") {
			args.dryRun = true;
		} else if (token === "--version") {
			args.version = argv[index + 1];
			index += 1;
		} else if (token === "--skip-sync") {
			args.skipSync = true;
		} else if (token === "--help" || token === "-h") {
			console.log(
				"Usage: node scripts/push-obsidian-community-release.cjs [--version x.y.z] [--dry-run] [--skip-sync]"
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

function resolveGhCommand() {
	const candidates = ["gh", "C:\\Program Files\\GitHub CLI\\gh.exe"];
	for (const candidate of candidates) {
		try {
			runCapture(candidate, ["--version"]);
			return candidate;
		} catch {
			// try next
		}
	}
	return null;
}

function runNpmScript(scriptName) {
	const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
	const result = spawnSync(npmCmd, ["run", scriptName], {
		cwd: PROJECT_ROOT,
		stdio: "inherit",
		shell: process.platform === "win32",
	});
	if (result.status !== 0) {
		fail(`npm run ${scriptName} failed`);
	}
}

function assertReleaseAssets() {
	for (const asset of RELEASE_ASSETS) {
		if (!fs.existsSync(path.join(PROJECT_ROOT, asset))) {
			fail(`Missing release asset: ${asset}`);
		}
	}
}

function tagExists(version, ghCommand) {
	if (ghCommand) {
		try {
			runCapture(ghCommand, ["release", "view", version, "--repo", DEFAULT_GITHUB_REPO]);
			return true;
		} catch {
			// fall through to git ls-remote
		}
	}
	const remoteTags = runCapture("git", ["ls-remote", "--tags", REMOTE, `refs/tags/${version}`]);
	return remoteTags.trim().length > 0;
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const version = resolveTargetVersion(args.version);
	const repo = process.env.IR_OBSIDIAN_GITHUB_REPO || DEFAULT_GITHUB_REPO;

	console.log(`[push-obsidian-community-release] Target version: ${version}`);
	console.log(`[push-obsidian-community-release] Public repo: https://github.com/${repo}`);

	if (args.dryRun) {
		console.log("[push-obsidian-community-release] Dry run only. Planned actions:");
		console.log("  - npm run lint:obsidian:community:errors");
		console.log("  - npm run audit:obsidian-release");
		console.log("  - npm run build");
		console.log(`  - node scripts/sync-obsidian-community-open.cjs --version ${version}`);
		console.log(`  - git fetch origin && git tag ${version} origin/main && git push origin ${version}`);
		return;
	}

	const ghCommand = resolveGhCommand();
	if (!ghCommand) {
		console.log(
			"[push-obsidian-community-release] GitHub CLI not found; using git for tag push only."
		);
	}

	if (tagExists(version, ghCommand)) {
		fail(`Release tag ${version} already exists on ${repo}. Bump version before publishing.`);
	}

	runNpmScript("lint:obsidian:community:errors");
	runNpmScript("audit:obsidian-release");
	runNpmScript("build");
	assertReleaseAssets();

	if (!args.skipSync) {
		run(process.execPath, [SYNC_SCRIPT, "--version", version]);
	}

	run("git", ["fetch", REMOTE]);
	run("git", ["tag", "-a", version, `${REMOTE}/main`, "-m", `Release ${version}`]);
	run("git", ["push", REMOTE, version]);

	console.log(`[push-obsidian-community-release] Tag pushed. GitHub Actions will publish the release.`);
	console.log(`[push-obsidian-community-release] Track: https://github.com/${repo}/actions`);
	console.log(`[push-obsidian-community-release] Release: https://github.com/${repo}/releases/tag/${version}`);
	console.log("");
	console.log("Next: submit at https://community.obsidian.md (Plugins → New plugin)");
}

main();
