const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const LOCK_FILES = [
	{ path: path.join(PROJECT_ROOT, ".dev-watch.lock.json"), label: "dev watcher" },
	{ path: path.join(PROJECT_ROOT, ".mobile-watch.lock.json"), label: "mobile watch" }
];

function isProcessAlive(pid) {
	if (!Number.isInteger(pid) || pid <= 0) {
		return false;
	}

	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

function removeLockFile() {
	for (const lockFile of LOCK_FILES) {
		if (fs.existsSync(lockFile.path)) {
			fs.rmSync(lockFile.path, { force: true });
		}
	}
}

let stoppedAny = false;

for (const lockFile of LOCK_FILES) {
	if (!fs.existsSync(lockFile.path)) {
		continue;
	}

	let lock;
	try {
		lock = JSON.parse(fs.readFileSync(lockFile.path, "utf8"));
	} catch {
		fs.rmSync(lockFile.path, { force: true });
		continue;
	}

	const pid = Number(lock?.pid);
	if (!isProcessAlive(pid)) {
		fs.rmSync(lockFile.path, { force: true });
		continue;
	}

	try {
		if (process.platform === "win32") {
			execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
				stdio: "ignore"
			});
		} else {
			process.kill(pid, "SIGTERM");
		}

		console.log(`Stopped ${lockFile.label} process: ${pid}`);
		stoppedAny = true;
	} catch (error) {
		console.warn(`Unable to stop ${lockFile.label} process ${pid}: ${error.message}`);
	} finally {
		fs.rmSync(lockFile.path, { force: true });
	}
}

if (!stoppedAny) {
	removeLockFile();
}
