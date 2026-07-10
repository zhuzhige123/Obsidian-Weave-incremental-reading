/**
 * Patch an existing GitHub Release body from CHANGELOG.md.
 *
 * Usage:
 *   node scripts/patch-github-release-notes.cjs 0.5.14
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DEFAULT_GITHUB_REPO = "zhuzhige123/Obsidian-Weave-incremental-reading";

function fail(message) {
	console.error(`[patch-github-release-notes] ${message}`);
	process.exit(1);
}

function getGitHubTokenFromGitCredential() {
	try {
		const output = execFileSync("git", ["credential", "fill"], {
			input: "protocol=https\nhost=github.com\n",
			encoding: "utf8",
			stdio: ["pipe", "pipe", "pipe"],
		});
		const match = output.match(/^password=(.+)$/m);
		return match ? match[1].trim() : null;
	} catch {
		return null;
	}
}

function main() {
	const version = process.argv[2];
	if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
		fail("Usage: node scripts/patch-github-release-notes.cjs <semver>");
	}

	const extractScript = path.join(__dirname, "extract-changelog-section.cjs");
	const notes = execFileSync(process.execPath, [extractScript, version], {
		cwd: PROJECT_ROOT,
		encoding: "utf8",
	});

	const notesPath = path.join(os.tmpdir(), `ir-release-notes-${version}.md`);
	fs.writeFileSync(notesPath, notes, "utf8");

	const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || getGitHubTokenFromGitCredential();
	if (!token) {
		fail("GitHub token unavailable. Set GH_TOKEN or authenticate git credential / gh auth login.");
	}

	const repo = process.env.IR_OBSIDIAN_GITHUB_REPO || DEFAULT_GITHUB_REPO;
	const env = {
		...process.env,
		GH_TOKEN: token,
	};

	const result = spawnSync(
		"gh",
		["release", "edit", version, "--repo", repo, "--notes-file", notesPath],
		{ cwd: PROJECT_ROOT, encoding: "utf8", env, stdio: "pipe" }
	);

	if (result.status !== 0) {
		console.error(result.stderr || result.stdout || "gh release edit failed");
		process.exit(result.status ?? 1);
	}

	console.log(`[patch-github-release-notes] Updated https://github.com/${repo}/releases/tag/${version}`);
}

main();
