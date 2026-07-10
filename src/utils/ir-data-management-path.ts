/** 数据管理界面用的路径展示：优先相对规范目录，否则截断为 …/父目录/文件名 */
export function formatIRDataManagementPathLabel(
	absolutePath: string,
	baseDir = "",
): { display: string; full: string } {
	const full = absolutePath;
	const normalizedBase = baseDir.replace(/\/$/, "");
	if (normalizedBase && full.startsWith(`${normalizedBase}/`)) {
		return { display: full.slice(normalizedBase.length + 1), full };
	}

	const segments = full.split("/").filter(Boolean);
	if (segments.length <= 2) {
		return { display: full, full };
	}

	return { display: `…/${segments.slice(-2).join("/")}`, full };
}
