const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const rootVersionsPath = path.join(projectRoot, "versions.json");
const publicDir = path.join(projectRoot, "public");
const publicVersionsPath = path.join(publicDir, "versions.json");

if (!fs.existsSync(rootVersionsPath)) {
	console.error("[ensure-public-versions] Missing versions.json");
	process.exit(1);
}

const versions = fs.readFileSync(rootVersionsPath, "utf8");
fs.mkdirSync(publicDir, { recursive: true });

const needsWrite =
	!fs.existsSync(publicVersionsPath) || fs.readFileSync(publicVersionsPath, "utf8") !== versions;

if (needsWrite) {
	fs.writeFileSync(publicVersionsPath, versions.endsWith("\n") ? versions : `${versions}\n`);
	console.log("[ensure-public-versions] Synced public/versions.json from versions.json");
}
