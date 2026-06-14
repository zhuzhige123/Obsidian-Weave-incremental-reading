export function resolveReadingPointSaveErrorMessage(error: unknown): string {
	if (error instanceof Error && error.message.startsWith("reading-point-edit-")) {
		return "保存失败，请检查输入内容";
	}
	if (error instanceof Error && error.message) {
		return error.message;
	}
	return "保存失败，请稍后重试";
}
