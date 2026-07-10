/**
 * 与 Weave 主插件的轻量协作契约（仅字符串常量，无源码依赖）。
 * Weave 在记忆学习视图打开/关闭时广播 `Weave:memory-study-session`。
 */
export const WEAVE_MEMORY_STUDY_SESSION_EVENT = "Weave:memory-study-session";

/** Weave 记忆学习视图类型，与 `StudyView.VIEW_TYPE_STUDY` 保持一致。 */
export const WEAVE_STUDY_VIEW_TYPE = "weave-study-view";

export type WeaveMemoryStudySessionDetail = {
	active?: boolean;
};
