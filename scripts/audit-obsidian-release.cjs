/**
 * Obsidian 发布前审查脚本
 *
 * 目标：
 * 1. 先运行仓库已有的官方宿主 lint 与类型检查
 * 2. 再补充一批官方审查高频关注点的静态扫描
 * 3. 在本地尽量提前发现会导致反复提审的问题
 *
 * 运行：
 *   npm run audit:obsidian-release
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = process.cwd();
const ANSI = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

function color(text, value) {
  return `${value}${text}${ANSI.reset}`;
}

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, fileName), "utf8"));
}

function readText(fileName) {
  return fs.readFileSync(path.join(ROOT, fileName), "utf8");
}

function normalizePath(filePath) {
  return filePath.replace(/\\/g, "/");
}

function compareVersions(a, b) {
  const aParts = String(a).split(".").map((part) => Number(part) || 0);
  const bParts = String(b).split(".").map((part) => Number(part) || 0);
  const max = Math.max(aParts.length, bParts.length);

  for (let index = 0; index < max; index += 1) {
    const left = aParts[index] ?? 0;
    const right = bParts[index] ?? 0;
    if (left > right) return 1;
    if (left < right) return -1;
  }

  return 0;
}

function resolveCommand(command, args = []) {
  if (process.platform === "win32") {
    return {
      command: process.env.ComSpec || "cmd.exe",
      args: ["/d", "/s", "/c", [command, ...args].map(quoteCmdArg).join(" ")],
    };
  }

  return { command, args };
}

function quoteCmdArg(value) {
  const text = String(value ?? "");
  if (!/[\s"]/u.test(text)) {
    return text;
  }

  return `"${text.replace(/(\\*)"/g, '$1$1\\"')}"`;
}

function runStep(label, command, args = []) {
  console.log(color(`\n[运行] ${label}`, ANSI.cyan));
  const resolved = resolveCommand(command, args);
  const result = spawnSync(resolved.command, resolved.args, {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 20,
  });

  const stdout = result.stdout?.trim();
  const stderr = result.stderr?.trim();
  if (stdout) console.log(stdout);
  if (stderr) console.log(stderr);

  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    error: result.error ?? null,
  };
}

function collectSourceFiles() {
  const sourceRoot = path.join(ROOT, "src");
  const results = [];
  const allowedExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".svelte", ".mjs", ".cjs"]);

  function shouldIgnore(normalizedPath) {
    return (
      normalizedPath.includes("/dist/") ||
      normalizedPath.includes("/backup-before-migration/") ||
      normalizedPath.includes("/node_modules/") ||
      normalizedPath.includes("/__tests__/") ||
      normalizedPath.includes("/tests/") ||
      normalizedPath.endsWith(".test.ts") ||
      normalizedPath.endsWith(".test.tsx") ||
      normalizedPath.endsWith(".test.js") ||
      normalizedPath.endsWith(".test.jsx") ||
      normalizedPath.endsWith(".test.svelte") ||
      normalizedPath.endsWith(".spec.ts") ||
      normalizedPath.endsWith(".spec.tsx") ||
      normalizedPath.endsWith(".spec.js") ||
      normalizedPath.endsWith(".spec.jsx") ||
      normalizedPath.endsWith(".spec.svelte") ||
      normalizedPath.endsWith(".d.ts")
    );
  }

  function walk(currentDir) {
    if (!fs.existsSync(currentDir)) {
      return;
    }

    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = path.join(currentDir, entry.name);
      const normalizedPath = normalizePath(path.relative(ROOT, absolutePath));

      if (entry.isDirectory()) {
        if (shouldIgnore(`/${normalizedPath}/`)) {
          continue;
        }
        walk(absolutePath);
        continue;
      }

      if (!allowedExtensions.has(path.extname(entry.name).toLowerCase())) {
        continue;
      }
      if (shouldIgnore(normalizedPath)) {
        continue;
      }
      results.push(absolutePath);
    }
  }

  walk(sourceRoot);
  return results;
}

function scanPattern(pattern, options = {}) {
  const files = options.files ?? collectSourceFiles();
  const matches = [];

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
      if (pattern.test(line)) {
        matches.push({
          file: normalizePath(file),
          line: index + 1,
          text: line.trim(),
        });
      }
      pattern.lastIndex = 0;
    });
  }

  return matches;
}

function printFindings(level, title, items, limit = 12) {
  if (!items.length) return;
  const tag = level === "error" ? color("ERROR", ANSI.red) : color("WARN ", ANSI.yellow);
  console.log(`\n${tag} ${title} (${items.length})`);
  items.slice(0, limit).forEach((item) => {
    console.log(`  - ${item.file}:${item.line}`);
  });
  if (items.length > limit) {
    console.log(`  - ... 另外还有 ${items.length - limit} 处`);
  }
}

function main() {
  const manifest = readJson("manifest.json");
  const packageJson = readJson("package.json");
  const eslintConfig = readText("eslint.obsidian.config.mjs");
  const sourceFiles = collectSourceFiles();

  const errors = [];
  const warnings = [];

  const licensePath = path.join(ROOT, "LICENSE");
  if (!fs.existsSync(licensePath)) {
    errors.push({
      kind: "meta",
      title: "缺少根目录 LICENSE 文件",
      matches: [{ file: "LICENSE", line: 1, text: "missing" }],
    });
  } else {
    const licenseText = fs.readFileSync(licensePath, "utf8");
    if (!/GNU GENERAL PUBLIC LICENSE/i.test(licenseText) || !/Version 3/i.test(licenseText)) {
      errors.push({
        kind: "meta",
        title: "LICENSE 不是 GitHub/Obsidian 可识别的 GPL-3.0 完整文本",
        matches: [{ file: "LICENSE", line: 1, text: "invalid license body" }],
      });
    }
    if (!/Copyright \(C\) 2025-2026 Rabbit \(zhuzhige\)/.test(licenseText)) {
      warnings.push({
        kind: "meta",
        title: "LICENSE 版权行与当前维护者不一致，GitHub 可能无法识别许可证",
        matches: [{ file: "LICENSE", line: 1, text: "copyright holder" }],
      });
    }
  }

  if (packageJson.license !== "GPL-3.0-or-later") {
    warnings.push({
      kind: "meta",
      title: 'package.json license 应为 "GPL-3.0-or-later"',
      matches: [{ file: "package.json", line: 1, text: String(packageJson.license || "") }],
    });
  }

  const releaseWorkflowPath = path.join(ROOT, ".github", "workflows", "release.yml");
  if (fs.existsSync(releaseWorkflowPath)) {
    const releaseWorkflow = fs.readFileSync(releaseWorkflowPath, "utf8");
    if (!/actions\/attest-build-provenance@v3/.test(releaseWorkflow)) {
      errors.push({
        kind: "meta",
        title: "Release workflow 缺少 artifact attestation 步骤",
        matches: [{ file: ".github/workflows/release.yml", line: 1, text: "attest-build-provenance" }],
      });
    }
    if (!/dist\/main\.js[\s\S]*dist\/manifest\.json[\s\S]*dist\/styles\.css/.test(releaseWorkflow)) {
      warnings.push({
        kind: "meta",
        title: "Release workflow 应仅上传 main.js / manifest.json / styles.css",
        matches: [{ file: ".github/workflows/release.yml", line: 1, text: "files" }],
      });
    }
    if (!/name:\s*\$\{\{\s*steps\.version\.outputs\.tag\s*\}\}/.test(releaseWorkflow)) {
      warnings.push({
        kind: "meta",
        title: "Release 标题应等于版本号 tag（例如 0.5.6），不要留空或使用产品名前缀",
        matches: [{ file: ".github/workflows/release.yml", line: 1, text: "name" }],
      });
    }
  }

  console.log(color("\n==============================================", ANSI.cyan));
  console.log(color("Obsidian 发布前审查", ANSI.bold));
  console.log(color("==============================================", ANSI.cyan));
  console.log(`插件版本: ${packageJson.version}`);
  console.log(`minAppVersion: ${manifest.minAppVersion}`);
  console.log(`源码文件数: ${sourceFiles.length}`);

  const lintResult = runStep("npm run lint:obsidian", "npm", ["run", "lint:obsidian"]);
  if (lintResult.error) {
    warnings.push({
      kind: "command",
      title: `无法在当前环境内联运行 npm run lint:obsidian: ${lintResult.error.message}`,
      matches: [{ file: "scripts/audit-obsidian-release.cjs", line: 1, text: "spawnSync" }],
    });
  } else if (!lintResult.ok) {
    errors.push({ kind: "command", title: "官方宿主 ESLint 未通过" });
  }

  const checkResult = runStep("npm run check", "npm", ["run", "check"]);
  if (checkResult.error) {
    warnings.push({
      kind: "command",
      title: `无法在当前环境内联运行 npm run check: ${checkResult.error.message}`,
      matches: [{ file: "scripts/audit-obsidian-release.cjs", line: 1, text: "spawnSync" }],
    });
  } else if (!checkResult.ok) {
    errors.push({ kind: "command", title: "类型检查 / svelte-check 未通过" });
  }

  const apiRequirements = [
    { name: "Workspace.revealLeaf", min: "1.7.2", pattern: /\.\s*revealLeaf\s*\(/ },
    { name: "App.loadLocalStorage", min: "1.8.7", pattern: /\.\s*loadLocalStorage\s*\(/ },
    { name: "App.saveLocalStorage", min: "1.8.7", pattern: /\.\s*saveLocalStorage\s*\(/ },
  ];

  apiRequirements.forEach((entry) => {
    if (compareVersions(manifest.minAppVersion, entry.min) < 0) {
      const matches = scanPattern(entry.pattern, { files: sourceFiles });
      if (matches.length) {
        errors.push({
          kind: "scan",
          title: `${entry.name} 需要 Obsidian ${entry.min}，但当前 minAppVersion 是 ${manifest.minAppVersion}`,
          matches,
        });
      }
    }
  });

  const hardErrors = [
    {
      title: "不允许创建 style 元素注入样式",
      pattern: /\bcreate(?:El|Element)\s*\(\s*['"]style['"]/,
    },
  ];

  hardErrors.forEach((entry) => {
    const matches = scanPattern(entry.pattern, { files: sourceFiles });
    if (matches.length) {
      errors.push({
        kind: "scan",
        title: entry.title,
        matches,
      });
    }
  });

  const softWarnings = [
    {
      title: "发现直接禁用 obsidianmd/ui/sentence-case",
      pattern: /eslint-disable-next-line\s+obsidianmd\/ui\/sentence-case/,
    },
    {
      title: "发现直接写入 element.style.*，建议人工复核是否必须保留为动态样式",
      pattern: /\.style\.[A-Za-z_$][\w$]*\s*=/,
    },
    {
      title: "发现直接使用 navigator.clipboard，应改用 utils/system-clipboard",
      pattern: /\bnavigator\.clipboard\b/,
      ignoreFiles: ["src/utils/system-clipboard.ts"],
    },
  ];

  softWarnings.forEach((entry) => {
    let matches = scanPattern(entry.pattern, { files: sourceFiles });
    if (entry.ignoreFiles?.length) {
      matches = matches.filter((match) => {
        const normalizedFile = normalizePath(match.file);
        return !entry.ignoreFiles.some((ignored) =>
          normalizedFile.endsWith(normalizePath(ignored)),
        );
      });
    }
    if (matches.length) {
      warnings.push({
        kind: "scan",
        title: entry.title,
        matches,
      });
    }
  });

  const riskyDependencies = ["builtin-modules", "dotenv", "glob"];
  riskyDependencies.forEach((name) => {
    const present =
      packageJson.dependencies?.[name] != null || packageJson.devDependencies?.[name] != null;
    if (present) {
      warnings.push({
        kind: "meta",
        title: `package.json 仍包含可能被官方提醒的依赖: ${name}`,
        matches: [{ file: "package.json", line: 1, text: name }],
      });
    }
  });

  console.log(color("\n[结果汇总]", ANSI.cyan));
  console.log(`错误: ${errors.length}`);
  console.log(`警告: ${warnings.length}`);

  errors.forEach((item) => {
    if (item.matches?.length) {
      printFindings("error", item.title, item.matches);
    } else {
      console.log(`\n${color("ERROR", ANSI.red)} ${item.title}`);
    }
  });

  warnings.forEach((item) => {
    if (item.matches?.length) {
      printFindings("warning", item.title, item.matches);
    } else {
      console.log(`\n${color("WARN ", ANSI.yellow)} ${item.title}`);
    }
  });

  if (errors.length) {
    console.log(color("\n结论：当前不适合直接提交官方审核。", ANSI.red));
    process.exit(1);
  }

  console.log(color("\n结论：当前没有发现会直接阻断提交的本地高优先级问题。", ANSI.green));
  if (warnings.length) {
    console.log(color("仍建议先处理上面的警告，再进入正式提审。", ANSI.yellow));
  }
}

main();
