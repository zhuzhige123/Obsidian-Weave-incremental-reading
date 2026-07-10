export const IMPORTABLE_EXTENSIONS = new Set(["md", "pdf", "epub"]);

export const STRATEGY_OPTIONS = [
	{ value: "even", labelKey: "irImport.scheduling.strategies.even" },
	{ value: "balanced", labelKey: "irImport.scheduling.strategies.balanced" },
	{
		value: "front-loaded",
		labelKey: "irImport.scheduling.strategies.frontLoaded",
	},
] as const;

export const INITIAL_IMPORT_ORDERING_OPTIONS = [
	{
		value: "preserve-source-order",
		labelKey: "irImport.scheduling.ordering.preserveSourceOrder",
	},
	{
		value: "pure-scheduling",
		labelKey: "irImport.scheduling.ordering.pureScheduling",
	},
] as const;

export const SCHEDULING_PRESET_KEYS: Record<
	string,
	"week" | "twoWeeks" | "month"
> = {
	week: "week",
	twoWeeks: "twoWeeks",
	month: "month",
};
